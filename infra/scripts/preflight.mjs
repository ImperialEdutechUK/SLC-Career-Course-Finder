#!/usr/bin/env node
/**
 * Refuses to deploy a catalogue that would serve something it should not.
 *
 * Three checks, run against the release that is about to travel inside the bundle:
 *
 *   1. The checksum in the manifest matches the release file. The application verifies
 *      this too and answers 503 when it fails, but finding out here costs a minute
 *      rather than a deployment.
 *   2. The release's reviews have not expired, and are not about to. The application
 *      fails closed on expiry, so an unnoticed expiry date is an outage with a timer on
 *      it.
 *   3. Every id in ops/suppression-list.json is present in the manifest's
 *      emergencySuppressionList.
 *
 * The third is the one that earns its place. The application applies the manifest's copy
 * of the list, but `npm run prepare:catalogue` writes that copy back as an empty array,
 * and readiness does not inspect it. So a republication, or a rollback to an older
 * manifest, can put a withdrawn course back in front of learners while every health
 * check still reports ready. This is the gate that stops it.
 *
 * Usage:  node infra/scripts/preflight.mjs [--warn-days 30]
 * Exit:   0 clear to deploy, 1 do not deploy.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GENERATED = join(REPO_ROOT, 'data', 'generated');

const warnDaysArg = process.argv.indexOf('--warn-days');
const WARN_DAYS = warnDaysArg > -1 ? Number(process.argv[warnDaysArg + 1]) : 30;

const problems = [];
const notes = [];

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    problems.push(`${label} could not be read: ${error.message}`);
    return null;
  }
}

const manifest = readJson(join(GENERATED, 'release-manifest.json'), 'The release manifest');
if (!manifest) { report(); process.exit(1); }

const release = readJson(join(GENERATED, manifest.activeReleaseFile), `Release ${manifest.activeReleaseId}`);

// 1. Checksum.
if (release) {
  if (release.checksum !== manifest.checksum) {
    problems.push(
      `Checksum mismatch. The manifest says ${manifest.checksum.slice(0, 12)}… and the ` +
      `release file says ${String(release.checksum).slice(0, 12)}…. The application will answer 503.`
    );
  } else {
    notes.push(`Checksum verified for ${manifest.activeReleaseId}.`);
  }

  // 2. Review expiry.
  const validUntil = Date.parse(release.reviewValidUntil);
  if (Number.isNaN(validUntil)) {
    problems.push(`reviewValidUntil is not a date: ${release.reviewValidUntil}`);
  } else {
    const daysLeft = Math.floor((validUntil - Date.now()) / 86_400_000);
    if (daysLeft < 0) {
      problems.push(
        `Reviews expired ${-daysLeft} days ago (${release.reviewValidUntil}). Readiness ` +
        'will report release_reviews_expired and the service will serve nothing.'
      );
    } else if (daysLeft <= WARN_DAYS) {
      problems.push(
        `Reviews expire in ${daysLeft} days (${release.reviewValidUntil}). Republish from a ` +
        `reviewed snapshot before deploying, or pass --warn-days ${daysLeft} to accept it.`
      );
    } else {
      notes.push(`Reviews valid for another ${daysLeft} days.`);
    }
  }

  notes.push(`${release.courses.length} courses in the release.`);
}

// 3. Suppression list.
const baseline = readJson(join(REPO_ROOT, 'ops', 'suppression-list.json'), 'ops/suppression-list.json');
if (baseline) {
  const required = baseline.suppressed ?? [];
  const applied = new Set(manifest.emergencySuppressionList ?? []);
  const missing = required.filter(id => !applied.has(id));
  if (missing.length) {
    problems.push(
      `The manifest does not suppress ${missing.length} course(s) that ops/suppression-list.json ` +
      `requires: ${missing.join(', ')}. Add them to emergencySuppressionList in ` +
      'data/generated/release-manifest.json before deploying. Publication resets that list, ' +
      'so this happens every time the catalogue is republished.'
    );
  } else if (required.length) {
    notes.push(`All ${required.length} suppressed course(s) are applied.`);
  } else {
    notes.push('No courses are suppressed.');
  }
}

function report() {
  for (const note of notes) console.log(`  ok    ${note}`);
  for (const problem of problems) console.error(`  STOP  ${problem}`);
}

console.log(`Preflight for ${manifest.activeReleaseId}`);
report();

if (problems.length) {
  console.error(`\n${problems.length} problem(s). Do not deploy.`);
  process.exit(1);
}
console.log('\nClear to deploy.');
