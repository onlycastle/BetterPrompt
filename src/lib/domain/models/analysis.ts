/**
 * Analysis Domain Models
 *
 * Re-exports shared types from canonical sources (session.ts, coding-style.ts)
 * and defines analysis-specific types (Evaluation, StoredAnalysis, Dimensions).
 *
 * Consumers can import from this module without changing their import paths.
 *
 * @module domain/models/analysis
 */

import { z } from 'zod';
import { TypeResultSchema as _TypeResultSchema } from '../../models/coding-style';

// ============================================================================
// Re-exports from session.ts (canonical source for JSONL & parsed types)
// ============================================================================

export {
  // JSONL schemas
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
  // JSONL types
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
} from '../../models/session';

// ============================================================================
// Re-exports from coding-style.ts (canonical source for style types)
// ============================================================================

export {
  // Schemas
  CodingStyleTypeSchema,
  AIControlLevelSchema,
  TypeResultSchema,
  // Types
  type CodingStyleType,
  type AIControlLevel,
  type SessionMetrics,
  type TypeScores,
  type TypeDistribution,
  type ConversationEvidence,
  type TypeResult,
  type CodingStyleMatrix,
  // Constants
  TYPE_METADATA,
  PATTERN_KEYWORDS,
  MATRIX_NAMES,
  MATRIX_METADATA,
  CONTROL_LEVEL_METADATA,
  // Functions
  getMatrixResult,
} from '../../models/coding-style';

// ============================================================================
// Evaluation Types - LLM Analysis Output (analysis-specific)
// ============================================================================

/**
 * Rating schema - qualitative assessment of collaboration skills
 * Using growth-focused language
 */
export const RatingSchema = z.enum(['Strong', 'Developing', 'Needs Work']);
export type Rating = z.infer<typeof RatingSchema>;

/**
 * Clue (evidence) schema - specific quotes from the conversation
 * that support the rating
 */
export const ClueSchema = z.object({
  type: z.enum(['positive', 'negative']),
  quote: z
    .string()
    .min(10)
    .max(500)
    .describe('Direct quote from the conversation'),
  explanation: z
    .string()
    .min(10)
    .max(3000)
    .describe('Why this quote is evidence for the rating'),
});
export type Clue = z.infer<typeof ClueSchema>;

/**
 * Category evaluation schema - assessment for a single category
 * (Planning, Critical Thinking, or Code Understanding)
 */
export const CategoryEvaluationSchema = z.object({
  rating: RatingSchema,
  summary: z
    .string()
    .min(50)
    .max(500)
    .describe('2-3 sentence summary of performance in this category'),
  clues: z
    .array(ClueSchema)
    .min(1)
    .max(5)
    .describe('1-5 specific evidence items'),
});
export type CategoryEvaluation = z.infer<typeof CategoryEvaluationSchema>;

/**
 * Full evaluation schema - complete assessment of a session
 * This is the primary output from the LLM analyzer
 */
export const EvaluationSchema = z.object({
  sessionId: z.string().uuid(),
  analyzedAt: z.string().datetime(),

  planning: CategoryEvaluationSchema,
  criticalThinking: CategoryEvaluationSchema,
  codeUnderstanding: CategoryEvaluationSchema,

  overallSummary: z
    .string()
    .min(100)
    .max(1000)
    .describe("Overall assessment of the developer's AI collaboration style"),

  recommendations: z
    .array(z.string().min(20).max(3000))
    .min(1)
    .max(5)
    .describe('Specific, actionable recommendations for improvement'),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

/**
 * Schema for LLM response parsing - excludes metadata fields
 * that are added after the LLM call
 */
export const LLMResponseSchema = z.object({
  planning: CategoryEvaluationSchema,
  criticalThinking: CategoryEvaluationSchema,
  codeUnderstanding: CategoryEvaluationSchema,
  overallSummary: z.string().min(100).max(1000),
  recommendations: z.array(z.string().min(20).max(3000)).min(1).max(5),
});
export type LLMResponse = z.infer<typeof LLMResponseSchema>;

// ============================================================================
// Analysis Dimensions - Numeric scores (0-100)
// Used by StoredAnalysis and sharing module for persisted evaluations.
// Note: report.ts uses a separate 4-level DimensionLevel ('novice' | 'developing' | 'proficient' | 'expert')
// for the frontend display. These 3-level schemas are for the stored analysis format.
// ============================================================================

/**
 * Dimension level based on score (stored analysis format)
 */
export const DimensionLevelSchema = z.enum([
  'needs-work', // 0-39
  'developing', // 40-69
  'strong', // 70-100
]);
export type DimensionLevel = z.infer<typeof DimensionLevelSchema>;

/**
 * Single dimension result
 */
export const DimensionResultSchema = z.object({
  score: z.number().min(0).max(100),
  level: DimensionLevelSchema,
  reasoning: z.string().max(500),
});
export type DimensionResult = z.infer<typeof DimensionResultSchema>;

/**
 * All analysis dimensions
 */
export const DimensionsSchema = z.object({
  aiCollaboration: DimensionResultSchema,
  promptEngineering: DimensionResultSchema,
  burnoutRisk: DimensionResultSchema,
  toolMastery: DimensionResultSchema,
  aiControl: DimensionResultSchema,
  skillResilience: DimensionResultSchema,
});
export type Dimensions = z.infer<typeof DimensionsSchema>;

// ============================================================================
// Stored Analysis - Persisted evaluation with metadata
// ============================================================================

/**
 * Stored analysis schema - persisted evaluation with metadata
 */
export const StoredAnalysisSchema = z.object({
  version: z.literal('1.0.0'),
  createdAt: z.string().datetime(),

  evaluation: EvaluationSchema,

  metadata: z.object({
    projectPath: z.string(),
    projectName: z.string(),
    durationSeconds: z.number(),
    messageCount: z.number(),
    toolCallCount: z.number(),
    claudeCodeVersion: z.string(),
  }),

  // Optional extended analysis (v2.0+)
  typeResult: _TypeResultSchema.optional(),
  dimensions: DimensionsSchema.optional(),
});
export type StoredAnalysis = z.infer<typeof StoredAnalysisSchema>;

/**
 * Analysis summary for listing - lightweight representation
 */
export interface AnalysisSummary {
  sessionId: string;
  projectName: string;
  analyzedAt: Date;
  ratings: {
    planning: string;
    criticalThinking: string;
    codeUnderstanding: string;
  };
  filePath: string;
}
