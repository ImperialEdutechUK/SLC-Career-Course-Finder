import type { TaxonomyCategory } from '@/types/catalogue';

/** Everything search needs from a record, satisfied by both the full and slim shapes. */
export interface SearchableCourse {
  canonicalId: string;
  title: string;
  level: number | null;
  levelLabel: string | null;
  awardingBodyLabel: string | null;
  primaryCategory: string;
  primarySubcategory: string | null;
  categoryIds: string[];
}

/**
 * Catalogue search and filtering for the browse experience.
 *
 * Free text is treated as data. It matches reviewed titles and taxonomy labels only,
 * and unresolved text never silently becomes a selected subject.
 */

export interface CatalogueQuery {
  text?: string;
  categoryIds?: string[];
  subcategoryIds?: string[];
  levels?: number[];
  awardingBodies?: string[];
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function searchCatalogue<T extends SearchableCourse>(records: T[], query: CatalogueQuery): T[] {
  const text = query.text ? normalise(query.text).slice(0, 200) : '';
  const terms = text ? text.split(' ').filter(Boolean) : [];
  const categories = new Set(query.categoryIds ?? []);
  const subcategories = new Set(query.subcategoryIds ?? []);
  const levels = new Set(query.levels ?? []);
  const bodies = new Set(query.awardingBodies ?? []);

  return records.filter(record => {
    if (categories.size && !record.categoryIds.some(id => categories.has(id))) return false;
    if (subcategories.size && !record.categoryIds.some(id => subcategories.has(id))) return false;
    if (levels.size && (record.level === null || !levels.has(record.level))) return false;
    if (bodies.size && (!record.awardingBodyLabel || !bodies.has(record.awardingBodyLabel))) return false;
    if (!terms.length) return true;
    const haystack = normalise([
      record.title,
      record.primaryCategory,
      record.primarySubcategory ?? '',
      record.awardingBodyLabel ?? '',
      record.levelLabel ?? ''
    ].join(' '));
    return terms.every(term => haystack.includes(term));
  });
}

/** Suggests categories and subcategories whose reviewed label matches the text. */
export function resolveSubjectText(
  taxonomy: TaxonomyCategory[],
  text: string
): { id: string; label: string; kind: 'category' | 'subcategory'; parentLabel?: string }[] {
  const needle = normalise(text);
  if (needle.length < 2) return [];
  const matches: { id: string; label: string; kind: 'category' | 'subcategory'; parentLabel?: string }[] = [];
  for (const category of taxonomy) {
    if (normalise(category.label).includes(needle)) {
      matches.push({ id: category.id, label: category.label, kind: 'category' });
    }
    for (const sub of category.subcategories) {
      if (normalise(sub.label).includes(needle)) {
        matches.push({ id: sub.id, label: sub.label, kind: 'subcategory', parentLabel: category.label });
      }
    }
  }
  return matches.slice(0, 12);
}

export function awardingBodies(records: SearchableCourse[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (!record.awardingBodyLabel) continue;
    counts.set(record.awardingBodyLabel, (counts.get(record.awardingBodyLabel) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'en-GB'));
}

export function levelCounts(records: SearchableCourse[]): { level: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const record of records) {
    if (record.level === null) continue;
    counts.set(record.level, (counts.get(record.level) ?? 0) + 1);
  }
  return [...counts.entries()].map(([level, count]) => ({ level, count })).sort((a, b) => a.level - b.level);
}
