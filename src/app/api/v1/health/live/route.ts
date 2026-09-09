import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'live' }, { headers: { 'Cache-Control': 'no-store' } });
}
