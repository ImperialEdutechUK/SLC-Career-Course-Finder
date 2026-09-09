'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './QuestionRunner.module.css';
import { ProgressIndicator } from './ProgressIndicator';
import { QuestionCard } from './QuestionCard';
import { MultiChoice, SingleChoice } from './ChoiceGroup';
import { SubjectSelect } from './SubjectSelect';
import { DetailInput } from './DetailInput';
import { ReusedAnswers } from './ReusedAnswers';
import { useGuide } from '@/lib/state/journey';
import {
  activeConditionalInputs, getRoute, questionTitle, requireQuestion
} from '@/lib/questionnaire';
import { validateAnswer } from '@/lib/questionnaire/validation';
import type { JourneyId } from '@/types/questionnaire';

/**
 * Runs one question at a time for either route.
 *
 * Nothing advances automatically. Continue validates the current answer with the same
 * rules the server applies, Back preserves everything, and reaching the end submits the
 * whole journey for a server-side calculation.
 *
 * Back is offered twice on purpose: as a link above the question, where a learner looks
 * for it and can reach it without scrolling past a long list of options, and as a button
 * beside Continue. The browser's own Back button and a phone's back gesture step through
 * the questions too, because the whole journey lives at one address and leaving it would
 * otherwise discard every answer. Only the position travels in history. Answers never do.
 */
