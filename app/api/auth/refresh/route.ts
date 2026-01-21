/**
 * Token Refresh API
 *
 * POST: Refresh access token using refresh token
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface RefreshRequest {
  refresh_token: string;
  grant_type: string;
}

/**
 * POST /api/auth/refresh
 *
 * Refresh access token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RefreshRequest;
    const { refresh_token, grant_type } = body;

    if (grant_type !== 'refresh_token') {
      return NextResponse.json(
        { error: 'unsupported_grant_type', error_description: 'Invalid grant type' },
        { status: 400 }
      );
    }

    if (!refresh_token) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing refresh_token' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error || !data.session) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Invalid or expired refresh token' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      token_type: 'Bearer',
      expires_in: data.session.expires_in,
    });
  } catch (error) {
    console.error('[Auth/Refresh] Error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}
