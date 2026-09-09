import { describe, expect, it } from 'vitest';
import { evaluateReuse, invalidateAfterChange } from '@/lib/questionnaire/reuse';
import { newJourney } from '@/lib/questionnaire/flow';
import { reuseRule } from '@/lib/questionnaire';
import type { JourneyState } from '@/types/questionnaire';

function career(overrides: Partial<JourneyState> = {}): JourneyState {
  const state = newJourney('career');
  return {
    ...state,
    answers: {
      ...state.answers,
      C1: 'start_work', C2: ['support_people'], C3: ['help_others'],
      C4: ['talk_people'], C5: 'starting_beginning', C6: 'try_activity'
    },
    ...overrides
  };
}

const purpose = (outcomes: ReturnType<typeof evaluateReuse>) =>
  outcomes.find(o => o.targetQuestionId === 'F1')!;
const experience = (outcomes: ReturnType<typeof evaluateReuse>) =>
  outcomes.find(o => o.targetQuestionId === 'F3')!;

describe('C1 to F1 purpose reuse', () => {
  const expected: Record<string, string | null> = {
    start_work: 'prepare_work',
    change_career: 'prepare_work',
    personal_interest: 'personal_interest',
    progress_work: null,
    return_work: null,
    explore_options: null
  };

  it.each(Object.entries(expected))('C1 %s maps to %s', (sourceId, targetId) => {
    const outcome = purpose(evaluateReuse(career({ answers: { ...career().answers, C1: sourceId } }), undefined));
    if (targetId === null) {
      expect(outcome.action).toBe('ask');
      expect(outcome.targetAnswerId).toBeNull();
    } else {
      expect(outcome.action).toBe('reuse');
      expect(outcome.targetAnswerId).toBe(targetId);
    }
  });

  it('covers every configured C1 answer', () => {
    const rule = reuseRule('career_purpose_to_course_goal');
    expect(rule.mapping.map(item => item.sourceAnswerId).sort()).toEqual(Object.keys(expected).sort());
  });

  it('asks F1 when C1 was never answered', () => {
    const state = career();
    state.answers.C1 = null;
    expect(purpose(evaluateReuse(state, undefined)).action).toBe('ask');
  });
});

describe('C5 to F3 experience reuse', () => {
  function withSubject(c5: string, subjectId: string | undefined, specific: boolean) {
    const state = career({});
    state.answers.C5 = c5;
    state.context = {
      careerExperienceSubjectId: subjectId,
      careerExperienceSubjectWasSpecific: specific
    };
    return state;
  }

  it('asks F3 when the career route recorded no specific subject, which is the usual case', () => {
    const outcome = experience(evaluateReuse(career(), 'law'));
    expect(outcome.action).toBe('ask');
  });

  it.each([
    ['starting_beginning', 'new_to_subject'],
    ['informal_volunteering', 'informal_practical'],
    ['unsure_counts', 'unsure_counts']
  ])('reuses %s as %s only with an unchanged specific subject', (source, target) => {
    const state = withSubject(source, 'law', true);
    const outcome = experience(evaluateReuse(state, 'law'));
    expect(outcome.action).toBe('reuse');
    expect(outcome.targetAnswerId).toBe(target);
  });

  it.each(['studied_related', 'worked_related', 'study_and_work'])(
    'never reuses %s, because it does not establish the target meaning',
    source => {
      const state = withSubject(source, 'law', true);
      expect(experience(evaluateReuse(state, 'law')).action).toBe('ask');
    }
  );

  it('asks again when the subject changed', () => {
    const state = withSubject('starting_beginning', 'law', true);
    expect(experience(evaluateReuse(state, 'childcare')).action).toBe('ask');
  });

  it('asks again when the recorded subject was not specific', () => {
    const state = withSubject('starting_beginning', 'law', false);
    expect(experience(evaluateReuse(state, 'law')).action).toBe('ask');
  });

  it('asks again when no subject has been confirmed', () => {
    const state = withSubject('starting_beginning', 'law', true);
    expect(experience(evaluateReuse(state, undefined)).action).toBe('ask');
  });
});

describe('invalidation', () => {
  function course(): JourneyState {
    const state = newJourney('course');
    return {
      ...state,
      answers: { ...state.answers, F1: 'specific_requirement', F2: 'law', F3: 'completed_related', F5: 'enter_maximum' },
      details: {
        required_qualification_or_requirement_name: 'Some award',
        previous_qualification_name: 'A level',
        maximum_total_price_gbp: 500
      },
      answerOrigin: { F1: { kind: 'reused', sourceQuestionId: 'C1' }, F3: { kind: 'reused', sourceQuestionId: 'C5' } }
    };
  }

  it('changing the subject clears subject-dependent experience and its detail', () => {
    const next = invalidateAfterChange({ ...course(), answers: { ...course().answers, F2: 'childcare' } }, 'F2');
    expect(next.answers.F3).toBeNull();
    expect(next.details.previous_qualification_name).toBeNull();
    expect(next.answerOrigin.F3).toBeUndefined();
  });

  it('changing the subject clears the optional requirement branch', () => {
    const state = { ...course(), answers: { ...course().answers, F6: 'yes' } };
    expect(invalidateAfterChange(state, 'F2').answers.F6).toBeNull();
  });

  it('moving F1 away from specific_requirement clears the requirement name', () => {
    const state = { ...course(), answers: { ...course().answers, F1: 'new_subject' } };
    expect(invalidateAfterChange(state, 'F1').details.required_qualification_or_requirement_name).toBeNull();
  });

  it('moving F5 away from enter_maximum clears the amount', () => {
    const state = { ...course(), answers: { ...course().answers, F5: 'show_all_prices' } };
    expect(invalidateAfterChange(state, 'F5').details.maximum_total_price_gbp).toBeNull();
  });

  it('moving F3 away from a qualification answer clears the previous qualification', () => {
    const state = { ...course(), answers: { ...course().answers, F3: 'new_to_subject' } };
    expect(invalidateAfterChange(state, 'F3').details.previous_qualification_name).toBeNull();
  });

  it('changing C1 invalidates the answer reused from it, and leaves the others alone', () => {
    const next = invalidateAfterChange(course(), 'C1');
    expect(next.answers.F1).toBeNull();
    expect(next.answerOrigin.F1).toBeUndefined();
    expect(next.answers.F3).toBe('completed_related');
  });

  it('changing C5 invalidates only the answer reused from C5', () => {
    const next = invalidateAfterChange(course(), 'C5');
    expect(next.answers.F3).toBeNull();
    expect(next.answers.F1).toBe('specific_requirement');
  });

  it('preserves unrelated answers', () => {
    const next = invalidateAfterChange(course(), 'F5');
    expect(next.answers.F2).toBe('law');
  });
});
