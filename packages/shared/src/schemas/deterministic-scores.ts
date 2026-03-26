/**
 * Deterministic Scoring Schemas
 *
 * Canonical types for rubric-based scoring and developer type classification.
 * These are deterministic (same input = same output, no LLM involved).
 *
 * @module @betterprompt/shared/schemas/deterministic-scores
 */

import { z } from 'zod';

// ============================================================================
// Deterministic Scores
// ============================================================================

/**
 * 5-dimension deterministic scores (v2).
 * - aiPartnership: merged thinkingQuality + controlScore
 * - sessionCraft: merged contextEfficiency + learningBehavior (burnout)
 * - toolMastery: communication/tool patterns
 * - skillResilience: cold-start, hallucination detection, VCP
 * - sessionMastery: absence-of-anti-pattern scoring
 * - controlScore: retained for type classification
 */
export const DeterministicScoresSchema = z.object({
  aiPartnership: z.number().min(0).max(100),
  sessionCraft: z.number().min(0).max(100),
  toolMastery: z.number().min(0).max(100),
  skillResilience: z.number().min(0).max(100),
  sessionMastery: z.number().min(0).max(100),
  controlScore: z.number().min(0).max(100),
  // Legacy fields — present on old runs, not computed for new
  contextEfficiency: z.number().min(0).max(100).optional(),
  sessionOutcome: z.number().min(0).max(100).optional(),
  thinkingQuality: z.number().min(0).max(100).optional(),
  learningBehavior: z.number().min(0).max(100).optional(),
  communicationPatterns: z.number().min(0).max(100).optional(),
});
export type DeterministicScores = z.infer<typeof DeterministicScoresSchema>;

// ============================================================================
// Coding Style Type System
// ============================================================================

export const CodingStyleTypeSchema = z.enum([
  'architect',
  'analyst',
  'conductor',
  'speedrunner',
  'trendsetter',
]);
export type CodingStyleType = z.infer<typeof CodingStyleTypeSchema>;

export const AIControlLevelSchema = z.enum([
  'explorer',
  'navigator',
  'cartographer',
]);
export type AIControlLevel = z.infer<typeof AIControlLevelSchema>;

// ============================================================================
// Deterministic Type Result
// ============================================================================

export const DeterministicTypeResultSchema = z.object({
  primaryType: CodingStyleTypeSchema,
  distribution: z.object({
    architect: z.number(),
    analyst: z.number(),
    conductor: z.number(),
    speedrunner: z.number(),
    trendsetter: z.number(),
  }),
  controlLevel: AIControlLevelSchema,
  controlScore: z.number().min(0).max(100),
  matrixName: z.string(),
  matrixEmoji: z.string(),
});
export type DeterministicTypeResult = z.infer<typeof DeterministicTypeResultSchema>;
