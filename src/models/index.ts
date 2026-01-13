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
} from './evaluation.js';

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
} from './session.js';

// ============================================================================
// Configuration Types
// ============================================================================
export {
  ConfigSchema,
  DEFAULT_CONFIG,
  ENV_MAPPINGS,
  type Config,
} from './config.js';

// ============================================================================
// Storage Types
// ============================================================================
export {
  StoredAnalysisSchema,
  type StoredAnalysis,
  type AnalysisSummary,
} from './storage.js';

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
} from './telemetry.js';

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
} from './coding-style.js';

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
} from './unified-report.js';

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
} from './schema-bridge.js';
