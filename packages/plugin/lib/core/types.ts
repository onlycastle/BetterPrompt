/**
 * Core Types for Plugin-First Architecture
 *
 * Re-exports canonical types from @betterprompt/shared for Phase 1,
 * deterministic scoring, domain results, and constants.
 *
 * Plugin-specific types (JSONL parsing, session metadata) remain here.
 *
 * @module plugin/lib/core/types
 */

import { z } from 'zod';

// ============================================================================
// Re-exports from @betterprompt/shared (canonical source of truth)
// ============================================================================

export type {
  UserUtterance,
  AIInsightBlock,
  FrictionSignals,
  SessionHints,
  Phase1SessionMetrics,
  Phase1Output,
  ReportActivitySession,
  DeterministicScores,
  CodingStyleType,
  AIControlLevel,
  DeterministicTypeResult,
  DomainStrength,
  DomainGrowthArea,
  DomainResult,
  AnalysisReport,
  CanonicalStageOutputs,
  CanonicalEvaluationPayload,
  CanonicalAnalysisRun,
  CanonicalAnalysisRunParts,
} from '@betterprompt/shared/schemas';

export {
  CONTEXT_WINDOW_SIZE,
  MATRIX_NAMES,
  MATRIX_METADATA,
} from '@betterprompt/shared';

// ============================================================================
// Session Types (plugin-specific JSONL parsing)
// ============================================================================

export const TextBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

export const ToolUseBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.record(z.string(), z.unknown()),
});

export const ToolResultBlockSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.union([z.string(), z.array(z.unknown())]),
  is_error: z.boolean().optional(),
});

export const ContentBlockSchema = z.union([
  TextBlockSchema,
  ToolUseBlockSchema,
  ToolResultBlockSchema,
]);

export const TokenUsageSchema = z.object({
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_creation_input_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
  cache_creation: z
    .object({
      ephemeral_5m_input_tokens: z.number(),
      ephemeral_1h_input_tokens: z.number(),
    })
    .optional(),
  service_tier: z.string().optional(),
});

export type SessionSourceType = 'claude-code' | 'cursor' | 'cursor-composer';

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export interface ParsedMessage {
  uuid: string;
  role: 'user' | 'assistant';
  timestamp: string;
  content: string;
  isMeta?: boolean;
  sourceToolUseID?: string;
  toolUseResult?: unknown;
  toolCalls?: ToolCall[];
  tokenUsage?: {
    input: number;
    output: number;
  };
}

export interface SessionStats {
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  uniqueToolsUsed: string[];
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface ParsedSession {
  sessionId: string;
  projectPath: string;
  projectName?: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  claudeCodeVersion: string;
  messages: ParsedMessage[];
  stats: SessionStats;
  source?: SessionSourceType;
}

export const UserMessageSchema = z.object({
  type: z.literal('user'),
  sessionId: z.string(),
  timestamp: z.string(),
  uuid: z.string(),
  parentUuid: z.string().nullable(),
  cwd: z.string().optional(),
  version: z.string().optional(),
  gitBranch: z.string().optional(),
  userType: z.string().optional(),
  isSidechain: z.boolean().optional(),
  message: z.object({
    role: z.literal('user'),
    content: z.union([z.string(), z.array(ContentBlockSchema)]),
  }),
});

export const AssistantMessageSchema = z.object({
  type: z.literal('assistant'),
  sessionId: z.string(),
  timestamp: z.string(),
  uuid: z.string(),
  parentUuid: z.string().nullable(),
  isSidechain: z.boolean().optional(),
  message: z.object({
    id: z.string().optional(),
    role: z.literal('assistant'),
    content: z.array(ContentBlockSchema),
    model: z.string().optional(),
    stop_reason: z.string().optional(),
    usage: TokenUsageSchema.optional(),
  }),
});

/** Supported JSONL line types */
export const JSONLLineSchema = z.discriminatedUnion('type', [
  UserMessageSchema,
  AssistantMessageSchema,
  // Queue operations and file history are parsed but not analyzed
  z.object({ type: z.literal('queue-operation'), timestamp: z.string() }).passthrough(),
  z.object({ type: z.literal('file-history-snapshot'), timestamp: z.string() }).passthrough(),
]);
export type JSONLLine = z.infer<typeof JSONLLineSchema>;

// ============================================================================
// Session Metadata (plugin-specific)
// ============================================================================

export interface SessionMetadata {
  sessionId: string;
  projectPath: string;
  projectName: string;
  timestamp: Date;
  messageCount: number;
  durationSeconds: number;
  filePath: string;
  avgContextUtilization?: number;
  maxContextUtilization?: number;
}
