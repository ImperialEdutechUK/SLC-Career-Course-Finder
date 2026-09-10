import { CAREER_FAMILY_MATRIX, type CareerFamilyMapping } from './matrix';

/**
 * Career direction scoring.
 *
 *   activity(f) = 2 x SUM weight(f, a) / |A|     A = explicit C2 activities
 *   daily(f)    = 1 x SUM weight(f, d) / |D|     D = explicit C4 choices
 *   values(f)   = 1 x SUM weight(f, v) / |V|     V = explicit C3 choices
 *   pace(f)     = 0.5 x SUM weight(f, p) / |P|   P = explicit C8 choice
 *   score(f)    = activity(f) + daily(f) + values(f) + pace(f)
 *
 * Three things this keeps from version 0.1, because they are what stop the
 * scoring from overclaiming:
 *
 * - `activity(f) > 0` is still required before a direction may be ranked. What
 *   someone wants to do decides which directions are eligible; how they want to
 *   spend a day and what they value only order them. Neither can conjure a
 *   direction on its own.
 * - Every dimension is divided by how many answers the learner gave, so picking
 *   a second option never doubles a question's influence.
 * - "I'm not sure" and "a mix of activities" are stripped before scoring. They
 *   contribute nothing rather than counting as a vote for nothing.
 *
 * What changed in 0.2: weights are graded rather than 0/1, and C3 now counts.
 * What changed in 0.3: C8, appetite for change, becomes a fourth dimension.
 *
 * C8 orders directions by how fast the work changes. It is not a statement about
 * job security, and `prefer_steady` must never be presented as safe from
 * automation. Ties still stay visible. Nothing here reads the course catalogue,
 * and nothing here measures ability, personality or aptitude.
 */

export const C4_NON_ACTIVITY_IDS = Object.freeze(['mixed_activities', 'unsure']);
export const C3_NON_VALUE_IDS = Object.freeze(['unsure']);
export const C8_NON_PACE_IDS = Object.freeze(['unsure']);
export const C2_UNKNOWN_ID = 'unsure';

export interface FamilyScore {
  familyId: string;
  activity: number;
  daily: number;
  values: number;
  pace: number;
  score: number;
  matchedActivityIds: string[];
  matchedDailyIds: string[];
  matchedValueIds: string[];
  matchedPaceIds: string[];
}

export interface CareerScoringResult {
  ranked: FamilyScore[];
  broadExploration: boolean;
  topScore: number;
  tiedFamilyIds: string[];
}

function explicit(value: unknown, excluded: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(id => typeof id === 'string' && !excluded.includes(id)) as string[];
}

/** Sum of the family's weights for the ids the learner actually chose. */
function weighted(chosen: string[], weights: Record<string, number>): { total: number; matched: string[] } {
  const matched = chosen.filter(id => (weights[id] ?? 0) > 0);
  const total = matched.reduce((sum, id) => sum + weights[id], 0);
  return { total, matched };
}

function scoreFamily(
  family: CareerFamilyMapping,
  activities: string[],
  daily: string[],
  values: string[],
  pace: string[]
): FamilyScore {
  const a = weighted(activities, family.activities);
  const d = weighted(daily, family.daily);
  const v = weighted(values, family.values);
  const p = weighted(pace, family.pace);

  const activity = activities.length === 0 ? 0 : (2 * a.total) / activities.length;
  const dailyScore = daily.length === 0 ? 0 : d.total / daily.length;
  const valueScore = values.length === 0 ? 0 : v.total / values.length;
  // Half weight, and deliberately. C8 is a single select, so unlike the
  // multi-select dimensions it never gets divided by a second answer and would
  // otherwise dominate. It is also the least concrete thing asked: what someone
  // wants to do and how they want to spend a day are firmer evidence than how
  // they feel about change. Appetite orders the list; it does not decide it.
  const paceScore = pace.length === 0 ? 0 : (0.5 * p.total) / pace.length;

  return {
    familyId: family.id,
    activity,
    daily: dailyScore,
    values: valueScore,
    pace: paceScore,
    score: activity + dailyScore + valueScore + paceScore,
    matchedActivityIds: a.matched,
    matchedDailyIds: d.matched,
    matchedValueIds: v.matched,
    matchedPaceIds: p.matched
  };
}

export function scoreCareerDirections(answers: Record<string, unknown>): CareerScoringResult {
  const activities = explicit(answers.C2, [C2_UNKNOWN_ID]);
  const daily = explicit(answers.C4, C4_NON_ACTIVITY_IDS);
  const values = explicit(answers.C3, C3_NON_VALUE_IDS);
  // C8 is a single select, so it arrives as a string rather than an array.
  const pace = explicit(
    typeof answers.C8 === 'string' ? [answers.C8] : answers.C8,
    C8_NON_PACE_IDS
  );

  const scored = CAREER_FAMILY_MATRIX.map(
    family => scoreFamily(family, activities, daily, values, pace)
  );

  const ranked = scored
    .filter(item => item.activity > 0)
    // Rounded before comparison so two scores that differ only by floating-point
    // noise are treated as the tie they actually are.
    .sort((a, b) =>
      Math.round(b.score * 1e6) - Math.round(a.score * 1e6)
      || a.familyId.localeCompare(b.familyId, 'en-GB'));

  const topScore = ranked.length ? ranked[0].score : 0;
  const tiedFamilyIds = ranked
    .filter(item => Math.round(item.score * 1e6) === Math.round(topScore * 1e6))
    .map(item => item.familyId);

  return {
    ranked,
    broadExploration: activities.length === 0 || ranked.length === 0,
    topScore,
    tiedFamilyIds
  };
}

/**
 * Optional C7 clarification. It may only reorder families that are already tied, and
 * only when a reviewed scenario pair exists. `both`, `unsure` and a skip keep the tie;
 * `neither` broadens exploration. No bonus score is invented.
 */
export function applyC7(
  ranked: FamilyScore[],
  tiedFamilyIds: string[],
  scenarioPair: { scenarioAFamilyId: string; scenarioBFamilyId: string } | null,
  answer: string | null
): { ranked: FamilyScore[]; broaden: boolean } {
  if (!scenarioPair || !answer || answer === 'unsure' || answer === 'both') {
    return { ranked, broaden: false };
  }
  if (answer === 'neither') return { ranked, broaden: true };

  const preferred = answer === 'scenario_a' ? scenarioPair.scenarioAFamilyId : scenarioPair.scenarioBFamilyId;
  if (!tiedFamilyIds.includes(preferred)) return { ranked, broaden: false };

  const reordered = [...ranked].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    const aTied = tiedFamilyIds.includes(a.familyId);
    const bTied = tiedFamilyIds.includes(b.familyId);
    if (aTied && bTied) {
      if (a.familyId === preferred) return -1;
      if (b.familyId === preferred) return 1;
    }
    return a.familyId.localeCompare(b.familyId, 'en-GB');
  });
  return { ranked: reordered, broaden: false };
}
