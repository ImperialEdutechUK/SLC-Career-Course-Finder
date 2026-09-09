import type { CourseDisplay } from '@/types/catalogue';
import type { CourseOption, DisplayGroup, EntryCheckState, ReasonCode } from '@/types/results';

/**
 * Engine result -> learner-facing options.
 *
 * The engine decides which courses qualify and in what order. This module only
 * decides how to present what the engine returned. It never re-ranks by a rule of
 * its own, never exposes `relevanceScore`, and never turns a check into a pass.
 */

export interface EngineResultItem {
  canonicalId: string;
  title: string;
  url: string;
  qualificationStatus: string;
  relevanceScore: number | null;
  points: number;
  denominator: number;
  dimensions: { dimension: string; weight: number; points: number }[];
  warnings: string[];
  eligibility: { status: string; reason: string; checks: unknown[] };
  budgetCheck: { status: string; totalGbp?: number; capGbp?: number; reason?: string };
}

export interface EngineResponse {
  engineVersion: string;
  status: 'results' | 'no_direct_match' | 'no_match' | 'needs_clarification' | 'invalid_request';
  recommendations: EngineResultItem[];
  pathways: EngineResultItem[];
  excluded: { canonicalId?: string; reasons: string[] }[];
  warnings: string[];
  totalDirectMatches: number;
  totalPathwayMatches: number;
  evaluatedAt?: string;
  errors?: string[];
}

const ENTRY_STATES: Record<string, EntryCheckState> = {
  appears_to_meet: 'appears_to_meet',
  check_needed: 'check_needed',
  pathway_needed: 'pathway_needed'
};

function entryCheck(status: string): EntryCheckState {
  return ENTRY_STATES[status] ?? 'check_needed';
}

/**
 * `appears_to_meet` may only enter start_options once the price check is also
 * resolved. An unresolved price keeps a course in "Entry requirements to check".
 */
function displayGroup(item: EngineResultItem): DisplayGroup {
  const entry = entryCheck(item.eligibility.status);
  if (entry === 'pathway_needed') return 'future_options';
  if (entry === 'appears_to_meet' && item.budgetCheck.status !== 'check_needed') return 'start_options';
  return 'check_first_options';
}

function reasonCodes(item: EngineResultItem, course: CourseDisplay, narrowed: boolean): ReasonCode[] {
  const codes: ReasonCode[] = [];
  const matchedCategory = item.dimensions.some(d => d.dimension === 'category' && d.points > 0);
  if (matchedCategory) codes.push(narrowed ? 'SUBJECT_NARROWED' : 'SUBJECT_MATCH');
  if (item.warnings.includes('course_field_missing: goal')) codes.push('GOAL_NOT_RECORDED');
  if (item.warnings.includes('course_field_missing: experience')) codes.push('EXPERIENCE_NOT_RECORDED');
  // An unknown price or workload is a fact about the course. It is reported whether or
  // not the learner set a cap, so the card can never imply the figure is known.
  if (course.hoursPerWeek === null) codes.push('WORKLOAD_UNKNOWN');
  if (course.priceGbp === null || item.budgetCheck.status === 'check_needed') codes.push('PRICE_UNKNOWN');
  const entry = entryCheck(item.eligibility.status);
  if (entry === 'check_needed') codes.push('ENTRY_RULES_UNKNOWN');
  if (entry === 'appears_to_meet') codes.push('ENTRY_RULES_MET');
  if (entry === 'pathway_needed') codes.push('ENTRY_RULE_NOT_MET');
  if (item.qualificationStatus !== 'regulated_verified') codes.push('REGULATED_STATUS_UNVERIFIED');
  return codes;
}

function missingChecks(item: EngineResultItem, course: CourseDisplay): string[] {
  const checks: string[] = [];
  if (entryCheck(item.eligibility.status) === 'check_needed') checks.push('entry_requirements');
  if (course.priceGbp === null) checks.push('total_price');
  if (course.hoursPerWeek === null) checks.push('weekly_study_time');
  if (course.placementRequired === null) checks.push('placement');
  return checks;
}

export function toCourseOption(
  item: EngineResultItem,
  course: CourseDisplay,
  narrowed: boolean
): CourseOption {
  return {
    courseId: item.canonicalId,
    displayGroup: displayGroup(item),
    entryCheck: entryCheck(item.eligibility.status),
    budgetCheck: {
      status: item.budgetCheck.status as CourseOption['budgetCheck']['status'],
      totalGbp: item.budgetCheck.totalGbp,
      capGbp: item.budgetCheck.capGbp,
      reason: item.budgetCheck.reason
    },
    reasonCodes: reasonCodes(item, course, narrowed),
    missingChecks: missingChecks(item, course),
    course
  };
}

/**
 * Explicit diversity rule.
 *
 * The engine returns at most three recommendations and three pathways. The presenter
 * shows at most three options overall rather than six cards. Where the engine has
 * placed courses in the order it chose, this only *selects* from that order: it walks
 * the engine's list front to back and skips a course that repeats a subcategory or a
 * level already shown, unless skipping would leave fewer than the available options.
 * It never promotes a lower-ranked course above a higher-ranked one.
 */
export function applyDiversityRule(options: CourseOption[], limit = 3): CourseOption[] {
  if (options.length <= limit) return options;
  const chosen: CourseOption[] = [];
  const seenSubcategories = new Set<string>();
  // An unknown level is its own bucket: two courses in one subject that both leave the
  // level unstated are the most likely to be near-identical awards.
  const seenLevels = new Set<number | 'unknown'>();
  const skipped: CourseOption[] = [];

  for (const option of options) {
    if (chosen.length >= limit) break;
    const subcategory = option.course.primarySubcategory ?? option.course.primaryCategory;
    const level: number | 'unknown' = option.course.level ?? 'unknown';
    if (seenSubcategories.has(subcategory) && seenLevels.has(level)) {
      skipped.push(option);
      continue;
    }
    chosen.push(option);
    seenSubcategories.add(subcategory);
    seenLevels.add(level);
  }
  for (const option of skipped) {
    if (chosen.length >= limit) break;
    chosen.push(option);
  }
  return chosen;
}

/** True when every shown option carries the same relevance, so no order is implied. */
export function allEquallyRelevant(items: EngineResultItem[]): boolean {
  if (items.length < 2) return false;
  const first = items[0].relevanceScore;
  return items.every(item => item.relevanceScore === first);
}
