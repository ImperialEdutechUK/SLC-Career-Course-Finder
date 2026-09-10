import Link from 'next/link';
import styles from './home.module.css';
import { browseRecords, getRelease } from '@/lib/catalogue/release';
import { questionnaire } from '@/lib/questionnaire';
import { config } from '@/lib/config';

/**
 * Career first.
 *
 * The primary tile explores career directions. Finding a course is the step
 * that follows a direction, so it sits as a supporting tile rather than
 * competing with it, and the career results themselves hand straight over to
 * courses. The hero carries no course listings at all.
 */
export default function HomePage() {
  const release = getRelease();
  const career = questionnaire.routes.career;
  const course = questionnaire.routes.course;
  const careerQuestions = career.baseQuestionIds.length;
  const courseQuestions = course.baseQuestionIds.length;
  const familyCount = new Set(release.taxonomy.map(category => category.id)).size;
  const courseCount = browseRecords().length;

  return (
    <div className={`shell ${styles.page}`}>
      <div className={styles.bento}>

        <Link href="/guide/career" className={`${styles.tile} ${styles.primary}`}>
          <span className={styles.primaryEyebrow}>South London College</span>
          <span className={styles.primaryTitle}>Not sure what to do next?</span>
          <span className={styles.primaryCopy}>
            {careerQuestions} questions about what interests you, then a few career
            directions worth exploring. No account needed.
          </span>
          <span className={styles.primaryGo}>
            Explore career ideas <Arrow />
          </span>
        </Link>

        <div className={`${styles.tile} ${styles.steps}`}>
          <span className={styles.tileEyebrow}>How it works</span>
          <ol className={styles.stepList}>
            <li><span className={styles.stepNo}>1</span> Answer a few questions</li>
            <li><span className={styles.stepNo}>2</span> See career directions that fit</li>
            <li><span className={styles.stepNo}>3</span> Find courses for the one you like</li>
          </ol>
        </div>

        <Link href="/guide/course" className={`${styles.tile} ${styles.course}`}>
          <span className={styles.tileEyebrow}>Already know your subject?</span>
          <span className={styles.tileHeading}>Find a course</span>
          <span className={styles.tileCopy}>
            {courseQuestions} short questions to narrow {courseCount} courses down to a shortlist.
          </span>
          <span className={styles.tileGo}>Find a course <Arrow /></span>
        </Link>

        <a
          className={`${styles.tile} ${styles.external}`}
          href={config.slcCourseOrigin}
          rel="noopener noreferrer"
          target="_blank"
        >
          <span className={styles.tileEyebrow}>{familyCount} subject areas</span>
          <span className={styles.tileHeading}>Browse all courses</span>
          <span className={styles.tileGo}>
            southlondoncollege.org <External />
            <span className="visually-hidden"> (opens in a new tab)</span>
          </span>
        </a>

      </div>
    </div>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h13" />
      <path d="m12 6 6 6-6 6" />
    </svg>
  );
}

function External() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M14 5h5v5" />
      <path d="M19 5l-8 8" />
      <path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />
    </svg>
  );
}
