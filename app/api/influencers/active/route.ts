/**
 * Active Influencers API Route
 *
 * GET /api/influencers/active - List active influencers only
 */

import { NextResponse } from 'next/server';
import { influencerDb } from '@/lib/search-agent/db/index';

/**
 * GET /api/influencers/active
 * List active influencers only
 */
export async function GET() {
  try {
    const influencers = await influencerDb.findActive();
    return NextResponse.json({ influencers });
  } catch (error) {
    console.error('Error listing active influencers:', error);
    return NextResponse.json(
      {
        error: 'Failed to list active influencers',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
