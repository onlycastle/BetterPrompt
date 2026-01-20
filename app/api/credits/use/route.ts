/**
 * Use Credit API Route
 *
 * POST: Use a credit to unlock a specific report
 * Requires authentication via cookie or Authorization header
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Create a Supabase server client with cookie access
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
 * Get user from Authorization header (for desktop app)
 */
async function getUserFromAuthHeader(request: NextRequest): Promise<User | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return data.user;
}

/**
 * Get Supabase admin client
 */
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * POST /api/credits/use
 *
 * Use a credit to unlock a report
 * Body: { resultId: string }
 *
 * Returns:
 * - { success: true, creditsRemaining: number } if unlocked
 * - { success: false, reason: 'insufficient_credits' } if no credits
 * - { success: true, alreadyUnlocked: true } if already unlocked
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Get authenticated user
    let user: User | null = await getUserFromAuthHeader(request);

    if (!user) {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to use credits' },
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

    const supabase = getSupabaseAdmin();

    // 3. Check if already unlocked
    const { data: alreadyUnlocked } = await supabase.rpc('has_unlocked_result', {
      p_user_id: user.id,
      p_result_id: resultId,
    });

    if (alreadyUnlocked) {
      // Get current credits
      const { data: creditInfo } = await supabase.rpc('get_user_credit_info', {
        p_user_id: user.id,
      });

      return NextResponse.json({
        success: true,
        alreadyUnlocked: true,
        creditsRemaining: creditInfo?.credits ?? 0,
      });
    }

    // 4. Try to use a credit
    const { data: unlocked, error } = await supabase.rpc('use_credit_for_report', {
      p_user_id: user.id,
      p_result_id: resultId,
    });

    if (error) {
      console.error('[UseCredit] RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to use credit', message: error.message },
        { status: 500 }
      );
    }

    // 5. Get updated credit balance
    const { data: creditInfo } = await supabase.rpc('get_user_credit_info', {
      p_user_id: user.id,
    });

    if (unlocked) {
      return NextResponse.json({
        success: true,
        alreadyUnlocked: false,
        creditsRemaining: creditInfo?.credits ?? 0,
      });
    } else {
      return NextResponse.json({
        success: false,
        reason: 'insufficient_credits',
        creditsRemaining: creditInfo?.credits ?? 0,
      });
    }
  } catch (error) {
    console.error('[UseCredit] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', message: 'Failed to use credit' },
      { status: 500 }
    );
  }
}
