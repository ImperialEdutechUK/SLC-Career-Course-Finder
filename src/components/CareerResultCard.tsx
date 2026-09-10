'use client';

import styles from './CareerResultCard.module.css';
import type { CareerDirection } from '@/types/results';

/**
 * A career direction. Each card carries why it appeared, one everyday activity, one
 * thing to investigate and a next step. Nothing here claims the learner is suited to,
 * or would be employed in, any occupation.
 */
export function CareerResultCard({
  direction, onFindCourses
}: {
  direction: CareerDirection;
  onFindCourses: (direction: CareerDirection) => void;
}) {
  const coverage =
    direction.slcCoverage === 'reviewed_links_available'
      ? null
      : direction.slcCoverage === 'partial_reviewed_coverage'
        ? 'South London College covers part of this direction. Use the independent guidance for the rest.'
        : 'South London College does not currently list courses for this direction. It is still worth exploring.';

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.title}>{direction.label}</h3>
        <p className={styles.summary}>{direction.summary}</p>
      </div>

      <div className={styles.blocks}>
        <div className={styles.block}>
          <h4>Why this appeared</h4>
          <p>{direction.whyThisAppeared}</p>
        </div>
        <div className={styles.block}>
          <h4>An everyday activity</h4>
          <p>{direction.everydayActivity}</p>
        </div>
        <div className={styles.block}>
          <h4>One thing to investigate</h4>
          <p>{direction.thingToInvestigate}</p>
        </div>
        <div className={styles.block}>
          <h4>A useful next step</h4>
          <p>{direction.nextStep}</p>
        </div>
      </div>

      {coverage ? <p className={styles.coverage}>{coverage}</p> : null}

      <div className={styles.actions}>
        {direction.suggestedSubjectIds.length ? (
          <button type="button" className="btn btn--primary" onClick={() => onFindCourses(direction)}>
            Find courses for this direction
          </button>
        ) : null}
        <a
          className="btn btn--secondary"
          href={direction.independentGuidance.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {direction.independentGuidance.label}
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      </div>

      {direction.suggestedSubjectLabels.length ? (
        <p className={styles.subjects}>
          Related subjects at the college: {direction.suggestedSubjectLabels.join(', ')}. You can
          change the subject before we compare courses.
        </p>
      ) : null}
    </article>
  );
}
