/**
 * Verbose Evaluation Schema
 *
 * Extended Zod schemas for hyper-personalized analysis report.
 * Contains both FREE tier content (shown to all) and PREMIUM tier content (locked).
 *
 * Note: Array size constraints (minItems/maxItems) are removed due to Gemini API
 * limitation that allows only ONE array with size constraints per schema.
 * Quantity targets are specified in prompts, and sanitization enforces minimums.
 */

import { z } from 'zod';
import { CodingStyleTypeSchema, AIControlLevelSchema } from './coding-style.js';

// ============================================================================
// ANALYZED SESSION INFO - Metadata about sessions included in analysis
// ============================================================================

/**
 * Information about a single session that was analyzed
 * Used to display which session files were included in the analysis
 */
export const AnalyzedSessionInfoSchema = z.object({
  fileName: z.string().describe('JSONL file name (e.g., "abc123.jsonl")'),
  sessionId: z.string().describe('Session UUID'),
  projectName: z.string().describe('Last segment of project path'),
  startTime: z.string().datetime().describe('Session start timestamp (ISO)'),
  messageCount: z.number().describe('Number of messages in session'),
  durationMinutes: z.number().describe('Session duration in minutes'),
});
export type AnalyzedSessionInfo = z.infer<typeof AnalyzedSessionInfoSchema>;

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
    .describe('Quotes demonstrating this strength (target: 2-5)'),
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
    .describe('Examples showing this growth opportunity (target: 1-3)'),
  recommendation: z.string().max(300).describe('Specific, actionable recommendation'),
  resources: z
    .array(z.string())
    .optional()
    .describe('Links or resources to help (max 3)'),
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
    ),
  effectiveness: z.enum(['highly_effective', 'effective', 'could_improve']),
  tip: z.string().max(200).optional().describe('Tip to improve or continue this pattern'),
});
export type PromptPattern = z.infer<typeof PromptPatternSchema>;

// ============================================================================
// PER-DIMENSION INSIGHT SCHEMAS (Score-Free)
// ============================================================================

/**
 * The 6 analysis dimensions
 */
export const DimensionNameEnumSchema = z.enum([
  'aiCollaboration',
  'contextEngineering',
  'toolMastery',
  'burnoutRisk',
  'aiControl',
  'skillResilience',
]);
export type DimensionNameEnum = z.infer<typeof DimensionNameEnumSchema>;

/**
 * Strength within a specific dimension (full schema with evidence)
 * Used in VerboseEvaluation for storage and display
 */
export const DimensionStrengthSchema = z.object({
  title: z.string().max(50).describe('Short title for this strength'),
  description: z.string().max(300).describe('What they do well (qualitative, no scores)'),
  evidence: z
    .array(z.string().max(800))
    .optional()
    .describe('Quotes demonstrating this strength'),
});
export type DimensionStrength = z.infer<typeof DimensionStrengthSchema>;

/**
 * Growth area within a specific dimension (full schema with evidence)
 * Used in VerboseEvaluation for storage and display
 */
export const DimensionGrowthAreaSchema = z.object({
  title: z.string().max(50).describe('Short title for this growth area'),
  description: z.string().max(300).describe('What could improve (qualitative, no scores)'),
  evidence: z
    .array(z.string().max(800))
    .optional()
    .describe('Quotes showing this opportunity'),
  recommendation: z.string().max(200).describe('Specific action to take'),
});
export type DimensionGrowthArea = z.infer<typeof DimensionGrowthAreaSchema>;

// ============================================================================
// LLM-SPECIFIC SCHEMAS (Reduced nesting for Gemini API compatibility)
// ============================================================================

/**
 * Strength schema for LLM response - NO evidence field
 * Evidence is added in post-processing from Stage 1 data
 */
export const LLMDimensionStrengthSchema = z.object({
  title: z.string().max(50).describe('Short title for this strength'),
  description: z.string().max(300).describe('What they do well (qualitative, no scores)'),
});

/**
 * Growth area schema for LLM response - NO evidence field
 * Evidence is added in post-processing from Stage 1 data
 */
export const LLMDimensionGrowthAreaSchema = z.object({
  title: z.string().max(50).describe('Short title for this growth area'),
  description: z.string().max(300).describe('What could improve (qualitative, no scores)'),
  recommendation: z.string().max(200).describe('Specific action to take'),
});

/**
 * Per-dimension insight for LLM response (reduced nesting)
 */
