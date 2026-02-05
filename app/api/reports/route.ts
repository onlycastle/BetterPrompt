/**
 * POST /api/reports/share
 * Create a shareable report URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSupabase } from '@/lib/supabase';
import type { TypeResult } from '@/lib/models/coding-style';
import type { FullAnalysisResult } from '@/lib/analyzer/dimensions/index';

const BASE_URL = process.env.NOSLOP_BASE_URL || 'https://www.nomoreaislop.app';

/**
 * Generate a short, URL-friendly report ID (8 alphanumeric characters)
 */
function generateReportId(): string {
  return randomBytes(4).toString('hex');
}

/**
 * Generate an access token for the report (16 alphanumeric characters)
 */
function generateAccessToken(): string {
  return randomBytes(8).toString('hex');
}

interface ShareReportRequest {
  typeResult: TypeResult;
  dimensions?: FullAnalysisResult;
  sessionId?: string;
  sessionDuration?: number;
  messageCount?: number;
  toolCallCount?: number;
  expiresInDays?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ShareReportRequest;
    const {
      typeResult,
      dimensions,
      sessionId,
      sessionDuration,
      messageCount,
      toolCallCount,
      expiresInDays = 30,
    } = body;

    // Validate required fields
    if (!typeResult || !typeResult.primaryType || !typeResult.distribution) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: 'typeResult with primaryType and distribution is required',
        },
        { status: 400 }
      );
    }

    // Generate IDs
    const reportId = generateReportId();
    const accessToken = generateAccessToken();

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Save to database
    const supabase = getSupabase();
    const { error } = await supabase
      .from('shared_reports')
      .insert({
        report_id: reportId,
        access_token: accessToken,
        type_result: typeResult,
        dimensions: dimensions || null,
        session_id: sessionId || null,
        session_duration_minutes: sessionDuration || null,
        message_count: messageCount || null,
        tool_call_count: toolCallCount || null,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating shared report:', error);
      return NextResponse.json(
        {
          error: 'Failed to create shared report',
          message: error.message,
        },
        { status: 500 }
      );
    }

    const shareUrl = `${BASE_URL}/r/${reportId}`;

    return NextResponse.json(
      {
        reportId,
        shareUrl,
        accessToken,
        expiresAt: expiresAt.toISOString(),
        ogImageUrl: `${BASE_URL}/api/reports/${reportId}/og-image`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/reports/share:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
