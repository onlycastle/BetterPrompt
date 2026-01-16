/**
 * GET /api/reports/comparison/:reportId
 * Get a report formatted for free/premium comparison
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import type { TypeResult } from '@/lib/models/coding-style';
import type { FullAnalysisResult } from '@/lib/analyzer/dimensions/index';
import { generateComparison } from '@/lib/api/services/comparison-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;

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

    // Get the report
    const { data, error } = await supabase
      .from('shared_reports')
      .select('*')
      .eq('report_id', reportId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          error: 'Report not found',
          message: 'The requested report does not exist or has been removed',
        },
        { status: 404 }
      );
    }

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return NextResponse.json(
        {
          error: 'Report expired',
          message: 'This report has expired',
        },
        { status: 410 }
      );
    }

    // Generate comparison data
    const comparison = generateComparison({
      reportId: data.report_id,
      typeResult: data.type_result as TypeResult,
      dimensions: data.dimensions as FullAnalysisResult | undefined,
      sessionMetadata: {
        sessionId: data.session_id,
        durationMinutes: data.session_duration_minutes,
        messageCount: data.message_count,
        toolCallCount: data.tool_call_count,
      },
    });

    return NextResponse.json(comparison);
  } catch (error) {
    console.error('Error in GET /api/reports/comparison/:reportId:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
