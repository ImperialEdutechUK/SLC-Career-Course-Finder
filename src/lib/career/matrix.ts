/**
 * Reviewed activity-to-family matrix.
 *
 * Rows remain editorial hypotheses awaiting approval from South London College's
 * educators and career adviser. They are NOT validated occupational
 * classifications and they are NOT derived from the course catalogue.
 *
 * Version 0.2 changes two things about 0.1, and both need the same sign-off:
 *
 * 1. Associations are weighted rather than 0/1. Version 0.1 could only say that
 *    an activity did or did not belong to a family, so choosing "support people"
 *    gave three families an identical top score and the tie-break fell to
 *    alphabetical order. Three tiers now separate them: 1.0 where the activity
 *    is the centre of the work, 0.6 where it is a real part of it, 0.3 where it
 *    appears at the edges.
 *
 * 2. A third dimension reads C3, what would matter most to you in your work.
 *    Version 0.1 collected that answer and used it only to pick which sentence
 *    to show, so a learner answered a question that could not affect the result.
 *
 * Version 0.3 adds a fourth dimension for C8, appetite for change.
 *
 * Versions 0.4 and 0.5 change how the engine reads these rows, not the rows
 * themselves. From 0.5 the engine divides each of the three preference
 * dimensions by the best that row could score, so a thinly written row no longer
 * handicaps a direction for every learner. That removes the pressure to pad rows
 * with links an educator does not believe in. Write only what is true of the
 * work; a row with two honest entries is now read as fairly as one with four.
 *
 * Version 0.6 answers what measurement found. Two problems, one cause.
 *
 * No C2 activity was central to `active_personal_services`, because none of the
 * eight on offer described sport, fitness, hair and beauty or travel. And with
 * only eight activities, each linked to two to four directions, the guide could
 * produce just 47 distinct sets of three, and for 21 of the 36 possible activity
 * answers the three shown never changed however the learner answered everything
 * else.
 *
 * Padding these rows with weak links does not fix that. It was simulated first:
 * adding ten edge links at 0.3 moved the 21 to 18 and left the 47 untouched,
 * because a 0.3 link scores at most 0.9 against 2.0 for a central one and can
 * never reach the top three. Buying variety with weight means claiming an
 * activity is more central to a direction than it is, and this guide should not
 * pay in that currency.
 *
 * So C2 gained three activities instead, each one a thing a learner would
 * recognise and each with a direction it is genuinely central to:
 *
 *   health_fitness     health, fitness or appearance  -> active_personal_services
 *   work_with_numbers  numbers, money or data         -> finance_analysis
 *   work_outdoors      outdoors rather than at a desk -> animals_environment
 *
 * Two existing weights were corrected in the same pass, both stretches that
 * existed only because nothing better was on offer. `make_improve` drops from
 * 0.6 to 0.3 for `active_personal_services`, since making and improving things
 * is not really a part of that work. `work_with_numbers` is 0.3 rather than 0.6
 * for `digital_technology`, because at 0.6 it re-cut the digital and finance
 * pairing the new activity existed to separate.
 *
 * `prefer_steady` means the work changes at a slower pace. It does NOT mean the
 * work is safe from automation, and nothing in the interface may present it that
 * way. The published evidence describes broad occupation groups; these ten
 * families are editorial hypotheses, and no one has validated a correspondence
 * between the two. See docs/QUESTIONNAIRE-CHANGE-PROPOSAL.md.
 */
export const CAREER_MAP_VERSION = 'career-map-0.6.0-provisional';
export const CAREER_MAP_REVIEW_STATUS = 'provisional_awaiting_slc_editorial_approval';

/** Association strength: 1.0 central to the work, 0.6 a real part of it, 0.3 at the edges. */
export const WEIGHT_TIERS = Object.freeze({ central: 1, real: 0.6, edge: 0.3 });

export interface CareerFamilyMapping {
  id: string;
  /** C2 activity option ids, weighted. An entry above zero makes a family eligible. */
  activities: Record<string, number>;
  /** C4 daily-work option ids, weighted. */
  daily: Record<string, number>;
  /** C3 "what would matter most" option ids, weighted. */
  values: Record<string, number>;
  /** C8 appetite-for-change option ids, weighted. Pace of change, not job security. */
  pace: Record<string, number>;
}

