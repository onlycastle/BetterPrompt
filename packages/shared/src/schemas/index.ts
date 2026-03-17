/**
 * Schemas barrel export
 *
 * @module @betterprompt/shared/schemas
 */

// Phase 1
export {
  AIInsightBlockSchema,
  NaturalLanguageSegmentSchema,
  UserUtteranceSchema,
  FrictionSignalsSchema,
  SessionHintsSchema,
  Phase1SessionMetricsSchema,
  ActivitySessionSchema,
  Phase1OutputSchema,
} from './phase1-output.js';
export type {
  AIInsightBlock,
  NaturalLanguageSegment,
  UserUtterance,
  FrictionSignals,
  SessionHints,
  Phase1SessionMetrics,
  ActivitySession,
  Phase1Output,
} from './phase1-output.js';

// Parsed sessions
export {
  ToolCallSchema,
  ParsedMessageSchema,
  SessionStatsSchema,
  SessionSourceTypeSchema,
  ParsedSessionSchema,
} from './session.js';
export type {
  ToolCall,
  ParsedMessage,
  SessionStats,
  SessionSourceType,
  ParsedSession,
} from './session.js';

// Deterministic scoring
export {
  DeterministicScoresSchema,
  CodingStyleTypeSchema,
  AIControlLevelSchema,
  DeterministicTypeResultSchema,
} from './deterministic-scores.js';
export type {
  DeterministicScores,
  CodingStyleType,
  AIControlLevel,
  DeterministicTypeResult,
} from './deterministic-scores.js';

// Domain results
export {
  EvidenceSchema,
  DomainStrengthSchema,
  DomainGrowthAreaSchema,
  DomainResultSchema,
  AnalysisReportSchema,
  DOMAIN_NAMES,
} from './domain-result.js';
export type {
  Evidence,
  DomainStrength,
  DomainGrowthArea,
  DomainResult,
  DomainName,
  AnalysisReport,
} from './domain-result.js';

// Canonical analysis run envelope
export {
  ReportActivitySessionSchema,
  CanonicalStageOutputsSchema,
  CanonicalEvaluationPayloadSchema,
  CanonicalAnalysisRunSchema,
} from './analysis-run.js';
export type {
  ReportActivitySession,
  CanonicalStageOutputs,
  CanonicalEvaluationPayload,
  CanonicalAnalysisRun,
  CanonicalAnalysisRunParts,
} from './analysis-run.js';

// Stage outputs
export {
  SessionSummarySchema,
  SessionSummaryBatchSchema,
  ProjectSummarySchema,
  ProjectSummaryBatchSchema,
  WeeklyInsightsSchema,
  WeeklyProjectBreakdownSchema,
  WeeklyTopSessionSchema,
  TypeClassificationStageOutputSchema,
  EvidenceVerificationResultSchema,
  DomainVerificationStatsSchema,
  EvidenceVerificationOutputSchema,
  TopFocusAreaSchema,
  ContentWriterOutputSchema,
  TranslatorOutputSchema,
  STAGE_NAMES,
  STAGE_SCHEMAS,
} from './stage-outputs.js';
export type {
  SessionSummary,
  SessionSummaryBatch,
  ProjectSummary,
  ProjectSummaryBatch,
  WeeklyInsights,
  WeeklyProjectBreakdown,
  WeeklyTopSession,
  TypeClassificationStageOutput,
  EvidenceVerificationResult,
  DomainVerificationStats,
  EvidenceVerificationOutput,
  TopFocusArea,
  ContentWriterOutput,
  TranslatorOutput,
  StageName,
} from './stage-outputs.js';

// Worker outputs (Phase 2)
export {
  // Shared types
  InsightEvidenceSchema,
  WorkerStrengthSchema,
  WorkerGrowthSeveritySchema,
  WorkerGrowthSchema,
  ReferencedInsightSchema,
  // ThinkingQuality
  ThinkingQualityOutputSchema,
  PlanningHabitSchema,
  CriticalThinkingMomentSchema,
  VerificationBehaviorSchema,
  DetectedAntiPatternSchema,
  MultitaskingPatternSchema,
  // CommunicationPatterns
  CommunicationPatternsOutputSchema,
  CommunicationPatternSchema,
  SignatureQuoteSchema,
  // LearningBehavior
  LearningBehaviorOutputSchema,
  // ContextEfficiency
  ContextEfficiencyOutputSchema,
  // SessionOutcome
  SessionOutcomeOutputSchema,
  SessionAnalysisSchema,
} from './worker-outputs.js';
export type {
  InsightEvidence,
  WorkerStrength,
  WorkerGrowthSeverity,
  WorkerGrowth,
  ReferencedInsight,
  ThinkingQualityOutput,
  PlanningHabit,
  CriticalThinkingMoment,
  VerificationBehavior,
  DetectedAntiPattern,
  MultitaskingPattern,
  CommunicationPatternsOutput,
  CommunicationPattern,
  SignatureQuote,
  LearningBehaviorOutput,
  ContextEfficiencyOutput,
  SessionOutcomeOutput,
  SessionAnalysis,
} from './worker-outputs.js';
