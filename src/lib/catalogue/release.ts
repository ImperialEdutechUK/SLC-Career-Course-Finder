import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogueRelease, CourseDisplay, ReleaseManifest } from '@/types/catalogue';

/**
 * Loads the published catalogue release named by the manifest pointer.
 *
 * The application never reads the staging snapshot. Publication is atomic: only
 * `activeReleaseId` in the manifest changes, and rollback repoints it at a previously
 * published, tested release file. The checksum is verified before the release is served.
 */

const GENERATED_DIR = join(process.cwd(), 'data', 'generated');

let cached: { release: CatalogueRelease; manifest: ReleaseManifest } | null = null;

export class CatalogueUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogueUnavailableError';
  }
}

function load(): { release: CatalogueRelease; manifest: ReleaseManifest } {
  if (cached) return cached;
  let manifest: ReleaseManifest;
  try {
    manifest = JSON.parse(readFileSync(join(GENERATED_DIR, 'release-manifest.json'), 'utf8'));
  } catch {
    throw new CatalogueUnavailableError('No catalogue release manifest is present. Run `npm run prepare:catalogue`.');
  }
  let release: CatalogueRelease;
  try {
    release = JSON.parse(readFileSync(join(GENERATED_DIR, manifest.activeReleaseFile), 'utf8'));
  } catch {
    throw new CatalogueUnavailableError(`Active catalogue release ${manifest.activeReleaseId} could not be read.`);
  }
  if (release.checksum !== manifest.checksum) {
    throw new CatalogueUnavailableError('Catalogue release checksum does not match the manifest.');
  }
  cached = { release, manifest };
  return cached;
}

export function getRelease(): CatalogueRelease {
  return load().release;
}

export function getManifest(): ReleaseManifest {
  return load().manifest;
}

/**
 * Courses eligible to be offered to the engine. The emergency suppression list is
 * applied here so a withdrawn course cannot be resurrected by a release rollback.
 */
export function approvedCourses() {
  const { release, manifest } = load();
  const suppressed = new Set(manifest.emergencySuppressionList);
  return release.courses.filter(course => !suppressed.has(course.canonical_id));
}

export function displayRecords(): CourseDisplay[] {
  const { release, manifest } = load();
  const suppressed = new Set(manifest.emergencySuppressionList);
  return release.display.filter(item => !suppressed.has(item.canonicalId));
}

const displayIndex = new Map<string, CourseDisplay>();

export function displayById(canonicalId: string): CourseDisplay | undefined {
  if (displayIndex.size === 0) {
    for (const item of displayRecords()) displayIndex.set(item.canonicalId, item);
  }
  return displayIndex.get(canonicalId);
}

/** The minimum fields the browse interface needs, to keep its payload small. */
export interface BrowseRecord {
  canonicalId: string;
  title: string;
  level: number | null;
  levelLabel: string | null;
  awardingBodyLabel: string | null;
  primaryCategory: string;
  primarySubcategory: string | null;
  categoryIds: string[];
}

export function browseRecords(): BrowseRecord[] {
  return displayRecords().map(record => ({
    canonicalId: record.canonicalId,
    title: record.title,
    level: record.level,
    levelLabel: record.levelLabel,
    awardingBodyLabel: record.awardingBodyLabel,
    primaryCategory: record.primaryCategory,
    primarySubcategory: record.primarySubcategory,
    categoryIds: record.categoryIds
  }));
}

export function releaseIsFresh(now: Date = new Date()): boolean {
  return Date.parse(getRelease().reviewValidUntil) > now.getTime();
}

/** Readiness: an approved, checksum-verified, unexpired release must be loadable. */
export function catalogueReady(now: Date = new Date()): { ready: boolean; reason?: string } {
  try {
    const release = getRelease();
    if (!release.courses.length) return { ready: false, reason: 'release_empty' };
    if (!releaseIsFresh(now)) return { ready: false, reason: 'release_reviews_expired' };
    return { ready: true };
  } catch (error) {
    return { ready: false, reason: error instanceof Error ? error.name : 'unknown' };
  }
}
