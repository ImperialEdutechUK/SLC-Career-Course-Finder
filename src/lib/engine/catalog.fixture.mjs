// SYNTHETIC TEST DATA ONLY. These are not SLC courses or verified real qualifications.
const reviewedFields = ['active', 'title', 'url', 'categoryIds', 'qualification_status', 'entry_policy',
  'goals', 'experienceFit', 'hoursPerWeek', 'priceGbp', 'level'];

export function approvedFixtureCourse(overrides = {}) {
  return {
    id: 'import-row-1', canonical_id: 'example-intro', title: 'Example introductory course',
    url: 'https://example.invalid/courses/intro', active: true, review_status: 'approved',
    qualification_status: 'regulated_verified', categoryIds: ['business'],
    goals: ['first_role', 'career_change'], experienceFit: ['beginner'],
    // priceGbp is a synthetic all-inclusive total, never a deposit or monthly instalment.
    hoursPerWeek: 5, priceGbp: 300, level: 2,
    entry_policy: { status: 'verified', rule: { fact: 'minimumAgeConfirmed', op: 'eq', value: true } },
    field_reviews: Object.fromEntries(reviewedFields.map(field => [field, {
      conflicting: false, valid_until: '2030-01-01T00:00:00Z', source: 'Synthetic fixture; no real qualification claim'
    }])),
    ...overrides
  };
}

export const approvedCatalogFixture = [
  approvedFixtureCourse(),
  approvedFixtureCourse({
    id: 'import-row-2', canonical_id: 'example-advanced', title: 'Example advanced pathway',
    url: 'https://example.invalid/courses/advanced', level: 5, experienceFit: ['experienced'],
    hoursPerWeek: 10, priceGbp: 800,
    entry_policy: { status: 'verified', rule: { any: [
      { fact: 'relevantQualificationLevel', op: 'gte', value: 4 },
      { fact: 'relevantExperienceYears', op: 'gte', value: 3 }
    ] } }
  }),
  approvedFixtureCourse({
    id: 'import-row-3', canonical_id: 'example-policy-check', title: 'Example course needing an entry check',
    url: 'https://example.invalid/courses/check', entry_policy: { status: 'unknown' },
    hoursPerWeek: null, priceGbp: null
  })
];
