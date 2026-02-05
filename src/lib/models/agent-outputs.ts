/**
 * Agent Outputs - Zod schemas for Phase 2 worker outputs
 *
 * Current workers (v3 architecture, 2026-02):
 * - ThinkingQuality: Planning + Critical Thinking
 * - CommunicationPatterns: Communication patterns + Signature quotes
 * - LearningBehavior: Knowledge gaps + repeated mistakes analysis
 * - ContextEfficiency: Token efficiency patterns
 *
 * Legacy schemas (TrustVerification, WorkflowHabit, KnowledgeGap, etc.)
 * are kept for backward compatibility with cached data (30-day retention).
 *
 * Schemas use structured arrays (not semicolon-separated strings) to comply
 * with Gemini's 4-level nesting limit while maintaining type safety.
 *
 * @module models/agent-outputs
 */

import { z } from 'zod';
import { CodingStyleTypeSchema, AIControlLevelSchema } from './coding-style';
import {
  WorkerStrengthSchema,
  type WorkerStrength,
  WorkerGrowthSchema,
  type WorkerGrowth,
  StructuredStrengthLLMSchema,
  StructuredGrowthLLMSchema,
  parseWorkerStrengthsData,
  parseWorkerGrowthAreasData,
  parseStructuredStrengths,
  parseStructuredGrowthAreas,
  type AggregatedWorkerInsights,
  WORKER_DOMAIN_CONFIGS,
  ReferencedInsightSchema,
  type ReferencedInsight,
} from './worker-insights';

// ============================================================================
// Referenced Insight Schema (re-exported from worker-insights.ts)
// ============================================================================

// Re-export for backward compatibility - canonical definition in worker-insights.ts
export { ReferencedInsightSchema, type ReferencedInsight };

// Import shared parsing utilities from legacy-agent-parsers
import {
  type AgentStrength,
  type AgentSeverityLevel,
  type AgentGrowthArea,
  parseStrengthsData,
  parseGrowthAreasData,
  type ParsedResource,
  parseRecommendedResourcesData,
  type RepeatedCommandPattern,
  parseRepeatedCommandPatternsData,
} from './legacy-agent-parsers';

// Re-export for backward compatibility
export {
  type AgentStrength,
  type AgentSeverityLevel,
  type AgentGrowthArea,
  parseStrengthsData,
  parseGrowthAreasData,
  type ParsedResource,
  parseRecommendedResourcesData,
  type RepeatedCommandPattern,
  parseRepeatedCommandPatternsData,
};


// ============================================================================
// Knowledge Gap Analyzer: Knowledge Gaps + Learning Suggestions
// ============================================================================

/**
 * LLM output schema for knowledge gap (nesting depth: 2)
 * root{} → knowledgeGaps[] → KnowledgeGapLLM{}
 */
export const KnowledgeGapItemLLMSchema = z.object({
  /** Topic name (e.g., "TypeScript generics", "async/await") */
  topic: z.string(),
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

/**
 * Knowledge Gap Analyzer Output Schema
 *
 * Detects:
 * - Knowledge gaps from repeated questions
 * - Learning progress tracking
 * - Resource recommendations
 */
export const KnowledgeGapOutputSchema = z.object({
  /** Knowledge gaps detected (structured array) */
  knowledgeGaps: z.array(KnowledgeGapItemLLMSchema),

  /** Learning progress tracked (structured array) */
  learningProgress: z.array(LearningProgressLLMSchema),

  /** Recommended resources (structured array) */
  recommendedResources: z.array(ResourceLLMSchema),

  // Legacy string fields for backward compatibility with cached data
  knowledgeGapsData: z.string().optional(),
  learningProgressData: z.string().optional(),
  recommendedResourcesData: z.string().optional(),

  // Top 3 Wow Insights (sliced to 3 since Gemini's maxItems constraint is removed)
  topInsights: z.array(z.string()).transform((arr) => arr.slice(0, 3)),

  // KPT (Keep/Problem/Try) structured fields for balanced feedback
  kptKeep: z.array(z.string()).transform((arr) => arr.slice(0, 2)).optional(),     // Knowledge strengths (0-1)
  kptProblem: z.array(z.string()).transform((arr) => arr.slice(0, 2)).optional(),  // Knowledge gaps to address (1-2, expected)
  kptTry: z.array(z.string()).transform((arr) => arr.slice(0, 2)).optional(),      // Learning recommendations (1-2, expected)

  // Overall knowledge score (0-100)
  overallKnowledgeScore: z.number().min(0).max(100),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),

  // ─────────────────────────────────────────────────────────────────────────
  // Domain-specific Strengths & Growth Areas (replaces StrengthGrowthSynthesizer)
  // ─────────────────────────────────────────────────────────────────────────

  // Legacy string fields (deprecated, kept for backward compatibility)
  strengthsData: z.string().optional(),
  growthAreasData: z.string().optional(),

  // Parsed structured strengths (populated by parsing function)
  strengths: z.array(WorkerStrengthSchema).optional(),

  // Parsed structured growth areas (populated by parsing function)
  growthAreas: z.array(WorkerGrowthSchema).optional(),

  /** Referenced insights from Knowledge Base (post-processed from [pi-XXX] references) */
  referencedInsights: z.array(ReferencedInsightSchema).optional(),
});

export type KnowledgeGapOutput = z.infer<typeof KnowledgeGapOutputSchema>;

// ============================================================================
// Knowledge Gap LLM Output Schema (Structured Arrays for Gemini API)
// ============================================================================

/**
 * Structured schema for Gemini API (uses arrays instead of semicolon-separated strings).
 * Nesting depth is safe: root{} → array[] → object{} = 2 levels
 */
export const KnowledgeGapLLMOutputSchema = z.object({
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

  // Top 3 Wow Insights (sliced to 3 since Gemini's maxItems constraint is removed)
  topInsights: z.array(z.string()).transform((arr) => arr.slice(0, 3)),

  // KPT (Keep/Problem/Try) structured fields for balanced feedback
  kptKeep: z.array(z.string()).transform((arr) => arr.slice(0, 2)).optional(),
  kptProblem: z.array(z.string()).transform((arr) => arr.slice(0, 2)).optional(),
  kptTry: z.array(z.string()).transform((arr) => arr.slice(0, 2)).optional(),

  // Overall knowledge score (0-100)
  overallKnowledgeScore: z.number().min(0).max(100),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),

  /**
   * Strengths identified in knowledge & learning domain (1-6 items).
   * Evidence format: "utteranceId:quote[:context]"
   */
  strengths: z.array(StructuredStrengthLLMSchema).min(1).max(6).optional(),

  /**
   * Growth areas identified in knowledge & learning domain (1-6 items).
   * Evidence format: "utteranceId:quote[:context]"
   */
  growthAreas: z.array(StructuredGrowthLLMSchema).min(1).max(6),
});
export type KnowledgeGapLLMOutput = z.infer<typeof KnowledgeGapLLMOutputSchema>;

