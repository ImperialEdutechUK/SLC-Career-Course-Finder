import styles from './ProgressIndicator.module.css';

/**
 * Progress reflects the real branch after reuse and skipping, as required by
 * questionnaire.json globalRules.counting. The change is announced politely so a
 * screen reader user hears the new position without losing their place.
 *
 * The segments are decorative: position is carried for assistive technology by
 * the progressbar role and its value text, and visually by both the filled
 * segments and the taller current one, never by colour alone.
 */
export function ProgressIndicator({
  index, total, label
}: { index: number; total: number; label: string }) {
  const step = index + 1;
  return (
    <div className={styles.wrap}>
      <p className={styles.label} aria-live="polite">
        <span className={styles.step}>Question {step} of {total}</span>
        <span className={styles.route}>{label}</span>
      </p>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-valuetext={`Question ${step} of ${total}`}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={[
              styles.segment,
              i < index ? styles.segmentDone : '',
              i === index ? styles.segmentCurrent : ''
            ].filter(Boolean).join(' ')}
          />
        ))}
      </div>
    </div>
  );
}
