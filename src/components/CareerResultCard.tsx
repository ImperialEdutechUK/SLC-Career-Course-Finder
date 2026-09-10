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

  // The widest bar is the subject with the most published courses, so the chart is
  // scaled to real data rather than to a fixed maximum.
  const max = Math.max(1, ...direction.suggestedSubjectCounts);

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
        <div className={styles.block}>
          <h4>How this work is changing</h4>
          <p>{direction.howWorkIsChanging}</p>
        </div>
      </div>

      {coverage ? <p className={styles.coverage}>{coverage}</p> : null}

      <div className={styles.actions}>
        {direction.suggestedSubjectIds.length ? (
          <button type="button" className="btn btn--primary" onClick={() => onFindCourses(direction)}>
            Find courses for this direction
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M5 12h13" /><path d="m12 6 6 6-6 6" />
            </svg>
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
        <div className={styles.chart}>
          <h4 className={styles.chartHeading}>Courses at the college in these subjects</h4>
          <ul className={styles.bars}>
            {direction.suggestedSubjectLabels.map((label, i) => {
              const count = direction.suggestedSubjectCounts[i] ?? 0;
              // Zero must render as an empty track. A minimum bar width made 0 look like a value.
              const width = count > 0 ? Math.max(6, Math.round((count / max) * 100)) : 0;
              return (
                <li key={label} className={styles.bar}>
                  <span className={styles.barLabel}>{label}</span>
                  <span className={styles.barTrack}>
                    <span className={styles.barFill} style={{ width: `${width}%` }} />
                  </span>
                  <span className={styles.barValue}>{count}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
