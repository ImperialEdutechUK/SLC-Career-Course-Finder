import Link from 'next/link';
import styles from './home.module.css';
import { browseRecords, getRelease } from '@/lib/catalogue/release';
import { questionnaire } from '@/lib/questionnaire';

/**
 * A bento grid: one dominant tile for the primary action, two supporting tiles,
 * then the real subject areas as a run of smaller tiles. Every tile is a raised
 * surface that lifts when reached for and presses down when clicked.
 *
 * Counts are real, read from the published release. Nothing here is decoration
 * pretending to be data.
 */
export default function HomePage() {
  const release = getRelease();
  const records = browseRecords();
  const career = questionnaire.routes.career;
  const courseCount = records.length;

  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(record.primaryCategory, (counts.get(record.primaryCategory) ?? 0) + 1);
  }
  const subjects = release.taxonomy
    .map(category => ({ id: category.id, label: category.label, count: counts.get(category.label) ?? 0 }))
    .filter(subject => subject.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const questionCount = questionnaire.routes.course.baseQuestionIds.length;

  return (
    <div className={`shell ${styles.page}`}>
      <div className={styles.bento}>

        <Link href="/guide/course" className={`${styles.tile} ${styles.primary}`}>
          <span className={styles.primaryEyebrow}>South London College</span>
          <span className={styles.primaryTitle}>Find the right course for you</span>
          <span className={styles.primaryCopy}>
            {questionCount} quick questions. No account needed.
          </span>
          <span className={styles.primaryGo}>
            Find a course <Arrow />
          </span>
        </Link>

        <Link href="/courses" className={`${styles.tile} ${styles.browse}`}>
          <span className={styles.bigNumber}>{courseCount}</span>
          <span className={styles.tileHeading}>Browse all courses</span>
          <span className={styles.tileCopy}>Search and filter the full catalogue</span>
          <span className={styles.tileGo}>Open <Arrow /></span>
        </Link>

        <Link href="/guide/career" className={`${styles.tile} ${styles.career}`}>
          <span className={styles.tileEyebrow}>Not sure what to study?</span>
          <span className={styles.tileHeading}>{career.title}</span>
          <span className={styles.tileCopy}>{career.description}</span>
          <span className={styles.tileGo}>Start exploring <Arrow /></span>
        </Link>

        <p className={styles.subjectsLabel}>Browse by subject</p>

        {subjects.map(subject => (
          <Link key={subject.id} href={`/courses?subject=${subject.id}`} className={`${styles.tile} ${styles.subject}`}>
            <span className={styles.subjectCount}>{subject.count}</span>
            <span className={styles.subjectName}>{subject.label}</span>
          </Link>
        ))}

        <Link href="/courses" className={`${styles.tile} ${styles.allTile}`}>
          <span className={styles.subjectName}>All {release.taxonomy.length} subjects</span>
          <span className={styles.tileGo}>Browse the full catalogue <Arrow /></span>
        </Link>

      </div>
    </div>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h13" />
      <path d="m12 6 6 6-6 6" />
    </svg>
  );
}
