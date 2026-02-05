/**
 * User Progress API Route
 *
 * Returns PersonalAnalytics data for the authenticated user.
 * Aggregates all analysis results to build growth tracking data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { PersonalAnalytics, AnalysisSummary, HistoryEntry } from '@/types/personal';
import type { DimensionScores, CodingStyleType, AIControlLevel } from '@/types/enterprise';

interface AnalysisResult {
  result_id: string;
  evaluation: {
    primaryType?: CodingStyleType;
    controlLevel?: AIControlLevel;
    overallScore?: number;
    dimensionInsights?: Array<{
      dimension: keyof DimensionScores;
      score?: number;
    }>;
    // Legacy format dimensions
    dimensions?: DimensionScores;
  } | null;
  is_paid: boolean;
  claimed_at: string;
}

/**
 * Create a Supabase server client with cookie access (for auth)
 */
async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

/**
 * Create a Supabase admin client (for DB queries)
 */
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase configuration missing');
  }

  return createClient(supabaseUrl, serviceKey);
}

/**
 * Extract dimension scores from evaluation object
 * Handles both new format (dimensionInsights array) and legacy format (dimensions object)
 */
function extractDimensionScores(evaluation: AnalysisResult['evaluation']): DimensionScores | null {
  if (!evaluation) return null;

  // Try legacy format first (direct dimensions object)
  if (evaluation.dimensions) {
    return evaluation.dimensions;
  }

  // Try new format (dimensionInsights array)
  if (evaluation.dimensionInsights && Array.isArray(evaluation.dimensionInsights)) {
    const scores: Partial<DimensionScores> = {};
    for (const insight of evaluation.dimensionInsights) {
      if (insight.dimension && typeof insight.score === 'number') {
        scores[insight.dimension] = insight.score;
      }
    }
    // Only return if we have all 6 dimensions
    if (Object.keys(scores).length >= 6) {
      return scores as DimensionScores;
    }
  }

  return null;
}

/**
 * Calculate overall score from dimension scores
 * Uses weighted average (burnoutRisk is inverted since lower is better)
 */
function calculateOverallScore(dimensions: DimensionScores): number {
  const { aiCollaboration, contextEngineering, burnoutRisk, toolMastery, aiControl, skillResilience } = dimensions;
  // Invert burnout risk (100 - burnoutRisk) so lower burnout = higher contribution
  const invertedBurnout = 100 - burnoutRisk;
  const total = aiCollaboration + contextEngineering + invertedBurnout + toolMastery + aiControl + skillResilience;
  return Math.round(total / 6);
}

/**
 * Calculate streak from analysis dates
 * A streak is consecutive analyses (with reasonable gaps allowed)
 */
