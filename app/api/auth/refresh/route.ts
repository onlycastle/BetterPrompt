import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.grant_type !== 'refresh_token') {
      return NextResponse.json(
        { error: 'unsupported_grant_type', error_description: 'Invalid grant type' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'unsupported_grant_type',
        error_description: 'Local auth uses long-lived session and CLI tokens; refresh tokens are not issued.',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Auth/Refresh] Error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}
