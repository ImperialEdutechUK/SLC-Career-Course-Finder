import type { CourseOption, ReasonCode } from '@/types/results';

/**
 * Deterministic template explanations.
 *
 * These are the complete, always-available wording. AI is optional and, when enabled,
 * may only rephrase these approved statements: it can never add a fact, a price, a
 * requirement, a link or a change of order.
 */
const REASON_TEXT: Record<ReasonCode, string> = {
  SUBJECT_MATCH: 'It is in the subject you chose.',
  SUBJECT_NARROWED: 'It is in the narrower subject area you asked for.',
  GOAL_NOT_RECORDED: 'We do not yet hold a reviewed record of what this course prepares you for.',
  EXPERIENCE_NOT_RECORDED: 'We do not yet hold a reviewed record of the starting point this course suits.',
  WORKLOAD_UNKNOWN: 'The weekly study time is not confirmed.',
  PRICE_UNKNOWN: 'The total price is not confirmed.',
  ENTRY_RULES_UNKNOWN: 'The entry requirements need checking.',
  ENTRY_RULES_MET: 'You appear to meet the entry requirements we hold.',
  ENTRY_RULE_NOT_MET: 'At least one entry requirement is not met yet.',
  REGULATED_STATUS_UNVERIFIED: 'The regulated status of this qualification is not verified.',
  EQUALLY_RELEVANT: 'It is one of several equally relevant options.'
};

const CHECK_TEXT: Record<string, string> = {
  entry_requirements: 'Entry requirements',
  total_price: 'Total price',
  weekly_study_time: 'Weekly study time',
  placement: 'Whether a work placement is required'
};

/** One short sentence saying why the course appeared, using the learner's own choice. */
export function relevanceReason(option: CourseOption, subjectLabel: string | null): string {
  if (option.reasonCodes.includes('SUBJECT_NARROWED')) {
    return `You asked for ${option.course.primarySubcategory ?? option.course.primaryCategory}, and this course is listed there.`;
  }
  if (option.reasonCodes.includes('SUBJECT_MATCH')) {
    return `You chose ${subjectLabel ?? option.course.primaryCategory}, and this course is listed in ${option.course.primarySubcategory ?? option.course.primaryCategory}.`;
  }
  return 'This course matched the preferences you gave.';
}

export function reasonText(code: ReasonCode): string {
  return REASON_TEXT[code];
}

export function checkLabel(check: string): string {
  return CHECK_TEXT[check] ?? check;
}

/** The single most important check to surface on the first card view. */
export function primaryCheck(option: CourseOption): string | null {
  const order = ['entry_requirements', 'total_price', 'placement', 'weekly_study_time'];
  const found = order.find(check => option.missingChecks.includes(check));
  return found ? checkLabel(found) : null;
}
