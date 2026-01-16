/**
 * Enterprise Personal Tracking API Route
 * GET /api/enterprise/personal/tracking - Personal tracking summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseTrackingRepository } from '@/lib/infrastructure/storage/supabase/index';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const trackingRepo = createSupabaseTrackingRepository();
    const summaryResult = await trackingRepo.getSummary(userId);

    if (!summaryResult.success) {
      return NextResponse.json(
        { error: 'Failed to get tracking summary' },
        { status: 500 }
      );
    }

    return NextResponse.json(summaryResult.data);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
