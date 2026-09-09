import type { Metadata } from 'next';
import { GuideProvider } from '@/lib/state/journey';

/** Personalised journeys are never indexed and never cached. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true }
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return <GuideProvider>{children}</GuideProvider>;
}
