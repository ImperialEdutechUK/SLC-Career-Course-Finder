'use client';

import { useEffect, useId, useState } from 'react';
import styles from './SubjectSelect.module.css';
import { AnswerOption } from './AnswerOption';
import type { Question } from '@/types/questionnaire';

interface SearchSubject { id: string; label: string; kind: 'category' | 'subcategory'; parentLabel?: string }
interface SearchCourse { canonicalId: string; title: string; levelLabel: string | null; primaryCategoryId: string; primaryCategory: string }

/**
 * F2. The 16 exact source categories, plus search.
 *
 * Search text is data. Unresolved text never silently sets a subject: a match must be
 * confirmed by choosing it, and a resolved course is offered as a direct route to its
 * details page rather than being treated as a category.
 */
export function SubjectSelect({
  question, title, value, suggestedId, onSelect
}: {
  question: Question;
  title: string;
  value: string | null;
  suggestedId?: string | null;
  onSelect: (optionId: string) => void;
}) {
  const [text, setText] = useState('');
  const [subjects, setSubjects] = useState<SearchSubject[]>([]);
  const [courses, setCourses] = useState<SearchCourse[]>([]);
  const [searching, setSearching] = useState(false);
  const searchId = useId();

  useEffect(() => {
    const query = text.trim();
    if (query.length < 2) {
      setSubjects([]); setCourses([]); setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/v1/courses/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const body = await response.json();
        setSubjects(body.subjects ?? []);
        setCourses(body.courses ?? []);
      } catch {
        setSubjects([]); setCourses([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [text]);

  const categoryOptions = question.options.filter(option => option.sourceCategory);
  const explore = question.options.find(option => option.id === 'help_me_explore');
  const resolvedSubjects = subjects.filter(subject => subject.kind === 'category');
  const hasResults = resolvedSubjects.length > 0 || courses.length > 0;

  return (
    <div className={styles.wrap}>
      {suggestedId && value === suggestedId ? (
        <p className={styles.suggestion}>
          Suggested from the career direction you chose. You can change it to any subject below.
        </p>
      ) : null}

      <div className={styles.search}>
        <label className={styles.searchLabel} htmlFor={searchId}>
          {question.search?.label as string ?? 'Search for a subject or course'}
        </label>
        <div className={styles.searchField}>
          <svg className={styles.searchIcon} viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <circle cx="9" cy="9" r="6" /><path d="m13.5 13.5 4 4" />
          </svg>
          <input
            id={searchId}
            className={styles.searchInput}
            type="search"
            inputMode="search"
            autoComplete="off"
            maxLength={200}
            value={text}
            placeholder={question.search?.placeholder as string ?? 'For example, childcare or bookkeeping'}
            onChange={event => setText(event.target.value)}
            aria-describedby={`${searchId}-help`}
          />
        </div>
        <p className={styles.searchHelp} id={`${searchId}-help`}>
          Typing here does not choose a subject. Confirm a match below, or pick a subject area.
        </p>

        {text.trim().length >= 2 ? (
          <div className={styles.results} aria-live="polite">
            {searching ? <p className={styles.resultsNote}>Searching…</p> : null}
            {!searching && !hasResults ? (
              <p className={styles.resultsNote}>
                No subject or course matched “{text.trim()}”. Choose a subject area below, or
                explore career ideas first.
              </p>
            ) : null}
            {resolvedSubjects.length ? (
              <>
                <p className={styles.resultsHeading}>Subject areas</p>
                <ul className={styles.resultList}>
                  {resolvedSubjects.map(subject => (
                    <li key={subject.id}>
                      <button
                        type="button"
                        className={styles.resultButton}
                        onClick={() => { onSelect(subject.id); setText(''); }}
                      >
                        <span>{subject.label}</span>
                        <span className={styles.resultMeta}>Choose this subject</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {courses.length ? (
              <>
                <p className={styles.resultsHeading}>Courses matching your words</p>
                <ul className={styles.resultList}>
                  {courses.slice(0, 5).map(course => (
                    <li key={course.canonicalId}>
                      <a className={styles.resultButton} href={`/courses/${course.canonicalId}`}>
                        <span>{course.title}</span>
                        <span className={styles.resultMeta}>
                          {[course.levelLabel, course.primaryCategory].filter(Boolean).join(' · ')} — open course details
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{title}</legend>
        <div className={styles.grid}>
          {categoryOptions.map(option => (
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
        {explore ? (
          <div className={styles.explore}>
            <AnswerOption
              type="radio"
              name={question.id}
              value={explore.id}
              label={explore.label ?? explore.id}
              hint="We will offer career ideas without discarding your other answers"
              checked={value === explore.id}
              onChange={() => onSelect(explore.id)}
            />
          </div>
        ) : null}
      </fieldset>
    </div>
  );
}
