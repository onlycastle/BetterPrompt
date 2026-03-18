/**
 * Worker Output Schemas - Consolidated Phase 2 Worker Output Types
 *
 * Canonical Zod schemas for all Phase 2 worker outputs, shared between
 * server (analysis pipeline) and client (report rendering).
 *
 * Workers:
 * - ThinkingQuality: Planning + Critical Thinking
 * - CommunicationPatterns: Communication patterns + Signature quotes
 * - LearningBehavior: Knowledge gaps + Repeated mistakes
 * - ContextEfficiency: Token efficiency patterns + Productivity
 * - SessionOutcome: Goals, friction, success rates
 *
 * Respects Gemini's 4-level nesting limit (arrays don't count).
 *
 * @module @betterprompt/shared/schemas/worker-outputs
 */

import { z } from 'zod';

// ============================================================================
// Shared Evidence Schemas
// ============================================================================

/**
 * Structured evidence with utterance ID linking.
 * Enables linking evidence quotes back to original developer utterances.
 */
export const InsightEvidenceSchema = z.object({
  /** Utterance ID from Phase 1 (format: {sessionId}_{turnIndex}) */
  utteranceId: z.string(),
  /** Direct quote or paraphrase from the developer's message */
  quote: z.string(),
  /** Brief context description */
  context: z.string().optional(),
});
export type InsightEvidence = z.infer<typeof InsightEvidenceSchema>;

/**
 * Evidence can be either a simple string (legacy) or structured with utterance linking.
 * Union type enables backward compatibility with existing data.
 */
export const EvidenceItemSchema = z.union([
  z.string(),
  InsightEvidenceSchema,
]);
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

// Alias for external consumers expecting "EvidenceSchema"
export const EvidenceSchema = EvidenceItemSchema;
export type Evidence = EvidenceItem;

// ============================================================================
// Worker Strength Schema
// ============================================================================

/**
 * A strength identified by a Phase 2 Worker in its domain.
 * Each worker identifies 1-6 strengths with supporting evidence.
 */
export const WorkerStrengthSchema = z.object({
  /** Clear, specific title (e.g., "Systematic Output Verification") */
  title: z.string(),
  /** 6-10 sentences providing comprehensive analysis */
  description: z.string(),
  /**
   * Direct quotes from developer messages demonstrating this (1-8 items).
   * Can be simple strings (legacy) or structured with utterance linking.
   */
  evidence: z.array(EvidenceItemSchema).min(1).max(8),
  /** Truncated description preview for free tier blur teaser (set by ContentGateway) */
  descriptionPreview: z.string().optional(),
});
export type WorkerStrength = z.infer<typeof WorkerStrengthSchema>;

// ============================================================================
// Worker Growth Schema
// ============================================================================

/**
 * Severity level for growth areas.
 *
 * - critical: 70%+ occurrence or fundamental skill gap
 * - high: 40-70% occurrence or significant impact
 * - medium: 20-40% occurrence or moderate impact
 * - low: <20% occurrence or minor impact
 */
export const WorkerGrowthSeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type WorkerGrowthSeverity = z.infer<typeof WorkerGrowthSeveritySchema>;

/**
 * A growth area identified by a Phase 2 Worker in its domain.
 * Each worker identifies 1-6 growth areas with supporting evidence
 * and actionable recommendations.
 */
export const WorkerGrowthSchema = z.object({
  /** Clear, specific title (e.g., "Error Loop Pattern") */
  title: z.string(),
  /** 6-10 sentences providing comprehensive analysis */
  description: z.string(),
  /**
   * Direct quotes from developer messages showing this pattern (1-8 items).
   * Can be simple strings (legacy) or structured with utterance linking.
   */
  evidence: z.array(EvidenceItemSchema).min(1).max(8),
  /** 4-6 sentences with step-by-step actionable advice */
  recommendation: z.string(),
  /** How critical this growth area is to address */
  severity: WorkerGrowthSeveritySchema.optional(),
  /** Truncated description preview for free tier blur teaser (set by ContentGateway) */
  descriptionPreview: z.string().optional(),
  /** Truncated recommendation preview for free tier blur teaser (set by ContentGateway) */
  recommendationPreview: z.string().optional(),
});
export type WorkerGrowth = z.infer<typeof WorkerGrowthSchema>;

// ============================================================================
// Referenced Insight Schema
// ============================================================================

/**
 * Referenced insight from Knowledge Base.
 * Post-processed from [pi-XXX] references in worker output text.
 */
