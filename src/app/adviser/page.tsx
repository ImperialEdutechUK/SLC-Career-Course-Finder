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
      <h1>Talk to an adviser</h1>
      <p className={styles.lede}>
        Need help choosing a course? Speak to South London College directly.
      </p>

      <a className="btn btn--primary btn--lg" href={config.slcCourseOrigin} rel="noopener noreferrer" target="_blank">
        Contact South London College
        <span className="visually-hidden"> (opens in a new tab)</span>
      </a>

      <p className={styles.note}>
        {config.contactRequestsEnabled
          ? 'Adviser requests are enabled for this environment.'
          : 'Messages cannot be sent from this page yet, so use the contact details on the college website.'}
      </p>

      <h2 className={styles.heading}>Useful things to ask</h2>
      <ul className={styles.list}>
        <li>What is the total cost, including assessment and certification charges?</li>
        <li>Is this qualification regulated, and where is it listed on the official register?</li>
        <li>What exactly do I need before starting, and does my previous study count?</li>
        <li>How long do I have access, and are there fixed assessment deadlines?</li>
        <li>Does this course require a work placement, and would I need to arrange it?</li>
      </ul>

      <p className={styles.footerNote}>
        Or <Link href="/courses">browse all courses</Link>.
      </p>
    </div>
  );
}
