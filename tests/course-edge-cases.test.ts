import { describe, expect, it } from 'vitest';
import { recommend, evaluateEligibility, evaluateRule } from '@/lib/engine/engine.mjs';
import { buildEngineRequest, workloadFit, applyRequirementFact, WORKLOAD_BANDS } from '@/lib/adapter/preferences';
import type { ApprovedCourse } from '@/types/catalogue';

/**
 * The twenty critical course edge cases, exercised against the unmodified reference
 * engine through the application's own adapter. Synthetic records only: none of these
 * titles, prices or rules describes a real South London College course.
 */

const NOW = '2026-09-09T12:00:00Z';
const HOSTS = ['example.invalid'];
const FUTURE = '2030-01-01T00:00:00Z';
const PAST = '2026-01-01T00:00:00Z';

const REVIEWED = ['active', 'title', 'url', 'categoryIds', 'qualification_status', 'entry_policy',
  'goals', 'experienceFit', 'hoursPerWeek', 'priceGbp', 'level'];

function course(overrides: Record<string, unknown> = {}): ApprovedCourse {
  const base = {
    canonical_id: 'test-course',
    title: 'Synthetic test course',
    url: 'https://example.invalid/courses/test',
    active: true,
    review_status: 'approved',
    qualification_status: 'unregulated',
    categoryIds: ['business'],
    goals: ['new_subject'],
    experienceFit: ['new_to_subject'],
    hoursPerWeek: 4,
    priceGbp: 300,
    level: 3,
    entry_policy: { status: 'unknown' }
  } as Record<string, unknown>;
  const merged = { ...base, ...overrides };
  const reviewed = REVIEWED.filter(field => merged[field] !== undefined && merged[field] !== null);
  return {
    ...merged,
    field_reviews: (overrides.field_reviews as Record<string, unknown>) ?? Object.fromEntries(
      reviewed.map(field => [field, { conflicting: false, valid_until: FUTURE, source: 'synthetic fixture' }])
    )
  } as ApprovedCourse;
}

function run(preferences: Record<string, unknown>, catalog: unknown[], facts: Record<string, unknown> = {}) {
  return recommend({ preferences, facts }, catalog, { now: NOW, allowedUrlHosts: HOSTS }) as {
    status: string;
    recommendations: { canonicalId: string; qualificationStatus: string; budgetCheck: Record<string, unknown>; eligibility: { status: string }; warnings: string[] }[];
    pathways: { canonicalId: string }[];
    excluded: { canonicalId?: string; reasons: string[] }[];
    errors?: string[];
  };
}

const excludedFor = (result: ReturnType<typeof run>, id: string) =>
  result.excluded.find(item => item.canonicalId === id)?.reasons ?? [];

describe('1-3: price', () => {
  it('1. a blank price never becomes zero', () => {
    const result = run({ categoryIds: ['business'] }, [course({ priceGbp: null })]);
    expect(result.recommendations[0].budgetCheck).toEqual({ status: 'not_requested' });
    // No numeric total is invented anywhere in the result.
    expect(JSON.stringify(result.recommendations[0])).not.toContain('"totalGbp":0');
  });

  it('2. an unknown price is never within budget', () => {
    const result = run({ categoryIds: ['business'], budgetGbp: 1000 }, [course({ priceGbp: null })]);
    const check = result.recommendations[0].budgetCheck;
    expect(check.status).toBe('check_needed');
    expect(check.reason).toBe('all_inclusive_price_unknown');
    expect(check.status).not.toBe('within_cap');
    expect(result.recommendations[0].warnings).toContain('budget_check_needed: total price must be confirmed before enrolment');
  });

  it('3. a verified price above the cap is excluded from both lists, whatever else fits', () => {
    const perfect = course({ canonical_id: 'expensive', priceGbp: 5000, goals: ['new_subject'], experienceFit: ['new_to_subject'] });
    const result = run(
      { categoryIds: ['business'], goal: 'new_subject', experience: 'new_to_subject', budgetGbp: 400 },
      [perfect]
    );
    expect(result.recommendations).toHaveLength(0);
    expect(result.pathways).toHaveLength(0);
    expect(excludedFor(result, 'expensive')).toContain('over_budget_cap');
  });

  it('a verified zero price is a real value and passes a zero cap', () => {
    const result = run({ categoryIds: ['business'], budgetGbp: 0 }, [course({ priceGbp: 0 })]);
    expect(result.recommendations[0].budgetCheck).toEqual({ status: 'within_cap', totalGbp: 0, capGbp: 0 });
  });
});

