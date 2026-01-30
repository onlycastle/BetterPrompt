/**
 * Analysis Data Schema
 *
 * Zod schemas for Stage 1 (Data Analyst) intermediate output.
 * This represents the structured data extraction that happens before
 * the final personalized narrative is generated.
 */

import { z } from 'zod';
import { CodingStyleTypeSchema, AIControlLevelSchema } from './coding-style';
// Import from dimension-schema to avoid circular dependency
import { DimensionNameEnumSchema } from './dimension-schema';

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
// Quote Context & Insight Enums (Flattened for Gemini API compatibility)
// ============================================================================

/**
 * Enum values for quote context and insight fields
 * FLATTENED: Previously nested in QuoteContextSchema and QuoteInsightSchema
 * Now inlined into ExtractedQuoteSchema to reduce nesting depth
 */
export const SituationTypeEnum = z.enum([
  // Original types
  'complex_decision', // Complex decision situation
  'debugging', // Debugging
  'feature_building', // Feature implementation
  'refactoring', // Refactoring
  'code_review', // Code review
  'learning', // Learning/exploration
  // New types (Phase 2)
  'initial_planning', // Starting new work
  'mid_task_pivot', // Changing direction mid-task
  'error_recovery', // Recovering from AI error
  'optimization', // Optimization
  'integration', // Integration
  'documentation', // Documentation
  'testing', // Testing
]);

export const TriggerEnum = z.enum([
  'uncertainty', // Uncertainty
  'previous_failure', // Previous failure
  'time_pressure', // Time pressure
  'complexity', // Complexity
  'unfamiliarity', // Unfamiliarity
]);

export const OutcomeEnum = z.enum([
  'successful', // Successful
  'partially_successful', // Partially successful
  'unsuccessful', // Unsuccessful
  'unknown', // Unknown
]);

export const GrowthSignalEnum = z.enum([
  'deliberate', // Deliberately chosen behavior
  'reactive', // Reactive behavior to situation
  'habitual', // Habitualized behavior
]);

// Legacy type exports for backward compatibility
export type QuoteContext = {
  situationType: z.infer<typeof SituationTypeEnum>;
  trigger?: z.infer<typeof TriggerEnum>;
  outcome?: z.infer<typeof OutcomeEnum>;
};
export type QuoteInsight = {
  rootCause: string;
  implication: string;
  growthSignal: z.infer<typeof GrowthSignalEnum>;
};

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
  behavioralMarker: z.string(),

  /** Confidence level in this quote's significance (0.0 - 1.0) */
  confidence: z.number().min(0).max(1),

  /** Cluster identifier for grouping related quotes (format: "{dimension}_s_{n}" or "{dimension}_g_{n}") */
  clusterId: z.string().optional(),

  // ---- A: Context fields (FLATTENED from QuoteContextSchema) ----
  /** What type of situation triggered this behavior */
  contextSituationType: SituationTypeEnum.optional(),

  /** What triggered this particular behavior */
  contextTrigger: TriggerEnum.optional(),

  /** What outcome resulted from this behavior */
  contextOutcome: OutcomeEnum.optional(),

  // ---- C: Insight fields (FLATTENED from QuoteInsightSchema) ----
  /** Root cause of this behavior (max 200 chars) */
  insightRootCause: z.string().optional(),

  /** What this behavior implies about the developer's growth */
  insightImplication: z.string().optional(),

  /** Whether this behavior is deliberate, reactive, or habitual */
  insightGrowthSignal: GrowthSignalEnum.optional(),
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
    // Original types
    'communication_style',
    'problem_solving',
    'ai_interaction',
    'verification_habit',
    'tool_usage',
    // New types - Scope Management (Phase 2)
    'scope_discipline', // Maintaining work scope
    'proper_decomposition', // Proper decomposition
    // New types - Learning Behavior (Phase 2)
    'ask_why', // Habit of asking "why"
    'pattern_recognition', // Pattern recognition
    'knowledge_synthesis', // Knowledge synthesis
    // New types - Context Management (Phase 2)
    'context_awareness', // Context awareness
    'strategic_reset', // Strategic reset
    // New types - Iteration Efficiency (Phase 2)
    'efficient_refinement', // Efficient refinement
    'systematic_debugging', // Systematic debugging
  ]),

  /** How many times this pattern was observed */
  frequency: z.number(),

  /** Example quotes demonstrating this pattern (target: 3-6 examples for richer evidence) */
  examples: z.array(z.string()),

  /** Why this pattern matters and its impact (max 400 chars for detailed analysis) */
  significance: z.string(),
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
  evidence: z.array(z.string()),

  /** Feedback message (from if_found or if_missing template) */
  feedback: z.string(),

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
    // Original types
    'sunk_cost_loop', // Continuing failed approach too long (same error + same prompt 3+ times)
    'emotional_escalation', // Frustration affecting prompts
    'blind_retry', // Retrying without changing approach
    'passive_acceptance', // Accepting AI output without verification
    // New types (Phase 2)
    'scope_creep', // Requirements keep expanding
    'context_bloat', // Not managing context
    'premature_optimization', // Optimizing before it works
    'copy_paste_dependency', // Copying without understanding
    'tunnel_vision', // Stuck on one approach
    'over_delegation', // Excessive delegation to AI
  ]),

  /** How many times this pattern was observed */
  frequency: z.number(),

  /** Evidence quotes showing this pattern (target: 1-3 examples) */
  examples: z.array(z.string()),

  /** Severity assessment */
  severity: z.enum(['mild', 'moderate', 'significant']),

  /** Context in which this anti-pattern occurred */
  triggerContext: z.string(),
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
  moment: z.string(),

  /** Type of critical thinking behavior */
  type: z.enum([
    // Original types
    'verification_request', // "Are you sure?", "Is that correct?"
    'output_validation', // Running tests, checking results
    'assumption_questioning', // Challenging AI assumptions
    'alternative_exploration', // Asking for different approaches
    'security_check', // Checking for security/performance issues
    // New types (Phase 2)
    'edge_case_consideration', // Considering edge cases
    'performance_awareness', // Performance impact awareness
    'maintainability_check', // Maintainability check
    'test_driven_thinking', // Test-first thinking
    'architecture_evaluation', // Architecture evaluation
  ]),

  /** What result this critical thinking led to */
  result: z.string(),

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
 * FLATTENED: planDetails fields are now inlined
 */
