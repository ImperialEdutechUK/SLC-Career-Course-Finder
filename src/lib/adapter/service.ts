import { randomUUID } from 'node:crypto';
// The reference engine is used unmodified. It is the only ranking authority.
import { recommend } from '@/lib/engine/engine.mjs';
import { config } from '@/lib/config';
import { approvedCourses, displayById, displayRecords, getManifest, getRelease } from '@/lib/catalogue/release';
import { requireQuestion, subjectOptions } from '@/lib/questionnaire';
import type { ValidatedSubmission } from '@/lib/questionnaire/validation';
import { buildEngineRequest } from './preferences';
import { allEquallyRelevant, applyDiversityRule, toCourseOption, type EngineResponse } from './presenter';
import { scoreCareerDirections } from '@/lib/career/engine';
import { CAREER_FAMILY_CONTENT, nextStepWording } from '@/lib/career/content';
import { CAREER_MAP_VERSION } from '@/lib/career/matrix';
import type { CareerDirection, CourseOption, Notice, RecommendationResponse } from '@/types/results';
import type { ApprovedCourse } from '@/types/catalogue';

function versions() {
  const manifest = getManifest();
  return {
    questionnaire: config.questionnaireVersion,
    catalogue: manifest.activeReleaseId,
    rules: config.rulesVersion,
    careerMap: CAREER_MAP_VERSION
  };
}

/** F2 answer -> confirmed category ids, narrowed by any explicit subcategory filter. */
function confirmedSubjects(submission: ValidatedSubmission): { ids: string[]; narrowed: boolean; label: string | null } {
  const f2 = submission.answers.F2;
  if (typeof f2 !== 'string' || f2 === 'help_me_explore') return { ids: [], narrowed: false, label: null };
  const option = subjectOptions().find(item => item.id === f2);
  if (submission.filters.subcategoryIds.length) {
    return { ids: submission.filters.subcategoryIds, narrowed: true, label: option?.label ?? null };
  }
  return { ids: [f2], narrowed: false, label: option?.label ?? null };
}

/**
 * Explicit learner-applied level filter. It scopes which approved courses are offered
 * to the engine, in the same way the publication and suppression filters do. It does
 * not change how the engine ranks what it receives.
 */
function scopeCatalogue(courses: ApprovedCourse[], levels: number[]): ApprovedCourse[] {
  if (!levels.length) return courses;
  return courses.filter(course => course.level !== undefined && levels.includes(course.level));
}

export function recommendCourses(submission: ValidatedSubmission): RecommendationResponse {
  const release = getRelease();
  const subjects = confirmedSubjects(submission);
  const request = buildEngineRequest({
    answers: submission.answers,
    details: submission.details,
    categoryIds: subjects.ids,
    filters: { regulatedOnly: submission.filters.regulatedOnly }
  });

  const catalogue = scopeCatalogue(approvedCourses(), submission.filters.levels);

  const result = recommend(request, catalogue, {
    now: new Date(),
    allowedUrlHosts: release.allowedUrlHosts,
    approvedSpecificGoalIds: [...config.approvedSpecificGoalIds]
  }) as EngineResponse;

  const notices: Notice[] = [];
  const base = {
    requestId: randomUUID(),
    versions: versions(),
    journey: 'course' as const,
    notices,
    optionalClarification: null,
    explanationMode: 'template' as const,
    resultRef: null
  };

  if (result.status === 'invalid_request') {
    // An engine contract failure is a server adapter fault, never a learner verdict.
    throw new Error(`engine rejected an adapted request: ${(result.errors ?? []).join('; ')}`);
  }

  if (result.status === 'needs_clarification') {
    notices.push({
      code: 'NEEDS_SUBJECT',
      message: 'Choose a subject, or explore career ideas first, so we can compare courses for you.'
    });
    return { ...base, state: 'broad_exploration', courseOptions: [], futureOptions: [], notices };
  }

  const toOptions = (items: EngineResponse['recommendations']): CourseOption[] =>
    items.flatMap(item => {
      const course = displayById(item.canonicalId);
      return course ? [toCourseOption(item, course, subjects.narrowed)] : [];
    });

  const direct = toOptions(result.recommendations);
  const pathways = toOptions(result.pathways);

  const startable = direct.filter(option => option.displayGroup === 'start_options');
  const checkFirst = direct.filter(option => option.displayGroup === 'check_first_options');
  const courseOptions = applyDiversityRule([...startable, ...checkFirst], 3);
  const futureOptions = applyDiversityRule(pathways, 3);

  if (!courseOptions.length && !futureOptions.length) {
    notices.push({
      code: 'NO_VERIFIED_MATCH',
      message: "We haven't found a verified course that fits these choices yet."
    });
    if (submission.filters.regulatedOnly) {
      notices.push({
        code: 'REGULATED_FILTER_APPLIED',
        message: 'You asked for regulated qualifications only. No course in this release has a verified regulated status yet, so none can pass that filter.'
      });
    }
    return { ...base, state: 'no_verified_match', courseOptions: [], futureOptions: [], notices };
  }

  if (!courseOptions.length) {
    notices.push({
      code: 'NO_DIRECT_MATCH',
      message: 'These courses are relevant, but at least one entry requirement is not met yet.'
    });
  }
  if (result.warnings.includes('url_host_allowlist_not_configured: reference evaluation only')) {
    notices.push({ code: 'HOST_ALLOWLIST_MISSING', message: 'Course links could not be host-checked.' });
  }

  const equallyRelevant = allEquallyRelevant(result.recommendations);
  if (equallyRelevant) {
    notices.push({
      code: 'EQUALLY_RELEVANT',
      message: 'On the information we hold, these options are equally relevant to your answers. They are not shown in order of suitability.'
    });
  }

  return {
    ...base,
    state: courseOptions.length ? 'course_options' : 'no_verified_match',
    courseOptions,
    futureOptions,
    totals: { directMatches: result.totalDirectMatches, pathwayMatches: result.totalPathwayMatches },
    allEquallyRelevant: equallyRelevant,
    notices
  };
}

