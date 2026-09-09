import { CAREER_FAMILY_MATRIX, type CareerFamilyMapping } from './matrix';

/**
 * Career direction scoring, implementing developer_handoff.md section 5 exactly:
 *
 *   activity(f) = 0 when A is empty, otherwise 2 x SUM association(f,a) / |A|
 *   daily(f)    = 0 when D is empty, otherwise 1 x SUM compatibility(f,d) / |D|
 *   score(f)    = activity(f) + daily(f)
 *
 *   A = explicit selected C2 activities
 *   D = explicit selected C4 choices, excluding mixed_activities and unsure
 *
 * `activity(f) > 0` is required before a direction may be ranked: C4 alone can never
 * create one. Ties stay visible. Nothing here reads the course catalogue, and nothing
 * here measures ability, personality or aptitude.
 */

export const C4_NON_ACTIVITY_IDS = Object.freeze(['mixed_activities', 'unsure']);
export const C2_UNKNOWN_ID = 'unsure';

export interface FamilyScore {
  familyId: string;
  activity: number;
  daily: number;
  score: number;
  matchedActivityIds: string[];
  matchedDailyIds: string[];
}

export interface CareerScoringResult {
  /** Positively evidenced directions, highest score first, ties preserved in order. */
  ranked: FamilyScore[];
  /** True when the learner gave no explicit activity signal at all. */
  broadExploration: boolean;
  /** Score of the top group, used to identify a material tie. */
  topScore: number;
  /** Family ids sharing the top score. */
  tiedFamilyIds: string[];
}

function explicitActivities(c2: unknown): string[] {
  if (!Array.isArray(c2)) return [];
  return c2.filter(id => typeof id === 'string' && id !== C2_UNKNOWN_ID) as string[];
}

function explicitDaily(c4: unknown): string[] {
  if (!Array.isArray(c4)) return [];
  return c4.filter(
    id => typeof id === 'string' && !C4_NON_ACTIVITY_IDS.includes(id)
  ) as string[];
}

function scoreFamily(family: CareerFamilyMapping, activities: string[], daily: string[]): FamilyScore {
  const matchedActivityIds = activities.filter(id => family.activityIds.includes(id));
  const matchedDailyIds = daily.filter(id => family.compatibleDailyIds.includes(id));

  // Normalisation stops a second selection doubling a question's contribution.
  const activity = activities.length === 0 ? 0 : (2 * matchedActivityIds.length) / activities.length;
  const dailyScore = daily.length === 0 ? 0 : (1 * matchedDailyIds.length) / daily.length;

  return {
    familyId: family.id,
    activity,
    daily: dailyScore,
    score: activity + dailyScore,
    matchedActivityIds,
    matchedDailyIds
  };
}

export function scoreCareerDirections(answers: Record<string, unknown>): CareerScoringResult {
  const activities = explicitActivities(answers.C2);
  const daily = explicitDaily(answers.C4);

  const scored = CAREER_FAMILY_MATRIX.map(family => scoreFamily(family, activities, daily));

  // An explicit activity signal is required before a direction is ranked.
  const ranked = scored
    .filter(item => item.activity > 0)
    .sort((a, b) => b.score - a.score || a.familyId.localeCompare(b.familyId, 'en-GB'));

  const topScore = ranked.length ? ranked[0].score : 0;
  const tiedFamilyIds = ranked.filter(item => item.score === topScore).map(item => item.familyId);

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