export const PlanningBehaviorSchema = z.object({
  /** Description of the planning behavior */
  behavior: z.string(),

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

  /** Example quotes demonstrating this behavior (as semicolon-separated string to reduce nesting) */
  examples: z.string(),

  /** Effectiveness assessment */
  effectiveness: z.enum(['high', 'medium', 'low']),

  // ---- Plan details (FLATTENED from nested object) ----
  /** Summary of the plan content (for slash_plan_usage) */
  planContentSummary: z.string().optional(),

  /** Whether the plan decomposed the problem into smaller parts */
  planHasDecomposition: z.boolean().optional(),

  /** Number of steps in the plan */
  planStepsCount: z.number().optional(),
});
export type PlanningBehavior = z.infer<typeof PlanningBehaviorSchema>;

// ============================================================================
// Absence-Based Growth Signal Schema (NEW - Systematic Growth Detection)
// ============================================================================

/**
 * Growth signal detected by the ABSENCE of an expected pattern.
 * This is more reliable than positive detection because absence is definitive.
 *
 * Example: If no /plan usage is found in any session, that's a clear growth area.
 */
export const AbsenceBasedGrowthSignalSchema = z.object({
  /** Pattern identifier from EXPECTED_PATTERNS */
  patternId: z.string(),

  /** Which dimension this growth signal relates to */
  dimension: DimensionNameEnumSchema,

  /** Whether this expected pattern was absent (true = not found = growth area) */
  wasAbsent: z.boolean(),

  /** How many sessions were checked for this pattern */
  sessionsChecked: z.number(),

  /** Human-readable title for this growth area */
  growthTitle: z.string(),

  /** Detailed explanation of why this matters */
  growthDescription: z.string(),

  /** Actionable recommendation */
  recommendation: z.string(),

  /** Source of this recommendation (e.g., "Anthropic Best Practices", "Expected Pattern") */
  source: z.string().optional(),
});
export type AbsenceBasedGrowthSignal = z.infer<typeof AbsenceBasedGrowthSignalSchema>;

// ============================================================================
// Cluster Definition (Legacy type for backward compatibility)
// ============================================================================

/**
 * Legacy type for ClusterDefinition
 * NOTE: Clusters are now derived from extractedQuotes via clusterId field
 * This type is kept for backward compatibility with existing code
 */
export type ClusterDefinition = {
  clusterId: string;
  signal: 'strength' | 'growth';
  theme: string;
};

// ============================================================================
// Personalized Priority Schema (B: Personalized Priorities)
// ============================================================================

/**
 * A single prioritized focus area for this specific developer
 * Represents one of the top 3 areas they should focus on
 * FLATTENED: relatedClusterIds is now a comma-separated string
 */
export const PriorityItemSchema = z.object({
  /** Priority rank (1, 2, or 3) */
  rank: z.number().min(1).max(3),

  /** Which dimension this priority relates to */
  dimension: DimensionNameEnumSchema,

  /** Specific focus area within this dimension */
  focusArea: z.string(),

  /** Why this is a priority for THIS developer (personalized reasoning) */
  rationale: z.string(),

  /** Expected impact if they focus on this */
  expectedImpact: z.string(),

  /** Calculated priority score (0-100) based on frequency, impact, potential, relevance */
  priorityScore: z.number().min(0).max(100),

  /** Related cluster IDs as comma-separated string (e.g., "dim1_s_1,dim1_g_2") */
  relatedClusterIds: z.string(),
});
export type PriorityItem = z.infer<typeof PriorityItemSchema>;

