/**
 * PROVISIONAL EDITORIAL CONTENT FOR CAREER DIRECTIONS.
 *
 * Awaiting approval by SLC's educators and career adviser (developer_handoff.md §5,
 * SLC_Service_Blueprint.md "Career questionnaire"). Every string here is written as
 * exploration wording:
 *
 *   - no salary, vacancy, employment-rate or job-security claim
 *   - no statement that a learner is suited to, or qualified for, any occupation
 *   - "everyday activity" says what someone in the area *may* do
 *   - "investigate" is always something for the learner to check for themselves
 *
 * Occupation facts belong to the National Careers Service and the relevant
 * professional body, which is where each direction sends the learner.
 */
import type { JourneyId } from '@/types/questionnaire';

export const CAREER_CONTENT_VERSION = 'career-content-0.1.0-provisional';

const NATIONAL_CAREERS = {
  label: 'Explore this area on the National Careers Service',
  url: 'https://nationalcareers.service.gov.uk/explore-careers'
};

export interface CareerFamilyContent {
  id: string;
  label: string;
  summary: string;
  everydayActivity: string;
  /** Default thing to investigate, used when C3 gives no more specific prompt. */
  investigate: string;
  /** Things to investigate prompted by a C3 priority. */
  investigateByPriority: Record<string, string>;
  /**
   * How work in this direction is changing, written as a question to put to an
   * employer rather than a prediction. The guide holds no evidence about which
   * jobs automation will or will not replace, and a forecast aimed at someone
   * anxious about their livelihood would be worse than no answer. What it can
   * do is tell them exactly what to go and ask.
   */
  changing: string;
  /** Category ids in the published SLC catalogue related to this direction. */
  suggestedSubjectIds: string[];
  independentGuidance: { label: string; url: string };
}

