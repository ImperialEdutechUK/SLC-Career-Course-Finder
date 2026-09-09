import type { Metadata } from 'next';
import { ResultsView } from '@/components/ResultsView';
import { getRelease } from '@/lib/catalogue/release';
import { subjectOptions } from '@/lib/questionnaire';

export const metadata: Metadata = {
  title: 'Your results',
  robots: { index: false, follow: false, nocache: true }
};

export default function ResultsPage() {
  const release = getRelease();
  const subjects = subjectOptions().map(option => ({ id: option.id, label: option.label ?? option.id }));
  return <ResultsView taxonomy={release.taxonomy} subjects={subjects} />;
}
