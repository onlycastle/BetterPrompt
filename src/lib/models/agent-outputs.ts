/**
 * Agent Outputs - Zod schemas for Phase 2 worker outputs
 *
 * Current workers (v2 architecture):
 * - StrengthGrowth: Strengths and growth areas with evidence
 * - TrustVerification: Anti-patterns and verification behavior
 * - WorkflowHabit: Planning habits and critical thinking
 * - KnowledgeGap: Knowledge gaps and learning resources
 * - ContextEfficiency: Token efficiency patterns
 *
 * Legacy agent schemas (PatternDetective, AntiPatternSpotter, Metacognition,
 * TemporalAnalysis, Multitasking) are kept for backward compatibility with
 * cached data in the database (30-day retention).
 *
 * Schemas use flattened semicolon-separated strings to comply with
 * Gemini's 4-level nesting limit.
 *
 * @module models/agent-outputs
 */

import { z } from 'zod';
import {
  WorkerStrengthSchema,
  type WorkerStrength,
  WorkerGrowthSchema,
  type WorkerGrowth,
  parseWorkerStrengthsData,
  parseWorkerGrowthAreasData,
  type AggregatedWorkerInsights,
  WORKER_DOMAIN_CONFIGS,
} from './worker-insights';

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

// Import and re-export PatternDetective schema from dedicated file
import {
  PatternDetectiveOutputSchema,
  type PatternDetectiveOutput,
} from './pattern-detective-data';
export { PatternDetectiveOutputSchema, type PatternDetectiveOutput };

// Import and re-export AntiPatternSpotter and CrossSession schemas from dedicated file
import {
  AntiPatternSpotterOutputSchema,
  type AntiPatternSpotterOutput,
  ANTI_PATTERN_HIERARCHY,
  type AntiPatternSeverity,
  type CriticalAntiPattern,
  type WarningAntiPattern,
  type InfoAntiPattern,
  type AntiPatternType,
  CrossSessionAntiPatternOutputSchema,
  type CrossSessionAntiPatternOutput,
  type ParsedCrossSessionPattern,
  parseCrossSessionPatternsData,
  getAllCrossSessionPatterns,
  getAntiPatternSeverity,
  type ParsedIsolatedIncident,
  parseIsolatedIncidentsData,
} from './antipattern-spotter-data';
export {
  AntiPatternSpotterOutputSchema,
  type AntiPatternSpotterOutput,
  ANTI_PATTERN_HIERARCHY,
  type AntiPatternSeverity,
  type CriticalAntiPattern,
  type WarningAntiPattern,
  type InfoAntiPattern,
  type AntiPatternType,
  CrossSessionAntiPatternOutputSchema,
  type CrossSessionAntiPatternOutput,
  type ParsedCrossSessionPattern,
  parseCrossSessionPatternsData,
  getAllCrossSessionPatterns,
  getAntiPatternSeverity,
  type ParsedIsolatedIncident,
  parseIsolatedIncidentsData,
};

// ============================================================================
// Knowledge Gap Analyzer: Knowledge Gaps + Learning Suggestions
// ============================================================================

/**
 * Knowledge Gap Analyzer Output Schema
 *
 * Detects:
 * - Knowledge gaps from repeated questions
 * - Learning progress tracking
 * - Resource recommendations
 *
 * @example
 * ```json
 * {
 *   "knowledgeGapsData": "async/await:7:shallow:Promise chaining not understood;TypeScript generics:4:moderate:constraint syntax unclear",
 *   "learningProgressData": "React hooks:shallow:moderate:useEffect cleanup questions decreased;CSS Grid:novice:intermediate:fewer layout questions",
 *   "recommendedResourcesData": "TypeScript generics:docs:typescriptlang.org;async/await:tutorial:javascript.info",
 *   "topInsights": [
 *     "async/await questions appeared 7 times - fundamental concept learning needed",
 *     "React hooks understanding: shallow -> moderate (progress over 5 sessions)",
 *     "Recommended: TypeScript generics official documentation"
 *   ],
 *   "overallKnowledgeScore": 68,
 *   "confidenceScore": 0.82
 * }
 * ```
 */
