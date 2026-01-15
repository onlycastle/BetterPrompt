/**
 * Remote Analysis Service
 *
 * Handles analysis requests from the CLI.
 * Parses JSONL content, runs analysis, and stores results.
 */

import { createClient } from '@supabase/supabase-js';
import * as crypto from 'node:crypto';
import { VerboseAnalyzer } from '../../analyzer/verbose-analyzer.js';
import { aggregateMetrics } from '../../analyzer/type-detector.js';
import type { ParsedSession } from '../../domain/models/analysis.js';
import type { VerboseEvaluation } from '../../models/verbose-evaluation.js';
import {
  JSONLLineSchema,
  type JSONLLine,
  type UserMessage,
  type AssistantMessage,
} from '../../domain/models/analysis.js';

/**
 * Session data from CLI
 */
export interface RemoteSessionData {
  sessionId: string;
  projectName: string;
  messageCount: number;
  durationMinutes: number;
  content: string; // Raw JSONL content
}

/**
 * Analysis request from CLI
 */
export interface AnalysisRequest {
  sessions: RemoteSessionData[];
  totalMessages: number;
  totalDurationMinutes: number;
}

/**
 * Analysis result returned to CLI
 */
export interface AnalysisResponse {
  resultId: string;
  primaryType: string;
  controlLevel: string;
  distribution: {
    architect: number;
    scientist: number;
    collaborator: number;
    speedrunner: number;
    craftsman: number;
  };
  personalitySummary: string;
}

/**
 * Generate a short result ID for URLs
 */
function generateResultId(): string {
  return crypto.randomBytes(6).toString('base64url');
}

/**
 * Parse JSONL content into structured lines
 */
function parseJSONLContent(content: string): JSONLLine[] {
  const lines: JSONLLine[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed);
      const result = JSONLLineSchema.safeParse(parsed);
      if (result.success) {
        lines.push(result.data);
      }
    } catch {
      // Skip invalid lines
    }
  }

  return lines;
}

/**
 * Check if a JSONL line is a conversation message
 */
function isConversationMessage(line: JSONLLine): line is UserMessage | AssistantMessage {
  return line.type === 'user' || line.type === 'assistant';
}

/**
 * Parse remote session data into ParsedSession format
 * Simplified version of SessionParser for remote analysis
 */
function parseRemoteSession(data: RemoteSessionData): ParsedSession | null {
  const lines = parseJSONLContent(data.content);
  const messages = lines.filter(isConversationMessage);

  if (messages.length === 0) return null;

  // Parse timestamps
  const timestamps = messages.map(m => new Date(m.timestamp));
  const startTime = new Date(Math.min(...timestamps.map(t => t.getTime())));
  const endTime = new Date(Math.max(...timestamps.map(t => t.getTime())));
  const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

  // Get version from first message
  const firstMessage = messages[0];
  const claudeCodeVersion = firstMessage.version || 'unknown';

  // Parse messages using inline logic (simplified)
  const toolResultsMap = new Map<string, { content: string; isError: boolean }>();

  // Collect tool results
  for (const msg of messages) {
    if (msg.type === 'user') {
      const content = msg.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_result') {
            const resultContent = typeof block.content === 'string'
              ? block.content
              : JSON.stringify(block.content);
            toolResultsMap.set(block.tool_use_id, {
              content: resultContent,
              isError: block.is_error ?? false,
            });
          }
        }
      }
    }
  }

  // Parse messages
  const parsedMessages: ParsedSession['messages'] = [];

  for (const msg of messages) {
    if (msg.type === 'user') {
      const content = extractTextContent(msg.message.content);
      if (!content.trim()) continue;

      parsedMessages.push({
        uuid: msg.uuid,
        role: 'user',
        timestamp: new Date(msg.timestamp),
        content,
      });
    } else {
      const content = extractTextContent(msg.message.content);
      const toolCalls = extractToolCalls(msg.message.content, toolResultsMap);

      parsedMessages.push({
        uuid: msg.uuid,
        role: 'assistant',
        timestamp: new Date(msg.timestamp),
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        tokenUsage: msg.message.usage ? {
          input: msg.message.usage.input_tokens,
          output: msg.message.usage.output_tokens,
        } : undefined,
      });
    }
  }

  // Compute stats from parsed messages
  const stats = computeMessageStats(parsedMessages);

  return {
    sessionId: data.sessionId,
    projectPath: `/remote/${data.projectName}`,
    startTime,
    endTime,
    durationSeconds,
    claudeCodeVersion,
    messages: parsedMessages,
    stats,
  };
}

