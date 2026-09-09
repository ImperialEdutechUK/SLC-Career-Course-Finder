import { NextResponse } from 'next/server';
import { displayRecords, getRelease } from '@/lib/catalogue/release';
import { resolveSubjectText, searchCatalogue } from '@/lib/catalogue/search';

const MAX_QUERY = 200;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const text = (url.searchParams.get('q') ?? '').slice(0, MAX_QUERY);
  if (text.trim().length < 2) {
    return NextResponse.json({ courses: [], subjects: [], query: text });
  }
  const release = getRelease();
  const courses = searchCatalogue(displayRecords(), { text })
    .slice(0, 20)
    .map(record => ({
      canonicalId: record.canonicalId,
      title: record.title,
      levelLabel: record.levelLabel,
      awardingBodyLabel: record.awardingBodyLabel,
      primaryCategory: record.primaryCategory,
      primaryCategoryId: record.primaryCategoryId
    }));
  // Unresolved text never becomes a selected subject; it is returned for confirmation.
  const subjects = resolveSubjectText(release.taxonomy, text);
  return NextResponse.json({ query: text, courses, subjects }, { headers: { 'Cache-Control': 'no-store' } });
}
