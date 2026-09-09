import type { Metadata } from 'next';
import styles from './about.module.css';
import { getManifest, getRelease } from '@/lib/catalogue/release';
import { config } from '@/lib/config';

export const metadata: Metadata = {
  title: 'How this guide works',
  description: 'What the Career & Course Finder does with your answers, and what it will not claim.'
};

export default function AboutPage() {
  const release = getRelease();
  const manifest = getManifest();

  return (
    <div className={`shell shell--narrow ${styles.page}`}>
      <p className="eyebrow">About</p>
      <h1>How this guide works</h1>
      <p className="lede">
        This is a guide, not an assessment. It helps you find a next step worth looking into, and
        it tells you what it does not know.
      </p>

      <h2>Your answers</h2>
      <p>
        Answers stay on the page for the visit only. They are not written into the address bar,
        not stored in your browser, and not sent to analytics or advertising services. You do not
        need an account, an email address or a telephone number to see results.
      </p>

      <h2>How options are chosen</h2>
      <p>
        Course options come from a deterministic matching engine that compares your confirmed
        subject and preferences against approved catalogue records. Career directions come from a
        separate reviewed matrix of activities, not from whichever courses happen to be for sale.
      </p>
      <p>
        We do not show match percentages. The internal relevance figure is a ranking aid, not a
        probability that a course suits you, so publishing it would be misleading.
      </p>

      <h2>What is still unknown</h2>
      <p>
        This release publishes what the college&rsquo;s own {release.snapshotPeriod} course listing
        states: titles, subject areas, level labels and awarding body labels. It does not state
        prices, entry requirements, weekly study time or verified regulated status, so those stay
        unknown here. An unknown price is never treated as free or affordable, and an unknown
        requirement is never treated as met.
      </p>

      <h2>Artificial intelligence</h2>
      <p>
        {config.aiExplanationsEnabled
          ? 'AI wording is enabled in this environment. It may only rephrase approved statements.'
          : 'No AI is used. Every explanation on this site comes from a fixed template written from approved facts.'}{' '}
        AI can never change which courses appear, their order, their price, their requirements or
        their qualification status.
      </p>

      <h2>Accessibility</h2>
      <p>
        The service targets WCAG 2.2 AA: native form controls, visible focus, keyboard operation,
        announced question changes, no meaning carried by colour alone, and layouts that work at
        320 pixels and at 200% text zoom.
      </p>

      <dl className={styles.versions}>
        <div><dt>Catalogue release</dt><dd>{manifest.activeReleaseId}</dd></div>
        <div><dt>Source snapshot</dt><dd>{release.snapshotPeriod}, audited {release.auditedOn}</dd></div>
        <div><dt>Questionnaire</dt><dd>{manifest.questionnaireVersion}</dd></div>
        <div><dt>Editorial rules</dt><dd>{manifest.editorialRulesVersion}</dd></div>
        <div><dt>Career map</dt><dd>{config.careerMapVersion}</dd></div>
        <div><dt>Review status</dt><dd>{manifest.reviewStatus.replace(/_/g, ' ')}</dd></div>
      </dl>
    </div>
  );
}
