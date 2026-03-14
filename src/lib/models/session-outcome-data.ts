/**
 * Session Outcome Data Schema - Phase 2 Worker Output
 *
 * SessionOutcomeWorker analyzes:
 * - Goal Categories: What was the user trying to achieve?
 * - Session Types: How was the session structured?
 * - Outcomes: Did they achieve their goals?
 * - Friction: What obstacles did they encounter?
 *
 * This worker answers: "How successful are this user's AI sessions?
 * What do they work on, and where do they get stuck?"
 *
 * Inspired by Claude Code's /insights feature which tracks:
 * - Goal categories (14 types)
 * - Satisfaction levels
 * - Friction types (12 categories)
 * - Outcome categories
 * - Session types
 *
 * @module models/session-outcome-data
 */

import { z } from 'zod';
import {
  WorkerStrengthSchema,
  WorkerGrowthSchema,
  StructuredStrengthLLMSchema,
  StructuredGrowthLLMSchema,
  parseStructuredStrengths,
  parseStructuredGrowthAreas,
  ReferencedInsightSchema,
  type ReferencedInsight,
} from './worker-insights';

// ============================================================================
// Goal Categories (14 types - inspired by Claude /insights)
// ============================================================================

/**
 * Goal categories representing what users are trying to achieve.
 *
 * These categories help identify:
 * - Work patterns and preferences
 * - Success rates by goal type
 * - Areas where the user excels or struggles
 */
export const GoalCategoryEnum = z.enum([
  'debug_investigate',       // Debugging, investigating issues, root cause analysis
  'implement_feature',       // Building new features, adding functionality
  'fix_bug',                 // Fixing known bugs, resolving issues
  'refactor',                // Code restructuring, improving code quality
  'write_tests',             // Writing unit tests, integration tests
  'setup_config',            // Environment setup, configuration, tooling
  'documentation',           // Writing docs, comments, README updates
  'review_feedback',         // Reviewing work or getting feedback
  'exploration',             // Learning, exploring new concepts/APIs
  'quick_question',          // Simple Q&A, quick clarifications
  'deploy_infra',            // Deployment, infrastructure, CI/CD
  'dependency_management',   // Package updates, dependency resolution
  'performance_optimization', // Performance tuning, optimization
  'security_audit',          // Security checks, vulnerability fixes
]);
export type GoalCategory = z.infer<typeof GoalCategoryEnum>;

// ============================================================================
// Session Types (5 types)
// ============================================================================

/**
 * Session type classification based on structure and flow.
 *
 * Helps understand how developers interact with AI:
 * - Focused single tasks vs multi-tasking
 * - Iterative refinement patterns
 * - Exploration vs execution modes
 */
export const SessionTypeEnum = z.enum([
  'single_task',            // Focused on one goal, clear start-to-finish
  'multi_task',             // Multiple goals (related or unrelated)
  'iterative_refinement',   // Progressive improvement, back-and-forth
  'exploration',            // Discovery, learning, open-ended
  'quick_question',         // Brief Q&A, single exchange
]);
export type SessionType = z.infer<typeof SessionTypeEnum>;

// ============================================================================
// Friction Types (12 types)
// ============================================================================

/**
 * Friction types representing obstacles in AI collaboration.
 *
 * These help identify:
 * - Common failure patterns
 * - Areas for improvement
 * - Training opportunities
 */
export const FrictionTypeEnum = z.enum([
  'misunderstood_request',   // AI misinterpreted the developer's intent
  'wrong_approach',          // AI chose incorrect solution approach
  'buggy_code_generated',    // Generated code had bugs/errors
  'user_rejection',          // Developer rejected AI's suggestions
  'blocked_state',           // Session got stuck, no progress made
  'tool_failure',            // Tool execution failed (file ops, bash, etc.)
  'context_overflow',        // Context window exceeded, degraded responses
  'hallucination',           // AI referenced non-existent APIs/files/methods
  'incomplete_solution',     // Solution was partial, missing pieces
  'excessive_iterations',    // Too many back-and-forth cycles (10+)
  'permission_error',        // Access/permission issues blocked progress
  'environment_mismatch',    // Dev environment didn't match assumptions
]);
export type FrictionType = z.infer<typeof FrictionTypeEnum>;

