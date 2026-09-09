import styles from './ProgressIndicator.module.css';

/**
 * Progress reflects the real branch after reuse and skipping, as required by
 * questionnaire.json globalRules.counting. The change is announced politely so a
 * screen reader user hears the new position without losing their place.
 */
export function ProgressIndicator({
  index, total, label
}: { index: number; total: number; label: string }) {
  const step = index + 1;
  const percent = total > 0 ? Math.round((step / total) * 100) : 0;
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
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
