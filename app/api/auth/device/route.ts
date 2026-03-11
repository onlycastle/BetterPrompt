import { NextResponse } from 'next/server';
import { createDeviceAuthorization } from '@/lib/local/auth';

export async function POST() {
  try {
    const { deviceCode, userCode } = createDeviceAuthorization();

    const baseUrl = process.env.NOSLOP_BASE_URL || 'http://localhost:3000';
    const verificationUri = `${baseUrl}/auth/device`;
    const verificationUriComplete = `${verificationUri}?user_code=${userCode}`;

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