export const KnowledgeGapOutputSchema = z.object({
  // Knowledge gaps - "topic:question_count:depth:example;..."
  knowledgeGapsData: z.string(),

  // Learning progress - "topic:start_level:current_level:evidence;..."
  learningProgressData: z.string(),

  // Recommended resources - "topic:resource_type:url_or_name;..."
  recommendedResourcesData: z.string(),

  // Top 3 Wow Insights
  topInsights: z.array(z.string()).max(3),

  // KPT (Keep/Problem/Try) structured fields for balanced feedback
  kptKeep: z.array(z.string()).max(2).optional(),     // Knowledge strengths (0-1)
  kptProblem: z.array(z.string()).max(2).optional(),  // Knowledge gaps to address (1-2, expected)
  kptTry: z.array(z.string()).max(2).optional(),      // Learning recommendations (1-2, expected)

  // Overall knowledge score (0-100)
  overallKnowledgeScore: z.number().min(0).max(100),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),

  // ─────────────────────────────────────────────────────────────────────────
  // Domain-specific Strengths & Growth Areas (replaces StrengthGrowthSynthesizer)
  // ─────────────────────────────────────────────────────────────────────────

  // Strengths: "title|description|quote1,quote2,quote3|frequency;..." (1-6 items)
  strengthsData: z.string().optional(),

  // Growth areas: "title|description|quote1,quote2|recommendation|severity|frequency;..." (1-6 items)
  growthAreasData: z.string().optional(),

  // Parsed structured strengths (populated by parsing function)
  strengths: z.array(WorkerStrengthSchema).optional(),

  // Parsed structured growth areas (populated by parsing function)
  growthAreas: z.array(WorkerGrowthSchema).optional(),
});

export type KnowledgeGapOutput = z.infer<typeof KnowledgeGapOutputSchema>;

// ============================================================================
// Knowledge Gap LLM Output Schema (Flattened for Gemini API)
// ============================================================================

/**
 * Flattened schema for Gemini API (avoids nesting depth limit).
 *
 * Excludes `strengths` and `growthAreas` arrays which contain deeply nested
 * EvidenceItemSchema. These are populated after parsing from the string fields.
 */
export const KnowledgeGapLLMOutputSchema = z.object({
  // Knowledge gaps - "topic:question_count:depth:example;..."
  knowledgeGapsData: z.string(),

  // Learning progress - "topic:start_level:current_level:evidence;..."
  learningProgressData: z.string(),

  // Recommended resources - "topic:resource_type:url_or_name;..."
  recommendedResourcesData: z.string(),

  // Top 3 Wow Insights
  topInsights: z.array(z.string()).max(3),

  // KPT (Keep/Problem/Try) structured fields for balanced feedback
  kptKeep: z.array(z.string()).max(2).optional(),
  kptProblem: z.array(z.string()).max(2).optional(),
  kptTry: z.array(z.string()).max(2).optional(),

  // Overall knowledge score (0-100)
  overallKnowledgeScore: z.number().min(0).max(100),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),

  // Strengths: "title|description|quote1,quote2,quote3|frequency;..." (1-6 items)
  strengthsData: z.string().max(12000).optional()
    .describe('Strengths: "title|description|quote1,quote2,quote3|frequency;..." (1-6 items)'),

  // Growth areas: "title|description|quote1,quote2|recommendation|severity|frequency;..." (1-6 items)
  growthAreasData: z.string().max(12000).optional()
    .describe('Growth areas: "title|description|quote1,quote2|recommendation|severity|frequency;..." (1-6 items)'),
});
export type KnowledgeGapLLMOutput = z.infer<typeof KnowledgeGapLLMOutputSchema>;

/**
 * Convert LLM output to structured KnowledgeGapOutput
 */
export function parseKnowledgeGapLLMOutput(llmOutput: KnowledgeGapLLMOutput): KnowledgeGapOutput {
  return {
    knowledgeGapsData: llmOutput.knowledgeGapsData,
    learningProgressData: llmOutput.learningProgressData,
    recommendedResourcesData: llmOutput.recommendedResourcesData,
    topInsights: llmOutput.topInsights,
    kptKeep: llmOutput.kptKeep,
    kptProblem: llmOutput.kptProblem,
    kptTry: llmOutput.kptTry,
    overallKnowledgeScore: llmOutput.overallKnowledgeScore,
    confidenceScore: llmOutput.confidenceScore,
    strengthsData: llmOutput.strengthsData,
    growthAreasData: llmOutput.growthAreasData,
    strengths: parseWorkerStrengthsData(llmOutput.strengthsData),
    growthAreas: parseWorkerGrowthAreasData(llmOutput.growthAreasData),
  };
}

// ============================================================================
// Context Efficiency Analyzer: Token Inefficiency Patterns
// ============================================================================

