import { NextRequest, NextResponse } from 'next/server';
import {
  applySessionCookie,
  createUser,
  createWebSession,
} from '@/lib/local/auth';

interface SignupRequest {
  email?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SignupRequest;
    const email = body.email?.trim() ?? '';
    const password = body.password ?? '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = createUser(email, password);
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
    const message = error instanceof Error ? error.message : 'Failed to create account';
    const status = message.includes('already exists') || message.includes('at least 6')
      ? 400
      : 500;
    if (status === 500) {
      console.error('[Auth/Signup] Error:', error);
    }
    return NextResponse.json(
      { error: status === 400 ? 'invalid_request' : 'server_error', message },
      { status }
    );
  }
}