// ============================================================================
// Outcome Categories
// ============================================================================

/**
 * Outcome classification for session goal achievement.
 */
export const OutcomeEnum = z.enum([
  'fully_achieved',      // Goal completely accomplished
  'mostly_achieved',     // Goal largely accomplished with minor gaps
  'partially_achieved',  // Some progress but significant gaps remain
  'not_achieved',        // Goal not accomplished
  'unclear',             // Cannot determine outcome from conversation
]);
export type Outcome = z.infer<typeof OutcomeEnum>;

// ============================================================================
// Satisfaction Levels
// ============================================================================

/**
 * Inferred satisfaction level based on developer behavior and language.
 */
export const SatisfactionEnum = z.enum([
  'frustrated',      // Clear frustration signals (repeated failures, harsh language)
  'dissatisfied',    // Mild dissatisfaction (corrections, redos)
  'neutral',         // No strong signals either way
  'satisfied',       // Positive signals (thanks, approval)
  'happy',           // Strong positive signals (enthusiasm, praise)
]);
export type Satisfaction = z.infer<typeof SatisfactionEnum>;

// ============================================================================
// Referenced Insight Schema (re-exported from worker-insights.ts)
// ============================================================================

export { ReferencedInsightSchema, type ReferencedInsight };

// ============================================================================
// Per-Session Analysis Schema
// ============================================================================

/**
 * Analysis of a single session.
 */
export const SessionAnalysisSchema = z.object({
  /** Session ID */
  sessionId: z.string(),

  /** Primary goal of this session */
  primaryGoal: GoalCategoryEnum,

  /** Secondary goals if multi-tasking (max 2) */
  secondaryGoals: z.array(GoalCategoryEnum).max(2).optional(),

  /** Session structure type */
  sessionType: SessionTypeEnum,

  /** Outcome achievement level */
  outcome: OutcomeEnum,

  /** Inferred satisfaction level */
  satisfaction: SatisfactionEnum,

  /** Friction types encountered (max 3 most significant) */
  frictionTypes: z.array(FrictionTypeEnum).max(3),

  /** Brief description of the key moment or turning point */
  keyMoment: z.string().optional(),
});
export type SessionAnalysis = z.infer<typeof SessionAnalysisSchema>;

// ============================================================================
// Goal Distribution Schema
// ============================================================================

export const GoalDistributionItemSchema = z.object({
  /** Goal category */
  goal: GoalCategoryEnum,

  /** Number of sessions with this goal */
  count: z.number().int().min(1),

  /** Success rate for this goal type (0-100) */
  successRate: z.number().min(0).max(100),
});
export type GoalDistributionItem = z.infer<typeof GoalDistributionItemSchema>;

// ============================================================================
// Session Type Distribution Schema
// ============================================================================

export const SessionTypeDistributionItemSchema = z.object({
  /** Session type */
  type: SessionTypeEnum,

  /** Number of sessions of this type */
  count: z.number().int().min(1),

  /** Average outcome score for this type (0-100) */
  avgOutcomeScore: z.number().min(0).max(100),
});
export type SessionTypeDistributionItem = z.infer<typeof SessionTypeDistributionItemSchema>;

// ============================================================================
// Friction Summary Schema
// ============================================================================

export const FrictionSummaryItemSchema = z.object({
  /** Friction type */
  type: FrictionTypeEnum,

  /** Number of occurrences */
  count: z.number().int().min(1),

  /** Impact level on session success */
  impactLevel: z.enum(['high', 'medium', 'low']),

  /** Common root cause for this friction */
  commonCause: z.string(),

  /** Recommendation to avoid this friction */
  recommendation: z.string(),
});
export type FrictionSummaryItem = z.infer<typeof FrictionSummaryItemSchema>;

// ============================================================================
// Success/Failure Pattern Schemas
// ============================================================================

