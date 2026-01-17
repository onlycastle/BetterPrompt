/**
 * Personality Profile Schema (Module B Output)
 *
 * Internal analysis schema for personality extraction.
 * Uses MBTI 4-axis analysis + 사주-inspired techniques internally.
 *
 * IMPORTANT: This data is NEVER exposed directly to users.
 * Stage 2 transforms this into natural, conversational insights.
 *
 * @module models/personality
 */

import { z } from 'zod';

// ============================================================================
// Dimension Signal Types (E/I, S/N, T/F, J/P internal mapping)
// ============================================================================

/**
 * Signal that contributed to a dimension score
 * Each signal represents behavioral evidence for the personality analysis
 */
export const DimensionSignalSchema = z.object({
  /** Type of signal (e.g., "message_brevity", "planning_behavior") */
  type: z.string().max(50),

  /** Evidence quote or description supporting this signal */
  evidence: z.string().max(300),

  /** Confidence in this signal (0.0 - 1.0) */
  confidence: z.number().min(0).max(1),
});
export type DimensionSignal = z.infer<typeof DimensionSignalSchema>;

// ============================================================================
// Individual Dimension Analysis Schema
// ============================================================================

/**
 * Analysis for a single personality dimension
 * Score: 0 = first pole (E/S/T/J), 100 = second pole (I/N/F/P)
 */
export const DimensionAnalysisSchema = z.object({
  /** Score on this dimension (0-100, where 50 is balanced) */
  score: z.number().min(0).max(100),

  /** Signals that contributed to this score */
  signals: z.array(DimensionSignalSchema),

  /** Natural language insight about this dimension (NO labels/codes) */
  insight: z.string().max(200),
});
export type DimensionAnalysis = z.infer<typeof DimensionAnalysisSchema>;

// ============================================================================
// Complete Personality Profile Schema (Module B Output)
// ============================================================================

/**
 * Complete personality profile from Module B
 *
 * Uses MBTI 4-axis analysis internally:
 * - ei: Extraversion/Introversion (interaction style)
 * - sn: Sensing/Intuition (information processing)
 * - tf: Thinking/Feeling (decision making)
 * - jp: Judging/Perceiving (work structure)
 *
 * Uses 사주-inspired techniques:
 * - yongsin: What's missing/needed (용신)
 * - gisin: What's excessive/to reduce (기신)
 * - gyeokguk: Overall pattern type (격국)
 * - sangsaeng: Synergistic skill combinations (상생)
 * - sanggeuk: Conflicting skill combinations (상극)
 */
export const PersonalityProfileSchema = z.object({
  // MBTI 4-axis analysis (internal framework)
  dimensions: z.object({
    /** E/I: Verbose(E) vs Concise(I) communication style */
    ei: DimensionAnalysisSchema,

    /** S/N: Detail-first(S) vs Big-picture(N) information processing */
    sn: DimensionAnalysisSchema,

    /** T/F: Logic(T) vs Values(F) decision making */
    tf: DimensionAnalysisSchema,

    /** J/P: Planned(J) vs Adaptive(P) work structure */
    jp: DimensionAnalysisSchema,
  }),

  // 사주-inspired analysis techniques (internal framework)

  /** 용신 - What this developer NEEDS (lacking skill/behavior) */
  yongsin: z.string().max(200),

  /** 기신 - What this developer should REDUCE (excessive behavior) */
  gisin: z.string().max(200),

  /** 격국 - Overall pattern type derived from combination */
  gyeokguk: z.string().max(100),

  /** 상생 - Synergistic skill/behavior combinations */
  sangsaeng: z.array(z.string().max(150)),

  /** 상극 - Conflicting skill/behavior combinations */
  sanggeuk: z.array(z.string().max(150)),

  /** Overall confidence in this personality analysis (0.0 - 1.0) */
  overallConfidence: z.number().min(0).max(1),
});
export type PersonalityProfile = z.infer<typeof PersonalityProfileSchema>;

// ============================================================================
// Default/Empty Profile
// ============================================================================

/**
 * Creates a default PersonalityProfile when analysis fails or data is insufficient
 */
export function createDefaultPersonalityProfile(): PersonalityProfile {
  const defaultDimension: DimensionAnalysis = {
    score: 50, // Balanced/unknown
    signals: [],
    insight: 'Insufficient data for analysis',
  };

  return {
    dimensions: {
      ei: defaultDimension,
      sn: defaultDimension,
      tf: defaultDimension,
      jp: defaultDimension,
    },
    yongsin: '',
    gisin: '',
    gyeokguk: 'Balanced',
    sangsaeng: [],
    sanggeuk: [],
    overallConfidence: 0,
  };
}
