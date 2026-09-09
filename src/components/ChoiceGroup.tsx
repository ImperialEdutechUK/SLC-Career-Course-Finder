'use client';

import styles from './ChoiceGroup.module.css';
import { AnswerOption } from './AnswerOption';
import type { Question } from '@/types/questionnaire';

/** One-of-many. A native radio group, so arrow keys and grouping behave normally. */
export function SingleChoice({
  question, title, value, onSelect
}: {
  question: Question;
  title: string;
  value: string | null;
  onSelect: (optionId: string) => void;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className="visually-hidden">{title}</legend>
      <div className={styles.options}>
        {question.options.map(option => (
          <AnswerOption
            key={option.id}
            type="radio"
            name={question.id}
            value={option.id}
            label={option.label ?? option.id}
            checked={value === option.id}
            onChange={() => onSelect(option.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Several-of-many, with the configured limit enforced. When the limit is reached the
 * remaining options are disabled and the reason is stated in text, so the restriction
 * is never signalled by appearance alone.
 */
export function MultiChoice({
  question, title, value, onToggle
}: {
  question: Question;
  title: string;
  value: string[];
  onToggle: (optionId: string) => void;
}) {
  const exclusiveIds = new Set(question.options.filter(option => option.exclusive).map(option => option.id));
  const chosenNormal = value.filter(id => !exclusiveIds.has(id));
  const exclusiveChosen = value.some(id => exclusiveIds.has(id));
  const atLimit = chosenNormal.length >= question.maxSelections;

  return (
    <fieldset className={styles.fieldset}>
      <legend className="visually-hidden">{title}</legend>
      <p className={styles.counter} aria-live="polite">
        {exclusiveChosen
          ? 'That answer is chosen on its own.'
          : `${chosenNormal.length} of ${question.maxSelections} chosen.`}
        {atLimit && !exclusiveChosen
          ? ' To choose a different answer, clear one first.'
          : ''}
      </p>
      <div className={styles.options}>
        {question.options.map(option => {
          const checked = value.includes(option.id);
          const isExclusive = exclusiveIds.has(option.id);
          const disabled = !checked && !isExclusive && atLimit;
          return (
            <AnswerOption
              key={option.id}
              type="checkbox"
              name={question.id}
              value={option.id}
              label={option.label ?? option.id}
              hint={isExclusive && !checked ? 'Choosing this clears your other answers' : undefined}
              checked={checked}
              disabled={disabled}
              onChange={() => onToggle(option.id)}
            />
          );
        })}
      </div>
    </fieldset>
  );
}
