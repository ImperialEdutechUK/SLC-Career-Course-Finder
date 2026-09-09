import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './adviser.module.css';
import { config } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Talk to an adviser',
  description: 'How to reach a course adviser at South London College.'
};

/**
 * Contact delivery is a configured integration that stays off until a durable queue,
 * consent records and retention policy exist. Rather than pretend a request has been
 * received, this page explains how to reach the college directly.
 */
export default function AdviserPage() {
  return (
    <div className={`shell shell--narrow ${styles.page}`}>
      <p className="eyebrow">Support</p>
      <h1>Talk to an adviser</h1>
      <p className="lede">
        Some things are easier to check with a person: whether a qualification is the one an
        employer asked for, what a course actually costs in total, and whether you already meet
        the entry requirements.
      </p>

      <div className={styles.panel}>
        <h2 className={styles.panelHeading}>Contact requests are not yet handled by this guide</h2>
        <p>
          {config.contactRequestsEnabled
            ? 'Adviser requests are enabled for this environment.'
            : 'Sending an adviser request from this page is switched off until message delivery, consent records and retention rules are in place. We would rather tell you that than show a form that quietly loses your message.'}
        </p>
        <p>
          In the meantime, use the contact details on the college website. An adviser conversation
          is not an application, and it does not commit you to anything.
        </p>
        <a className="btn btn--primary" href={config.slcCourseOrigin} rel="noopener noreferrer" target="_blank">
          Go to southlondoncollege.org
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      </div>

      <h2 className={styles.heading}>Useful things to ask</h2>
      <ul className={styles.list}>
        <li>What is the total cost, including assessment and certification charges?</li>
        <li>Is this qualification regulated, and where is it listed on the official register?</li>
        <li>What exactly do I need before starting, and does my previous study count?</li>
        <li>How long do I have access, and are there fixed assessment deadlines?</li>
        <li>Does this course require a work placement, and would I need to arrange it?</li>
      </ul>

      <p className={styles.footerNote}>
        You can also <Link href="/courses">browse all courses</Link> or{' '}
        <Link href="/">start the guide again</Link>.
      </p>
    </div>
  );
}
