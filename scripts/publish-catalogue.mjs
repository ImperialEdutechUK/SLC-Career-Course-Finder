#!/usr/bin/env node
/**
 * Catalogue publication pipeline.
 *
 *   source import -> staging -> validation -> duplicate/conflict detection
 *   -> review -> approval -> versioned release -> atomic publication -> rollback
 *
 * This script performs the offline half. It reads the immutable July 2026 staging
 * snapshot, applies only the declared derivations in scripts/editorial-rules.mjs,
 * quarantines identity conflicts, and writes an immutable release plus a manifest.
 * The application only ever reads a published release; it never reads the snapshot.
 *
 * Run: npm run prepare:catalogue
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EDITORIAL_RULES_VERSION, EDITORIAL_REVIEW_STATUS, REVIEW_VALID_MONTHS,
  sourcePointer, deriveActive, deriveQualificationStatus, deriveLevel,
  deriveCategoryIds, deriveEntryPolicy, deriveCanonicalId, slugify
} from './editorial-rules.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const SOURCE = join(root, 'data/source/catalog_staging.json');
const QUESTIONNAIRE = join(root, 'data/source/questionnaire.json');
const AUDIT = join(root, 'data/source/catalog_audit.json');
const OUT_DIR = join(root, 'data/generated');

/** Fields the engine requires a non-conflicting, unexpired review for. */
const REVIEWED_FIELDS = ['active', 'title', 'url', 'categoryIds', 'qualification_status', 'entry_policy', 'level'];

const ALLOWED_HOSTS = (process.env.ALLOWED_COURSE_URL_HOSTS ?? 'southlondoncollege.org')
  .split(',').map(host => host.trim().toLowerCase()).filter(Boolean);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function reviewValidUntil(auditedOn) {
  const base = new Date(`${auditedOn}T00:00:00Z`);
  base.setUTCMonth(base.getUTCMonth() + REVIEW_VALID_MONTHS);
  return base.toISOString().replace(/\.\d{3}Z$/, '.000Z');
}

/** Stage 2: validate one staged row before it is allowed to become a candidate. */
function validateRow(record) {
  const issues = [];
  if (typeof record.title !== 'string' || !record.title.trim()) issues.push('title_missing');
  if (!record.url_group_id) issues.push('identity_missing');
  try {
    const url = new URL(record.url);
    if (url.protocol !== 'https:') issues.push('url_not_https');
    if (url.username || url.password) issues.push('url_has_credentials');
    if (url.port && url.port !== '443') issues.push('url_nonstandard_port');
    if (!ALLOWED_HOSTS.includes(url.hostname)) issues.push(`url_host_not_allowed:${url.hostname}`);
  } catch {
    issues.push('url_invalid');
  }
  if (!Array.isArray(record.category_memberships) || record.category_memberships.length === 0) {
    issues.push('category_membership_missing');
  }
  if (record.data_status !== 'unverified_snapshot') issues.push(`unexpected_data_status:${record.data_status}`);
  return issues;
}

/** Stage 4/5: turn one reviewed row into the engine's approved catalogue contract. */
function toApprovedCourse(record, validUntil) {
  const active = deriveActive(record);
  const qualification = deriveQualificationStatus(record);
  const level = deriveLevel(record);
  const categoryIds = deriveCategoryIds(record);
  const source = sourcePointer(record);

  const course = {
    canonical_id: deriveCanonicalId(record),
    record_id: record.record_id,
    title: record.title,
    url: record.url,
    active: active.value,
    review_status: 'approved',
    qualification_status: qualification.value,
    categoryIds,
    entry_policy: deriveEntryPolicy(record)
    // priceGbp, hoursPerWeek, goals and experienceFit are deliberately absent: the
    // snapshot does not state them, and unknown must stay unknown.
  };
  if (level.value !== null) course.level = level.value;

  const reviewed = REVIEWED_FIELDS.filter(field => field !== 'level' || course.level !== undefined);
  course.field_reviews = Object.fromEntries(reviewed.map(field => [field, {
    conflicting: false,
    valid_until: validUntil,
    source
  }]));
  return course;
}