// ============================================================================
// Legacy String Conversion Helpers (for backward compatibility)
// ============================================================================

function toSemicolonString<T>(items: T[], formatter: (item: T) => string): string {
  return items.map(formatter).join(';');
}

function convertKnowledgeGapsToString(gaps: KnowledgeGapItemLLM[]): string {
  return toSemicolonString(gaps, (g) => `${g.topic}:${g.questionCount}:${g.depth}:${g.example}`);
}

function convertLearningProgressToString(progress: LearningProgressLLM[]): string {
  return toSemicolonString(progress, (p) => `${p.topic}:${p.startLevel}:${p.currentLevel}:${p.evidence}`);
}

function convertResourcesToString(resources: ResourceLLM[]): string {
  return toSemicolonString(resources, (r) => `${r.topic}:${r.resourceType}:${r.url}`);
}

/**
 * Convert LLM output to structured KnowledgeGapOutput
 * Now uses structured arrays directly and generates legacy strings for backward compatibility
 */
export function parseKnowledgeGapLLMOutput(llmOutput: KnowledgeGapLLMOutput): KnowledgeGapOutput {
  // Parse structured LLM output - evidence strings are converted to InsightEvidence objects
  const strengths = parseStructuredStrengths(llmOutput.strengths);
  const growthAreas = parseStructuredGrowthAreas(llmOutput.growthAreas);

  return {
    // Structured arrays (new format)
    knowledgeGaps: llmOutput.knowledgeGaps || [],
    learningProgress: llmOutput.learningProgress || [],
    recommendedResources: llmOutput.recommendedResources || [],

    // Legacy string format for backward compatibility
    knowledgeGapsData: convertKnowledgeGapsToString(llmOutput.knowledgeGaps || []),
    learningProgressData: convertLearningProgressToString(llmOutput.learningProgress || []),
    recommendedResourcesData: convertResourcesToString(llmOutput.recommendedResources || []),

    topInsights: llmOutput.topInsights,
    kptKeep: llmOutput.kptKeep,
    kptProblem: llmOutput.kptProblem,
    kptTry: llmOutput.kptTry,
    overallKnowledgeScore: llmOutput.overallKnowledgeScore,
    confidenceScore: llmOutput.confidenceScore,
    strengths,
    growthAreas,
  };
}

// ============================================================================
// Context Efficiency Analyzer: Token Inefficiency Patterns
// ============================================================================

/**
 * LLM output schema for context usage pattern (nesting depth: 2)
 * root{} → contextUsagePatterns[] → ContextUsageLLM{}
 */
export const ContextUsageLLMSchema = z.object({
  /** Session ID */
  sessionId: z.string(),
  /** Average fill percentage (0-100) */
  avgFillPercent: z.number().min(0).max(100),
  /** Compact trigger percentage (0-100) */
  compactTriggerPercent: z.number().min(0).max(100).optional(),
});
export type ContextUsageLLM = z.infer<typeof ContextUsageLLMSchema>;

/**
 * Predefined inefficiency pattern types.
 *
 * These are the ONLY allowed pattern values for inefficiencyPatterns.
 * LLM must choose from this enum, ensuring consistent output for:
 * - UI rendering (icons, colors, localized descriptions)
 * - Analytics aggregation
 * - Cross-session comparisons
 *
 * Pattern definitions:
 * - late_compact: Only uses /compact when context is 90%+ full
 * - context_bloat: Context accumulates without /clear, causing degraded responses
 * - redundant_info: Same information provided multiple times in session
 * - prompt_length_inflation: Prompts get progressively longer late in session
 * - no_session_separation: Uses same session for unrelated tasks
 * - verbose_error_pasting: Pastes full error messages/logs without summarizing
 */
export const InefficiencyPatternEnum = z.enum([
  'late_compact',           // Only uses /compact at 90%+ context fill
  'context_bloat',          // No /clear usage, context keeps accumulating
  'redundant_info',         // Same information repeated multiple times
  'prompt_length_inflation',// Prompts get longer as session progresses
  'no_session_separation',  // Uses same session for different tasks
  'verbose_error_pasting',  // Pastes entire error messages/stack traces
]);
export type InefficiencyPattern = z.infer<typeof InefficiencyPatternEnum>;

/**
 * LLM output schema for inefficiency pattern (nesting depth: 2)
 * root{} → inefficiencyPatterns[] → InefficiencyLLM{}
 */
export const InefficiencyLLMSchema = z.object({
  /** Pattern type (MUST be one of the predefined enum values) */
  pattern: InefficiencyPatternEnum,
  /** Frequency count */
  frequency: z.number().int().min(1),
  /** Impact level */
  impact: z.enum(['high', 'medium', 'low']),
  /** Description/example */
  description: z.string(),
});
export type InefficiencyLLM = z.infer<typeof InefficiencyLLMSchema>;

/**
 * LLM output schema for prompt length trend (nesting depth: 2)
 * root{} → promptLengthTrends[] → TrendLLM{}
 */
export const PromptLengthTrendLLMSchema = z.object({
  /** Session phase: early | mid | late */
  phase: z.enum(['early', 'mid', 'late']),
  /** Average character length */
  avgLength: z.number().int().min(0),
});
export type PromptLengthTrendLLM = z.infer<typeof PromptLengthTrendLLMSchema>;

/**
 * LLM output schema for redundant info (nesting depth: 2)
 * root{} → redundantInfo[] → RedundantLLM{}
 */
export const RedundantInfoLLMSchema = z.object({
  /** Info type (e.g., "project_structure", "tech_stack") */
  infoType: z.string(),
  /** Repeat count */
  repeatCount: z.number().int().min(1),
});
export type RedundantInfoLLM = z.infer<typeof RedundantInfoLLMSchema>;

