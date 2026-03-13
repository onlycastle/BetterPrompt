import { NextResponse } from 'next/server';
import { getOrCreateLocalUser } from '@/lib/local/auth';

export async function GET() {
  try {
    const user = getOrCreateLocalUser();

    return NextResponse.json({
      id: user.id,
      email: user.email,
      role: user.role,
      created_at: user.createdAt,
      organization_id: user.organizationId,
    });
  } catch (error) {
    console.error('[Auth/Me] Error:', error);
    return NextResponse.json(
      { error: 'server_error', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
