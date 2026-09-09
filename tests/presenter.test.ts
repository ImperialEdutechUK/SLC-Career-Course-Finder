import { describe, expect, it } from 'vitest';
import { allEquallyRelevant, applyDiversityRule, toCourseOption, type EngineResultItem } from '@/lib/adapter/presenter';
import { primaryCheck, reasonText, relevanceReason } from '@/lib/adapter/reasons';
import { entryStateDetail } from '@/components/EligibilityBadge';
import type { CourseDisplay } from '@/types/catalogue';
import type { CourseOption } from '@/types/results';

function display(overrides: Partial<CourseDisplay> = {}): CourseDisplay {
  return {
    canonicalId: 'c1', title: 'A course', url: 'https://southlondoncollege.org/course/x',
    level: 3, levelLabel: 'Level 3', awardingBodyLabel: 'NCFE',
    qualificationStatus: 'unverified', sourceQualificationStatus: 'requires_register_check',
    primaryCategory: 'Law', primaryCategoryId: 'law', primarySubcategory: 'Paralegal',
    categoryIds: ['law', 'sub_paralegal'], memberships: [],
    priceGbp: null, hoursPerWeek: null, tqtHours: null,
    entryRequirements: null, placementRequired: null,
    sourceRow: 10, sourceSheet: 'All Courses A-Z', recordId: 'july2026-row-10',
    ...overrides
  };
}

function item(overrides: Partial<EngineResultItem> = {}): EngineResultItem {
  return {
    canonicalId: 'c1', title: 'A course', url: 'https://southlondoncollege.org/course/x',
    qualificationStatus: 'unverified', relevanceScore: 50, points: 40, denominator: 80,
    dimensions: [{ dimension: 'category', weight: 40, points: 40 }],
    warnings: [], eligibility: { status: 'check_needed', reason: 'course_policy_unknown', checks: [] },
    budgetCheck: { status: 'not_requested' },
    ...overrides
  };
}

describe('display groups', () => {
  it('an unknown entry policy goes to the check-first group', () => {
    const option = toCourseOption(item(), display(), false);
    expect(option.entryCheck).toBe('check_needed');
    expect(option.displayGroup).toBe('check_first_options');
  });

  it('an unmet requirement goes to the future group, never to the start group', () => {
    const option = toCourseOption(
      item({ eligibility: { status: 'pathway_needed', reason: 'stated_rule_not_met', checks: [] } }),
      display(), false
    );
    expect(option.displayGroup).toBe('future_options');
  });

  it('met entry rules enter the start group only once the price check is resolved', () => {
    const resolved = toCourseOption(
      item({ eligibility: { status: 'appears_to_meet', reason: 'stated_rules_met_by_supplied_facts', checks: [] } }),
      display({ priceGbp: 300 }), false
    );
    expect(resolved.displayGroup).toBe('start_options');

    const unresolvedPrice = toCourseOption(
      item({
        eligibility: { status: 'appears_to_meet', reason: 'stated_rules_met_by_supplied_facts', checks: [] },
        budgetCheck: { status: 'check_needed', reason: 'all_inclusive_price_unknown', capGbp: 500 }
      }),
      display(), false
    );
    expect(unresolvedPrice.displayGroup).toBe('check_first_options');
  });

  it('an unrecognised eligibility status falls back to needing a check', () => {
    const option = toCourseOption(
      item({ eligibility: { status: 'something_else', reason: '', checks: [] } }), display(), false
    );
    expect(option.entryCheck).toBe('check_needed');
  });
});

