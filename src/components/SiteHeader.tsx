import Link from 'next/link';
import styles from './SiteHeader.module.css';
import { config } from '@/lib/config';

/**
 * The header carries the college's own shield and the service name, without
 * taking a large amount of vertical space on a phone. The bar above it is the
 * college's blue-to-lime rule, used on southlondoncollege.org. The shield
 * already reads "South London College", so the wordmark is not repeated.
 */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.rule} aria-hidden="true" />
      <div className={`shell ${styles.inner}`}>
        <Link href="/" className={styles.brand}>
          <img
            className={styles.logo}
            src="/brand/slc-shield.png"
            width={156}
            height={85}
            alt="South London College"
            decoding="async"
          />
          <span className={styles.service}>Career &amp; Course Finder</span>
        </Link>
        <nav className={styles.nav} aria-label="Service">
          {/* Enrolment happens on the college's own site, so browsing the full
              catalogue goes there. The internal catalogue remains available for
              course detail pages reached from a result. */}
          <a
            className={styles.navLink}
            href={config.slcCourseOrigin}
            rel="noopener noreferrer"
            target="_blank"
          >
            Browse all courses
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
          <Link href="/adviser" className={styles.navLink}>Talk to an adviser</Link>
        </nav>
      </div>
    </header>
  );
}
