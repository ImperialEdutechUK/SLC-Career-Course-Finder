import type { Metadata } from 'next';
import { CatalogueBrowser } from '@/components/CatalogueBrowser';
import { browseRecords, getRelease } from '@/lib/catalogue/release';
import { awardingBodies, levelCounts } from '@/lib/catalogue/search';

export const metadata: Metadata = {
  title: 'Browse all courses',
  description: 'Search and filter every course in the South London College catalogue.'
};

export default function CoursesPage() {
  const release = getRelease();
  const records = browseRecords();
  return (
    <CatalogueBrowser
      courses={records}
      taxonomy={release.taxonomy}
      bodies={awardingBodies(records)}
      levels={levelCounts(records)}
      quarantinedCount={release.quarantined.length}
      snapshotPeriod={release.snapshotPeriod}
    />
  );
}