export const ReferencedInsightSchema = z.object({
  /** Insight ID (e.g., "pi-001") */
  id: z.string(),
  /** Human-readable title */
  title: z.string(),
  /** Source URL for the insight */
  url: z.string(),
  /** Main insight text */
  keyTakeaway: z.string(),
  /** Actionable tips array */
  actionableAdvice: z.array(z.string()),
  /** Insight category: diagnosis | trend | tool | type-specific */
  category: z.string(),
  /** Author name from source */
  sourceAuthor: z.string(),
});
export type ReferencedInsight = z.infer<typeof ReferencedInsightSchema>;

// ============================================================================
// ThinkingQuality Domain Schemas
// ============================================================================

export const PlanningHabitTypeSchema = z.enum([
  'uses_plan_command',
  'plan_mode_usage',
  'task_decomposition',
  'structure_first',
  'todowrite_usage',
  'no_planning',
]);
export type PlanningHabitType = z.infer<typeof PlanningHabitTypeSchema>;

export const HabitFrequencySchema = z.enum(['always', 'often', 'sometimes', 'rarely', 'never']);
export type HabitFrequency = z.infer<typeof HabitFrequencySchema>;

export const PlanningHabitSchema = z.object({
  type: PlanningHabitTypeSchema,
  frequency: HabitFrequencySchema,
  examples: z.array(z.string()),
  effectiveness: z.enum(['high', 'medium', 'low']).optional(),
});
export type PlanningHabit = z.infer<typeof PlanningHabitSchema>;

export const CriticalThinkingTypeSchema = z.enum([
  'verification_request',
  'output_validation',
  'assumption_questioning',
  'alternative_exploration',
  'edge_case_consideration',
  'security_check',
  'ai_output_correction',
]);
export type CriticalThinkingType = z.infer<typeof CriticalThinkingTypeSchema>;

export const CriticalThinkingMomentSchema = z.object({
  type: CriticalThinkingTypeSchema,
  quote: z.string(),
  result: z.string(),
  utteranceId: z.string().optional(),
});
export type CriticalThinkingMoment = z.infer<typeof CriticalThinkingMomentSchema>;

export const VerificationLevelSchema = z.enum([
  'blind_trust',
  'occasional_review',
  'systematic_verification',
  'skeptical',
]);
export type VerificationLevel = z.infer<typeof VerificationLevelSchema>;

export const VerificationBehaviorSchema = z.object({
  level: VerificationLevelSchema,
  examples: z.array(z.string()),
  recommendation: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});
export type VerificationBehavior = z.infer<typeof VerificationBehaviorSchema>;

export const PatternSeveritySchema = z.enum(['critical', 'significant', 'moderate', 'mild']);
export type PatternSeverity = z.infer<typeof PatternSeveritySchema>;

export const AntiPatternExampleSchema = z.object({
  utteranceId: z.string(),
  quote: z.string(),
  context: z.string().optional(),
});
export type AntiPatternExample = z.infer<typeof AntiPatternExampleSchema>;

export const DetectedAntiPatternSchema = z.object({
  type: z.string(),
  frequency: z.number().int().min(1),
  examples: z.array(AntiPatternExampleSchema),
  severity: PatternSeveritySchema,
  improvement: z.string().optional(),
  sessionPercentage: z.number().min(0).max(100).optional(),
});
export type DetectedAntiPattern = z.infer<typeof DetectedAntiPatternSchema>;

export const ContextPollutionSchema = z.object({
  description: z.string(),
  impact: z.enum(['high', 'medium', 'low']),
});
export type ContextPollution = z.infer<typeof ContextPollutionSchema>;

export const MultitaskingPatternSchema = z.object({
  mixesTopicsInSessions: z.boolean(),
  contextPollutionInstances: z.array(ContextPollutionSchema),
  focusScore: z.number().min(0).max(100).optional(),
  recommendation: z.string().optional(),
});
export type MultitaskingPattern = z.infer<typeof MultitaskingPatternSchema>;

/**
 * Complete output from ThinkingQualityAnalyzer.
 * Combines Planning Quality + Critical Thinking dimensions.
 */
