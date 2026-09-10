'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './CatalogueBrowser.module.css';
import { searchCatalogue } from '@/lib/catalogue/search';
import type { TaxonomyCategory } from '@/types/catalogue';
import type { BrowseRecord } from '@/lib/catalogue/release';

const PAGE_SIZE = 24;

/**
 * The full catalogue, presented as a college prospectus rather than a database table.
 * Every fact shown comes from the published release, and anything the release does not
 * state is labelled as not confirmed instead of being left blank or filled in.
 */
export function CatalogueBrowser({
  courses, taxonomy, bodies, levels, quarantinedCount, snapshotPeriod
}: {
  courses: BrowseRecord[];
  taxonomy: TaxonomyCategory[];
  bodies: { label: string; count: number }[];
  levels: { level: number; count: number }[];
  quarantinedCount: number;
  snapshotPeriod: string;
}) {
  const [text, setText] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [levelFilter, setLevelFilter] = useState<number[]>([]);
  const [bodyFilter, setBodyFilter] = useState<string[]>([]);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const results = useMemo(
    () => searchCatalogue(courses, {
      text,
      categoryIds,
      levels: levelFilter,
      awardingBodies: bodyFilter
    }),
    [courses, text, categoryIds, levelFilter, bodyFilter]
  );

  const activeCount = categoryIds.length + levelFilter.length + bodyFilter.length;

  function toggle<T>(list: T[], setter: (next: T[]) => void, value: T) {
    setter(list.includes(value) ? list.filter(item => item !== value) : [...list, value]);
    setShown(PAGE_SIZE);
  }

  function clearAll() {
    setCategoryIds([]); setLevelFilter([]); setBodyFilter([]); setText(''); setShown(PAGE_SIZE);
  }

  return (
    <div className={`shell ${styles.page}`}>
      <header className={styles.header}>
        <p className="eyebrow">South London College</p>
        <h1>Browse all courses</h1>
        <p className={styles.lede}>
          Explore all courses at South London College.
        </p>
      </header>

      <div className={styles.searchBar}>
        <label className="visually-hidden" htmlFor="catalogue-search">Search courses</label>
        <div className={styles.searchField}>
          <svg className={styles.searchIcon} viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <circle cx="9" cy="9" r="6" /><path d="m13.5 13.5 4 4" />
          </svg>
          <input
            id="catalogue-search"
            className={styles.searchInput}
            type="search"
            maxLength={200}
            placeholder="Search by course name, subject or awarding body"
            value={text}
            onChange={event => { setText(event.target.value); setShown(PAGE_SIZE); }}
          />
        </div>
        <button
          type="button"
          className={`btn btn--secondary ${styles.filterToggle}`}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(open => !open)}
        >
          Filters{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>

      {activeCount ? (
        <div className={styles.chips}>
          {categoryIds.map(id => (
            <span key={id} className="chip">
              {taxonomy.find(c => c.id === id)?.label ?? id}
              <button
                type="button"
                className="chip__remove"
                onClick={() => setCategoryIds(ids => ids.filter(item => item !== id))}
              >
                <span aria-hidden="true">×</span>
                <span className="visually-hidden">Remove {taxonomy.find(c => c.id === id)?.label ?? id} filter</span>
              </button>
            </span>
          ))}
          {levelFilter.map(level => (
            <span key={level} className="chip">
              Level {level}
              <button
                type="button"
                className="chip__remove"
                onClick={() => setLevelFilter(items => items.filter(item => item !== level))}
              >
                <span aria-hidden="true">×</span>
                <span className="visually-hidden">Remove Level {level} filter</span>
              </button>
            </span>
          ))}
          {bodyFilter.map(body => (
            <span key={body} className="chip">
              {body}
              <button
                type="button"
                className="chip__remove"
                onClick={() => setBodyFilter(items => items.filter(item => item !== body))}
              >
                <span aria-hidden="true">×</span>
                <span className="visually-hidden">Remove {body} filter</span>
              </button>
            </span>
          ))}
          <button type="button" className={styles.clear} onClick={clearAll}>Clear all</button>
        </div>
      ) : null}

      <div className={styles.layout}>
        <aside className={`${styles.filters} ${filtersOpen ? styles.filtersOpen : ''}`} aria-label="Filter courses">
          <div className={styles.filterHead}>
            <h2 className={styles.filterTitle}>Filters</h2>
            {activeCount ? (
              <button type="button" className={styles.clear} onClick={clearAll}>Clear all</button>
            ) : null}
          </div>

          <fieldset className={styles.group}>
            <legend className={styles.legend}>Subject area</legend>
            <div className={styles.checkList}>
              {taxonomy.map(category => (
                <label key={category.id} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={categoryIds.includes(category.id)}
                    onChange={() => toggle(categoryIds, setCategoryIds, category.id)}
                  />
                  <span>{category.label}</span>
                  <span className={styles.count}>{category.courseCount}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend className={styles.legend}>Level</legend>
            <p className={styles.legendHelp}>
              A level describes how demanding a qualification is, not how long it takes.
            </p>
            <div className={styles.checkList}>
              {levels.map(item => (
                <label key={item.level} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={levelFilter.includes(item.level)}
                    onChange={() => toggle(levelFilter, setLevelFilter, item.level)}
                  />
                  <span>Level {item.level}</span>
                  <span className={styles.count}>{item.count}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend className={styles.legend}>Awarding organisation</legend>
            <div className={styles.checkList}>
              {bodies.map(body => (
                <label key={body.label} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={bodyFilter.includes(body.label)}
                    onChange={() => toggle(bodyFilter, setBodyFilter, body.label)}
                  />
                  <span>{body.label}</span>
                  <span className={styles.count}>{body.count}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </aside>

        <section className={styles.results} aria-live="polite">
          <p className={styles.resultCount}>
            {results.length === courses.length
              ? `Showing all ${courses.length} courses`
              : `${results.length} of ${courses.length} courses`}
          </p>

          {results.length === 0 ? (
            <div className={styles.noResults}>
              <h2>No course matched those filters</h2>
              <p>Try removing a filter, or search using a different word.</p>
              <button type="button" className="btn btn--secondary" onClick={clearAll}>Clear all filters</button>
            </div>
          ) : (
            <>
              <ul className={styles.grid}>
                {results.slice(0, shown).map(course => (
                  <li key={course.canonicalId}>
                    <article className={styles.card}>
                      <p className={styles.cardCategory}>
                        {course.primarySubcategory ?? course.primaryCategory}
                      </p>
                      <h3 className={styles.cardTitle}>
                        <Link href={`/courses/${course.canonicalId}`}>{course.title}</Link>
                      </h3>
                      <p className={styles.cardMeta}>
                        {[course.levelLabel, course.awardingBodyLabel].filter(Boolean).join(' · ') || 'Level not stated'}
                      </p>
                      <div className={styles.cardFoot}>
                        <span className="badge badge--check">
                          <span className="badge__dot" aria-hidden="true" />
                          Price and entry to check
                        </span>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
              {shown < results.length ? (
                <button
                  type="button"
                  className={`btn btn--secondary ${styles.more}`}
                  onClick={() => setShown(value => value + PAGE_SIZE)}
                >
                  Show more courses ({results.length - shown} remaining)
                </button>
              ) : null}
            </>
          )}
        </section>
      </div>

      <p className={styles.provenance}>
        Catalogue snapshot {snapshotPeriod}.
        {quarantinedCount
          ? ` ${quarantinedCount} record group is held back from this list because its source rows disagree and the conflict is not resolved yet.`
          : ''}
      </p>
    </div>
  );
}
