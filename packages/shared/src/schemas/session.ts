/**
 * Parsed Session Schemas
 *
 * Canonical schemas for fully parsed session transcripts used by the plugin's
 * Phase 1 artifact. These preserve the full transcript surface needed for
 * evidence lookup, activity rendering, and multi-source parity.
 *
 * @module @betterprompt/shared/schemas/session
 */

import { z } from 'zod';

export const ToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  input: z.record(z.string(), z.unknown()),
  result: z.string().optional(),
  isError: z.boolean().optional(),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

export const ParsedMessageSchema = z.object({
  uuid: z.string(),
  role: z.enum(['user', 'assistant']),
  timestamp: z.string(),
  content: z.string(),
  isMeta: z.boolean().optional(),
  sourceToolUseID: z.string().optional(),
  toolUseResult: z.unknown().optional(),
  toolCalls: z.array(ToolCallSchema).optional(),
  tokenUsage: z.object({
    input: z.number().int().min(0),
    output: z.number().int().min(0),
  }).optional(),
});
export type ParsedMessage = z.infer<typeof ParsedMessageSchema>;

export const SessionStatsSchema = z.object({
  userMessageCount: z.number().int().min(0),
  assistantMessageCount: z.number().int().min(0),
  toolCallCount: z.number().int().min(0),
  uniqueToolsUsed: z.array(z.string()),
  totalInputTokens: z.number().int().min(0),
  totalOutputTokens: z.number().int().min(0),
});
export type SessionStats = z.infer<typeof SessionStatsSchema>;

export const SessionSourceTypeSchema = z.enum([
  'claude-code',
  'cursor',
  'cursor-composer',
]);
export type SessionSourceType = z.infer<typeof SessionSourceTypeSchema>;

export const ParsedSessionSchema = z.object({
  sessionId: z.string(),
  projectPath: z.string(),
  projectName: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  durationSeconds: z.number().min(0),
  claudeCodeVersion: z.string(),
  messages: z.array(ParsedMessageSchema),
  stats: SessionStatsSchema,
  source: SessionSourceTypeSchema.optional(),
});
export type ParsedSession = z.infer<typeof ParsedSessionSchema>;
