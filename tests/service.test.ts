import { describe, expect, it } from 'vitest';
import { validateSubmission } from '@/lib/questionnaire/validation';
import { recommendCareerDirections, recommendCourses } from '@/lib/adapter/service';
import { buildEngineRequest } from '@/lib/adapter/preferences';
import { config } from '@/lib/config';

function submit(journey: 'career' | 'course', answers: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const validated = validateSubmission({ journey, questionnaireVersion: '2026-09-08.1', answers, ...extra });
  if (!validated.ok || !validated.value) throw new Error(JSON.stringify(validated.errors));
  return validated.value;
}

const COURSE = { F1: 'new_subject', F2: 'law', F3: 'new_to_subject', F4: null, F5: null };
const CAREER = {
  C1: 'start_work', C2: ['support_people'], C3: ['help_others'],
  C4: ['talk_people'], C5: 'starting_beginning', C6: 'introductory_course'
};

describe('adapter preference mapping', () => {
  it('maps F1, F3 and F2 to the identical engine identifiers', () => {
    const request = buildEngineRequest({
      answers: { F1: 'develop_work_skills', F3: 'current_work' },
      details: {}, categoryIds: ['law'], filters: { regulatedOnly: false }
    });
    expect(request.preferences).toEqual({
      categoryIds: ['law'], goal: 'develop_work_skills', experience: 'current_work'
    });
  });

  it('omits the goal and experience for the unknown answers', () => {
    const request = buildEngineRequest({
      answers: { F1: 'unsure', F3: 'unsure_counts' },
      details: {}, categoryIds: ['law'], filters: { regulatedOnly: false }
    });
    expect(request.preferences.goal).toBeUndefined();
    expect(request.preferences.experience).toBeUndefined();
  });

  it('applies a budget cap only when an amount was actually entered', () => {
    const withAmount = buildEngineRequest({
      answers: { F5: 'enter_maximum' }, details: { maximum_total_price_gbp: 250 },
      categoryIds: ['law'], filters: { regulatedOnly: false }
    });
    expect(withAmount.preferences.budgetGbp).toBe(250);

    const withoutAmount = buildEngineRequest({
      answers: { F5: 'enter_maximum' }, details: { maximum_total_price_gbp: null },
      categoryIds: ['law'], filters: { regulatedOnly: false }
    });
    expect(withoutAmount.preferences.budgetGbp).toBeUndefined();

    const otherAnswer = buildEngineRequest({
      answers: { F5: 'show_all_prices' }, details: { maximum_total_price_gbp: 250 },
      categoryIds: ['law'], filters: { regulatedOnly: false }
    });
    expect(otherAnswer.preferences.budgetGbp).toBeUndefined();
  });

  it('preserves a zero cap exactly', () => {
    const request = buildEngineRequest({
      answers: { F5: 'enter_maximum' }, details: { maximum_total_price_gbp: 0 },
      categoryIds: ['law'], filters: { regulatedOnly: false }
    });
    expect(request.preferences.budgetGbp).toBe(0);
  });

  it('derives no entry fact from a relevance answer', () => {
    const request = buildEngineRequest({
      answers: { F1: 'further_study', F3: 'qualification_and_work' },
      details: { previous_qualification_name: 'BSc Computing' },
      categoryIds: ['information_technology'], filters: { regulatedOnly: false }
    });
    // A learner-reported qualification name is not a resolved level or award.
    expect(request.facts).toEqual({});
  });

  it('sends no subject when the learner asked to explore', () => {
    const request = buildEngineRequest({
      answers: { F2: 'help_me_explore' }, details: {}, categoryIds: [], filters: { regulatedOnly: false }
    });
    expect(request.preferences.categoryIds).toBeUndefined();
  });
});

