import type { AnswerValue } from '@/types/questionnaire';
import type { ApprovedCourse } from '@/types/catalogue';
import {
  CONFLICTING_SYNTHETIC, DUPLICATE_SYNTHETIC, EXPIRED_SYNTHETIC,
  MIXED_SYNTHETIC_CATALOGUE, syntheticCourse
} from './synthetic-catalogue';

/**
 * Reviewed regression scenarios.
 *
 * Each fixture states the learner input, the canonical answer ids that input must
 * produce, the expected result identifiers and ordering, the expected eligibility
 * state, what must be excluded, and what the explanation is allowed to say.
 *
 * Expected identifiers for release-catalogue fixtures are derived independently of the
 * application, in `expectedReleaseOrder`, from the engine's published ranking contract.
 * They are not copied from application output.
 */

export type FixtureGroup =
  | 'beginner' | 'returner' | 'career_changer' | 'experienced' | 'overseas_qualification'
  | 'unknown_answers' | 'tight_budget' | 'no_placement' | 'advanced_learner'
  | 'exact_requirement' | 'unsupported_career' | 'conflicting_course' | 'duplicate_course'
  | 'inactive_course' | 'expired_course' | 'missing_price' | 'missing_entry_requirement'
  | 'regulated_only' | 'all_unknown' | 'relevant_but_ineligible' | 'eligible_weak_relevance'
  | 'tied_directions' | 'changed_answers' | 'career_to_course' | 'direct_browse' | 'no_match';

interface Base {
  id: string;
  group: FixtureGroup;
  description: string;
}

export interface CareerFixture extends Base {
  kind: 'career';
  answers: Record<string, AnswerValue>;
  expect: {
    state: 'career_directions' | 'broad_exploration';
    /** Ordered family ids, calculated by hand from the handoff formula. */
    familyIds: string[];
    tiedFamilyIds?: string[];
    /** Directions that must not appear. */
    excludedFamilyIds?: string[];
    /** Substrings the explanation must contain, quoting the learner's own choices. */
    explanationContains?: string[];
    coverage?: Record<string, 'reviewed_links_available' | 'partial_reviewed_coverage' | 'outside_reviewed_coverage'>;
  };
}

export interface ReleaseCourseFixture extends Base {
  kind: 'course_release';
  answers: Record<string, AnswerValue>;
  details?: Record<string, string | number | null>;
  filters?: { regulatedOnly?: boolean; levels?: number[]; subcategoryIds?: string[] };
  expect: {
    state: 'course_options' | 'no_verified_match' | 'broad_exploration';
    /** Every returned option carries this entry state. */
    entryCheck?: 'check_needed';
    maxOptions: number;
    /** All returned prices must be unknown in this release. */
    priceUnknown?: boolean;
    /** Reason codes every option must carry. */
    reasonCodes?: string[];
    notices?: string[];
    /** Categories a returned option must belong to. */
    withinCategoryIds?: string[];
    ordering: 'engine_relevance_then_canonical_id';
  };
}

export interface SyntheticCourseFixture extends Base {
  kind: 'course_synthetic';
  catalogue: ApprovedCourse[];
  preferences: Record<string, unknown>;
  facts?: Record<string, unknown>;
  expect: {
    status: 'results' | 'no_direct_match' | 'no_match' | 'needs_clarification' | 'invalid_request';
    /** Exact ordered canonical ids in `recommendations`. */
    recommendationIds: string[];
    pathwayIds?: string[];
    /** Canonical ids that must be excluded, with the reason. */
    excluded?: Record<string, string>;
    budgetCheck?: Record<string, string>;
    eligibility?: Record<string, 'appears_to_meet' | 'check_needed' | 'pathway_needed'>;
  };
}

export type Fixture = CareerFixture | ReleaseCourseFixture | SyntheticCourseFixture;

const CAREER_BASE = {
  C1: 'start_work', C2: ['support_people'], C3: ['help_others'],
  C4: ['talk_people'], C5: 'starting_beginning', C6: 'introductory_course',
  C8: 'change_with_training'
} as Record<string, AnswerValue>;

const career = (id: string, group: FixtureGroup, description: string,
  answers: Record<string, AnswerValue>, expect: CareerFixture['expect']): CareerFixture =>
  ({ kind: 'career', id, group, description, answers: { ...CAREER_BASE, ...answers }, expect });

const COURSE_BASE = {
  F1: 'new_subject', F2: 'law', F3: 'new_to_subject', F4: null, F5: null
} as Record<string, AnswerValue>;

