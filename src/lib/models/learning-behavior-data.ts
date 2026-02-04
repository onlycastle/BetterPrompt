/**
 * Learning Behavior Data Schema - Phase 2 Unified Worker Output
 *
 * LearningBehaviorAnalyzer combines:
 * - KnowledgeGap: Knowledge gaps, learning progress, recommended resources
 * - TrustVerification (repetition-related): Repeated mistake patterns
 *
 * This worker answers: "How much does this developer try to learn? Do they repeat the same mistakes?"
 *
 * Capability-centric approach:
 * - Knowledge Gaps: What topics do they struggle with?
 * - Learning Progress: Are they improving over time?
 * - Repeated Mistakes: Do they learn from errors or repeat them?
 *
 * @module models/learning-behavior-data
 */

import { z } from 'zod';
import {
  WorkerStrengthSchema,
  type WorkerStrength,
  WorkerGrowthSchema,
  type WorkerGrowth,
  StructuredStrengthLLMSchema,
  StructuredGrowthLLMSchema,
  parseStructuredStrengths,
  parseStructuredGrowthAreas,
  ReferencedInsightSchema,
  type ReferencedInsight,
} from './worker-insights';

// ============================================================================
// Knowledge Gap Schemas (defined here to avoid circular dependency with agent-outputs)
// ============================================================================

/**
 * LLM output schema for knowledge gap (nesting depth: 2)
 * root{} → knowledgeGaps[] → KnowledgeGapLLM{}
 */
export const KnowledgeGapItemLLMSchema = z.object({
  /** Topic name (e.g., "TypeScript generics", "async/await") */
  topic: z.string(),
  /** 2-3 sentences explaining WHY this is a knowledge gap and its root cause */
  description: z.string(),
  /** Number of times this topic was questioned */
  questionCount: z.number().int().min(1),
  /** Depth level: shallow | moderate | deep */
  depth: z.enum(['shallow', 'moderate', 'deep']),
  /** Example question or evidence */
  example: z.string(),
});
export type KnowledgeGapItemLLM = z.infer<typeof KnowledgeGapItemLLMSchema>;

/**
 * LLM output schema for learning progress (nesting depth: 2)
 * root{} → learningProgress[] → LearningProgressLLM{}
 */
export const LearningProgressLLMSchema = z.object({
  /** Topic name */
  topic: z.string(),
  /** 2-3 sentences describing the learning journey and what changed */
  description: z.string(),
  /** Starting level: novice | shallow | moderate | deep | expert */
  startLevel: z.enum(['novice', 'shallow', 'moderate', 'deep', 'expert']),
  /** Current level: novice | shallow | moderate | deep | expert */
  currentLevel: z.enum(['novice', 'shallow', 'moderate', 'deep', 'expert']),
  /** Evidence of progress */
  evidence: z.string(),
});
export type LearningProgressLLM = z.infer<typeof LearningProgressLLMSchema>;

/**
 * LLM output schema for recommended resource (nesting depth: 2)
 * root{} → recommendedResources[] → ResourceLLM{}
 */
export const ResourceLLMSchema = z.object({
  /** Topic this resource addresses */
  topic: z.string(),
  /** Resource type: docs | tutorial | course | article | video */
  resourceType: z.enum(['docs', 'tutorial', 'course', 'article', 'video']),
  /** Full URL starting with https:// */
  url: z.string(),
});
export type ResourceLLM = z.infer<typeof ResourceLLMSchema>;

// ============================================================================
// Referenced Insight Schema (re-exported from worker-insights.ts)
// ============================================================================

// Re-export for backward compatibility - canonical definition in worker-insights.ts
export { ReferencedInsightSchema, type ReferencedInsight };

// ============================================================================
// Repeated Mistake Pattern Schema (NEW)
// ============================================================================

/**
 * A repeated mistake pattern detected across sessions.
 *
 * This captures patterns where the developer makes the same type of error
 * multiple times, indicating a learning opportunity.
 */