export const ThinkingQualityOutputSchema = z.object({
  // Planning Dimension
  planningHabits: z.array(PlanningHabitSchema),
  planQualityScore: z.number().min(0).max(100),
  multitaskingPattern: MultitaskingPatternSchema.optional(),

  // Critical Thinking Dimension
  verificationBehavior: VerificationBehaviorSchema,
  criticalThinkingMoments: z.array(CriticalThinkingMomentSchema),
  verificationAntiPatterns: z.array(DetectedAntiPatternSchema),

  // Overall Scores
  overallThinkingQualityScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(1),
  summary: z.string().optional(),

  // Domain-specific Strengths & Growth Areas
  strengths: z.array(WorkerStrengthSchema).optional(),
  growthAreas: z.array(WorkerGrowthSchema).optional(),
  referencedInsights: z.array(ReferencedInsightSchema).optional(),
});
export type ThinkingQualityOutput = z.infer<typeof ThinkingQualityOutputSchema>;

// ============================================================================
// CommunicationPatterns Domain Schemas
// ============================================================================

export const PatternFrequencySchema = z.enum(['frequent', 'occasional', 'rare']);
export type PatternFrequency = z.infer<typeof PatternFrequencySchema>;

export const PatternEffectivenessSchema = z.enum(['highly_effective', 'effective', 'could_improve']);
export type PatternEffectiveness = z.infer<typeof PatternEffectivenessSchema>;

export const PatternExampleSchema = z.object({
  utteranceId: z.string(),
  analysis: z.string(),
});
export type PatternExample = z.infer<typeof PatternExampleSchema>;

export const CommunicationPatternSchema = z.object({
  patternName: z.string(),
  description: z.string(),
  frequency: PatternFrequencySchema,
  examples: z.array(PatternExampleSchema).min(1).max(5),
  effectiveness: PatternEffectivenessSchema,
  tip: z.string().optional(),
});
export type CommunicationPattern = z.infer<typeof CommunicationPatternSchema>;

export const SignatureQuoteSchema = z.object({
  utteranceId: z.string(),
  significance: z.string(),
  representedStrength: z.string(),
});
export type SignatureQuote = z.infer<typeof SignatureQuoteSchema>;

/**
 * Complete output from CommunicationPatternsWorker.
 * Analyzes communication clarity: patterns + signature quotes.
 */
export const CommunicationPatternsOutputSchema = z.object({
  // Communication Patterns
  communicationPatterns: z.array(CommunicationPatternSchema),
  signatureQuotes: z.array(SignatureQuoteSchema).optional(),

  // Overall Scores
  overallCommunicationScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(1),
  summary: z.string().optional(),

  // Domain-specific Strengths & Growth Areas
  strengths: z.array(WorkerStrengthSchema),
  growthAreas: z.array(WorkerGrowthSchema).optional(),
  referencedInsights: z.array(ReferencedInsightSchema).optional(),
});
export type CommunicationPatternsOutput = z.infer<typeof CommunicationPatternsOutputSchema>;

// ============================================================================
// LearningBehavior Domain Schemas
// ============================================================================

export const KnowledgeGapItemSchema = z.object({
  topic: z.string(),
  description: z.string(),
  questionCount: z.number().int().min(1),
  depth: z.enum(['shallow', 'moderate', 'deep']),
  example: z.string(),
});
export type KnowledgeGapItem = z.infer<typeof KnowledgeGapItemSchema>;

export const LearningProgressSchema = z.object({
  topic: z.string(),
  description: z.string(),
  startLevel: z.enum(['novice', 'shallow', 'moderate', 'deep', 'expert']),
  currentLevel: z.enum(['novice', 'shallow', 'moderate', 'deep', 'expert']),
  evidence: z.string(),
});
export type LearningProgress = z.infer<typeof LearningProgressSchema>;

export const ResourceSchema = z.object({
  topic: z.string(),
  resourceType: z.enum(['docs', 'tutorial', 'course', 'article', 'video']),
  url: z.string(),
});
export type Resource = z.infer<typeof ResourceSchema>;

export const RepeatedMistakePatternSchema = z.object({
  category: z.string(),
  mistakeType: z.string(),
  description: z.string(),
  occurrenceCount: z.number().int().min(2),
  sessionPercentage: z.number().min(0).max(100).optional(),
  exampleUtteranceIds: z.array(z.string()).max(5),
  recommendation: z.string(),
});
export type RepeatedMistakePattern = z.infer<typeof RepeatedMistakePatternSchema>;

/**
 * Complete output from LearningBehaviorAnalyzer.
 * Combines Knowledge Gaps + Learning Progress + Repeated Mistakes.
 */
