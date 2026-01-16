/**
 * GET /api/reports/:reportId
 * Get a shared report by ID
 *
 * DELETE /api/reports/:reportId
 * Deactivate a shared report (requires access token)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

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

    // Increment view count (fire and forget)
    supabase.rpc('increment_report_views', { report_uuid: reportId }).then();

    // Return report data
    return NextResponse.json({
      reportId: data.report_id,
      typeResult: data.type_result,
      dimensions: data.dimensions,
      sessionMetadata: {
        sessionId: data.session_id,
        durationMinutes: data.session_duration_minutes,
        messageCount: data.message_count,
        toolCallCount: data.tool_call_count,
      },
      stats: {
        viewCount: data.view_count,
        shareCount: data.share_count,
      },
      createdAt: data.created_at,
    });
  } catch (error) {
    console.error('Error in GET /api/reports/:reportId:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const body = await request.json() as { accessToken?: string };
    const { accessToken } = body;

    if (!reportId || !accessToken) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: 'reportId and accessToken are required',
        },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify access token and deactivate
    const { data, error } = await supabase
      .from('shared_reports')
      .update({ is_active: false })
      .eq('report_id', reportId)
      .eq('access_token', accessToken)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          error: 'Report not found or access denied',
          message: 'The report does not exist or the access token is invalid',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, reportId });
  } catch (error) {
    console.error('Error in DELETE /api/reports/:reportId:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
