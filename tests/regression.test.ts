import { describe, expect, it } from 'vitest';
import { recommend } from '@/lib/engine/engine.mjs';
import { validateSubmission } from '@/lib/questionnaire/validation';
import { recommendCareerDirections, recommendCourses } from '@/lib/adapter/service';
import { getRelease } from '@/lib/catalogue/release';
import { scoreCareerDirections } from '@/lib/career/engine';
import { FIXTURES, FIXTURE_GROUPS, type ReleaseCourseFixture } from './fixtures/regression.fixtures';
import { SYNTHETIC_HOSTS, SYNTHETIC_NOW } from './fixtures/synthetic-catalogue';
import type { ApprovedCourse } from '@/types/catalogue';

/**
 * Independent expectation for a release-catalogue shortlist.
 *
 * This re-derives what the reference engine's published contract requires, without
 * calling the application's service layer: candidates are the approved, active,
 * unexpired records overlapping the selected categories; relevance for this release
 * comes from the proportion of selected categories matched, because no course carries
 * a reviewed goal, experience, workload or price; ties break on canonical id.
 */
function expectedReleaseOrder(
  categoryIds: string[],
  levels: number[] = [],
  regulatedOnly = false
): string[] {
  const release = getRelease();
  const now = Date.now();
  const candidates = release.courses.filter((course: ApprovedCourse) => {
    if (course.active !== true || course.review_status !== 'approved') return false;
    if (levels.length && (course.level === undefined || !levels.includes(course.level))) return false;
    if (regulatedOnly && course.qualification_status !== 'regulated_verified') return false;
    if (!categoryIds.some(id => course.categoryIds.includes(id))) return false;
    return Object.values(course.field_reviews).every(
      review => review.conflicting === false && Date.parse(review.valid_until) > now
    );
  });
  const scored = candidates.map(course => ({
    id: course.canonical_id,
    fraction: categoryIds.filter(id => course.categoryIds.includes(id)).length / categoryIds.length
  }));
  return scored
    .sort((a, b) => b.fraction - a.fraction || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, 3)
    .map(item => item.id);
}

function categoryIdsFor(fixture: ReleaseCourseFixture): string[] {
  if (fixture.filters?.subcategoryIds?.length) return fixture.filters.subcategoryIds;
  const f2 = fixture.answers.F2;
  return typeof f2 === 'string' && f2 !== 'help_me_explore' ? [f2] : [];
}