export const LearningBehaviorOutputSchema = z.object({
  // Knowledge Gap Dimension
  knowledgeGaps: z.array(KnowledgeGapItemSchema),
  learningProgress: z.array(LearningProgressSchema),
  recommendedResources: z.array(ResourceSchema),

  // Repeated Mistakes Dimension
  repeatedMistakePatterns: z.array(RepeatedMistakePatternSchema),

  // Insights
  topInsights: z.array(z.string()).max(3),
  kptKeep: z.array(z.string()).max(2).optional(),
  kptProblem: z.array(z.string()).max(2).optional(),
  kptTry: z.array(z.string()).max(2).optional(),

  // Overall Scores
  overallLearningScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(1),
  summary: z.string().optional(),

  // Domain-specific Strengths & Growth Areas
  strengths: z.array(WorkerStrengthSchema).optional(),
  growthAreas: z.array(WorkerGrowthSchema).optional(),
  referencedInsights: z.array(ReferencedInsightSchema).optional(),
});
export type LearningBehaviorOutput = z.infer<typeof LearningBehaviorOutputSchema>;

// ============================================================================
// ContextEfficiency Domain Schemas
// ============================================================================

export const ContextUsagePatternSchema = z.object({
  sessionId: z.string(),
  avgFillPercent: z.number().min(0).max(100),
  compactTriggerPercent: z.number().min(0).max(100).optional(),
});
export type ContextUsagePattern = z.infer<typeof ContextUsagePatternSchema>;

export const InefficiencyPatternEnum = z.enum([
  'late_compact',
  'context_bloat',
  'redundant_info',
  'prompt_length_inflation',
  'no_session_separation',
  'verbose_error_pasting',
  'no_knowledge_persistence',
]);
export type InefficiencyPattern = z.infer<typeof InefficiencyPatternEnum>;

export const InefficiencySchema = z.object({
  pattern: InefficiencyPatternEnum,
  frequency: z.number().int().min(1),
  impact: z.enum(['high', 'medium', 'low']),
  description: z.string(),
});
export type Inefficiency = z.infer<typeof InefficiencySchema>;

export const PromptLengthTrendSchema = z.object({
  phase: z.enum(['early', 'mid', 'late']),
  avgLength: z.number().int().min(0),
});
export type PromptLengthTrend = z.infer<typeof PromptLengthTrendSchema>;

export const RedundantInfoSchema = z.object({
  infoType: z.string(),
  repeatCount: z.number().int().min(1),
});
export type RedundantInfo = z.infer<typeof RedundantInfoSchema>;

export const IterationSummarySchema = z.object({
  sessionId: z.string(),
  iterationCount: z.number().int().min(0),
  avgTurnsPerIteration: z.number().min(0),
});
export type IterationSummary = z.infer<typeof IterationSummarySchema>;

/**
 * Complete output from ContextEfficiencyWorker.
 * Analyzes token efficiency patterns + productivity metrics.
 */
export const ContextEfficiencyOutputSchema = z.object({
  // Context usage patterns
  contextUsagePatterns: z.array(ContextUsagePatternSchema),
  inefficiencyPatterns: z.array(InefficiencySchema),
  promptLengthTrends: z.array(PromptLengthTrendSchema),
  redundantInfo: z.array(RedundantInfoSchema),

  // Insights
  topInsights: z.array(z.string()).max(3),
  kptKeep: z.array(z.string()).max(2).optional(),
  kptProblem: z.array(z.string()).max(2).optional(),
  kptTry: z.array(z.string()).max(2).optional(),

  // Overall Scores
  overallEfficiencyScore: z.number().min(0).max(100),
  avgContextFillPercent: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(1),

  // Domain-specific Strengths & Growth Areas
  strengths: z.array(WorkerStrengthSchema).optional(),
  growthAreas: z.array(WorkerGrowthSchema).optional(),
  referencedInsights: z.array(ReferencedInsightSchema).optional(),

  // Productivity metrics (consolidated from ProductivityAnalyst)
  iterationSummaries: z.array(IterationSummarySchema).optional(),
  collaborationEfficiencyScore: z.number().min(0).max(100).optional(),
  overallProductivityScore: z.number().min(0).max(100).optional(),
  productivitySummary: z.string().optional(),
});
export type ContextEfficiencyOutput = z.infer<typeof ContextEfficiencyOutputSchema>;

// ============================================================================
// SessionOutcome Domain Schemas
// ============================================================================

