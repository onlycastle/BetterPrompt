/**
 * Influencers by Tier API Route
 *
 * GET /api/influencers/tier/[tier] - List influencers by credibility tier
 */

import { NextRequest, NextResponse } from 'next/server';
import { influencerDb } from '@/lib/search-agent/db/index';
import type { CredibilityTier } from '@/lib/search-agent/models/influencer';

interface RouteParams {
  params: Promise<{ tier: string }>;
}

/**
 * GET /api/influencers/tier/:tier
 * List influencers by credibility tier
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { tier: tierParam } = await params;
    const tier = tierParam as CredibilityTier;

    if (!['high', 'medium', 'standard'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid tier. Must be high, medium, or standard.' },
        { status: 400 }
      );
    }

    const influencers = await influencerDb.findByTier(tier);
    return NextResponse.json({ influencers, tier });
  } catch (error) {
    console.error('Error listing influencers by tier:', error);
    return NextResponse.json(
      {
        error: 'Failed to list influencers by tier',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