describe('4: placement', () => {
  it('4. a required placement cannot be satisfied by having no placement', () => {
    const rule = { fact: 'canCompletePlacement', op: 'eq', value: true };
    expect(evaluateRule(rule, { canCompletePlacement: false }).result).toBe('not_met');
    expect(evaluateRule(rule, {}).result).toBe('unknown');

    const withPlacement = course({ entry_policy: { status: 'verified', rule } });
    const noPlacement = run({ categoryIds: ['business'] }, [withPlacement], { canCompletePlacement: false });
    expect(noPlacement.recommendations).toHaveLength(0);
    expect(noPlacement.pathways).toHaveLength(1);
  });

  it('the adapter maps F6 yes/no/unsure to true/false/unknown', () => {
    expect(applyRequirementFact({}, 'canCompletePlacement', 'yes')).toEqual({ canCompletePlacement: true });
    expect(applyRequirementFact({}, 'canCompletePlacement', 'no')).toEqual({ canCompletePlacement: false });
    expect(applyRequirementFact({}, 'canCompletePlacement', 'unsure')).toEqual({});
    expect(applyRequirementFact({}, 'canCompletePlacement', null)).toEqual({});
  });
});

describe('5-8: publication state', () => {
  it('5. an inactive course cannot be recommended', () => {
    const result = run({ categoryIds: ['business'] }, [course({ canonical_id: 'inactive', active: false })]);
    expect(result.recommendations).toHaveLength(0);
    expect(excludedFor(result, 'inactive')).toContain('course_inactive');
  });

  it('6. an expired review excludes the course', () => {
    const stale = course({ canonical_id: 'expired' });
    stale.field_reviews.priceGbp = { conflicting: false, valid_until: PAST, source: 'synthetic fixture' };
    const result = run({ categoryIds: ['business'] }, [stale]);
    expect(result.recommendations).toHaveLength(0);
    expect(excludedFor(result, 'expired')).toContain('field_expired: priceGbp');
  });

  it('7. a conflicting field review excludes the course', () => {
    const conflicting = course({ canonical_id: 'conflicted' });
    conflicting.field_reviews.title = { conflicting: true, valid_until: FUTURE, source: 'synthetic fixture' };
    const result = run({ categoryIds: ['business'] }, [conflicting]);
    expect(excludedFor(result, 'conflicted')).toContain('field_review_missing_or_conflicting: title');
  });

  it('8. an unapproved course cannot be recommended', () => {
    const result = run({ categoryIds: ['business'] }, [course({ canonical_id: 'pending', review_status: 'pending_review' })]);
    expect(result.recommendations).toHaveLength(0);
    expect(excludedFor(result, 'pending')).toContain('course_not_approved');
  });
});

describe('9-12: qualification claims and prerequisites', () => {
  it('9. a QLS-labelled course does not pass a regulated-only filter without verified status', () => {
    const qls = course({ canonical_id: 'qls-labelled', title: 'Diploma at QLS Level 5', qualification_status: 'unverified' });
    const result = run({ categoryIds: ['business'], regulatedOnly: true }, [qls]);
    expect(result.status).toBe('no_match');
    expect(excludedFor(result, 'qls-labelled')).toContain('regulated_status_not_verified');
  });

  it('10. level 7 carries no implied qualification type', () => {
    const level7 = course({ canonical_id: 'level-7', level: 7, title: 'Extended Diploma at Level 7' });
    const result = run({ categoryIds: ['business'] }, [level7]);
    const item = result.recommendations[0];
    // The engine returns no credential type at all; level alone says nothing.
    expect(Object.keys(item)).not.toContain('credentialType');
    expect(item.qualificationStatus).toBe('unregulated');
  });

  it('11. a level 7 course does not bypass its entry requirement for a beginner', () => {
    const level7 = course({
      canonical_id: 'level-7-gated',
      level: 7,
      experienceFit: ['new_to_subject'],
      entry_policy: { status: 'verified', rule: { fact: 'relevantQualificationLevel', op: 'gte', value: 6 } }
    });
    const beginner = run({ categoryIds: ['business'], experience: 'new_to_subject' }, [level7], { relevantQualificationLevel: 3 });
    expect(beginner.recommendations).toHaveLength(0);
    expect(beginner.pathways.map(p => p.canonicalId)).toEqual(['level-7-gated']);
  });

  it('12. an unrelated qualification cannot satisfy a subject-specific requirement', () => {
    const rule = { fact: 'relevantQualificationLevel', op: 'gte', value: 4 };
    // A degree in another subject is a different fact and leaves the rule unknown.
    expect(evaluateRule(rule, { highestQualificationLevel: 6 }).result).toBe('unknown');
    expect(evaluateRule(rule, { relevantQualificationLevel: 6 }).result).toBe('met');
  });

  it('an exact award requirement cannot be met by a similarly titled one', () => {
    const rule = { fact: 'holdsExactAward', op: 'eq', value: 'award-123' };
    expect(evaluateRule(rule, { holdsExactAward: 'award-124' }).result).toBe('not_met');
    expect(evaluateRule(rule, {}).result).toBe('unknown');
  });
});