export function QuestionRunner({ journey }: { journey: JourneyId }) {
  const guide = useGuide();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');

  const { start } = guide;
  useEffect(() => { start(journey); }, [start, journey]);

  const state = guide[journey];
  const route = getRoute(journey);
  // position() reports 0 of 0 until the journey exists, so this is safe to read before
  // the loading return below. Every hook must run on each render, so none may sit after it.
  const { index, total } = guide.position(journey);

  const { goTo, visibleIds } = guide;
  // How many history entries this journey has pushed, so Back knows whether the browser
  // has an entry to pop or whether it must move the question itself.
  const pushed = useRef(0);
  const recordedStep = useRef<number | null>(null);
  const fromPopState = useRef(false);

  // Anchor the current question in history, replacing rather than pushing so no extra
  // entry appears. Only the position is stored.
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, slcStep: index }, '');
    recordedStep.current = index;
    // Runs once: later steps are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (recordedStep.current === null || index === recordedStep.current) return;
    if (fromPopState.current) {
      fromPopState.current = false;
    } else if (index > recordedStep.current) {
      window.history.pushState({ ...window.history.state, slcStep: index }, '');
      pushed.current += 1;
    } else {
      window.history.replaceState({ ...window.history.state, slcStep: index }, '');
    }
    recordedStep.current = index;
  }, [index]);

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const step = (event.state as { slcStep?: number } | null)?.slcStep;
      // No position on the entry means the learner has left the journey, and the router
      // handles it from here.
      if (typeof step !== 'number') return;
      const target = visibleIds(journey)[step];
      if (!target) return;
      fromPopState.current = true;
      pushed.current = Math.max(0, pushed.current - 1);
      setError(null);
      goTo(journey, target);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [goTo, visibleIds, journey]);


  if (!state) {
    return (
      <div className="shell shell--narrow">
        <p className={styles.loading}>Preparing your questions…</p>
      </div>
    );
  }

  const question = requireQuestion(journey, state.currentQuestionId);
  const title = questionTitle(question, state.answers);
  const value = state.answers[question.id];
  const details = activeConditionalInputs(question, value);
  const isFirst = index === 0;
  const isLast = index === total - 1;


  function onBack() {
    // Popping keeps the browser's own history in step with the question on screen. When
    // there is nothing to pop, such as arriving here from the results page, move directly.
    if (pushed.current > 0) { window.history.back(); return; }
    setError(null);
    guide.goBack(journey);
  }

  function check(): boolean {
    const errors = validateAnswer(question, Array.isArray(value) && value.length === 0 ? null : (value ?? null));
    if (!errors.length) { setError(null); return true; }
    const [first] = errors;
    setError(
      first.code === 'EXCLUSIVE_SELECTION'
        ? 'Choose up to the stated number of answers. Choose an unsure answer on its own.'
        : question.allowSkip
          ? 'Choose an answer to continue, or use Skip if this question is optional.'
          : first.message
    );
    return false;
  }

  async function finish() {
    setAnnounce('Working out your results.');
    const response = await guide.submit(journey);
    if (response) router.push('/guide/results');
    else setAnnounce('');
  }

  function onContinue() {
    if (!check()) return;
    if (isLast) { void finish(); return; }
    guide.goNext(journey);
    setAnnounce(`Question ${index + 2} of ${total}.`);
  }

  function onSkip() {
    guide.answer(journey, question.id, null);
    for (const input of question.conditionalInputs ?? []) guide.setDetail(journey, input.id, null);
    setError(null);
    if (isLast) { void finish(); return; }
    guide.goNext(journey);
  }

  const evaluating = guide.status === 'evaluating';

  return (
    <div className={styles.wrap}>
      <div className={`shell shell--narrow ${styles.inner}`}>
        <div className={styles.top}>
          <div className={styles.topNav}>
            {!isFirst ? (
              <button type="button" className={styles.back} onClick={onBack}>
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5 7 10l5 5" />
                </svg>
                Back
              </button>
            ) : null}
            <Link href="/" className={styles.exit}>Start again</Link>
          </div>
          <ProgressIndicator index={index} total={total} label={route.title} />
        </div>

        {index === 0 ? <p className={styles.intro}>{route.intro}</p> : null}

        {index === 0 ? (
          <ReusedAnswers
            journey={journey}
            state={state}
            onChange={questionId => guide.changeReusedAnswer(journey, questionId)}
          />
        ) : null}

        <QuestionCard
          questionId={question.id}
          title={title}
          hint={question.hint}
          error={error}
          announce={announce}
          footer={
            <>
              <button
                type="button"
                className="btn btn--primary"
                onClick={onContinue}
                disabled={evaluating}
              >
                {evaluating ? 'Working it out…' : isLast ? 'See results' : 'Continue'}
              </button>
              {!isFirst ? (
                <button type="button" className="btn btn--secondary" onClick={onBack}>
                  Back
                </button>
              ) : null}
              {question.allowSkip ? (
                <button type="button" className="btn btn--quiet" onClick={onSkip}>
                  Skip this question
                </button>
              ) : null}
            </>
          }
        >
          {question.type === 'multi_select' ? (
            <MultiChoice
              question={question}
              title={title}
              value={Array.isArray(value) ? value : []}
              onToggle={optionId => { setError(null); guide.toggleOption(journey, question.id, optionId); }}
            />
          ) : question.type === 'subject_select' ? (
            <SubjectSelect
              question={question}
              title={title}
              value={typeof value === 'string' ? value : null}
              suggestedId={guide.suggestedSubjectId}
              onSelect={optionId => { setError(null); guide.selectOption(journey, question.id, optionId); }}
            />
          ) : (
            <SingleChoice
              question={question}
              title={title}
              value={typeof value === 'string' ? value : null}
              onSelect={optionId => { setError(null); guide.selectOption(journey, question.id, optionId); }}
            />
          )}

          {details.map(input => (
            <DetailInput
              key={input.id}
              input={input}
              value={state.details[input.id] ?? null}
              error={guide.fieldErrors.find(item => item.detailId === input.id)?.message ?? null}
              onChange={next => guide.setDetail(journey, input.id, next)}
            />
          ))}
        </QuestionCard>

        {guide.error ? (
          <p className={styles.serviceError} role="alert">
            {guide.error.message}{' '}
            <button type="button" className={styles.retry} onClick={() => void finish()}>Try again</button>
          </p>
        ) : null}

        <p className={styles.reassure}>
          Your answers stay on this page. We do not put them in the address bar, and you do not
          need an account to see results.
        </p>
      </div>
    </div>
  );
}
