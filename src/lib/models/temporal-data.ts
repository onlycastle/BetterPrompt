/**
 * Temporal Data - Zod schemas for time-based prompt performance analysis
 *
 * Detects:
 * - Qualitative interaction patterns by hour (counter-questioning, critical thinking)
 * - Fatigue signals (typo rate, passive acceptance, short responses)
 * - Peak performance hours vs caution zones
 *
 * Schemas use flattened semicolon-separated strings to comply with
 * Gemini's 4-level nesting limit.
 *
 * @module models/temporal-data
 */

import { z } from 'zod';

// ============================================================================
// Temporal Analysis Output Schema (LLM-friendly, flattened)
// ============================================================================

/**
 * Temporal Analysis Output Schema
 *
 * Analyzes time-based prompt quality using QUALITATIVE metrics:
 * - Counter-questioning rate
 * - Critical interpretation rate
 * - Verification request rate
 * - Typo rate & passive acceptance (fatigue indicators)
 *
 * @example
 * ```json
 * {
 *   "hourlyPatternsData": "10:25:0.35:0.28:0.22:0.05:0.08;11:30:0.32:0.25:0.20:0.06:0.10;22:15:0.12:0.08:0.05:0.18:0.35",
 *   "peakHoursData": "10,11,14,15|Most counter-questioning and critical review of AI at 10-11 AM|0.35:0.28:0.22",
 *   "cautionHoursData": "22,23,0,1|Higher passive acceptance of AI output at night|0.35:0.18:-0.60",
 *   "fatiguePatternsData": "late_night_drop|22,23,0,1|Counter-questioning 60% decrease, typos doubled|Defer important decisions to peak hours;typo_spike|23,0|Typo rate 200% increase after 23:00|Work after sufficient rest",
 *   "qualitativeInsightsData": "strength|Carefully reviews AI suggestions in the morning|Counter-questioning rate 35%|10,11;improvement|Lack of verification at night|Verification request rate dropped to 5%|22,23",
 *   "topInsights": [
 *     "Most critical review of AI output during 10-11 AM",
 *     "Tendency to accept AI output without questioning increases after 22:00",
 *     "Nighttime typo rate is 2x daytime - fatigue signal"
 *   ],
 *   "confidenceScore": 0.82
 * }
 * ```
 */
export const TemporalAnalysisOutputSchema = z.object({
  // Hourly patterns - "hour:sampleCount:counterQuestionRate:criticalRate:verificationRate:typoRate:passiveAcceptanceRate;..."
  hourlyPatternsData: z
    .string()
    .max(3000)
    .describe(
      'Hourly quality metrics: "hour:sampleCount:counterQuestionRate:criticalRate:verificationRate:typoRate:passiveAcceptanceRate;..."'
    ),

  // Peak hours - "hours|characteristics|evidence(counterQ:critical:verification)"
  peakHoursData: z
    .string()
    .max(500)
    .describe(
      'Best hours: "hours(comma-sep)|characteristics|avgCounterQ:avgCritical:avgVerification"'
    ),

  // Caution hours - "hours|characteristics|evidence(passiveRate:typoRate:criticalDrop)"
  cautionHoursData: z
    .string()
    .max(500)
    .describe(
      'Caution hours: "hours(comma-sep)|characteristics|passiveAcceptanceRate:typoRate:criticalThinkingDrop%"'
    ),

  // Fatigue patterns - "type|hours|evidence|recommendation;..."
  // type: late_night_drop | post_lunch_dip | end_of_day_rush | typo_spike
  fatiguePatternsData: z
    .string()
    .max(1500)
    .describe(
      'Fatigue patterns: "type|hours(comma-sep)|evidence|recommendation;..."'
    ),

  // Qualitative insights - "type|insight|evidence|linkedHours;..."
  // type: strength | improvement
  qualitativeInsightsData: z
    .string()
    .max(1500)
    .describe(
      'Insights: "type(strength/improvement)|insight|evidence|linkedHours(comma-sep);..."'
    ),

  // Top 3 temporal insights
  topInsights: z.array(z.string().max(3000)).max(3),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),
});

export type TemporalAnalysisOutput = z.infer<typeof TemporalAnalysisOutputSchema>;

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
// Parser Functions
// ============================================================================

/**
 * Parse hourly patterns data from flattened string
 *
 * @param data - "hour:sampleCount:counterQ:critical:verification:typo:passive;..."
 * @returns Parsed hourly patterns
 */
export function parseHourlyPatternsData(data: string | undefined): HourlyPattern[] {
  if (!data) return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(':');
      return {
        hour: parseInt(parts[0], 10) || 0,
        sampleCount: parseInt(parts[1], 10) || 0,
        counterQuestionRate: parseFloat(parts[2]) || 0,
        criticalInterpretationRate: parseFloat(parts[3]) || 0,
        verificationRequestRate: parseFloat(parts[4]) || 0,
        typoRate: parseFloat(parts[5]) || 0,
        passiveAcceptanceRate: parseFloat(parts[6]) || 0,
      };
    });
}

