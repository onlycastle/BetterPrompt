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
// Quote Context Schema (A: 맥락 분석)
// ============================================================================

/**
 * Contextual information about when and why a quote occurred
 * Helps understand the situation that triggered this behavior
 */
export const QuoteContextSchema = z.object({
  /** What type of situation triggered this behavior */
  situationType: z.enum([
    'complex_decision', // 복잡한 결정 상황
    'debugging', // 디버깅 중
    'feature_building', // 기능 구현
    'refactoring', // 리팩토링
    'code_review', // 코드 리뷰
    'learning', // 학습/탐색
  ]),

  /** What triggered this particular behavior (optional) */
  trigger: z
    .enum([
      'uncertainty', // 불확실성
      'previous_failure', // 이전 실패
      'time_pressure', // 시간 압박
      'complexity', // 복잡성
      'unfamiliarity', // 익숙하지 않음
    ])
    .optional(),

  /** What outcome resulted from this behavior (optional) */
  outcome: z
    .enum([
      'successful', // 성공적
      'partially_successful', // 부분적 성공
      'unsuccessful', // 실패
      'unknown', // 알 수 없음
    ])
    .optional(),
});
export type QuoteContext = z.infer<typeof QuoteContextSchema>;

// ============================================================================
// Quote Insight Schema (C: Why 분석)
// ============================================================================

/**
 * Deep insight into why a behavior occurred
 * Provides root cause analysis for more actionable feedback
 */
export const QuoteInsightSchema = z.object({
  /** Root cause of this behavior (max 200 chars) */
  rootCause: z.string().max(200),

  /** What this behavior implies about the developer's growth */
  implication: z.string().max(200),

  /** Whether this behavior is deliberate, reactive, or habitual */
  growthSignal: z.enum([
    'deliberate', // 의도적으로 선택한 행동
    'reactive', // 상황에 반응한 행동
    'habitual', // 습관화된 행동
  ]),
});
export type QuoteInsight = z.infer<typeof QuoteInsightSchema>;

// ============================================================================
// Extracted Quote Schema
// ============================================================================

/**
 * A single extracted quote from a session with metadata
 * Used as evidence for strengths or growth areas in specific dimensions
 *
 * NOTE: No min/max constraints on quote field - user data is diverse.
 * Length constraints are intentionally omitted to handle edge cases.
 * If needed, soft limits can be applied in sanitizeResponse().
 */
export const ExtractedQuoteSchema = z.object({
  /** The actual quote from the developer */
  quote: z.string(),

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

  /** Cluster identifier for grouping related quotes (format: "{dimension}_s_{n}" or "{dimension}_g_{n}") */
  clusterId: z.string().optional(),

  /** A: Context - When and what situation triggered this behavior */
  context: QuoteContextSchema.optional(),

  /** C: Why - Root cause analysis for deeper understanding */
  insight: QuoteInsightSchema.optional(),
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
// Cluster Definition Schema (for quote-to-section mapping)
// ============================================================================

/**
 * Defines a thematic cluster of quotes within a dimension
 * Used to group similar quotes and map them to strength/growth sections
 */
export const ClusterDefinitionSchema = z.object({
  /** Unique cluster identifier (format: "{dimension}_s_{n}" or "{dimension}_g_{n}") */
  clusterId: z.string(),

  /** Whether this cluster contains strength or growth quotes */
  signal: z.enum(['strength', 'growth']),

  /** Theme/topic this cluster represents (used as basis for section title) */
  theme: z.string(),
});
export type ClusterDefinition = z.infer<typeof ClusterDefinitionSchema>;

// ============================================================================
// Personalized Priority Schema (B: 개인화된 우선순위)
// ============================================================================

/**
 * A single prioritized focus area for this specific developer
 * Represents one of the top 3 areas they should focus on
 */
export const PriorityItemSchema = z.object({
  /** Priority rank (1, 2, or 3) */
  rank: z.number().min(1).max(3),

  /** Which dimension this priority relates to */
  dimension: DimensionNameEnumSchema,

  /** Specific focus area within this dimension */
  focusArea: z.string().max(100),

  /** Why this is a priority for THIS developer (personalized reasoning) */
  rationale: z.string().max(300),

  /** Expected impact if they focus on this */
  expectedImpact: z.string().max(200),

  /** Calculated priority score (0-100) based on frequency, impact, potential, relevance */
  priorityScore: z.number().min(0).max(100),

  /** Related cluster IDs that contributed to this priority */
  relatedClusterIds: z.array(z.string()),
});
export type PriorityItem = z.infer<typeof PriorityItemSchema>;

/**
 * Personalized top 3 priorities for this developer
 * Calculated based on frequency, impact, growth potential, and context relevance
 */
export const PersonalizedPrioritySchema = z.object({
  /** Top 3 priorities for this developer */
  topPriorities: z.array(PriorityItemSchema),

  /** Explanation of how priorities were selected */
  selectionRationale: z.string().max(500),
});
export type PersonalizedPriority = z.infer<typeof PersonalizedPrioritySchema>;

// ============================================================================
// Dimension Signal Schema (Flattened for Gemini API compatibility)
// ============================================================================

/**
 * Aggregated signals for a single analysis dimension
 * Flattened structure to avoid exceeding Gemini's max nesting depth
 *
 * Note: Quotes are matched to sections via clusterId field.
 */
export const DimensionSignalSchema = z.object({
  /** Which dimension these signals belong to */
  dimension: DimensionNameEnumSchema,

  /** Positive signals (strengths) as simple string descriptions */
  strengthSignals: z.array(z.string().max(150)),

  /** Growth signals (opportunities) as simple string descriptions */
  growthSignals: z.array(z.string().max(150)),

  /** Cluster definitions for mapping quotes to strength/growth sections */
  clusters: z.array(ClusterDefinitionSchema).optional(),
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

  /** B: Personalized top 3 priorities for this developer */
  personalizedPriorities: PersonalizedPrioritySchema.optional(),

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