const course = (id: string, group: FixtureGroup, description: string,
  answers: Record<string, AnswerValue>, expect: ReleaseCourseFixture['expect'],
  extra: Partial<Pick<ReleaseCourseFixture, 'details' | 'filters'>> = {}): ReleaseCourseFixture =>
  ({ kind: 'course_release', id, group, description, answers: { ...COURSE_BASE, ...answers }, ...extra, expect });

const RELEASE_DEFAULTS = {
  state: 'course_options' as const,
  entryCheck: 'check_needed' as const,
  maxOptions: 3,
  priceUnknown: true,
  reasonCodes: ['SUBJECT_MATCH', 'ENTRY_RULES_UNKNOWN', 'PRICE_UNKNOWN', 'REGULATED_STATUS_UNVERIFIED'],
  ordering: 'engine_relevance_then_canonical_id' as const
};

export const FIXTURES: Fixture[] = [
  // ---------------------------------------------------------------- career route
  career('C-001', 'beginner', 'Supporting people, valuing helping others and talking with them puts care first',
    {}, {
      state: 'career_directions',
      familyIds: ['care_support', 'education_development', 'active_personal_services'],
      tiedFamilyIds: ['care_support'],
      explanationContains: ['helping someone feel supported', 'talking with people'],
      coverage: { care_support: 'reviewed_links_available' }
    }),

  career('C-002', 'beginner', 'Two activities that both point at education raise it above the rest',
    { C2: ['support_people', 'help_learning'] }, {
      state: 'career_directions',
      familyIds: ['education_development', 'care_support', 'active_personal_services'],
      tiedFamilyIds: ['education_development']
    }),

  career('C-003', 'tied_directions', 'Problem solving with focused work separates analysis from the rest',
    { C2: ['solve_problems'], C4: ['focus_tasks'] }, {
      state: 'career_directions',
      familyIds: ['finance_analysis', 'digital_technology', 'practical_technical'],
      tiedFamilyIds: ['finance_analysis']
    }),

  career('C-004', 'tied_directions', 'Activity and daily pull different ways and both directions stay visible',
    { C2: ['solve_problems'], C4: ['hands_on'] }, {
      state: 'career_directions',
      familyIds: ['finance_analysis', 'digital_technology', 'practical_technical'],
      tiedFamilyIds: ['finance_analysis']
    }),

  career('C-005', 'unknown_answers', 'An unsure activity answer never produces a direction',
    { C2: ['unsure'] }, { state: 'broad_exploration', familyIds: [] }),

  career('C-006', 'all_unknown', 'Every answer unknown returns broad exploration',
    { C1: 'explore_options', C2: ['unsure'], C3: ['unsure'], C4: ['unsure'], C5: 'unsure_counts', C6: 'unsure' },
    { state: 'broad_exploration', familyIds: [] }),

  career('C-007', 'unknown_answers', 'A mix answer changes wording only, never the ranking',
    { C2: ['support_people'], C4: ['mixed_activities'] }, {
      state: 'career_directions',
      familyIds: ['care_support', 'active_personal_services', 'education_development'],
      tiedFamilyIds: ['care_support'],
      explanationContains: ['a mix of activities']
    }),

  career('C-008', 'career_changer', 'A career changer wanting to organise work',
    { C1: 'change_career', C2: ['organise_tasks'], C4: ['focus_tasks'] }, {
      state: 'career_directions',
      familyIds: ['business_operations', 'finance_analysis', 'people_commercial_services']
    }),

  career('C-009', 'returner', 'A returner is not pushed down to a beginner step',
    { C1: 'return_work', C5: 'worked_related', C6: 'build_existing' }, {
      state: 'career_directions',
      familyIds: ['care_support', 'education_development', 'active_personal_services'],
      tiedFamilyIds: ['care_support'],
      explanationContains: ['helping someone feel supported']
    }),

  career('C-010', 'unsupported_career', 'Creative work is ranked even though it is thinly covered by the catalogue',
    { C2: ['create_ideas'], C4: ['information_digital'] }, {
      state: 'career_directions',
      familyIds: ['creative_communication', 'digital_technology'],
      // care_support holds no weight for create_ideas, so it stays out. Digital
      // technology now does, at the lowest tier, so it is ranked rather than excluded.
      excludedFamilyIds: ['care_support']
    }),

  career('C-011', 'unsupported_career', 'Animals and nature maps to a single direction',
    { C2: ['animals_nature'], C4: ['hands_on'] }, {
      state: 'career_directions', familyIds: ['animals_environment', 'practical_technical']
    }),

  career('C-012', 'beginner', 'Personal interest does not require a career outcome',
    { C1: 'personal_interest', C2: ['create_ideas'], C6: 'try_activity' }, {
      state: 'career_directions', familyIds: ['creative_communication', 'digital_technology']
    }),

  career('C-013', 'experienced', 'Study and work experience does not become a qualification claim',
    { C5: 'study_and_work', C6: 'compare_qualifications' }, {
      state: 'career_directions',
      familyIds: ['care_support', 'education_development', 'active_personal_services'],
      tiedFamilyIds: ['care_support']
    }),

  career('C-014', 'beginner', 'Explaining choices points at communication and services',
    { C2: ['explain_choices'], C4: ['talk_people'] }, {
      state: 'career_directions',
      familyIds: ['people_commercial_services', 'creative_communication', 'education_development']
    }),

  career('C-015', 'beginner', 'Making and improving points at practical and digital work',
    { C2: ['make_improve'], C4: ['hands_on'] }, {
      state: 'career_directions',
      familyIds: ['practical_technical', 'digital_technology', 'active_personal_services'],
      tiedFamilyIds: ['practical_technical']
    }),

  career('C-016', 'unknown_answers', 'An unsure daily answer leaves the activity ranking untouched',
    { C2: ['organise_tasks'], C4: ['unsure'] }, {
      state: 'career_directions',
      familyIds: ['business_operations', 'finance_analysis', 'people_commercial_services'],
      tiedFamilyIds: ['business_operations']
    }),

  career('C-017', 'advanced_learner', 'Wanting to compare qualifications changes the next step only',
    { C6: 'compare_qualifications' }, {
      state: 'career_directions',
      familyIds: ['care_support', 'education_development', 'active_personal_services'],
      tiedFamilyIds: ['care_support']
    }),

  career('C-018', 'beginner', 'Talking it through is offered as the next step',
    { C6: 'talk_adviser' }, {
      state: 'career_directions',
      familyIds: ['care_support', 'education_development', 'active_personal_services'],
      tiedFamilyIds: ['care_support']
    }),

  career('C-019', 'unknown_answers', 'An unsure next step still returns directions',
    { C6: 'unsure' }, {
      state: 'career_directions',
      familyIds: ['care_support', 'education_development', 'active_personal_services'],
      tiedFamilyIds: ['care_support']
    }),

  career('C-020', 'unknown_answers', 'Unsure priorities fall back to the default thing to investigate',
    { C3: ['unsure'] }, {
      state: 'career_directions',
      familyIds: ['care_support', 'education_development', 'active_personal_services'],
      tiedFamilyIds: ['care_support']
    }),

  career('C-021', 'career_changer', 'Two unrelated activities keep both directions visible',
    { C2: ['animals_nature', 'organise_tasks'], C4: ['focus_tasks'] }, {
      state: 'career_directions',
      familyIds: ['business_operations', 'animals_environment', 'finance_analysis'],
      tiedFamilyIds: ['business_operations']
    }),

  career('C-022', 'beginner', 'Digital work appears from problem solving plus digital tools',
    { C2: ['solve_problems'], C4: ['information_digital'] }, {
      state: 'career_directions',
      familyIds: ['finance_analysis', 'digital_technology', 'practical_technical'],
      tiedFamilyIds: ['finance_analysis']
    }),

  // ---------------------------------------------------- course route, real release
  course('F-001', 'beginner', 'A beginner choosing law', {}, { ...RELEASE_DEFAULTS, withinCategoryIds: ['law'] }),
  course('F-002', 'beginner', 'A beginner choosing childcare', { F2: 'childcare' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['childcare'] }),
  course('F-003', 'beginner', 'A beginner choosing IT', { F2: 'information_technology' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['information_technology'] }),
  course('F-004', 'career_changer', 'A career changer preparing for work in health and social care',
    { F1: 'prepare_work', F2: 'health_and_social_care' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['health_and_social_care'] }),
  course('F-005', 'returner', 'A returner with informal experience in business',
    { F1: 'develop_work_skills', F2: 'business_and_management', F3: 'informal_practical' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['business_and_management'] }),
  course('F-006', 'experienced', 'Someone using the skills at work already',
    { F2: 'accounting_and_finance', F3: 'current_work' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['accounting_and_finance'] }),
  course('F-007', 'advanced_learner', 'A learner with a qualification and work experience',
    { F1: 'further_study', F2: 'teaching_and_education', F3: 'qualification_and_work' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['teaching_and_education'] }),
  course('F-008', 'overseas_qualification', 'A completed related qualification whose name is unknown',
    { F2: 'science_and_engineering', F3: 'completed_related' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['science_and_engineering'] }),
  course('F-009', 'overseas_qualification', 'A named overseas qualification is recorded but never resolved to a level',
    { F2: 'science_and_engineering', F3: 'completed_related' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['science_and_engineering'] },
    { details: { previous_qualification_name: 'Higher Secondary Certificate, awarded overseas' } }),
  course('F-010', 'unknown_answers', 'Unsure about what counts drops the experience preference entirely',
    { F2: 'marketing', F3: 'unsure_counts' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['marketing'] }),
  course('F-011', 'unknown_answers', 'Unsure about the goal drops the goal preference entirely',
    { F1: 'unsure', F2: 'hospitality_management' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['hospitality_management'] }),
  course('F-012', 'tight_budget', 'A zero budget is a real cap and keeps unknown prices needing a check',
    { F2: 'law', F5: 'enter_maximum' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['law'] },
    { details: { maximum_total_price_gbp: 0 } }),
  course('F-013', 'tight_budget', 'A small budget cannot make an unknown price affordable',
    { F2: 'animal_care', F5: 'enter_maximum' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['animal_care'] },
    { details: { maximum_total_price_gbp: 150 } }),
  course('F-014', 'missing_price', 'Choosing to see all prices does not conjure a price',
    { F2: 'sports_and_fitness', F5: 'show_all_prices' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['sports_and_fitness'] }),
  course('F-015', 'missing_price', 'Asking about payment options first applies no cap',
    { F2: 'beauty_hair_and_wellbeing', F5: 'payment_options_first' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['beauty_hair_and_wellbeing'] }),
  course('F-016', 'beginner', 'Skipping the time question leaves workload unknown',
    { F2: 'employability_skills', F4: null },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['employability_skills'] }),
  course('F-017', 'beginner', 'Every study-time band is accepted and never becomes a scalar',
    { F2: 'human_resources', F4: 'under_2_hours' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['human_resources'] }),
  course('F-018', 'beginner', 'A larger study-time band behaves the same way',
    { F2: 'human_resources', F4: '9_or_more_hours' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['human_resources'] }),
  course('F-019', 'unknown_answers', 'A varying study time is an explicit unknown',
    { F2: 'coaching_and_mentoring', F4: 'varies_or_unsure' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['coaching_and_mentoring'] }),
  course('F-020', 'exact_requirement', 'A specific employer requirement without an exact match stays unknown',
    { F1: 'specific_requirement', F2: 'health_and_social_care' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['health_and_social_care'] },
    { details: { required_qualification_or_requirement_name: 'Level 3 Diploma required by my employer' } }),
  course('F-021', 'exact_requirement', 'A blank requirement name is not inferred',
    { F1: 'specific_requirement', F2: 'law' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['law'] },
    { details: { required_qualification_or_requirement_name: null } }),
  course('F-022', 'regulated_only', 'Regulated qualifications only returns nothing in this release',
    { F2: 'information_technology' },
    { state: 'no_verified_match', maxOptions: 0, ordering: 'engine_relevance_then_canonical_id',
      notices: ['NO_VERIFIED_MATCH', 'REGULATED_FILTER_APPLIED'] },
    { filters: { regulatedOnly: true } }),
  course('F-023', 'all_unknown', 'Help me explore does not rank every subject',
    { F1: 'unsure', F2: 'help_me_explore', F3: 'unsure_counts', F4: 'varies_or_unsure' },
    { state: 'broad_exploration', maxOptions: 0, ordering: 'engine_relevance_then_canonical_id',
      notices: ['NEEDS_SUBJECT'] }),
  course('F-024', 'no_match', 'An impossible level filter returns an honest empty result',
    { F2: 'animal_care' },
    { state: 'no_verified_match', maxOptions: 0, ordering: 'engine_relevance_then_canonical_id',
      notices: ['NO_VERIFIED_MATCH'] },
    { filters: { levels: [1] } }),
  course('F-025', 'beginner', 'A level filter narrows the candidates before the engine runs',
    { F2: 'business_and_management' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['business_and_management'] },
    { filters: { levels: [3] } }),
  course('F-026', 'advanced_learner', 'A level 7 filter still shows entry requirements as needing a check',
    { F2: 'business_and_management', F3: 'qualification_and_work' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['business_and_management'] },
    { filters: { levels: [7] } }),
  course('F-027', 'beginner', 'Narrowing to a subcategory changes the reason wording',
    { F2: 'business_and_management' },
    { ...RELEASE_DEFAULTS, reasonCodes: ['SUBJECT_NARROWED', 'ENTRY_RULES_UNKNOWN'], withinCategoryIds: ['business_and_management'] },
    { filters: { subcategoryIds: ['sub_business_administration'] } }),
  course('F-028', 'career_to_course', 'The subject suggested by a career direction still produces a normal shortlist',
    { F1: 'prepare_work', F2: 'teaching_and_education' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['teaching_and_education'] }),
  course('F-029', 'beginner', 'Personal interest is a valid course goal on its own',
    { F1: 'personal_interest', F2: 'animal_care' },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['animal_care'] }),
  course('F-030', 'direct_browse', 'A learner who already knows the subject skips both optional questions',
    { F2: 'law', F4: null, F5: null },
    { ...RELEASE_DEFAULTS, withinCategoryIds: ['law'] }),

  // ------------------------------------------- course route, synthetic catalogues
  {
    kind: 'course_synthetic', id: 'S-001', group: 'beginner',
    description: 'A beginner on a budget gets the cheaper open course first',
    catalogue: MIXED_SYNTHETIC_CATALOGUE,
    preferences: { categoryIds: ['business_and_management'], goal: 'new_subject', experience: 'new_to_subject', budgetGbp: 400 },
    facts: { minimumAgeConfirmed: true },
    expect: {
      status: 'results',
      recommendationIds: ['syn-open-beginner', 'syn-open-cheap', 'syn-price-unknown'],
      excluded: { 'syn-expensive': 'over_budget_cap', 'syn-other-subject': 'no_category_fit',
        'syn-inactive': 'course_inactive', 'syn-unapproved': 'course_not_approved' },
      budgetCheck: { 'syn-open-cheap': 'within_cap', 'syn-price-unknown': 'check_needed' },
      eligibility: { 'syn-open-cheap': 'appears_to_meet', 'syn-price-unknown': 'check_needed' }
    }
  },
  {
    kind: 'course_synthetic', id: 'S-002', group: 'tight_budget',
    description: 'A zero budget excludes every priced course but keeps unknown prices for checking',
    catalogue: MIXED_SYNTHETIC_CATALOGUE,
    preferences: { categoryIds: ['business_and_management'], budgetGbp: 0 },
    expect: {
      status: 'results',
      recommendationIds: ['syn-price-unknown'],
      excluded: { 'syn-open-cheap': 'over_budget_cap', 'syn-expensive': 'over_budget_cap' },
      budgetCheck: { 'syn-price-unknown': 'check_needed' }
    }
  },
  {
    kind: 'course_synthetic', id: 'S-003', group: 'missing_price',
    description: 'An unknown price is never described as within budget',
    catalogue: [MIXED_SYNTHETIC_CATALOGUE[3]],
    preferences: { categoryIds: ['business_and_management'], budgetGbp: 100000 },
    expect: {
      status: 'results', recommendationIds: ['syn-price-unknown'],
      budgetCheck: { 'syn-price-unknown': 'check_needed' }
    }
  },
  {
    kind: 'course_synthetic', id: 'S-004', group: 'no_placement',
    description: 'A learner who cannot complete a placement is not offered the course that requires one',
    catalogue: [MIXED_SYNTHETIC_CATALOGUE[5]],
    preferences: { categoryIds: ['business_and_management'] },
    facts: { canCompletePlacement: false },
    expect: { status: 'no_direct_match', recommendationIds: [], pathwayIds: ['syn-placement'],
      eligibility: { 'syn-placement': 'pathway_needed' } }
  },
  {
    kind: 'course_synthetic', id: 'S-005', group: 'no_placement',
    description: 'An unsure placement answer leaves the requirement unknown, not met',
    catalogue: [MIXED_SYNTHETIC_CATALOGUE[5]],
    preferences: { categoryIds: ['business_and_management'] },
    facts: {},
    expect: { status: 'results', recommendationIds: ['syn-placement'],
      eligibility: { 'syn-placement': 'check_needed' } }
  },
  {
    kind: 'course_synthetic', id: 'S-006', group: 'no_placement',
    description: 'Confirming a placement satisfies that one reviewed rule',
    catalogue: [MIXED_SYNTHETIC_CATALOGUE[5]],
    preferences: { categoryIds: ['business_and_management'] },
    facts: { canCompletePlacement: true },
    expect: { status: 'results', recommendationIds: ['syn-placement'],
      eligibility: { 'syn-placement': 'appears_to_meet' } }
  },
  {
    kind: 'course_synthetic', id: 'S-007', group: 'advanced_learner',
    description: 'An advanced learner meets a level prerequisite',
    catalogue: [MIXED_SYNTHETIC_CATALOGUE[4]],
    preferences: { categoryIds: ['business_and_management'], experience: 'qualification_and_work' },
    facts: { relevantQualificationLevel: 6 },
    expect: { status: 'results', recommendationIds: ['syn-gated-level'],
      eligibility: { 'syn-gated-level': 'appears_to_meet' } }
  },
  {
    kind: 'course_synthetic', id: 'S-008', group: 'beginner',
    description: 'A beginner cannot bypass a level 7 prerequisite',
    catalogue: [MIXED_SYNTHETIC_CATALOGUE[4]],
    preferences: { categoryIds: ['business_and_management'], experience: 'new_to_subject' },
    facts: { relevantQualificationLevel: 2 },
    expect: { status: 'no_direct_match', recommendationIds: [], pathwayIds: ['syn-gated-level'] }
  },
  {
    kind: 'course_synthetic', id: 'S-009', group: 'overseas_qualification',
    description: 'An unresolved overseas qualification leaves the prerequisite unknown',
    catalogue: [MIXED_SYNTHETIC_CATALOGUE[4]],
    preferences: { categoryIds: ['business_and_management'] },
    facts: {},
    expect: { status: 'results', recommendationIds: ['syn-gated-level'],
      eligibility: { 'syn-gated-level': 'check_needed' } }
  },
  {
    kind: 'course_synthetic', id: 'S-010', group: 'relevant_but_ineligible',
    description: 'A perfectly relevant course with a known failed requirement never enters the main list',
    catalogue: [syntheticCourse({
      canonical_id: 'syn-perfect-ineligible', url: 'https://example.invalid/courses/perfect',
      priceGbp: 50, hoursPerWeek: 1,
      entry_policy: { status: 'verified', rule: { fact: 'minimumAgeConfirmed', op: 'eq', value: true } }
    })],
    preferences: { categoryIds: ['business_and_management'], goal: 'new_subject', experience: 'new_to_subject', hoursPerWeek: 20, budgetGbp: 9000 },
    facts: { minimumAgeConfirmed: false },
    expect: { status: 'no_direct_match', recommendationIds: [], pathwayIds: ['syn-perfect-ineligible'] }
  },
  {
    kind: 'course_synthetic', id: 'S-011', group: 'eligible_weak_relevance',
    description: 'A course meeting entry rules but matching only the subject still ranks below a stronger fit',
    catalogue: [
      syntheticCourse({ canonical_id: 'syn-weak', url: 'https://example.invalid/courses/weak', goals: ['further_study'], experienceFit: ['current_work'],
        entry_policy: { status: 'verified', rule: { fact: 'minimumAgeConfirmed', op: 'eq', value: true } } }),
      syntheticCourse({ canonical_id: 'syn-strong', url: 'https://example.invalid/courses/strong', goals: ['new_subject'], experienceFit: ['new_to_subject'],
        entry_policy: { status: 'verified', rule: { fact: 'minimumAgeConfirmed', op: 'eq', value: true } } })
    ],
    preferences: { categoryIds: ['business_and_management'], goal: 'new_subject', experience: 'new_to_subject' },
    facts: { minimumAgeConfirmed: true },
    expect: { status: 'results', recommendationIds: ['syn-strong', 'syn-weak'] }
  },
  {
    kind: 'course_synthetic', id: 'S-012', group: 'conflicting_course',
    description: 'Conflicting canonical duplicates are quarantined in full',
    catalogue: CONFLICTING_SYNTHETIC,
    preferences: { categoryIds: ['business_and_management'] },
    expect: { status: 'no_match', recommendationIds: [], excluded: { 'syn-conflict': 'conflicting_duplicate' } }
  },
  {
    kind: 'course_synthetic', id: 'S-013', group: 'duplicate_course',
    description: 'Identical duplicate import rows collapse to one recommendation',
    catalogue: DUPLICATE_SYNTHETIC,
    preferences: { categoryIds: ['business_and_management'] },
    expect: { status: 'results', recommendationIds: ['syn-duplicate'] }
  },
  {
    kind: 'course_synthetic', id: 'S-014', group: 'inactive_course',
    description: 'A withdrawn course is excluded even when it is the only subject match',
    catalogue: [MIXED_SYNTHETIC_CATALOGUE[6]],
    preferences: { categoryIds: ['business_and_management'] },
    expect: { status: 'no_match', recommendationIds: [], excluded: { 'syn-inactive': 'course_inactive' } }
  },
  {
    kind: 'course_synthetic', id: 'S-015', group: 'expired_course',
    description: 'An expired field review removes the course until it is refreshed',
    catalogue: [EXPIRED_SYNTHETIC],
    preferences: { categoryIds: ['business_and_management'] },
    expect: { status: 'no_match', recommendationIds: [], excluded: { 'syn-expired': 'field_expired: priceGbp' } }
  },
  {
    kind: 'course_synthetic', id: 'S-016', group: 'missing_entry_requirement',
    description: 'An unknown entry policy produces a check, never a pass',
    catalogue: [syntheticCourse({ canonical_id: 'syn-no-policy', url: 'https://example.invalid/courses/no-policy', entry_policy: { status: 'unknown' } })],
    preferences: { categoryIds: ['business_and_management'] },
    expect: { status: 'results', recommendationIds: ['syn-no-policy'], eligibility: { 'syn-no-policy': 'check_needed' } }
  },
  {
    kind: 'course_synthetic', id: 'S-017', group: 'regulated_only',
    description: 'Only a verified regulated qualification passes the regulated filter',
    catalogue: MIXED_SYNTHETIC_CATALOGUE,
    preferences: { categoryIds: ['business_and_management'], regulatedOnly: true },
    expect: {
      status: 'results', recommendationIds: ['syn-regulated'],
      excluded: { 'syn-open-cheap': 'regulated_status_not_verified' }
    }
  },
  {
    kind: 'course_synthetic', id: 'S-018', group: 'all_unknown',
    description: 'No subject and no approved specific goal cannot produce a ranking',
    catalogue: MIXED_SYNTHETIC_CATALOGUE,
    preferences: {},
    expect: { status: 'needs_clarification', recommendationIds: [] }
  },
  {
    kind: 'course_synthetic', id: 'S-019', group: 'no_match',
    description: 'A subject with no approved course returns an honest empty result',
    catalogue: MIXED_SYNTHETIC_CATALOGUE,
    preferences: { categoryIds: ['law'] },
    expect: { status: 'no_match', recommendationIds: [] }
  },
  {
    kind: 'course_synthetic', id: 'S-020', group: 'no_match',
    description: 'Nothing is promoted merely to fill three slots',
    catalogue: [MIXED_SYNTHETIC_CATALOGUE[0]],
    preferences: { categoryIds: ['business_and_management'], goal: 'new_subject', experience: 'new_to_subject' },
    facts: { minimumAgeConfirmed: true },
    expect: { status: 'results', recommendationIds: ['syn-open-beginner'] }
  },
  {
    kind: 'course_synthetic', id: 'S-021', group: 'experienced',
    description: 'An experienced learner matching goal and experience outranks a partial match',
    catalogue: [
      syntheticCourse({ canonical_id: 'syn-exp-a', url: 'https://example.invalid/courses/exp-a', goals: ['develop_work_skills'], experienceFit: ['current_work'] }),
      syntheticCourse({ canonical_id: 'syn-exp-b', url: 'https://example.invalid/courses/exp-b', goals: ['develop_work_skills'], experienceFit: ['new_to_subject'] })
    ],
    preferences: { categoryIds: ['business_and_management'], goal: 'develop_work_skills', experience: 'current_work' },
    expect: { status: 'results', recommendationIds: ['syn-exp-a', 'syn-exp-b'] }
  },
  {
    kind: 'course_synthetic', id: 'S-022', group: 'tight_budget',
    description: 'A workload preference is a relevance signal, never an exclusion',
    catalogue: [
      syntheticCourse({ canonical_id: 'syn-hours-fits', url: 'https://example.invalid/courses/fits', hoursPerWeek: 2 }),
      syntheticCourse({ canonical_id: 'syn-hours-over', url: 'https://example.invalid/courses/over', hoursPerWeek: 20 })
    ],
    preferences: { categoryIds: ['business_and_management'], hoursPerWeek: 4 },
    expect: { status: 'results', recommendationIds: ['syn-hours-fits', 'syn-hours-over'] }
  },
  {
    kind: 'course_synthetic', id: 'S-023', group: 'missing_entry_requirement',
    description: 'A course record missing a required review is excluded rather than served',
    catalogue: [(() => {
      const c = syntheticCourse({ canonical_id: 'syn-no-review', url: 'https://example.invalid/courses/no-review' });
      delete (c.field_reviews as Record<string, unknown>).url;
      return c;
    })()],
    preferences: { categoryIds: ['business_and_management'] },
    expect: { status: 'no_match', recommendationIds: [],
      excluded: { 'syn-no-review': 'field_review_missing_or_conflicting: url' } }
  },
  {
    kind: 'course_synthetic', id: 'S-024', group: 'direct_browse',
    description: 'A non-approved destination host is refused',
    catalogue: [syntheticCourse({ canonical_id: 'syn-bad-host', url: 'https://not-the-college.invalid/courses/x' })],
    preferences: { categoryIds: ['business_and_management'] },
    expect: { status: 'no_match', recommendationIds: [], excluded: { 'syn-bad-host': 'url_host_not_allowed' } }
  },
  {
    kind: 'course_synthetic', id: 'S-025', group: 'direct_browse',
    description: 'A plain HTTP destination is refused',
    catalogue: [syntheticCourse({ canonical_id: 'syn-http', url: 'http://example.invalid/courses/x' })],
    preferences: { categoryIds: ['business_and_management'] },
    expect: { status: 'no_match', recommendationIds: [], excluded: { 'syn-http': 'url_invalid' } }
  },
  {
    kind: 'course_synthetic', id: 'S-026', group: 'exact_requirement',
    description: 'A specific goal cannot anchor ranking without a server allowlist entry',
    catalogue: [syntheticCourse({ canonical_id: 'syn-specific', url: 'https://example.invalid/courses/specific', goals: ['specific_requirement'] })],
    preferences: { goal: 'specific_requirement' },
    expect: { status: 'needs_clarification', recommendationIds: [] }
  },
  {
    kind: 'course_synthetic', id: 'S-027', group: 'no_match',
    description: 'At most three recommendations are returned however many match',
    catalogue: Array.from({ length: 8 }, (_, index) => syntheticCourse({
      canonical_id: `syn-many-${index}`, url: `https://example.invalid/courses/many-${index}`
    })),
    preferences: { categoryIds: ['business_and_management'] },
    expect: { status: 'results', recommendationIds: ['syn-many-0', 'syn-many-1', 'syn-many-2'] }
  },
  {
    kind: 'course_synthetic', id: 'S-028', group: 'changed_answers',
    description: 'Adding a budget cap changes the shortlist deterministically',
    catalogue: MIXED_SYNTHETIC_CATALOGUE,
    preferences: { categoryIds: ['business_and_management'], budgetGbp: 200 },
    expect: {
      status: 'results',
      recommendationIds: ['syn-open-cheap', 'syn-price-unknown'],
      excluded: { 'syn-open-beginner': 'over_budget_cap' }
    }
  },
  {
    kind: 'course_synthetic', id: 'S-029', group: 'career_changer',
    description: 'Selecting two subjects scores the proportion matched',
    catalogue: [
      syntheticCourse({ canonical_id: 'syn-both', url: 'https://example.invalid/courses/both', categoryIds: ['business_and_management', 'marketing'] }),
      syntheticCourse({ canonical_id: 'syn-one', url: 'https://example.invalid/courses/one', categoryIds: ['business_and_management'] })
    ],
    preferences: { categoryIds: ['business_and_management', 'marketing'] },
    expect: { status: 'results', recommendationIds: ['syn-both', 'syn-one'] }
  },
  {
    kind: 'course_synthetic', id: 'S-030', group: 'unknown_answers',
    description: 'A course with no reviewed goal tag scores zero on that dimension but keeps its weight',
    catalogue: [syntheticCourse({ canonical_id: 'syn-no-goal', url: 'https://example.invalid/courses/no-goal', goals: null })],
    preferences: { categoryIds: ['business_and_management'], goal: 'new_subject' },
    expect: { status: 'results', recommendationIds: ['syn-no-goal'] }
  }
];

export const FIXTURE_GROUPS: FixtureGroup[] = [
  'beginner', 'returner', 'career_changer', 'experienced', 'overseas_qualification',
  'unknown_answers', 'tight_budget', 'no_placement', 'advanced_learner', 'exact_requirement',
  'unsupported_career', 'conflicting_course', 'duplicate_course', 'inactive_course',
  'expired_course', 'missing_price', 'missing_entry_requirement', 'regulated_only',
  'all_unknown', 'relevant_but_ineligible', 'eligible_weak_relevance', 'tied_directions',
  'changed_answers', 'career_to_course', 'direct_browse', 'no_match'
];