/** Display facts kept beside the engine record for the catalogue and detail pages. */
function toDisplayRecord(record, course) {
  return {
    canonicalId: course.canonical_id,
    title: record.title,
    url: record.url,
    level: course.level ?? null,
    levelLabel: record.level_label ?? null,
    awardingBodyLabel: record.awarding_body_label ?? null,
    qualificationStatus: course.qualification_status,
    sourceQualificationStatus: record.qualification_status,
    primaryCategory: record.primary_category,
    primaryCategoryId: slugify(record.primary_category),
    primarySubcategory: record.primary_subcategory ?? null,
    categoryIds: course.categoryIds,
    memberships: (record.category_memberships ?? []).map(membership => ({
      category: membership.category,
      categoryId: slugify(membership.category),
      subcategory: membership.subcategory ?? null,
      subcategoryId: membership.subcategory ? `sub_${slugify(membership.subcategory)}` : null,
      primary: membership.primary === true
    })),
    // Everything below is unknown in this release. Null means unknown, never zero,
    // never free, never "no requirement".
    priceGbp: null,
    hoursPerWeek: null,
    tqtHours: record.tqt_hours ?? null,
    entryRequirements: record.entry_requirements ?? null,
    placementRequired: record.placement_required ?? null,
    sourceRow: record.source_row,
    sourceSheet: record.source_sheet,
    recordId: record.record_id
  };
}

