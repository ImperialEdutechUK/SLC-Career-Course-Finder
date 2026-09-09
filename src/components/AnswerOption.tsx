'use client';

import styles from './AnswerOption.module.css';

/**
 * One answer control. A native radio or checkbox does the work, so keyboard use,
 * grouping and screen-reader state come from the browser rather than from ARIA
 * reimplemented by hand. Selection is shown by a tick and a border change, never by
 * colour alone.
 */
export function AnswerOption({
  type, name, value, label, hint, checked, disabled, onChange
}: {
  type: 'radio' | 'checkbox';
  name: string;
  value: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  const id = `${name}-${value}`;
  return (
    <div className={styles.row}>
      <input
        className={styles.input}
        type={type}
        id={id}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <label className={styles.label} htmlFor={id}>
        <span className={`${styles.marker} ${type === 'radio' ? styles.markerRadio : styles.markerCheck}`} aria-hidden="true">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 8.5 3.2 3.2L13 4.8" />
          </svg>
        </span>
        <span className={styles.text}>
          <span className={styles.title}>{label}</span>
          {hint ? <span className={styles.hint}>{hint}</span> : null}
        </span>
      </label>
    </div>
  );
}
