import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  approvedCourses, catalogueReady, displayById, displayRecords, getManifest, getRelease
} from '@/lib/catalogue/release';
import { subjectOptions } from '@/lib/questionnaire';
import {
  deriveCategoryIds, deriveEntryPolicy, deriveLevel, deriveQualificationStatus,
  OMITTED_UNKNOWN_FIELDS, slugify
} from '../scripts/editorial-rules.mjs';
import audit from '~data/source/catalog_audit.json';
import staging from '~data/source/catalog_staging.json';

/**
 * The publication pipeline is checked against the source snapshot it was built from,
 * and against the rule that nothing absent from the source may appear in the release.
 */

describe('release integrity', () => {
  const release = getRelease();
  const manifest = getManifest();

  it('is ready and checksum-verified', () => {
    expect(catalogueReady(new Date('2026-09-09T12:00:00Z'))).toEqual({ ready: true });
    expect(release.checksum).toBe(manifest.checksum);
  });

  it('reconciles with the source audit', () => {
    expect(release.sourceRowCount).toBe(staging.row_count);
    expect(staging.row_count).toBe(audit.total);
    expect(release.courses.length + release.quarantined.length).toBe(394);
    expect(release.taxonomy).toHaveLength(16);
  });

  it('quarantines the known conflicting URL group rather than publishing either row', () => {
    const conflict = release.quarantined.find(group => group.reason === 'conflicting_duplicate_identity');
    expect(conflict).toBeDefined();
    expect(conflict!.rows.map(row => row.sourceRow).sort()).toEqual([205, 206]);
    // Neither row reaches the servable catalogue.
    expect(release.courses.some(course => course.canonical_id === conflict!.canonicalId)).toBe(false);
  });

  it('never deduplicates by title', () => {
    const titles = release.display.map(item => item.title);
    // The source has fewer distinct titles than records; the release keeps them all.
    expect(new Set(titles).size).toBeLessThan(titles.length);
  });

  it('gives every published course a distinct canonical identity', () => {
    const ids = release.courses.map(course => course.canonical_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('publishes only https links on approved hosts', () => {
    for (const course of release.courses) {
      const url = new URL(course.url);
      expect(url.protocol).toBe('https:');
      expect(release.allowedUrlHosts).toContain(url.hostname);
      expect(url.username).toBe('');
    }
  });

  it('records a non-conflicting, unexpired review for every published field', () => {
    const now = Date.parse('2026-09-09T12:00:00Z');
    for (const course of release.courses) {
      for (const [field, review] of Object.entries(course.field_reviews)) {
        expect(review.conflicting, `${course.canonical_id}/${field}`).toBe(false);
        expect(review.source.length).toBeGreaterThan(0);
        expect(Date.parse(review.valid_until)).toBeGreaterThan(now);
      }
      for (const field of ['active', 'title', 'url', 'categoryIds', 'qualification_status', 'entry_policy']) {
        expect(course.field_reviews[field], `${course.canonical_id}/${field}`).toBeDefined();
      }
    }
  });

  it('carries a source pointer naming the exact workbook row', () => {
    for (const course of release.courses.slice(0, 20)) {
      expect(course.field_reviews.title.source).toMatch(/sheet ".+", row \d+/);
    }
  });

  it('supports rollback by naming a previous release and available files', () => {
    expect(manifest.activeReleaseFile).toBe(`${manifest.activeReleaseId}.json`);
    expect(manifest.availableReleases).toContain(manifest.activeReleaseFile);
    expect(manifest).toHaveProperty('previousReleaseId');
    expect(manifest.emergencySuppressionList).toEqual([]);
  });

  it('the release file on disk matches the manifest checksum', () => {
    const file = JSON.parse(readFileSync(join(process.cwd(), 'data/generated', manifest.activeReleaseFile), 'utf8'));
    const { releaseId, checksum, publishedAt, ...payload } = file;
    expect(createHash('sha256').update(JSON.stringify(payload)).digest('hex')).toBe(checksum);
    expect(releaseId).toBe(manifest.activeReleaseId);
    expect(publishedAt).toBeTruthy();
  });
});

describe('nothing absent from the source appears in the release', () => {
  const release = getRelease();

  it('publishes no price, workload, goal or experience tag', () => {
    for (const field of OMITTED_UNKNOWN_FIELDS) {
      for (const course of release.courses) {
        expect(course[field as keyof typeof course], `${course.canonical_id}/${field}`).toBeUndefined();
      }
    }
  });

  it('marks every display price and workload unknown, never zero', () => {
    for (const item of release.display) {
      expect(item.priceGbp).toBeNull();
      expect(item.hoursPerWeek).toBeNull();
      expect(item.priceGbp).not.toBe(0);
    }
  });

  it('publishes no verified entry rule, so every course needs an entry check', () => {
    for (const course of release.courses) {
      expect(course.entry_policy).toEqual({ status: 'unknown' });
      expect(course.entry_policy).not.toHaveProperty('rule');
    }
  });

  it('claims no verified regulated status anywhere', () => {
    for (const course of release.courses) {
      expect(course.qualification_status).toBe('unverified');
    }
    expect(release.courses.some(course => course.qualification_status === 'regulated_verified')).toBe(false);
  });

  it('publishes a level only where the source stated one', () => {
    const withoutLevel = staging.records.filter(record => record.level_label === null);
    expect(withoutLevel).toHaveLength(1);
    const published = release.courses.filter(course => course.level === undefined);
    expect(published).toHaveLength(1);
  });
});

describe('editorial derivation rules', () => {
  it('reads a level only from the explicit level column', () => {
    expect(deriveLevel({ level_label: 'Level 4' }).value).toBe(4);
    expect(deriveLevel({ level_label: null }).value).toBeNull();
    expect(deriveLevel({ level_label: '' }).value).toBeNull();
    // A title or URL containing a level never produces one.
    expect(deriveLevel({ level_label: null, title: 'Diploma at QLS Level 5', url: 'https://x/level-5' }).value).toBeNull();
  });

  it('never converts an unverified source status into a regulated claim', () => {
    expect(deriveQualificationStatus({ qualification_status: 'requires_register_check' }).value).toBe('unverified');
    expect(deriveQualificationStatus({ qualification_status: 'qls_label_requires_endorsement_check' }).value).toBe('unverified');
    expect(deriveQualificationStatus({ qualification_status: 'something_new' }).value).toBeNull();
  });

  it('always returns an unknown entry policy', () => {
    expect(deriveEntryPolicy()).toEqual({ status: 'unknown' });
  });

  it('builds category ids only from the explicit membership columns', () => {
    const ids = deriveCategoryIds({
      category_memberships: [
        { category: 'Information Technology', subcategory: 'Cyber Security', primary: true },
        { category: 'Business and Management', subcategory: null, primary: false }
      ]
    });
    expect(ids).toEqual(['information_technology', 'sub_cyber_security', 'business_and_management']);
  });

  it('produces identifiers the engine accepts', () => {
    for (const course of getRelease().courses) {
      for (const id of course.categoryIds) {
        expect(id, `${course.canonical_id}: ${id}`).toMatch(/^[a-z][a-z0-9_-]{0,63}$/);
      }
    }
  });

  it('slugifies the exact source category names to the questionnaire ids', () => {
    for (const option of subjectOptions()) {
      expect(slugify(option.sourceCategory!)).toBe(option.id);
    }
  });
});

describe('taxonomy and lookups', () => {
  it('exposes every questionnaire subject with a course count', () => {
    const taxonomy = new Map(getRelease().taxonomy.map(category => [category.id, category]));
    for (const option of subjectOptions()) {
      const category = taxonomy.get(option.id);
      expect(category, option.id).toBeDefined();
      expect(category!.courseCount).toBeGreaterThan(0);
    }
  });

  it('counts each course once per category it belongs to', () => {
    const totals = getRelease().taxonomy.reduce((sum, category) => sum + category.courseCount, 0);
    const memberships = displayRecords().reduce((sum, item) => sum + item.memberships.length, 0);
    expect(totals).toBe(memberships);
  });

  it('resolves every approved course to a display record', () => {
    for (const course of approvedCourses()) {
      expect(displayById(course.canonical_id), course.canonical_id).toBeDefined();
    }
  });

  it('returns nothing for an unknown identifier', () => {
    expect(displayById('not-a-course')).toBeUndefined();
  });
});