function main() {
  const staging = JSON.parse(readFileSync(SOURCE, 'utf8'));
  const audit = JSON.parse(readFileSync(AUDIT, 'utf8'));
  const validUntil = reviewValidUntil(staging.audited_on);

  const quarantined = [];
  const rejected = [];

  // Stage 2 — validation.
  const valid = [];
  for (const record of staging.records) {
    const issues = validateRow(record);
    if (issues.length) rejected.push({ recordId: record.record_id, sourceRow: record.source_row, issues });
    else valid.push(record);
  }

  // Stage 3 — duplicate and conflict detection by canonical identity.
  // Rows are never deduplicated by title. Rows sharing a URL group are one identity;
  // if their reviewable content differs, the whole group is quarantined.
  const groups = new Map();
  for (const record of valid) {
    const id = deriveCanonicalId(record);
    const entries = groups.get(id) ?? [];
    entries.push(record);
    groups.set(id, entries);
  }

  const courses = [];
  const display = [];
  for (const [canonicalId, entries] of groups) {
    const fingerprint = entry => JSON.stringify({
      title: entry.title,
      level: entry.level_label,
      awardingBody: entry.awarding_body_label,
      categories: deriveCategoryIds(entry),
      qualification: entry.qualification_status
    });
    const distinct = new Set(entries.map(fingerprint));
    if (distinct.size > 1) {
      quarantined.push({
        canonicalId,
        reason: 'conflicting_duplicate_identity',
        detail: 'Source rows share one course URL but state different reviewable content. Resolve with the course owner before publication.',
        rows: entries.map(entry => ({
          recordId: entry.record_id, sourceRow: entry.source_row,
          title: entry.title, awardingBodyLabel: entry.awarding_body_label
        }))
      });
      continue;
    }
    const record = entries[0];
    const course = toApprovedCourse(record, validUntil);
    if (course.qualification_status === null) {
      quarantined.push({ canonicalId, reason: 'unmapped_qualification_status', rows: [{ recordId: record.record_id, sourceRow: record.source_row }] });
      continue;
    }
    courses.push(course);
    display.push(toDisplayRecord(record, course));
  }

  // Stage 6 — build the immutable release.
  const categories = new Map();
  for (const item of display) {
    for (const membership of item.memberships) {
      const category = categories.get(membership.categoryId) ?? {
        id: membership.categoryId, label: membership.category, courseCount: 0, subcategories: new Map()
      };
      category.courseCount += 1;
      if (membership.subcategoryId) {
        const sub = category.subcategories.get(membership.subcategoryId) ?? {
          id: membership.subcategoryId, label: membership.subcategory, courseCount: 0
        };
        sub.courseCount += 1;
        category.subcategories.set(membership.subcategoryId, sub);
      }
      categories.set(membership.categoryId, category);
    }
  }
  const taxonomy = [...categories.values()]
    .map(category => ({
      ...category,
      subcategories: [...category.subcategories.values()].sort((a, b) => a.label.localeCompare(b.label, 'en-GB'))
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en-GB'));

  const payload = {
    schemaVersion: 'release-1',
    editorialRulesVersion: EDITORIAL_RULES_VERSION,
    reviewStatus: EDITORIAL_REVIEW_STATUS,
    sourceFile: staging.source_file,
    sourceSha256: staging.source_sha256,
    snapshotPeriod: staging.snapshot_period,
    auditedOn: staging.audited_on,
    reviewValidUntil: validUntil,
    allowedUrlHosts: ALLOWED_HOSTS,
    sourceRowCount: staging.row_count,
    courses,
    display,
    taxonomy,
    quarantined,
    rejected,
    unknownFields: {
      priceGbp: 'not stated in the source snapshot',
      hoursPerWeek: 'not stated in the source snapshot',
      goals: 'no reviewed course goal tags exist',
      experienceFit: 'no reviewed readiness tags exist',
      entryRequirements: 'no reviewed entry rule exists; every course is check_needed'
    },
    sourceAudit: audit
  };

  const checksum = sha256(JSON.stringify(payload));
  const releaseId = `july2026-${staging.audited_on}-${checksum.slice(0, 12)}`;
  const release = { releaseId, checksum, publishedAt: new Date().toISOString(), ...payload };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, `${releaseId}.json`), JSON.stringify(release, null, 0));

  // Stage 7 — atomic publication: the manifest pointer is the only thing that changes.
  // Rollback = point `activeReleaseId` at a previously published, tested release file.
  const previous = (() => {
    try { return JSON.parse(readFileSync(join(OUT_DIR, 'release-manifest.json'), 'utf8')); }
    catch { return null; }
  })();
  const known = readdirSync(OUT_DIR).filter(name => name.endsWith('.json') && name !== 'release-manifest.json');
  const manifest = {
    schemaVersion: 'manifest-1',
    activeReleaseId: releaseId,
    activeReleaseFile: `${releaseId}.json`,
    checksum,
    publishedAt: release.publishedAt,
    previousReleaseId: previous && previous.activeReleaseId !== releaseId ? previous.activeReleaseId : (previous?.previousReleaseId ?? null),
    availableReleases: known.sort(),
    // Read from the questionnaire rather than restated here. Hardcoding it meant
    // that adding C8 left the manifest, and therefore /api/v1/health/ready,
    // reporting a version the service no longer served.
    questionnaireVersion: JSON.parse(readFileSync(QUESTIONNAIRE, 'utf8')).contentVersion,
    editorialRulesVersion: EDITORIAL_RULES_VERSION,
    reviewStatus: EDITORIAL_REVIEW_STATUS,
    emergencySuppressionList: []
  };
  writeFileSync(join(OUT_DIR, 'release-manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`Catalogue release ${releaseId}`);
  console.log(`  source rows      ${staging.row_count}`);
  console.log(`  validated        ${valid.length}`);
  console.log(`  rejected         ${rejected.length}`);
  console.log(`  canonical groups ${groups.size}`);
  console.log(`  quarantined      ${quarantined.length}`);
  console.log(`  published        ${courses.length}`);
  console.log(`  categories       ${taxonomy.length}`);
  console.log(`  review valid to  ${validUntil}`);
}

main();
