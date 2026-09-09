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
              <p className="eyebrow">South London College · Career and course guide</p>
              <h1 className={styles.title}>What would you like help with?</h1>
              <p className={`lede ${styles.lede}`}>
                There are no right answers. Choose what interests you, even if you have never tried it.
                You can change your answers at any time, and you do not need an account.
              </p>
            </div>
            <ul className={styles.assurances}>
              <li>No account, email address or telephone number</li>
              <li>Up to three explained options, never a long list</li>
              <li>Change any answer and the results update</li>
              <li>{courseCount} courses across {categoryCount} subject areas</li>
            </ul>
          </div>
        </div>
      </section>

      <section className={`shell ${styles.choices}`} aria-labelledby="choose-heading">
        <h2 id="choose-heading" className="visually-hidden">Choose how to start</h2>
        <div className={styles.journeys}>
          <JourneyCard index="01" href="/guide/career" title={career.title} copy={career.description} effort={career.effortCopy} />
          <JourneyCard index="02" href="/guide/course" title={course.title} copy={course.description} effort={course.effortCopy} />
        </div>

        <p className={styles.secondary}>
          Already know what you are looking for?{' '}
          <Link href="/courses">Browse all {courseCount} courses</Link> across {categoryCount} subject areas.
        </p>
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

function JourneyCard({
  index, href, title, copy, effort
}: { index: string; href: string; title: string; copy: string; effort: string }) {
  return (
    <Link href={href} className={styles.journey}>
      <span className={styles.journeyTop}>
        <span className={styles.journeyIndex} aria-hidden="true">{index}</span>
        <span className={styles.journeyTitle}>{title}</span>
        <span className={styles.journeyGo} aria-hidden="true"><Arrow /></span>
      </span>
      <span className={styles.journeyCopy}>{copy}</span>
      <span className={styles.journeyEffort}>{effort}</span>
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