describe('course recommendations', () => {
  it('returns explained options for a confirmed subject', () => {
    const response = recommendCourses(submit('course', COURSE));
    expect(response.state).toBe('course_options');
    expect(response.courseOptions!.length).toBeGreaterThan(0);
    expect(response.courseOptions!.length).toBeLessThanOrEqual(3);
    expect(response.explanationMode).toBe('template');
  });

  it('reports the catalogue, questionnaire, rules and career map versions', () => {
    const response = recommendCourses(submit('course', COURSE));
    expect(response.versions.questionnaire).toBe(config.questionnaireVersion);
    expect(response.versions.catalogue).toMatch(/^july2026-/);
    expect(response.versions.careerMap).toBe(config.careerMapVersion);
  });

  it('issues a fresh request identifier and never a result reference', () => {
    const first = recommendCourses(submit('course', COURSE));
    const second = recommendCourses(submit('course', COURSE));
    expect(first.requestId).not.toBe(second.requestId);
    expect(first.resultRef).toBeNull();
  });

  it('is deterministic for identical answers', () => {
    const first = recommendCourses(submit('course', COURSE)).courseOptions!.map(o => o.courseId);
    const second = recommendCourses(submit('course', COURSE)).courseOptions!.map(o => o.courseId);
    expect(first).toEqual(second);
  });

  it('says the options are equally relevant rather than implying an order', () => {
    const response = recommendCourses(submit('course', COURSE));
    expect(response.allEquallyRelevant).toBe(true);
    expect(response.notices.map(n => n.code)).toContain('EQUALLY_RELEVANT');
  });

  it('reports the total before truncation without listing them all', () => {
    const response = recommendCourses(submit('course', { ...COURSE, F2: 'business_and_management' }));
    expect(response.totals!.directMatches).toBeGreaterThan(3);
    expect(response.courseOptions).toHaveLength(3);
  });

  it('never silently relaxes a filter that produced nothing', () => {
    const response = recommendCourses(submit('course', COURSE, { filters: { regulatedOnly: true } }));
    expect(response.state).toBe('no_verified_match');
    expect(response.courseOptions).toEqual([]);
    expect(response.notices.map(n => n.code)).toContain('REGULATED_FILTER_APPLIED');
  });

  it('asks for a subject rather than ranking every category', () => {
    const response = recommendCourses(submit('course', {
      F1: 'unsure', F2: 'help_me_explore', F3: 'unsure_counts', F4: null, F5: null
    }));
    expect(response.state).toBe('broad_exploration');
    expect(response.notices.map(n => n.code)).toContain('NEEDS_SUBJECT');
  });

  it('applies an explicit level filter without changing how ranking works', () => {
    const all = recommendCourses(submit('course', { ...COURSE, F2: 'business_and_management' }));
    const filtered = recommendCourses(submit('course', { ...COURSE, F2: 'business_and_management' }, { filters: { levels: [7] } }));
    expect(filtered.totals!.directMatches).toBeLessThan(all.totals!.directMatches);
    for (const option of filtered.courseOptions!) expect(option.course.level).toBe(7);
  });
});

describe('career recommendations', () => {
  it('returns at most three directions', () => {
    const response = recommendCareerDirections(submit('career', CAREER));
    expect(response.state).toBe('career_directions');
    expect(response.careerDirections!.length).toBeLessThanOrEqual(3);
  });

  it('gives each direction a reason, an activity, a check and a next step', () => {
    for (const direction of recommendCareerDirections(submit('career', CAREER)).careerDirections!) {
      expect(direction.whyThisAppeared.length).toBeGreaterThan(10);
      expect(direction.everydayActivity.length).toBeGreaterThan(10);
      expect(direction.thingToInvestigate.length).toBeGreaterThan(10);
      expect(direction.nextStep.length).toBeGreaterThan(10);
      expect(direction.independentGuidance.url).toMatch(/^https:\/\//);
    }
  });

  it('offers a changeable subject suggestion, never a forced one', () => {
    const response = recommendCareerDirections(submit('career', CAREER));
    for (const direction of response.careerDirections!) {
      if (direction.slcCoverage === 'outside_reviewed_coverage') {
        expect(direction.suggestedSubjectIds).toEqual([]);
      } else {
        expect(direction.suggestedSubjectIds.length).toBeGreaterThan(0);
      }
    }
  });

  it('does not narrow when the learner is still deciding', () => {
    const response = recommendCareerDirections(submit('career', { ...CAREER, C2: ['unsure'] }));
    expect(response.state).toBe('broad_exploration');
    expect(response.careerDirections).toEqual([]);
  });

  it('the career route never returns course options', () => {
    const response = recommendCareerDirections(submit('career', CAREER));
    expect(response.courseOptions).toBeUndefined();
    expect(response.journey).toBe('career');
  });
});

describe('optional integrations stay off by default', () => {
  it('AI is disabled and every explanation is a template', () => {
    expect(config.aiExplanationsEnabled).toBe(false);
    expect(recommendCourses(submit('course', COURSE)).explanationMode).toBe('template');
  });

  it('both optional questionnaire branches are suppressed', () => {
    expect(config.careerC7Enabled).toBe(false);
    expect(config.courseF6Enabled).toBe(false);
  });

  it('goal-only ranking is disabled by configuration', () => {
    expect(config.approvedSpecificGoalIds).toEqual([]);
  });

  it('saved results, contacts, marketing and analytics are all off', () => {
    expect(config.savedResultsEnabled).toBe(false);
    expect(config.contactRequestsEnabled).toBe(false);
    expect(config.marketingOptInEnabled).toBe(false);
    expect(config.nonEssentialAnalyticsEnabled).toBe(false);
    expect(config.sessionRestoreEnabled).toBe(false);
  });
});
