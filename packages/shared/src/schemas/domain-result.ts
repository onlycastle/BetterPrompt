/**
 * Domain Result Schema
 *
 * Expanded DomainResult with typed domain-specific data,
 * replacing the previous Record<string, unknown> catch-all.
 *
 * @module @betterprompt/shared/schemas/domain-result
 */

import { z } from 'zod';
import { Phase1SessionMetricsSchema } from './phase1-output.js';
import { DeterministicScoresSchema, DeterministicTypeResultSchema } from './deterministic-scores.js';

// ============================================================================
// Evidence Schema (shared across all domains)
// ============================================================================

export const EvidenceSchema = z.object({
  utteranceId: z.string(),
  quote: z.string(),
  context: z.string().optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

// ============================================================================
// Strength / Growth Area Schemas
// ============================================================================

export const DomainStrengthSchema = z.object({
  title: z.string(),
  description: z.string().min(100),
  evidence: z.array(EvidenceSchema).min(1),
});
export type DomainStrength = z.infer<typeof DomainStrengthSchema>;

export const DomainGrowthAreaSchema = z.object({
  title: z.string(),
  description: z.string().min(100),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  recommendation: z.string().min(50),
  evidence: z.array(EvidenceSchema).min(1),
});
export type DomainGrowthArea = z.infer<typeof DomainGrowthAreaSchema>;

// ============================================================================
// Domain Names
// ============================================================================

export const DOMAIN_NAMES = [
  'thinkingQuality',
  'communicationPatterns',
  'learningBehavior',
  'contextEfficiency',
  'sessionOutcome',
  'content',
] as const;

export type DomainName = typeof DOMAIN_NAMES[number];

// ============================================================================
// Complete Domain Result Schema
// ============================================================================

export const DomainResultSchema = z.object({
  domain: z.enum([
    'thinkingQuality',
    'communicationPatterns',
    'learningBehavior',
    'contextEfficiency',
    'sessionOutcome',
    'content',
  ]),
  overallScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(1),
  strengths: z.array(DomainStrengthSchema),
  growthAreas: z.array(DomainGrowthAreaSchema),
  /** Domain-specific typed data. Validated per domain when available. */
  data: z.record(z.string(), z.unknown()).optional(),
  analyzedAt: z.string(),
});
export type DomainResult = z.infer<typeof DomainResultSchema>;

// ============================================================================
// Analysis Report (local plugin assembly)
// ============================================================================

export const AnalysisReportSchema = z.object({
  userId: z.string(),
  analyzedAt: z.string(),
  phase1Metrics: Phase1SessionMetricsSchema,
  deterministicScores: DeterministicScoresSchema,
  typeResult: DeterministicTypeResultSchema.nullable(),
  domainResults: z.array(DomainResultSchema),
  content: z.object({
    topFocusAreas: z.array(z.object({
      title: z.string(),
      narrative: z.string().optional(),
      description: z.string().optional(),
      actions: z.object({
        start: z.string(),
        stop: z.string(),
        continue: z.string(),
      }).optional(),
    })).optional(),
    personalitySummary: z.array(z.string()).optional(),
  }).optional(),
});
export type AnalysisReport = z.infer<typeof AnalysisReportSchema>;
