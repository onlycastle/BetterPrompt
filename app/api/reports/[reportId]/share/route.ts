/**
 * POST /api/reports/:reportId/share
 * Record a share action (for analytics)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const body = await request.json() as { platform?: string };
    const { platform } = body;

    if (!reportId) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: 'reportId is required',
        },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Increment share count
    await supabase.rpc('increment_report_shares', { report_uuid: reportId });

    return NextResponse.json({ success: true, platform: platform || 'unknown' });
  } catch (error) {
    console.error('Error in POST /api/reports/:reportId/share:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
