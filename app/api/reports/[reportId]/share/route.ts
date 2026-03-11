import { NextRequest, NextResponse } from 'next/server';
import { getAnalysisRecord, incrementAnalysisShare } from '@/lib/local/analysis-store';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    if (!reportId) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'reportId is required.' },
        { status: 400 }
      );
    }

    const result = getAnalysisRecord(reportId);
    if (!result) {
      return NextResponse.json(
        { error: 'Report not found', message: 'Analysis result not found.' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    incrementAnalysisShare(reportId);

    return NextResponse.json({
      success: true,
      platform: typeof body.platform === 'string' ? body.platform : 'unknown',
    });
  } catch (error) {
    console.error('[Reports/Share] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
