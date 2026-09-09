import type { AnswerValue, JourneyId, Question } from '@/types/questionnaire';
import { activeConditionalInputs, getRoute, requireQuestion } from './index';
import { config } from '@/lib/config';

export interface FieldError { questionId?: string; detailId?: string; code: string; message: string }

export interface ValidatedSubmission {
  journey: JourneyId;
  answers: Record<string, AnswerValue>;
  details: Record<string, string | number | null>;
  filters: { regulatedOnly: boolean; levels: number[]; subcategoryIds: string[] };
}

export interface ValidationResult {
  ok: boolean;
  code?: string;
  message?: string;
  errors: FieldError[];
  value?: ValidatedSubmission;
}

const MAX_TEXT = 200;
const MAX_AMOUNT = 1_000_000;

/**
 * Validates one answer against its configured question. Applied identically on the
 * client and the server. An unknown option id is rejected, never coerced.
 */
export function validateAnswer(question: Question, value: unknown): FieldError[] {
  const errors: FieldError[] = [];
  const allowed = new Set(question.options.map(option => option.id));

  if (value === null || value === undefined) {
    if (!question.allowSkip) {
      errors.push({
        questionId: question.id,
        code: 'MISSING_REQUIRED_ANSWER',
        message: 'Choose an answer to continue.'
      });
    }
    return errors;
  }

  if (question.type === 'multi_select') {
    if (!Array.isArray(value)) {
      errors.push({ questionId: question.id, code: 'INVALID_ANSWER', message: 'Choose your answers from the listed options.' });
      return errors;
    }
    if (value.some(id => typeof id !== 'string')) {
      errors.push({ questionId: question.id, code: 'INVALID_ANSWER', message: 'Choose your answers from the listed options.' });
      return errors;
    }
    if (new Set(value).size !== value.length) {
      errors.push({ questionId: question.id, code: 'DUPLICATE_ANSWER', message: 'Each answer can only be chosen once.' });
      return errors;
    }
    const unknown = value.filter(id => !allowed.has(id as string));
    if (unknown.length) {
      errors.push({ questionId: question.id, code: 'UNSUPPORTED_ANSWER_ID', message: 'One of the answers is not offered for this question.' });
      return errors;
    }
    if (value.length < question.minSelections || value.length > question.maxSelections) {
      errors.push({
        questionId: question.id,
        code: 'SELECTION_BOUNDS',
        message: `Choose up to ${question.maxSelections} answers.`
      });
      return errors;
    }
    const exclusive = value.filter(id => question.options.find(option => option.id === id)?.exclusive);
    if (exclusive.length && value.length > 1) {
      errors.push({
        questionId: question.id,
        code: 'EXCLUSIVE_SELECTION',
        message: 'Choose that answer on its own.'
      });
    }
    return errors;
  }

  // single_select and subject_select both carry exactly one option id.
  if (typeof value !== 'string') {
    errors.push({ questionId: question.id, code: 'INVALID_ANSWER', message: 'Choose one of the listed options.' });
    return errors;
  }
  if (!allowed.has(value)) {
    errors.push({ questionId: question.id, code: 'UNSUPPORTED_ANSWER_ID', message: 'That answer is not offered for this question.' });
  }
  return errors;
}

function validateText(detailId: string, value: unknown): { errors: FieldError[]; value: string | null } {
  if (value === null || value === undefined || value === '') return { errors: [], value: null };
  if (typeof value !== 'string') {
    return { errors: [{ detailId, code: 'INVALID_DETAIL', message: 'That entry could not be read.' }], value: null };
  }
  const trimmed = value.trim();
  if (!trimmed) return { errors: [], value: null };
  if (trimmed.length > MAX_TEXT) {
    return {
      errors: [{ detailId, code: 'DETAIL_TOO_LONG', message: `Use ${MAX_TEXT} characters or fewer.` }],
      value: null
    };
  }
  // Free text is data, never an instruction and never a course fact.
  return { errors: [], value: trimmed };
}

