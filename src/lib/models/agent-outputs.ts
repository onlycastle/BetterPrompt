/**
 * Agent Outputs - Zod schemas for 4 Wow-Focused Agents
 *
 * Each agent discovers unconscious patterns that create "wow moments":
 * - Pattern Detective: Conversation patterns, repeated questions
 * - Anti-Pattern Spotter: Error loops, bad habits
 * - Knowledge Gap Analyzer: Knowledge gaps + learning suggestions
 * - Context Efficiency Analyzer: Token inefficiency patterns
 *
 * Schemas use flattened semicolon-separated strings to comply with
 * Gemini's 5-level nesting limit.
 *
 * @module models/agent-outputs
 */

import { z } from 'zod';

// ============================================================================
// Pattern Detective: Conversation Style Discovery
// ============================================================================

/**
 * Pattern Detective Output Schema
 *
 * Detects:
 * - Repeated questions across sessions
 * - Conversation style patterns (vague requests, etc.)
 * - Request start patterns
 *
 * @example
 * ```json
 * {
 *   "repeatedQuestionsData": "React hooks:5:useEffect cleanup;TypeScript generics:3:generic constraints",
 *   "conversationStyleData": "vague_request:23:'just do it' pattern;proactive_context:15:provides context upfront",
 *   "requestStartPatternsData": "Can you...:45;fix this:12;help me:8",
 *   "topInsights": [
 *     "TypeScript generics questions appeared 12 times across 5 sessions",
 *     "67% of requests start without specific context",
 *     "'Just do it' pattern detected 23 times"
 *   ],
 *   "overallStyleSummary": "Direct communicator who tends to skip context",
 *   "confidenceScore": 0.85
 * }
 * ```
 */
export const PatternDetectiveOutputSchema = z.object({
  // Repeated questions - "topic:count:example;..."
  repeatedQuestionsData: z.string().max(2000),

  // Conversation style patterns - "pattern:frequency:example;..."
  conversationStyleData: z.string().max(2000),

  // Request start patterns - "phrase:count;..."
  requestStartPatternsData: z.string().max(1000),

  // Top 3 Wow Insights (displayed directly in UI)
  topInsights: z.array(z.string().max(200)).max(3),

  // Overall summary
  overallStyleSummary: z.string().max(300),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),
});

export type PatternDetectiveOutput = z.infer<typeof PatternDetectiveOutputSchema>;

// ============================================================================
// Anti-Pattern Spotter: Bad Habit Detection
// ============================================================================

/**
 * Anti-Pattern Spotter Output Schema
 *
 * Detects:
 * - Error loops (same error repeated)
 * - Learning avoidance patterns
 * - Repeated mistakes
 *
 * @example
 * ```json
 * {
 *   "errorLoopsData": "TypeScript type error:8:4.2:same error in 3 sessions;ESLint warning:5:2.1:ignored warnings",
 *   "learningAvoidanceData": "copy_paste_no_read:code copied without understanding:high;skip_explanation:skips AI explanations:medium",
 *   "repeatedMistakesData": "ESLint ignore abuse:12:session1,session3,session7;missing type annotations:8:session2,session5",
 *   "topInsights": [
 *     "ESLint errors repeated 8 times with avg 4.2 turns to resolve",
 *     "34% of code was copied without understanding verification",
 *     "Same approach persisted 3+ times in 8 cases"
 *   ],
 *   "overallHealthScore": 72,
 *   "confidenceScore": 0.78
 * }
 * ```
 */
export const AntiPatternSpotterOutputSchema = z.object({
  // Error loops - "error_type:repeat_count:avg_turns:example;..."
  errorLoopsData: z.string().max(2000),

  // Learning avoidance patterns - "pattern:evidence:severity;..."
  learningAvoidanceData: z.string().max(1500),

  // Repeated mistakes - "mistake:count:sessions;..."
  repeatedMistakesData: z.string().max(1500),

  // Top 3 Wow Insights
  topInsights: z.array(z.string().max(200)).max(3),

  // Overall health score (0-100)
  overallHealthScore: z.number().min(0).max(100),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),
});

export type AntiPatternSpotterOutput = z.infer<typeof AntiPatternSpotterOutputSchema>;

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
  knowledgeGapsData: z.string().max(2000),

  // Learning progress - "topic:start_level:current_level:evidence;..."
  learningProgressData: z.string().max(1500),

  // Recommended resources - "topic:resource_type:url_or_name;..."
  recommendedResourcesData: z.string().max(1000),

  // Top 3 Wow Insights
  topInsights: z.array(z.string().max(200)).max(3),

  // Overall knowledge score (0-100)
  overallKnowledgeScore: z.number().min(0).max(100),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),
});

export type KnowledgeGapOutput = z.infer<typeof KnowledgeGapOutputSchema>;

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
  contextUsagePatternData: z.string().max(1500),

  // Inefficiency patterns - "pattern:frequency:impact:example;..."
  inefficiencyPatternsData: z.string().max(2000),

  // Prompt length trend - "session_part:avg_length;..."
  promptLengthTrendData: z.string().max(500),

  // Redundant info patterns - "info_type:repeat_count;..."
  redundantInfoData: z.string().max(1000),

  // Top 3 Wow Insights
  topInsights: z.array(z.string().max(200)).max(3),

  // Overall efficiency score (0-100)
  overallEfficiencyScore: z.number().min(0).max(100),

  // Average context fill percent (0-100)
  avgContextFillPercent: z.number().min(0).max(100),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),
});

export type ContextEfficiencyOutput = z.infer<typeof ContextEfficiencyOutputSchema>;

// ============================================================================
// Combined Agent Outputs
// ============================================================================

/**
 * Combined outputs from all 4 Wow-Focused Agents
 *
 * All fields are optional since agents may fail independently.
 */
export const AgentOutputsSchema = z.object({
  patternDetective: PatternDetectiveOutputSchema.optional(),
  antiPatternSpotter: AntiPatternSpotterOutputSchema.optional(),
  knowledgeGap: KnowledgeGapOutputSchema.optional(),
  contextEfficiency: ContextEfficiencyOutputSchema.optional(),
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
    outputs.patternDetective ||
    outputs.antiPatternSpotter ||
    outputs.knowledgeGap ||
    outputs.contextEfficiency
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

  return insights;
}
