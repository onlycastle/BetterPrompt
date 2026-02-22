import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getExpectedToken(): string | null {
  return process.env.MAINTENANCE_TOKEN ?? null;
}

function getRequestToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  const legacyToken = request.headers.get('x-maintenance-token');
  if (legacyToken) {
    return legacyToken.trim();
  }

  return null;
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service-role credentials are required');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: NextRequest) {
  const expectedToken = getExpectedToken();
  const requestToken = getRequestToken(request);

  if (!expectedToken || !requestToken || requestToken !== expectedToken) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid or missing maintenance token' },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();

    const [{ data: deletedShared, error: sharedDeleteError }, { data: deletedAnalyses, error: analysisDeleteError }] =
      await Promise.all([
        supabase
          .from('shared_reports')
          .delete()
          .not('expires_at', 'is', null)
          .lt('expires_at', now)
          .select('id'),
        supabase
          .from('analysis_results')
          .delete()
          .not('expires_at', 'is', null)
          .lt('expires_at', now)
          .select('result_id'),
      ]);

    if (sharedDeleteError) {
      return NextResponse.json(
        {
          error: 'Cleanup failed',
          message: sharedDeleteError.message || 'Failed to delete expired shared reports',
        },
        { status: 500 }
      );
    }

    if (analysisDeleteError) {
      return NextResponse.json(
        {
          error: 'Cleanup failed',
          message: analysisDeleteError.message || 'Failed to delete expired analysis results',
        },
        { status: 500 }
      );
    }

    const sharedCount = deletedShared?.length ?? 0;
    const analysisCount = deletedAnalyses?.length ?? 0;

    return NextResponse.json({
      success: true,
      deleted: {
        sharedReports: sharedCount,
        analysisResults: analysisCount,
        total: sharedCount + analysisCount,
      },
      deletedAt: now,
      message: 'Expired reports cleanup completed',
    });
  } catch (error) {
    console.error('Error cleaning up expired reports:', error);
    return NextResponse.json(
      {
        error: 'Cleanup failed',
        message: error instanceof Error ? error.message : 'Failed to clean up expired reports',
      },
      { status: 500 }
    );
  }
}