describe('regression fixture suite', () => {
  it('contains at least sixty reviewed scenarios', () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(60);
  });

  it('covers every required scenario group', () => {
    const covered = new Set(FIXTURES.map(fixture => fixture.group));
    for (const group of FIXTURE_GROUPS) expect(covered, group).toContain(group);
  });

  it('uses unique fixture identifiers', () => {
    const ids = FIXTURES.map(fixture => fixture.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe.each(FIXTURES.filter(f => f.kind === 'career'))('career $id: $description', fixture => {
  if (fixture.kind !== 'career') return;

  const validated = validateSubmission({
    journey: 'career', questionnaireVersion: '2026-09-08.2', answers: fixture.answers, details: {}
  });

  it('produces canonical answer ids that the contract accepts', () => {
    expect(validated.ok, JSON.stringify(validated.errors)).toBe(true);
    // The submitted answers survive validation unchanged; nothing is coerced.
    for (const [questionId, value] of Object.entries(fixture.answers)) {
      expect(validated.value!.answers[questionId]).toEqual(value);
    }
  });

  it('returns the expected state, directions and ordering', () => {
    const response = recommendCareerDirections(validated.value!);
    expect(response.state).toBe(fixture.expect.state);
    const familyIds = (response.careerDirections ?? []).map(direction => direction.careerFamilyId);
    expect(familyIds).toEqual(fixture.expect.familyIds.slice(0, 3));
  });

  if (fixture.expect.tiedFamilyIds) {
    it('identifies the tied directions', () => {
      const scoring = scoreCareerDirections(fixture.answers);
      expect(scoring.tiedFamilyIds.sort()).toEqual([...fixture.expect.tiedFamilyIds!].sort());
    });
  }

  if (fixture.expect.excludedFamilyIds) {
    it('excludes the directions with no activity evidence', () => {
      const response = recommendCareerDirections(validated.value!);
      const familyIds = (response.careerDirections ?? []).map(direction => direction.careerFamilyId);
      for (const excluded of fixture.expect.excludedFamilyIds!) expect(familyIds).not.toContain(excluded);
    });
  }

  if (fixture.expect.explanationContains) {
    it('explains the result using the learner’s own selections', () => {
      const response = recommendCareerDirections(validated.value!);
      const text = (response.careerDirections ?? []).map(d => d.whyThisAppeared).join(' ');
      for (const phrase of fixture.expect.explanationContains!) expect(text).toContain(phrase);
    });
  }

  if (fixture.expect.coverage) {
    it('reports SLC coverage honestly', () => {
      const response = recommendCareerDirections(validated.value!);
      for (const [familyId, coverage] of Object.entries(fixture.expect.coverage!)) {
        const direction = response.careerDirections!.find(d => d.careerFamilyId === familyId);
        expect(direction?.slcCoverage, familyId).toBe(coverage);
      }
    });
  }

  it('never claims aptitude, employment or a match percentage', () => {
    const response = recommendCareerDirections(validated.value!);
    const text = JSON.stringify(response);
    expect(text).not.toMatch(/\d+\s?% (match|suitable|fit)/i);
    expect(text).not.toMatch(/aptitude|personality type|you would be good at|guaranteed/i);
  });
});

describe.each(FIXTURES.filter(f => f.kind === 'course_release'))('course $id: $description', fixture => {
  if (fixture.kind !== 'course_release') return;

  const validated = validateSubmission({
    journey: 'course',
    questionnaireVersion: '2026-09-08.2',
    answers: fixture.answers,
    details: fixture.details ?? {},
    filters: fixture.filters ?? {}
  });

  it('produces canonical answer ids that the contract accepts', () => {
    expect(validated.ok, JSON.stringify(validated.errors)).toBe(true);
    for (const [questionId, value] of Object.entries(fixture.answers)) {
      expect(validated.value!.answers[questionId]).toEqual(value);
    }
  });

  it('returns the expected state and no more than three options', () => {
    const response = recommendCourses(validated.value!);
    expect(response.state).toBe(fixture.expect.state);
    expect((response.courseOptions ?? []).length).toBeLessThanOrEqual(fixture.expect.maxOptions);
  });

  if (fixture.expect.state === 'course_options') {
    it('matches the independently derived result ids and ordering', () => {
      const response = recommendCourses(validated.value!);
      const expectedIds = expectedReleaseOrder(
        categoryIdsFor(fixture),
        fixture.filters?.levels ?? [],
        fixture.filters?.regulatedOnly ?? false
      );
      expect(response.courseOptions!.map(option => option.courseId)).toEqual(expectedIds);
    });

    it('reports every option as needing an entry check', () => {
      const response = recommendCourses(validated.value!);
      for (const option of response.courseOptions!) {
        expect(option.entryCheck).toBe(fixture.expect.entryCheck ?? 'check_needed');
        expect(option.displayGroup).toBe('check_first_options');
      }
    });

    if (fixture.expect.priceUnknown) {
      it('never renders an unknown price as zero or as affordable', () => {
        const response = recommendCourses(validated.value!);
        for (const option of response.courseOptions!) {
          expect(option.course.priceGbp).toBeNull();
          expect(option.budgetCheck.status).not.toBe('within_cap');
          expect(option.budgetCheck.totalGbp).toBeUndefined();
        }
      });
    }

    if (fixture.expect.reasonCodes) {
      it('carries the expected reason codes', () => {
        const response = recommendCourses(validated.value!);
        for (const option of response.courseOptions!) {
          for (const code of fixture.expect.reasonCodes!) expect(option.reasonCodes).toContain(code);
        }
      });
    }

    if (fixture.expect.withinCategoryIds) {
      it('returns only courses inside the confirmed subject', () => {
        const response = recommendCourses(validated.value!);
        for (const option of response.courseOptions!) {
          const ids = option.course.categoryIds;
          expect(fixture.expect.withinCategoryIds!.some(id => ids.includes(id)), option.courseId).toBe(true);
        }
      });
    }
  }

  if (fixture.expect.notices) {
    it('explains why the result is empty', () => {
      const response = recommendCourses(validated.value!);
      const codes = response.notices.map(notice => notice.code);
      for (const code of fixture.expect.notices!) expect(codes).toContain(code);
    });
  }

  it('never exposes an internal relevance score or a match percentage', () => {
    const response = recommendCourses(validated.value!);
    const text = JSON.stringify(response);
    expect(text).not.toContain('relevanceScore');
    expect(text).not.toContain('denominator');
    expect(text).not.toMatch(/\d+\s?% (match|suitable|fit)/i);
  });
});

describe.each(FIXTURES.filter(f => f.kind === 'course_synthetic'))('synthetic $id: $description', fixture => {
  if (fixture.kind !== 'course_synthetic') return;

  const result = recommend(
    { preferences: fixture.preferences, facts: fixture.facts ?? {} },
    fixture.catalogue,
    { now: SYNTHETIC_NOW, allowedUrlHosts: SYNTHETIC_HOSTS }
  ) as {
    status: string;
    recommendations: { canonicalId: string; budgetCheck: { status: string }; eligibility: { status: string } }[];
    pathways: { canonicalId: string }[];
    excluded: { canonicalId?: string; reasons: string[] }[];
  };

  it('returns the expected status', () => {
    expect(result.status).toBe(fixture.expect.status);
  });

  it('returns the expected recommendation ids in the expected order', () => {
    expect(result.recommendations.map(item => item.canonicalId)).toEqual(fixture.expect.recommendationIds);
  });

  it('returns the expected future options', () => {
    expect(result.pathways.map(item => item.canonicalId)).toEqual(fixture.expect.pathwayIds ?? []);
  });

  if (fixture.expect.excluded) {
    it('excludes the expected records for the expected reasons', () => {
      for (const [canonicalId, reason] of Object.entries(fixture.expect.excluded!)) {
        const entry = result.excluded.find(item => item.canonicalId === canonicalId);
        expect(entry, canonicalId).toBeDefined();
        expect(entry!.reasons, canonicalId).toContain(reason);
      }
    });
  }

  if (fixture.expect.budgetCheck) {
    it('reports the expected budget state', () => {
      for (const [canonicalId, status] of Object.entries(fixture.expect.budgetCheck!)) {
        const item = result.recommendations.find(entry => entry.canonicalId === canonicalId);
        expect(item?.budgetCheck.status, canonicalId).toBe(status);
      }
    });
  }

  if (fixture.expect.eligibility) {
    it('reports the expected eligibility state', () => {
      const all = [...result.recommendations, ...result.pathways] as { canonicalId: string; eligibility?: { status: string } }[];
      for (const [canonicalId, status] of Object.entries(fixture.expect.eligibility!)) {
        const item = all.find(entry => entry.canonicalId === canonicalId);
        expect(item?.eligibility?.status, canonicalId).toBe(status);
      }
    });
  }
});