function labelFor(questionId: string, optionId: string, journey: 'career' | 'course' = 'career'): string {
  const question = requireQuestion(journey, questionId);
  return question.options.find(option => option.id === optionId)?.label ?? optionId;
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export function recommendCareerDirections(submission: ValidatedSubmission): RecommendationResponse {
  const scoring = scoreCareerDirections(submission.answers);
  const notices: Notice[] = [];
  const base = {
    requestId: randomUUID(),
    versions: versions(),
    journey: 'career' as const,
    notices,
    optionalClarification: null,
    explanationMode: 'template' as const,
    resultRef: null
  };

  if (scoring.broadExploration) {
    notices.push({
      code: 'BROAD_EXPLORATION',
      message: 'You told us you are still deciding, so we have not narrowed this to particular directions.'
    });
    return { ...base, state: 'broad_exploration', careerDirections: [], notices };
  }

  const c1 = typeof submission.answers.C1 === 'string' ? submission.answers.C1 : null;
  const c5 = typeof submission.answers.C5 === 'string' ? submission.answers.C5 : null;
  const c6 = typeof submission.answers.C6 === 'string' ? submission.answers.C6 : null;
  const c3 = Array.isArray(submission.answers.C3) ? submission.answers.C3 : [];
  const c4 = Array.isArray(submission.answers.C4) ? submission.answers.C4 : [];
  const priorities = c3.filter(id => id !== 'unsure');

  const taxonomyIds = new Set(getRelease().taxonomy.map(category => category.id));

  const directions: CareerDirection[] = scoring.ranked.slice(0, 3).map(item => {
    const content = CAREER_FAMILY_CONTENT[item.familyId];
    const activityLabels = item.matchedActivityIds.map(id => lowerFirst(labelFor('C2', id)));
    const dailyLabels = item.matchedDailyIds.map(id => lowerFirst(labelFor('C4', id)));

    // "Why this appeared" quotes only what the learner actually selected. It does
    // not open by naming the direction, because the heading two lines above
    // already does, and the same clause repeated on all three cards buried the
    // part that differs between them.
    const parts = [`You chose ${activityLabels.join(' and ')}`];
    if (dailyLabels.length) parts.push(`and want more ${dailyLabels.join(' and ')}`);
    let why = `${parts.join(' ')}.`;
    if (c4.includes('mixed_activities')) {
      why += ' You also wanted a mix of activities, so keep other directions open.';
    }

    const investigate =
      priorities.map(id => content.investigateByPriority[id]).find(Boolean) ?? content.investigate;

    const available = content.suggestedSubjectIds.filter(id => taxonomyIds.has(id));
    const coverage: CareerDirection['slcCoverage'] =
      available.length === 0
        ? 'outside_reviewed_coverage'
        : available.length < content.suggestedSubjectIds.length
          ? 'partial_reviewed_coverage'
          : 'reviewed_links_available';

    return {
      careerFamilyId: item.familyId,
      label: content.label,
      summary: content.summary,
      whyThisAppeared: why,
      everydayActivity: content.everydayActivity,
      roles: content.roles,
      thingToInvestigate: investigate,
      howWorkIsChanging: content.changing,
      nextStep: nextStepWording(c6, c1, c5),
      slcCoverage: coverage,
      suggestedSubjectIds: available,
      suggestedSubjectLabels: available.map(id => {
        const option = subjectOptions().find(item_ => item_.id === id);
        return option?.label ?? id;
      }),
      // How many published courses actually sit in each suggested subject, counted
      // from the release rather than estimated. Matched on category id, not label:
      // the questionnaire and the catalogue capitalise subject names differently, so
      // a label comparison silently returned zero for every subject. Ids also pick up
      // cross-listed courses, which a primary-category match would miss.
      suggestedSubjectCounts: available.map(id =>
        displayRecords().filter(record => record.categoryIds.includes(id)).length
      ),
      independentGuidance: content.independentGuidance,
      tiedWith: scoring.tiedFamilyIds.filter(id => id !== item.familyId && scoring.tiedFamilyIds.includes(item.familyId))
    };
  });

  // No tied-directions notice. The cards carry no numbering and no ordering
  // language, so nothing on the page implies a ranking that needs disclaiming.
  if (directions.some(direction => direction.slcCoverage !== 'reviewed_links_available')) {
    notices.push({
      code: 'OUTSIDE_COVERAGE',
      message: 'Some of these directions are only partly covered by courses at South London College. Independent guidance is linked on each one.'
    });
  }

  return { ...base, state: 'career_directions', careerDirections: directions, notices };
}
