/**
 * User Analysis API Route
 *
 * Returns all analysis results that belong to the authenticated user.
 * This includes results claimed from the remote CLI analysis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { authenticateRequest } from '@/lib/auth/authenticate-request';

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
 * Create a Supabase admin client (for DB queries)
 */
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase configuration missing');
  }

  return createClient(supabaseUrl, serviceKey);
}

export async function GET(request: NextRequest) {
  try {
    // 1. Verify user is authenticated (CLI token via header, or web session via cookie)
    const authHeader = request.headers.get('Authorization');
    let userId: string;

    if (authHeader) {
      // CLI path: authenticate via Bearer token (CLI token or JWT)
      const authResult = await authenticateRequest(authHeader);
      if (!authResult) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Invalid or expired token' },
          { status: 401 }
        );
      }
      userId = authResult.userId;
      console.log('[/api/analysis/user] Auth via header:', { userId, source: authResult.source });
    } else {
      // Web path: authenticate via cookie session
      const supabase = await createSupabaseServerClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      console.log('[/api/analysis/user] Auth via cookie:', {
        hasUser: !!user,
        userId: user?.id,
        authError: authError?.message,
      });

      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Please sign in to view your analyses' },
          { status: 401 }
        );
      }
      userId = user.id;
    }

    // 2. Fetch user's claimed analyses from analysis_results
    const adminClient = getSupabaseAdmin();

    console.log('[/api/analysis/user] Querying for user_id:', userId);

    const { data: results, error: fetchError } = await adminClient
      .from('analysis_results')
      .select('result_id, evaluation, is_paid, claimed_at, expires_at')
      .eq('user_id', userId)
      .order('claimed_at', { ascending: false });

    console.log('[/api/analysis/user] Query result:', {
      fetchError: fetchError?.message,
      resultsCount: results?.length ?? 0,
      resultIds: results?.map(r => r.result_id),
      hasEvaluations: results?.map(r => !!r.evaluation),
    });

    if (fetchError) {
      console.error('Failed to fetch user analyses:', fetchError);
      return NextResponse.json(
        { error: 'Fetch Failed', message: 'Failed to fetch your analyses' },
        { status: 500 }
      );
    }

    // 3. Transform to standard format
    const analyses = (results || []).map(result => ({
      id: result.result_id,
      resultId: result.result_id,
      evaluation: result.evaluation,
      isPaid: result.is_paid,
      claimedAt: result.claimed_at,
      expiresAt: result.expires_at,
      source: 'remote' as const,
    }));

    console.log('[/api/analysis/user] Returning:', {
      analysesCount: analyses.length,
      firstAnalysisHasEvaluation: analyses[0]?.evaluation ? 'yes' : 'no',
    });

    return NextResponse.json({
      analyses,
      count: analyses.length,
    });

  } catch (error) {
    console.error('User analysis fetch error:', error);
    return NextResponse.json(
      {
        error: 'Fetch Failed',
        message: error instanceof Error ? error.message : 'Failed to fetch analyses',
      },
      { status: 500 }
    );
  }
}
