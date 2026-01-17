/**
 * Analysis Data Schema
 *
 * Zod schemas for Stage 1 (Data Analyst) intermediate output.
 * This represents the structured data extraction that happens before
 * the final personalized narrative is generated.
 */

import { z } from 'zod';
import { CodingStyleTypeSchema, AIControlLevelSchema } from './coding-style';
import { DimensionNameEnumSchema } from './verbose-evaluation';

// ============================================================================
// Type Distribution Schema
// ============================================================================

/**
 * Type distribution as percentages (sum to 100)
 * Represents the blend of coding styles detected in the session
 */
export const TypeDistributionSchema = z.object({
  architect: z.number().min(0).max(100),
  scientist: z.number().min(0).max(100),
  collaborator: z.number().min(0).max(100),
  speedrunner: z.number().min(0).max(100),
  craftsman: z.number().min(0).max(100),
});
export type TypeDistribution = z.infer<typeof TypeDistributionSchema>;

// ============================================================================
// Extracted Quote Schema
// ============================================================================

/**
 * A single extracted quote from a session with metadata
 * Used as evidence for strengths or growth areas in specific dimensions
 */
export const ExtractedQuoteSchema = z.object({
  /** The actual quote from the developer (10-1200 chars for richer context) */
  quote: z.string().min(10).max(1200),

  /** ISO 8601 date string when this was said */
  sessionDate: z.string(),

  /** Which analysis dimension this quote is evidence for */
  dimension: DimensionNameEnumSchema,

  /** Whether this is a strength or growth opportunity signal */
  signal: z.enum(['strength', 'growth']),

  /** Specific behavior this quote demonstrates (e.g., "Iterative refinement", "Verification habit") */
  behavioralMarker: z.string().max(150),

  /** Confidence level in this quote's significance (0.0 - 1.0) */
  confidence: z.number().min(0).max(1),
});
export type ExtractedQuote = z.infer<typeof ExtractedQuoteSchema>;

// ============================================================================
// Detected Pattern Schema
// ============================================================================

/**
 * A behavioral pattern detected across multiple sessions
 * Represents recurring behaviors that define the developer's style
 */
export const DetectedPatternSchema = z.object({
  /** Unique identifier for this pattern */
  patternId: z.string(),

  /** Category of this pattern */
  patternType: z.enum([
    'communication_style',
    'problem_solving',
    'ai_interaction',
    'verification_habit',
    'tool_usage',
  ]),

  /** How many times this pattern was observed */
  frequency: z.number(),

  /** Example quotes demonstrating this pattern (target: 3-6 examples for richer evidence) */
  examples: z.array(z.string()),

  /** Why this pattern matters and its impact (max 400 chars for detailed analysis) */
  significance: z.string().max(400),
});
export type DetectedPattern = z.infer<typeof DetectedPatternSchema>;

// ============================================================================
// Actionable Pattern Match Schema
// ============================================================================

/**
 * Result of detecting a knowledge-driven actionable pattern
 * Links specific advice from research to actual developer behavior
 */
export const ActionablePatternMatchSchema = z.object({
  /** Pattern identifier from KNOWLEDGE_DRIVEN_PATTERNS */
  patternId: z.string(),

  /** Whether the developer practiced this advice */
  practiced: z.boolean(),

  /** Evidence quotes (empty array if not practiced) */
  evidence: z.array(z.string().max(300)),

  /** Feedback message (from if_found or if_missing template) */
  feedback: z.string().max(500),

  /** Source of this advice (e.g., "Anthropic", "Karpathy") */
  source: z.string(),
});
export type ActionablePatternMatch = z.infer<typeof ActionablePatternMatchSchema>;

// ============================================================================
// Anti-Pattern Detection Schema (NEW - Premium/Enterprise)
// ============================================================================

/**
 * Detected anti-pattern instance
 * Represents an inefficient AI collaboration pattern observed in sessions
 * Framed as "growth opportunity" rather than criticism
 */
export const DetectedAntiPatternSchema = z.object({
  /** Unique identifier for this anti-pattern instance */
  patternId: z.string(),

  /** Type of anti-pattern detected */
  patternType: z.enum([
    'sunk_cost_loop', // Continuing failed approach too long (same error + same prompt 3+ times)
    'emotional_escalation', // Frustration affecting prompts
    'blind_retry', // Retrying without changing approach
    'passive_acceptance', // Accepting AI output without verification
  ]),

  /** How many times this pattern was observed */
  frequency: z.number(),

  /** Evidence quotes showing this pattern (target: 1-3 examples) */
  examples: z.array(z.string().max(300)),

  /** Severity assessment */
  severity: z.enum(['mild', 'moderate', 'significant']),

  /** Context in which this anti-pattern occurred */
  triggerContext: z.string().max(200),
});
export type DetectedAntiPattern = z.infer<typeof DetectedAntiPatternSchema>;

// ============================================================================
// Critical Thinking Moment Schema (NEW - Premium/Enterprise)
// ============================================================================

/**
 * Critical thinking behavior observed in sessions
 * Represents moments when developer verified, questioned, or validated AI output
 */
export const CriticalThinkingMomentSchema = z.object({
  /** The actual moment/quote showing critical thinking */
  moment: z.string().max(500),

  /** Type of critical thinking behavior */
  type: z.enum([
    'verification_request', // "Are you sure?", "Is that correct?"
    'output_validation', // Running tests, checking results
    'assumption_questioning', // Challenging AI assumptions
    'alternative_exploration', // Asking for different approaches
    'security_check', // Checking for security/performance issues
  ]),

  /** What result this critical thinking led to */
  result: z.string().max(300),

  /** Which dimension this relates to */
  dimension: DimensionNameEnumSchema,

  /** Confidence in this being genuine critical thinking */
  confidence: z.number().min(0).max(1),
});
export type CriticalThinkingMoment = z.infer<typeof CriticalThinkingMomentSchema>;

