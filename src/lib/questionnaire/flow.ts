import type { AnswerValue, JourneyId, JourneyState, Question } from '@/types/questionnaire';
import { getRoute, isExclusive, requireQuestion } from './index';
import { config } from '@/lib/config';

/**
 * Deterministic multi-select transition.
 *
 * questionnaire.json globalRules.exclusiveOptionBehaviour:
 *   "Selecting an exclusive option clears others; selecting another option clears any
 *    exclusive selection. Apply the same rules on the server."
 *
 * There is no state in which an exclusive option coexists with anything else, and no
 * hidden selection is retained behind an exclusive answer.
 */
export function toggleMultiSelect(
  question: Question,
  current: string[],
  optionId: string
): string[] {
  const selected = current.includes(optionId);

  if (selected) return current.filter(id => id !== optionId);

  if (isExclusive(question, optionId)) return [optionId];

  const withoutExclusive = current.filter(id => !isExclusive(question, id));
  if (withoutExclusive.length >= question.maxSelections) {
    // The limit is enforced rather than silently replacing an earlier choice.
    return withoutExclusive;
  }
  return [...withoutExclusive, optionId];
}

/** True when one more selection would exceed the configured maximum. */
export function multiSelectAtLimit(question: Question, current: string[]): boolean {
  return current.filter(id => !isExclusive(question, id)).length >= question.maxSelections;
}

export function setSingleSelect(_question: Question, optionId: string): string {
  return optionId;
}

/** The optional branches only exist once reviewed content is published. */
export function optionalBranchAvailable(questionId: string): boolean {
  if (questionId === 'C7') return config.careerC7Enabled;
  if (questionId === 'F6') return config.courseF6Enabled;
  return false;
}

/**
 * The question ids actually shown, after reuse and branching.
 * `globalRules.counting` requires the displayed count to reflect the real branch.
 */
export function visibleQuestionIds(state: JourneyState): string[] {
  const route = getRoute(state.journey);
  const reused = new Set(
    Object.entries(state.answerOrigin)
      .filter(([, origin]) => origin.kind === 'reused')
      .map(([questionId]) => questionId)
  );
  const base = route.baseQuestionIds.filter(id => !reused.has(id));
  const optional = route.optionalQuestionIds.filter(id => optionalBranchAvailable(id));
  return [...base, ...optional];
}

export function screenPosition(state: JourneyState): { index: number; total: number } {
  const ids = visibleQuestionIds(state);
  const index = ids.indexOf(state.currentQuestionId);
  return { index: index < 0 ? 0 : index, total: ids.length };
}

export function nextQuestionId(state: JourneyState): string | null {
  const ids = visibleQuestionIds(state);
  const index = ids.indexOf(state.currentQuestionId);
  if (index < 0 || index + 1 >= ids.length) return null;
  return ids[index + 1];
}

export function previousQuestionId(state: JourneyState): string | null {
  const ids = visibleQuestionIds(state);
  const index = ids.indexOf(state.currentQuestionId);
  if (index <= 0) return null;
  return ids[index - 1];
}

/** Every required base question in the current branch has a usable answer. */
export function journeyComplete(state: JourneyState): boolean {
  const route = getRoute(state.journey);
  return route.baseQuestionIds.every(questionId => {
    const question = requireQuestion(state.journey, questionId);
    const answer = state.answers[questionId];
    if (question.allowSkip) return true;
    if (answer === null || answer === undefined) return false;
    if (Array.isArray(answer)) return answer.length >= question.minSelections;
    return typeof answer === 'string' && answer.length > 0;
  });
}

export function emptyAnswer(question: Question): AnswerValue {
  return question.type === 'multi_select' ? [] : null;
}

export function newJourney(journey: JourneyId): JourneyState {
  const route = getRoute(journey);
  const answers: Record<string, AnswerValue> = {};
  for (const question of route.questions) answers[question.id] = emptyAnswer(question);
  return {
    questionnaireVersion: config.questionnaireVersion,
    journey,
    answers,
    details: {},
    context: {},
    answerOrigin: {},
    currentQuestionId: route.baseQuestionIds[0],
    updatedAt: new Date().toISOString()
  };
}
