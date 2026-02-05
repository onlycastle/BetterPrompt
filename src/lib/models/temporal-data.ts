/**
 * Temporal Data - Zod schemas for time-based analysis
 *
 * REDESIGNED: Now separates measurable metrics from LLM insights:
 * - TemporalMetrics (temporal-metrics.ts): 100% deterministic calculations
 * - TemporalInsightsOutput: LLM-generated narrative insights based on metrics
 *
 * The LLM no longer calculates rates - it interprets pre-calculated metrics
 * and generates human-readable insights.
 *
 * @module models/temporal-data
 */

import { z } from 'zod';
import { TemporalMetricsSchema, type TemporalMetrics } from './temporal-metrics';

// ============================================================================
// Parsed Types (for storage/display - full nested objects)
// ============================================================================

/**
 * Hourly pattern metrics
 */
export interface HourlyPattern {
  hour: number;
  sampleCount: number;
  counterQuestionRate: number;
  criticalInterpretationRate: number;
  verificationRequestRate: number;
  typoRate: number;
  passiveAcceptanceRate: number;
}

/**
 * Peak hours info
 */
export interface PeakHoursInfo {
  hours: number[];
  characteristics: string;
  evidence: {
    avgCounterQuestionRate: number;
    avgCriticalInterpretationRate: number;
    avgVerificationRate: number;
  };
}

/**
 * Caution hours info
 */
export interface CautionHoursInfo {
  hours: number[];
  characteristics: string;
  evidence: {
    passiveAcceptanceRate: number;
    typoRate: number;
    criticalThinkingDrop: number; // % drop from peak
  };
}

/**
 * Fatigue pattern type
 */
export type FatiguePatternType =
  | 'late_night_drop'
  | 'post_lunch_dip'
  | 'end_of_day_rush'
  | 'typo_spike';

/**
 * Fatigue pattern
 */
export interface FatiguePattern {
  type: FatiguePatternType;
  hours: number[];
  evidence: string;
  recommendation: string;
}

/**
 * Qualitative insight type
 */
export type QualitativeInsightType = 'strength' | 'improvement';

/**
 * Qualitative insight
 */
export interface QualitativeInsight {
  type: QualitativeInsightType;
  insight: string;
  evidence: string;
  linkedHours: number[];
}

/**
 * Full temporal analysis result (parsed from LLM output)
 */
export interface TemporalAnalysis {
  hourlyPatterns: HourlyPattern[];
  peakHours: PeakHoursInfo;
  cautionHours: CautionHoursInfo;
  fatiguePatterns: FatiguePattern[];
  qualitativeInsights: QualitativeInsight[];
  topInsights: string[];
  confidenceScore: number;
}

// ============================================================================
// Insights-Only Schema (LLM interprets metrics, doesn't calculate them)
// ============================================================================

/**
 * Temporal Insights Output Schema
 *
 * The LLM receives pre-calculated TemporalMetrics and generates:
 * 1. Human-readable activity pattern description
 * 2. Strengths based on engagement signals
 * 3. Growth areas with time-based recommendations
 * 4. Top 3 actionable insights
 *
 * NO rate calculations - all numbers come from TemporalMetrics.
 */
export const TemporalInsightsOutputSchema = z.object({
  // Activity pattern narrative (based on heatmap data)
  activityPatternSummary: z
    .string()
    .describe(
      'Human-readable summary of when the user is most active (e.g., "Most active during morning hours, particularly 9-11 AM on weekdays")'
    ),

  // Session style description
  sessionStyleSummary: z
    .string()
    .describe(
      'Description of typical session patterns (e.g., "Prefers longer, deep-dive sessions averaging 25 minutes with 8+ turns")'
    ),

  // Top 3 temporal insights (actionable, sliced to 3 since Gemini's maxItems constraint is removed)
  topInsights: z
    .array(z.string())
    .transform((arr) => arr.slice(0, 3))
    .describe('Top 3 actionable insights about temporal patterns'),

  // Strengths with evidence (2-3 items)
  // Format: "title|description|evidence1,evidence2;..."
  strengthsData: z
    .string()
    .describe(
      'Temporal strengths: "title|description|metric-based evidence;..." (e.g., "Consistent Deep Engagement|You frequently engage in sessions with 5+ turns...|deepSessionRate: 65%")'
    ),

  // Growth areas with recommendations (2-3 items)
  // Format: "title|description|evidence|recommendation;..."
  growthAreasData: z
    .string()
    .describe(
      'Temporal growth areas: "title|description|evidence|recommendation;..." (focus on time-based patterns, NOT fatigue accusations)'
    ),

  // Confidence based on sample size
  confidenceScore: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence based on data volume (sessions, messages analyzed)'),
});

export type TemporalInsightsOutput = z.infer<typeof TemporalInsightsOutputSchema>;

/**
 * Combined Temporal Analysis Result (new format)
 *
 * Contains both:
 * 1. Deterministic metrics (from calculator)
 * 2. LLM-generated insights (from TemporalInsightsOutput)
 */
export interface TemporalAnalysisResult {
  // 100% measurable metrics
  metrics: TemporalMetrics;

  // LLM-generated insights
  insights: TemporalInsightsOutput;
}

/**
 * Zod schema for TemporalAnalysisResult (for validation)
 */
export const TemporalAnalysisResultSchema = z.object({
  metrics: TemporalMetricsSchema,
  insights: TemporalInsightsOutputSchema,
});

/**
 * Parse strengths data from new format
 * Format: "title|description|evidence;..."
 */
export function parseTemporalStrengthsData(
  data: string | undefined
): Array<{ title: string; description: string; evidence: string[] }> {
  if (!data) return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      return {
        title: parts[0] || '',
        description: parts[1] || '',
        evidence: parts[2]?.split(',').filter(Boolean) || [],
      };
    });
}

/**
 * Parse growth areas data from new format
 * Format: "title|description|evidence|recommendation;..."
 */
export function parseTemporalGrowthAreasData(
  data: string | undefined
): Array<{ title: string; description: string; evidence: string; recommendation: string }> {
  if (!data) return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      return {
        title: parts[0] || '',
        description: parts[1] || '',
        evidence: parts[2] || '',
        recommendation: parts[3] || '',
      };
    });
}

/**
 * Create default temporal insights output
 */
export function createDefaultTemporalInsightsOutput(): TemporalInsightsOutput {
  return {
    activityPatternSummary: '',
    sessionStyleSummary: '',
    topInsights: [],
    strengthsData: '',
    growthAreasData: '',
    confidenceScore: 0,
  };
}
