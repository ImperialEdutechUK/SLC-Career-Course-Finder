import type { Metadata } from 'next';
import { QuestionRunner } from '@/components/QuestionRunner';

export const metadata: Metadata = { title: 'Find a course' };

export default function CourseJourneyPage() {
  return <QuestionRunner journey="course" />;
}
