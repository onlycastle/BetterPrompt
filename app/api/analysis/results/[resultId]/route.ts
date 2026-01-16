/**
 * Analysis Results API Route
 *
 * Fetches analysis result by ID for web UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { VerboseEvaluation } from '@/lib/models/verbose-evaluation';

interface RouteContext {
  params: Promise<{ resultId: string }>;
}

/**
 * Get Supabase client
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * GET /api/analysis/results/:resultId
 *
 * Fetch analysis result by ID (for web UI)
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { resultId } = await context.params;

    if (!resultId) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'resultId is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('analysis_results')
      .select('evaluation, is_paid')
      .eq('result_id', resultId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Result not found', message: 'Analysis result not found. It may have expired.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      resultId,
      isPaid: data.is_paid,
      evaluation: data.evaluation as VerboseEvaluation,
    });
  } catch (error) {
    console.error('Error loading remote result:', error);
    return NextResponse.json(
      {
        error: 'Failed to load result',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
