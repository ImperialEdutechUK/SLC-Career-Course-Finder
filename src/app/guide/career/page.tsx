import type { Metadata } from 'next';
import { QuestionRunner } from '@/components/QuestionRunner';

export const metadata: Metadata = { title: 'Explore career ideas' };

export default function CareerJourneyPage() {
  return <QuestionRunner journey="career" />;
}