export const SuccessPatternSchema = z.object({
  /** Description of the success pattern */
  pattern: z.string(),

  /** Goal categories where this pattern leads to success */
  associatedGoals: z.array(GoalCategoryEnum),

  /** How often this pattern appears (percentage) */
  frequency: z.number().min(0).max(100),
});
export type SuccessPattern = z.infer<typeof SuccessPatternSchema>;

export const FailurePatternSchema = z.object({
  /** Description of the failure pattern */
  pattern: z.string(),

  /** Friction types associated with this failure */
  associatedFrictions: z.array(FrictionTypeEnum),

  /** How often this pattern appears (percentage) */
  frequency: z.number().min(0).max(100),
});
export type FailurePattern = z.infer<typeof FailurePatternSchema>;

// ============================================================================
// Session Outcome Output Schema (Internal)
// ============================================================================

/**
 * Complete output from SessionOutcomeWorker.
 *
 * Provides comprehensive analysis of session success patterns,
 * goal achievement, and friction points.
 */
export const SessionOutcomeOutputSchema = z.object({
  // ─────────────────────────────────────────────────────────────────────────
  // Per-Session Analysis
  // ─────────────────────────────────────────────────────────────────────────

  /** Individual session analyses (up to 20 sessions) */
  sessionAnalyses: z.array(SessionAnalysisSchema),

  // ─────────────────────────────────────────────────────────────────────────
  // Aggregated Statistics
  // ─────────────────────────────────────────────────────────────────────────

  /** Overall success rate across all sessions (0-100) */
  overallSuccessRate: z.number().min(0).max(100),

  /** Distribution of goals with success rates */
  goalDistribution: z.array(GoalDistributionItemSchema),

  /** Distribution of session types with outcome scores */
  sessionTypeDistribution: z.array(SessionTypeDistributionItemSchema),

  /** Summary of friction types with impact and recommendations */
  frictionSummary: z.array(FrictionSummaryItemSchema),

  // ─────────────────────────────────────────────────────────────────────────
  // Pattern Analysis
  // ─────────────────────────────────────────────────────────────────────────

  /** Patterns that lead to success (max 5) */
  successPatterns: z.array(SuccessPatternSchema),

  /** Patterns that lead to failure (max 5) */
  failurePatterns: z.array(FailurePatternSchema),

  // ─────────────────────────────────────────────────────────────────────────
  // Overall Scores
  // ─────────────────────────────────────────────────────────────────────────

  /** Overall outcome score (0-100) */
  overallOutcomeScore: z.number().min(0).max(100),

  /** Confidence in this analysis (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Brief summary of session outcomes */
  summary: z.string().optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Domain-specific Strengths & Growth Areas
  // ─────────────────────────────────────────────────────────────────────────

  /** Strengths identified in session outcomes (1-6 items) */
  strengths: z.array(WorkerStrengthSchema).optional(),

  /** Growth areas identified in session outcomes (1-6 items) */
  growthAreas: z.array(WorkerGrowthSchema).optional(),

  /** Referenced insights from Knowledge Base */
  referencedInsights: z.array(ReferencedInsightSchema).optional(),
});
export type SessionOutcomeOutput = z.infer<typeof SessionOutcomeOutputSchema>;

// ============================================================================
// LLM Output Schema (Structured Arrays - Gemini Nesting Safe)
// ============================================================================

/**
 * LLM output schema for per-session analysis (nesting depth: 2)
 * root{} → sessionAnalyses[] → SessionAnalysisLLM{}
 */
export const SessionAnalysisLLMSchema = z.object({
  sessionId: z.string(),
  primaryGoal: GoalCategoryEnum,
  secondaryGoals: z.array(GoalCategoryEnum).max(2).optional(),
  sessionType: SessionTypeEnum,
  outcome: OutcomeEnum,
  satisfaction: SatisfactionEnum,
  frictionTypes: z.array(FrictionTypeEnum).max(3),
  keyMoment: z.string().optional(),
});
export type SessionAnalysisLLM = z.infer<typeof SessionAnalysisLLMSchema>;

