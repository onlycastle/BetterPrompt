import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const redirectUrl = new URL('/dashboard/analyze', request.nextUrl.origin);
  redirectUrl.searchParams.set('error', 'oauth_removed');
  return NextResponse.redirect(redirectUrl);
}
