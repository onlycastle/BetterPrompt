import { NextRequest, NextResponse } from 'next/server';
import {
  clearSessionCookie,
  getWebSessionCookie,
  invalidateWebSession,
} from '@/lib/local/auth';

export async function POST(request: NextRequest) {
  try {
    const sessionToken = getWebSessionCookie(request);
    if (sessionToken) {
      invalidateWebSession(sessionToken);
    }

    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error('[Auth/Logout] Error:', error);
    return NextResponse.json(
      { error: 'server_error', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
