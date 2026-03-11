import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/authenticate-request';
import { getAnalysisRecord } from '@/lib/local/analysis-store';
import { getCurrentUserFromRequest } from '@/lib/local/auth';

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const authResult = await authenticateRequest(authHeader);
    return authResult?.userId ?? null;
  }

  return getCurrentUserFromRequest(request)?.id ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to claim this result' },
        { status: 401 }
      );
    }

    const body = await request.json() as { resultId?: string };
    if (!body.resultId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'resultId is required' },
        { status: 400 }
      );
    }

    const result = getAnalysisRecord(body.resultId);
    if (!result) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Analysis result not found' },
        { status: 404 }
      );
    }

    if (result.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'This result belongs to another user' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Result already belongs to this account',
      resultId: body.resultId,
    });
  } catch (error) {
    console.error('Claim error:', error);
    return NextResponse.json(
      {
        error: 'Claim Failed',
        message: error instanceof Error ? error.message : 'Failed to claim result',
      },
      { status: 500 }
    );
  }
}
