import { NextRequest, NextResponse } from 'next/server';
import {
  applySessionCookie,
  authenticateUser,
  createWebSession,
} from '@/lib/local/auth';

interface LoginRequest {
  email?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as LoginRequest;
    const email = body.email?.trim() ?? '';
    const password = body.password ?? '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = authenticateUser(email, password);
    if (!user) {
      return NextResponse.json(
        { error: 'invalid_credentials', message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const { sessionToken, expiresAt } = createWebSession(user.id);
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.createdAt,
      },
    });
    applySessionCookie(response, sessionToken, expiresAt);
    return response;
  } catch (error) {
    console.error('[Auth/Login] Error:', error);
    return NextResponse.json(
      { error: 'server_error', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