export const LLMPerDimensionInsightSchema = z.object({
  dimension: DimensionNameEnumSchema,
  dimensionDisplayName: z.string().max(50).describe('Human-readable dimension name'),
  strengths: z
    .array(LLMDimensionStrengthSchema)
    .describe('0-4 strength clusters'),
  growthAreas: z
    .array(LLMDimensionGrowthAreaSchema)
    .describe('0-3 growth areas'),
});

/**
 * Per-dimension insight containing strengths and growth areas
 * This replaces the global strengths/growthAreas with dimension-specific ones
 */
export const PerDimensionInsightSchema = z.object({
  dimension: DimensionNameEnumSchema,
  dimensionDisplayName: z.string().max(50).describe('Human-readable dimension name'),
  strengths: z
    .array(DimensionStrengthSchema)
    .describe('0-4 strength clusters, each with multiple quotes for credibility'),
  growthAreas: z
    .array(DimensionGrowthAreaSchema)
    .describe('0-3 growth areas with evidence quotes'),
});
export type PerDimensionInsight = z.infer<typeof PerDimensionInsightSchema>;

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
    ),
  savingsEstimate: z.string().max(200).describe('Estimated monthly savings if optimized'),
});
export type TokenEfficiency = z.infer<typeof TokenEfficiencySchema>;

/**
 * Personalized growth roadmap (PREMIUM)
 */
export const GrowthRoadmapSchema = z.object({
  currentLevel: z.enum(['beginner', 'developing', 'proficient', 'expert']),
  nextMilestone: z.string().max(200),
  steps: z
    .array(
      z.object({
        order: z.number(),
        title: z.string().max(100),
        description: z.string().max(400),
        timeEstimate: z.string().max(100),
        metrics: z.string().max(150).describe('How to measure progress'),
      })
    ),
  estimatedTimeToNextLevel: z.string().max(100),
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
    ),
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

  // Session metrics (computed, not from LLM)
  avgPromptLength: z.number().optional(),
  avgTurnsPerSession: z.number().optional(),

  // Analyzed session files (metadata for display)
  analyzedSessions: z.array(AnalyzedSessionInfoSchema).optional()
    .describe('List of session files that were analyzed'),

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

  // NEW: Per-dimension insights (replaces global strengths/growthAreas)
  dimensionInsights: z
    .array(PerDimensionInsightSchema)
    .length(6)
    .describe('Insights for each of the 6 analysis dimensions'),

  // DEPRECATED: Keep for backward compatibility, but prefer dimensionInsights
  strengths: z.array(PersonalizedStrengthSchema).optional(),
  growthAreas: z.array(GrowthAreaSchema).optional(),

  promptPatterns: z.array(PromptPatternSchema),

  // PREMIUM TIER - Locked content
  toolUsageDeepDive: z.array(ToolUsageInsightSchema).optional(),
  tokenEfficiency: TokenEfficiencySchema.optional(),
  growthRoadmap: GrowthRoadmapSchema.optional(),
  comparativeInsights: z.array(ComparativeInsightSchema).optional(),
  sessionTrends: z.array(SessionTrendSchema).optional(),
});
export type VerboseEvaluation = z.infer<typeof VerboseEvaluationSchema>;

/**
 * LLM Response schema - Simplified for Gemini API compatibility
 *
 * Key differences from VerboseEvaluation:
 * - Uses LLMPerDimensionInsightSchema (no evidence field to reduce nesting)
 * - Omits deprecated/premium fields
 * - Evidence is added in post-processing from Stage 1 data
 *
 * Max nesting depth: 4 (dimensionInsights → strengths → title/description)
 */
export const VerboseLLMResponseSchema = z.object({
  // Type classification
  primaryType: CodingStyleTypeSchema,
  controlLevel: AIControlLevelSchema,
  distribution: z.object({
    architect: z.number().min(0).max(100),
    scientist: z.number().min(0).max(100),
    collaborator: z.number().min(0).max(100),
    speedrunner: z.number().min(0).max(100),
    craftsman: z.number().min(0).max(100),
  }),

  // Content
  personalitySummary: z
    .string()
    .min(200)
    .max(800)
    .describe('Hyper-personalized summary of their AI coding personality'),

  // Dimension insights with REDUCED nesting (no evidence field)
  dimensionInsights: z
    .array(LLMPerDimensionInsightSchema)
    .length(6)
    .describe('Insights for each of the 6 analysis dimensions'),

  // Prompt patterns
  promptPatterns: z.array(PromptPatternSchema),
});
export type VerboseLLMResponse = z.infer<typeof VerboseLLMResponseSchema>;
