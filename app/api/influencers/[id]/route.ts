/**
 * Single Influencer API Routes
 *
 * GET /api/influencers/[id] - Get single influencer by ID
 * PATCH /api/influencers/[id] - Update an influencer
 * DELETE /api/influencers/[id] - Remove an influencer
 */

import { NextRequest, NextResponse } from 'next/server';
import { influencerDb } from '@/lib/search-agent/db/index';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/influencers/:id
 * Get single influencer by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const influencer = await influencerDb.findById(id);

    if (!influencer) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ influencer });
  } catch (error) {
    console.error('Error getting influencer:', error);
    return NextResponse.json(
      {
        error: 'Failed to get influencer',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/influencers/:id
 * Update an influencer
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const influencer = await influencerDb.update(id, body);

    if (!influencer) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ influencer });
  } catch (error) {
    console.error('Error updating influencer:', error);
    return NextResponse.json(
      {
        error: 'Failed to update influencer',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/influencers/:id
 * Remove an influencer
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const deleted = await influencerDb.delete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error removing influencer:', error);
    return NextResponse.json(
      {
        error: 'Failed to remove influencer',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
