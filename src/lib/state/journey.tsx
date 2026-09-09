'use client';

import {
  createContext, useCallback, useContext, useMemo, useReducer, useRef, type ReactNode
} from 'react';
import type { AnswerValue, JourneyId, JourneyState } from '@/types/questionnaire';
import type { ApiError, RecommendationResponse } from '@/types/results';
import { getRoute, requireQuestion } from '@/lib/questionnaire';
import {
  journeyComplete, newJourney, nextQuestionId, previousQuestionId,
  screenPosition, setSingleSelect, toggleMultiSelect, visibleQuestionIds
} from '@/lib/questionnaire/flow';
import { evaluateReuse, invalidateAfterChange } from '@/lib/questionnaire/reuse';
import type { FieldError } from '@/lib/questionnaire/validation';

/**
 * Journey state lives in memory for the active visit only.
 *
 * Answers never enter the URL, browser storage or analytics. Session restoration is a
 * separate configured feature that stays off until a privacy owner approves it, so a
 * refresh deliberately starts again rather than silently retaining answers.
 */

export interface GuideState {
  career: JourneyState | null;
  course: JourneyState | null;
  results: RecommendationResponse | null;
  resultsJourney: JourneyId | null;
  status: 'idle' | 'evaluating' | 'ready' | 'error';
  error: ApiError['error'] | null;
  fieldErrors: FieldError[];
  /** Subject suggested by a chosen career direction. Always confirmable and changeable. */
  suggestedSubjectId: string | null;
  sourceCareerFamilyId: string | null;
  filters: { regulatedOnly: boolean; levels: number[]; subcategoryIds: string[] };
}

type Action =
  | { type: 'start'; journey: JourneyId }
  | { type: 'answer'; journey: JourneyId; questionId: string; value: AnswerValue }
  | { type: 'detail'; journey: JourneyId; detailId: string; value: string | number | null }
  | { type: 'goto'; journey: JourneyId; questionId: string }
  | { type: 'next'; journey: JourneyId }
  | { type: 'back'; journey: JourneyId }
  | { type: 'fieldErrors'; errors: FieldError[] }
  | { type: 'evaluating' }
  | { type: 'results'; journey: JourneyId; response: RecommendationResponse }
  | { type: 'error'; error: ApiError['error'] }
  | { type: 'filters'; filters: Partial<GuideState['filters']> }
  | { type: 'unreuse'; journey: JourneyId; questionId: string }
  | { type: 'toCourse'; familyId: string; subjectId: string | null; careerAnswers: JourneyState }
  | { type: 'reset' };

const initialState: GuideState = {
  career: null,
  course: null,
  results: null,
  resultsJourney: null,
  status: 'idle',
  error: null,
  fieldErrors: [],
  suggestedSubjectId: null,
  sourceCareerFamilyId: null,
  filters: { regulatedOnly: false, levels: [], subcategoryIds: [] }
};

function withJourney(state: GuideState, journey: JourneyId, next: JourneyState): GuideState {
  return { ...state, [journey]: next } as GuideState;
}

