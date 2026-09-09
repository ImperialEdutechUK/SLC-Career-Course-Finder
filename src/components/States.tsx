import Link from 'next/link';
import styles from './States.module.css';

/**
 * When nothing verified fits, we say so. We never relax a budget, an entry requirement
 * or a regulation filter behind the learner's back to produce a result.
 */
export function NoMatchState({ notices, onChangeAnswers }: {
  notices: { code: string; message: string }[];
  onChangeAnswers?: () => void;
}) {
  return (
    <section className={styles.state}>
      <h2 className={styles.heading}>We haven&rsquo;t found a verified course that fits these choices yet.</h2>
      {notices
        .filter(notice => notice.code !== 'NO_VERIFIED_MATCH')
        .map(notice => <p key={notice.code} className={styles.detail}>{notice.message}</p>)}
      <p className={styles.detail}>
        Rather than show you something that does not fit, here is what you can do next.
      </p>
      <ul className={styles.options}>
        <li>
          <strong>Change a preference.</strong> Widening the price limit, the level or the subject
          often changes what is available.
        </li>
        <li>
          <strong>Browse related subjects.</strong> The full catalogue is open, and you can filter
          it yourself.
        </li>
        <li>
          <strong>Talk to an adviser.</strong> Some requirements are best checked with a person.
        </li>
      </ul>
      <div className={styles.actions}>
        {onChangeAnswers ? (
          <button type="button" className="btn btn--primary" onClick={onChangeAnswers}>Change my answers</button>
        ) : null}
        <Link href="/courses" className="btn btn--secondary">Browse all courses</Link>
        <Link href="/adviser" className="btn btn--secondary">Talk to an adviser</Link>
      </div>
    </section>
  );
}

export function BroadExplorationState({ message, onChangeAnswers }: {
  message: string;
  onChangeAnswers?: () => void;
}) {
  return (
    <section className={styles.state}>
      <h2 className={styles.heading}>Let&rsquo;s keep this open for now</h2>
      <p className={styles.detail}>{message}</p>
      <p className={styles.detail}>
        We will not invent a direction from answers that do not point to one. Browsing a few
        subjects, or talking it through, is usually a better next step than a guess.
      </p>
      <div className={styles.actions}>
        {onChangeAnswers ? (
          <button type="button" className="btn btn--primary" onClick={onChangeAnswers}>Change my answers</button>
        ) : null}
        <Link href="/courses" className="btn btn--secondary">Browse all courses</Link>
        <Link href="/adviser" className="btn btn--secondary">Talk to an adviser</Link>
      </div>
    </section>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <section className={styles.state} role="alert">
      <h2 className={styles.heading}>We could not work out results just now</h2>
      <p className={styles.detail}>{message}</p>
      <div className={styles.actions}>
        {onRetry ? <button type="button" className="btn btn--primary" onClick={onRetry}>Try again</button> : null}
        <Link href="/courses" className="btn btn--secondary">Browse all courses</Link>
      </div>
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.empty}>
      <h2 className={styles.emptyHeading}>{title}</h2>
      <div className={styles.detail}>{children}</div>
    </section>
  );
}

export function AdviserCTA() {
  return (
    <aside className={styles.adviser}>
      <div>
        <h2 className={styles.adviserHeading}>Not sure what to do with this?</h2>
        <p className={styles.adviserCopy}>
          An adviser can check entry requirements and costs with you. You do not have to share your
          answers, and asking is not an application.
        </p>
      </div>
      <Link href="/adviser" className="btn btn--secondary">Talk to an adviser</Link>
    </aside>
  );
}
