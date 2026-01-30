/**
 * Risk Signal - Zod schemas for aggregated risk signal analysis
 *
 * Aggregates evidence from multiple sources:
 * - Anti-patterns (sunk_cost_loop, blind_retry, etc.)
 * - Critical thinking gaps
 * - Planning behavior gaps
 * - Metacognition blind spots
 * - Temporal fatigue patterns
 *
 * @module models/risk-signal
 */

import { z } from 'zod';

// ============================================================================
// Risk Signal Types
// ============================================================================

/**
 * Risk signal types with severity weights
 *
 * Weights:
 * - skill_atrophy: 1.5 (most severe)
 * - ai_dependency: 1.3
 * - quality_neglect: 1.0
 * - burnout_risk: 0.8
 */
export const RiskTypeSchema = z.enum([
  'skill_atrophy',    // Skills deteriorating due to AI over-reliance
  'ai_dependency',    // Excessive AI dependence, not developing own judgment
  'quality_neglect',  // Ignoring quality in favor of speed
  'burnout_risk',     // Signs of burnout, frustration, or fatigue
]);

export type RiskType = z.infer<typeof RiskTypeSchema>;

/**
 * Risk type weights for score calculation
 */
export const RISK_TYPE_WEIGHTS: Record<RiskType, number> = {
  skill_atrophy: 1.5,
  ai_dependency: 1.3,
  quality_neglect: 1.0,
  burnout_risk: 0.8,
};

// ============================================================================
// Risk Signal Schema
// ============================================================================

/**
 * Individual risk signal
 */
export const RiskSignalSchema = z.object({
  // Risk type
  type: RiskTypeSchema,

  // Severity (1-5)
  severity: z.number().min(1).max(5),

  // Evidence from various sources (flattened strings)
  evidenceFromAntiPatterns: z.array(z.string()).optional(),
  evidenceFromCriticalThinking: z.array(z.string()).optional(),
  evidenceFromPlanning: z.array(z.string()).optional(),
  evidenceFromMetacognition: z.array(z.string()).optional(),
  evidenceFromTemporalPatterns: z.array(z.string()).optional(),

  // KB recommendations (insight IDs)
  kbRecommendationIds: z.array(z.string()).optional(),

  // Recurring pattern info
  isRecurring: z.boolean(),
  occurrenceCount: z.number().optional(),
  sessionIds: z.array(z.string()).optional(),
});

export type RiskSignal = z.infer<typeof RiskSignalSchema>;

// ============================================================================
// Aggregated Risk Analysis Schema
// ============================================================================

/**
 * Aggregated risk analysis result
 */
export const RiskAnalysisSchema = z.object({
  // Overall risk score (0-100)
  overallRiskScore: z.number().min(0).max(100),

  // Individual risk signals
  signals: z.array(RiskSignalSchema),

  // Top 3 risk signals (most severe/recurring)
  topRiskSignals: z.array(
    z.object({
      type: RiskTypeSchema,
      summary: z.string(),
      severity: z.number().min(1).max(5),
      isRecurring: z.boolean(),
    })
  ).max(3),

  // Risk breakdown by type
  riskByType: z.object({
    skillAtrophy: z.number().min(0).max(100),
    aiDependency: z.number().min(0).max(100),
    qualityNeglect: z.number().min(0).max(100),
    burnoutRisk: z.number().min(0).max(100),
  }),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),
});

export type RiskAnalysis = z.infer<typeof RiskAnalysisSchema>;

// ============================================================================
// KB Mapping Types
// ============================================================================

/**
 * Mapping from risk patterns to KB insight IDs
 */
export const RISK_TO_KB_MAPPING: Record<string, string[]> = {
  // Anti-pattern → KB Insight
  sunk_cost_loop: ['skill-atrophy-diagnosis', 'ai-dependency-checklist'],
  blind_retry: ['50-percent-modification-test', 'context-engineering-techniques'],
  passive_acceptance: ['passive-consumption-warning', 'ai-dependency-checklist'],
  emotional_escalation: ['burnout-prevention-guide'],

  // Critical Thinking gaps → KB Insight
  missing_verification: ['50-percent-modification-test', 'output-validation-habit'],
  missing_assumption_questioning: ['80-percent-planning-rule'],

  // Planning gaps → KB Insight
  missing_task_decomposition: ['80-percent-planning-rule', 'architects-validation'],
  reactive_planning: ['vibe-to-context-engineering'],

  // Metacognition gaps → KB Insight
  low_self_awareness: ['skill-atrophy-diagnosis'],
  repeated_blind_spots: ['ai-dependency-checklist', 'context-engineering-techniques'],

  // Temporal patterns → KB Insight
  late_night_drop: ['burnout-prevention-guide', 'peak-performance-scheduling'],
  typo_spike: ['fatigue-management-guide'],
  passive_acceptance_spike: ['critical-thinking-habit'],
};

/**
 * Risk type to pattern mapping (for categorization)
 */
