'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './ResultsView.module.css';
import { CareerResultCard } from './CareerResultCard';
import { CourseResultCard } from './CourseResultCard';
import { RefinePanel } from './RefinePanel';
import { AdviserCTA, BroadExplorationState, ErrorState, NoMatchState } from './States';
import { useGuide } from '@/lib/state/journey';
import type { TaxonomyCategory } from '@/types/catalogue';
import type { CareerDirection } from '@/types/results';

/**
 * The shared results template. It renders whatever the server returned for the current
 * journey and nothing else. Changing an answer clears these results, so a stale
 * recommendation can never remain on screen.
 */
export function ResultsView({
  taxonomy, subjects
}: {
  taxonomy: TaxonomyCategory[];
  subjects: { id: string; label: string }[];
}) {
  const guide = useGuide();
  const router = useRouter();
  const results = guide.results;
  const journey = guide.resultsJourney;

  // Reaching this page without ever starting a journey (a direct link, or a refresh
  // that cleared the in-memory answers) returns to the start rather than showing an
  // empty page.
  const started = Boolean(guide.career || guide.course);
  useEffect(() => {
    if (!results && !started && guide.status !== 'evaluating' && guide.status !== 'error') {
      router.replace('/');
    }
  }, [results, started, guide.status, router]);

  if (guide.status === 'error' && guide.error) {
    return (
      <div className={`shell ${styles.page}`}>
        <ErrorState
          message={guide.error.message}
          onRetry={() => journey && void guide.submit(journey)}
        />
      </div>
    );
  }

  if (!results || !journey) {
    return (
      <div className={`shell ${styles.page}`}>
        <p className={styles.loading}>Working out your results…</p>
      </div>
    );
  }

  const courseState = guide.course;
  const subjectId = typeof courseState?.answers.F2 === 'string' ? courseState.answers.F2 : null;
  const subjectLabel = subjects.find(subject => subject.id === subjectId)?.label ?? null;
  const category = taxonomy.find(item => item.id === subjectId) ?? null;
  const levelsAvailable = [1, 2, 3, 4, 5, 6, 7];

  function changeAnswers() {
    router.push(journey === 'career' ? '/guide/career' : '/guide/course');
  }

  function findCoursesFor(direction: CareerDirection) {
    guide.startCourseFromCareer(direction.careerFamilyId, direction.suggestedSubjectIds[0] ?? null);
    router.push('/guide/course');
  }

  const careerDirections = results.careerDirections ?? [];
  const courseOptions = results.courseOptions ?? [];
  const futureOptions = results.futureOptions ?? [];

  return (
    <div className={`shell ${styles.page}`}>
      <header className={styles.header}>
        <p className="eyebrow">
          {journey === 'career' ? 'Career exploration' : 'Course options'}
          {subjectLabel ? ` · ${subjectLabel}` : ''}
        </p>
        <h1 className={styles.title}>
          {journey === 'career'
            ? careerDirections.length
              ? 'Career directions to explore'
              : 'Where to look next'
            : courseOptions.length
              ? 'Courses that may suit you'
              : 'What we found'}
        </h1>
        <p className={`lede ${styles.lede}`}>
          {journey === 'career'
            ? 'Ideas to look into, not a verdict on what you would be good at.'
            : 'Based on your answers, here are some courses to explore.'}
        </p>
        {/* The count of everything that matched, without a sentence explaining why a
            shortlist is a shortlist. The number is useful; the explanation was not. */}
        {results.totals && results.totals.directMatches > courseOptions.length ? (
          <p className={styles.totals}>
            {results.totals.directMatches} courses matched your subject
          </p>
        ) : null}
      </header>

      {/* The no-match panel carries its own explanation, so it is not repeated here. */}
      {results.notices.length && results.state !== 'no_verified_match' ? (
        <ul className={styles.notices}>
          {results.notices
            .filter(notice => notice.code !== 'NO_VERIFIED_MATCH')
            .map(notice => <li key={notice.code}>{notice.message}</li>)}
        </ul>
      ) : null}

      {journey === 'career' ? (
        results.state === 'broad_exploration' ? (
          <BroadExplorationState
            message={results.notices[0]?.message ?? 'You told us you are still deciding.'}
            onChangeAnswers={changeAnswers}
          />
        ) : (
          <section aria-labelledby="directions-heading" className={styles.section}>
            <h2 id="directions-heading" className="visually-hidden">Career directions</h2>
            <div className={styles.cards}>
              {careerDirections.map(direction => (
                <CareerResultCard
                  key={direction.careerFamilyId}
                  direction={direction}
                  onFindCourses={findCoursesFor}
                />
              ))}
            </div>
          </section>
        )
      ) : null}

      {journey === 'course' ? (
        <>
          <RefinePanel
            category={category}
            filters={guide.filters}
            levels={levelsAvailable}
            onApply={async filters => {
              guide.setFilters(filters);
              // The refined request is recalculated by the server, not filtered here.
              setTimeout(() => void guide.submit('course'), 0);
            }}
          />

          {results.state === 'broad_exploration' ? (
            <BroadExplorationState
              message={results.notices[0]?.message ?? 'We need a subject before we can compare courses.'}
              onChangeAnswers={changeAnswers}
            />
          ) : courseOptions.length ? (
            <section aria-labelledby="options-heading" className={styles.section}>
              <h2 id="options-heading" className={styles.sectionHeading}>
                {courseOptions.every(option => option.displayGroup === 'check_first_options')
                  ? 'Entry requirements to check'
                  : 'Options to consider'}
              </h2>
              <div className={styles.cards}>
                {courseOptions.map(option => (
                  <CourseResultCard
                    key={option.courseId}
                    option={option}
                    subjectLabel={subjectLabel}
                  />
                ))}
              </div>
            </section>
          ) : (
            <NoMatchState notices={results.notices} onChangeAnswers={changeAnswers} />
          )}

          {futureOptions.length ? (
            <section aria-labelledby="future-heading" className={styles.section}>
              <h2 id="future-heading" className={styles.sectionHeading}>Another step is needed first</h2>
              <p className={styles.sectionNote}>
                These courses are relevant, but at least one stated entry requirement is not met
                yet. They are not ready to start, and we have not verified a preparation route to
                them. An adviser can tell you what would be needed.
              </p>
              <div className={styles.cards}>
                {futureOptions.map(option => (
                  <CourseResultCard
                    key={option.courseId}
                    option={option}
                    subjectLabel={subjectLabel}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      <div className={styles.next}>
        <h2 className={styles.sectionHeading}>What would you like to do next?</h2>
        <div className="cluster">
          <button type="button" className="btn btn--secondary" onClick={changeAnswers}>
            Change my answers
          </button>
          {journey === 'career' ? (
            <Link href="/guide/course" className="btn btn--secondary">Find a course instead</Link>
          ) : (
            <Link href="/guide/career" className="btn btn--secondary">Explore career ideas</Link>
          )}
          <Link href="/courses" className="btn btn--secondary">Browse all courses</Link>
          <button type="button" className="btn btn--quiet" onClick={() => { guide.reset(); router.push('/'); }}>
            Start again
          </button>
        </div>
      </div>

      <AdviserCTA />

      <p className={styles.provenance}>
        Based on catalogue release {results.versions.catalogue}, questionnaire{' '}
        {results.versions.questionnaire}, career map {results.versions.careerMap}. Explanations are
        written from approved facts using fixed templates.
      </p>
    </div>
  );
}