export const RepeatedMistakePatternSchema = z.object({
  /** Category of the mistake (e.g., "error_handling", "type_mismatch", "api_usage") */
  category: z.string(),

  /** Specific type of mistake within the category */
  mistakeType: z.string(),

  /** 2-3 sentences explaining WHY this mistake repeats (behavioral root cause) */
  description: z.string(),

  /** How many times this mistake was observed */
  occurrenceCount: z.number().int().min(2),

  /** Percentage of sessions where this mistake appeared (0-100) */
  sessionPercentage: z.number().min(0).max(100).optional(),

  /** Example utteranceIds showing this pattern */
  exampleUtteranceIds: z.array(z.string()).max(5),

  /** Specific learning recommendation to avoid this mistake */
  recommendation: z.string(),
});
export type RepeatedMistakePattern = z.infer<typeof RepeatedMistakePatternSchema>;

/**
 * LLM output schema for repeated mistake (nesting depth: 2)
 * root{} → repeatedMistakePatterns[] → RepeatedMistakeLLM{}
 */
export const RepeatedMistakeLLMSchema = z.object({
  /** Category of the mistake */
  category: z.string(),
  /** Specific type of mistake */
  mistakeType: z.string(),
  /** 2-3 sentences explaining WHY this mistake repeats (behavioral root cause) */
  description: z.string(),
  /** Occurrence count */
  occurrenceCount: z.number().int().min(2),
  /** Session percentage (0-100) */
  sessionPercentage: z.number().min(0).max(100).optional(),
  /** Example utteranceIds */
  exampleUtteranceIds: z.array(z.string()).max(5),
  /** Learning recommendation */
  recommendation: z.string(),
});
export type RepeatedMistakeLLM = z.infer<typeof RepeatedMistakeLLMSchema>;

// ============================================================================
// Learning Behavior Output Schema
// ============================================================================

/**
 * Complete output from LearningBehaviorAnalyzer.
 *
 * Combines analysis from multiple dimensions:
 * 1. Knowledge Gaps - What topics do they struggle with?
 * 2. Learning Progress - Are they improving over time?
 * 3. Repeated Mistakes - Do they learn from errors or repeat them?
 */
export const LearningBehaviorOutputSchema = z.object({
  // ─────────────────────────────────────────────────────────────────────────
  // Knowledge Gap Dimension (from KnowledgeGap worker)
  // ─────────────────────────────────────────────────────────────────────────

  /** Knowledge gaps detected (structured array) */
  knowledgeGaps: z.array(KnowledgeGapItemLLMSchema),

  /** Learning progress tracked (structured array) */
  learningProgress: z.array(LearningProgressLLMSchema),

  /** Recommended resources (structured array) */
  recommendedResources: z.array(ResourceLLMSchema),

  // ─────────────────────────────────────────────────────────────────────────
  // Repeated Mistakes Dimension (from TrustVerification anti-patterns)
  // ─────────────────────────────────────────────────────────────────────────

  /** Repeated mistake patterns detected */
  repeatedMistakePatterns: z.array(RepeatedMistakePatternSchema),

  // ─────────────────────────────────────────────────────────────────────────
  // Insights (from KnowledgeGap worker)
  // ─────────────────────────────────────────────────────────────────────────

  /** Top 3 Wow Insights */
  topInsights: z.array(z.string()).max(3),

  /** KPT Keep - What to keep doing (0-2 items) */
  kptKeep: z.array(z.string()).max(2).optional(),

  /** KPT Problem - What needs improvement (1-2 items) */
  kptProblem: z.array(z.string()).max(2).optional(),

  /** KPT Try - What to try next (1-2 items) */
  kptTry: z.array(z.string()).max(2).optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Overall Scores
  // ─────────────────────────────────────────────────────────────────────────

  /** Overall learning score (0-100, higher = better learning behavior) */
  overallLearningScore: z.number().min(0).max(100),

  /** Confidence in this analysis (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Brief summary of learning behavior */
  summary: z.string().optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Domain-specific Strengths & Growth Areas
  // ─────────────────────────────────────────────────────────────────────────

  /** Strengths identified in learning domain (1-6 items) */
  strengths: z.array(WorkerStrengthSchema).optional(),

  /** Growth areas identified in learning domain (1-6 items) */
  growthAreas: z.array(WorkerGrowthSchema).optional(),

  /** Referenced insights from Knowledge Base (post-processed from [pi-XXX] references) */
  referencedInsights: z.array(ReferencedInsightSchema).optional(),
});
export type LearningBehaviorOutput = z.infer<typeof LearningBehaviorOutputSchema>;

