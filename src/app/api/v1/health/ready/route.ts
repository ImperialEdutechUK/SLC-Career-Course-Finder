import { NextResponse } from 'next/server';
import { catalogueReady, getManifest } from '@/lib/catalogue/release';

/** Readiness reports whether an approved catalogue release can be served. No internals. */
export async function GET() {
  const readiness = catalogueReady();
  if (!readiness.ready) {
    return NextResponse.json(
      { status: 'not_ready', reason: readiness.reason },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  const manifest = getManifest();
  return NextResponse.json(
    {
      status: 'ready',
      catalogueRelease: manifest.activeReleaseId,
      questionnaireVersion: manifest.questionnaireVersion
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
