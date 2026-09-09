/**
 * Reviewed activity-to-family matrix.
 *
 * Transcribed verbatim from developer_handoff.md section 5, "Proposed career mapping
 * for editorial approval". Rows are editorial hypotheses awaiting approval from SLC's
 * educators and career adviser. They are NOT validated occupational classifications
 * and they are NOT derived from the SLC course catalogue.
 *
 * Associations and compatibilities are reviewed 0/1 entries.
 */
export const CAREER_MAP_VERSION = 'career-map-0.1.0-provisional';
export const CAREER_MAP_REVIEW_STATUS = 'provisional_awaiting_slc_editorial_approval';

export interface CareerFamilyMapping {
  id: string;
  /** C2 activity option ids associated with this family. */
  activityIds: string[];
  /** C4 daily-work option ids compatible with this family. */
  compatibleDailyIds: string[];
}

export const CAREER_FAMILY_MATRIX: readonly CareerFamilyMapping[] = Object.freeze([
  { id: 'care_support', activityIds: ['support_people'], compatibleDailyIds: ['talk_people', 'hands_on'] },
  { id: 'education_development', activityIds: ['help_learning', 'support_people'], compatibleDailyIds: ['talk_people', 'hands_on'] },
  { id: 'business_operations', activityIds: ['organise_tasks'], compatibleDailyIds: ['focus_tasks', 'information_digital'] },
  { id: 'finance_analysis', activityIds: ['solve_problems', 'organise_tasks'], compatibleDailyIds: ['focus_tasks', 'information_digital'] },
  { id: 'digital_technology', activityIds: ['solve_problems', 'make_improve'], compatibleDailyIds: ['focus_tasks', 'information_digital'] },
  { id: 'practical_technical', activityIds: ['make_improve', 'solve_problems'], compatibleDailyIds: ['hands_on', 'focus_tasks'] },
  { id: 'creative_communication', activityIds: ['create_ideas', 'explain_choices'], compatibleDailyIds: ['information_digital', 'talk_people'] },
  { id: 'people_commercial_services', activityIds: ['explain_choices', 'organise_tasks'], compatibleDailyIds: ['talk_people', 'information_digital'] },
  { id: 'animals_environment', activityIds: ['animals_nature'], compatibleDailyIds: ['hands_on', 'focus_tasks'] },
  { id: 'active_personal_services', activityIds: ['support_people', 'make_improve'], compatibleDailyIds: ['hands_on', 'talk_people'] }
]);

export function familyIds(): string[] {
  return CAREER_FAMILY_MATRIX.map(family => family.id);
}
