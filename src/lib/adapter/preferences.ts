import type { AnswerValue } from '@/types/questionnaire';

/**
 * Questionnaire answers -> reference engine request.
 *
 * The mapping is the "proposed registry mapping" table in developer_handoff.md §5.
 * Stable questionnaire ids are used as engine identifiers so their meaning stays
 * inspectable. Nothing is defaulted and nothing is inferred:
 *
 *   F1 unsure        -> goal omitted (no positive goal evidence)
 *   F3 unsure_counts -> experience omitted (no positive experience evidence)
 *   F4 any band      -> hoursPerWeek omitted (a band is not a scalar)
 *   F5 no amount     -> budgetGbp omitted (no cap; zero is a real cap)
 */

export interface EnginePreferences {
  categoryIds?: string[];
  goal?: string;
  experience?: string;
  hoursPerWeek?: number;
  budgetGbp?: number;
  regulatedOnly?: boolean;
}

export interface EngineRequest {
  preferences: EnginePreferences;
  facts: Record<string, string | number | boolean | null>;
}

/** F4 bands stay intervals. `null` upper bound means open-ended. */
export const WORKLOAD_BANDS: Record<string, { lower: number; upper: number | null; upperOpen: boolean; label: string }> = {
  under_2_hours: { lower: 0, upper: 2, upperOpen: true, label: 'Less than 2 hours a week' },
  '2_to_4_hours': { lower: 2, upper: 4, upperOpen: false, label: '2 to 4 hours a week' },
  '5_to_8_hours': { lower: 5, upper: 8, upperOpen: false, label: '5 to 8 hours a week' },
  '9_or_more_hours': { lower: 9, upper: null, upperOpen: false, label: '9 hours or more a week' }
};

export type WorkloadFit = 'fits_entire_band' | 'exceeds_entire_band' | 'depends_on_available_time' | 'unknown';

/**
 * Interval workload comparison, the production extension described in the handoff.
 * Unknown course workload or unknown learner time stays unknown.
 */
export function workloadFit(bandId: string | null, courseHoursPerWeek: number | null): WorkloadFit {
  if (!bandId || courseHoursPerWeek === null) return 'unknown';
  const band = WORKLOAD_BANDS[bandId];
  if (!band) return 'unknown';
  if (courseHoursPerWeek <= band.lower) return 'fits_entire_band';
  if (band.upper === null) return 'depends_on_available_time';
  if (band.upperOpen ? courseHoursPerWeek >= band.upper : courseHoursPerWeek > band.upper) {
    return 'exceeds_entire_band';
  }
  return 'depends_on_available_time';
}

function asString(value: AnswerValue | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export interface AdapterInput {
  answers: Record<string, AnswerValue>;
  details: Record<string, string | number | null>;
  /** Confirmed subject identifiers, already resolved against the published taxonomy. */
  categoryIds: string[];
  filters: { regulatedOnly: boolean };
}

export function buildEngineRequest(input: AdapterInput): EngineRequest {
  const preferences: EnginePreferences = {};

  if (input.categoryIds.length) preferences.categoryIds = [...new Set(input.categoryIds)];

  const f1 = asString(input.answers.F1);
  if (f1 && f1 !== 'unsure') preferences.goal = f1;

  const f3 = asString(input.answers.F3);
  if (f3 && f3 !== 'unsure_counts') preferences.experience = f3;

  // F4 is never converted to a scalar. Workload is reported as a separate check.

  const f5 = asString(input.answers.F5);
  const amount = input.details.maximum_total_price_gbp;
  if (f5 === 'enter_maximum' && typeof amount === 'number' && Number.isFinite(amount)) {
    // Zero is a real cap, preserved exactly.
    preferences.budgetGbp = amount;
  }

  if (input.filters.regulatedOnly) preferences.regulatedOnly = true;

  /**
   * Facts are learner-reported evidence for reviewed entry rules only.
   * F1/F3 answers are relevance signals and never become prior-award, age or
   * profession-registration facts, so no fact is derived from them.
   * F6 supplies exactly one reviewed rule's fact when that branch is enabled.
   */
  const facts: Record<string, string | number | boolean | null> = {};

  return { preferences, facts };
}

/**
 * F6 answer -> the single reviewed requirement fact.
 * yes -> true, no -> false, unsure or skipped -> unknown (the key is omitted).
 */
export function applyRequirementFact(
  facts: Record<string, string | number | boolean | null>,
  requirementKey: string | null,
  answer: string | null
): Record<string, string | number | boolean | null> {
  if (!requirementKey || !answer || answer === 'unsure') return facts;
  if (answer === 'yes') return { ...facts, [requirementKey]: true };
  if (answer === 'no') return { ...facts, [requirementKey]: false };
  return facts;
}
