import Link from 'next/link';
import styles from './home.module.css';
import { getRelease } from '@/lib/catalogue/release';
import { questionnaire } from '@/lib/questionnaire';

/**
 * The homepage answers one question in about three seconds: what is this for.
 *
 * Finding a course is the product. Browsing is the same job with the learner
 * driving. Career exploration is for people who cannot yet answer "which
 * subject", so it sits below both and leads back into course finding.
 */
export default function HomePage() {
  const release = getRelease();
  const career = questionnaire.routes.career;
  const courseCount = release.display.length;
  const categoryCount = release.taxonomy.length;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className="shell">
          <p className="eyebrow">South London College</p>
          <h1 className={`display ${styles.title}`}>Find the right course for you</h1>
          <p className={styles.lede}>
            Answer a few questions and discover courses that fit what you&rsquo;re looking for.
          </p>

          <div className={styles.actions}>
            <Link href="/guide/course" className="btn btn--primary btn--lg">
              Find a course <Arrow />
            </Link>
            <Link href="/courses" className="btn btn--secondary btn--lg">
              Browse all courses
            </Link>
          </div>

          <p className={styles.count}>
            {courseCount} courses across {categoryCount} subject areas
          </p>
        </div>
      </section>

      <section className={`shell ${styles.secondary}`} aria-labelledby="career-heading">
        <Link href="/guide/career" className={`card card--interactive ${styles.career}`}>
          <span className="eyebrow">Not sure what to study?</span>
          <span id="career-heading" className={styles.careerTitle}>{career.title}</span>
          <span className={styles.careerCopy}>{career.description}</span>
          <span className={styles.careerGo}>
            Start exploring <Arrow />
          </span>
        </Link>
      </section>
    </div>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h13" />
      <path d="m12 6 6 6-6 6" />
    </svg>
  );
}