/**
 * Personalized top 3 priorities for this developer
 * Calculated based on frequency, impact, growth potential, and context relevance
 * FLATTENED: Now has 3 separate priority fields instead of nested array
 */
export const PersonalizedPrioritySchema = z.object({
  /** Priority 1 - highest priority focus area */
  priority1Dimension: DimensionNameEnumSchema.optional(),
  priority1FocusArea: z.string().optional(),
  priority1Rationale: z.string().optional(),
  priority1ExpectedImpact: z.string().optional(),
  priority1Score: z.number().min(0).max(100).optional(),
  priority1ClusterIds: z.string().optional(),

  /** Priority 2 */
  priority2Dimension: DimensionNameEnumSchema.optional(),
  priority2FocusArea: z.string().optional(),
  priority2Rationale: z.string().optional(),
  priority2ExpectedImpact: z.string().optional(),
  priority2Score: z.number().min(0).max(100).optional(),
  priority2ClusterIds: z.string().optional(),

  /** Priority 3 */
  priority3Dimension: DimensionNameEnumSchema.optional(),
  priority3FocusArea: z.string().optional(),
  priority3Rationale: z.string().optional(),
  priority3ExpectedImpact: z.string().optional(),
  priority3Score: z.number().min(0).max(100).optional(),
  priority3ClusterIds: z.string().optional(),

  /** Explanation of how priorities were selected */
  selectionRationale: z.string(),
});
export type PersonalizedPriority = z.infer<typeof PersonalizedPrioritySchema>;

// ============================================================================
// Dimension Signal Schema (Flattened for Gemini API compatibility)
// ============================================================================

/**
 * Aggregated signals for a single analysis dimension
 * Flattened structure to avoid exceeding Gemini's max nesting depth
 *
 * Note: Quotes are matched to sections via clusterId field in extractedQuotes.
 * Cluster themes are now stored as simple string arrays instead of nested objects.
 */
export const DimensionSignalSchema = z.object({
  /** Which dimension these signals belong to */
  dimension: DimensionNameEnumSchema,

  /** Positive signals (strengths) as simple string descriptions */
  strengthSignals: z.array(z.string()),

  /** Growth signals (opportunities) as simple string descriptions */
  growthSignals: z.array(z.string()),

  /** Cluster themes for strength quotes (format: "clusterId:theme" pairs as strings) */
  strengthClusterThemes: z.array(z.string()).optional(),

  /** Cluster themes for growth quotes (format: "clusterId:theme" pairs as strings) */
  growthClusterThemes: z.array(z.string()).optional(),
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

    /** AI control level (explorer | navigator | cartographer) */
    controlLevel: AIControlLevelSchema,

    /** Raw control score (0-100) for level distribution calculation */
    controlScore: z.number().min(0).max(100).optional(),

    /** Percentage distribution across all 5 types */
    distribution: TypeDistributionSchema,

    /** Explanation of why this classification was chosen (max 800 chars) */
    reasoning: z.string(),
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

  /** Absence-based growth signals (systematic growth detection) */
  absenceBasedGrowthSignals: z.array(AbsenceBasedGrowthSignalSchema).optional(),

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

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a default/empty StructuredAnalysisData for fallback cases
 *
 * @returns Default StructuredAnalysisData with minimal valid data
 */
export function createDefaultStructuredAnalysisData(): StructuredAnalysisData {
  const defaultDimensionSignals = [
    { dimension: 'aiCollaboration' as const, strengthSignals: [], growthSignals: [] },
    { dimension: 'contextEngineering' as const, strengthSignals: [], growthSignals: [] },
    { dimension: 'toolMastery' as const, strengthSignals: [], growthSignals: [] },
    { dimension: 'burnoutRisk' as const, strengthSignals: [], growthSignals: [] },
    { dimension: 'aiControl' as const, strengthSignals: [], growthSignals: [] },
    { dimension: 'skillResilience' as const, strengthSignals: [], growthSignals: [] },
  ];

  return {
    typeAnalysis: {
      primaryType: 'collaborator',
      controlLevel: 'navigator',
      distribution: {
        architect: 20,
        scientist: 20,
        collaborator: 20,
        speedrunner: 20,
        craftsman: 20,
      },
      reasoning: 'Default fallback - insufficient data for analysis',
    },
    extractedQuotes: [],
    detectedPatterns: [],
    detectedAntiPatterns: [],
    criticalThinkingMoments: [],
    planningBehaviors: [],
    dimensionSignals: defaultDimensionSignals,
    analysisMetadata: {
      totalQuotesAnalyzed: 0,
      coverageScores: [
        { dimension: 'aiCollaboration' as const, score: 0 },
        { dimension: 'contextEngineering' as const, score: 0 },
        { dimension: 'toolMastery' as const, score: 0 },
        { dimension: 'burnoutRisk' as const, score: 0 },
        { dimension: 'aiControl' as const, score: 0 },
        { dimension: 'skillResilience' as const, score: 0 },
      ],
      confidenceScore: 0,
    },
  };
}
