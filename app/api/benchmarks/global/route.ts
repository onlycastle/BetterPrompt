/**
 * Global Benchmarks API Route
 *
 * Public endpoint (no auth required) that returns aggregate benchmark data
 * for the current month: type distribution, total analyses, and percentile
 * distributions for each worker domain score.
 *
 * Data is populated by the refresh_aggregate_stats() SQL function which
 * should be called periodically (e.g., via cron or after each analysis).
 */

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Shape of a domain's percentile distribution stored in aggregate_stats */
interface DomainPercentiles {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  count: number;
}

interface AggregateStatsRow {
  period_start: string;
  total_analyses: number;
  total_shares: number;
  type_distribution: Record<string, number>;
  thinking_quality_percentiles: DomainPercentiles;
  communication_percentiles: DomainPercentiles;
  learning_behavior_percentiles: DomainPercentiles;
  context_efficiency_percentiles: DomainPercentiles;
  session_outcome_percentiles: DomainPercentiles;
  updated_at: string;
}

export async function GET() {
  try {
    const supabase = getSupabase();

    // Fetch aggregate stats for the current month
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const periodStart = currentMonth.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('aggregate_stats')
      .select(
        'period_start, total_analyses, total_shares, type_distribution, ' +
        'thinking_quality_percentiles, communication_percentiles, ' +
        'learning_behavior_percentiles, context_efficiency_percentiles, ' +
        'session_outcome_percentiles, updated_at'
      )
      .eq('period_start', periodStart)
      .single();

    if (error) {
      // PGRST116 = no rows returned (not an error, just no data yet)
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          {
            benchmarks: null,
            message: 'No benchmark data available for current month',
          },
          { status: 200 }
        );
      }

      console.error('[benchmarks/global] Failed to fetch aggregate stats:', error);
      throw new Error(`Failed to fetch aggregate stats: ${error.message}`);
    }

    const row = data as unknown as AggregateStatsRow;

    return NextResponse.json({
      benchmarks: {
        period: row.period_start,
        totalAnalyses: row.total_analyses,
        totalShares: row.total_shares,
        typeDistribution: row.type_distribution,
        domainPercentiles: {
          thinkingQuality: row.thinking_quality_percentiles,
          communicationPatterns: row.communication_percentiles,
          learningBehavior: row.learning_behavior_percentiles,
          contextEfficiency: row.context_efficiency_percentiles,
          sessionOutcome: row.session_outcome_percentiles,
        },
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('[benchmarks/global] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
