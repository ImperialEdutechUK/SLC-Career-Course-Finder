import questionnaireJson from '~data/source/questionnaire.json';
import type {
  AnswerReuseRule, JourneyId, Question, Questionnaire, Route
} from '@/types/questionnaire';

/**
 * questionnaire.json is the single source of truth for wording, ids, limits,
 * exclusivity, optionality and reuse. Nothing here re-declares a mapping.
 */
export const questionnaire = questionnaireJson as unknown as Questionnaire;

export const QUESTIONNAIRE_VERSION = questionnaire.contentVersion;

export function getRoute(journey: JourneyId): Route {
  const route = questionnaire.routes[journey];
  if (!route) throw new Error(`unknown journey: ${journey}`);
  return route;
}

export function getQuestion(journey: JourneyId, questionId: string): Question | undefined {
  return getRoute(journey).questions.find(question => question.id === questionId);
}

export function requireQuestion(journey: JourneyId, questionId: string): Question {
  const question = getQuestion(journey, questionId);
  if (!question) throw new Error(`unknown question: ${journey}/${questionId}`);
  return question;
}

export function optionIds(question: Question): string[] {
  return question.options.map(option => option.id);
}

export function isExclusive(question: Question, optionId: string): boolean {
  return question.options.find(option => option.id === optionId)?.exclusive === true;
}

export function isUnknownOption(question: Question, optionId: string): boolean {
  return question.options.find(option => option.id === optionId)?.isUnknown === true;
}

export function reuseRules(): AnswerReuseRule[] {
  return questionnaire.answerReuse;
}

export function reuseRule(id: string): AnswerReuseRule {
  const rule = questionnaire.answerReuse.find(item => item.id === id);
  if (!rule) throw new Error(`unknown reuse rule: ${id}`);
  return rule;
}

/** The 16 exact source categories offered by F2, minus the exploration escape hatch. */
export function subjectOptions() {
  return requireQuestion('course', 'F2').options.filter(option => option.sourceCategory);
}

/** Question title, honouring the configured `titleWhen` overrides. */
export function questionTitle(
  question: Question,
  answers: Record<string, unknown>
): string {
  for (const override of question.titleWhen ?? []) {
    const answer = answers[override.questionId];
    if (answer === override.answerId || (Array.isArray(answer) && answer.includes(override.answerId))) {
      return override.title;
    }
  }
  if (question.title) return question.title;
  throw new Error(`question ${question.id} has no static title; a reviewed binding is required`);
}

/** Conditional inputs whose trigger answer is currently selected. */
export function activeConditionalInputs(question: Question, answer: unknown) {
  return (question.conditionalInputs ?? []).filter(input => {
    if (input.visibleWhen.questionId !== question.id) return false;
    if (typeof answer === 'string') return input.visibleWhen.answerIds.includes(answer);
    if (Array.isArray(answer)) return answer.some(id => input.visibleWhen.answerIds.includes(id));
    return false;
  });
}

export const DETAIL_IDS = [
  'required_qualification_or_requirement_name',
  'previous_qualification_name',
  'maximum_total_price_gbp'
] as const;

export type DetailId = (typeof DETAIL_IDS)[number];
