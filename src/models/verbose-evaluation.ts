/**
 * Verbose Evaluation Schema
 *
 * Extended Zod schemas for hyper-personalized analysis report.
 * Contains both FREE tier content (shown to all) and PREMIUM tier content (locked).
 */

import { z } from 'zod';
import { CodingStyleTypeSchema, AIControlLevelSchema } from './coding-style.js';

// ============================================================================
// FREE TIER SCHEMAS
// ============================================================================

/**
 * Personalized evidence with actual quotes
 */
export const PersonalizedEvidenceSchema = z.object({
  quote: z.string().min(20).max(500).describe('Actual quote from the conversation'),
  sessionDate: z.string().describe('When this was said (ISO date)'),
  context: z.string().max(200).describe('Brief context of what was being discussed'),
  significance: z.string().max(300).describe('What this reveals about their personality'),
  sentiment: z.enum(['positive', 'neutral', 'growth_opportunity']),
});
export type PersonalizedEvidence = z.infer<typeof PersonalizedEvidenceSchema>;

/**
 * Strength with personalized evidence
 */
export const PersonalizedStrengthSchema = z.object({
  title: z.string().max(50).describe('Short title for this strength'),
  description: z.string().min(100).max(500).describe('Detailed description of this strength'),
  evidence: z
    .array(PersonalizedEvidenceSchema)
    .min(2)
    .max(5)
    .describe('Quotes demonstrating this strength'),
  percentile: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('How this compares to other developers'),
});
export type PersonalizedStrength = z.infer<typeof PersonalizedStrengthSchema>;

/**
 * Growth area with specific examples
 */
export const GrowthAreaSchema = z.object({
  title: z.string().max(50),
  description: z.string().min(100).max(500),
  evidence: z
    .array(PersonalizedEvidenceSchema)
    .min(1)
    .max(3)
    .describe('Examples showing this growth opportunity'),
  recommendation: z.string().max(300).describe('Specific, actionable recommendation'),
  resources: z
    .array(z.string())
    .max(3)
    .optional()
    .describe('Links or resources to help'),
});
export type GrowthArea = z.infer<typeof GrowthAreaSchema>;

/**
 * Prompt pattern analysis
 */
export const PromptPatternSchema = z.object({
  patternName: z.string().max(50).describe('Name of the pattern'),
  description: z.string().max(300).describe('What this pattern is'),
  frequency: z.enum(['frequent', 'occasional', 'rare']),
  examples: z
    .array(
      z.object({
        quote: z.string().max(300),
        analysis: z.string().max(200),
      })
    )
    .min(1)
    .max(3),
  effectiveness: z.enum(['highly_effective', 'effective', 'could_improve']),
  tip: z.string().max(200).optional().describe('Tip to improve or continue this pattern'),
});
export type PromptPattern = z.infer<typeof PromptPatternSchema>;

// ============================================================================
// PREMIUM TIER SCHEMAS (LOCKED)
// ============================================================================

/**
 * Tool usage insight (PREMIUM)
 */
export const ToolUsageInsightSchema = z.object({
  toolName: z.string(),
  usageCount: z.number(),
  usagePercentage: z.number(),
  insightTitle: z.string().max(50),
  insight: z.string().max(300),
  comparison: z.string().max(200).describe('How this compares to typical usage'),
  recommendation: z.string().max(200).optional(),
});
export type ToolUsageInsight = z.infer<typeof ToolUsageInsightSchema>;

/**
 * Token efficiency analysis (PREMIUM)
 */
export const TokenEfficiencySchema = z.object({
  averageTokensPerSession: z.number(),
  tokenEfficiencyScore: z.number().min(0).max(100),
  efficiencyLevel: z.enum(['highly_efficient', 'efficient', 'average', 'could_optimize']),
  insights: z
    .array(
      z.object({
        title: z.string().max(50),
        description: z.string().max(300),
        impact: z.enum(['high', 'medium', 'low']),
      })
    )
    .max(5),
  savingsEstimate: z.string().max(100).describe('Estimated monthly savings if optimized'),
});
export type TokenEfficiency = z.infer<typeof TokenEfficiencySchema>;

/**
 * Personalized growth roadmap (PREMIUM)
 */
export const GrowthRoadmapSchema = z.object({
  currentLevel: z.enum(['beginner', 'developing', 'proficient', 'expert']),
  nextMilestone: z.string().max(100),
  steps: z
    .array(
      z.object({
        order: z.number(),
        title: z.string().max(50),
        description: z.string().max(300),
        timeEstimate: z.string().max(50),
        metrics: z.string().max(100).describe('How to measure progress'),
      })
    )
    .min(3)
    .max(5),
  estimatedTimeToNextLevel: z.string().max(50),
});
export type GrowthRoadmap = z.infer<typeof GrowthRoadmapSchema>;

/**
 * Comparative insights (PREMIUM)
 */
export const ComparativeInsightSchema = z.object({
  metric: z.string().max(50),
  yourValue: z.number(),
  averageValue: z.number(),
  percentile: z.number().min(0).max(100),
  interpretation: z.string().max(200),
});
export type ComparativeInsight = z.infer<typeof ComparativeInsightSchema>;

/**
 * Session trend (PREMIUM)
 */
export const SessionTrendSchema = z.object({
  metricName: z.string().max(50),
  direction: z.enum(['improving', 'stable', 'declining']),
  description: z.string().max(200),
  dataPoints: z
    .array(
      z.object({
        sessionDate: z.string(),
        value: z.number(),
      })
    )
    .max(10),
});
export type SessionTrend = z.infer<typeof SessionTrendSchema>;

// ============================================================================
// COMPLETE VERBOSE EVALUATION SCHEMA
// ============================================================================

/**
 * Complete verbose evaluation schema
 */
export const VerboseEvaluationSchema = z.object({
  // Metadata
  sessionId: z.string(),
  analyzedAt: z.string().datetime(),
  sessionsAnalyzed: z.number(),

  // Type result (same as before)
  primaryType: CodingStyleTypeSchema,
  controlLevel: AIControlLevelSchema,
  distribution: z.object({
    architect: z.number().min(0).max(100),
    scientist: z.number().min(0).max(100),
    collaborator: z.number().min(0).max(100),
    speedrunner: z.number().min(0).max(100),
    craftsman: z.number().min(0).max(100),
  }),

  // FREE TIER - Verbose content
  personalitySummary: z
    .string()
    .min(200)
    .max(800)
    .describe('Hyper-personalized summary of their AI coding personality'),
  strengths: z.array(PersonalizedStrengthSchema).min(3).max(5),
  growthAreas: z.array(GrowthAreaSchema).min(2).max(4),
  promptPatterns: z.array(PromptPatternSchema).min(3).max(6),

  // PREMIUM TIER - Locked content
  toolUsageDeepDive: z.array(ToolUsageInsightSchema).max(8).optional(),
  tokenEfficiency: TokenEfficiencySchema.optional(),
  growthRoadmap: GrowthRoadmapSchema.optional(),
  comparativeInsights: z.array(ComparativeInsightSchema).max(10).optional(),
  sessionTrends: z.array(SessionTrendSchema).max(5).optional(),
});
export type VerboseEvaluation = z.infer<typeof VerboseEvaluationSchema>;

/**
 * LLM Response schema (without metadata fields added after call)
 */
export const VerboseLLMResponseSchema = VerboseEvaluationSchema.omit({
  sessionId: true,
  analyzedAt: true,
  sessionsAnalyzed: true,
});
export type VerboseLLMResponse = z.infer<typeof VerboseLLMResponseSchema>;