export const CAREER_FAMILY_CONTENT: Record<string, CareerFamilyContent> = {
  care_support: {
    id: 'care_support',
    label: 'Care and support',
    summary: 'Roles that help people manage everyday life, health or wellbeing.',
    everydayActivity: 'A care worker may help someone with everyday routines, meals and appointments.',
    investigate: 'Check what personal-care tasks a real role involves, what the shift pattern is, and which parts of the job employers expect to stay hands-on.',
    investigateByPriority: {
      fit_commitments: 'Check the shift pattern before you commit, because care rotas often include evenings and weekends.',
      clear_routine: 'Check how much of a typical shift is a set routine and how much changes day to day.',
      progression: 'Ask employers what a supervisory or specialist route actually looks like in their service.',
      help_others: 'Check the emotional demands of the role and what support the employer provides.',
      variety_challenge: 'Check how varied the caseload is, because some services are far more repetitive than others.',
      creativity: 'Check whether the service offers activity, wellbeing or engagement work as well as personal care.'
    },
    changing: 'Ask employers which parts of the role digital records and remote monitoring now cover, and which remain hands-on.',
    suggestedSubjectIds: ['health_and_social_care'],
    independentGuidance: NATIONAL_CAREERS
  },
  education_development: {
    id: 'education_development',
    label: 'Education and learner support',
    summary: 'Roles that help children, young people or adults learn.',
    everydayActivity: 'A teaching assistant may prepare materials and support a small group during a lesson.',
    investigate: 'Check which roles need a specific qualification or a background check, and ask how teaching teams are using new tools day to day.',
    investigateByPriority: {
      fit_commitments: 'Check the working pattern, because term-time and part-time arrangements vary a lot between settings.',
      clear_routine: 'Check how structured the timetable is in the setting you are interested in.',
      progression: 'Check what route a setting expects between support roles and qualified teaching roles.',
      help_others: 'Check what pastoral and safeguarding responsibilities the role carries.',
      variety_challenge: 'Check how much the age group and subject range changes across a week.',
      creativity: 'Check how much freedom you would have to plan activities rather than deliver a set scheme.'
    },
    changing: 'Ask how the setting uses digital tools for planning, marking and assessment, and what that changes about the job.',
    suggestedSubjectIds: ['teaching_and_education', 'childcare', 'coaching_and_mentoring'],
    independentGuidance: NATIONAL_CAREERS
  },
  business_operations: {
    id: 'business_operations',
    label: 'Business and operations',
    summary: 'Roles that keep an organisation organised, coordinated and running.',
    everydayActivity: 'An administrator may coordinate schedules, records and requests across a team.',
    investigate: 'Check which systems an employer expects you to be confident with, and which routine tasks they are already automating.',
    investigateByPriority: {
      fit_commitments: 'Check whether the employer offers hybrid or flexible arrangements, as this varies by organisation.',
      clear_routine: 'Check how predictable the workload is across the month, since reporting periods can be busy.',
      progression: 'Ask what a step from coordinator to manager involves at that particular organisation.',
      help_others: 'Check how much of the role is supporting colleagues rather than processing information.',
      variety_challenge: 'Check how much of the week is recurring process work.',
      creativity: 'Check whether the role includes improving how things are done, not only running them.'
    },
    changing: 'Ask which processes the employer has automated recently, and which parts of the role that changed rather than removed.',
    suggestedSubjectIds: ['business_and_management', 'human_resources', 'employability_skills'],
    independentGuidance: NATIONAL_CAREERS
  },
  finance_analysis: {
    id: 'finance_analysis',
    label: 'Finance and analysis',
    summary: 'Roles that work with numbers, records and financial decisions.',
    everydayActivity: 'A bookkeeper may record transactions and prepare figures for a monthly report.',
    investigate: 'Check which professional body or qualification an employer asks for, and which parts of the work have moved from manual to automated.',
    investigateByPriority: {
      fit_commitments: 'Check the deadline cycle, because month-end and year-end periods are usually fixed.',
      clear_routine: 'Check how much of the role follows a set monthly cycle.',
      progression: 'Check what qualifications an employer expects at each stage of a finance route.',
      help_others: 'Check how much of the role involves advising colleagues or clients directly.',
      variety_challenge: 'Check whether the role covers one ledger or a wider range of finance work.',
      creativity: 'Check whether the role includes analysis and improvement rather than record keeping alone.'
    },
    changing: 'Ask how much of the reconciliation and reporting is automated, and where the employer still needs judgement applied.',
    suggestedSubjectIds: ['accounting_and_finance'],
    independentGuidance: NATIONAL_CAREERS
  },
  digital_technology: {
    id: 'digital_technology',
    label: 'Digital and technology',
    summary: 'Roles that build, support or protect digital systems.',
    everydayActivity: 'A support technician may investigate a fault, test a fix and record what changed.',
    investigate: 'Check which tools and certifications employers list in current adverts, and ask how those lists have changed in the past year.',
    investigateByPriority: {
      fit_commitments: 'Check whether the role includes on-call or out-of-hours cover.',
      clear_routine: 'Check how much of the work is planned and how much is reacting to incidents.',
      progression: 'Check which specialisms an employer supports, because routes differ a lot across technology.',
      help_others: 'Check how much of the role is helping colleagues or customers directly.',
      variety_challenge: 'Check how often the technology and the type of problem change.',
      creativity: 'Check whether the role includes designing solutions or mainly maintaining existing ones.'
    },
    changing: 'Ask how teams here use AI-assisted tooling day to day, and which skills they screen for now that they did not two years ago.',
    suggestedSubjectIds: ['information_technology'],
    independentGuidance: NATIONAL_CAREERS
  },
  practical_technical: {
    id: 'practical_technical',
    label: 'Practical and technical work',
    summary: 'Roles that make, maintain or improve physical things and systems.',
    everydayActivity: 'A technician may set up equipment, run checks and record the results.',
    investigate: 'Check what site, safety or equipment requirements apply, and which tasks employers say still need someone physically there.',
    investigateByPriority: {
      fit_commitments: 'Check start times and travel, because site-based work often has fixed hours.',
      clear_routine: 'Check how standardised the procedures are in that particular setting.',
      progression: 'Check which technical qualifications an employer recognises for progression.',
      help_others: 'Check how much of the role involves working alongside customers or colleagues.',
      variety_challenge: 'Check how much the work changes between jobs or sites.',
      creativity: 'Check whether the role includes designing or improving, not only assembling and maintaining.'
    },
    changing: 'Ask what has been mechanised on site recently, and which tasks the employer says still need a person there.',
    suggestedSubjectIds: ['science_and_engineering'],
    independentGuidance: NATIONAL_CAREERS
  },
  creative_communication: {
    id: 'creative_communication',
    label: 'Creative and communication work',
    summary: 'Roles that develop ideas, content and messages for an audience.',
    everydayActivity: 'A marketing assistant may draft content, gather feedback and prepare it for publication.',
    investigate: 'Check what portfolio or experience employers ask to see, and how they expect people to work alongside generative tools.',
    investigateByPriority: {
      fit_commitments: 'Check how much of the work is deadline-driven and whether hours are predictable.',
      clear_routine: 'Check how much of the role follows a publishing schedule.',
      progression: 'Check what employers expect between assistant and specialist roles.',
      help_others: 'Check how much of the work supports colleagues, clients or an audience directly.',
      variety_challenge: 'Check how often the type of project and audience changes.',
      creativity: 'Check how much creative freedom the role actually has, as some content work is closely specified.'
    },
    changing: 'Ask how the team uses generative tools in its workflow, and what they expect a person to bring on top of them.',
    suggestedSubjectIds: ['marketing'],
    independentGuidance: NATIONAL_CAREERS
  },
  people_commercial_services: {
    id: 'people_commercial_services',
    label: 'Customer and commercial services',
    summary: 'Roles that guide people through choices and deliver a service well.',
    everydayActivity: 'A service coordinator may explain options to a customer and arrange what happens next.',
    investigate: 'Check what targets or service standards the role is measured against, and which enquiries are still handled by a person.',
    investigateByPriority: {
      fit_commitments: 'Check the shift pattern, because customer-facing services often cover evenings and weekends.',
      clear_routine: 'Check how scripted or standardised the customer conversations are.',
      progression: 'Check what a team-leader or account route looks like at that organisation.',
      help_others: 'Check how much of the role is genuinely advising rather than selling.',
      variety_challenge: 'Check how varied the customer requests are day to day.',
      creativity: 'Check whether the role includes improving the service rather than only delivering it.'
    },
    changing: 'Ask which enquiries are answered automatically and which reach a person, and where this role sits in that.',
    suggestedSubjectIds: ['business_and_management', 'marketing', 'hospitality_management', 'employability_skills'],
    independentGuidance: NATIONAL_CAREERS
  },
  animals_environment: {
    id: 'animals_environment',
    label: 'Animals and the environment',
    summary: 'Roles that work with animals, land or the natural environment.',
    everydayActivity: 'An animal care assistant may feed, clean, monitor and record the condition of animals.',
    investigate: 'Check the physical demands and handling experience an employer expects, and how much of the work is done on site.',
    investigateByPriority: {
      fit_commitments: 'Check the hours, because animal care often includes early starts, weekends and holidays.',
      clear_routine: 'Check how much of the day follows a fixed care routine.',
      progression: 'Check which qualifications employers recognise in the specific setting you want.',
      help_others: 'Check how much of the role involves working with owners and the public.',
      variety_challenge: 'Check how much the species and tasks vary in that setting.',
      creativity: 'Check whether the role includes education, engagement or enrichment work.'
    },
    changing: 'Ask what monitoring or recording technology the employer uses, and how much of the work is still done on site.',
    suggestedSubjectIds: ['animal_care'],
    independentGuidance: NATIONAL_CAREERS
  },
  active_personal_services: {
    id: 'active_personal_services',
    label: 'Active and personal services',
    summary: 'Roles that support people through physical activity, wellbeing or personal care services.',
    everydayActivity: 'A fitness instructor may plan a session, lead it and adapt it for individual clients.',
    investigate: 'Check which registrations, insurance or qualifications a client or employer requires, and how much of the work is delivered face to face.',
    investigateByPriority: {
      fit_commitments: 'Check when clients actually want sessions, as early mornings and evenings are common.',
      clear_routine: 'Check how repeatable the session structure is across a week.',
      progression: 'Check what specialisms an employer or professional body recognises.',
      help_others: 'Check how much of the role is long-term client support rather than one-off sessions.',
      variety_challenge: 'Check how much the client group and setting varies.',
      creativity: 'Check how much freedom you would have to design sessions and programmes.'
    },
    changing: 'Ask how much of the service is delivered face to face, and what the employer uses apps or online sessions for.',
    suggestedSubjectIds: ['sports_and_fitness', 'beauty_hair_and_wellbeing'],
    independentGuidance: NATIONAL_CAREERS
  }
};