describe('reason codes and wording', () => {
  it('reports an unknown price and workload whether or not a cap was set', () => {
    const option = toCourseOption(item(), display(), false);
    expect(option.reasonCodes).toContain('PRICE_UNKNOWN');
    expect(option.reasonCodes).toContain('WORKLOAD_UNKNOWN');
    expect(option.missingChecks).toContain('total_price');
  });

  it('says the regulated status is unverified whenever it is not verified', () => {
    expect(toCourseOption(item(), display(), false).reasonCodes).toContain('REGULATED_STATUS_UNVERIFIED');
    const verified = toCourseOption(
      item({ qualificationStatus: 'regulated_verified' }), display(), false
    );
    expect(verified.reasonCodes).not.toContain('REGULATED_STATUS_UNVERIFIED');
  });

  it('changes the subject wording when the learner narrowed the subject', () => {
    const broad = toCourseOption(item(), display(), false);
    const narrow = toCourseOption(item(), display(), true);
    expect(broad.reasonCodes).toContain('SUBJECT_MATCH');
    expect(narrow.reasonCodes).toContain('SUBJECT_NARROWED');
    expect(relevanceReason(broad, 'Law')).toContain('Law');
    expect(relevanceReason(narrow, 'Law')).toContain('Paralegal');
  });

  it('surfaces the most important check first', () => {
    const option = toCourseOption(item(), display(), false);
    expect(primaryCheck(option)).toBe('Entry requirements');
    const priced: CourseOption = { ...option, missingChecks: ['total_price'] };
    expect(primaryCheck(priced)).toBe('Total price');
    expect(primaryCheck({ ...option, missingChecks: [] })).toBeNull();
  });

  it('has wording for every reason code it emits', () => {
    const option = toCourseOption(item(), display(), false);
    for (const code of option.reasonCodes) expect(reasonText(code).length).toBeGreaterThan(0);
  });

  it('never states that a learner is eligible', () => {
    for (const state of ['appears_to_meet', 'check_needed', 'pathway_needed'] as const) {
      const detail = entryStateDetail(state);
      expect(detail).not.toMatch(/you are (definitely )?eligible|you qualify|guaranteed/i);
    }
    expect(entryStateDetail('appears_to_meet')).toMatch(/appear to meet/i);
    expect(entryStateDetail('appears_to_meet')).toMatch(/college will confirm|college confirms/i);
  });
});

describe('diversity rule', () => {
  const option = (id: string, subcategory: string, level: number | null): CourseOption =>
    toCourseOption(item({ canonicalId: id }), display({ canonicalId: id, primarySubcategory: subcategory, level }), false);

  it('leaves three or fewer options untouched', () => {
    const options = [option('a', 'One', 3), option('b', 'One', 3)];
    expect(applyDiversityRule(options)).toEqual(options);
  });

  it('prefers distinct subjects and levels without promoting a lower-ranked option', () => {
    const options = [
      option('a', 'Same', 3), option('b', 'Same', 3), option('c', 'Same', 3),
      option('d', 'Other', 4), option('e', 'Third', 5)
    ];
    const chosen = applyDiversityRule(options).map(chosen => chosen.courseId);
    expect(chosen).toEqual(['a', 'd', 'e']);
    // The engine's first item is always kept.
    expect(chosen[0]).toBe('a');
  });

  it('falls back to the engine order rather than returning fewer than it can', () => {
    const options = [
      option('a', 'Same', 3), option('b', 'Same', 3), option('c', 'Same', 3), option('d', 'Same', 3)
    ];
    expect(applyDiversityRule(options).map(o => o.courseId)).toEqual(['a', 'b', 'c']);
  });

  it('treats an unknown level as not repeating a level', () => {
    const options = [option('a', 'Same', null), option('b', 'Same', null), option('c', 'Other', 3), option('d', 'X', 4)];
    expect(applyDiversityRule(options).map(o => o.courseId)).toEqual(['a', 'c', 'd']);
  });
});

describe('equal relevance', () => {
  it('detects that every option carries the same relevance', () => {
    expect(allEquallyRelevant([item({ relevanceScore: 50 }), item({ relevanceScore: 50 })])).toBe(true);
    expect(allEquallyRelevant([item({ relevanceScore: 50 }), item({ relevanceScore: 30 })])).toBe(false);
    expect(allEquallyRelevant([item()])).toBe(false);
    expect(allEquallyRelevant([])).toBe(false);
  });
});

describe('nothing internal reaches the learner', () => {
  it('a presented option carries no score, points or denominator', () => {
    const option = toCourseOption(item(), display(), false);
    const text = JSON.stringify(option);
    expect(text).not.toContain('relevanceScore');
    expect(text).not.toContain('denominator');
    expect(text).not.toContain('points');
    expect(option).not.toHaveProperty('dimensions');
  });
});