/**
 * LLM output schema for goal distribution (nesting depth: 2)
 */
export const GoalDistributionLLMSchema = z.object({
  goal: GoalCategoryEnum,
  count: z.number().int().min(1),
  successRate: z.number().min(0).max(100),
});
export type GoalDistributionLLM = z.infer<typeof GoalDistributionLLMSchema>;

/**
 * LLM output schema for session type distribution (nesting depth: 2)
 */
export const SessionTypeDistributionLLMSchema = z.object({
  type: SessionTypeEnum,
  count: z.number().int().min(1),
  avgOutcomeScore: z.number().min(0).max(100),
});
export type SessionTypeDistributionLLM = z.infer<typeof SessionTypeDistributionLLMSchema>;

/**
 * LLM output schema for friction summary (nesting depth: 2)
 */
export const FrictionSummaryLLMSchema = z.object({
  type: FrictionTypeEnum,
  count: z.number().int().min(1),
  impactLevel: z.enum(['high', 'medium', 'low']),
  commonCause: z.string(),
  recommendation: z.string(),
});
export type FrictionSummaryLLM = z.infer<typeof FrictionSummaryLLMSchema>;

/**
 * LLM output schema for success pattern (nesting depth: 2)
 */
export const SuccessPatternLLMSchema = z.object({
  pattern: z.string(),
  associatedGoals: z.array(GoalCategoryEnum),
  frequency: z.number().min(0).max(100),
});
export type SuccessPatternLLM = z.infer<typeof SuccessPatternLLMSchema>;

/**
 * LLM output schema for failure pattern (nesting depth: 2)
 */
export const FailurePatternLLMSchema = z.object({
  pattern: z.string(),
  associatedFrictions: z.array(FrictionTypeEnum),
  frequency: z.number().min(0).max(100),
});
export type FailurePatternLLM = z.infer<typeof FailurePatternLLMSchema>;

/**
 * Main LLM output schema for SessionOutcomeWorker.
 *
 * Nesting depth analysis:
 * - sessionAnalyses[]: root → array → object = 2 levels (safe)
 * - goalDistribution[]: root → array → object = 2 levels (safe)
 * - frictionSummary[]: root → array → object = 2 levels (safe)
 * - successPatterns[].associatedGoals[]: root → array → object → array = 2 levels (arrays don't count)
 */
export const SessionOutcomeLLMOutputSchema = z.object({
  // ─────────────────────────────────────────────────────────────────────────
  // Per-Session Analysis
  // ─────────────────────────────────────────────────────────────────────────

  /** Individual session analyses (5-20 sessions) */
  sessionAnalyses: z.array(SessionAnalysisLLMSchema).min(1).max(20),

  // ─────────────────────────────────────────────────────────────────────────
  // Aggregated Statistics
  // ─────────────────────────────────────────────────────────────────────────

  /** Overall success rate (0-100) */
  overallSuccessRate: z.number().min(0).max(100),

  /** Goal distribution with success rates */
  goalDistribution: z.array(GoalDistributionLLMSchema),

  /** Session type distribution with outcome scores */
  sessionTypeDistribution: z.array(SessionTypeDistributionLLMSchema),

  /** Friction summary with impact and recommendations */
  frictionSummary: z.array(FrictionSummaryLLMSchema),

  // ─────────────────────────────────────────────────────────────────────────
  // Pattern Analysis
  // ─────────────────────────────────────────────────────────────────────────

  /** Success patterns (max 5) */
  successPatterns: z.array(SuccessPatternLLMSchema).max(5),

  /** Failure patterns (max 5) */
  failurePatterns: z.array(FailurePatternLLMSchema).max(5),

  // ─────────────────────────────────────────────────────────────────────────
  // Overall Scores
  // ─────────────────────────────────────────────────────────────────────────

  /** Overall outcome score (0-100) */
  overallOutcomeScore: z.number().min(0).max(100),

  /** Confidence score (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Summary */
  summary: z.string().optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Strengths & Growth Areas (STRUCTURED OUTPUT)
  // ─────────────────────────────────────────────────────────────────────────

  /** Strengths in session outcome domain (1-6 items) */
  strengths: z.array(StructuredStrengthLLMSchema).min(1).max(6).optional(),

  /** Growth areas in session outcome domain (1-6 items) */
  growthAreas: z.array(StructuredGrowthLLMSchema).min(1).max(6),
});
export type SessionOutcomeLLMOutput = z.infer<typeof SessionOutcomeLLMOutputSchema>;

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Convert LLM output to structured SessionOutcomeOutput.
 */
