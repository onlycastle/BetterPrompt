/**
 * Productivity Analysis Data Schema (Module C Output)
 *
 * Zod schemas for Module C (Productivity Analyst) output.
 * Measures iteration efficiency, learning velocity, and collaboration effectiveness.
 *
 * ⚠️ NESTING CONSTRAINT: Maximum 4 levels for Gemini API compatibility
 * Uses flattened string fields (semicolon-separated) instead of nested arrays.
 *
 * @module models/productivity-data
 */

import { z } from 'zod';

// ============================================================================
// Enums for Productivity Analysis
// ============================================================================

/**
 * Trigger types for iteration cycles
 */
export const IterationTriggerEnum = z.enum([
  'error_fix',           // Fixing errors/bugs
  'feature_refinement',  // Refining feature implementation
  'clarification',       // Clarifying requirements
  'exploration',         // Exploring approaches
  'optimization',        // Optimizing existing code
]);
export type IterationTrigger = z.infer<typeof IterationTriggerEnum>;

/**
 * Resolution types for iteration cycles
 */
export const IterationResolutionEnum = z.enum([
  'resolved',    // Successfully resolved
  'abandoned',   // Abandoned this approach
  'escalated',   // Escalated to different approach
  'deferred',    // Deferred for later
]);
export type IterationResolution = z.infer<typeof IterationResolutionEnum>;

/**
 * Efficiency levels for iteration cycles
 */
export const IterationEfficiencyEnum = z.enum([
  'efficient',    // 2-3 turns to resolve
  'normal',       // 4-5 turns
  'inefficient',  // 6+ turns
]);
export type IterationEfficiency = z.infer<typeof IterationEfficiencyEnum>;

/**
 * Learning signal categories
 */
export const LearningCategoryEnum = z.enum([
  'new_api',           // Learning new API/library
  'debugging_skill',   // Debugging techniques
  'architecture',      // Architecture patterns
  'tool_usage',        // Tool/CLI usage
  'language_feature',  // Language features
  'best_practice',     // Best practices
]);
export type LearningCategory = z.infer<typeof LearningCategoryEnum>;

/**
 * Learning depth levels
 */
export const LearningDepthEnum = z.enum([
  'shallow',   // Surface-level understanding
  'moderate',  // Working knowledge
  'deep',      // Deep comprehension with "why"
]);
export type LearningDepth = z.infer<typeof LearningDepthEnum>;

/**
 * Learning styles
 */
export const LearningStyleEnum = z.enum([
  'explorer',     // Tries many approaches, broad learning
  'deep_diver',   // Deep focus on single topics
  'balanced',     // Mix of exploration and depth
  'reactive',     // Only learns when forced by errors
]);
export type LearningStyle = z.infer<typeof LearningStyleEnum>;

/**
 * Efficiency interpretation levels
 */
export const EfficiencyInterpretationEnum = z.enum([
  'excellent',          // Top 10%
  'good',               // Above average
  'average',            // Normal
  'needs_improvement',  // Below average
]);
export type EfficiencyInterpretation = z.infer<typeof EfficiencyInterpretationEnum>;

// ============================================================================
// Flattened Iteration Cycle (String Format)
// ============================================================================

/**
 * Iteration cycle as a flattened string
 * Format: "cycleId:turnCount:trigger:resolution:efficiency:keyMoments"
 * Example: "cycle_1:4:error_fix:resolved:efficient:Found the bug in line 42"
 *
 * Parser function provided below to convert back to object.
 */
export interface ParsedIterationCycle {
  cycleId: string;
  turnCount: number;
  trigger: IterationTrigger;
  resolution: IterationResolution;
  efficiency: IterationEfficiency;
  keyMoments: string;
}

/**
 * Parse iteration cycles data string into array of objects
 */
export function parseIterationCyclesData(data: string | undefined): ParsedIterationCycle[] {
  if (!data) return [];
  return data.split(';').filter(Boolean).map((s) => {
    const [cycleId, turnCount, trigger, resolution, efficiency, ...keyMomentsParts] = s.split(':');
    return {
      cycleId: cycleId || 'unknown',
      turnCount: parseInt(turnCount, 10) || 0,
      trigger: (trigger as IterationTrigger) || 'exploration',
      resolution: (resolution as IterationResolution) || 'resolved',
      efficiency: (efficiency as IterationEfficiency) || 'normal',
      keyMoments: keyMomentsParts.join(':') || '',
    };
  });
}

