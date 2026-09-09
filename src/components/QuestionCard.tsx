'use client';

import { useEffect, useId, useRef } from 'react';
import styles from './QuestionCard.module.css';

/**
 * The question template: one heading, an optional hint, the answer controls, and
 * explicit Continue, Back and Skip. Nothing advances on selection.
 */
export function QuestionCard({
  questionId, title, hint, error, children, footer, announce
}: {
  questionId: string;
  title: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  footer: React.ReactNode;
  announce?: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorId = useId();

  // Moving to a new question moves focus to its heading, so keyboard and screen
  // reader users start at the new question rather than at the top of the document.
  useEffect(() => {
    headingRef.current?.focus();
  }, [questionId]);

  return (
    <section className={styles.card} aria-labelledby={`${questionId}-heading`}>
      <h1 className={styles.heading} id={`${questionId}-heading`} ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      {hint ? <p className={styles.hint}>{hint}</p> : null}

      {error ? (
        <p className={styles.error} id={errorId} role="alert">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="10" cy="10" r="8" />
            <path d="M10 6v5" /><path d="M10 14h.01" />
          </svg>
          {error}
        </p>
      ) : null}

      <div className={styles.body}>{children}</div>

      <div className={styles.footer}>{footer}</div>

      <p className="visually-hidden" aria-live="polite">{announce}</p>
    </section>
  );
}
