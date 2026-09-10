import Link from 'next/link';
import styles from './home.module.css';
import { questionnaire } from '@/lib/questionnaire';
import { careerFamilyLabels } from '@/lib/career/content';
import { getRelease } from '@/lib/catalogue/release';
import { config } from '@/lib/config';

/**
 * Career guidance first, and it should be obvious at a glance what kind of
 * guidance. The hero names the directions this guide can actually suggest,
 * pulled from the career map rather than written as marketing, so a visitor
 * sees the shape of the answer before spending six questions on it.
 */
export default function HomePage() {
  const career = questionnaire.routes.career;
  const directions = careerFamilyLabels();
  const familyCount = getRelease().taxonomy.length;

  return (
    <div className={`shell ${styles.page}`}>
      <div className={styles.bento}>

        <Link href="/guide/career" className={`${styles.tile} ${styles.primary}`}>
          <span className={styles.primaryEyebrow}>Career guidance · South London College</span>
          <span className={styles.primaryTitle}>Work out what to do next</span>
          <span className={styles.primaryCopy}>
            {career.baseQuestionIds.length} questions about what interests you, then career
            directions worth exploring and the courses that lead to them.
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

        <div className={`${styles.tile} ${styles.directions}`}>
          <span className={styles.tileEyebrow}>{directions.length} career directions</span>
          <ul className={styles.directionList}>
            {directions.map(label => <li key={label}>{label}</li>)}
          </ul>
        </div>

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
      <path d="M5 12h13" /><path d="m12 6 6 6-6 6" />
    </svg>
  );
}

function External() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M14 5h5v5" /><path d="M19 5l-8 8" />
      <path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />
    </svg>
  );
}