/**
 * LLM output schema for iteration summary (nesting depth: 2)
 * root{} → iterationSummaries[] → IterationLLM{}
 */
export const IterationSummaryLLMSchema = z.object({
  /** Session ID */
  sessionId: z.string(),
  /** Number of iteration cycles */
  iterationCount: z.number().int().min(0),
  /** Average turns per iteration */
  avgTurnsPerIteration: z.number().min(0),
});
export type IterationSummaryLLM = z.infer<typeof IterationSummaryLLMSchema>;

/**
 * Context Efficiency Analyzer Output Schema
 *
 * Detects:
 * - Context usage patterns (fill %)
 * - Inefficiency patterns (late compact, etc.)
 * - Prompt length trends
 * - Redundant information patterns
 */
export const ContextEfficiencyOutputSchema = z.object({
  /** Context usage patterns (structured array) */
  contextUsagePatterns: z.array(ContextUsageLLMSchema),

  /** Inefficiency patterns (structured array) */
  inefficiencyPatterns: z.array(InefficiencyLLMSchema),

  /** Prompt length trends (structured array) */
  promptLengthTrends: z.array(PromptLengthTrendLLMSchema),

  /** Redundant info patterns (structured array) */
  redundantInfo: z.array(RedundantInfoLLMSchema),

  // Legacy string fields for backward compatibility
  contextUsagePatternData: z.string().optional(),
  inefficiencyPatternsData: z.string().optional(),
  promptLengthTrendData: z.string().optional(),
  redundantInfoData: z.string().optional(),

  // Top 3 Wow Insights (sliced to 3 since Gemini's maxItems constraint is removed)
  topInsights: z.array(z.string()).transform((arr) => arr.slice(0, 3)),

  // KPT (Keep/Problem/Try) structured fields for balanced feedback
  kptKeep: z.array(z.string()).transform((arr) => arr.slice(0, 2)).optional(),     // Efficient habits (0-1)
  kptProblem: z.array(z.string()).transform((arr) => arr.slice(0, 2)).optional(),  // Inefficiencies to address (1-2, expected)
  kptTry: z.array(z.string()).transform((arr) => arr.slice(0, 2)).optional(),      // Efficiency improvements (1-2, expected)

  // Overall efficiency score (0-100)
  overallEfficiencyScore: z.number().min(0).max(100),

  // Average context fill percent (0-100)
  avgContextFillPercent: z.number().min(0).max(100),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),

  // ─────────────────────────────────────────────────────────────────────────
  // Domain-specific Strengths & Growth Areas (replaces StrengthGrowthSynthesizer)
  // ─────────────────────────────────────────────────────────────────────────

  // Legacy string fields (deprecated, kept for backward compatibility)
  strengthsData: z.string().optional(),
  growthAreasData: z.string().optional(),

  // Parsed structured strengths (populated by parsing function)
  strengths: z.array(WorkerStrengthSchema).optional(),

  // Parsed structured growth areas (populated by parsing function)
  growthAreas: z.array(WorkerGrowthSchema).optional(),

  /** Referenced insights from Knowledge Base (post-processed from [pi-XXX] references) */
  referencedInsights: z.array(ReferencedInsightSchema).optional(),

  // Productivity metrics (consolidated from ProductivityAnalyst)
  /** Iteration summaries (structured array) */
  iterationSummaries: z.array(IterationSummaryLLMSchema).optional(),

  // Legacy string field
  iterationSummaryData: z.string().optional(),

  // Collaboration efficiency score (0-100)
  collaborationEfficiencyScore: z.number().min(0).max(100).optional(),

  // Overall productivity score (0-100)
  overallProductivityScore: z.number().min(0).max(100).optional(),

  // Productivity summary
  productivitySummary: z.string().optional(),
});

export type ContextEfficiencyOutput = z.infer<typeof ContextEfficiencyOutputSchema>;

// ============================================================================
// Context Efficiency LLM Output Schema (Structured Arrays for Gemini API)
// ============================================================================

/**
 * Structured schema for Gemini API (uses arrays instead of semicolon-separated strings).
 * Nesting depth is safe: root{} → array[] → object{} = 2 levels
 */
export const ContextEfficiencyLLMOutputSchema = z.object({
  /**
   * Context usage patterns (structured array, nesting depth: 2)
   * Replaces semicolon-separated contextUsagePatternData string
   */
  contextUsagePatterns: z.array(ContextUsageLLMSchema),

  /**
   * Inefficiency patterns (structured array, nesting depth: 2)
   * Replaces semicolon-separated inefficiencyPatternsData string
   */
  inefficiencyPatterns: z.array(InefficiencyLLMSchema),

  /**
   * Prompt length trends (structured array, nesting depth: 2)
   * Replaces semicolon-separated promptLengthTrendData string
   */
  promptLengthTrends: z.array(PromptLengthTrendLLMSchema),

  /**
   * Redundant info patterns (structured array, nesting depth: 2)
   * Replaces semicolon-separated redundantInfoData string
   */
  redundantInfo: z.array(RedundantInfoLLMSchema),

  // Top 3 Wow Insights (sliced to 3 since Gemini's maxItems constraint is removed)
  topInsights: z.array(z.string()).transform((arr) => arr.slice(0, 3)),

  // KPT (Keep/Problem/Try) structured fields for balanced feedback
  kptKeep: z.array(z.string()).transform((arr) => arr.slice(0, 2)).optional(),
  kptProblem: z.array(z.string()).transform((arr) => arr.slice(0, 2)).optional(),
  kptTry: z.array(z.string()).transform((arr) => arr.slice(0, 2)).optional(),

  // Overall efficiency score (0-100)
  overallEfficiencyScore: z.number().min(0).max(100),

  // Average context fill percent (0-100)
  avgContextFillPercent: z.number().min(0).max(100),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),

  /**
   * Strengths identified in context efficiency domain (1-6 items).
   * Evidence format: "utteranceId:quote[:context]"
   */
  strengths: z.array(StructuredStrengthLLMSchema).min(1).max(6).optional(),

  /**
   * Growth areas identified in context efficiency domain (1-6 items).
   * Evidence format: "utteranceId:quote[:context]"
   */
  growthAreas: z.array(StructuredGrowthLLMSchema).min(1).max(6),

  // Productivity metrics (consolidated from ProductivityAnalyst)
  /**
   * Iteration summaries (structured array, nesting depth: 2)
   * Replaces semicolon-separated iterationSummaryData string
   */
  iterationSummaries: z.array(IterationSummaryLLMSchema).optional(),

  collaborationEfficiencyScore: z.number().min(0).max(100).optional(),
  overallProductivityScore: z.number().min(0).max(100).optional(),
  productivitySummary: z.string().optional(),
});
export type ContextEfficiencyLLMOutput = z.infer<typeof ContextEfficiencyLLMOutputSchema>;

