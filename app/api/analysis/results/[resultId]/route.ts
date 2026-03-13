import { NextRequest, NextResponse } from 'next/server';
import { deleteAnalysisRecord, getAnalysisRecord } from '@/lib/local/analysis-store';
import { getCurrentUserFromRequest } from '@/lib/local/auth';

interface RouteContext {
  params: Promise<{ resultId: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { resultId } = await context.params;
    if (!resultId) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'resultId is required' },
        { status: 400 }
      );
    }

    const result = getAnalysisRecord(resultId);
    if (!result) {
      return NextResponse.json(
        { error: 'Result not found', message: 'Analysis result not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      resultId,
      isPaid: true,
      evaluation: result.evaluation,
    });
  } catch (error) {
    console.error('Error loading analysis result:', error);
    return NextResponse.json(
      {
        error: 'Failed to load result',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { resultId } = await context.params;
    if (!resultId) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'resultId is required' },
        { status: 400 }
      );
    }

    const userId = getCurrentUserFromRequest().id;

    const result = getAnalysisRecord(resultId);
    if (!result) {
      return NextResponse.json(
        { error: 'Not found', message: 'Analysis result not found' },
        { status: 404 }
      );
    }

    if (result.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You can only delete your own reports' },
        { status: 403 }
      );
    }

    const deleted = deleteAnalysisRecord(resultId, userId);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Delete failed', message: 'Failed to delete the analysis result' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting result:', error);
    return NextResponse.json(
      {
        error: 'Delete failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
