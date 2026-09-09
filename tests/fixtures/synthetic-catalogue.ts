import type { ApprovedCourse } from '@/types/catalogue';

/**
 * SYNTHETIC RECORDS ONLY. None of these titles, prices, levels, rules or regulated
 * labels describes a South London College course. They exist so that catalogue states
 * the published July 2026 release does not contain (verified prices, verified entry
 * rules, conflicts, expiry) can still be regression tested.
 */

export const FUTURE_REVIEW = '2030-01-01T00:00:00Z';
export const PAST_REVIEW = '2026-01-01T00:00:00Z';
export const SYNTHETIC_HOSTS = ['example.invalid'];
export const SYNTHETIC_NOW = '2026-09-09T12:00:00Z';

const REVIEWED = ['active', 'title', 'url', 'categoryIds', 'qualification_status',
  'entry_policy', 'goals', 'experienceFit', 'hoursPerWeek', 'priceGbp', 'level'];

export function syntheticCourse(overrides: Record<string, unknown> = {}): ApprovedCourse {
  const base: Record<string, unknown> = {
    canonical_id: 'synthetic-base',
    title: 'Synthetic course',
    url: 'https://example.invalid/courses/base',
    active: true,
    review_status: 'approved',
    qualification_status: 'unregulated',
    categoryIds: ['business_and_management'],
    goals: ['new_subject'],
    experienceFit: ['new_to_subject'],
    hoursPerWeek: 4,
    priceGbp: 300,
    level: 3,
    entry_policy: { status: 'unknown' }
  };
  const merged = { ...base, ...overrides };
  const reviewed = REVIEWED.filter(field => merged[field] !== undefined && merged[field] !== null);
  return {
    ...merged,
    field_reviews: (overrides.field_reviews as Record<string, unknown>) ?? Object.fromEntries(
      reviewed.map(field => [field, { conflicting: false, valid_until: FUTURE_REVIEW, source: 'synthetic fixture' }])
    )
  } as ApprovedCourse;
}

/** A mixed catalogue covering every publication and eligibility state. */
export const MIXED_SYNTHETIC_CATALOGUE: ApprovedCourse[] = [
  syntheticCourse({
    canonical_id: 'syn-open-beginner', title: 'Synthetic open beginner course',
    url: 'https://example.invalid/courses/open-beginner', priceGbp: 250, hoursPerWeek: 3, level: 2,
    entry_policy: { status: 'verified', rule: { fact: 'minimumAgeConfirmed', op: 'eq', value: true } }
  }),
  syntheticCourse({
    canonical_id: 'syn-open-cheap', title: 'Synthetic low cost course',
    url: 'https://example.invalid/courses/cheap', priceGbp: 90, hoursPerWeek: 2, level: 2,
    entry_policy: { status: 'verified', rule: { fact: 'minimumAgeConfirmed', op: 'eq', value: true } }
  }),
  syntheticCourse({
    canonical_id: 'syn-expensive', title: 'Synthetic expensive course',
    url: 'https://example.invalid/courses/expensive', priceGbp: 4500, hoursPerWeek: 6, level: 5
  }),
  syntheticCourse({
    canonical_id: 'syn-price-unknown', title: 'Synthetic course with no published total',
    url: 'https://example.invalid/courses/price-unknown', priceGbp: null, hoursPerWeek: null, level: 3
  }),
  syntheticCourse({
    canonical_id: 'syn-gated-level', title: 'Synthetic advanced programme',
    url: 'https://example.invalid/courses/gated', level: 7, experienceFit: ['qualification_and_work'],
    priceGbp: 1800, hoursPerWeek: 9,
    entry_policy: { status: 'verified', rule: { fact: 'relevantQualificationLevel', op: 'gte', value: 6 } }
  }),
  syntheticCourse({
    canonical_id: 'syn-placement', title: 'Synthetic course with a workplace requirement',
    url: 'https://example.invalid/courses/placement', priceGbp: 700, hoursPerWeek: 8, level: 4,
    entry_policy: { status: 'verified', rule: { fact: 'canCompletePlacement', op: 'eq', value: true } }
  }),
  syntheticCourse({
    canonical_id: 'syn-inactive', title: 'Synthetic withdrawn course',
    url: 'https://example.invalid/courses/inactive', active: false
  }),
  syntheticCourse({
    canonical_id: 'syn-unapproved', title: 'Synthetic unapproved course',
    url: 'https://example.invalid/courses/unapproved', review_status: 'pending_review'
  }),
  syntheticCourse({
    canonical_id: 'syn-regulated', title: 'Synthetic verified regulated qualification',
    url: 'https://example.invalid/courses/regulated', qualification_status: 'regulated_verified',
    priceGbp: 600, hoursPerWeek: 5, level: 3
  }),
  syntheticCourse({
    canonical_id: 'syn-other-subject', title: 'Synthetic course in another subject',
    url: 'https://example.invalid/courses/other', categoryIds: ['animal_care']
  })
];

/** Expired review on an otherwise complete record. */
export const EXPIRED_SYNTHETIC = (() => {
  const course = syntheticCourse({
    canonical_id: 'syn-expired', title: 'Synthetic course with a stale price review',
    url: 'https://example.invalid/courses/expired'
  });
  course.field_reviews.priceGbp = { conflicting: false, valid_until: PAST_REVIEW, source: 'synthetic fixture' };
  return course;
})();

/** Two rows sharing one identity but disagreeing about reviewable content. */
export const CONFLICTING_SYNTHETIC: ApprovedCourse[] = [
  syntheticCourse({ canonical_id: 'syn-conflict', id: 'row-a', title: 'Synthetic course, version A', url: 'https://example.invalid/courses/conflict' }),
  syntheticCourse({ canonical_id: 'syn-conflict', id: 'row-b', title: 'Synthetic course, version B', url: 'https://example.invalid/courses/conflict' })
];

/** Two identical import rows sharing one identity. */
export const DUPLICATE_SYNTHETIC: ApprovedCourse[] = [
  syntheticCourse({ canonical_id: 'syn-duplicate', id: 'row-a', title: 'Synthetic duplicated course', url: 'https://example.invalid/courses/duplicate' }),
  syntheticCourse({ canonical_id: 'syn-duplicate', id: 'row-b', title: 'Synthetic duplicated course', url: 'https://example.invalid/courses/duplicate' })
];
