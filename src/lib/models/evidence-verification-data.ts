/**
 * Evidence Verification Data - Types for Phase 2.8 Evidence Verification
 *
 * Defines schemas for LLM-based verification of evidence relevance.
 * The Evidence Verifier validates that worker-selected evidence quotes
 * actually support their associated insights.
 *
 * @module models/evidence-verification-data
 */

import { z } from 'zod';

// ============================================================================
// Input Types for Evidence Verification
// ============================================================================

/**
 * A single (insight, evidence) pair to be verified.
 *
 * Collected from all Phase 2 worker outputs for batch verification.
 */
export interface EvidenceVerificationPair {
  /** Unique identifier for tracking this pair through verification */
  pairId: string;

  /** Whether this is a strength or growth area insight */
  insightType: 'strength' | 'growth';

  /** Which worker domain this came from (trustVerification, workflowHabit, etc.) */
  workerDomain: string;

  /** The insight title being supported */
  insightTitle: string;

  /** The insight description/claim being supported */
  insightDescription: string;

  /** The evidence quote selected by the worker */
  evidenceQuote: string;

  /** Original utterance ID for reference (optional) */
  utteranceId?: string;

  /** Index within the evidence array (for result mapping) */
  evidenceIndex: number;
}

// ============================================================================
// LLM Response Schema (Gemini Structured Output)
// ============================================================================

/**
 * Single verification result from LLM.
 *
 * The LLM evaluates each pair and returns a relevance score with reasoning.
 */
export const EvidenceVerificationItemSchema = z.object({
  /** Pair ID to match back to input */
  pairId: z.string(),

  /**
   * Relevance score (0-100):
   * - 80-100: Evidence directly demonstrates the insight
   * - 60-79: Evidence moderately supports the insight
   * - 40-59: Evidence has weak/tangential connection
   * - 20-39: Evidence barely relates to the insight
   * - 0-19: Evidence is irrelevant or contradicts the insight
   */
  relevanceScore: z.number().min(0).max(100),

  /** Brief explanation of the scoring decision (for debugging) */
  reasoning: z.string().max(300),
});
export type EvidenceVerificationItem = z.infer<typeof EvidenceVerificationItemSchema>;

/**
 * Complete LLM response for batch evidence verification.
 *
 * Gemini returns all verification results in a single structured response.
 */
export const EvidenceVerificationResponseSchema = z.object({
  results: z.array(EvidenceVerificationItemSchema),
});
export type EvidenceVerificationResponse = z.infer<typeof EvidenceVerificationResponseSchema>;

// ============================================================================
// Verification Result Types
// ============================================================================

/**
 * Processed verification result with keep/filter decision.
 */
export interface EvidenceVerificationResult {
  /** Pair ID matching the input */
  pairId: string;

  /** Relevance score from LLM (0-100) */
  relevanceScore: number;

  /** LLM's reasoning for the score */
  reasoning: string;

  /** Whether this evidence should be kept (score >= threshold) */
  shouldKeep: boolean;
}

/**
 * Statistics from the verification process.
 */
export interface EvidenceVerificationStats {
  /** Total evidence pairs verified */
  total: number;

  /** Evidence pairs that passed verification (kept) */
  kept: number;

  /** Evidence pairs that failed verification (filtered) */
  filtered: number;

  /** Average relevance score across all pairs */
  avgScore: number;

  /** Pairs per domain for debugging */
  byDomain: Record<string, { total: number; kept: number; filtered: number }>;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for the Evidence Verifier stage.
 */
export interface EvidenceVerifierConfig {
  /** Gemini API key (falls back to env if not provided) */
  apiKey?: string;

  /** Model to use (default: gemini-3-flash-preview) */
  model?: string;

  /** Temperature for LLM calls (default: 0.3 for consistency) */
  temperature?: number;

  /** Minimum relevance score to keep evidence (default: 50) */
  threshold?: number;

  /** Enable verbose logging (default: false) */
  verbose?: boolean;

  /** Max retries for LLM calls (default: 2) */
  maxRetries?: number;
}

/**
 * Default configuration values for Evidence Verifier.
 */
export const DEFAULT_EVIDENCE_VERIFIER_CONFIG: Required<Omit<EvidenceVerifierConfig, 'apiKey'>> = {
  model: 'gemini-3-flash-preview',
  temperature: 0.3, // Lower temperature for more consistent relevance scoring
  threshold: 50,
  verbose: false,
  maxRetries: 2,
};
