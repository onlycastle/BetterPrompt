import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/authenticate-request';
import { listAnalysesForUser } from '@/lib/local/analysis-store';
import { getCurrentUserFromRequest } from '@/lib/local/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const authResult = authHeader ? await authenticateRequest(authHeader) : null;
    const userId = authResult?.userId ?? getCurrentUserFromRequest(request)?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to view your analyses.' },
        { status: 401 }
      );
    }

    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const analyses = listAnalysesForUser(
      userId,
      Number.isFinite(limit) && limit && limit > 0 ? limit : undefined
    ).map((record) => ({
      id: record.resultId,
      resultId: record.resultId,
      evaluation: record.evaluation,
      isPaid: true,
      claimedAt: record.claimedAt,
      expiresAt: null,
      source: 'local' as const,
    }));

    return NextResponse.json({
      analyses,
      count: analyses.length,
    });
  } catch (error) {
    console.error('[Analysis/User] Error:', error);
    return NextResponse.json(
      {
        error: 'Fetch Failed',
        message: error instanceof Error ? error.message : 'Failed to fetch analyses.',
      },
      { status: 500 }
    );
  }
}
