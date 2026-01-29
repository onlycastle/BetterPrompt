/**
 * Trust Verification Data Schema - Phase 2 Worker Output
 *
 * TrustVerificationWorker detects:
 * - Anti-patterns (error loops, blind retry, passive acceptance, etc.)
 * - Verification behavior (Vibe Coder spectrum)
 * - Detected pattern types for KB matching
 *
 * This worker answers: "Does this developer blindly trust AI or verify outputs?"
 *
 * @module models/trust-verification-data
 */

import { z } from 'zod';
import {
  DetectedAntiPatternSchema,
  type DetectedAntiPattern,
  VerificationBehaviorSchema,
  type VerificationBehavior,
  parseAntiPatternsData,
  parseVerificationBehaviorData,
} from './behavior-pattern-data';
import {
  WorkerStrengthSchema,
  type WorkerStrength,
  WorkerGrowthSchema,
  type WorkerGrowth,
  parseWorkerStrengthsData,
  parseWorkerGrowthAreasData,
} from './worker-insights';

// ============================================================================
// Trust Verification Output Schema
// ============================================================================

export const TrustVerificationOutputSchema = z.object({
  /** Detected anti-patterns */
  antiPatterns: z.array(DetectedAntiPatternSchema),

  /** Verification behavior assessment (Vibe Coder spectrum) */
  verificationBehavior: VerificationBehaviorSchema,

  /** Overall trust health score (0-100, higher = better verification habits) */
  overallTrustHealthScore: z.number().min(0).max(100),

  /** Confidence in this analysis (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Brief summary */
  summary: z.string().max(500).optional(),

  /** Detected pattern types for KB matching - "patternType|frequency|significance;..." */
  detectedPatternsData: z.string().max(3000).optional(),

  /** Actionable pattern matches from KB - "patternId|matchScore|recommendation;..." */
  actionablePatternMatchesData: z.string().max(3000).optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Domain-specific Strengths & Growth Areas (NEW - replaces StrengthGrowthSynthesizer)
  // ─────────────────────────────────────────────────────────────────────────

  /** Strengths identified in trust & verification domain (1-4 items) */
  strengths: z.array(WorkerStrengthSchema).optional(),

  /** Growth areas identified in trust & verification domain (1-4 items) */
  growthAreas: z.array(WorkerGrowthSchema).optional(),
});
export type TrustVerificationOutput = z.infer<typeof TrustVerificationOutputSchema>;

// ============================================================================
// Flattened Schema for Gemini API (Max Nesting Depth ~4)
// ============================================================================

export const TrustVerificationLLMOutputSchema = z.object({
  /** Anti-patterns: "type|frequency|severity|sessionPct|improvement|utteranceId:quote:context:whatWentWrong,...;..." */
  antiPatternsData: z.string().max(6000)
    .describe('Anti-patterns: "type|frequency|severity|sessionPct|improvement|examples;..." where examples = "id:quote:context:whatWentWrong,..."'),

  /** Verification behavior: "level|recommendation|example1,example2" */
  verificationBehaviorData: z.string().max(1500)
    .describe('Verification behavior: "level|recommendation|example1,example2"'),

  /** Overall trust health score (0-100) */
  overallTrustHealthScore: z.number().min(0).max(100),

  /** Confidence score (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Summary */
  summary: z.string().max(500).optional(),

  /** Detected patterns for KB matching: "patternType|frequency|significance;..." */
  detectedPatternsData: z.string().max(3000).optional()
    .describe('Detected pattern types: "patternType|frequency|significance;..."'),

  /** Actionable pattern matches: "patternId|matchScore|recommendation;..." */
  actionablePatternMatchesData: z.string().max(3000).optional()
    .describe('Actionable KB matches: "patternId|matchScore|recommendation;..."'),

  // ─────────────────────────────────────────────────────────────────────────
  // Domain-specific Strengths & Growth Areas (NEW)
  // ─────────────────────────────────────────────────────────────────────────

  /** Strengths: "title|description|quote1,quote2,quote3|frequency;..." (1-6 items) */
  strengthsData: z.string().max(12000).optional()
    .describe('Strengths in trust domain: "title|description|quote1,quote2,quote3|frequency;..." (1-6 items)'),

  /** Growth areas: "title|description|quote1,quote2|recommendation|severity|frequency;..." (1-6 items) */
  growthAreasData: z.string().max(12000).optional()
    .describe('Growth areas in trust domain: "title|description|quote1,quote2|recommendation|severity|frequency;..." (1-6 items)'),
});
export type TrustVerificationLLMOutput = z.infer<typeof TrustVerificationLLMOutputSchema>;

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Convert LLM output to structured TrustVerificationOutput
 */
export function parseTrustVerificationLLMOutput(llmOutput: TrustVerificationLLMOutput): TrustVerificationOutput {
  return {
    antiPatterns: parseAntiPatternsData(llmOutput.antiPatternsData),
    verificationBehavior: parseVerificationBehaviorData(llmOutput.verificationBehaviorData),
    overallTrustHealthScore: llmOutput.overallTrustHealthScore,
    confidenceScore: llmOutput.confidenceScore,
    summary: llmOutput.summary,
    detectedPatternsData: llmOutput.detectedPatternsData,
    actionablePatternMatchesData: llmOutput.actionablePatternMatchesData,
    strengths: parseWorkerStrengthsData(llmOutput.strengthsData),
    growthAreas: parseWorkerGrowthAreasData(llmOutput.growthAreasData),
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create empty TrustVerification output
 */
export function createEmptyTrustVerificationOutput(): TrustVerificationOutput {
  return {
    antiPatterns: [],
    verificationBehavior: {
      level: 'occasional_review',
      examples: [],
      recommendation: 'Insufficient data to assess verification behavior.',
    },
    overallTrustHealthScore: 50,
    confidenceScore: 0,
    summary: 'Insufficient data for trust verification analysis.',
  };
}
