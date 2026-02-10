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
import { sendSlackNotification, formatKoreanTime } from '@/lib/slack';
import { createCliTokenForUser } from '@/lib/auth/cli-token';

/**
 * Create a Supabase server client with cookie access
 */
async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error('[DeviceFlow/Authorize] Missing required env vars:', {
      hasUrl: !!url,
      hasAnonKey: !!anonKey,
    });
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required');
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
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
  });
}

/**
 * Get Supabase admin client with defensive env validation
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('[DeviceFlow/Authorize] Missing required env vars for admin:', {
      hasUrl: !!url,
      hasServiceKey: !!serviceKey,
    });
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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

    const admin = getSupabaseAdmin();

    // Find the device code by user_code
    const normalizedCode = user_code.toUpperCase();
    console.log('[DeviceFlow/Authorize] Looking up device code:', { userCode: normalizedCode });

    const { data: deviceData, error: lookupError } = await admin
      .from('device_codes')
      .select('*')
      .eq('user_code', normalizedCode)
      .eq('status', 'pending')
      .single();

    if (lookupError || !deviceData) {
      console.error('[DeviceFlow/Authorize] Device code lookup failed:', {
        userCode: normalizedCode,
        error: lookupError?.message || 'No matching device code found',
        code: lookupError?.code,
      });
      return NextResponse.json(
        { error: 'invalid_code', message: 'Invalid or expired code' },
        { status: 400 }
      );
    }

    console.log('[DeviceFlow/Authorize] Device code found:', {
      userCode: normalizedCode,
      status: deviceData.status,
      expiresAt: deviceData.expires_at,
    });

    // Check if expired
    if (new Date(deviceData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'expired_code', message: 'Code has expired' },
        { status: 400 }
      );
    }

    // Create a dedicated CLI token (independent of browser session)
    const cliToken = await createCliTokenForUser(userData.user.id);

    // Link user to device code and store CLI token
    const { error: updateError } = await admin
      .from('device_codes')
      .update({
        status: 'authorized',
        user_id: userData.user.id,
        access_token: cliToken,
        refresh_token: null,
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

    // Send Slack notification for new signups via CLI (fire and forget)
    if (userData.user.created_at) {
      const createdAt = new Date(userData.user.created_at).getTime();
      const now = Date.now();
      const ONE_MINUTE = 60 * 1000;

      if (now - createdAt < ONE_MINUTE) {
        const provider = userData.user.app_metadata?.provider || 'email';
        sendSlackNotification({
          text: `👤 New Signup (CLI)\n• Email: ${userData.user.email}\n• Provider: ${provider}\n• Time: ${formatKoreanTime()}`,
        });
      }
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