function reducer(state: GuideState, action: Action): GuideState {
  switch (action.type) {
    case 'start': {
      // Idempotent: starting an existing journey must not produce new state, or the
      // effect that calls it would re-run on every render.
      if (state[action.journey]) return state;
      return withJourney(state, action.journey, newJourney(action.journey));
    }

    case 'answer': {
      const current = state[action.journey];
      if (!current) return state;
      let next: JourneyState = {
        ...current,
        answers: { ...current.answers, [action.questionId]: action.value },
        answerOrigin: { ...current.answerOrigin },
        details: { ...current.details },
        context: { ...current.context },
        updatedAt: new Date().toISOString()
      };
      // An edited answer is direct, whatever it was before.
      delete next.answerOrigin[action.questionId];
      next = invalidateAfterChange(next, action.questionId);

      if (action.questionId === 'F2' && typeof action.value === 'string') {
        next.context = { ...next.context, confirmedSubjectId: action.value };
      }

      // Changing any answer invalidates results for that journey. A stale
      // recommendation must never remain on screen.
      const clearResults = state.resultsJourney === action.journey;
      return {
        ...withJourney(state, action.journey, next),
        results: clearResults ? null : state.results,
        resultsJourney: clearResults ? null : state.resultsJourney,
        status: clearResults ? 'idle' : state.status,
        fieldErrors: state.fieldErrors.filter(error => error.questionId !== action.questionId)
      };
    }

    case 'detail': {
      const current = state[action.journey];
      if (!current) return state;
      const next: JourneyState = {
        ...current,
        details: { ...current.details, [action.detailId]: action.value },
        updatedAt: new Date().toISOString()
      };
      const clearResults = state.resultsJourney === action.journey;
      return {
        ...withJourney(state, action.journey, next),
        results: clearResults ? null : state.results,
        resultsJourney: clearResults ? null : state.resultsJourney,
        status: clearResults ? 'idle' : state.status,
        fieldErrors: state.fieldErrors.filter(error => error.detailId !== action.detailId)
      };
    }

    case 'goto': {
      const current = state[action.journey];
      if (!current) return state;
      return {
        ...withJourney(state, action.journey, { ...current, currentQuestionId: action.questionId }),
        fieldErrors: []
      };
    }

    case 'next': {
      const current = state[action.journey];
      if (!current) return state;
      const target = nextQuestionId(current);
      if (!target) return state;
      return {
        ...withJourney(state, action.journey, { ...current, currentQuestionId: target }),
        fieldErrors: []
      };
    }

    case 'back': {
      const current = state[action.journey];
      if (!current) return state;
      const target = previousQuestionId(current);
      if (!target) return state;
      // Back never clears an answer.
      return {
        ...withJourney(state, action.journey, { ...current, currentQuestionId: target }),
        fieldErrors: []
      };
    }

    case 'fieldErrors':
      return { ...state, fieldErrors: action.errors };

    case 'evaluating':
      return { ...state, status: 'evaluating', error: null, fieldErrors: [] };

    case 'results':
      return {
        ...state,
        status: 'ready',
        results: action.response,
        resultsJourney: action.journey,
        error: null,
        fieldErrors: []
      };

    case 'error':
      // A failure keeps every answer so the learner can retry.
      return { ...state, status: 'error', error: action.error };

    case 'filters':
      // Existing results stay on screen until the recalculated ones replace them,
      // so the page never empties underneath the learner.
      return {
        ...state,
        filters: { ...state.filters, ...action.filters },
        status: 'evaluating'
      };

    case 'unreuse': {
      const current = state[action.journey];
      if (!current) return state;
      const answerOrigin = { ...current.answerOrigin };
      delete answerOrigin[action.questionId];
      return {
        ...withJourney(state, action.journey, {
          ...current,
          answerOrigin,
          currentQuestionId: action.questionId,
          updatedAt: new Date().toISOString()
        }),
        results: null,
        resultsJourney: null,
        status: 'idle',
        fieldErrors: []
      };
    }

    case 'toCourse': {
      // Career answers are kept. Only the explicitly configured reuse mappings are
      // applied, and every reused value is shown to the learner with a Change action.
      const course = newJourney('course');
      const answers = { ...course.answers };
      const answerOrigin: JourneyState['answerOrigin'] = {};

      for (const outcome of evaluateReuse(action.careerAnswers, action.subjectId ?? undefined)) {
        if (outcome.action === 'reuse' && outcome.targetAnswerId) {
          answers[outcome.targetQuestionId] = outcome.targetAnswerId;
          answerOrigin[outcome.targetQuestionId] = {
            kind: 'reused',
            sourceQuestionId: outcome.sourceQuestionId
          };
        }
      }

      // The subject is a suggestion the learner still confirms on F2.
      if (action.subjectId) answers.F2 = action.subjectId;

      const next: JourneyState = {
        ...course,
        answers,
        answerOrigin,
        context: {
          ...course.context,
          sourceCareerFamilyId: action.familyId,
          confirmedSubjectId: action.subjectId ?? undefined
        },
        updatedAt: new Date().toISOString()
      };
      next.currentQuestionId = visibleQuestionIds(next)[0] ?? 'F2';

      return {
        ...state,
        course: next,
        suggestedSubjectId: action.subjectId,
        sourceCareerFamilyId: action.familyId,
        fieldErrors: []
      };
    }

    case 'reset':
      return initialState;

    default:
      return state;
  }
}

interface GuideContextValue extends GuideState {
  start: (journey: JourneyId) => void;
  answer: (journey: JourneyId, questionId: string, value: AnswerValue) => void;
  toggleOption: (journey: JourneyId, questionId: string, optionId: string) => void;
  selectOption: (journey: JourneyId, questionId: string, optionId: string) => void;
  setDetail: (journey: JourneyId, detailId: string, value: string | number | null) => void;
  goTo: (journey: JourneyId, questionId: string) => void;
  goNext: (journey: JourneyId) => void;
  goBack: (journey: JourneyId) => void;
  setFieldErrors: (errors: FieldError[]) => void;
  setFilters: (filters: Partial<GuideState['filters']>) => void;
  submit: (journey: JourneyId) => Promise<RecommendationResponse | null>;
  startCourseFromCareer: (familyId: string, subjectId: string | null) => void;
  changeReusedAnswer: (journey: JourneyId, questionId: string) => void;
  reset: () => void;
  position: (journey: JourneyId) => { index: number; total: number };
  isComplete: (journey: JourneyId) => boolean;
  visibleIds: (journey: JourneyId) => string[];
}

const GuideContext = createContext<GuideContextValue | null>(null);

