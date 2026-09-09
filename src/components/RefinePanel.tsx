'use client';

import { useState } from 'react';
import styles from './RefinePanel.module.css';
import type { TaxonomyCategory } from '@/types/catalogue';

/**
 * Learner-controlled refinements applied on the results page.
 *
 * These scope which approved courses are offered to the matching engine, exactly like
 * the publication and suppression filters do. They do not change how the engine ranks
 * what it receives, and every applied filter is stated in the interface.
 */
export function RefinePanel({
  category, filters, levels, onApply
}: {
  category: TaxonomyCategory | null;
  filters: { regulatedOnly: boolean; levels: number[]; subcategoryIds: string[] };
  levels: number[];
  onApply: (filters: { regulatedOnly: boolean; levels: number[]; subcategoryIds: string[] }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);

  const active =
    filters.regulatedOnly || filters.levels.length > 0 || filters.subcategoryIds.length > 0;

  function toggleLevel(level: number) {
    setDraft(current => ({
      ...current,
      levels: current.levels.includes(level)
        ? current.levels.filter(item => item !== level)
        : [...current.levels, level].sort((a, b) => a - b)
    }));
  }

  function toggleSubcategory(id: string) {
    setDraft(current => ({
      ...current,
      subcategoryIds: current.subcategoryIds.includes(id)
        ? current.subcategoryIds.filter(item => item !== id)
        : [...current.subcategoryIds, id]
    }));
  }

  return (
    <section className={styles.panel}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => { setDraft(filters); setOpen(value => !value); }}
      >
        <span>Refine these options</span>
        {active ? <span className={styles.count}>Filters applied</span> : null}
        <svg className={open ? styles.chevronOpen : styles.chevron} viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 8 5 5 5-5" />
        </svg>
      </button>

      {open ? (
        <div className={styles.body}>
          {category && category.subcategories.length > 1 ? (
            <fieldset className={styles.group}>
              <legend className={styles.legend}>Narrow the subject</legend>
              <div className={styles.chips}>
                {category.subcategories.map(sub => (
                  <label key={sub.id} className={styles.chip}>
                    <input
                      type="checkbox"
                      checked={draft.subcategoryIds.includes(sub.id)}
                      onChange={() => toggleSubcategory(sub.id)}
                    />
                    <span>{sub.label} <span className={styles.chipCount}>{sub.courseCount}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {levels.length > 1 ? (
            <fieldset className={styles.group}>
              <legend className={styles.legend}>Qualification level</legend>
              <p className={styles.help}>
                A level describes how demanding a qualification is. It does not tell you how long it
                takes, and Level 7 does not mean a master&rsquo;s degree.
              </p>
              <div className={styles.chips}>
                {levels.map(level => (
                  <label key={level} className={styles.chip}>
                    <input
                      type="checkbox"
                      checked={draft.levels.includes(level)}
                      onChange={() => toggleLevel(level)}
                    />
                    <span>Level {level}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <fieldset className={styles.group}>
            <legend className={styles.legend}>Qualification type</legend>
            <label className={styles.chip}>
              <input
                type="checkbox"
                checked={draft.regulatedOnly}
                onChange={() => setDraft(current => ({ ...current, regulatedOnly: !current.regulatedOnly }))}
              />
              <span>Regulated qualifications only</span>
            </label>
            <p className={styles.help}>
              A regulated qualification is listed on the official register for England and Northern
              Ireland. An awarding body&rsquo;s name is not proof of regulation. No course in this
              release has a verified regulated status yet, so this filter currently returns nothing.
            </p>
          </fieldset>

          <div className={styles.actions}>
            <button type="button" className="btn btn--primary" onClick={() => { onApply(draft); setOpen(false); }}>
              Apply refinements
            </button>
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => {
                const cleared = { regulatedOnly: false, levels: [], subcategoryIds: [] };
                setDraft(cleared);
                onApply(cleared);
              }}
            >
              Clear all
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
