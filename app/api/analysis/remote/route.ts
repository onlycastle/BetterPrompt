/**
 * Streaming Analysis API Route
 *
 * Uses Server-Sent Events (SSE) to stream progress updates
 * and keep the connection alive within Vercel's 10s timeout.
 *
 * The LLM analysis runs in stages, with progress events sent
 * between each major step to prevent timeout.
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { VerboseAnalyzer } from '@/lib/analyzer/verbose-analyzer';
import { aggregateMetrics } from '@/lib/analyzer/type-detector';
import type { ParsedSession } from '@/lib/domain/models/analysis';
import type { VerboseEvaluation } from '@/lib/models/verbose-evaluation';
import {
  JSONLLineSchema,
  type JSONLLine,
  type UserMessage,
  type AssistantMessage,
} from '@/lib/domain/models/analysis';

// Route Segment Config for App Router
// Increase body size limit for large session uploads (default is 4MB)
export const maxDuration = 300; // Allow up to 5 minutes for analysis (Vercel Pro)
export const dynamic = 'force-dynamic';

// Custom body size limit - parse manually for large payloads
const MAX_BODY_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Session data from CLI
 */
interface RemoteSessionData {
  sessionId: string;
  projectName: string;
  messageCount: number;
  durationMinutes: number;
  content: string;
}

/**
 * Analysis request from CLI
 */
interface AnalysisRequest {
  sessions: RemoteSessionData[];
  totalMessages: number;
  totalDurationMinutes: number;
}

/**
 * Analysis result returned to CLI (must match CLI's AnalysisResult interface)
 */
interface AnalysisResponse {
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
 * SSE Event types
 */
type SSEEvent =
  | { type: 'progress'; stage: string; progress: number; message: string }
  | { type: 'result'; data: AnalysisResponse }
  | { type: 'error'; code: string; message: string };

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
 * Parse remote session data into ParsedSession format
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

