import { NextResponse } from 'next/server';
import { getRelease } from '@/lib/catalogue/release';
import { subjectOptions } from '@/lib/questionnaire';

export async function GET() {
  const release = getRelease();
  const options = subjectOptions();
  const byId = new Map(release.taxonomy.map(category => [category.id, category]));
  const subjects = options.map(option => {
    const category = byId.get(option.id);
    return {
      id: option.id,
      label: option.label,
      sourceCategory: option.sourceCategory,
      courseCount: category?.courseCount ?? 0,
      subcategories: category?.subcategories ?? []
    };
  });
  return NextResponse.json(
    { catalogueRelease: release.releaseId, subjects },
    { headers: { 'Cache-Control': 'public, max-age=300' } }
  );
}
