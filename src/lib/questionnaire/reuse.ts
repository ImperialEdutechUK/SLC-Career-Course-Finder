import type { JourneyState } from '@/types/questionnaire';
import { reuseRule } from './index';

export interface ReuseOutcome {
  targetQuestionId: string;
  action: 'reuse' | 'ask';
  targetAnswerId: string | null;
  reason: string;
  sourceQuestionId: string;
  sourceAnswerId: string | null;
}

/**
 * Career -> course answer reuse. Both rules are read from questionnaire.json; this
 * module only evaluates the configured conditions. Nothing is defaulted, and an
 * unmapped or condition-failing source always asks the question again.
 */
export function evaluateReuse(
  career: JourneyState,
  confirmedSubjectId: string | undefined
): ReuseOutcome[] {
  const outcomes: ReuseOutcome[] = [];

  // C1 -> F1. Applies whenever the source answer has an explicit `reuse` mapping.
  const purpose = reuseRule('career_purpose_to_course_goal');
  const c1 = typeof career.answers.C1 === 'string' ? career.answers.C1 : null;
  const purposeMapping = purpose.mapping.find(item => item.sourceAnswerId === c1);
  outcomes.push({
    targetQuestionId: purpose.targetQuestionId,
    sourceQuestionId: purpose.sourceQuestionId,
    sourceAnswerId: c1,
    action: purposeMapping?.action === 'reuse' ? 'reuse' : 'ask',
    targetAnswerId: purposeMapping?.action === 'reuse' ? purposeMapping.targetAnswerId : null,
    reason: purposeMapping?.reason ?? purpose.onMissingOrUnmappedSource
  });

  // C5 -> F3. Every configured condition must hold. The career route asks C5 about
  // "the areas that interest you", which is normally not one specific subject, so
  // this rule usually asks F3 again. That is the intended conservative behaviour.
  const experience = reuseRule('career_experience_to_course_experience');
  const c5 = typeof career.answers.C5 === 'string' ? career.answers.C5 : null;
  const experienceMapping = experience.mapping.find(item => item.sourceAnswerId === c5);
  const subjectId = career.context.careerExperienceSubjectId;
  const conditionsMet =
    Boolean(subjectId) &&
    career.context.careerExperienceSubjectWasSpecific === true &&
    Boolean(confirmedSubjectId) &&
    subjectId === confirmedSubjectId;

  outcomes.push({
    targetQuestionId: experience.targetQuestionId,
    sourceQuestionId: experience.sourceQuestionId,
    sourceAnswerId: c5,
    action: conditionsMet && experienceMapping?.action === 'reuse' ? 'reuse' : 'ask',
    targetAnswerId: conditionsMet && experienceMapping?.action === 'reuse' ? experienceMapping.targetAnswerId : null,
    reason: !conditionsMet
      ? (experience.onAnyConditionFalse ?? 'Ask F3 in the selected subject.')
      : (experienceMapping?.reason ?? experience.onMissingOrUnmappedSource)
  });

  return outcomes;
}

/**
 * Invalidation. Changing a source answer or the confirmed subject clears anything
 * that depended on it, so a stale reused answer can never survive into a result.
 */
export function invalidateAfterChange(
  state: JourneyState,
  changedQuestionId: string
): JourneyState {
  const next: JourneyState = {
    ...state,
    answers: { ...state.answers },
    details: { ...state.details },
    answerOrigin: { ...state.answerOrigin },
    context: { ...state.context }
  };

  if (changedQuestionId === 'F2') {
    // Subject changed: clear subject-dependent experience, its optional qualification
    // detail and the optional requirement branch.
    next.answers.F3 = null;
    next.answers.F6 = null;
    delete next.answerOrigin.F3;
    next.details.previous_qualification_name = null;
    delete next.context.requirementRuleId;
  }
  if (changedQuestionId === 'F1') {
    const f1 = next.answers.F1;
    if (f1 !== 'specific_requirement') next.details.required_qualification_or_requirement_name = null;
    delete next.answerOrigin.F1;
  }
  if (changedQuestionId === 'F3') {
    const f3 = next.answers.F3;
    if (f3 !== 'completed_related' && f3 !== 'qualification_and_work') {
      next.details.previous_qualification_name = null;
    }
    delete next.answerOrigin.F3;
  }
  if (changedQuestionId === 'F5') {
    if (next.answers.F5 !== 'enter_maximum') next.details.maximum_total_price_gbp = null;
  }
  if (changedQuestionId === 'C1' || changedQuestionId === 'C5') {
    // Career sources changed: any answer reused from them is no longer valid.
    for (const [questionId, origin] of Object.entries(next.answerOrigin)) {
      if (origin.kind === 'reused' && origin.sourceQuestionId === changedQuestionId) {
        next.answers[questionId] = null;
        delete next.answerOrigin[questionId];
      }
    }
  }
  next.updatedAt = new Date().toISOString();
  return next;
}