/**
 * Compute session statistics from parsed messages
 */
function computeMessageStats(messages: ParsedSession['messages']): ParsedSession['stats'] {
  let userMessageCount = 0;
  let assistantMessageCount = 0;
  let toolCallCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const toolsUsed = new Set<string>();

  for (const msg of messages) {
    if (msg.role === 'user') {
      userMessageCount++;
      continue;
    }

    assistantMessageCount++;

    if (msg.toolCalls) {
      toolCallCount += msg.toolCalls.length;
      for (const tool of msg.toolCalls) {
        toolsUsed.add(tool.name);
      }
    }

    if (msg.tokenUsage) {
      totalInputTokens += msg.tokenUsage.input;
      totalOutputTokens += msg.tokenUsage.output;
    }
  }

  return {
    userMessageCount,
    assistantMessageCount,
    toolCallCount,
    uniqueToolsUsed: Array.from(toolsUsed).sort(),
    totalInputTokens,
    totalOutputTokens,
  };
}

/**
 * Extract text content from content blocks
 */
function extractTextContent(content: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === 'string') return content;

  const textParts: string[] = [];
  for (const block of content) {
    if (block.type === 'text' && block.text) {
      textParts.push(block.text);
    }
  }
  return textParts.join('\n');
}

/**
 * Extract tool calls from content blocks
 */
function extractToolCalls(
  content: Array<{ type: string; id?: string; name?: string; input?: Record<string, unknown> }>,
  toolResultsMap: Map<string, { content: string; isError: boolean }>
): Array<{ id: string; name: string; input: Record<string, unknown>; result?: string; isError?: boolean }> {
  const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown>; result?: string; isError?: boolean }> = [];

  for (const block of content) {
    if (block.type === 'tool_use' && block.id && block.name) {
      const result = toolResultsMap.get(block.id);
      toolCalls.push({
        id: block.id,
        name: block.name,
        input: block.input || {},
        result: result?.content,
        isError: result?.isError,
      });
    }
  }

  return toolCalls;
}

/**
 * Check if Supabase is configured
 */
function isSupabaseConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY));
}

/**
 * Initialize Supabase client
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Store analysis result in Supabase
 * Returns false if storage failed or was skipped
 */
async function storeResult(
  resultId: string,
  evaluation: VerboseEvaluation
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, skipping result storage');
    return false;
  }

  try {
    const supabase = getSupabaseClient();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiration

    const { error } = await supabase.from('analysis_results').insert({
      result_id: resultId,
      evaluation,
      is_paid: false,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      console.error('Failed to store result:', error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to store result:', error);
    return false;
  }
}

/**
 * Run analysis on remote session data
 */
export async function analyzeRemoteSessions(
  request: AnalysisRequest
): Promise<AnalysisResponse> {
  // Parse sessions
  const parsedSessions: ParsedSession[] = [];

  for (const sessionData of request.sessions) {
    const parsed = parseRemoteSession(sessionData);
    if (parsed) {
      parsedSessions.push(parsed);
    }
  }

  if (parsedSessions.length === 0) {
    throw new Error('No valid sessions found in request');
  }

  // Compute metrics
  const metrics = aggregateMetrics(parsedSessions);

  // Run analysis
  const analyzer = new VerboseAnalyzer({
    pipeline: { mode: 'two-stage' },
    tier: 'free', // Free tier for CLI users
    fallbackToLegacy: true,
  });

  const evaluation = await analyzer.analyzeVerbose(parsedSessions, metrics, {
    tier: 'free',
  });

  // Generate result ID and try to store (non-blocking)
  const resultId = generateResultId();
  const stored = await storeResult(resultId, evaluation);

  // Return response for CLI
  return {
    resultId,
    primaryType: evaluation.primaryType,
    controlLevel: evaluation.controlLevel || 'developing',
    distribution: evaluation.distribution,
    personalitySummary: evaluation.personalitySummary,
    // Include storage status for debugging (optional)
    ...(stored ? {} : { warning: 'Result not stored - Supabase not configured' }),
  };
}

/**
 * Load analysis result from Supabase
 */
export async function loadRemoteResult(
  resultId: string
): Promise<{ evaluation: VerboseEvaluation; isPaid: boolean } | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('analysis_results')
    .select('evaluation, is_paid')
    .eq('result_id', resultId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    evaluation: data.evaluation as VerboseEvaluation,
    isPaid: data.is_paid,
  };
}
