import { describe, expect, it } from 'vitest';
import { requireQuestion, getRoute } from '@/lib/questionnaire';
import {
  emptyAnswer, journeyComplete, multiSelectAtLimit, newJourney, nextQuestionId,
  previousQuestionId, screenPosition, toggleMultiSelect, visibleQuestionIds
} from '@/lib/questionnaire/flow';
import type { JourneyState } from '@/types/questionnaire';

const C2 = requireQuestion('career', 'C2');
const C4 = requireQuestion('career', 'C4');

describe('multi-select transitions are deterministic', () => {
  it('zero selections is the starting state', () => {
    expect(emptyAnswer(C2)).toEqual([]);
    expect(multiSelectAtLimit(C2, [])).toBe(false);
  });

  it('one selection', () => {
    expect(toggleMultiSelect(C2, [], 'support_people')).toEqual(['support_people']);
  });

  it('reaches the configured maximum', () => {
    const two = toggleMultiSelect(C2, ['support_people'], 'help_learning');
    expect(two).toEqual(['support_people', 'help_learning']);
    expect(multiSelectAtLimit(C2, two)).toBe(true);
  });

  it('refuses an extra selection beyond the maximum without replacing an earlier one', () => {
    const two = ['support_people', 'help_learning'];
    expect(toggleMultiSelect(C2, two, 'organise_tasks')).toEqual(two);
  });

  it('deselects an already chosen answer', () => {
    expect(toggleMultiSelect(C2, ['support_people', 'help_learning'], 'support_people'))
      .toEqual(['help_learning']);
  });

  it('choosing not sure clears every other selection', () => {
    expect(toggleMultiSelect(C2, ['support_people', 'help_learning'], 'unsure')).toEqual(['unsure']);
  });

  it('not sure on its own is a valid answer', () => {
    expect(toggleMultiSelect(C2, [], 'unsure')).toEqual(['unsure']);
  });

  it('choosing another answer after not sure clears not sure', () => {
    expect(toggleMultiSelect(C2, ['unsure'], 'organise_tasks')).toEqual(['organise_tasks']);
  });

  it('never leaves an unknown answer combined with a known one', () => {
    let value: string[] = [];
    for (const id of ['support_people', 'unsure', 'help_learning', 'unsure', 'organise_tasks']) {
      value = toggleMultiSelect(C2, value, id);
      const hasUnsure = value.includes('unsure');
      expect(hasUnsure ? value.length : 0).toBeLessThanOrEqual(1);
    }
  });

  it('C4 "a mix" is exclusive in exactly the same way, without being unknown', () => {
    expect(toggleMultiSelect(C4, ['talk_people', 'hands_on'], 'mixed_activities')).toEqual(['mixed_activities']);
    expect(toggleMultiSelect(C4, ['mixed_activities'], 'talk_people')).toEqual(['talk_people']);
    expect(toggleMultiSelect(C4, ['mixed_activities'], 'unsure')).toEqual(['unsure']);
  });

  it('deselecting an exclusive answer returns to nothing chosen', () => {
    expect(toggleMultiSelect(C4, ['mixed_activities'], 'mixed_activities')).toEqual([]);
  });
});

describe('journey navigation', () => {
  function answered(journey: 'career' | 'course'): JourneyState {
    const state = newJourney(journey);
    const answers: Record<string, string | string[]> = journey === 'career'
      ? { C1: 'start_work', C2: ['support_people'], C3: ['help_others'], C4: ['talk_people'], C5: 'starting_beginning', C6: 'try_activity' }
      : { F1: 'new_subject', F2: 'law', F3: 'new_to_subject' };
    return { ...state, answers: { ...state.answers, ...answers } };
  }

  it('starts on the first configured question', () => {
    expect(newJourney('career').currentQuestionId).toBe('C1');
    expect(newJourney('course').currentQuestionId).toBe('F1');
  });

  it('shows six career screens and five course screens with no branches', () => {
    expect(visibleQuestionIds(newJourney('career'))).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C8']);
    expect(visibleQuestionIds(newJourney('course'))).toEqual(['F1', 'F2', 'F3', 'F4', 'F5']);
  });

  it('walks forward and back through every screen without losing position', () => {
    let state = newJourney('career');
    const ids = visibleQuestionIds(state);
    for (let index = 0; index < ids.length - 1; index += 1) {
      expect(screenPosition(state)).toEqual({ index, total: ids.length });
      state = { ...state, currentQuestionId: nextQuestionId(state)! };
    }
    for (let index = ids.length - 1; index > 0; index -= 1) {
      state = { ...state, currentQuestionId: previousQuestionId(state)! };
    }
    expect(state.currentQuestionId).toBe('C1');
    expect(previousQuestionId(state)).toBeNull();
  });

  it('reports the last screen correctly', () => {
    const state = { ...newJourney('course'), currentQuestionId: 'F5' };
    expect(nextQuestionId(state)).toBeNull();
  });

  it('a reused answer removes its screen and reduces the displayed count', () => {
    const state: JourneyState = {
      ...newJourney('course'),
      answerOrigin: { F1: { kind: 'reused', sourceQuestionId: 'C1' } }
    };
    expect(visibleQuestionIds(state)).toEqual(['F2', 'F3', 'F4', 'F5']);
    expect(screenPosition({ ...state, currentQuestionId: 'F2' })).toEqual({ index: 0, total: 4 });
  });

  it('optional branches are suppressed while their reviewed content is absent', () => {
    expect(visibleQuestionIds(newJourney('career'))).not.toContain('C7');
    expect(visibleQuestionIds(newJourney('course'))).not.toContain('F6');
  });

  it('completion requires every required question, and optional ones may stay empty', () => {
    expect(journeyComplete(newJourney('course'))).toBe(false);
    const state = answered('course');
    expect(journeyComplete(state)).toBe(true);
    expect(state.answers.F4).toBeNull();
    expect(state.answers.F5).toBeNull();
  });

  it('an empty required multi-select is not complete', () => {
    const state = answered('career');
    expect(journeyComplete({ ...state, answers: { ...state.answers, C2: [] } })).toBe(false);
  });

  it('every configured question has a starting value', () => {
    for (const journey of ['career', 'course'] as const) {
      const state = newJourney(journey);
      for (const question of getRoute(journey).questions) {
        expect(question.id in state.answers).toBe(true);
      }
    }
  });
});