export const PATTERN_TO_RISK_TYPE: Record<string, RiskType> = {
  // skill_atrophy patterns
  sunk_cost_loop: 'skill_atrophy',
  repeated_blind_spots: 'skill_atrophy',
  low_self_awareness: 'skill_atrophy',

  // ai_dependency patterns
  blind_retry: 'ai_dependency',
  passive_acceptance: 'ai_dependency',
  passive_acceptance_spike: 'ai_dependency',

  // quality_neglect patterns
  missing_verification: 'quality_neglect',
  missing_assumption_questioning: 'quality_neglect',
  missing_task_decomposition: 'quality_neglect',
  reactive_planning: 'quality_neglect',

  // burnout_risk patterns
  emotional_escalation: 'burnout_risk',
  late_night_drop: 'burnout_risk',
  typo_spike: 'burnout_risk',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate overall risk score from signals
 *
 * Formula:
 * - Base score = severity * type_weight
 * - Recurring patterns get 1.5x multiplier
 * - Normalized to 0-100
 *
 * @param signals - Risk signals
 * @returns Overall risk score (0-100)
 */
export function calculateRiskScore(signals: RiskSignal[]): number {
  if (signals.length === 0) return 0;

  const RECURRING_MULTIPLIER = 1.5;

  let totalRisk = 0;
  for (const signal of signals) {
    const weight = RISK_TYPE_WEIGHTS[signal.type];
    const base = signal.severity * weight;
    totalRisk += signal.isRecurring ? base * RECURRING_MULTIPLIER : base;
  }

  // Normalize to 0-100 (assuming max possible is ~50 for 5 signals at severity 5)
  return Math.min(100, Math.round(totalRisk * 4));
}

/**
 * Calculate risk breakdown by type
 *
 * @param signals - Risk signals
 * @returns Risk scores by type
 */
export function calculateRiskByType(signals: RiskSignal[]): RiskAnalysis['riskByType'] {
  const byType: Record<RiskType, number[]> = {
    skill_atrophy: [],
    ai_dependency: [],
    quality_neglect: [],
    burnout_risk: [],
  };

  for (const signal of signals) {
    const effectiveSeverity = signal.isRecurring ? signal.severity * 1.5 : signal.severity;
    byType[signal.type].push(effectiveSeverity);
  }

  const calculateAvg = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 20) : 0;

  return {
    skillAtrophy: Math.min(100, calculateAvg(byType.skill_atrophy)),
    aiDependency: Math.min(100, calculateAvg(byType.ai_dependency)),
    qualityNeglect: Math.min(100, calculateAvg(byType.quality_neglect)),
    burnoutRisk: Math.min(100, calculateAvg(byType.burnout_risk)),
  };
}

/**
 * Get KB recommendations for a pattern
 *
 * @param patternId - Pattern identifier (e.g., 'sunk_cost_loop')
 * @returns Array of KB insight IDs
 */
export function getKBRecommendations(patternId: string): string[] {
  return RISK_TO_KB_MAPPING[patternId] || [];
}

/**
 * Get risk type for a pattern
 *
 * @param patternId - Pattern identifier
 * @returns Risk type or undefined
 */
export function getRiskTypeForPattern(patternId: string): RiskType | undefined {
  return PATTERN_TO_RISK_TYPE[patternId];
}

/**
 * Create default/empty risk analysis
 */
export function createDefaultRiskAnalysis(): RiskAnalysis {
  return {
    overallRiskScore: 0,
    signals: [],
    topRiskSignals: [],
    riskByType: {
      skillAtrophy: 0,
      aiDependency: 0,
      qualityNeglect: 0,
      burnoutRisk: 0,
    },
    confidenceScore: 0,
  };
}

/**
 * Create a risk signal from pattern detection
 *
 * @param patternId - Pattern identifier
 * @param severity - Severity (1-5)
 * @param evidence - Evidence string
 * @param isRecurring - Whether pattern is recurring
 * @param occurrenceCount - Number of occurrences
 * @returns RiskSignal or null if pattern not mapped
 */
export function createRiskSignalFromPattern(
  patternId: string,
  severity: number,
  evidence: string,
  source: 'antiPattern' | 'criticalThinking' | 'planning' | 'metacognition' | 'temporal',
  isRecurring: boolean = false,
  occurrenceCount?: number,
  sessionIds?: string[]
): RiskSignal | null {
  const riskType = getRiskTypeForPattern(patternId);
  if (!riskType) return null;

  const signal: RiskSignal = {
    type: riskType,
    severity: Math.max(1, Math.min(5, severity)),
    isRecurring,
    occurrenceCount,
    sessionIds,
    kbRecommendationIds: getKBRecommendations(patternId),
  };

  // Add evidence to appropriate source
  switch (source) {
    case 'antiPattern':
      signal.evidenceFromAntiPatterns = [evidence];
      break;
    case 'criticalThinking':
      signal.evidenceFromCriticalThinking = [evidence];
      break;
    case 'planning':
      signal.evidenceFromPlanning = [evidence];
      break;
    case 'metacognition':
      signal.evidenceFromMetacognition = [evidence];
      break;
    case 'temporal':
      signal.evidenceFromTemporalPatterns = [evidence];
      break;
  }

  return signal;
}
