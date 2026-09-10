import Link from 'next/link';
import styles from './home.module.css';
import { getRelease } from '@/lib/catalogue/release';
import { questionnaire } from '@/lib/questionnaire';

export default function HomePage() {
  const release = getRelease();
  const career = questionnaire.routes.career;
  const course = questionnaire.routes.course;
  const categoryCount = release.taxonomy.length;
  const courseCount = release.display.length;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className="shell">
          <div className={styles.heroInner}>
            <div>
              <h1 className={`display ${styles.title}`}>What would you like help with?</h1>
              <p className={`lede ${styles.lede}`}>
                There are no right answers. Choose what interests you, even if you have never tried it.
                You can change your answers at any time, and you do not need an account.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={`shell ${styles.choices}`} aria-labelledby="choose-heading">
        <h2 id="choose-heading" className="visually-hidden">Choose how to start</h2>
        <div className={styles.journeys}>
          <JourneyCard href="/guide/career" title={career.title} copy={career.description} effort={career.effortCopy} />
          <JourneyCard href="/guide/course" title={course.title} copy={course.description} effort={course.effortCopy} />
        </div>

        <p className={styles.secondary}>
          Already know what you are looking for?{' '}
          <Link href="/courses">Browse all {courseCount} courses</Link> across {categoryCount} subject areas.
        </p>
      </section>

      {/* The reassurance sits after the choice it is meant to reassure, so it
          supports the decision rather than competing with it for first look. */}
      <section className={`shell ${styles.assuranceStrip}`} aria-label="What to expect">
        <ul className={styles.assurances}>
          <li>No account, email address or telephone number</li>
          <li>Up to three explained options, never a long list</li>
          <li>Change any answer and the results update</li>
          <li>{courseCount} courses across {categoryCount} subject areas</li>
        </ul>
      </section>

      <section className={`shell ${styles.explain}`} aria-labelledby="explain-heading">
        <h2 id="explain-heading" className={styles.explainHeading}>What this guide does, and what it does not do</h2>
        <div className={styles.explainGrid}>
          <div className={styles.explainItem}>
            <h3>It suggests a next step</h3>
            <p>
              You get up to three directions or courses worth looking at, with the reason each one
              appeared and one practical thing to check.
            </p>
          </div>
          <div className={styles.explainItem}>
            <h3>It shows what is still unknown</h3>
            <p>
              Where we do not hold a verified price, entry requirement or study time, we say so
              rather than guessing. Unknown is never treated as suitable.
            </p>
          </div>
          <div className={styles.explainItem}>
            <h3>It is not a test</h3>
            <p>
              These questions are not an aptitude, personality or admission assessment. We do not
              show match percentages or predict what work you would be good at.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * The primary choice on the whole service. The card is the target, and it carries
 * a visible action row so the affordance to proceed is never in doubt.
 *
 * The numerals that used to sit here are gone: these two are alternatives, not a
 * sequence, and numbering them implied an order that does not exist.
 */
function JourneyCard({
  href, title, copy, effort
}: { href: string; title: string; copy: string; effort: string }) {
  return (
    <Link href={href} className={styles.journey}>
      <span className={styles.journeyTitle}>{title}</span>
      <span className={styles.journeyCopy}>{copy}</span>
      <span className={styles.journeyEffort}>{effort}</span>
      <span className={styles.journeyAction} aria-hidden="true">
        <span>Start</span>
        <span className={styles.journeyGo}><Arrow /></span>
      </span>
    </Link>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
