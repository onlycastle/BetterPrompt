/**
 * Device Flow Initiation API
 *
 * POST: Start a new device authorization flow
 * Returns device_code, user_code, and verification_uri
 *
 * Implements OAuth 2.0 Device Authorization Grant (RFC 8628)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

// Supabase admin client with defensive env validation
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('[DeviceFlow] Missing required env vars:', {
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

/**
 * Generate a secure random string
 */
function generateSecureCode(length: number): string {
  return randomBytes(length).toString('base64url').slice(0, length);
}

/**
 * Generate a user-friendly code (e.g., ABCD-1234)
 */
function generateUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // No I or O to avoid confusion
  const nums = '23456789'; // No 0 or 1 to avoid confusion

  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  code += '-';
  for (let i = 0; i < 4; i++) {
    code += nums.charAt(Math.floor(Math.random() * nums.length));
  }
  return code;
}

/**
 * POST /api/auth/device
 *
 * Start device authorization flow
 */
export async function POST() {
  try {
    const supabase = getSupabaseAdmin();

    // Generate codes
    const deviceCode = generateSecureCode(48);
    const userCode = generateUserCode();

    // Expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Store in database
    const { error } = await supabase.from('device_codes').insert({
      device_code: deviceCode,
      user_code: userCode,
      expires_at: expiresAt,
      status: 'pending',
    });

    if (error) {
      console.error('[DeviceFlow] Failed to store device code:', error);
      return NextResponse.json(
        { error: 'server_error', error_description: 'Failed to initiate device flow' },
        { status: 500 }
      );
    }

    console.log('[DeviceFlow] Device code created successfully:', {
      userCode,
      expiresAt,
    });

    // Return RFC 8628 compliant response
    const baseUrl = process.env.NOSLOP_BASE_URL || 'https://www.nomoreaislop.app';
    const verificationUri = `${baseUrl}/auth/device`;
    const verificationUriComplete = `${verificationUri}?code=${userCode}`;

    return NextResponse.json({
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: verificationUri,
      verification_uri_complete: verificationUriComplete,
      expires_in: 900, // 15 minutes in seconds
      interval: 5, // Poll every 5 seconds
    });
  } catch (error) {
    console.error('[DeviceFlow] Error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}