// ============================================================================
// Main LLM Output Schema (Structured Arrays)
// ============================================================================

/**
 * Structured schema for Gemini API.
 * Uses arrays instead of semicolon-separated strings.
 * Nesting depth is safe: root{} → array[] → object{} = 2 levels
 */
export const LearningBehaviorLLMOutputSchema = z.object({
  // ─────────────────────────────────────────────────────────────────────────
  // Knowledge Gap Dimension
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Knowledge gaps detected (structured array, nesting depth: 2)
   * Replaces semicolon-separated knowledgeGapsData string
   */
  knowledgeGaps: z.array(KnowledgeGapItemLLMSchema),

  /**
   * Learning progress tracked (structured array, nesting depth: 2)
   * Replaces semicolon-separated learningProgressData string
   */
  learningProgress: z.array(LearningProgressLLMSchema),

  /**
   * Recommended resources (structured array, nesting depth: 2)
   * Replaces semicolon-separated recommendedResourcesData string
   */
  recommendedResources: z.array(ResourceLLMSchema),

  // ─────────────────────────────────────────────────────────────────────────
  // Repeated Mistakes Dimension
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Repeated mistake patterns (structured array, nesting depth: 2)
   */
  repeatedMistakePatterns: z.array(RepeatedMistakeLLMSchema),

  // ─────────────────────────────────────────────────────────────────────────
  // Insights
  // ─────────────────────────────────────────────────────────────────────────

  /** Top 3 Wow Insights */
  topInsights: z.array(z.string()).max(3),

  /** KPT Keep (0-2 items) */
  kptKeep: z.array(z.string()).max(2).optional(),

  /** KPT Problem (1-2 items) */
  kptProblem: z.array(z.string()).max(2).optional(),

  /** KPT Try (1-2 items) */
  kptTry: z.array(z.string()).max(2).optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Overall Scores
  // ─────────────────────────────────────────────────────────────────────────

  /** Overall learning score (0-100) */
  overallLearningScore: z.number().min(0).max(100),

  /** Confidence score (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Summary */
  summary: z.string().optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Domain-specific Strengths & Growth Areas (STRUCTURED OUTPUT)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Strengths identified in learning domain (1-6 items).
   * Evidence format: structured JSON array
   */
  strengths: z.array(StructuredStrengthLLMSchema).min(1).max(6).optional(),

  /**
   * Growth areas identified in learning domain (1-6 items).
   * Evidence format: structured JSON array
   */
  growthAreas: z.array(StructuredGrowthLLMSchema).min(1).max(6),
});
export type LearningBehaviorLLMOutput = z.infer<typeof LearningBehaviorLLMOutputSchema>;

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Convert LLM repeated mistake patterns to internal format
 */
function parseRepeatedMistakePatternsLLM(
  patterns: RepeatedMistakeLLM[] | undefined
): RepeatedMistakePattern[] {
  if (!patterns || patterns.length === 0) return [];

  return patterns
    .filter((p) => p.category && p.mistakeType && p.occurrenceCount >= 2)
    .map((p) => ({
      category: p.category,
      mistakeType: p.mistakeType,
      description: p.description,
      occurrenceCount: p.occurrenceCount,
      sessionPercentage: p.sessionPercentage,
      exampleUtteranceIds: p.exampleUtteranceIds || [],
      recommendation: p.recommendation,
    }));
}

/**
 * Convert LLM output to structured LearningBehaviorOutput.
 */
