'use client';

import styles from './ReusedAnswers.module.css';
import { requireQuestion } from '@/lib/questionnaire';
import type { JourneyId, JourneyState } from '@/types/questionnaire';

/**
 * Reused answers are always shown, never hidden. Each one can be changed, which puts
 * the question back into the journey and increases the displayed question count again.
 */
export function ReusedAnswers({
  journey, state, onChange
}: {
  journey: JourneyId;
  state: JourneyState;
  onChange: (questionId: string) => void;
}) {
  const reused = Object.entries(state.answerOrigin).filter(([, origin]) => origin.kind === 'reused');
  if (!reused.length) return null;

  return (
    <section className={styles.panel} aria-labelledby="reused-heading">
      <h2 className={styles.heading} id="reused-heading">Answers carried over from your career questions</h2>
      <ul className={styles.list}>
        {reused.map(([questionId]) => {
          const question = requireQuestion(journey, questionId);
          const answer = state.answers[questionId];
          const label = question.options.find(option => option.id === answer)?.label ?? String(answer);
          return (
            <li key={questionId} className={styles.item}>
              <span className={styles.question}>{question.title}</span>
              <span className={styles.answer}>{label}</span>
              <button type="button" className={styles.change} onClick={() => onChange(questionId)}>
                Change
                <span className="visually-hidden"> your answer to: {question.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