// ============================================================================
// Flattened Learning Signal (String Format)
// ============================================================================

/**
 * Learning signal as a flattened string
 * Format: "topic:category:depth:transferability:evidence"
 * Example: "React hooks:new_api:deep:0.8:Asked why useEffect needs cleanup"
 */
export interface ParsedLearningSignal {
  topic: string;
  category: LearningCategory;
  depth: LearningDepth;
  transferability: number;
  evidence: string;
}

/**
 * Parse learning signals data string into array of objects
 */
export function parseLearningSignalsData(data: string | undefined): ParsedLearningSignal[] {
  if (!data) return [];
  return data.split(';').filter(Boolean).map((s) => {
    const [topic, category, depth, transferability, ...evidenceParts] = s.split(':');
    return {
      topic: topic || 'Unknown',
      category: (category as LearningCategory) || 'best_practice',
      depth: (depth as LearningDepth) || 'shallow',
      transferability: parseFloat(transferability) || 0.5,
      evidence: evidenceParts.join(':') || '',
    };
  });
}

// ============================================================================
// Flattened Efficiency Metric (String Format)
// ============================================================================

/**
 * Efficiency metric as a flattened string
 * Format: "name:value:interpretation"
 * Example: "firstTrySuccessRate:0.75:good"
 */
export interface ParsedEfficiencyMetric {
  name: string;
  value: number;
  interpretation: EfficiencyInterpretation;
}

/**
 * Parse efficiency metrics data string into array of objects
 */
export function parseEfficiencyMetricsData(data: string | undefined): ParsedEfficiencyMetric[] {
  if (!data) return [];
  return data.split(';').filter(Boolean).map((s) => {
    const [name, value, interpretation] = s.split(':');
    return {
      name: name || 'Unknown',
      value: parseFloat(value) || 0,
      interpretation: (interpretation as EfficiencyInterpretation) || 'average',
    };
  });
}

// ============================================================================
// Productivity Analysis Data Schema (4-Level Max Nesting)
// ============================================================================

/**
 * Complete productivity analysis data from Module C
 *
 * NESTING STRUCTURE (4 levels max):
 * L1: ProductivityAnalysisData
 *   L2: iterationSummary (object)
 *     L3: totalCycles (number) - primitive
 *   L2: learningVelocity (object)
 *     L3: learningStyle (enum) - primitive
 *   L2: keyIndicators (object)
 *     L3: firstTrySuccessRate (number) - primitive
 *   L2: collaborationEfficiency (object)
 *     L3: requestClarity (number) - primitive
 *
 * Flattened fields (string format):
 *   - iterationCyclesData: "cycleId:turnCount:trigger:resolution:efficiency:keyMoments;..."
 *   - learningSignalsData: "topic:category:depth:transferability:evidence;..."
 *   - efficiencyMetricsData: "name:value:interpretation;..."
 */
