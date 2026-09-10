import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './about.module.css';

export const metadata: Metadata = {
  title: 'How this works',
  description: 'What this guide does, what it keeps, and what it will not guess at.'
};

/**
 * Short on purpose. The commitments that matter are kept, in plain sentences:
 * nothing is stored, nothing is invented, no AI writes any of it. The catalogue
 * release and version identifiers are gone from here; operations reads them at
 * /api/v1/health/ready, which is where they belong.
 */
export default function AboutPage() {
  return (
    <div className={`shell shell--narrow ${styles.page}`}>
      <h1>How this works</h1>

      <p className={styles.lede}>
        Answer a few questions and this guide suggests career directions worth exploring,
        or courses at South London College if you already know your subject. It takes a
        few minutes and there is nothing to sign up for.
      </p>

      <p>
        Your answers stay on the page for this visit only. They are not saved, not put in
        the address bar, and not sent to advertising or analytics. You do not need an
        account, an email address or a phone number.
      </p>

      <p>
        Where we do not hold a fact, we say so instead of guessing. Prices, entry
        requirements and weekly study time are confirmed by the college, not here, so
        check those before you enrol. Nothing on this site is written by AI, and there
        are no match percentages, because a ranking figure is not a probability that a
        course suits you.
      </p>

      <p className={styles.next}>
        <Link href="/guide/career">Explore career ideas</Link> or{' '}
        <Link href="/adviser">talk to an adviser</Link>.
      </p>
    </div>
  );
}