function convertContextUsageToString(patterns: ContextUsageLLM[]): string {
  return toSemicolonString(patterns, (p) => `${p.sessionId}:${p.avgFillPercent}:${p.compactTriggerPercent ?? ''}`);
}

function convertInefficiencyToString(patterns: InefficiencyLLM[]): string {
  return toSemicolonString(patterns, (p) => `${p.pattern}:${p.frequency}:${p.impact}:${p.description}`);
}

function convertPromptLengthTrendToString(trends: PromptLengthTrendLLM[]): string {
  return toSemicolonString(trends, (t) => `${t.phase}:${t.avgLength}`);
}

function convertRedundantInfoToString(info: RedundantInfoLLM[]): string {
  return toSemicolonString(info, (i) => `${i.infoType}:${i.repeatCount}`);
}

function convertIterationSummaryToString(summaries: IterationSummaryLLM[] | undefined): string | undefined {
  if (!summaries || summaries.length === 0) return undefined;
  return summaries.map((s) => `${s.sessionId}|${s.iterationCount}|${s.avgTurnsPerIteration}`).join(';');
}

/**
 * Convert LLM output to structured ContextEfficiencyOutput
 * Now uses structured arrays directly and generates legacy strings for backward compatibility
 */
export function parseContextEfficiencyLLMOutput(llmOutput: ContextEfficiencyLLMOutput): ContextEfficiencyOutput {
  // Parse structured LLM output - evidence strings are converted to InsightEvidence objects
  const strengths = parseStructuredStrengths(llmOutput.strengths);
  const growthAreas = parseStructuredGrowthAreas(llmOutput.growthAreas);

  return {
    // Structured arrays (new format)
    contextUsagePatterns: llmOutput.contextUsagePatterns || [],
    inefficiencyPatterns: llmOutput.inefficiencyPatterns || [],
    promptLengthTrends: llmOutput.promptLengthTrends || [],
    redundantInfo: llmOutput.redundantInfo || [],
    iterationSummaries: llmOutput.iterationSummaries,

    // Legacy string format for backward compatibility
    contextUsagePatternData: convertContextUsageToString(llmOutput.contextUsagePatterns || []),
    inefficiencyPatternsData: convertInefficiencyToString(llmOutput.inefficiencyPatterns || []),
    promptLengthTrendData: convertPromptLengthTrendToString(llmOutput.promptLengthTrends || []),
    redundantInfoData: convertRedundantInfoToString(llmOutput.redundantInfo || []),
    iterationSummaryData: convertIterationSummaryToString(llmOutput.iterationSummaries),

    topInsights: llmOutput.topInsights,
    kptKeep: llmOutput.kptKeep,
    kptProblem: llmOutput.kptProblem,
    kptTry: llmOutput.kptTry,
    overallEfficiencyScore: llmOutput.overallEfficiencyScore,
    avgContextFillPercent: llmOutput.avgContextFillPercent,
    confidenceScore: llmOutput.confidenceScore,
    strengths,
    growthAreas,
    collaborationEfficiencyScore: llmOutput.collaborationEfficiencyScore,
    overallProductivityScore: llmOutput.overallProductivityScore,
    productivitySummary: llmOutput.productivitySummary,
  };
}

// ============================================================================
// Temporal Analysis Output (REDESIGNED)
// ============================================================================

// Import from dedicated schema file
import {
  TemporalAnalysisResultSchema,
  type TemporalAnalysisResult,
  TemporalInsightsOutputSchema,
  type TemporalInsightsOutput,
} from './temporal-data';
import { TemporalMetricsSchema, type TemporalMetrics } from './temporal-metrics';
export {
  TemporalAnalysisResultSchema,
  type TemporalAnalysisResult,
  TemporalInsightsOutputSchema,
  type TemporalInsightsOutput,
  TemporalMetricsSchema,
  type TemporalMetrics,
};

// ============================================================================
// Type Classifier Output (v2 Architecture)
// ============================================================================

/**
 * Type Classifier Output Schema (v2)
 *
 * Classifies the developer into the 15-type matrix (5 styles × 3 control levels).
 * Also includes the "Vibe Coder Spectrum" assessment.
 *
 * NOTE: Defined here (before AgentOutputsSchema) to avoid forward reference issues.
 */
export const TypeClassifierOutputSchema = z.object({
  /** Primary coding style type */
  primaryType: CodingStyleTypeSchema,

  /** Type distribution percentages (sum to 100) */
  distribution: z.object({
    architect: z.number().min(0).max(100),
    analyst: z.number().min(0).max(100),
    conductor: z.number().min(0).max(100),
    speedrunner: z.number().min(0).max(100),
    trendsetter: z.number().min(0).max(100),
  }),

  /** AI control level */
  controlLevel: AIControlLevelSchema,

  /** Raw control score (0-100) */
  controlScore: z.number().min(0).max(100),

  /** Combined matrix name (e.g., "Systems Architect", "Yolo Coder") */
  matrixName: z.string(),

  /** Matrix emoji */
  matrixEmoji: z.string(),

  /** Vibe Coder Spectrum assessment (from Addy Osmani research) */
  collaborationMaturity: z.object({
    /** Where on the spectrum: vibe_coder → ai_assisted_engineer */
    level: z.enum(['vibe_coder', 'supervised_coder', 'ai_assisted_engineer', 'reluctant_user']),
    /** Human-readable description */
    description: z.string(),
    /** Key indicators that led to this assessment */
    indicators: z.array(z.string()),
  }).optional(),

  /** Confidence score (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Personalized personality narrative explaining the classification (array of 3-4 paragraphs, each 300-600 chars) */
  reasoning: z.union([z.array(z.string()), z.string()]),

  // ─────────────────────────────────────────────────────────────────────────
  // Synthesis Fields (merged from TypeSynthesis)
  // ─────────────────────────────────────────────────────────────────────────

  /** Reasons for adjustments from initial or pattern-based classification */
  adjustmentReasons: z.array(z.string()).max(5).optional(),

  /** How much confidence increased from agent synthesis (0-1) */
  confidenceBoost: z.number().min(0).max(1).optional(),

  /** Evidence from other Phase 2 agent outputs - "agent:key_signal:detail;..." */
  synthesisEvidence: z.string().optional(),
});
export type TypeClassifierOutput = z.infer<typeof TypeClassifierOutputSchema>;

