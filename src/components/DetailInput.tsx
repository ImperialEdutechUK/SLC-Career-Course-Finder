'use client';

import { useId } from 'react';
import styles from './DetailInput.module.css';
import type { ConditionalInput } from '@/types/questionnaire';

/**
 * An optional inline detail field. It stays on the same screen as its question, so the
 * displayed question count remains truthful, and it is always explicitly disclosed as
 * optional. A blank field is never inferred and never becomes compulsory.
 */
export function DetailInput({
  input, value, error, onChange
}: {
  input: ConditionalInput;
  value: string | number | null;
  error?: string | null;
  onChange: (value: string | number | null) => void;
}) {
  const id = useId();
  const isAmount = input.type === 'currency_amount';

  return (
    <div className={styles.wrap}>
      <label className={styles.label} htmlFor={id}>{input.label}</label>
      {input.hint ? <p className={styles.hint} id={`${id}-hint`}>{input.hint}</p> : null}
      {isAmount ? (
        <div className={styles.amount}>
          <span className={styles.currency} aria-hidden="true">£</span>
          <input
            id={id}
            className={`${styles.input} ${styles.amountInput}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            max={1000000}
            value={value === null || value === undefined ? '' : String(value)}
            aria-describedby={input.hint ? `${id}-hint` : undefined}
            aria-invalid={error ? true : undefined}
            onChange={event => {
              const raw = event.target.value;
              if (raw === '') return onChange(null);
              const parsed = Number(raw);
              onChange(Number.isFinite(parsed) ? parsed : null);
            }}
          />
          <span className={styles.suffix}>total, in pounds</span>
        </div>
      ) : (
        <input
          id={id}
          className={styles.input}
          type="text"
          maxLength={input.maxLength ?? 200}
          value={typeof value === 'string' ? value : ''}
          aria-describedby={input.hint ? `${id}-hint` : undefined}
          aria-invalid={error ? true : undefined}
          onChange={event => onChange(event.target.value === '' ? null : event.target.value)}
        />
      )}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div>
  );
}
