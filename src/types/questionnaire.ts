/** Types mirroring data/source/questionnaire.json. The JSON stays authoritative. */

export type JourneyId = 'career' | 'course';
export type QuestionType = 'single_select' | 'multi_select' | 'subject_select';

export interface QuestionOption {
  id: string;
  label?: string;
  labelBinding?: string;
  exclusive?: boolean;
  isUnknown?: boolean;
  sourceCategory?: string;
  action?: string;
}

export interface ConditionalInput {
  id: string;
  type: 'text' | 'currency_amount';
  label: string;
  hint?: string;
  visibleWhen: { questionId: string; answerIds: string[] };
  required: boolean;
  allowSkip: boolean;
  maxLength?: number;
  currency?: string;
  minimum?: number;
  maximumDecimalPlaces?: number;
  onMissing: string;
  use: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  title?: string;
  titleBinding?: string;
  titleWhen?: { questionId: string; answerId: string; title: string }[];
  hint?: string;
  required: boolean;
  allowSkip: boolean;
  minSelections: number;
  maxSelections: number;
  isOptionalBranch?: boolean;
  options: QuestionOption[];
  conditionalInputs?: ConditionalInput[];
  search?: Record<string, unknown>;
  onSkip?: string;
  use: string;
  categorySource?: string;
  catalogueScopeNote?: string;
  contextToStore?: string[];
  showWhen?: { all: string[] };
  reviewedContentRequired?: Record<string, unknown>;
}

export interface Route {
  id: JourneyId;
  title: string;
  description: string;
  intro: string;
  effortCopy: string;
  baseQuestionIds: string[];
  optionalQuestionIds: string[];
  questionCount: Record<string, unknown>;
  questions: Question[];
}

export interface ReuseMapping {
  sourceAnswerId: string;
  targetAnswerId: string | null;
  action: 'reuse' | 'ask';
  reason: string;
}

export interface AnswerReuseRule {
  id: string;
  sourceQuestionId: string;
  targetQuestionId: string;
  allConditionsRequired?: string[];
  showReusedValueToLearner: boolean;
  editable: boolean;
  mapping: ReuseMapping[];
  onMissingOrUnmappedSource: string;
  onSourceChanged?: string;
  onSubjectChanged?: string;
  onAnyConditionFalse?: string;
}

export interface Questionnaire {
  schemaVersion: string;
  questionnaireId: string;
  contentVersion: string;
  locale: string;
  status: string;
  positioning: string;
  answerContract: Record<string, string>;
  routes: Record<JourneyId, Route>;
  answerReuse: AnswerReuseRule[];
  globalRules: Record<string, unknown>;
}

/** A single answer value: one option id, a list of ids, or null for a skipped optional. */
export type AnswerValue = string | string[] | null;

export interface JourneyContext {
  confirmedSubjectId?: string;
  confirmedSubjectLabel?: string;
  sourceCareerFamilyId?: string;
  careerExperienceSubjectId?: string;
  careerExperienceSubjectWasSpecific?: boolean;
  scenarioPairId?: string;
  requirementRuleId?: string;
}

export interface AnswerOrigin {
  kind: 'direct' | 'reused';
  sourceQuestionId?: string;
}

export interface JourneyState {
  questionnaireVersion: string;
  journey: JourneyId;
  answers: Record<string, AnswerValue>;
  details: Record<string, string | number | null>;
  context: JourneyContext;
  answerOrigin: Record<string, AnswerOrigin>;
  currentQuestionId: string;
  updatedAt: string;
}
