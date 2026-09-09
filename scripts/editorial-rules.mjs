/**
 * PROVISIONAL EDITORIAL RULES — ISOLATED FOR SLC REVIEW.
 *
 * Every derivation the publication pipeline is allowed to make from the July 2026
 * staging snapshot lives in this one file so a reviewer can read, change or reject it
 * without touching the pipeline or the application.
 *
 * Rules of this file (enforced by tests in tests/publication.test.ts):
 *   - A derivation may read ONLY explicit structured source fields.
 *   - No derivation may read a course title, description, URL path or awarding-body
 *     name to infer a level, a regulated status, a price, a workload or an entry rule.
 *   - Anything the snapshot does not state stays unknown. Unknown is never `0`,
 *     never `false`, never "affordable" and never "eligible".
 *
 * See docs/AMBIGUITY-REGISTER.md for the open questions these rules stand in for.
 */

export const EDITORIAL_RULES_VERSION = 'editorial-rules-0.1.0-provisional';
export const EDITORIAL_REVIEW_STATUS = 'provisional_awaiting_slc_approval';

/**
 * Source evidence pointer written into every field review. It is a pointer to the
 * approved source record, not verification performed by this application.
 */
export function sourcePointer(record) {
  return `SLC course category workbook ${record.source_snapshot}, sheet "${record.source_sheet}", row ${record.source_row} (${record.record_id})`;
}

/**
 * AR-001 — `active`.
 * The snapshot records `active: null`. The engine requires `active === true`.
 * Publication decision: a row present in SLC's own July 2026 course listing is
 * published as listed-at-snapshot, with a short review life so that a stale listing
 * expires itself rather than being served indefinitely.
 * This is a listing fact, NOT a statement that enrolment is currently open.
 */
export function deriveActive(record) {
  if (record.active === false) return { value: false, reason: 'source_states_inactive' };
  return { value: true, reason: 'listed_in_source_snapshot' };
}

/**
 * AR-002 — `qualification_status`.
 * The snapshot never verifies regulation. Both source states are unverified claims,
 * so nothing in this release is `regulated_verified`. A "Regulated qualifications only"
 * request therefore returns no verified match, which is the correct answer today.
 */
const QUALIFICATION_STATUS = {
  requires_register_check: 'unverified',
  qls_label_requires_endorsement_check: 'unverified'
};

export function deriveQualificationStatus(record) {
  const mapped = QUALIFICATION_STATUS[record.qualification_status];
  if (!mapped) return { value: null, reason: `unmapped_source_status:${record.qualification_status}` };
  return { value: mapped, reason: record.qualification_status };
}

/**
 * AR-003 — `level`.
 * Read only from the explicit `level_label` column. A blank label stays unknown;
 * a level is never inferred from a title or URL.
 */
export function deriveLevel(record) {
  if (typeof record.level_label !== 'string') return { value: null, reason: 'source_level_blank' };
  const match = /^Level ([1-7])$/.exec(record.level_label.trim());
  if (!match) return { value: null, reason: `unparsable_level_label:${record.level_label}` };
  return { value: Number(match[1]), reason: 'source_level_label' };
}

/**
 * AR-004 — category identifiers.
 * Categories and subcategories both come from the explicit membership columns.
 * Subcategory identifiers are published so a learner can narrow a subject using a
 * real source fact instead of the application inventing a ranking signal.
 */
export function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[‘’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
}

export function deriveCategoryIds(record) {
  const ids = [];
  for (const membership of record.category_memberships ?? []) {
    const category = slugify(membership.category);
    if (category && !ids.includes(category)) ids.push(category);
    if (membership.subcategory) {
      const sub = `sub_${slugify(membership.subcategory)}`;
      if (!ids.includes(sub)) ids.push(sub);
    }
  }
  return ids;
}

/**
 * AR-005 — fields the snapshot does not carry.
 * `priceGbp`, `hoursPerWeek`, `goals`, `experienceFit` and any entry rule are omitted.
 * Omission means unknown. The engine then scores them zero, keeps their weight in the
 * denominator and raises an explicit warning, which is the behaviour we want.
 */
export const OMITTED_UNKNOWN_FIELDS = Object.freeze([
  'priceGbp',
  'hoursPerWeek',
  'goals',
  'experienceFit'
]);

/**
 * AR-006 — `entry_policy`.
 * No reviewed entry rule exists for any row, so every published course carries an
 * explicitly unknown policy. The engine returns `check_needed`, and the interface
 * says "Entry requirements to check". It never says a learner is eligible.
 */
export function deriveEntryPolicy() {
  return { status: 'unknown' };
}

/**
 * AR-007 — canonical identity.
 * The importer already grouped rows by URL into `url_group_id`. That identifier is
 * adopted as the reviewed canonical id: it is stable, shared by duplicate rows, and
 * unlike a title slug it does not cluster near-identical awards together when the
 * engine breaks a relevance tie by canonical id.
 */
export function deriveCanonicalId(record) {
  return record.url_group_id;
}

/**
 * Review life for the published snapshot. A field review must expire so that an old
 * commercial listing cannot be served forever. A production importer replaces this
 * with the agreed per-field maximum-staleness policy and a nightly refresh.
 */
export const REVIEW_VALID_MONTHS = 12;