/**
 * Normalize TypeClassifier reasoning (string | string[]) to a single string.
 *
 * New data produces string[] (array of paragraphs). Legacy cached data may
 * still contain a plain string. This helper unifies both formats.
 *
 * @param reasoning - reasoning field from TypeClassifierOutput
 * @returns Paragraphs joined by double newlines, or empty string if absent
 */
export function normalizeReasoning(reasoning: string | string[] | undefined): string {
  if (reasoning === undefined) return '';
  if (Array.isArray(reasoning)) return reasoning.join('\n\n');
  return reasoning;
}

// ============================================================================
// Combined Agent Outputs
// ============================================================================

/**
 * Combined outputs from all Phase 2 Workers
 *
 * v3 architecture workers:
 * - ThinkingQuality: Planning, critical thinking
 * - CommunicationPatterns: Communication patterns, signature quotes
 * - LearningBehavior: Knowledge gaps, learning progress, repeated mistakes
 * - Efficiency: Token efficiency patterns
 * - TypeClassifier: Developer type classification
 *
 * All fields are optional since agents may fail independently.
 */
export const AgentOutputsSchema = z.object({
  // =========================================================================
  // Legacy Agents (kept for backward compatibility with cached data)
  // =========================================================================
  knowledgeGap: KnowledgeGapOutputSchema.optional(),
  contextEfficiency: ContextEfficiencyOutputSchema.optional(),

  // Legacy: Temporal Analysis (kept for stored data)
  temporalAnalysis: TemporalAnalysisResultSchema.optional(),

  // =========================================================================
  // Type Classification
  // =========================================================================
  typeClassifier: TypeClassifierOutputSchema.optional(),

  // =========================================================================
  // v3 Architecture Workers (Capability-based unified workers)
  // =========================================================================

  /**
   * Thinking Quality analysis
   *
   * Answers: "How intentionally and critically does this developer work?"
   * - Planning: How structured are their plans?
   * - Critical Thinking: Do they verify AI outputs?
   */
  thinkingQuality: ThinkingQualityOutputSchema.optional(),

  /**
   * Communication Patterns analysis
   *
   * Answers: "How clearly does this developer communicate with AI?"
   * - Communication Patterns: Distinctive communication styles
   * - Signature Quotes: Most impressive communication moments
   */
  communicationPatterns: CommunicationPatternsOutputSchema.optional(),

  /**
   * Learning Behavior analysis
   *
   * Answers: "How much does this developer try to learn? Do they repeat mistakes?"
   * - Knowledge Gaps: What topics do they struggle with?
   * - Learning Progress: Are they improving over time?
   * - Repeated Mistakes: Do they learn from errors?
   */
  learningBehavior: LearningBehaviorOutputSchema.optional(),

  /**
   * Efficiency analysis (from ContextEfficiency)
   *
   * Answers: "How efficiently do they use tokens?"
   * - Context Usage: How well do they manage context window?
   * - Inefficiency Patterns: What wastes tokens?
   */
  efficiency: ContextEfficiencyOutputSchema.optional(),

  /**
   * Session Outcome analysis (NEW - inspired by Claude /insights)
   *
   * Answers: "How successful are this developer's sessions?"
   * - Goal Categories: What do they work on?
   * - Session Types: How are sessions structured?
   * - Outcomes: Do they achieve their goals?
   * - Friction: What obstacles do they encounter?
   */
  sessionOutcome: SessionOutcomeOutputSchema.optional(),
});

export type AgentOutputs = z.infer<typeof AgentOutputsSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create empty/default agent outputs
 */
export function createEmptyAgentOutputs(): AgentOutputs {
  return {};
}

/**
 * Check if any agent produced output
 */
export function hasAnyAgentOutput(outputs: AgentOutputs): boolean {
  return !!(
    // v3 unified workers (primary)
    outputs.thinkingQuality ||
    outputs.communicationPatterns ||
    outputs.learningBehavior ||
    outputs.efficiency ||
    outputs.sessionOutcome ||
    // Type classifier
    outputs.typeClassifier ||
    // Legacy agents (kept for cached data compatibility)
    outputs.knowledgeGap ||
    outputs.contextEfficiency ||
    outputs.temporalAnalysis
  );
}

/**
 * Get all top insights from all agents (flattened)
 */
export function getAllTopInsights(outputs: AgentOutputs): string[] {
  const insights: string[] = [];

  // Legacy agents (kept for cached data)
  if (outputs.knowledgeGap?.topInsights) {
    insights.push(...outputs.knowledgeGap.topInsights);
  }
  if (outputs.contextEfficiency?.topInsights) {
    insights.push(...outputs.contextEfficiency.topInsights);
  }
  // Temporal insights are nested under insights.topInsights
  if (outputs.temporalAnalysis?.insights?.topInsights) {
    insights.push(...outputs.temporalAnalysis.insights.topInsights);
  }

  // v3 unified workers
  if (outputs.learningBehavior?.topInsights) {
    insights.push(...outputs.learningBehavior.topInsights);
  }
  if (outputs.efficiency?.topInsights) {
    insights.push(...outputs.efficiency.topInsights);
  }

  return insights;
}

// ============================================================================
// Growth Area Deduplication Logic
// ============================================================================

/**
 * Common stop words to remove when normalizing titles for similarity comparison.
 * These words don't contribute to semantic meaning for pattern identification.
 */
const TITLE_STOP_WORDS = [
  'pattern', 'habit', 'behavior', 'behaviour', 'issue', 'problem',
  'and', 'the', 'a', 'an', 'of', 'in', 'for', 'with', 'to', 'on',
  'tendency', 'style', 'approach', 'practice', 'area',
];

