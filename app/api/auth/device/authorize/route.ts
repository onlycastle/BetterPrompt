import { NextRequest, NextResponse } from 'next/server';
import { authorizeDeviceCode, getCurrentUserFromRequest } from '@/lib/local/auth';

interface AuthorizeRequest {
  user_code: string;
}

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

    const user = getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Please sign in first' },
        { status: 401 }
      );
    }

    const normalizedCode = user_code.toUpperCase();
    try {
      authorizeDeviceCode(normalizedCode, user.id);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'invalid_code',
          message: error instanceof Error ? error.message : 'Invalid or expired code',
        },
        { status: 400 }
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