/**
 * Context Efficiency Analyzer Output Schema
 *
 * Detects:
 * - Context usage patterns (fill %)
 * - Inefficiency patterns (late compact, etc.)
 * - Prompt length trends
 * - Redundant information patterns
 *
 * @example
 * ```json
 * {
 *   "contextUsagePatternData": "session1:85:92;session2:78:88;session3:91:95",
 *   "inefficiencyPatternsData": "late_compact:15:high:always compacts at 90%+;context_bloat:8:medium:never uses /clear",
 *   "promptLengthTrendData": "early:150;mid:280;late:450",
 *   "redundantInfoData": "project_structure:5;tech_stack:3;file_paths:7",
 *   "topInsights": [
 *     "Average 85% context fill before compact - consider earlier compaction",
 *     "Prompt length increases 2.3x in late session",
 *     "Project structure explained 5 times - set in context once"
 *   ],
 *   "overallEfficiencyScore": 65,
 *   "avgContextFillPercent": 84,
 *   "confidenceScore": 0.79
 * }
 * ```
 */
export const ContextEfficiencyOutputSchema = z.object({
  // Context usage pattern - "session_id:avg_fill_percent:compact_trigger_percent;..."
  contextUsagePatternData: z.string(),

  // Inefficiency patterns - "pattern:frequency:impact:example;..."
  inefficiencyPatternsData: z.string(),

  // Prompt length trend - "session_part:avg_length;..."
  promptLengthTrendData: z.string(),

  // Redundant info patterns - "info_type:repeat_count;..."
  redundantInfoData: z.string(),

  // Top 3 Wow Insights
  topInsights: z.array(z.string()).max(3),

  // KPT (Keep/Problem/Try) structured fields for balanced feedback
  kptKeep: z.array(z.string()).max(2).optional(),     // Efficient habits (0-1)
  kptProblem: z.array(z.string()).max(2).optional(),  // Inefficiencies to address (1-2, expected)
  kptTry: z.array(z.string()).max(2).optional(),      // Efficiency improvements (1-2, expected)

  // Overall efficiency score (0-100)
  overallEfficiencyScore: z.number().min(0).max(100),

  // Average context fill percent (0-100)
  avgContextFillPercent: z.number().min(0).max(100),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),

  // ─────────────────────────────────────────────────────────────────────────
  // Domain-specific Strengths & Growth Areas (replaces StrengthGrowthSynthesizer)
  // ─────────────────────────────────────────────────────────────────────────

  // Strengths: "title|description|quote1,quote2,quote3|frequency;..." (1-6 items)
  strengthsData: z.string().optional(),

  // Growth areas: "title|description|quote1,quote2|recommendation|severity|frequency;..." (1-6 items)
  growthAreasData: z.string().optional(),

  // Parsed structured strengths (populated by parsing function)
  strengths: z.array(WorkerStrengthSchema).optional(),

  // Parsed structured growth areas (populated by parsing function)
  growthAreas: z.array(WorkerGrowthSchema).optional(),

  // Productivity metrics (consolidated from ProductivityAnalyst)
  // Iteration data: "sessionId|iterationCount|avgTurnsPerIteration;..."
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
// Context Efficiency LLM Output Schema (Flattened for Gemini API)
// ============================================================================

/**
 * Flattened schema for Gemini API (avoids nesting depth limit).
 *
 * Excludes `strengths` and `growthAreas` arrays which contain deeply nested
 * EvidenceItemSchema. These are populated after parsing from the string fields.
 */
export const ContextEfficiencyLLMOutputSchema = z.object({
  // Context usage pattern - "session_id:avg_fill_percent:compact_trigger_percent;..."
  contextUsagePatternData: z.string(),

  // Inefficiency patterns - "pattern:frequency:impact:example;..."
  inefficiencyPatternsData: z.string(),

  // Prompt length trend - "session_part:avg_length;..."
  promptLengthTrendData: z.string(),

  // Redundant info patterns - "info_type:repeat_count;..."
  redundantInfoData: z.string(),

  // Top 3 Wow Insights
  topInsights: z.array(z.string()).max(3),

  // KPT (Keep/Problem/Try) structured fields for balanced feedback
  kptKeep: z.array(z.string()).max(2).optional(),
  kptProblem: z.array(z.string()).max(2).optional(),
  kptTry: z.array(z.string()).max(2).optional(),

  // Overall efficiency score (0-100)
  overallEfficiencyScore: z.number().min(0).max(100),

  // Average context fill percent (0-100)
  avgContextFillPercent: z.number().min(0).max(100),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),

  // Strengths: "title|description|quote1,quote2,quote3|frequency;..." (1-6 items)
  strengthsData: z.string().max(12000).optional()
    .describe('Strengths: "title|description|quote1,quote2,quote3|frequency;..." (1-6 items)'),

  // Growth areas: "title|description|quote1,quote2|recommendation|severity|frequency;..." (1-6 items)
  growthAreasData: z.string().max(12000).optional()
    .describe('Growth areas: "title|description|quote1,quote2|recommendation|severity|frequency;..." (1-6 items)'),

  // Productivity metrics (consolidated from ProductivityAnalyst)
  iterationSummaryData: z.string().optional(),
  collaborationEfficiencyScore: z.number().min(0).max(100).optional(),
  overallProductivityScore: z.number().min(0).max(100).optional(),
  productivitySummary: z.string().optional(),
});
export type ContextEfficiencyLLMOutput = z.infer<typeof ContextEfficiencyLLMOutputSchema>;

