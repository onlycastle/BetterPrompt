/**
 * NoMoreAISlop - Data Models
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
// Unified Report Types (v3.0 - Hyper-Personalized)
// ============================================================================
export {
  // Schemas
  UnifiedReportSchema,
  ProfileSchema,
  DimensionResultSchema,
  DimensionInsightSchema,
  EvidenceQuoteSchema,
  RecommendationSchema,
  ReportSummarySchema,
  PremiumContentSchema,
  // Types
  type UnifiedReport,
  type Profile,
  type DimensionResult,
  type DimensionInsight,
  type DimensionName,
  type DimensionLevel,
  type EvidenceQuote,
  type Recommendation,
  type ReportSummary,
  type PremiumContent,
  type Tier,
  type CodingStyleType as UnifiedCodingStyleType,
  type ControlLevel,
  type InsightType,
  type ConversationInsight,
  type ResearchInsight,
  type LearningResource,
  // Constants
  DIMENSION_DISPLAY_NAMES,
  STRENGTH_THRESHOLD,
  MATRIX_NAMES,
} from './unified-report';

// ============================================================================
// Schema Bridge (Conversion Utilities)
// ============================================================================
export {
  verboseToProfile,
  typeResultToProfile,
  dimensionsToDimensionResults,
  generateSummary,
  extractEvidence,
  toUnifiedReport,
  isDimensionStrength,
  getMatrixInfo,
  type ConversionInput,
} from './schema-bridge';

// ============================================================================
// Metacognition Analysis Types (NEW)
// ============================================================================
export {
  MetacognitionOutputSchema,
  type MetacognitionOutput,
  type AwarenessType,
  type AwarenessInstance,
  type BlindSpot,
  type GrowthMindsetIndicators,
  type MetacognitionAnalysis,
  parseAwarenessInstancesData,
  parseBlindSpotsData,
  parseGrowthMindsetData,
  parseMetacognitionOutput,
  createDefaultMetacognitionOutput,
} from './metacognition-data';

// ============================================================================
// Temporal Analysis Types (REDESIGNED)
// ============================================================================
export {
  // Legacy schemas (deprecated, kept for backward compatibility)
  TemporalAnalysisOutputSchema,
  type TemporalAnalysisOutput,
  type HourlyPattern,
  type PeakHoursInfo,
  type CautionHoursInfo,
  type FatiguePatternType,
  type FatiguePattern,
  type QualitativeInsightType,
  type QualitativeInsight,
  type TemporalAnalysis,
  parseHourlyPatternsData,
  parsePeakHoursData,
  parseCautionHoursData,
  parseFatiguePatternsData,
  parseQualitativeInsightsData,
  parseTemporalAnalysisOutput,
  createDefaultTemporalAnalysisOutput,
  // New schemas (recommended)
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
// Risk Signal Types (NEW)
// ============================================================================
export {
  RiskTypeSchema,
  RiskSignalSchema,
  RiskAnalysisSchema,
  type RiskType,
  type RiskSignal,
  type RiskAnalysis,
  RISK_TYPE_WEIGHTS,
  RISK_TO_KB_MAPPING,
  PATTERN_TO_RISK_TYPE,
  calculateRiskScore,
  calculateRiskByType,
  getKBRecommendations,
  getRiskTypeForPattern,
  createDefaultRiskAnalysis,
  createRiskSignalFromPattern,
} from './risk-signal';

// ============================================================================
// Multitasking Analysis Types (NEW)
// ============================================================================
export {
  MultitaskingAnalysisOutputSchema,
  type MultitaskingAnalysisOutput,
  type WorkType,
  type MultitaskingStrategyType,
  type SessionFocus,
  type ContextPollutionInstance,
  type WorkUnit,
  type StrategyEvaluation,
  type MultitaskingAnalysis,
  parseSessionFocusData,
  parseContextPollutionData,
  parseWorkUnitSeparationData,
  parseStrategyEvaluationData,
  parseMultitaskingAnalysisOutput,
  createDefaultMultitaskingAnalysisOutput,
} from './multitasking-data';

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
  DeveloperUtteranceSchema,
  type DeveloperUtterance,
  AIResponseSchema,
  type AIResponse,
  Phase1SessionMetricsSchema,
  type Phase1SessionMetrics,
  Phase1OutputSchema,
  type Phase1Output,
} from './phase1-output';

// ============================================================================
// Strength & Growth Data Types (NEW - v2 Architecture)
// ============================================================================
export {
  InsightEvidenceSchema,
  type InsightEvidence,
  StrengthInsightSchema,
  type StrengthInsight,
  GrowthSeveritySchema,
  type GrowthSeverity,
  GrowthAreaInsightSchema,
  type GrowthAreaInsight,
  StrengthGrowthOutputSchema,
  type StrengthGrowthOutput,
  StrengthGrowthLLMOutputSchema,
  type StrengthGrowthLLMOutput,
  parseStrengthsLLMData,
  parseGrowthAreasLLMData,
  parseStrengthGrowthLLMOutput,
  createEmptyStrengthGrowthOutput,
} from './strength-growth-data';

// ============================================================================
// Behavior Pattern Data Types (NEW - v2 Architecture)
// ============================================================================
export {
  AntiPatternTypeSchema,
  type AntiPatternType,
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
  ContextPollutionSchema,
  type ContextPollution,
  MultitaskingPatternSchema,
  type MultitaskingPattern,
  BehaviorPatternOutputSchema,
  type BehaviorPatternOutput,
  BehaviorPatternLLMOutputSchema,
  type BehaviorPatternLLMOutput,
  parseAntiPatternsData,
  parsePlanningHabitsData,
  parseCriticalThinkingData,
  parseVerificationBehaviorData,
  parseMultitaskingData,
  parseBehaviorPatternLLMOutput,
  createEmptyBehaviorPatternOutput,
} from './behavior-pattern-data';

// ============================================================================
// New Agent Outputs (v2 Architecture)
// ============================================================================
export {
  TypeClassifierOutputSchema,
  type TypeClassifierOutput,
  NewAgentOutputsSchema,
  type NewAgentOutputs,
  hasAnyNewAgentOutput,
} from './agent-outputs';
