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