/**
 * Convert LLM output to structured ContextEfficiencyOutput
 */
export function parseContextEfficiencyLLMOutput(llmOutput: ContextEfficiencyLLMOutput): ContextEfficiencyOutput {
  return {
    contextUsagePatternData: llmOutput.contextUsagePatternData,
    inefficiencyPatternsData: llmOutput.inefficiencyPatternsData,
    promptLengthTrendData: llmOutput.promptLengthTrendData,
    redundantInfoData: llmOutput.redundantInfoData,
    topInsights: llmOutput.topInsights,
    kptKeep: llmOutput.kptKeep,
    kptProblem: llmOutput.kptProblem,
    kptTry: llmOutput.kptTry,
    overallEfficiencyScore: llmOutput.overallEfficiencyScore,
    avgContextFillPercent: llmOutput.avgContextFillPercent,
    confidenceScore: llmOutput.confidenceScore,
    strengthsData: llmOutput.strengthsData,
    growthAreasData: llmOutput.growthAreasData,
    strengths: parseWorkerStrengthsData(llmOutput.strengthsData),
    growthAreas: parseWorkerGrowthAreasData(llmOutput.growthAreasData),
    iterationSummaryData: llmOutput.iterationSummaryData,
    collaborationEfficiencyScore: llmOutput.collaborationEfficiencyScore,
    overallProductivityScore: llmOutput.overallProductivityScore,
    productivitySummary: llmOutput.productivitySummary,
  };
}

// ============================================================================
// Metacognition Output (NEW)
// ============================================================================

// Import from dedicated schema file
import { MetacognitionOutputSchema, type MetacognitionOutput } from './metacognition-data';
export { MetacognitionOutputSchema, type MetacognitionOutput };

// ============================================================================
// Temporal Analysis Output (REDESIGNED)
// ============================================================================

// Import from dedicated schema file
// Legacy schema kept for backward compatibility with stored data
import {
  TemporalAnalysisOutputSchema,
  type TemporalAnalysisOutput,
  TemporalAnalysisResultSchema,
  type TemporalAnalysisResult,
  TemporalInsightsOutputSchema,
  type TemporalInsightsOutput,
} from './temporal-data';
import { TemporalMetricsSchema, type TemporalMetrics } from './temporal-metrics';
export {
  // Legacy (deprecated, kept for stored data)
  TemporalAnalysisOutputSchema,
  type TemporalAnalysisOutput,
  // New (recommended)
  TemporalAnalysisResultSchema,
  type TemporalAnalysisResult,
  TemporalInsightsOutputSchema,
  type TemporalInsightsOutput,
  TemporalMetricsSchema,
  type TemporalMetrics,
};

// ============================================================================
// Multitasking Analysis Output (NEW)
// ============================================================================

// Import from dedicated schema file
import { MultitaskingAnalysisOutputSchema, type MultitaskingAnalysisOutput } from './multitasking-data';
export { MultitaskingAnalysisOutputSchema, type MultitaskingAnalysisOutput };

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
  primaryType: z.enum(['architect', 'scientist', 'collaborator', 'speedrunner', 'craftsman']),

  /** Type distribution percentages (sum to 100) */
  distribution: z.object({
    architect: z.number().min(0).max(100),
    scientist: z.number().min(0).max(100),
    collaborator: z.number().min(0).max(100),
    speedrunner: z.number().min(0).max(100),
    craftsman: z.number().min(0).max(100),
  }),

  /** AI control level */
  controlLevel: z.enum(['explorer', 'navigator', 'cartographer']),

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

  /** Reasoning for the classification */
  reasoning: z.string().optional(),

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