const MATRIX: CareerFamilyMapping[] = [
  {
    id: 'care_support',
    activities: { support_people: 1, help_learning: 0.3, health_fitness: 0.6 },
    daily: { talk_people: 1, hands_on: 0.6 },
    values: { help_others: 1, fit_commitments: 0.3 },
    pace: { change_with_training: 0.6, prefer_steady: 1 }
  },
  {
    id: 'education_development',
    activities: { help_learning: 1, support_people: 0.6, explain_choices: 0.3, health_fitness: 0.3 },
    daily: { talk_people: 1, information_digital: 0.3 },
    values: { help_others: 1, progression: 0.3 },
    pace: { change_with_training: 1, prefer_steady: 0.6, keen_change: 0.3 }
  },
  {
    id: 'business_operations',
    activities: { organise_tasks: 1, solve_problems: 0.3, work_with_numbers: 0.6 },
    daily: { focus_tasks: 1, information_digital: 0.6 },
    values: { clear_routine: 0.6, progression: 0.6 },
    pace: { change_with_training: 1, keen_change: 0.6 }
  },
  {
    id: 'finance_analysis',
    activities: { solve_problems: 1, organise_tasks: 0.6, work_with_numbers: 1 },
    daily: { information_digital: 1, focus_tasks: 1 },
    values: { progression: 1, clear_routine: 0.6 },
    pace: { change_with_training: 1, keen_change: 0.6, prefer_steady: 0.3 }
  },
  {
    id: 'digital_technology',
    activities: { solve_problems: 1, make_improve: 0.6, create_ideas: 0.3, work_with_numbers: 0.3 },
    daily: { information_digital: 1, focus_tasks: 0.6 },
    values: { variety_challenge: 1, progression: 0.6, creativity: 0.3 },
    pace: { keen_change: 1, change_with_training: 0.6 }
  },
  {
    id: 'practical_technical',
    activities: { make_improve: 1, solve_problems: 0.6, animals_nature: 0.3, work_outdoors: 0.6 },
    daily: { hands_on: 1, focus_tasks: 0.6 },
    values: { variety_challenge: 0.6, clear_routine: 0.3 },
    pace: { prefer_steady: 1, change_with_training: 0.6, keen_change: 0.3 }
  },
  {
    id: 'creative_communication',
    activities: { create_ideas: 1, explain_choices: 0.6 },
    daily: { information_digital: 0.6, talk_people: 0.6 },
    values: { creativity: 1, variety_challenge: 0.6 },
    pace: { keen_change: 1, change_with_training: 0.6 }
  },
  {
    id: 'people_commercial_services',
    activities: { explain_choices: 1, organise_tasks: 0.6, support_people: 0.3 },
    daily: { talk_people: 1, information_digital: 0.6 },
    values: { progression: 0.6, variety_challenge: 0.6 },
    pace: { keen_change: 0.6, change_with_training: 0.6, prefer_steady: 0.3 }
  },
  {
    id: 'animals_environment',
    activities: { animals_nature: 1, make_improve: 0.3, work_outdoors: 1 },
    daily: { hands_on: 1, focus_tasks: 0.3 },
    values: { variety_challenge: 0.3, fit_commitments: 0.3 },
    pace: { prefer_steady: 1, change_with_training: 0.6 }
  },
  {
    id: 'active_personal_services',
    activities: { support_people: 0.6, make_improve: 0.3, help_learning: 0.3, health_fitness: 1, work_outdoors: 0.3 },
    daily: { hands_on: 1, talk_people: 0.6 },
    values: { help_others: 0.6, fit_commitments: 0.6, variety_challenge: 0.3 },
    pace: { change_with_training: 0.6, prefer_steady: 0.6, keen_change: 0.3 }
  }
];

export const CAREER_FAMILY_MATRIX: readonly CareerFamilyMapping[] = Object.freeze(MATRIX);

export function familyIds(): string[] {
  return CAREER_FAMILY_MATRIX.map(family => family.id);
}
