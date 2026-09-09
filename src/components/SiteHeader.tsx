import Link from 'next/link';
import styles from './SiteHeader.module.css';

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
            src="/brand/slc-logo.png"
            width={145}
            height={85}
            alt="South London College"
            decoding="async"
          />
          <span className={styles.service}>Career &amp; Course Finder</span>
        </Link>
        <p className={styles.tagline}>Career and course guide</p>
        <nav className={styles.nav} aria-label="Service">
          <Link href="/courses" className={styles.navLink}>Browse all courses</Link>
          <Link href="/adviser" className={styles.navLink}>Talk to an adviser</Link>
        </nav>
      </div>
    </header>
  );
}
