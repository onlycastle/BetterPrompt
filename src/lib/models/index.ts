/**
 * BetterPrompt - Data Models
 *
 * This module exports all type definitions and Zod schemas
 * used throughout the application.
 */

// ============================================================================
// Evaluation Types (Output)
// ============================================================================
export {
  RatingSchema,
  ClueSchema,
  CategoryEvaluationSchema,
  EvaluationSchema,
  LLMResponseSchema,
  type Rating,
  type Clue,
  type CategoryEvaluation,
  type Evaluation,
  type LLMResponse,
} from './evaluation';

// ============================================================================
// Session Types (Input & Internal)
// ============================================================================
export {
  // Raw JSONL schemas
  TextBlockSchema,
  ToolUseBlockSchema,
  ToolResultBlockSchema,
  ContentBlockSchema,
  TokenUsageSchema,
  UserMessageSchema,
  AssistantMessageSchema,
  QueueOperationSchema,
  FileHistorySnapshotSchema,
  JSONLLineSchema,
  // Raw JSONL types
  type TextBlock,
  type ToolUseBlock,
  type ToolResultBlock,
  type ContentBlock,
  type TokenUsage,
  type UserMessage,
  type AssistantMessage,
  type QueueOperation,
  type FileHistorySnapshot,
  type JSONLLine,
  // Parsed types
  type SessionSourceType,
  type ToolCall,
  type ParsedMessage,
  type SessionStats,
  type ParsedSession,
  type SessionMetadata,
  // Type guards
  isConversationMessage,
  isTextBlock,
  isToolUseBlock,
  isToolResultBlock,
} from './session';

// ============================================================================
// Configuration Types
// ============================================================================
export {
  ConfigSchema,
  DEFAULT_CONFIG,
  ENV_MAPPINGS,
  type Config,
} from './config';

// ============================================================================
// Storage Types
// ============================================================================
export {
  StoredAnalysisSchema,
  type StoredAnalysis,
  type AnalysisSummary,
} from './storage';

// ============================================================================
// Telemetry Types
// ============================================================================
export {
  TelemetryEventTypeSchema,
  TelemetryEventSchema,
  type TelemetryEventType,
  type TelemetryEvent,
  type AnalysisCompletedProperties,
  type AnalysisFailedProperties,
} from './telemetry';

// ============================================================================
// AI Coding Style Types (v2.0)
// ============================================================================
export {
  CodingStyleTypeSchema,
  TypeResultSchema,
  TYPE_METADATA,
  PATTERN_KEYWORDS,
  type CodingStyleType,
  type SessionMetrics,
  type TypeScores,
  type TypeDistribution,
  type ConversationEvidence,
  type TypeResult,
} from './coding-style';

// ============================================================================
// Temporal Analysis Types
// ============================================================================
export {
  type HourlyPattern,
  type PeakHoursInfo,
  type CautionHoursInfo,
  type FatiguePatternType,
  type FatiguePattern,
  type QualitativeInsightType,
  type QualitativeInsight,
  type TemporalAnalysis,
  TemporalAnalysisResultSchema,
  type TemporalAnalysisResult,
  TemporalInsightsOutputSchema,
  type TemporalInsightsOutput,
  parseTemporalStrengthsData,
  parseTemporalGrowthAreasData,
  createDefaultTemporalInsightsOutput,
} from './temporal-data';

// ============================================================================
// Temporal Metrics Types (NEW - 100% Deterministic)
// ============================================================================
export {
  TemporalMetricsSchema,
  type TemporalMetrics,
  type ActivityHeatmap,
  type SessionPatterns,
  type HourlySessionStats,
  type EngagementSignals,
  type HourlyEngagement,
  ActivityHeatmapSchema,
  SessionPatternsSchema,
  HourlySessionStatsSchema,
  EngagementSignalsSchema,
  HourlyEngagementSchema,
  createEmptyTemporalMetrics,
} from './temporal-metrics';

// ============================================================================
// Dimension Schema (Extracted to break circular dependencies)
// ============================================================================
export {
  DimensionNameEnumSchema,
  DIMENSION_NAMES,
  type DimensionNameEnum,
  type DimensionName as DimensionNameType,
} from './dimension-schema';

// ============================================================================
// Phase 1 Output Types (NEW - v2 Architecture)
// ============================================================================
export {
  UserUtteranceSchema,
  type UserUtterance,
  // Backward compatibility aliases
  DeveloperUtteranceSchema,
  type DeveloperUtterance,
  Phase1SessionMetricsSchema,
  type Phase1SessionMetrics,
  Phase1OutputSchema,
  type Phase1Output,
} from './phase1-output';

// ============================================================================
// v3 Agent Outputs
// ============================================================================
export {
  TypeClassifierOutputSchema,
  type TypeClassifierOutput,
  AgentOutputsSchema,
  type AgentOutputs,
  hasAnyAgentOutput,
} from './agent-outputs';

// ============================================================================
// v3 Thinking Quality Types
// ============================================================================
export {
  ThinkingQualityOutputSchema,
  type ThinkingQualityOutput,
  ThinkingQualityLLMOutputSchema,
  type ThinkingQualityLLMOutput,
  parseThinkingQualityLLMOutput,
  createEmptyThinkingQualityOutput,
  // Re-export types that were moved from behavior-pattern-data
  PatternSeveritySchema,
  type PatternSeverity,
  DetectedAntiPatternSchema,
  type DetectedAntiPattern,
  PlanningHabitTypeSchema,
  type PlanningHabitType,
  HabitFrequencySchema,
  type HabitFrequency,
  PlanningHabitSchema,
  type PlanningHabit,
  CriticalThinkingTypeSchema,
  type CriticalThinkingType,
  CriticalThinkingMomentSchema,
  type CriticalThinkingMoment,
  VerificationLevelSchema,
  type VerificationLevel,
  VerificationBehaviorSchema,
  type VerificationBehavior,
  MultitaskingPatternSchema,
  type MultitaskingPattern,
} from './thinking-quality-data';

// ============================================================================
// v3 Learning Behavior Types
// ============================================================================
export {
  LearningBehaviorOutputSchema,
  type LearningBehaviorOutput,
  LearningBehaviorLLMOutputSchema,
  type LearningBehaviorLLMOutput,
  parseLearningBehaviorLLMOutput,
  createEmptyLearningBehaviorOutput,
} from './learning-behavior-data';

