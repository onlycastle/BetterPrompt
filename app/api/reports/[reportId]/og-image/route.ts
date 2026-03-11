import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params;
  const redirectUrl = new URL(`/r/${reportId}/opengraph-image`, request.nextUrl.origin);
  return NextResponse.redirect(redirectUrl);
}
