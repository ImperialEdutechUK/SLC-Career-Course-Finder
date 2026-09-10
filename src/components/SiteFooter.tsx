import Link from 'next/link';
import styles from './SiteFooter.module.css';

/**
 * Deliberately minimal. The catalogue release id, snapshot period and
 * questionnaire version that used to sit here are internal build detail: they
 * meant nothing to a learner and exposed implementation. They remain available
 * to operations at /api/v1/health/ready, which is where they belong.
 */
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`shell ${styles.inner}`}>
        <p className={styles.name}>South London College</p>
        <nav aria-label="Footer">
          <ul className={styles.links}>
            <li><Link href="/about">How this works</Link></li>
            <li><Link href="/adviser">Contact</Link></li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
