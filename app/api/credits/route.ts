/**
 * Credits API Route
 *
 * GET: Get user's current credit balance and info
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
 * GET /api/credits
 *
 * Returns user's credit balance and info
 */
export async function GET(request: NextRequest) {
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
        { error: 'Unauthorized', message: 'Please sign in to view credits' },
        { status: 401 }
      );
    }

    // 2. Get credit info using RPC
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('get_user_credit_info', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('[Credits] Failed to get credit info:', error);
      return NextResponse.json(
        { error: 'Failed to get credits', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      userId: user.id,
      credits: data?.credits ?? 1,
      totalUsed: data?.totalUsed ?? 0,
      hasPaid: data?.hasPaid ?? false,
      firstPaidAt: data?.firstPaidAt ?? null,
    });
  } catch (error) {
    console.error('[Credits] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', message: 'Failed to get credit info' },
      { status: 500 }
    );
  }
}
