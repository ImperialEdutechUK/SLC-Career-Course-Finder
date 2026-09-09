import Link from 'next/link';
import styles from './SiteFooter.module.css';
import { getManifest, getRelease } from '@/lib/catalogue/release';

export function SiteFooter() {
  let releaseLine = 'Catalogue release unavailable';
  try {
    const release = getRelease();
    const manifest = getManifest();
    releaseLine = `Catalogue ${manifest.activeReleaseId} · snapshot ${release.snapshotPeriod} · questionnaire ${manifest.questionnaireVersion}`;
  } catch {
    /* Readiness is reported by /api/v1/health/ready. */
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.rule} aria-hidden="true" />
      <div className="shell">
        <div className={styles.grid}>
          <div>
            <p className={styles.heading}>Career &amp; Course Finder</p>
            <p className={styles.copy}>
              A guide to help you find a useful next step. It is not an aptitude test, and it does
              not decide whether you can join a course.
            </p>
          </div>
          <nav aria-label="Footer">
            <ul className={styles.links}>
              <li><Link href="/">Start again</Link></li>
              <li><Link href="/courses">Browse all courses</Link></li>
              <li><Link href="/adviser">Talk to an adviser</Link></li>
              <li><Link href="/about">How this guide works</Link></li>
            </ul>
          </nav>
        </div>
        <p className={styles.release}>{releaseLine}</p>
      </div>
    </footer>
  );
}