  // Collect tool results
  const toolResultsMap = new Map<string, { content: string; isError: boolean }>();

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
 * Check if Supabase is configured
 * Uses NEXT_PUBLIC_ prefixed variables for consistency with rest of codebase
 */
function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

/**
 * Get Supabase client
 * Uses NEXT_PUBLIC_ prefixed variables for consistency with rest of codebase
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Store analysis result in Supabase
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
    expiresAt.setDate(expiresAt.getDate() + 30);

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
 * POST /api/analysis/remote
 *
 * Streaming endpoint for CLI analysis.
 * Returns SSE stream with progress updates and final result.
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // Extract user's Gemini API key from header
  const userGeminiApiKey = request.headers.get('X-Gemini-API-Key');

  // Helper to send SSE event
  function formatSSE(event: SSEEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`;
  }

  const stream = new ReadableStream({
    async start(controller) {
      // Validate API key is provided
      if (!userGeminiApiKey) {
        controller.enqueue(encoder.encode(formatSSE({
          type: 'error',
          code: 'NO_API_KEY',
          message: 'Gemini API key is required. Pass --api-key flag or set GOOGLE_GEMINI_API_KEY environment variable.',
        })));
        controller.close();
        return;
      }

      try {
        // Parse request body manually to handle large payloads
        // Next.js App Router's request.json() has a 4MB default limit
        // Supports gzip compression from CLI
        console.log('[remote-analysis] Receiving request body...');
        // Use custom header X-Content-Encoding to bypass Vercel's Content-Encoding interception
        const contentEncoding = request.headers.get('x-content-encoding') || request.headers.get('content-encoding');
        const isGzipped = contentEncoding === 'gzip';
        console.log(`[remote-analysis] Content-Encoding: ${contentEncoding}, isGzipped: ${isGzipped}`);

        let bodyText: string;
        if (isGzipped) {
          // Decompress gzip body
          const compressedBuffer = await request.arrayBuffer();
          console.log(`[remote-analysis] Compressed body received: ${compressedBuffer.byteLength} bytes`);
          const decompressed = gunzipSync(Buffer.from(compressedBuffer));
          bodyText = decompressed.toString('utf-8');
          console.log(`[remote-analysis] Decompressed to: ${bodyText.length} bytes (${(bodyText.length / 1024 / 1024).toFixed(2)} MB)`);
        } else {
          bodyText = await request.text();
          console.log(`[remote-analysis] Body received: ${bodyText.length} bytes (${(bodyText.length / 1024 / 1024).toFixed(2)} MB)`);
        }

        if (bodyText.length > MAX_BODY_SIZE) {
          controller.enqueue(encoder.encode(formatSSE({
            type: 'error',
            code: 'PAYLOAD_TOO_LARGE',
            message: `Request body exceeds ${MAX_BODY_SIZE / 1024 / 1024}MB limit`,
          })));
          controller.close();
          return;
        }

        let body: AnalysisRequest;
        try {
          console.log('[remote-analysis] Parsing JSON...');
          body = JSON.parse(bodyText) as AnalysisRequest;
          console.log(`[remote-analysis] Parsed ${body.sessions?.length || 0} sessions`);
        } catch (parseError) {
          console.error('[remote-analysis] JSON parse error:', parseError);
          controller.enqueue(encoder.encode(formatSSE({
            type: 'error',
            code: 'INVALID_JSON',
            message: parseError instanceof Error ? parseError.message : 'Invalid JSON in request body',
          })));
          controller.close();
          return;
        }

        // Validate request
        if (!body.sessions || !Array.isArray(body.sessions) || body.sessions.length === 0) {
          controller.enqueue(encoder.encode(formatSSE({
            type: 'error',
            code: 'INVALID_REQUEST',
            message: 'At least one session is required',
          })));
          controller.close();
          return;
        }

        // Progress: Starting
        controller.enqueue(encoder.encode(formatSSE({
          type: 'progress',
          stage: 'parsing',
          progress: 10,
          message: `Parsing ${body.sessions.length} session(s)...`,
        })));

        // Parse sessions
        const parsedSessions: ParsedSession[] = [];

        for (let i = 0; i < body.sessions.length; i++) {
          const parsed = parseRemoteSession(body.sessions[i]);
          if (parsed) {
            parsedSessions.push(parsed);
          }

          // Send progress update every few sessions
          if (i % 3 === 0) {
            controller.enqueue(encoder.encode(formatSSE({
              type: 'progress',
              stage: 'parsing',
              progress: 10 + Math.floor((i / body.sessions.length) * 20),
              message: `Parsed ${i + 1}/${body.sessions.length} sessions`,
            })));
          }
        }

        if (parsedSessions.length === 0) {
          controller.enqueue(encoder.encode(formatSSE({
            type: 'error',
            code: 'NO_VALID_SESSIONS',
            message: 'No valid sessions found in request',
          })));
          controller.close();
          return;
        }

        // Progress: Sessions parsed
        controller.enqueue(encoder.encode(formatSSE({
          type: 'progress',
          stage: 'analyzing',
          progress: 30,
          message: `Analyzing ${parsedSessions.length} valid session(s)...`,
        })));

        // Compute metrics
        const metrics = aggregateMetrics(parsedSessions);

        // Progress: Starting LLM analysis
        controller.enqueue(encoder.encode(formatSSE({
          type: 'progress',
          stage: 'analyzing',
          progress: 40,
          message: 'Running AI analysis (Stage 1: Data extraction)...',
        })));

        // Run analysis
        // NOTE: Use 'enterprise' tier to store FULL evaluation in database
        // Tier-based filtering is applied when serving via /api/analysis/results/:resultId
        const analyzer = new VerboseAnalyzer({
          pipeline: { mode: 'two-stage' },
          tier: 'enterprise',
          fallbackToLegacy: false, // Don't fallback to Anthropic - user provides Gemini key
          geminiApiKey: userGeminiApiKey,
        });

        // Send heartbeat before long LLM call
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(formatSSE({
              type: 'progress',
              stage: 'analyzing',
              progress: 50,
              message: 'AI analysis in progress...',
            })));
          } catch {
            // Stream might be closed
            clearInterval(heartbeatInterval);
          }
        }, 5000); // Send heartbeat every 5 seconds

        let evaluation: VerboseEvaluation;
        try {
          console.log('[remote-analysis] Starting analyzeVerbose...');
          evaluation = await analyzer.analyzeVerbose(parsedSessions, metrics, {
            tier: 'enterprise',
          });
          console.log('[remote-analysis] analyzeVerbose completed successfully');
        } catch (analysisError) {
          clearInterval(heartbeatInterval);
          console.error('[remote-analysis] analyzeVerbose failed:', analysisError);
          throw analysisError; // Re-throw to be caught by outer catch
        } finally {
          clearInterval(heartbeatInterval);
        }

        // Progress: Analysis complete
        controller.enqueue(encoder.encode(formatSSE({
          type: 'progress',
          stage: 'storing',
          progress: 90,
          message: 'Storing results...',
        })));

        // Generate result ID and store
        const resultId = generateResultId();
        await storeResult(resultId, evaluation);

        // Progress: Complete
        controller.enqueue(encoder.encode(formatSSE({
          type: 'progress',
          stage: 'complete',
          progress: 100,
          message: 'Analysis complete!',
        })));

        // Send final result (matches CLI's AnalysisResult interface)
        const response: AnalysisResponse = {
          resultId,
          primaryType: evaluation.primaryType,
          controlLevel: evaluation.controlLevel || 'developing',
          distribution: evaluation.distribution,
          personalitySummary: evaluation.personalitySummary,
        };

        controller.enqueue(encoder.encode(formatSSE({
          type: 'result',
          data: response,
        })));

      } catch (error) {
        console.error('Analysis error:', error);
        controller.enqueue(encoder.encode(formatSSE({
          type: 'error',
          code: 'ANALYSIS_FAILED',
          message: error instanceof Error ? error.message : 'Analysis failed',
        })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