/**
 * Normalize title for similarity comparison
 *
 * Transforms titles to a canonical form for comparison:
 * - Converts to lowercase
 * - Removes punctuation and special characters
 * - Removes common stop words (pattern, habit, behavior, etc.)
 * - Sorts remaining words alphabetically
 *
 * @example
 * normalizeTitle("Blind Approval Pattern") // "approval blind"
 * normalizeTitle("Blind Approval Habit")   // "approval blind"
 * normalizeTitle("Blind Approval & Verification") // "approval blind verification"
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')  // Replace punctuation with spaces
    .split(/\s+/)
    .filter(w => w && !TITLE_STOP_WORDS.includes(w))
    .sort()
    .join(' ');
}

/**
 * Calculate Jaccard similarity between two normalized titles
 *
 * Jaccard similarity = |A ∩ B| / |A ∪ B|
 * Returns a value between 0 (no overlap) and 1 (identical)
 *
 * @example
 * calculateSimilarity("approval blind", "approval blind") // 1.0
 * calculateSimilarity("approval blind", "approval blind verification") // 0.67
 */
function calculateSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(' ').filter(Boolean));
  const setB = new Set(b.split(' ').filter(Boolean));

  if (setA.size === 0 && setB.size === 0) return 1; // Both empty = identical

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Merge a group of similar growth areas into a single representative item
 *
 * Merging strategy:
 * - Title: shortest (most concise)
 * - Description: longest (most detailed)
 * - Evidence: merge all, deduplicate
 * - Recommendation: longest (most comprehensive)
 * - Frequency/PriorityScore: maximum value
 * - Severity: highest level
 */
function mergeGrowthAreaGroup(group: AgentGrowthArea[]): AgentGrowthArea {
  if (group.length === 1) return group[0];

  // Helper: find item by string field length comparison
  const byLength = <T extends { [K in F]?: string | undefined }, F extends string>(
    items: T[],
    field: F,
    preferLonger: boolean
  ): T => items.reduce((a, b) => {
    const lenA = (a[field] as string | undefined)?.length ?? 0;
    const lenB = (b[field] as string | undefined)?.length ?? 0;
    return preferLonger ? (lenA >= lenB ? a : b) : (lenA <= lenB ? a : b);
  });

  // Helper: get max from optional numbers
  const maxOf = (nums: (number | undefined)[]): number | undefined => {
    const valid = nums.filter((n): n is number => n !== undefined);
    return valid.length > 0 ? Math.max(...valid) : undefined;
  };

  // Severity ordering
  const severityOrder: Record<AgentSeverityLevel, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const severities = group.map(g => g.severity).filter((s): s is AgentSeverityLevel => s !== undefined);

  return {
    title: byLength(group, 'title', false).title,
    description: byLength(group, 'description', true).description,
    evidence: [...new Set(group.flatMap(g => g.evidence))],
    recommendation: byLength(group, 'recommendation', true).recommendation,
    frequency: maxOf(group.map(g => g.frequency)),
    severity: severities.length > 0
      ? severities.reduce((a, b) => severityOrder[a] >= severityOrder[b] ? a : b)
      : undefined,
    priorityScore: maxOf(group.map(g => g.priorityScore)),
  };
}

/**
 * Similarity threshold for grouping growth areas.
 * 0.5 = 50% word overlap after normalization required to be considered similar.
 *
 * Examples at 0.5 threshold:
 * - "Blind Approval Pattern" vs "Blind Approval Habit" → 1.0 (grouped)
 * - "Blind Approval" vs "Blind Approval & Verification" → 0.67 (grouped)
 * - "Context Provision" vs "Error Handling" → 0.0 (not grouped)
 */
const SIMILARITY_THRESHOLD = 0.5;

/**
 * Group similar growth areas by title similarity
 *
 * Uses greedy clustering: for each unassigned area, find all areas
 * with similarity >= threshold and group them together.
 *
 * @param areas - Raw list of growth areas from multiple agents
 * @returns Deduplicated list with similar items merged
 */
function groupSimilarGrowthAreas(areas: AgentGrowthArea[]): AgentGrowthArea[] {
  if (areas.length === 0) return [];

  const groups: AgentGrowthArea[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < areas.length; i++) {
    if (used.has(i)) continue;

    const group: AgentGrowthArea[] = [areas[i]];
    used.add(i);

    const normA = normalizeTitle(areas[i].title);

    for (let j = i + 1; j < areas.length; j++) {
      if (used.has(j)) continue;

      const normB = normalizeTitle(areas[j].title);
      if (calculateSimilarity(normA, normB) >= SIMILARITY_THRESHOLD) {
        group.push(areas[j]);
        used.add(j);
      }
    }

    groups.push(group);
  }

  return groups.map(mergeGrowthAreaGroup);
}

// ============================================================================
// Growth Area Collection
// ============================================================================

// ============================================================================
// Diagnosis / Prescription Separation
// ============================================================================

/**
 * Diagnosis - FREE tier content
 *
 * Contains: WHAT is the issue and WHY it matters
 * - Title and description of the growth area
 * - Evidence quotes showing the pattern
 * - Frequency and severity metrics
 *
 * This content answers "What needs to improve?" and is shown to all users.
 */
export interface GrowthDiagnosis {
  /** Clear pattern name */
  title: string;
  /** Description of the issue and why it matters */
  description: string;
  /** Evidence quotes from actual sessions */
  evidence: string[];
  /** Session occurrence percentage (0-100) */
  frequency?: number;
  /** Severity level: critical | high | medium | low */
  severity?: AgentSeverityLevel;
  /** Computed priority score (0-100) */
  priorityScore?: number;
}

/**
 * Prescription - PREMIUM tier content
 *
 * Contains: HOW to fix the issue
 * - Specific actionable recommendations
 * - Learning resources and links
 * - Step-by-step improvement path
 *
 * This content answers "How do I improve?" and is shown only to paid users.
 */
export interface GrowthPrescription {
  /** Specific, actionable recommendation */
  recommendation: string;
  /** Learning resources (URLs, courses, docs) */
  resources?: string[];
  /** Step-by-step action items */
  actionSteps?: string[];
}

/**
 * Complete growth insight combining diagnosis and prescription
 */
export interface GrowthInsight {
  /** FREE: The problem identification */
  diagnosis: GrowthDiagnosis;
  /** PREMIUM: The solution */
  prescription: GrowthPrescription;
}

/**
 * Convert AgentGrowthArea to separated Diagnosis and Prescription
 *
 * @param area - Full growth area data
 * @returns Separated diagnosis and prescription
 */