export function parseLearningBehaviorLLMOutput(
  llmOutput: LearningBehaviorLLMOutput
): LearningBehaviorOutput {
  return {
    // Knowledge Gap Dimension
    knowledgeGaps: llmOutput.knowledgeGaps || [],
    learningProgress: llmOutput.learningProgress || [],
    recommendedResources: llmOutput.recommendedResources || [],

    // Repeated Mistakes Dimension
    repeatedMistakePatterns: parseRepeatedMistakePatternsLLM(llmOutput.repeatedMistakePatterns),

    // Insights
    topInsights: llmOutput.topInsights || [],
    kptKeep: llmOutput.kptKeep,
    kptProblem: llmOutput.kptProblem,
    kptTry: llmOutput.kptTry,

    // Overall Scores
    overallLearningScore: llmOutput.overallLearningScore,
    confidenceScore: llmOutput.confidenceScore,
    summary: llmOutput.summary,

    // Strengths & Growth Areas
    strengths: parseStructuredStrengths(llmOutput.strengths),
    growthAreas: parseStructuredGrowthAreas(llmOutput.growthAreas),
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create empty LearningBehavior output
 */
export function createEmptyLearningBehaviorOutput(): LearningBehaviorOutput {
  return {
    knowledgeGaps: [],
    learningProgress: [],
    recommendedResources: [],
    repeatedMistakePatterns: [],
    topInsights: [],
    overallLearningScore: 50,
    confidenceScore: 0,
    summary: 'Insufficient data for learning behavior analysis.',
  };
}

// ============================================================================
// Helper Functions for Migration
// ============================================================================

/**
 * Extract repeated mistake patterns from TrustVerification anti-patterns.
 *
 * This function helps migrate from the old TrustVerification anti-patterns
 * to the new LearningBehavior repeated mistake patterns.
 *
 * Patterns that indicate repeated mistakes:
 * - error_loop: Same error repeated multiple times
 * - blind_retry: Retrying without understanding the error
 * - repeated_question: Asking the same question multiple times
 */
export function extractRepeatedMistakesFromAntiPatterns(
  antiPatterns: Array<{
    type: string;
    frequency: number;
    examples?: Array<{ utteranceId: string; quote: string; context?: string }>;
    improvement?: string;
    sessionPercentage?: number;
  }>
): RepeatedMistakePattern[] {
  const repetitionRelatedTypes = ['error_loop', 'blind_retry', 'repeated_question'];

  return antiPatterns
    .filter((ap) => repetitionRelatedTypes.includes(ap.type) && ap.frequency >= 2)
    .map((ap) => ({
      category: getCategoryFromAntiPatternType(ap.type),
      mistakeType: ap.type.replace(/_/g, ' '),
      description: getDescriptionFromAntiPatternType(ap.type),
      occurrenceCount: ap.frequency,
      sessionPercentage: ap.sessionPercentage,
      exampleUtteranceIds: (ap.examples || []).map((e) => e.utteranceId).slice(0, 5),
      recommendation: ap.improvement || `Reduce ${ap.type.replace(/_/g, ' ')} occurrences`,
    }));
}

/**
 * Map anti-pattern type to mistake category
 */
function getCategoryFromAntiPatternType(type: string): string {
  const categoryMap: Record<string, string> = {
    error_loop: 'error_handling',
    blind_retry: 'debugging',
    repeated_question: 'context_management',
  };
  return categoryMap[type] || 'general';
}

/**
 * Generate description for anti-pattern type
 */
function getDescriptionFromAntiPatternType(type: string): string {
  const descriptionMap: Record<string, string> = {
    error_loop: 'Same error encountered multiple times without addressing the root cause. This indicates a pattern of not fully understanding error messages before attempting fixes.',
    blind_retry: 'Retrying failed operations without analyzing the error or changing approach. This suggests treating the AI as a black box rather than a collaborative debugging partner.',
    repeated_question: 'Asking similar questions multiple times across sessions. This may indicate incomplete mental models or lack of note-taking habits for important learnings.',
  };
  return descriptionMap[type] || `Repeated occurrence of ${type.replace(/_/g, ' ')} pattern.`;
}