function validateAmount(detailId: string, value: unknown): { errors: FieldError[]; value: number | null } {
  if (value === null || value === undefined || value === '') return { errors: [], value: null };
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return {
      errors: [{ detailId, code: 'INVALID_AMOUNT', message: 'Enter an amount in pounds, for example 250.' }],
      value: null
    };
  }
  if (value < 0) {
    return { errors: [{ detailId, code: 'INVALID_AMOUNT', message: 'Enter zero or a positive amount.' }], value: null };
  }
  if (value > MAX_AMOUNT) {
    return {
      errors: [{ detailId, code: 'AMOUNT_TOO_LARGE', message: `The highest amount we can use is £${MAX_AMOUNT.toLocaleString('en-GB')}.` }],
      value: null
    };
  }
  if (Math.round(value * 100) !== value * 100) {
    return {
      errors: [{ detailId, code: 'AMOUNT_PRECISION', message: 'Use pounds and pence, for example 249.50.' }],
      value: null
    };
  }
  return { errors: [], value };
}

/**
 * Full submission validation. Mirrors the handoff's API contract: required base
 * questions must exist, only optional questions may be null, details are an allowlist,
 * and a detail whose trigger answer is not selected is rejected rather than ignored.
 */
export function validateSubmission(body: unknown): ValidationResult {
  const errors: FieldError[] = [];
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, code: 'INVALID_JSON', message: 'The request could not be read.', errors };
  }
  const input = body as Record<string, unknown>;

  const allowedKeys = ['journey', 'questionnaireVersion', 'answers', 'details', 'filters', 'context'];
  const unexpected = Object.keys(input).filter(key => !allowedKeys.includes(key));
  if (unexpected.length) {
    return {
      ok: false, code: 'INVALID_REQUEST',
      message: 'The request contained properties this service does not accept.', errors
    };
  }

  const journey = input.journey;
  if (journey !== 'career' && journey !== 'course') {
    return { ok: false, code: 'INVALID_REQUEST', message: 'Choose a career or course journey.', errors };
  }

  if (input.questionnaireVersion !== undefined && input.questionnaireVersion !== config.questionnaireVersion) {
    return {
      ok: false, code: 'VERSION_MISMATCH',
      message: 'The questions have been updated. Please review your answers.', errors
    };
  }

  const route = getRoute(journey);
  const rawAnswers = input.answers;
  if (typeof rawAnswers !== 'object' || rawAnswers === null || Array.isArray(rawAnswers)) {
    return { ok: false, code: 'MISSING_REQUIRED_ANSWER', message: 'No answers were supplied.', errors };
  }
  const supplied = rawAnswers as Record<string, unknown>;

  const known = new Set([...route.baseQuestionIds, ...route.optionalQuestionIds]);
  for (const key of Object.keys(supplied)) {
    if (!known.has(key)) {
      errors.push({ questionId: key, code: 'UNKNOWN_QUESTION', message: 'That question is not part of this journey.' });
    }
  }

  const answers: Record<string, AnswerValue> = {};
  for (const questionId of route.baseQuestionIds) {
    const question = requireQuestion(journey, questionId);
    const value = questionId in supplied ? supplied[questionId] : null;
    const questionErrors = validateAnswer(question, value);
    errors.push(...questionErrors);
    if (!questionErrors.length) answers[questionId] = (value ?? null) as AnswerValue;
  }

  for (const questionId of route.optionalQuestionIds) {
    const branchEnabled = questionId === 'C7' ? config.careerC7Enabled : config.courseF6Enabled;
    const value = questionId in supplied ? supplied[questionId] : null;
    if (value !== null && value !== undefined && !branchEnabled) {
      // The branch has no approved reviewed content, so it cannot be answered.
      errors.push({
        questionId,
        code: 'INAPPLICABLE_BRANCH',
        message: 'That optional question is not currently available.'
      });
      continue;
    }
    const question = requireQuestion(journey, questionId);
    const questionErrors = validateAnswer(question, value);
    errors.push(...questionErrors);
    answers[questionId] = (value ?? null) as AnswerValue;
  }

  // Details: allowlisted, and only when their trigger answer is currently selected.
  const rawDetails = input.details ?? {};
  if (typeof rawDetails !== 'object' || rawDetails === null || Array.isArray(rawDetails)) {
    return { ok: false, code: 'INVALID_REQUEST', message: 'Optional detail fields could not be read.', errors };
  }
  const suppliedDetails = rawDetails as Record<string, unknown>;
  const details: Record<string, string | number | null> = {};

  const activeDetailIds = new Set<string>();
  for (const question of route.questions) {
    for (const input_ of activeConditionalInputs(question, answers[question.id])) {
      activeDetailIds.add(input_.id);
    }
  }
  const configuredDetailIds = new Set(
    route.questions.flatMap(question => (question.conditionalInputs ?? []).map(item => item.id))
  );

  for (const [detailId, value] of Object.entries(suppliedDetails)) {
    if (!configuredDetailIds.has(detailId)) {
      errors.push({ detailId, code: 'UNKNOWN_DETAIL', message: 'That field is not part of this journey.' });
      continue;
    }
    const empty = value === null || value === undefined || value === '';
    if (!activeDetailIds.has(detailId)) {
      if (!empty) {
        errors.push({ detailId, code: 'INACTIVE_DETAIL', message: 'That field no longer applies to your answers.' });
      }
      continue;
    }
    if (detailId === 'maximum_total_price_gbp') {
      const result = validateAmount(detailId, value);
      errors.push(...result.errors);
      details[detailId] = result.value;
    } else {
      const result = validateText(detailId, value);
      errors.push(...result.errors);
      details[detailId] = result.value;
    }
  }
  for (const detailId of activeDetailIds) {
    if (!(detailId in details)) details[detailId] = null;
  }

  // Explicit learner-controlled result filters. These scope the catalogue before the
  // engine runs; they never alter how the engine ranks.
  const rawFilters = input.filters ?? {};
  if (typeof rawFilters !== 'object' || rawFilters === null || Array.isArray(rawFilters)) {
    return { ok: false, code: 'INVALID_REQUEST', message: 'Filters could not be read.', errors };
  }
  const filterInput = rawFilters as Record<string, unknown>;
  const filterKeys = ['regulatedOnly', 'levels', 'subcategoryIds'];
  if (Object.keys(filterInput).some(key => !filterKeys.includes(key))) {
    return { ok: false, code: 'INVALID_REQUEST', message: 'Filters could not be read.', errors };
  }
  const regulatedOnly = filterInput.regulatedOnly;
  if (regulatedOnly !== undefined && typeof regulatedOnly !== 'boolean') {
    errors.push({ code: 'INVALID_FILTER', message: 'The regulated qualifications filter could not be read.' });
  }
  const levelsRaw = filterInput.levels;
  let levels: number[] = [];
  if (levelsRaw !== undefined) {
    if (!Array.isArray(levelsRaw) || levelsRaw.some(item => !Number.isInteger(item) || (item as number) < 1 || (item as number) > 7)) {
      errors.push({ code: 'INVALID_FILTER', message: 'The level filter could not be read.' });
    } else {
      levels = [...new Set(levelsRaw as number[])].sort((a, b) => a - b);
    }
  }
  const subcategoryRaw = filterInput.subcategoryIds;
  let subcategoryIds: string[] = [];
  if (subcategoryRaw !== undefined) {
    if (!Array.isArray(subcategoryRaw) || subcategoryRaw.length > 10
      || subcategoryRaw.some(item => typeof item !== 'string' || !/^sub_[a-z0-9_]{1,120}$/.test(item))) {
      errors.push({ code: 'INVALID_FILTER', message: 'The subject filter could not be read.' });
    } else {
      subcategoryIds = [...new Set(subcategoryRaw as string[])];
    }
  }

  if (errors.length) {
    const missing = errors.some(error => error.code === 'MISSING_REQUIRED_ANSWER');
    return {
      ok: false,
      code: missing ? 'MISSING_REQUIRED_ANSWER' : 'INVALID_ANSWER',
      message: missing
        ? 'Some answers are still needed before we can show results.'
        : 'Some answers could not be used. Please check them and try again.',
      errors
    };
  }

  return {
    ok: true,
    errors: [],
    value: {
      journey,
      answers,
      details,
      filters: { regulatedOnly: regulatedOnly === true, levels, subcategoryIds }
    }
  };
}
