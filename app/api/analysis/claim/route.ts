/**
 * Claim Analysis Result API Route
 *
 * Associates an anonymous analysis result with the authenticated user.
 * Called after login when user wants to claim their CLI-generated result.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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
 * Create a Supabase admin client (for DB updates)
 */
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase configuration missing');
  }

  return createClient(supabaseUrl, serviceKey);
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify user is authenticated
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to claim this result' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { resultId } = body;

    if (!resultId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'resultId is required' },
        { status: 400 }
      );
    }

    // 3. Use admin client to update the result
    const adminClient = getSupabaseAdmin();

    // First check if result exists and is unclaimed
    const { data: existingResult, error: fetchError } = await adminClient
      .from('analysis_results')
      .select('result_id, user_id')
      .eq('result_id', resultId)
      .single();

    if (fetchError || !existingResult) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Analysis result not found' },
        { status: 404 }
      );
    }

    // Check if already claimed by another user
    if (existingResult.user_id && existingResult.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'This result has already been claimed by another user' },
        { status: 403 }
      );
    }

    // Already claimed by this user - return success
    if (existingResult.user_id === user.id) {
      return NextResponse.json({
        success: true,
        message: 'Result already claimed',
        resultId,
      });
    }

    // 4. Claim the result
    const { error: updateError } = await adminClient
      .from('analysis_results')
      .update({
        user_id: user.id,
        claimed_at: new Date().toISOString(),
      })
      .eq('result_id', resultId)
      .is('user_id', null); // Only update if unclaimed

    if (updateError) {
      console.error('Failed to claim result:', updateError);
      return NextResponse.json(
        { error: 'Claim Failed', message: 'Failed to claim the result' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Result claimed successfully',
      resultId,
    });

  } catch (error) {
    console.error('Claim error:', error);
    return NextResponse.json(
      {
        error: 'Claim Failed',
        message: error instanceof Error ? error.message : 'Failed to claim result',
      },
      { status: 500 }
    );
  }
}
