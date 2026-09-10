import { CAREER_FAMILY_MATRIX, type CareerFamilyMapping } from './matrix';

/**
 * Career direction scoring.
 *
 *   activity(f)   = 2 x SUM weight(f, a) / |A|          A = explicit C2 activities
 *   interest(f)   = activity(f) / 2                      0 to 1, how strongly wanted
 *
 *   fit(f, q)     = (SUM weight(f, q) / |Q|) / best(f, q)  0 to 1, in each of C4, C3, C8
 *   preference(f) = 0.50 fit(f, C4) + 0.35 fit(f, C3) + 0.15 fit(f, C8)
 *
 *   score(f)      = activity(f) + interest(f) x preference(f)      0 to 3
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
 * What changed in 0.4: the other three dimensions are scaled by how strongly the
 * learner actually wants the activity, instead of being added at full value to
 * any family that scraped past the eligibility gate.
 *
 * The gate was binary, so a 0.3 edge association made a family eligible exactly
 * as much as a 1.0 central one, and preferences could then carry it to the top.
 * Someone choosing "working with animals" could be shown practical and technical
 * work above it, on the strength of day, values and pace answers, against an
 * activity score of 0.6 out of 2. Preferences should sharpen a direction the
 * learner wants, never manufacture one they barely chose.
 *
 * What changed in 0.5, and it is the more important fix of the two:
 *
 * 1. Each preference dimension is divided by the best that direction could
 *    possibly score in it, so all three read 0 to 1 and mean the same thing for
 *    every direction: how well this suits you, out of how well it ever could.
 *
 *    Before this, the raw sums were compared directly, and the ceilings were not
 *    equal. A learner who wants to work with animals and values variety could
 *    earn at most 0.30 on values, while the identical strength of fit earned
 *    0.80 for creative work. The gap was not about the learner. It was how many
 *    links an editor happened to write into that row of the matrix, and it was
 *    quietly deciding rankings. The ceilings are derived from the matrix here,
 *    not hand-written, so they cannot drift away from it.
 *
 * 2. The three dimensions are given fixed shares of one point: the day 0.50,
 *    values 0.35, appetite for change 0.15. Half weight was not enough to hold
 *    C8 to the supporting role the comment below claims for it. Being a single
 *    select, it was never divided by a second answer, and it decided which
 *    direction ranked first in 24.1% of all possible answer sets. At 0.15 of the
 *    preference term, which is itself scaled by interest, it orders directions
 *    that are otherwise close and stops there.
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

/** The most activity(f) can reach: every chosen activity central to the family. */
const MAX_ACTIVITY = 2;

/**
 * Shares of the one preference point. The day someone wants is firmer evidence
 * than what they say matters to them, which is firmer than how they feel about
 * change. They sum to 1, so score(f) never exceeds 3.
 */
export const PREFERENCE_WEIGHTS = Object.freeze({ daily: 0.5, values: 0.35, pace: 0.15 });

/** The best a family could score in one dimension, read off the matrix row. */
function ceiling(weights: Record<string, number>): number {
  const all = Object.values(weights);
  return all.length ? Math.max(...all) : 0;
}

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

/**
 * How well this family suits the answers, from 0 to 1, where 1 means no answer
 * of this shape could have suited it better. Dividing by the family's own
 * ceiling is what makes the number comparable between families.
 */
function fit(chosen: string[], weights: Record<string, number>): { value: number; matched: string[] } {
  const { total, matched } = weighted(chosen, weights);
  const best = ceiling(weights);
  if (chosen.length === 0 || best === 0) return { value: 0, matched };
  return { value: total / chosen.length / best, matched };
}

/** How many of the four dimensions contributed anything at all. */
function breadth(f: FamilyScore): number {
  return [f.activity, f.daily, f.values, f.pace].filter(v => v > 0).length;
}

function scoreFamily(
  family: CareerFamilyMapping,
  activities: string[],
  daily: string[],
  values: string[],
  pace: string[]
): FamilyScore {
  const a = weighted(activities, family.activities);
  // Activity stays an absolute quantity. It is the eligibility gate and the size
  // of the result, so what it has to say is "you picked something central to
  // this direction", which a per-family ceiling would erase.
  const activity = activities.length === 0 ? 0 : (2 * a.total) / activities.length;
  // 0 to 1: the share of the maximum possible activity score this family earned.
  const interest = activity / MAX_ACTIVITY;

  const d = fit(daily, family.daily);
  const v = fit(values, family.values);
  // The least concrete thing asked, and the only single select, so it carries
  // the smallest share. Appetite orders directions that are close; it does not
  // decide which direction the learner is shown first.
  const p = fit(pace, family.pace);

  const dailyScore = PREFERENCE_WEIGHTS.daily * d.value;
  const valueScore = PREFERENCE_WEIGHTS.values * v.value;
  const paceScore = PREFERENCE_WEIGHTS.pace * p.value;

  return {
    familyId: family.id,
    activity,
    daily: dailyScore,
    values: valueScore,
    pace: paceScore,
    score: activity + interest * (dailyScore + valueScore + paceScore),
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
      // A genuine tie is broken by how many of the four dimensions actually
      // matched. Two directions on the same score are not equally evidenced if
      // one was corroborated by three answers and the other by one. Alphabetical
      // order remains the final fallback so the result stays deterministic.
      || breadth(b) - breadth(a)
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
