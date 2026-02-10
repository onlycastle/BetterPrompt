/**
 * Survey API Route
 *
 * POST: Submit survey response (rating + optional comment)
 * No authentication required - public endpoint tied to resultId
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface SurveyRequest {
  resultId: string;
  rating: number;
  comment?: string;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * POST /api/survey
 *
 * Stores a survey response in the survey_responses table.
 *
 * @param request - JSON body with { resultId, rating (1-5), comment? }
 * @returns { success: true } or error
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SurveyRequest;
    const { resultId, rating, comment } = body;

    // Validate resultId
    if (!resultId || typeof resultId !== 'string') {
      return NextResponse.json(
        { error: 'resultId is required' },
        { status: 400 }
      );
    }

    // Validate rating (integer 1-5)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'rating must be an integer between 1 and 5' },
        { status: 400 }
      );
    }

    // Validate comment (optional, max 500 chars)
    if (comment !== undefined && comment !== null) {
      if (typeof comment !== 'string' || comment.length > 500) {
        return NextResponse.json(
          { error: 'comment must be a string with max 500 characters' },
          { status: 400 }
        );
      }
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('survey_responses').insert({
      result_id: resultId,
      rating,
      comment: comment || null,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Survey API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit survey' },
      { status: 500 }
    );
  }
}
