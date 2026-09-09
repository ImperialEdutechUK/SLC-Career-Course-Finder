import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import styles from './course.module.css';
import { displayById, displayRecords, getRelease } from '@/lib/catalogue/release';
import { EligibilityBadge } from '@/components/EligibilityBadge';
import { PriceDisplay } from '@/components/PriceDisplay';
import { AdviserCTA } from '@/components/States';

export async function generateStaticParams() {
  return displayRecords().map(course => ({ canonicalId: course.canonicalId }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ canonicalId: string }> }
): Promise<Metadata> {
  const { canonicalId } = await params;
  const course = displayById(canonicalId);
  if (!course) return { title: 'Course not found' };
  return {
    title: course.title,
    description: `${course.title} at South London College. Check the qualification, entry requirements and price before you enrol.`
  };
}

/** Unknown facts are shown as unknown. A blank is never rendered as a zero or a "no". */
function Fact({ label, value, unknownNote }: { label: string; value: string | null; unknownNote?: string }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd className={value === null ? styles.unknown : undefined}>
        {value ?? 'Not confirmed in this release'}
        {value === null && unknownNote ? <span className={styles.unknownNote}>{unknownNote}</span> : null}
      </dd>
    </div>
  );
}

export default async function CourseDetailPage({ params }: { params: Promise<{ canonicalId: string }> }) {
  const { canonicalId } = await params;
  const course = displayById(canonicalId);
  if (!course) notFound();
  const release = getRelease();

  const related = displayRecords()
    .filter(item => item.canonicalId !== course.canonicalId
      && item.memberships.some(m => course.memberships.some(own => own.categoryId === m.categoryId)))
    .slice(0, 3);

  return (
    <div className={`shell ${styles.page}`}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/courses">All courses</Link>
        <span aria-hidden="true">/</span>
        <span>{course.primaryCategory}</span>
      </nav>

      <header className={styles.header}>
        <p className="eyebrow">{course.primarySubcategory ?? course.primaryCategory}</p>
        <h1>{course.title}</h1>
        <div className={styles.badges}>
          <EligibilityBadge state="check_needed" />
          <span className="badge badge--neutral">
            <span className="badge__dot" aria-hidden="true" />
            Regulated status not verified
          </span>
        </div>
        <p className={styles.disclaimer}>
          This page shows what the published catalogue records. It is not an admission decision, and
          it does not confirm that you can join this course.
        </p>
      </header>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.section} aria-labelledby="qualification-heading">
            <h2 id="qualification-heading">Qualification</h2>
            <p className={styles.sectionNote}>
              The award itself: who issues it and how demanding it is. One course can lead to more
              than one award, and a similar title is not the same qualification.
            </p>
            <dl className={styles.facts}>
              <Fact label="Awarding organisation" value={course.awardingBodyLabel} />
              <Fact label="Level" value={course.levelLabel} unknownNote="The source listing left this blank." />
              <Fact
                label="Qualification number"
                value={null}
                unknownNote="Check the official register entry on the course page before enrolling."
              />
              <Fact
                label="Regulated status"
                value={null}
                unknownNote={`The source records this as "${course.sourceQualificationStatus.replace(/_/g, ' ')}". An awarding body's name is not proof that a qualification is regulated.`}
              />
              <Fact label="Total qualification time" value={course.tqtHours === null ? null : `${course.tqtHours} hours`} />
            </dl>
            <p className={styles.levelNote}>
              A level describes difficulty. It does not tell you how long a course takes, and a
              Level 7 qualification is not automatically a master&rsquo;s degree.
            </p>
          </section>

          <section className={styles.section} aria-labelledby="offer-heading">
            <h2 id="offer-heading">Delivery offer</h2>
            <p className={styles.sectionNote}>
              What the college currently sells: the price, the study expectation and the access
              period. These change more often than the qualification does.
            </p>
            <div className={styles.priceBlock}>
              <PriceDisplay priceGbp={course.priceGbp} />
            </div>
            <dl className={styles.facts}>
              <Fact
                label="Required extra charges"
                value={null}
                unknownNote="Assessment, certification and resubmission charges are not recorded here. Check them before you enrol."
              />
              <Fact
                label="Expected weekly study"
                value={course.hoursPerWeek === null ? null : `About ${course.hoursPerWeek} hours`}
              />
              <Fact label="Access period" value={null} unknownNote="How long you have to complete the course is not recorded here." />
              <Fact label="Payment options" value={null} unknownNote="A monthly instalment is not the total price. Ask an adviser about payment plans." />
            </dl>
          </section>

          <section className={styles.section} aria-labelledby="requirements-heading">
            <h2 id="requirements-heading">Requirements</h2>
            <p className={styles.sectionNote}>
              What you would need before starting. Nothing here has been checked against your
              answers, and an unknown requirement never counts as met.
            </p>
            <dl className={styles.facts}>
              <Fact
                label="Entry requirements"
                value={course.entryRequirements}
                unknownNote="No reviewed entry rule exists for this course yet, so this must be checked with the college."
              />
              <Fact
                label="Work placement"
                value={course.placementRequired === null ? null : course.placementRequired ? 'Required' : 'Not required'}
                unknownNote="Whether a placement is required is not recorded here. A course that requires one cannot be satisfied by having no placement."
              />
              <Fact label="English language requirements" value={null} />
              <Fact label="Equipment you need" value={null} />
              <Fact label="Assessment method" value={null} />
              <Fact label="Learner support" value={null} />
            </dl>
          </section>

          <details className={styles.details}>
            <summary>Where this information comes from</summary>
            <div className={styles.detailsBody}>
              <p>
                This record was imported from the college&rsquo;s own course category workbook for{' '}
                {release.snapshotPeriod}, {course.sourceSheet}, row {course.sourceRow}. It was
                validated, checked for duplicate and conflicting entries, and published as part of
                release {release.releaseId}.
              </p>
              <p>
                The snapshot states the title, the subject listing, the level label and the awarding
                body label. It does not state prices, entry requirements, workload or regulated
                status, so those remain unknown here rather than being filled in from the course
                title or web page.
              </p>
              <p className={styles.identifier}>
                Canonical identifier {course.canonicalId} · source record {course.recordId}
              </p>
            </div>
          </details>
        </div>

        <aside className={styles.side}>
          <div className={styles.action}>
            <h2 className={styles.actionHeading}>Ready to check the details?</h2>
            <p className={styles.actionCopy}>
              The college&rsquo;s own course page carries the current price, entry requirements and
              the enrolment process.
            </p>
            <a className="btn btn--primary btn--block" href={course.url} rel="noopener noreferrer" target="_blank">
              View course and entry requirements
              <span className="visually-hidden"> on southlondoncollege.org (opens in a new tab)</span>
            </a>
            <Link href="/adviser" className="btn btn--secondary btn--block">Talk to an adviser</Link>
          </div>

          <div className={styles.subjects}>
            <h2 className={styles.actionHeading}>Listed in</h2>
            <ul className={styles.subjectList}>
              {course.memberships.map(membership => (
                <li key={`${membership.categoryId}-${membership.subcategoryId ?? 'none'}`}>
                  <span className={styles.subjectCategory}>{membership.category}</span>
                  {membership.subcategory ? (
                    <span className={styles.subjectSub}>{membership.subcategory}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {related.length ? (
        <section className={styles.related} aria-labelledby="related-heading">
          <h2 id="related-heading" className={styles.relatedHeading}>Other courses in this area</h2>
          <ul className={styles.relatedList}>
            {related.map(item => (
              <li key={item.canonicalId}>
                <Link href={`/courses/${item.canonicalId}`} className={styles.relatedCard}>
                  <span className={styles.relatedTitle}>{item.title}</span>
                  <span className={styles.relatedMeta}>
                    {[item.levelLabel, item.awardingBodyLabel].filter(Boolean).join(' · ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AdviserCTA />
    </div>
  );
}
