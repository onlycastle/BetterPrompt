/**
 * Influencer API Routes
 *
 * GET /api/influencers - List all influencers with stats
 * POST /api/influencers - Add a new influencer
 */

import { NextRequest, NextResponse } from 'next/server';
import { influencerDb } from '@/lib/search-agent/db/index';

/**
 * GET /api/influencers
 * List all influencers with stats
 */
export async function GET() {
  try {
    const influencers = await influencerDb.findAll();
    const stats = await influencerDb.getStats();

    return NextResponse.json({
      influencers,
      stats,
    });
  } catch (error) {
    console.error('Error listing influencers:', error);
    return NextResponse.json(
      {
        error: 'Failed to list influencers',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/influencers
 * Add a new influencer
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description = '',
      credibilityTier = 'standard',
      identifiers,
      expertiseTopics,
      affiliation,
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) {
      return NextResponse.json(
        { error: 'At least one platform identifier is required' },
        { status: 400 }
      );
    }

    if (!expertiseTopics || !Array.isArray(expertiseTopics) || expertiseTopics.length === 0) {
      return NextResponse.json(
        { error: 'At least one expertise topic is required' },
        { status: 400 }
      );
    }

    // Check if influencer with same name exists
    const existing = await influencerDb.findByName(name);
    if (existing) {
      return NextResponse.json(
        { error: 'Influencer with this name already exists' },
        { status: 409 }
      );
    }

    const influencer = await influencerDb.save({
      name,
      description,
      credibilityTier,
      identifiers,
      expertiseTopics,
      affiliation,
      isActive: true,
    });

    return NextResponse.json({ influencer }, { status: 201 });
  } catch (error) {
    console.error('Error adding influencer:', error);
    return NextResponse.json(
      {
        error: 'Failed to add influencer',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