export function GuideProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // A superseded response must never overwrite newer answers.
  const sequence = useRef(0);

  const start = useCallback((journey: JourneyId) => dispatch({ type: 'start', journey }), []);
  const answer = useCallback(
    (journey: JourneyId, questionId: string, value: AnswerValue) =>
      dispatch({ type: 'answer', journey, questionId, value }),
    []
  );

  const stateRef = useRef(state);
  stateRef.current = state;

  const toggleOption = useCallback((journey: JourneyId, questionId: string, optionId: string) => {
    const current = stateRef.current[journey];
    if (!current) return;
    const question = requireQuestion(journey, questionId);
    const value = current.answers[questionId];
    const next = toggleMultiSelect(question, Array.isArray(value) ? value : [], optionId);
    dispatch({ type: 'answer', journey, questionId, value: next });
  }, []);

  const selectOption = useCallback((journey: JourneyId, questionId: string, optionId: string) => {
    const question = requireQuestion(journey, questionId);
    dispatch({ type: 'answer', journey, questionId, value: setSingleSelect(question, optionId) });
  }, []);

  const setDetail = useCallback(
    (journey: JourneyId, detailId: string, value: string | number | null) =>
      dispatch({ type: 'detail', journey, detailId, value }),
    []
  );

  const goTo = useCallback((journey: JourneyId, questionId: string) => dispatch({ type: 'goto', journey, questionId }), []);
  const goNext = useCallback((journey: JourneyId) => dispatch({ type: 'next', journey }), []);
  const goBack = useCallback((journey: JourneyId) => dispatch({ type: 'back', journey }), []);
  const setFieldErrors = useCallback((errors: FieldError[]) => dispatch({ type: 'fieldErrors', errors }), []);
  const setFilters = useCallback((filters: Partial<GuideState['filters']>) => dispatch({ type: 'filters', filters }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  const changeReusedAnswer = useCallback(
    (journey: JourneyId, questionId: string) => dispatch({ type: 'unreuse', journey, questionId }),
    []
  );

  const startCourseFromCareer = useCallback((familyId: string, subjectId: string | null) => {
    const career = stateRef.current.career;
    if (!career) return;
    dispatch({ type: 'toCourse', familyId, subjectId, careerAnswers: career });
  }, []);

  const submit = useCallback(async (journey: JourneyId) => {
    const current = stateRef.current[journey];
    if (!current) return null;
    const ticket = ++sequence.current;
    dispatch({ type: 'evaluating' });

    const route = getRoute(journey);
    const answers: Record<string, AnswerValue> = {};
    for (const questionId of [...route.baseQuestionIds, ...route.optionalQuestionIds]) {
      const value = current.answers[questionId];
      answers[questionId] = Array.isArray(value) && value.length === 0 ? null : (value ?? null);
    }
    const details = Object.fromEntries(
      Object.entries(current.details).filter(([, value]) => value !== null && value !== '')
    );

    try {
      const response = await fetch('/api/v1/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journey,
          questionnaireVersion: current.questionnaireVersion,
          answers,
          details,
          filters: stateRef.current.filters
        })
      });
      // A late response for a superseded request is discarded.
      if (ticket !== sequence.current) return null;

      const body = await response.json();
      if (!response.ok) {
        dispatch({ type: 'error', error: body.error });
        if (Array.isArray(body.error?.fields)) dispatch({ type: 'fieldErrors', errors: body.error.fields });
        return null;
      }
      dispatch({ type: 'results', journey, response: body as RecommendationResponse });
      return body as RecommendationResponse;
    } catch {
      if (ticket !== sequence.current) return null;
      dispatch({
        type: 'error',
        error: {
          code: 'NETWORK_ERROR',
          message: 'We could not reach the service. Your answers are still here, so you can try again.'
        }
      });
      return null;
    }
  }, []);

  const position = useCallback((journey: JourneyId) => {
    const current = stateRef.current[journey];
    return current ? screenPosition(current) : { index: 0, total: 0 };
  }, []);

  const isComplete = useCallback((journey: JourneyId) => {
    const current = stateRef.current[journey];
    return current ? journeyComplete(current) : false;
  }, []);

  const visibleIds = useCallback((journey: JourneyId) => {
    const current = stateRef.current[journey];
    return current ? visibleQuestionIds(current) : [];
  }, []);

  const value = useMemo<GuideContextValue>(
    () => ({
      ...state, start, answer, toggleOption, selectOption, setDetail, goTo, goNext, goBack,
      setFieldErrors, setFilters, submit, startCourseFromCareer, changeReusedAnswer, reset,
      position, isComplete, visibleIds
    }),
    [state, start, answer, toggleOption, selectOption, setDetail, goTo, goNext, goBack,
      setFieldErrors, setFilters, submit, startCourseFromCareer, changeReusedAnswer, reset,
      position, isComplete, visibleIds]
  );

  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}

export function useGuide(): GuideContextValue {
  const context = useContext(GuideContext);
  if (!context) throw new Error('useGuide must be used inside a GuideProvider');
  return context;
}
