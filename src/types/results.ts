import type { CourseDisplay } from './catalogue';

export type EntryCheckState = 'appears_to_meet' | 'check_needed' | 'pathway_needed';
export type DisplayGroup = 'start_options' | 'check_first_options' | 'future_options';
export type BudgetCheckStatus = 'not_requested' | 'within_cap' | 'check_needed';

export interface BudgetCheck {
  status: BudgetCheckStatus;
  totalGbp?: number;
  capGbp?: number;
  reason?: string;
}

/** Reason codes are server-owned. The interface renders wording from these codes. */
export type ReasonCode =
  | 'SUBJECT_MATCH'
  | 'SUBJECT_NARROWED'
  | 'GOAL_NOT_RECORDED'
  | 'EXPERIENCE_NOT_RECORDED'
  | 'WORKLOAD_UNKNOWN'
  | 'PRICE_UNKNOWN'
  | 'ENTRY_RULES_UNKNOWN'
  | 'ENTRY_RULES_MET'
  | 'ENTRY_RULE_NOT_MET'
  | 'REGULATED_STATUS_UNVERIFIED'
  | 'EQUALLY_RELEVANT';

export interface CourseOption {
  courseId: string;
  displayGroup: DisplayGroup;
  entryCheck: EntryCheckState;
  budgetCheck: BudgetCheck;
  reasonCodes: ReasonCode[];
  missingChecks: string[];
  course: CourseDisplay;
}

export interface CareerDirection {
  careerFamilyId: string;
  label: string;
  summary: string;
  whyThisAppeared: string;
  everydayActivity: string;
  thingToInvestigate: string;
  /** How work in this direction is changing, as a question to ask an employer. */
  howWorkIsChanging: string;
  nextStep: string;
  slcCoverage: 'reviewed_links_available' | 'outside_reviewed_coverage' | 'partial_reviewed_coverage';
  suggestedSubjectIds: string[];
  suggestedSubjectLabels: string[];
  /** Published course count per suggested subject, in the same order. Real data. */
  suggestedSubjectCounts: number[];
  independentGuidance: { label: string; url: string };
  tiedWith: string[];
}

export type ResultState =
  | 'career_directions'
  | 'course_options'
  | 'broad_exploration'
  | 'no_verified_match'
  | 'temporarily_unavailable';

export interface Notice { code: string; message: string }

export interface RecommendationResponse {
  requestId: string;
  versions: {
    questionnaire: string;
    catalogue: string;
    rules: string;
    careerMap: string;
  };
  state: ResultState;
  journey: 'career' | 'course';
  careerDirections?: CareerDirection[];
  courseOptions?: CourseOption[];
  futureOptions?: CourseOption[];
  totals?: { directMatches: number; pathwayMatches: number };
  allEquallyRelevant?: boolean;
  notices: Notice[];
  optionalClarification: null;
  explanationMode: 'template' | 'ai';
  resultRef: null;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    fields?: { questionId?: string; detailId?: string; code: string }[];
  };
}
