import { z } from 'zod';

// ============================================================================
// JSONL Input Types - Raw Claude Code session log format
// ============================================================================

/**
 * Content block types in Claude messages
 */
export const TextBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});
export type TextBlock = z.infer<typeof TextBlockSchema>;

export const ToolUseBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.record(z.unknown()),
});
export type ToolUseBlock = z.infer<typeof ToolUseBlockSchema>;

export const ToolResultBlockSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.union([z.string(), z.array(z.unknown())]),
  is_error: z.boolean().optional(),
});
export type ToolResultBlock = z.infer<typeof ToolResultBlockSchema>;

export const ContentBlockSchema = z.union([
  TextBlockSchema,
  ToolUseBlockSchema,
  ToolResultBlockSchema,
]);
export type ContentBlock = z.infer<typeof ContentBlockSchema>;

/**
 * Token usage schema
 */
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
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

/**
 * User message from JSONL
 */
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
export type UserMessage = z.infer<typeof UserMessageSchema>;

/**
 * Assistant message from JSONL
 */
export const AssistantMessageSchema = z.object({
  type: z.literal('assistant'),
  sessionId: z.string(),
  timestamp: z.string(),
  uuid: z.string(),
  parentUuid: z.string().nullable(),
  cwd: z.string().optional(),
  version: z.string().optional(),
  gitBranch: z.string().optional(),
  userType: z.string().optional(),
  isSidechain: z.boolean().optional(),
  requestId: z.string().optional(),
  message: z.object({
    model: z.string().optional(),
    id: z.string().optional(),
    type: z.literal('message').optional(),
    role: z.literal('assistant'),
    content: z.array(ContentBlockSchema),
    stop_reason: z.string().nullable().optional(),
    stop_sequence: z.string().nullable().optional(),
    usage: TokenUsageSchema.optional(),
  }),
});
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>;

/**
 * Queue operation from JSONL (internal, usually skipped)
 */
export const QueueOperationSchema = z.object({
  type: z.literal('queue-operation'),
  operation: z.enum(['dequeue', 'enqueue']),
  timestamp: z.string(),
  sessionId: z.string(),
});
export type QueueOperation = z.infer<typeof QueueOperationSchema>;

/**
 * File history snapshot from JSONL (internal, usually skipped)
 */
export const FileHistorySnapshotSchema = z.object({
  type: z.literal('file-history-snapshot'),
  messageId: z.string(),
  isSnapshotUpdate: z.boolean(),
  snapshot: z.object({
    messageId: z.string(),
    trackedFileBackups: z.record(z.unknown()),
    timestamp: z.string(),
  }),
});
export type FileHistorySnapshot = z.infer<typeof FileHistorySnapshotSchema>;

/**
 * Union of all JSONL line types
 */
export const JSONLLineSchema = z.union([
  UserMessageSchema,
  AssistantMessageSchema,
  QueueOperationSchema,
  FileHistorySnapshotSchema,
]);
export type JSONLLine = z.infer<typeof JSONLLineSchema>;

// ============================================================================
// Parsed Session Types - Internal representation after parsing
// ============================================================================

/**
 * Tool call representation (simplified from raw format)
 */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

/**
 * Parsed message - simplified for analysis
 */
export interface ParsedMessage {
  uuid: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  content: string; // Flattened text content
  toolCalls?: ToolCall[];
  tokenUsage?: {
    input: number;
    output: number;
  };
}

/**
 * Session statistics
 */
export interface SessionStats {
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  uniqueToolsUsed: string[];
  totalInputTokens: number;
  totalOutputTokens: number;
}

/**
 * Fully parsed session ready for analysis
 */
export interface ParsedSession {
  sessionId: string;
  projectPath: string;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  claudeCodeVersion: string;
  messages: ParsedMessage[];
  stats: SessionStats;
}

/**
 * Lightweight session metadata for listing
 */
export interface SessionMetadata {
  sessionId: string;
  projectPath: string;
  projectName: string; // Last segment of path
  timestamp: Date;
  messageCount: number;
  durationSeconds: number;
  filePath: string; // Full path to JSONL file
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a parsed JSONL line is a user or assistant message
 */
export function isConversationMessage(
  line: JSONLLine
): line is UserMessage | AssistantMessage {
  return line.type === 'user' || line.type === 'assistant';
}

/**
 * Check if content is a text block
 */
export function isTextBlock(block: ContentBlock): block is TextBlock {
  return block.type === 'text';
}

/**
 * Check if content is a tool use block
 */
export function isToolUseBlock(block: ContentBlock): block is ToolUseBlock {
  return block.type === 'tool_use';
}

/**
 * Check if content is a tool result block
 */
export function isToolResultBlock(
  block: ContentBlock
): block is ToolResultBlock {
  return block.type === 'tool_result';
}