export const ProductivityAnalysisDataSchema = z.object({
  // ---- Flattened Array Data (String Format) ----

  /**
   * Iteration cycles as semicolon-separated string
   * Format: "cycleId:turnCount:trigger:resolution:efficiency:keyMoments;..."
   * Target: 3-10 cycles
   */
  iterationCyclesData: z.string().max(5000).optional()
    .describe('Iteration cycles as "cycleId:turnCount:trigger:resolution:efficiency:keyMoments;..." (target: 3-10)'),

  /**
   * Learning signals as semicolon-separated string
   * Format: "topic:category:depth:transferability:evidence;..."
   * Target: 5-15 signals
   */
  learningSignalsData: z.string().max(5000).optional()
    .describe('Learning signals as "topic:category:depth:transferability:evidence;..." (target: 5-15)'),

  /**
   * Efficiency metrics as semicolon-separated string
   * Format: "name:value:interpretation;..."
   * Target: 4-8 metrics
   */
  efficiencyMetricsData: z.string().max(2000).optional()
    .describe('Efficiency metrics as "name:value:interpretation;..." (target: 4-8)'),

  // ---- Iteration Summary (L2 Object, L3 Primitives) ----

  /**
   * Summary statistics for iteration cycles
   */
  iterationSummary: z.object({
    /** Total number of iteration cycles detected */
    totalCycles: z.number().min(0),

    /** Average turns per cycle */
    avgTurnsPerCycle: z.number().min(0),

    /** Ratio of efficient cycles (0-1) */
    efficientCycleRate: z.number().min(0).max(1),

    /** Most common trigger type */
    mostCommonTrigger: IterationTriggerEnum,

    /** Predominant resolution pattern */
    predominantResolution: IterationResolutionEnum,
  }),

  // ---- Learning Velocity (L2 Object, L3 Primitives) ----

  /**
   * Learning velocity assessment
   */
  learningVelocity: z.object({
    /** Average learning signals per session */
    signalsPerSession: z.number().min(0),

    /** Average depth of learning signals */
    avgDepth: LearningDepthEnum,

    /** Overall learning style */
    learningStyle: LearningStyleEnum,

    /** Overall transferability score (0-1) */
    overallTransferability: z.number().min(0).max(1),
  }),

  // ---- Key Indicators (L2 Object, L3 Primitives) ----

  /**
   * Key productivity indicators
   */
  keyIndicators: z.object({
    /** First try success rate (0-1) */
    firstTrySuccessRate: z.number().min(0).max(1),

    /** Context switch frequency (lower is better) */
    contextSwitchFrequency: z.number().min(0),

    /** Productive turn ratio (0-1) */
    productiveTurnRatio: z.number().min(0).max(1),

    /** Average turns to first solution */
    avgTurnsToFirstSolution: z.number().min(0),
  }),

  // ---- Collaboration Efficiency (L2 Object, L3 Primitives) ----

  /**
   * AI collaboration efficiency metrics
   */
  collaborationEfficiency: z.object({
    /** Request clarity score (0-1) */
    requestClarity: z.number().min(0).max(1),

    /** Specification completeness score (0-1) */
    specificationCompleteness: z.number().min(0).max(1),

    /** Ratio of proactive vs reactive requests (higher = more proactive) */
    proactiveVsReactiveRatio: z.number().min(0),

    /** How often context is provided proactively (0-1) */
    contextProvisionFrequency: z.number().min(0).max(1),
  }),

  // ---- Overall Scores (L2 Primitives) ----

  /** Overall productivity score (0-100) */
  overallProductivityScore: z.number().min(0).max(100),

  /** Confidence in this analysis (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Brief summary of productivity patterns */
  summary: z.string().max(500).optional()
    .describe('Brief summary of key productivity insights'),
});

export type ProductivityAnalysisData = z.infer<typeof ProductivityAnalysisDataSchema>;

// ============================================================================
// Default Factory Function
// ============================================================================

/**
 * Create default productivity analysis data
 */
export function createDefaultProductivityAnalysisData(): ProductivityAnalysisData {
  return {
    iterationCyclesData: '',
    learningSignalsData: '',
    efficiencyMetricsData: '',
    iterationSummary: {
      totalCycles: 0,
      avgTurnsPerCycle: 0,
      efficientCycleRate: 0.5,
      mostCommonTrigger: 'exploration',
      predominantResolution: 'resolved',
    },
    learningVelocity: {
      signalsPerSession: 0,
      avgDepth: 'moderate',
      learningStyle: 'balanced',
      overallTransferability: 0.5,
    },
    keyIndicators: {
      firstTrySuccessRate: 0.5,
      contextSwitchFrequency: 0,
      productiveTurnRatio: 0.5,
      avgTurnsToFirstSolution: 3,
    },
    collaborationEfficiency: {
      requestClarity: 0.5,
      specificationCompleteness: 0.5,
      proactiveVsReactiveRatio: 1,
      contextProvisionFrequency: 0.5,
    },
    overallProductivityScore: 50,
    confidenceScore: 0.5,
    summary: 'Insufficient data for detailed productivity analysis.',
  };
}
