/**
 * Personal Benchmarks API Route
 *
 * Authenticated endpoint that returns the current user's percentile ranking
 * across all worker domain scores, compared against the current month's
 * analysis population.
 *
 * Uses the get_user_percentiles() RPC function defined in migration 029.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * Create a Supabase server client with cookie access (for auth)
 */
async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

/**
 * Create a Supabase admin client (for RPC calls with service role)
 */
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase configuration missing');
  }

  return createClient(supabaseUrl, serviceKey);
}

/** Shape returned by get_user_percentiles() RPC */
interface UserPercentilesResult {
  userId: string;
  period: string;
  totalAnalysesInPeriod: number;
  scores: {
    thinkingQuality: number | null;
    communicationPatterns: number | null;
    learningBehavior: number | null;
    contextEfficiency: number | null;
    sessionOutcome: number | null;
  };
  percentileRanks: {
    thinkingQuality: number | null;
    communicationPatterns: number | null;
    learningBehavior: number | null;
    contextEfficiency: number | null;
    sessionOutcome: number | null;
  };
}

export async function GET() {
  try {
    // 1. Verify user is authenticated
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to view your benchmarks' },
        { status: 401 }
      );
    }

    // 2. Call get_user_percentiles RPC with admin client (SECURITY DEFINER)
    const adminClient = getSupabaseAdmin();

    const { data, error } = await adminClient
      .rpc('get_user_percentiles', { p_user_id: user.id });

    if (error) {
      // Handle "No analysis results found" from the function's RAISE EXCEPTION
      if (error.message?.includes('No analysis results found')) {
        return NextResponse.json(
          {
            percentiles: null,
            message: 'No analysis results found. Complete an analysis first.',
          },
          { status: 200 }
        );
      }

      // PGRST202: RPC function not found (migration 029 not applied)
      if (error.code === 'PGRST202') {
        console.warn('[benchmarks/personal] RPC function not found — migration 029 may not be applied');
        return NextResponse.json(
          { percentiles: null, message: 'Benchmarks not available yet.' },
          { status: 200 }
        );
      }

      console.error('[benchmarks/personal] RPC error:', error);
      throw new Error(`Failed to compute user percentiles: ${error.message}`);
    }

    const result = data as UserPercentilesResult;

    return NextResponse.json({
      percentiles: {
        period: result.period,
        totalAnalysesInPeriod: result.totalAnalysesInPeriod,
        scores: result.scores,
        percentileRanks: result.percentileRanks,
      },
    });
  } catch (error) {
    console.error('[benchmarks/personal] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