/**
 * Parse peak hours data from flattened string
 *
 * @param data - "hours|characteristics|counterQ:critical:verification"
 * @returns Parsed peak hours info
 */
export function parsePeakHoursData(data: string | undefined): PeakHoursInfo {
  const defaults: PeakHoursInfo = {
    hours: [],
    characteristics: '',
    evidence: {
      avgCounterQuestionRate: 0,
      avgCriticalInterpretationRate: 0,
      avgVerificationRate: 0,
    },
  };

  if (!data) return defaults;

  const parts = data.split('|');
  if (parts.length >= 3) {
    defaults.hours = parts[0].split(',').map((h) => parseInt(h, 10)).filter((h) => !isNaN(h));
    defaults.characteristics = parts[1] || '';
    const evidenceParts = parts[2].split(':');
    defaults.evidence = {
      avgCounterQuestionRate: parseFloat(evidenceParts[0]) || 0,
      avgCriticalInterpretationRate: parseFloat(evidenceParts[1]) || 0,
      avgVerificationRate: parseFloat(evidenceParts[2]) || 0,
    };
  }

  return defaults;
}

/**
 * Parse caution hours data from flattened string
 *
 * @param data - "hours|characteristics|passiveRate:typoRate:criticalDrop"
 * @returns Parsed caution hours info
 */
export function parseCautionHoursData(data: string | undefined): CautionHoursInfo {
  const defaults: CautionHoursInfo = {
    hours: [],
    characteristics: '',
    evidence: {
      passiveAcceptanceRate: 0,
      typoRate: 0,
      criticalThinkingDrop: 0,
    },
  };

  if (!data) return defaults;

  const parts = data.split('|');
  if (parts.length >= 3) {
    defaults.hours = parts[0].split(',').map((h) => parseInt(h, 10)).filter((h) => !isNaN(h));
    defaults.characteristics = parts[1] || '';
    const evidenceParts = parts[2].split(':');
    defaults.evidence = {
      passiveAcceptanceRate: parseFloat(evidenceParts[0]) || 0,
      typoRate: parseFloat(evidenceParts[1]) || 0,
      criticalThinkingDrop: parseFloat(evidenceParts[2]) || 0,
    };
  }

  return defaults;
}

/**
 * Parse fatigue patterns data from flattened string
 *
 * @param data - "type|hours|evidence|recommendation;..."
 * @returns Parsed fatigue patterns
 */
export function parseFatiguePatternsData(data: string | undefined): FatiguePattern[] {
  if (!data) return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      return {
        type: (parts[0] || 'late_night_drop') as FatiguePatternType,
        hours: parts[1]?.split(',').map((h) => parseInt(h, 10)).filter((h) => !isNaN(h)) || [],
        evidence: parts[2] || '',
        recommendation: parts[3] || '',
      };
    });
}

/**
 * Parse qualitative insights data from flattened string
 *
 * @param data - "type|insight|evidence|linkedHours;..."
 * @returns Parsed qualitative insights
 */
export function parseQualitativeInsightsData(data: string | undefined): QualitativeInsight[] {
  if (!data) return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      return {
        type: (parts[0] || 'strength') as QualitativeInsightType,
        insight: parts[1] || '',
        evidence: parts[2] || '',
        linkedHours: parts[3]?.split(',').map((h) => parseInt(h, 10)).filter((h) => !isNaN(h)) || [],
      };
    });
}

/**
 * Parse full TemporalAnalysisOutput into TemporalAnalysis
 *
 * @param output - LLM output (flattened)
 * @returns Parsed analysis
 */
export function parseTemporalAnalysisOutput(output: TemporalAnalysisOutput): TemporalAnalysis {
  return {
    hourlyPatterns: parseHourlyPatternsData(output.hourlyPatternsData),
    peakHours: parsePeakHoursData(output.peakHoursData),
    cautionHours: parseCautionHoursData(output.cautionHoursData),
    fatiguePatterns: parseFatiguePatternsData(output.fatiguePatternsData),
    qualitativeInsights: parseQualitativeInsightsData(output.qualitativeInsightsData),
    topInsights: output.topInsights || [],
    confidenceScore: output.confidenceScore,
  };
}

// ============================================================================
// Default/Empty Values
// ============================================================================

/**
 * Create default/empty temporal analysis output
 */
export function createDefaultTemporalAnalysisOutput(): TemporalAnalysisOutput {
  return {
    hourlyPatternsData: '',
    peakHoursData: '',
    cautionHoursData: '',
    fatiguePatternsData: '',
    qualitativeInsightsData: '',
    topInsights: [],
    confidenceScore: 0,
  };
}
