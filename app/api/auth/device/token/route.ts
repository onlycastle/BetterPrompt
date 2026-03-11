import { NextRequest, NextResponse } from 'next/server';
import { exchangeDeviceCode } from '@/lib/local/auth';

interface TokenRequest {
  device_code: string;
  grant_type: string;
}

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

    const result = exchangeDeviceCode(device_code);
    if (result.status === 'invalid') {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Invalid or unknown device code' },
        { status: 400 }
      );
    }

    if (result.status === 'expired') {
      return NextResponse.json(
        { error: 'expired_token', error_description: 'Device code has expired' },
        { status: 400 }
      );
    }

    if (result.status === 'pending') {
      return NextResponse.json(
        { error: 'authorization_pending', error_description: 'Waiting for user authorization' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      access_token: result.accessToken,
      token_type: 'Bearer',
      expires_in: 30 * 24 * 3600,
    });
  } catch (error) {
    console.error('[DeviceFlow] Token poll error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}