export function separateDiagnosisPrescription(area: AgentGrowthArea): GrowthInsight {
  return {
    diagnosis: {
      title: area.title,
      description: area.description,
      evidence: area.evidence,
      frequency: area.frequency,
      severity: area.severity,
      priorityScore: area.priorityScore,
    },
    prescription: {
      recommendation: area.recommendation,
      // resources and actionSteps can be extracted from recommendation if structured
      resources: undefined,
      actionSteps: undefined,
    },
  };
}

/**
 * Extract only the diagnosis (FREE tier) from a growth area
 *
 * Use this to create free tier content that shows the problem but not the solution.
 *
 * @param area - Full growth area data
 * @returns Diagnosis only (no recommendation)
 */
export function extractDiagnosisOnly(area: AgentGrowthArea): GrowthDiagnosis {
  return {
    title: area.title,
    description: area.description,
    evidence: area.evidence,
    frequency: area.frequency,
    severity: area.severity,
    priorityScore: area.priorityScore,
  };
}

/**
 * Create a locked growth area for free tier users
 *
 * Retains all diagnosis information but removes the recommendation.
 *
 * @param area - Full growth area data
 * @returns Growth area with empty recommendation
 */
export function createLockedGrowthArea(area: AgentGrowthArea): AgentGrowthArea {
  return {
    ...area,
    recommendation: '', // Prescription is locked
  };
}

// ============================================================================
// Translated Agent Insights Helper Functions
// ============================================================================

import type { TranslatedAgentInsights, TranslatedAgentInsight } from './verbose-evaluation';

/**
 * Agent keys that may have translated insights
 */
export type TranslatedAgentKey =
  | 'knowledgeGap'
  | 'contextEfficiency'
  | 'temporalAnalysis';

/**
 * Get growth areas from a specific translated agent
 *
 * @param insights - TranslatedAgentInsights object from Content Writer
 * @param agentKey - The agent key to get growth areas from
 * @returns Parsed AgentGrowthArea array
 */
export function getTranslatedAgentGrowthAreas(
  insights: TranslatedAgentInsights | undefined,
  agentKey: TranslatedAgentKey
): AgentGrowthArea[] {
  if (!insights) return [];

  const agent = insights[agentKey] as TranslatedAgentInsight | undefined;
  if (!agent?.growthAreasData) return [];

  return parseGrowthAreasData(agent.growthAreasData);
}

/**
 * Get strengths from a specific translated agent
 *
 * @param insights - TranslatedAgentInsights object from Content Writer
 * @param agentKey - The agent key to get strengths from
 * @returns Parsed AgentStrength array
 */
export function getTranslatedAgentStrengths(
  insights: TranslatedAgentInsights | undefined,
  agentKey: TranslatedAgentKey
): AgentStrength[] {
  if (!insights) return [];

  const agent = insights[agentKey] as TranslatedAgentInsight | undefined;
  if (!agent?.strengthsData) return [];

  return parseStrengthsData(agent.strengthsData);
}

/**
 * Collect growth areas from v3 unified workers.
 *
 * Uses v3 unified workers (ThinkingQuality, LearningBehavior, Efficiency).
 * Legacy agents (KnowledgeGap, ContextEfficiency) are also supported for cached data.
 *
 * @example
 * const areas = getAllGrowthAreasHybrid(agentOutputs, translatedAgentInsights);
 */
export function getAllGrowthAreasHybrid(
  outputs: AgentOutputs,
  translatedInsights?: TranslatedAgentInsights
): AgentGrowthArea[] {
  const allAreas: AgentGrowthArea[] = [];

  // Helper: prefer translated pipe-delimited string, fall back to original
  const addFromLegacyAgent = (
    translatedData: TranslatedAgentInsight | undefined,
    originalData: string | undefined,
  ) => {
    if (translatedData?.growthAreasData) {
      allAreas.push(...parseGrowthAreasData(translatedData.growthAreasData));
    } else if (originalData) {
      allAreas.push(...parseGrowthAreasData(originalData));
    }
  };

  // Helper: extract quote from evidence item (handles both string and structured format)
  const extractQuote = (e: string | { utteranceId: string; quote: string; context?: string }): string => {
    return typeof e === 'string' ? e : e.quote;
  };

  // v3 Unified Workers: ThinkingQuality, LearningBehavior, Efficiency
  // These workers output strengths/growthAreas directly in structured format
  if (outputs.thinkingQuality?.growthAreas) {
    allAreas.push(...outputs.thinkingQuality.growthAreas.map(ga => ({
      title: ga.title,
      description: ga.description,
      evidence: ga.evidence?.map(extractQuote) ?? [],
      recommendation: ga.recommendation,
      severity: ga.severity,
    })));
  }

  if (outputs.learningBehavior?.growthAreas) {
    allAreas.push(...outputs.learningBehavior.growthAreas.map(ga => ({
      title: ga.title,
      description: ga.description,
      evidence: ga.evidence?.map(extractQuote) ?? [],
      recommendation: ga.recommendation,
      severity: ga.severity,
    })));
  }

  if (outputs.efficiency?.growthAreas) {
    allAreas.push(...outputs.efficiency.growthAreas.map(ga => ({
      title: ga.title,
      description: ga.description,
      evidence: ga.evidence?.map(extractQuote) ?? [],
      recommendation: ga.recommendation,
      severity: ga.severity,
    })));
  }

  // Legacy agents (kept for cached data compatibility)
  addFromLegacyAgent(translatedInsights?.knowledgeGap, outputs.knowledgeGap?.growthAreasData);
  addFromLegacyAgent(translatedInsights?.contextEfficiency, outputs.contextEfficiency?.growthAreasData);
  addFromLegacyAgent(
    translatedInsights?.temporalAnalysis,
    outputs.temporalAnalysis?.insights?.growthAreasData
  );

  return groupSimilarGrowthAreas(allAreas);
}

// ============================================================================
// Phase 1 Output (re-exported for convenience)
// ============================================================================

import {
  Phase1OutputSchema,
  type Phase1Output,
} from './phase1-output';

export {
  Phase1OutputSchema,
  type Phase1Output,
};

// ============================================================================
// v3 Architecture Workers (Capability-based unified workers)
// ============================================================================

import {
  ThinkingQualityOutputSchema,
  type ThinkingQualityOutput,
  ThinkingQualityLLMOutputSchema,
  type ThinkingQualityLLMOutput,
} from './thinking-quality-data';

