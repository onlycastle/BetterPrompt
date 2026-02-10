/**
 * Device Flow Token Polling API
 *
 * POST: Poll for authorization status and get tokens
 *
 * Returns:
 * - authorization_pending: User hasn't completed auth yet
 * - access_denied: User denied or code expired
 * - success: Returns access_token and refresh_token
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase admin client with defensive env validation
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('[DeviceFlow/Token] Missing required env vars:', {
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

interface TokenRequest {
  device_code: string;
  grant_type: string;
}

/**
 * POST /api/auth/device/token
 *
 * Poll for device authorization
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as TokenRequest;
    const { device_code, grant_type } = body;

    // Validate request
    if (grant_type !== 'urn:ietf:params:oauth:grant-type:device_code') {
      return NextResponse.json(
        { error: 'unsupported_grant_type', error_description: 'Invalid grant type' },
        { status: 400 }
      );
    }

    if (!device_code) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing device_code' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Look up device code
    const { data: deviceData, error: lookupError } = await supabase
      .from('device_codes')
      .select('*')
      .eq('device_code', device_code)
      .single();

    if (lookupError || !deviceData) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Invalid or unknown device code' },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date(deviceData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'expired_token', error_description: 'Device code has expired' },
        { status: 400 }
      );
    }

    // Check status
    switch (deviceData.status) {
      case 'pending':
        return NextResponse.json(
          { error: 'authorization_pending', error_description: 'Waiting for user authorization' },
          { status: 400 }
        );

      case 'denied':
        return NextResponse.json(
          { error: 'access_denied', error_description: 'User denied authorization' },
          { status: 400 }
        );

      case 'authorized':
        // Get CLI token from stored authorization
        if (!deviceData.user_id || !deviceData.access_token) {
          return NextResponse.json(
            { error: 'server_error', error_description: 'Authorization incomplete' },
            { status: 500 }
          );
        }

        // Mark as used
        await supabase
          .from('device_codes')
          .update({ status: 'used' })
          .eq('device_code', device_code);

        return NextResponse.json({
          access_token: deviceData.access_token,
          token_type: 'Bearer',
          expires_in: 30 * 24 * 3600, // 30 days
        });

      case 'used':
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Device code already used' },
          { status: 400 }
        );

      default:
        return NextResponse.json(
          { error: 'server_error', error_description: 'Unknown status' },
          { status: 500 }
        );
    }
  } catch (error) {
    console.error('[DeviceFlow] Token poll error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}
