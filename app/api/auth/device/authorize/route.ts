/**
 * Device Authorization Complete API
 *
 * POST: Complete device authorization after user OAuth
 *
 * Called by the device authorization page after user completes OAuth.
 * Links the user's session to the device code.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
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

interface AuthorizeRequest {
  user_code: string;
}

/**
 * POST /api/auth/device/authorize
 *
 * Complete device authorization
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AuthorizeRequest;
    const { user_code } = body;

    if (!user_code) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Missing user_code' },
        { status: 400 }
      );
    }

    // Get current user from session (they should be logged in)
    const supabase = await createSupabaseServerClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Please sign in first' },
        { status: 401 }
      );
    }

    // Get current session to extract tokens
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'No active session' },
        { status: 401 }
      );
    }

    const admin = getSupabaseAdmin();

    // Find the device code by user_code
    const { data: deviceData, error: lookupError } = await admin
      .from('device_codes')
      .select('*')
      .eq('user_code', user_code.toUpperCase())
      .eq('status', 'pending')
      .single();

    if (lookupError || !deviceData) {
      return NextResponse.json(
        { error: 'invalid_code', message: 'Invalid or expired code' },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date(deviceData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'expired_code', message: 'Code has expired' },
        { status: 400 }
      );
    }

    // Link user to device code and store tokens
    const { error: updateError } = await admin
      .from('device_codes')
      .update({
        status: 'authorized',
        user_id: userData.user.id,
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        authorized_at: new Date().toISOString(),
      })
      .eq('device_code', deviceData.device_code);

    if (updateError) {
      console.error('[DeviceFlow] Failed to authorize:', updateError);
      return NextResponse.json(
        { error: 'server_error', message: 'Failed to authorize device' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Device authorized successfully',
    });
  } catch (error) {
    console.error('[DeviceFlow] Authorize error:', error);
    return NextResponse.json(
      { error: 'server_error', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