describe('13: future options stay separate', () => {
  it('13. an unmet requirement puts a course in pathways, never in recommendations', () => {
    const gated = course({
      canonical_id: 'gated',
      entry_policy: { status: 'verified', rule: { fact: 'relevantQualificationLevel', op: 'gte', value: 5 } }
    });
    const open = course({ canonical_id: 'open', entry_policy: { status: 'verified', rule: { fact: 'minimumAgeConfirmed', op: 'eq', value: true } } });
    const result = run({ categoryIds: ['business'] }, [gated, open], { relevantQualificationLevel: 2, minimumAgeConfirmed: true });
    expect(result.recommendations.map(r => r.canonicalId)).toEqual(['open']);
    expect(result.pathways.map(p => p.canonicalId)).toEqual(['gated']);
  });
});

describe('14-16: catalogue identity and fact types', () => {
  it('14. identical duplicate rows collapse to one canonical record', () => {
    const a = course({ canonical_id: 'shared', id: 'row-1' });
    const b = course({ canonical_id: 'shared', id: 'row-2' });
    const result = run({ categoryIds: ['business'] }, [a, b]);
    expect(result.recommendations.map(r => r.canonicalId)).toEqual(['shared']);
  });

  it('15. conflicting duplicates quarantine the whole canonical group', () => {
    const a = course({ canonical_id: 'shared', id: 'row-1', title: 'One title' });
    const b = course({ canonical_id: 'shared', id: 'row-2', title: 'A different title' });
    const result = run({ categoryIds: ['business'] }, [a, b]);
    expect(result.recommendations).toHaveLength(0);
    expect(excludedFor(result, 'shared')).toContain('conflicting_duplicate');
  });

  it('16. a fact of the wrong type stays unknown rather than being coerced', () => {
    const rule = { fact: 'relevantExperienceYears', op: 'gte', value: 3 };
    expect(evaluateRule(rule, { relevantExperienceYears: '5' }).result).toBe('unknown');
    expect(evaluateRule(rule, { relevantExperienceYears: 5 }).result).toBe('met');
  });

  it('a missing entry policy is unknown, not a pass', () => {
    expect(evaluateEligibility({ entry_policy: null }, {}).status).toBe('check_needed');
    expect(evaluateEligibility({ entry_policy: { status: 'unknown' } }, {}).status).toBe('check_needed');
  });
});

describe('17-20: request contract and honest emptiness', () => {
  it('17. an invalid request is rejected rather than answered', () => {
    const result = recommend({ preferences: { categoryIds: ['Business'] } }, [course()], { now: NOW, allowedUrlHosts: HOSTS }) as { status: string };
    expect(result.status).toBe('invalid_request');
  });

  it('17b. an unsupported request key is rejected', () => {
    const result = recommend(
      { preferences: { categoryIds: ['business'] }, aiRanking: [1, 2, 3] },
      [course()], { now: NOW, allowedUrlHosts: HOSTS }
    ) as { status: string; errors: string[] };
    expect(result.status).toBe('invalid_request');
    expect(result.errors.join(' ')).toContain('unsupported request key');
  });

  it('18. an unsupported preference value is rejected, never silently converted', () => {
    const result = recommend(
      { preferences: { categoryIds: ['business'], goal: 'NOT A GOAL' } },
      [course()], { now: NOW, allowedUrlHosts: HOSTS }
    ) as { status: string };
    expect(result.status).toBe('invalid_request');
  });

  it('19. an all-unknown request manufactures nothing', () => {
    const request = buildEngineRequest({
      answers: { F1: 'unsure', F2: 'help_me_explore', F3: 'unsure_counts', F4: 'varies_or_unsure', F5: null },
      details: {},
      categoryIds: [],
      filters: { regulatedOnly: false }
    });
    expect(request.preferences).toEqual({});
    const result = run(request.preferences as Record<string, unknown>, [course()]);
    expect(result.status).toBe('needs_clarification');
    expect(result.recommendations).toHaveLength(0);
  });

  it('20. a weak unrelated course is never used to fill a slot', () => {
    const related = course({ canonical_id: 'related', categoryIds: ['business'] });
    const unrelated = course({ canonical_id: 'unrelated', categoryIds: ['animal_care'] });
    const result = run({ categoryIds: ['business'] }, [related, unrelated]);
    expect(result.recommendations.map(r => r.canonicalId)).toEqual(['related']);
    expect(excludedFor(result, 'unrelated')).toContain('no_category_fit');
  });

  it('20b. a course with zero observed relevance is excluded rather than promoted', () => {
    const noFit = course({ canonical_id: 'no-fit', goals: ['further_study'], categoryIds: ['business'] });
    const result = run({ goal: 'further_study' }, [noFit]);
    // A broad goal cannot anchor ranking without a subject.
    expect(result.status).toBe('needs_clarification');
  });
});

