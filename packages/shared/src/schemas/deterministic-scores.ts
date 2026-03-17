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

export const DeterministicScoresSchema = z.object({
  contextEfficiency: z.number().min(0).max(100),
  sessionOutcome: z.number().min(0).max(100),
  thinkingQuality: z.number().min(0).max(100),
  learningBehavior: z.number().min(0).max(100),
  communicationPatterns: z.number().min(0).max(100),
  controlScore: z.number().min(0).max(100),
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
