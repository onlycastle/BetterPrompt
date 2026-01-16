/**
 * Deactivate Influencer API Route
 *
 * POST /api/influencers/[id]/deactivate - Deactivate an influencer (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { influencerDb } from '@/lib/search-agent/db/index';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/influencers/:id/deactivate
 * Deactivate an influencer (soft delete)
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const success = await influencerDb.deactivate(id);

    if (!success) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error deactivating influencer:', error);
    return NextResponse.json(
      {
        error: 'Failed to deactivate influencer',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
