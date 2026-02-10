/**
 * User Info API
 *
 * GET: Get current user's info from access token
 *
 * Supports both CLI tokens (cli_*) and Supabase JWTs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from '@/lib/auth/authenticate-request';

/**
 * GET /api/auth/me
 *
 * Returns user info from Bearer token
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const authResult = await authenticateRequest(authHeader);

    if (!authResult) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // For CLI tokens, look up user via admin API since we only have userId
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'server_error', message: 'Server configuration error' },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error } = await admin.auth.admin.getUserById(authResult.userId);

    if (error || !user) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'User not found' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    });
  } catch (error) {
    console.error('[Auth/Me] Error:', error);
    return NextResponse.json(
      { error: 'server_error', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