// ============================================================================
// Planning Behavior Schema (NEW - Premium/Enterprise)
// ============================================================================

/**
 * Planning behavior observed in sessions
 * Represents strategic thinking before implementation
 */
export const PlanningBehaviorSchema = z.object({
  /** Description of the planning behavior */
  behavior: z.string().max(200),

  /** Type of planning behavior */
  behaviorType: z.enum([
    'slash_plan_usage', // /plan command usage (highest signal)
    'structure_first', // "Let's plan first", "Architecture first"
    'task_decomposition', // Breaking down complex tasks
    'stepwise_approach', // "Step by step", numbered lists
    'todowrite_usage', // Using TodoWrite tool
  ]),

  /** How consistently this behavior was observed */
  frequency: z.enum(['always', 'often', 'sometimes', 'rarely']),

  /** Example quotes demonstrating this behavior */
  examples: z.array(z.string().max(300)),

  /** Effectiveness assessment */
  effectiveness: z.enum(['high', 'medium', 'low']),

  /** Additional details for /plan usage (populated when behaviorType is 'slash_plan_usage') */
  planDetails: z
    .object({
      /** Summary of the plan content */
      planContent: z.string().max(500).optional(),

      /** Whether the plan decomposed the problem into smaller parts */
      problemDecomposition: z.boolean().optional(),

      /** Number of steps in the plan */
      stepsCount: z.number().optional(),
    })
    .optional(),
});
export type PlanningBehavior = z.infer<typeof PlanningBehaviorSchema>;

// ============================================================================
// Dimension Signal Schema (Flattened for Gemini API compatibility)
// ============================================================================

/**
 * Aggregated signals for a single analysis dimension
 * Flattened structure to avoid exceeding Gemini's max nesting depth
 *
 * Note: quoteRefs removed to reduce nesting. Quotes can be matched by dimension
 * field in extractedQuotes array.
 */
export const DimensionSignalSchema = z.object({
  /** Which dimension these signals belong to */
  dimension: DimensionNameEnumSchema,

  /** Positive signals (strengths) as simple string descriptions */
  strengthSignals: z.array(z.string().max(150)),

  /** Growth signals (opportunities) as simple string descriptions */
  growthSignals: z.array(z.string().max(150)),
});
export type DimensionSignal = z.infer<typeof DimensionSignalSchema>;

// ============================================================================
// Complete Structured Analysis Data Schema
// ============================================================================

/**
 * Complete structured analysis data from Stage 1 (Data Analyst)
 * This is the intermediate output before Stage 2 (Narrative Writer) generates the final report
 *
 * Structure:
 * 1. Type classification (coding style + control level + distribution)
 * 2. Extracted quotes with metadata (target: 15-50 quotes)
 * 3. Detected behavioral patterns (target: 3-10 patterns)
 * 4. Dimension-specific signals (exactly 6 dimensions)
 * 5. Analysis metadata (coverage, confidence)
 *
 * Note: Array size constraints (minItems/maxItems) are NOT in the schema due to Gemini API
 * limitation that allows only ONE array with size constraints per schema. Quantity targets
 * are specified in the prompt instead, and sanitizeResponse() enforces minimums.
 */
export const StructuredAnalysisDataSchema = z.object({
  /** Type classification and distribution */
  typeAnalysis: z.object({
    /** Primary coding style type */
    primaryType: CodingStyleTypeSchema,

    /** AI control level (vibe-coder | developing | ai-master) */
    controlLevel: AIControlLevelSchema,

    /** Percentage distribution across all 5 types */
    distribution: TypeDistributionSchema,

    /** Explanation of why this classification was chosen (max 800 chars) */
    reasoning: z.string().max(800),
  }),

  /** Raw quotes extracted from sessions (target: 15-50 quotes with metadata) */
  extractedQuotes: z.array(ExtractedQuoteSchema),

  /** Behavioral patterns detected across sessions (target: 3-10 patterns) */
  detectedPatterns: z.array(DetectedPatternSchema),

  /** Knowledge-driven actionable pattern matches (from expert_knowledge.actionable_patterns) */
  actionablePatternMatches: z.array(ActionablePatternMatchSchema).optional(),

  /** Detected anti-patterns with growth opportunities (Premium/Enterprise) */
  detectedAntiPatterns: z.array(DetectedAntiPatternSchema).optional(),

  /** Critical thinking moments observed (Premium/Enterprise) */
  criticalThinkingMoments: z.array(CriticalThinkingMomentSchema).optional(),

  /** Planning behaviors observed (Premium/Enterprise) */
  planningBehaviors: z.array(PlanningBehaviorSchema).optional(),

  /** Dimension-specific signals (must have exactly 6, one per dimension) */
  dimensionSignals: z.array(DimensionSignalSchema).length(6),

  /** Metadata about the analysis quality */
  analysisMetadata: z.object({
    /** Total number of quotes analyzed */
    totalQuotesAnalyzed: z.number(),

    /** Coverage scores per dimension (flattened from z.record for Gemini compatibility) */
    coverageScores: z.array(
      z.object({
        dimension: DimensionNameEnumSchema,
        score: z.number().min(0).max(1),
      })
    ),

    /** Overall confidence in this analysis (0.0 - 1.0) */
    confidenceScore: z.number().min(0).max(1),
  }),
});
export type StructuredAnalysisData = z.infer<typeof StructuredAnalysisDataSchema>;
