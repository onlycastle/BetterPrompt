/**
 * Enterprise Personal History API Route
 * GET /api/enterprise/personal/history - Personal tracking history
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseTrackingRepository } from '@/lib/infrastructure/storage/supabase/index';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const daysParam = searchParams.get('days') || '30';
    const days = parseInt(daysParam, 10);

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const trackingRepo = createSupabaseTrackingRepository();
    const metricsResult = await trackingRepo.getLatest(userId, days);

    if (!metricsResult.success) {
      return NextResponse.json(
        { error: 'Failed to get tracking history' },
        { status: 500 }
      );
    }

    return NextResponse.json({ metrics: metricsResult.data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