export function parseSessionOutcomeLLMOutput(
  llmOutput: SessionOutcomeLLMOutput
): SessionOutcomeOutput {
  return {
    // Per-session analysis
    sessionAnalyses: llmOutput.sessionAnalyses || [],

    // Aggregated statistics
    overallSuccessRate: llmOutput.overallSuccessRate,
    goalDistribution: llmOutput.goalDistribution || [],
    sessionTypeDistribution: llmOutput.sessionTypeDistribution || [],
    frictionSummary: llmOutput.frictionSummary || [],

    // Pattern analysis
    successPatterns: llmOutput.successPatterns || [],
    failurePatterns: llmOutput.failurePatterns || [],

    // Overall scores
    overallOutcomeScore: llmOutput.overallOutcomeScore,
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
 * Create empty SessionOutcome output
 */
export function createEmptySessionOutcomeOutput(): SessionOutcomeOutput {
  return {
    sessionAnalyses: [],
    overallSuccessRate: 50,
    goalDistribution: [],
    sessionTypeDistribution: [],
    frictionSummary: [],
    successPatterns: [],
    failurePatterns: [],
    overallOutcomeScore: 50,
    confidenceScore: 0,
    summary: 'Insufficient data for session outcome analysis.',
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert outcome enum to numeric score (0-100)
 */
export function outcomeToScore(outcome: Outcome): number {
  const scoreMap: Record<Outcome, number> = {
    fully_achieved: 100,
    mostly_achieved: 75,
    partially_achieved: 50,
    not_achieved: 25,
    unclear: 50,
  };
  return scoreMap[outcome];
}

/**
 * Convert satisfaction enum to numeric score (0-100)
 */
export function satisfactionToScore(satisfaction: Satisfaction): number {
  const scoreMap: Record<Satisfaction, number> = {
    frustrated: 0,
    dissatisfied: 25,
    neutral: 50,
    satisfied: 75,
    happy: 100,
  };
  return scoreMap[satisfaction];
}

/**
 * Get display name for goal category
 */
export function getGoalDisplayName(goal: GoalCategory): string {
  const displayNames: Record<GoalCategory, string> = {
    debug_investigate: 'Diagnose & Investigate',
    implement_feature: 'Build Something New',
    fix_bug: 'Fix an Issue',
    refactor: 'Improve & Restructure',
    write_tests: 'Verify & Test',
    setup_config: 'Setup & Configure',
    documentation: 'Document & Explain',
    review_feedback: 'Review AI Output',
    exploration: 'Explore & Learn',
    quick_question: 'Quick Question',
    deploy_infra: 'Deploy & Infrastructure',
    dependency_management: 'Manage Dependencies',
    performance_optimization: 'Optimize Performance',
    security_audit: 'Security Review',
  };
  return displayNames[goal];
}

/**
 * Get display name for friction type
 */
export function getFrictionDisplayName(friction: FrictionType): string {
  const displayNames: Record<FrictionType, string> = {
    misunderstood_request: 'Misunderstood Request',
    wrong_approach: 'Wrong Approach',
    buggy_code_generated: 'Flawed Output',
    user_rejection: 'Output Rejected',
    blocked_state: 'Blocked State',
    tool_failure: 'Tool Failure',
    context_overflow: 'Context Overflow',
    hallucination: 'AI Hallucination',
    incomplete_solution: 'Incomplete Output',
    excessive_iterations: 'Excessive Iterations',
    permission_error: 'Permission Error',
    environment_mismatch: 'Environment Mismatch',
  };
  return displayNames[friction];
}