describe('three-valued entry logic', () => {
  const all = { all: [{ fact: 'a', op: 'eq', value: true }, { fact: 'b', op: 'eq', value: true }] };
  const any = { any: [{ fact: 'a', op: 'eq', value: true }, { fact: 'b', op: 'eq', value: true }] };

  it('AND: one known failure means not met', () => {
    expect(evaluateRule(all, { a: false, b: true }).result).toBe('not_met');
    expect(evaluateRule(all, { a: false }).result).toBe('not_met');
  });

  it('AND: unknown cannot become success', () => {
    expect(evaluateRule(all, { a: true }).result).toBe('unknown');
    expect(evaluateRule(all, {}).result).toBe('unknown');
    expect(evaluateRule(all, { a: true, b: true }).result).toBe('met');
  });

  it('OR: one true satisfies the rule', () => {
    expect(evaluateRule(any, { a: true, b: false }).result).toBe('met');
  });

  it('OR: false plus unknown remains unknown, and all false fails', () => {
    expect(evaluateRule(any, { a: false }).result).toBe('unknown');
    expect(evaluateRule(any, { a: false, b: false }).result).toBe('not_met');
  });

  it('relevance never overrides a known eligibility failure', () => {
    const perfect = course({
      canonical_id: 'perfect-but-ineligible',
      goals: ['new_subject'], experienceFit: ['new_to_subject'], hoursPerWeek: 1, priceGbp: 10,
      entry_policy: { status: 'verified', rule: { fact: 'minimumAgeConfirmed', op: 'eq', value: true } }
    });
    const result = run(
      { categoryIds: ['business'], goal: 'new_subject', experience: 'new_to_subject', hoursPerWeek: 10, budgetGbp: 5000 },
      [perfect], { minimumAgeConfirmed: false }
    );
    expect(result.recommendations).toHaveLength(0);
    expect(result.pathways.map(p => p.canonicalId)).toEqual(['perfect-but-ineligible']);
  });
});

describe('workload bands stay intervals', () => {
  it('never converts a band to a midpoint scalar', () => {
    const request = buildEngineRequest({
      answers: { F4: '5_to_8_hours' }, details: {}, categoryIds: ['law'], filters: { regulatedOnly: false }
    });
    expect(request.preferences.hoursPerWeek).toBeUndefined();
  });

  it.each([
    ['under_2_hours', 0, 'fits_entire_band'],
    ['under_2_hours', 1, 'depends_on_available_time'],
    ['under_2_hours', 2, 'exceeds_entire_band'],
    ['2_to_4_hours', 2, 'fits_entire_band'],
    ['2_to_4_hours', 4, 'depends_on_available_time'],
    ['2_to_4_hours', 5, 'exceeds_entire_band'],
    ['5_to_8_hours', 5, 'fits_entire_band'],
    ['5_to_8_hours', 8, 'depends_on_available_time'],
    ['5_to_8_hours', 9, 'exceeds_entire_band'],
    ['9_or_more_hours', 9, 'fits_entire_band'],
    ['9_or_more_hours', 40, 'depends_on_available_time']
  ])('band %s against %i hours is %s', (band, hours, expected) => {
    expect(workloadFit(band, hours)).toBe(expected);
  });

  it('unknown course workload or unknown learner time stays unknown', () => {
    expect(workloadFit('5_to_8_hours', null)).toBe('unknown');
    expect(workloadFit(null, 5)).toBe('unknown');
    expect(workloadFit('varies_or_unsure', 5)).toBe('unknown');
  });

  it('covers every configured band', () => {
    expect(Object.keys(WORKLOAD_BANDS).sort())
      .toEqual(['2_to_4_hours', '5_to_8_hours', '9_or_more_hours', 'under_2_hours']);
  });
});