// ============================================================================
// Combined Agent Outputs
// ============================================================================

/**
 * Combined outputs from all Wow-Focused Agents
 *
 * Original 4 agents:
 * - Pattern Detective: Conversation patterns, repeated questions
 * - Anti-Pattern Spotter: Error loops, bad habits
 * - Knowledge Gap: Knowledge gaps + learning suggestions
 * - Context Efficiency: Token inefficiency patterns
 *
 * NEW agents (Premium+):
 * - Metacognition: Self-awareness patterns, blind spots, growth mindset
 * - Temporal Analyzer: Time-based quality patterns, fatigue signals
 *
 * All fields are optional since agents may fail independently.
 */
export const AgentOutputsSchema = z.object({
  // =========================================================================
  // Legacy Agents (kept for backward compatibility)
  // =========================================================================
  patternDetective: PatternDetectiveOutputSchema.optional(),
  antiPatternSpotter: AntiPatternSpotterOutputSchema.optional(),
  knowledgeGap: KnowledgeGapOutputSchema.optional(),
  contextEfficiency: ContextEfficiencyOutputSchema.optional(),

  // Legacy: Metacognition + Temporal Analysis agents (deprecated in v2)
  metacognition: MetacognitionOutputSchema.optional(),
  temporalAnalysis: TemporalAnalysisResultSchema.optional(),
  multitasking: MultitaskingAnalysisOutputSchema.optional(),

  // Legacy: Cross-Session Anti-Pattern Detection (deprecated in v2, kept for stored data)
  crossSessionAntiPatterns: CrossSessionAntiPatternOutputSchema.optional(),

  // =========================================================================
  // v2 Architecture Workers
  // =========================================================================
  /** Strengths & Growth Areas analysis */
  strengthGrowth: StrengthGrowthOutputSchema.optional(),

  /** Trust Verification analysis (anti-patterns + verification behavior) */
  trustVerification: TrustVerificationOutputSchema.optional(),

  /** Workflow Habit analysis (planning + critical thinking) */
  workflowHabit: WorkflowHabitOutputSchema.optional(),

  /** Type Classification (v2) - can replace TypeSynthesis */
  typeClassifier: TypeClassifierOutputSchema.optional(),
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
    // Legacy agents
    outputs.patternDetective ||
    outputs.antiPatternSpotter ||
    outputs.knowledgeGap ||
    outputs.contextEfficiency ||
    outputs.metacognition ||
    outputs.temporalAnalysis ||
    outputs.multitasking ||
    outputs.crossSessionAntiPatterns ||
    // v2 agents
    outputs.strengthGrowth ||
    outputs.trustVerification ||
    outputs.workflowHabit ||
    outputs.typeClassifier
  );
}

/**
 * Get all top insights from all agents (flattened)
 */
