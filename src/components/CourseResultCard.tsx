'use client';

import Link from 'next/link';
import styles from './CourseResultCard.module.css';
import { EligibilityBadge } from './EligibilityBadge';
import { PriceDisplay } from './PriceDisplay';
import { checkLabel, relevanceReason } from '@/lib/adapter/reasons';
import type { CourseOption } from '@/types/results';

/**
 * The first view stays concise: title, why it appeared, credential, price, study
 * expectation and the most important check. Everything else is on the course details
 * page. No score, percentage or suitability probability is shown anywhere.
 */
export function CourseResultCard({
  option, subjectLabel, position
}: { option: CourseOption; subjectLabel: string | null; position: number }) {
  const { course } = option;

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <p className={styles.index} aria-hidden="true">{String(position).padStart(2, '0')}</p>
        <div className={styles.headText}>
          <h3 className={styles.title}>
            <Link href={`/courses/${course.canonicalId}`}>{course.title}</Link>
          </h3>
          <p className={styles.reason}>{relevanceReason(option, subjectLabel)}</p>
        </div>
      </div>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>Qualification type</dt>
          <dd>
            {course.levelLabel ?? 'Level not stated'}
            {course.awardingBodyLabel ? ` · ${course.awardingBodyLabel}` : ''}
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>Regulated status</dt>
          <dd className={styles.warn}>Not verified in this release</dd>
        </div>
        <div className={styles.fact}>
          <dt>Study expectation</dt>
          <dd className={course.hoursPerWeek === null ? styles.warn : undefined}>
            {course.hoursPerWeek === null ? 'Not confirmed yet' : `About ${course.hoursPerWeek} hours a week`}
          </dd>
        </div>
        <div className={styles.factWide}>
          <dt className="visually-hidden">Total price</dt>
          <dd><PriceDisplay priceGbp={course.priceGbp} budgetCheck={option.budgetCheck} /></dd>
        </div>
      </dl>

      <div className={styles.checks}>
        <EligibilityBadge state={option.entryCheck} />
        {option.missingChecks.length ? (
          <p className={styles.checkList}>
            To check before enrolling: {option.missingChecks.map(checkLabel).join(', ').toLowerCase()}.
          </p>
        ) : null}
      </div>

      <div className={styles.actions}>
        <Link href={`/courses/${course.canonicalId}`} className="btn btn--primary">
          View course and entry requirements
        </Link>
      </div>
    </article>
  );
}