export const GoalCategoryEnum = z.enum([
  'debug_investigate',
  'implement_feature',
  'fix_bug',
  'refactor',
  'write_tests',
  'setup_config',
  'documentation',
  'review_feedback',
  'exploration',
  'quick_question',
  'deploy_infra',
  'dependency_management',
  'performance_optimization',
  'security_audit',
]);
export type GoalCategory = z.infer<typeof GoalCategoryEnum>;

export const SessionTypeEnum = z.enum([
  'single_task',
  'multi_task',
  'iterative_refinement',
  'exploration',
  'quick_question',
]);
export type SessionType = z.infer<typeof SessionTypeEnum>;

export const FrictionTypeEnum = z.enum([
  'misunderstood_request',
  'wrong_approach',
  'buggy_code_generated',
  'user_rejection',
  'blocked_state',
  'tool_failure',
  'context_overflow',
  'hallucination',
  'incomplete_solution',
  'excessive_iterations',
  'permission_error',
  'environment_mismatch',
]);
export type FrictionType = z.infer<typeof FrictionTypeEnum>;

export const OutcomeEnum = z.enum([
  'fully_achieved',
  'mostly_achieved',
  'partially_achieved',
  'not_achieved',
  'unclear',
]);
export type Outcome = z.infer<typeof OutcomeEnum>;

export const SatisfactionEnum = z.enum([
  'frustrated',
  'dissatisfied',
  'neutral',
  'satisfied',
  'happy',
]);
export type Satisfaction = z.infer<typeof SatisfactionEnum>;

export const SessionAnalysisSchema = z.object({
  sessionId: z.string(),
  primaryGoal: GoalCategoryEnum,
  secondaryGoals: z.array(GoalCategoryEnum).max(2).optional(),
  sessionType: SessionTypeEnum,
  outcome: OutcomeEnum,
  satisfaction: SatisfactionEnum,
  frictionTypes: z.array(FrictionTypeEnum).max(3),
  keyMoment: z.string().optional(),
});
export type SessionAnalysis = z.infer<typeof SessionAnalysisSchema>;

export const GoalDistributionItemSchema = z.object({
  goal: GoalCategoryEnum,
  count: z.number().int().min(1),
  successRate: z.number().min(0).max(100),
});
export type GoalDistributionItem = z.infer<typeof GoalDistributionItemSchema>;

export const SessionTypeDistributionItemSchema = z.object({
  type: SessionTypeEnum,
  count: z.number().int().min(1),
  avgOutcomeScore: z.number().min(0).max(100),
});
export type SessionTypeDistributionItem = z.infer<typeof SessionTypeDistributionItemSchema>;

export const FrictionSummaryItemSchema = z.object({
  type: FrictionTypeEnum,
  count: z.number().int().min(1),
  impactLevel: z.enum(['high', 'medium', 'low']),
  commonCause: z.string(),
  recommendation: z.string(),
});
export type FrictionSummaryItem = z.infer<typeof FrictionSummaryItemSchema>;

export const SuccessPatternSchema = z.object({
  pattern: z.string(),
  associatedGoals: z.array(GoalCategoryEnum),
  frequency: z.number().min(0).max(100),
});
export type SuccessPattern = z.infer<typeof SuccessPatternSchema>;

export const FailurePatternSchema = z.object({
  pattern: z.string(),
  associatedFrictions: z.array(FrictionTypeEnum),
  frequency: z.number().min(0).max(100),
});
export type FailurePattern = z.infer<typeof FailurePatternSchema>;

/**
 * Complete output from SessionOutcomeWorker.
 * Analyzes session success patterns, goal achievement, and friction points.
 */
export const SessionOutcomeOutputSchema = z.object({
  // Per-Session Analysis
  sessionAnalyses: z.array(SessionAnalysisSchema),

  // Aggregated Statistics
  overallSuccessRate: z.number().min(0).max(100),
  goalDistribution: z.array(GoalDistributionItemSchema),
  sessionTypeDistribution: z.array(SessionTypeDistributionItemSchema),
  frictionSummary: z.array(FrictionSummaryItemSchema),

  // Pattern Analysis
  successPatterns: z.array(SuccessPatternSchema),
  failurePatterns: z.array(FailurePatternSchema),

  // Overall Scores
  overallOutcomeScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(1),
  summary: z.string().optional(),

  // Domain-specific Strengths & Growth Areas
  strengths: z.array(WorkerStrengthSchema).optional(),
  growthAreas: z.array(WorkerGrowthSchema).optional(),
  referencedInsights: z.array(ReferencedInsightSchema).optional(),
});
export type SessionOutcomeOutput = z.infer<typeof SessionOutcomeOutputSchema>;
