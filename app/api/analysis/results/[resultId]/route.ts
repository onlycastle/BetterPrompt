/**
 * Analysis Results API Route
 *
 * Fetches analysis result by ID for web UI
 * Implements tiered access: FREE users see preview data, PAID users see full data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { VerboseEvaluation, PromptPattern, PerDimensionInsight } from '@/lib/models/verbose-evaluation';

interface RouteContext {
  params: Promise<{ resultId: string }>;
}

// ============================================================================
// Preview Configuration
// ============================================================================

const PREVIEW_CONFIG = {
  FULL_ITEMS: 3,      // Number of items to show in full
  PARTIAL_ITEM: true, // Whether to show 4th item truncated
};

/**
 * Truncate text to half length with ellipsis
 */
function truncateText(text: string): string {
  const halfLength = Math.floor(text.length / 2);
  return text.slice(0, halfLength) + '...';
}

/**
 * Create preview evaluation with limited premium data
 * - 3 full items + 4th item truncated
 * - Other premium fields removed
 */
function createPreviewEvaluation(evaluation: VerboseEvaluation): Partial<VerboseEvaluation> {
  // promptPatterns: 3 full + 4th truncated
  const previewPatterns: PromptPattern[] | undefined = evaluation.promptPatterns?.slice(0, 4).map((pattern, idx) => {
    if (idx < PREVIEW_CONFIG.FULL_ITEMS) {
      return pattern;
    }
    // 4th item: truncate description and limit examples
    return {
      ...pattern,
      description: truncateText(pattern.description),
      examples: pattern.examples?.slice(0, 1),
    };
  });

  // dimensionInsights: strengths full, growthAreas 3 full + 4th truncated
  const previewDimensionInsights: PerDimensionInsight[] | undefined = evaluation.dimensionInsights?.map(insight => ({
    ...insight,
    strengths: insight.strengths,
    growthAreas: insight.growthAreas?.slice(0, 4).map((area, idx) => {
      if (idx < PREVIEW_CONFIG.FULL_ITEMS) {
        return area;
      }
      // 4th item: truncate description and recommendation
      return {
        ...area,
        description: truncateText(area.description),
        recommendation: truncateText(area.recommendation),
      };
    }),
  }));

  return {
    // FREE fields - full data
    sessionId: evaluation.sessionId,
    analyzedAt: evaluation.analyzedAt,
    sessionsAnalyzed: evaluation.sessionsAnalyzed,
    avgPromptLength: evaluation.avgPromptLength,
    avgTurnsPerSession: evaluation.avgTurnsPerSession,
    analyzedSessions: evaluation.analyzedSessions,
    primaryType: evaluation.primaryType,
    controlLevel: evaluation.controlLevel,
    distribution: evaluation.distribution,
    personalitySummary: evaluation.personalitySummary,

    // PREMIUM fields - preview only (3 full + 4th truncated)
    promptPatterns: previewPatterns,
    dimensionInsights: previewDimensionInsights,

    // Other PREMIUM fields - removed
    toolUsageDeepDive: undefined,
    tokenEfficiency: undefined,
    growthRoadmap: undefined,
    comparativeInsights: undefined,
    sessionTrends: undefined,
  };
}

/**
 * Calculate preview metadata for frontend display
 */
function getPreviewMetadata(evaluation: VerboseEvaluation) {
  return {
    totalPromptPatterns: evaluation.promptPatterns?.length || 0,
    totalGrowthAreas: evaluation.dimensionInsights?.reduce(
      (sum, d) => sum + (d.growthAreas?.length || 0), 0
    ) || 0,
    previewCount: PREVIEW_CONFIG.FULL_ITEMS,
    hasPartialItem: PREVIEW_CONFIG.PARTIAL_ITEM,
  };
}

/**
 * Get Supabase client
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * GET /api/analysis/results/:resultId
 *
 * Fetch analysis result by ID (for web UI)
 */
export async function GET(
  request: NextRequest,
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

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('analysis_results')
      .select('evaluation, is_paid')
      .eq('result_id', resultId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Result not found', message: 'Analysis result not found. It may have expired.' },
        { status: 404 }
      );
    }

    const evaluation = data.evaluation as VerboseEvaluation;

    // FREE users: return preview data only
    if (!data.is_paid) {
      const previewEvaluation = createPreviewEvaluation(evaluation);
      return NextResponse.json({
        resultId,
        isPaid: false,
        evaluation: previewEvaluation,
        preview: getPreviewMetadata(evaluation),
      });
    }

    // PAID users: return full data
    return NextResponse.json({
      resultId,
      isPaid: true,
      evaluation,
    });
  } catch (error) {
    console.error('Error loading remote result:', error);
    return NextResponse.json(
      {
        error: 'Failed to load result',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