export function getAllTopInsights(outputs: AgentOutputs): string[] {
  const insights: string[] = [];

  if (outputs.patternDetective?.topInsights) {
    insights.push(...outputs.patternDetective.topInsights);
  }
  if (outputs.antiPatternSpotter?.topInsights) {
    insights.push(...outputs.antiPatternSpotter.topInsights);
  }
  if (outputs.knowledgeGap?.topInsights) {
    insights.push(...outputs.knowledgeGap.topInsights);
  }
  if (outputs.contextEfficiency?.topInsights) {
    insights.push(...outputs.contextEfficiency.topInsights);
  }
  // NEW: Include metacognition and temporal insights
  if (outputs.metacognition?.topInsights) {
    insights.push(...outputs.metacognition.topInsights);
  }
  // REDESIGNED: Temporal insights are now nested under insights.topInsights
  if (outputs.temporalAnalysis?.insights?.topInsights) {
    insights.push(...outputs.temporalAnalysis.insights.topInsights);
  }
  // NEW: Include multitasking insights
  if (outputs.multitasking?.topInsights) {
    insights.push(...outputs.multitasking.topInsights);
  }
  // NEW: Include cross-session anti-pattern insights
  if (outputs.crossSessionAntiPatterns?.topInsights) {
    insights.push(...outputs.crossSessionAntiPatterns.topInsights);
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
 * - Title: Use the shortest (most concise) title
 * - Description: Use the longest (most detailed) description
 * - Evidence: Merge all, deduplicate
 * - Recommendation: Use the longest (most comprehensive)
 * - Frequency: Use maximum value (most frequent observation)
 * - Severity: Use highest severity level
 * - PriorityScore: Use maximum value
 */
function mergeGrowthAreaGroup(group: AgentGrowthArea[]): AgentGrowthArea {
  if (group.length === 1) return group[0];

  // Title: shortest (most concise)
  const title = group.reduce((a, b) =>
    a.title.length <= b.title.length ? a : b
  ).title;

  // Description: longest (most detailed)
  const description = group.reduce((a, b) =>
    a.description.length >= b.description.length ? a : b
  ).description;

  // Evidence: merge all, deduplicate
  const evidence = [...new Set(group.flatMap(g => g.evidence))];

  // Recommendation: longest (most comprehensive)
  const recommendation = group.reduce((a, b) =>
    (a.recommendation?.length || 0) >= (b.recommendation?.length || 0) ? a : b
  ).recommendation;

  // Frequency: maximum value
  const frequencies = group.map(g => g.frequency).filter((f): f is number => f !== undefined);
  const frequency = frequencies.length > 0 ? Math.max(...frequencies) : undefined;

  // Severity: highest level
  const severityOrder: Record<AgentSeverityLevel, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const severities = group.map(g => g.severity).filter((s): s is AgentSeverityLevel => s !== undefined);
  const severity = severities.length > 0
    ? severities.reduce((a, b) => severityOrder[a] >= severityOrder[b] ? a : b)
    : undefined;

  // Priority Score: maximum value
  const priorities = group.map(g => g.priorityScore).filter((p): p is number => p !== undefined);
  const priorityScore = priorities.length > 0 ? Math.max(...priorities) : undefined;

  return {
    title,
    description,
    evidence,
    recommendation,
    frequency,
    severity,
    priorityScore,
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
// v2 Worker → Growth Area Conversion Helpers
// ============================================================================

/**
 * Convert StrengthGrowth worker growth areas to AgentGrowthArea format
 */
function convertStrengthGrowthAreas(
  growthAreas: NonNullable<StrengthGrowthOutput['growthAreas']>
): AgentGrowthArea[] {
  return growthAreas.map(ga => ({
    title: ga.title,
    description: ga.description,
    evidence: ga.evidence?.map(e => e.quote) ?? [],
    recommendation: ga.recommendation,
    frequency: ga.frequency,
    severity: ga.severity,
    priorityScore: ga.priorityScore,
  }));
}

/**
 * Convert TrustVerification anti-patterns to AgentGrowthArea format
 */
function convertAntiPatternsToGrowthAreas(
  antiPatterns: NonNullable<TrustVerificationOutput['antiPatterns']>
): AgentGrowthArea[] {
  return antiPatterns.map(ap => ({
    title: `Anti-Pattern: ${ap.type.replace(/_/g, ' ')}`,
    description: ap.improvement ?? `Detected ${ap.type} pattern`,
    evidence: ap.examples?.map(e => e.quote) ?? [],
    recommendation: ap.improvement ?? '',
    frequency: ap.sessionPercentage,
    severity: (
      ap.severity === 'critical' ? 'critical' :
      ap.severity === 'significant' ? 'high' :
      ap.severity === 'moderate' ? 'medium' : 'low'
    ) as AgentSeverityLevel,
    priorityScore: ap.severity === 'critical' ? 90 : ap.severity === 'significant' ? 70 : ap.severity === 'moderate' ? 50 : 30,
  }));
}

/**
 * Convert weak WorkflowHabit planning habits to AgentGrowthArea format
 */
function convertWeakHabitsToGrowthAreas(
  workflowHabit: WorkflowHabitOutput
): AgentGrowthArea[] {
  const weakHabits = workflowHabit.planningHabits?.filter(h =>
    h.effectiveness === 'low' || h.frequency === 'rarely' || h.frequency === 'never'
  ) ?? [];
  return weakHabits.map(h => ({
    title: `Planning: ${h.type.replace(/_/g, ' ')}`,
    description: `Planning habit "${h.type.replace(/_/g, ' ')}" is ${h.frequency}`,
    evidence: h.examples ?? [],
    recommendation: `Improve ${h.type.replace(/_/g, ' ')} frequency`,
    severity: 'medium' as AgentSeverityLevel,
    priorityScore: 50,
  }));
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
  | 'patternDetective'
  | 'metacognition'
  | 'antiPatternSpotter'
  | 'knowledgeGap'
  | 'contextEfficiency'
  | 'temporalAnalysis'
  | 'multitasking'
  | 'strengthGrowth'
  | 'trustVerification'
  | 'workflowHabit';

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
 * Collect growth areas from ALL agents with per-agent translation fallback.
 *
 * For each agent, prefers translated data when available, falls back to
 * original agentOutputs data when translation is missing.
 *
 * Handles both legacy agents (pipe-delimited strings from old cached data)
 * and v2 agents (structured arrays from current workers).
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

  // Free tier agents
  addFromLegacyAgent(translatedInsights?.patternDetective, outputs.patternDetective?.growthAreasData);
  addFromLegacyAgent(translatedInsights?.metacognition, outputs.metacognition?.growthAreasData);

  // Premium tier agents
  addFromLegacyAgent(translatedInsights?.antiPatternSpotter, outputs.antiPatternSpotter?.growthAreasData);
  addFromLegacyAgent(translatedInsights?.knowledgeGap, outputs.knowledgeGap?.growthAreasData);
  addFromLegacyAgent(translatedInsights?.contextEfficiency, outputs.contextEfficiency?.growthAreasData);
  addFromLegacyAgent(
    translatedInsights?.temporalAnalysis,
    outputs.temporalAnalysis?.insights?.growthAreasData
  );
  addFromLegacyAgent(translatedInsights?.multitasking, outputs.multitasking?.growthAreasData);

  // v2 strengthGrowth — translated flat string OR original structured data
  if (translatedInsights?.strengthGrowth?.growthAreasData) {
    allAreas.push(...parseGrowthAreasData(translatedInsights.strengthGrowth.growthAreasData));
  } else if (outputs.strengthGrowth?.growthAreas) {
    allAreas.push(...convertStrengthGrowthAreas(outputs.strengthGrowth.growthAreas));
  }

  // v2 trustVerification — translated flat string OR original structured data
  if (translatedInsights?.trustVerification?.growthAreasData) {
    allAreas.push(...parseGrowthAreasData(translatedInsights.trustVerification.growthAreasData));
  } else if (outputs.trustVerification?.antiPatterns) {
    allAreas.push(...convertAntiPatternsToGrowthAreas(outputs.trustVerification.antiPatterns));
  }

  // v2 workflowHabit — translated flat string OR original structured data
  if (translatedInsights?.workflowHabit?.growthAreasData) {
    allAreas.push(...parseGrowthAreasData(translatedInsights.workflowHabit.growthAreasData));
  } else if (outputs.workflowHabit) {
    allAreas.push(...convertWeakHabitsToGrowthAreas(outputs.workflowHabit));
  }

  return groupSimilarGrowthAreas(allAreas);
}

// ============================================================================
// NEW PHASE 2 WORKER OUTPUTS (v2 Architecture)
// ============================================================================

// Import new Phase 2 schemas
import {
  Phase1OutputSchema,
  type Phase1Output,
} from './phase1-output';

import {
  StrengthGrowthOutputSchema,
  type StrengthGrowthOutput,
  StrengthGrowthLLMOutputSchema,
  type StrengthGrowthLLMOutput,
} from './strength-growth-data';

import {
  BehaviorPatternOutputSchema,
  type BehaviorPatternOutput,
  BehaviorPatternLLMOutputSchema,
  type BehaviorPatternLLMOutput,
} from './behavior-pattern-data';

import {
  TrustVerificationOutputSchema,
  type TrustVerificationOutput,
  TrustVerificationLLMOutputSchema,
  type TrustVerificationLLMOutput,
} from './trust-verification-data';

import {
  WorkflowHabitOutputSchema,
  type WorkflowHabitOutput,
  WorkflowHabitLLMOutputSchema,
  type WorkflowHabitLLMOutput,
} from './workflow-habit-data';

// Re-export for convenience
export {
  Phase1OutputSchema,
  type Phase1Output,
  StrengthGrowthOutputSchema,
  type StrengthGrowthOutput,
  StrengthGrowthLLMOutputSchema,
  type StrengthGrowthLLMOutput,
  BehaviorPatternOutputSchema,
  type BehaviorPatternOutput,
  BehaviorPatternLLMOutputSchema,
  type BehaviorPatternLLMOutput,
  TrustVerificationOutputSchema,
  type TrustVerificationOutput,
  TrustVerificationLLMOutputSchema,
  type TrustVerificationLLMOutput,
  WorkflowHabitOutputSchema,
  type WorkflowHabitOutput,
  WorkflowHabitLLMOutputSchema,
  type WorkflowHabitLLMOutput,
};

// ============================================================================
// Combined New Agent Outputs Schema (v2)
// ============================================================================

/**
 * Combined outputs from the new Phase 2 workers (v2 architecture).
 *
 * Core workers:
 * - StrengthGrowth: Strengths & growth areas with evidence
 * - BehaviorPattern: Anti-patterns, planning, verification
 * - KnowledgeGap: Repeated questions, learning progress, recommendations
 * - ContextEfficiency: Context usage patterns
 * - TypeClassifier: Type classification (fun/viral element)
 */
export const NewAgentOutputsSchema = z.object({
  /** Strengths & Growth Areas analysis */
  strengthGrowth: StrengthGrowthOutputSchema.optional(),

  /** Trust Verification analysis (anti-patterns + verification behavior) */
  trustVerification: TrustVerificationOutputSchema.optional(),

  /** Workflow Habit analysis (planning + critical thinking + multitasking) */
  workflowHabit: WorkflowHabitOutputSchema.optional(),

  /** Knowledge Gap analysis (reuses existing schema) */
  knowledgeGap: KnowledgeGapOutputSchema.optional(),

  /** Context Efficiency analysis (reuses existing schema) */
  contextEfficiency: ContextEfficiencyOutputSchema.optional(),

  /** Type Classification */
  typeClassifier: TypeClassifierOutputSchema.optional(),
});
export type NewAgentOutputs = z.infer<typeof NewAgentOutputsSchema>;

/**
 * Check if any new agent produced output
 */
export function hasAnyNewAgentOutput(outputs: NewAgentOutputs): boolean {
  return !!(
    outputs.strengthGrowth ||
    outputs.trustVerification ||
    outputs.workflowHabit ||
    outputs.knowledgeGap ||
    outputs.contextEfficiency ||
    outputs.typeClassifier
  );
}

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
 * This replaces the StrengthGrowthSynthesizer by collecting domain-specific
 * insights directly from each worker. Each worker already identifies
 * strengths and growth areas within its domain during its LLM call.
 *
 * @param outputs - AgentOutputs from all Phase 2 workers
 * @returns AggregatedWorkerInsights with per-domain strengths/growthAreas
 */
export function aggregateWorkerInsights(outputs: AgentOutputs): AggregatedWorkerInsights {
  const result: AggregatedWorkerInsights = {};

  // TrustVerification domain
  if (outputs.trustVerification) {
    const tv = outputs.trustVerification;
    // Parse from string data if structured arrays not present
    const strengths = tv.strengths ?? parseWorkerStrengthsData((tv as any).strengthsData);
    const growthAreas = tv.growthAreas ?? parseWorkerGrowthAreasData((tv as any).growthAreasData);

    if (strengths.length > 0 || growthAreas.length > 0) {
      result.trustVerification = {
        strengths,
        growthAreas,
        domainScore: tv.overallTrustHealthScore,
      };
    }
  }

  // WorkflowHabit domain
  if (outputs.workflowHabit) {
    const wh = outputs.workflowHabit;
    const strengths = wh.strengths ?? parseWorkerStrengthsData((wh as any).strengthsData);
    const growthAreas = wh.growthAreas ?? parseWorkerGrowthAreasData((wh as any).growthAreasData);

    if (strengths.length > 0 || growthAreas.length > 0) {
      result.workflowHabit = {
        strengths,
        growthAreas,
        domainScore: wh.overallWorkflowScore,
      };
    }
  }

  // KnowledgeGap domain
  if (outputs.knowledgeGap) {
    const kg = outputs.knowledgeGap;
    const strengths = kg.strengths ?? parseWorkerStrengthsData(kg.strengthsData);
    const growthAreas = kg.growthAreas ?? parseWorkerGrowthAreasData(kg.growthAreasData);

    if (strengths.length > 0 || growthAreas.length > 0) {
      result.knowledgeGap = {
        strengths,
        growthAreas,
        domainScore: kg.overallKnowledgeScore,
      };
    }
  }

  // ContextEfficiency domain
  if (outputs.contextEfficiency) {
    const ce = outputs.contextEfficiency;
    const strengths = ce.strengths ?? parseWorkerStrengthsData(ce.strengthsData);
    const growthAreas = ce.growthAreas ?? parseWorkerGrowthAreasData(ce.growthAreasData);

    if (strengths.length > 0 || growthAreas.length > 0) {
      result.contextEfficiency = {
        strengths,
        growthAreas,
        domainScore: ce.overallEfficiencyScore,
      };
    }
  }

  return result;
}