/** Next-step wording, chosen by C6 and softened by C1 and C5. Never a promise. */
export function nextStepWording(
  c6: string | null,
  c1: string | null,
  c5: string | null
): string {
  const beginner = c5 === 'starting_beginning' || c5 === 'unsure_counts';
  const returning = c1 === 'return_work';
  const personal = c1 === 'personal_interest';

  switch (c6) {
    case 'try_activity':
      return personal
        ? 'Try a short introductory activity in this area before deciding whether to go further.'
        : 'Try a short introductory activity or some volunteering, then decide whether to look at training.';
    case 'introductory_course':
      return beginner
        ? 'Look at an introductory course in a related subject, and check its entry requirements before you commit.'
        : 'Look at a course in a related subject and compare it with what you have already done.';
    case 'compare_qualifications':
      return 'Compare the qualifications used in this area, and check with an adviser which one employers actually ask for.';
    case 'build_existing':
      return returning
        ? 'Check which of your existing skills and qualifications still count, then look at what would build on them.'
        : 'Look at options that build on what you have already done rather than starting again.';
    case 'talk_adviser':
      return 'Talk this through with an adviser before choosing a course, so you can check the requirements first.';
    default:
      return 'Read more about the roles in this area first, then decide whether a course or an adviser conversation is the better next step.';
  }
}

/** Human wording for a C2 or C4 option id, taken from questionnaire.json labels. */
export function activityPhrase(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

export const CAREER_JOURNEY: JourneyId = 'career';

/** The career directions this guide can suggest, for display on the homepage. */
export function careerFamilyLabels(): string[] {
  return Object.values(CAREER_FAMILY_CONTENT).map(family => family.label);
}