import {
  LearningBehaviorOutputSchema,
  type LearningBehaviorOutput,
  LearningBehaviorLLMOutputSchema,
  type LearningBehaviorLLMOutput,
} from './learning-behavior-data';

import {
  CommunicationPatternsOutputSchema,
  type CommunicationPatternsOutput,
  CommunicationPatternsLLMOutputSchema,
  type CommunicationPatternsLLMOutput,
} from './communication-patterns-data';

import {
  SessionOutcomeOutputSchema,
  type SessionOutcomeOutput,
  SessionOutcomeLLMOutputSchema,
  type SessionOutcomeLLMOutput,
} from './session-outcome-data';

// Re-export v3 unified workers
export {
  ThinkingQualityOutputSchema,
  type ThinkingQualityOutput,
  ThinkingQualityLLMOutputSchema,
  type ThinkingQualityLLMOutput,
  CommunicationPatternsOutputSchema,
  type CommunicationPatternsOutput,
  CommunicationPatternsLLMOutputSchema,
  type CommunicationPatternsLLMOutput,
  LearningBehaviorOutputSchema,
  type LearningBehaviorOutput,
  LearningBehaviorLLMOutputSchema,
  type LearningBehaviorLLMOutput,
  SessionOutcomeOutputSchema,
  type SessionOutcomeOutput,
  SessionOutcomeLLMOutputSchema,
  type SessionOutcomeLLMOutput,
};


// ============================================================================
// Worker Insights Aggregation (NEW - replaces StrengthGrowthSynthesizer)
// ============================================================================

// Re-export worker insights types for consumers
export {
  type WorkerStrength,
  type WorkerGrowth,
  type AggregatedWorkerInsights,
  WORKER_DOMAIN_CONFIGS,
  parseWorkerStrengthsData,
  parseWorkerGrowthAreasData,
};

/**
 * Aggregate strengths/growthAreas from all Phase 2 Workers into a unified structure.
 *
 * Uses v3 unified workers (ThinkingQuality, LearningBehavior, Efficiency).
 *
 * @param outputs - AgentOutputs from all Phase 2 workers
 * @returns AggregatedWorkerInsights with per-domain strengths/growthAreas
 */
export function aggregateWorkerInsights(outputs: AgentOutputs): AggregatedWorkerInsights {
  const result: AggregatedWorkerInsights = {};

  // =========================================================================
  // v3 Unified Workers
  // =========================================================================

  // ThinkingQuality domain
  if (outputs.thinkingQuality) {
    const tq = outputs.thinkingQuality;
    const strengths = tq.strengths ?? [];
    const growthAreas = tq.growthAreas ?? [];

    if (strengths.length > 0 || growthAreas.length > 0) {
      result.thinkingQuality = {
        strengths,
        growthAreas,
        domainScore: tq.overallThinkingQualityScore,
        referencedInsights: tq.referencedInsights,
      };
    }
  }

  // CommunicationPatterns domain
  if (outputs.communicationPatterns) {
    const cp = outputs.communicationPatterns;
    const strengths = cp.strengths ?? [];
    const growthAreas = cp.growthAreas ?? [];

    if (strengths.length > 0 || growthAreas.length > 0) {
      result.communicationPatterns = {
        strengths,
        growthAreas,
        domainScore: cp.overallCommunicationScore,
        referencedInsights: cp.referencedInsights,
      };
    }
  }

  // LearningBehavior domain
  if (outputs.learningBehavior) {
    const lb = outputs.learningBehavior;
    const strengths = lb.strengths ?? [];
    const growthAreas = lb.growthAreas ?? [];

    if (strengths.length > 0 || growthAreas.length > 0) {
      result.learningBehavior = {
        strengths,
        growthAreas,
        domainScore: lb.overallLearningScore,
        referencedInsights: lb.referencedInsights,
      };
    }
  }

  // Efficiency domain (from ContextEfficiency v3 output)
  if (outputs.efficiency) {
    const ef = outputs.efficiency;
    const strengths = ef.strengths ?? parseWorkerStrengthsData(ef.strengthsData);
    const growthAreas = ef.growthAreas ?? parseWorkerGrowthAreasData(ef.growthAreasData);

    if (strengths.length > 0 || growthAreas.length > 0) {
      result.contextEfficiency = {
        strengths,
        growthAreas,
        domainScore: ef.overallEfficiencyScore,
        referencedInsights: ef.referencedInsights,
      };
    }
  }

  // SessionOutcome domain (NEW - inspired by Claude /insights)
  if (outputs.sessionOutcome) {
    const so = outputs.sessionOutcome;
    const strengths = so.strengths ?? [];
    const growthAreas = so.growthAreas ?? [];

    if (strengths.length > 0 || growthAreas.length > 0) {
      result.sessionOutcome = {
        strengths,
        growthAreas,
        domainScore: so.overallOutcomeScore,
        referencedInsights: so.referencedInsights,
      };
    }
  }

  // =========================================================================
  // Legacy workers (kept for cached data compatibility)
  // =========================================================================

  // KnowledgeGap domain (legacy, only if learningBehavior not present)
  if (outputs.knowledgeGap && !outputs.learningBehavior) {
    const kg = outputs.knowledgeGap;
    const strengths = kg.strengths ?? parseWorkerStrengthsData(kg.strengthsData);
    const growthAreas = kg.growthAreas ?? parseWorkerGrowthAreasData(kg.growthAreasData);

    if (strengths.length > 0 || growthAreas.length > 0) {
      result.knowledgeGap = {
        strengths,
        growthAreas,
        domainScore: kg.overallKnowledgeScore,
        referencedInsights: kg.referencedInsights,
      };
    }
  }

  // ContextEfficiency domain (legacy, only if efficiency not present)
  if (outputs.contextEfficiency && !outputs.efficiency) {
    const ce = outputs.contextEfficiency;
    const strengths = ce.strengths ?? parseWorkerStrengthsData(ce.strengthsData);
    const growthAreas = ce.growthAreas ?? parseWorkerGrowthAreasData(ce.growthAreasData);

    if (strengths.length > 0 || growthAreas.length > 0) {
      result.contextEfficiency = {
        strengths,
        growthAreas,
        domainScore: ce.overallEfficiencyScore,
        referencedInsights: ce.referencedInsights,
      };
    }
  }

  return result;
}