function calculateStreak(dates: Date[]): { current: number; longest: number } {
  if (dates.length === 0) return { current: 0, longest: 0 };
  if (dates.length === 1) return { current: 1, longest: 1 };

  // Sort dates in ascending order
  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());

  let currentStreak = 1;
  let longestStreak = 1;
  let tempStreak = 1;

  // Check from oldest to newest
  for (let i = 1; i < sortedDates.length; i++) {
    const daysDiff = Math.floor(
      (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
    );

    // Consider streak broken if more than 14 days between analyses
    if (daysDiff <= 14) {
      tempStreak++;
    } else {
      tempStreak = 1;
    }

    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }
  }

  // Current streak: count from most recent going backwards
  currentStreak = 1;
  for (let i = sortedDates.length - 1; i > 0; i--) {
    const daysDiff = Math.floor(
      (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff <= 14) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { current: currentStreak, longest: longestStreak };
}

/**
 * Calculate dimension improvements (latest - first)
 */
function calculateDimensionImprovements(
  first: DimensionScores,
  latest: DimensionScores
): DimensionScores {
  return {
    aiCollaboration: latest.aiCollaboration - first.aiCollaboration,
    contextEngineering: latest.contextEngineering - first.contextEngineering,
    burnoutRisk: latest.burnoutRisk - first.burnoutRisk,
    toolMastery: latest.toolMastery - first.toolMastery,
    aiControl: latest.aiControl - first.aiControl,
    skillResilience: latest.skillResilience - first.skillResilience,
  };
}

/**
 * Build AnalysisSummary from a result
 */
function buildAnalysisSummary(result: AnalysisResult, dimensions: DimensionScores): AnalysisSummary {
  const overallScore = result.evaluation?.overallScore ?? calculateOverallScore(dimensions);
  return {
    date: result.claimed_at,
    score: overallScore,
    overallScore,
    primaryType: result.evaluation?.primaryType ?? 'conductor',
    controlLevel: result.evaluation?.controlLevel ?? 'explorer',
    dimensions,
  };
}

export async function GET(request: NextRequest) {
  try {
    // 1. Verify user is authenticated
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to view your progress' },
        { status: 401 }
      );
    }

    // 2. Fetch user's claimed analyses from analysis_results
    const adminClient = getSupabaseAdmin();

    const { data: results, error: fetchError } = await adminClient
      .from('analysis_results')
      .select('result_id, evaluation, is_paid, claimed_at')
      .eq('user_id', user.id)
      .order('claimed_at', { ascending: true }); // Oldest first for history

    if (fetchError) {
      console.error('Failed to fetch user analyses:', fetchError);
      return NextResponse.json(
        { error: 'Fetch Failed', message: 'Failed to fetch your analyses' },
        { status: 500 }
      );
    }

    // 3. Handle no analyses case
    if (!results || results.length === 0) {
      return NextResponse.json({ analytics: null });
    }

    // 4. Process results to build PersonalAnalytics
    const validResults: Array<{ result: AnalysisResult; dimensions: DimensionScores }> = [];

    for (const result of results as AnalysisResult[]) {
      const dimensions = extractDimensionScores(result.evaluation);
      if (dimensions) {
        validResults.push({ result, dimensions });
      }
    }

    // If no valid dimension data, return null analytics
    if (validResults.length === 0) {
      return NextResponse.json({ analytics: null });
    }

    const firstValid = validResults[0];
    const latestValid = validResults[validResults.length - 1];

    // Build history entries
    const history: HistoryEntry[] = validResults.map(({ result, dimensions }) => ({
      date: result.claimed_at.split('T')[0], // Just the date part
      overallScore: result.evaluation?.overallScore ?? calculateOverallScore(dimensions),
      dimensions,
    }));

    // Calculate streaks
    const analysisDates = validResults.map(({ result }) => new Date(result.claimed_at));
    const { current: currentStreak, longest: longestStreak } = calculateStreak(analysisDates);

    // Build first and latest analysis summaries
    const firstAnalysis = buildAnalysisSummary(firstValid.result, firstValid.dimensions);
    const latestAnalysis = buildAnalysisSummary(latestValid.result, latestValid.dimensions);

    // Calculate improvements
    const dimensionImprovements = calculateDimensionImprovements(
      firstValid.dimensions,
      latestValid.dimensions
    );
    const totalImprovement = latestAnalysis.overallScore - firstAnalysis.overallScore;

    // Build PersonalAnalytics response
    const analytics: PersonalAnalytics = {
      currentType: latestAnalysis.primaryType,
      firstAnalysisDate: firstValid.result.claimed_at,
      analysisCount: validResults.length,
      totalImprovement,

      currentDimensions: latestValid.dimensions,
      dimensionImprovements,

      firstAnalysis,
      latestAnalysis,

      journey: {
        totalAnalyses: validResults.length,
        currentStreak,
        longestStreak,
      },

      history,
      recommendations: [], // Recommendations can be added later
    };

    return NextResponse.json({ analytics });

  } catch (error) {
    console.error('User progress fetch error:', error);
    return NextResponse.json(
      {
        error: 'Fetch Failed',
        message: error instanceof Error ? error.message : 'Failed to fetch progress',
      },
      { status: 500 }
    );
  }
}
