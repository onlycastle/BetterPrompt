/**
 * Lambda Analysis Handler
 *
 * AWS Lambda version of /api/analysis/remote with:
 * - Lambda Response Streaming for SSE
 * - 10MB payload support
 * - 15 minute timeout
 */

import { Writable } from "node:stream";
import { gunzipSync } from "node:zlib";
import * as crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Import shared libs (bundled by SST)
import { VerboseAnalyzer } from "../src/lib/analyzer/verbose-analyzer";
import { aggregateMetrics } from "../src/lib/analyzer/type-detector";
import type { ParsedSession } from "../src/lib/domain/models/analysis";
import type { VerboseEvaluation } from "../src/lib/models/verbose-evaluation";
import {
  JSONLLineSchema,
  type JSONLLine,
  type UserMessage,
  type AssistantMessage,
} from "../src/lib/domain/models/analysis";

// Maximum body size - 50MB (Lambda supports up to 6MB sync, but streaming allows more)
const MAX_BODY_SIZE = 50 * 1024 * 1024;

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
 * Analysis result returned to CLI
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
  | { type: "progress"; stage: string; progress: number; message: string }
  | { type: "result"; data: AnalysisResponse }
  | { type: "error"; code: string; message: string };

/**
 * Check if buffer starts with gzip magic bytes
 */
function isGzipBuffer(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

/**
 * Generate a short result ID for URLs
 */
function generateResultId(): string {
  return crypto.randomBytes(6).toString("base64url");
}

/**
 * Parse JSONL content into structured lines
 */
function parseJSONLContent(content: string): JSONLLine[] {
  const lines: JSONLLine[] = [];

  for (const line of content.split("\n")) {
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
function isConversationMessage(
  line: JSONLLine
): line is UserMessage | AssistantMessage {
  return line.type === "user" || line.type === "assistant";
}

/**
 * Extract text content from content blocks
 */
function extractTextContent(
  content: string | Array<{ type: string; text?: string }>
): string {
  if (typeof content === "string") return content;

  const textParts: string[] = [];
  for (const block of content) {
    if (block.type === "text" && block.text) {
      textParts.push(block.text);
    }
  }
  return textParts.join("\n");
}

/**
 * Extract tool calls from content blocks
 */
function extractToolCalls(
  content: Array<{
    type: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>,
  toolResultsMap: Map<string, { content: string; isError: boolean }>
): Array<{
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}> {
  const toolCalls: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
    result?: string;
    isError?: boolean;
  }> = [];

  for (const block of content) {
    if (block.type === "tool_use" && block.id && block.name) {
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
function computeMessageStats(
  messages: ParsedSession["messages"]
): ParsedSession["stats"] {
  let userMessageCount = 0;
  let assistantMessageCount = 0;
  let toolCallCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const toolsUsed = new Set<string>();

  for (const msg of messages) {
    if (msg.role === "user") {
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
  const timestamps = messages.map((m) => new Date(m.timestamp));
  const startTime = new Date(Math.min(...timestamps.map((t) => t.getTime())));
  const endTime = new Date(Math.max(...timestamps.map((t) => t.getTime())));
  const durationSeconds = Math.floor(
    (endTime.getTime() - startTime.getTime()) / 1000
  );

  // Get version from first message
  const firstMessage = messages[0];
  const claudeCodeVersion = firstMessage.version || "unknown";

  // Collect tool results
  const toolResultsMap = new Map<string, { content: string; isError: boolean }>();

  for (const msg of messages) {
    if (msg.type === "user") {
      const content = msg.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "tool_result") {
            const resultContent =
              typeof block.content === "string"
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
  const parsedMessages: ParsedSession["messages"] = [];

  for (const msg of messages) {
    if (msg.type === "user") {
      const content = extractTextContent(msg.message.content);
      if (!content.trim()) continue;

      parsedMessages.push({
        uuid: msg.uuid,
        role: "user",
        timestamp: new Date(msg.timestamp),
        content,
      });
    } else {
      const content = extractTextContent(msg.message.content);
      const toolCalls = extractToolCalls(msg.message.content, toolResultsMap);

      parsedMessages.push({
        uuid: msg.uuid,
        role: "assistant",
        timestamp: new Date(msg.timestamp),
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        tokenUsage: msg.message.usage
          ? {
              input: msg.message.usage.input_tokens,
              output: msg.message.usage.output_tokens,
            }
          : undefined,
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
 */
function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Get Supabase client
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase configuration missing");
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
    console.warn("Supabase not configured, skipping result storage");
    return false;
  }

  try {
    const supabase = getSupabaseClient();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error } = await supabase.from("analysis_results").insert({
      result_id: resultId,
      evaluation,
      is_paid: false,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      console.error("Failed to store result:", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to store result:", error);
    return false;
  }
}

/**
 * Format SSE event
 */
function formatSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Lambda handler with Response Streaming
 */
export const handler = awslambda.streamifyResponse(
  async (
    event: {
      headers: Record<string, string>;
      body: string;
      isBase64Encoded: boolean;
    },
    responseStream: Writable
  ) => {
    // Set SSE headers via metadata
    const metadata = {
      statusCode: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    };

    // Wrap stream with metadata
    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

    const write = (event: SSEEvent) => {
      responseStream.write(formatSSE(event));
    };

    try {
      // Get API key from header
      const userGeminiApiKey =
        event.headers["x-gemini-api-key"] ||
        event.headers["X-Gemini-API-Key"];

      if (!userGeminiApiKey) {
        write({
          type: "error",
          code: "NO_API_KEY",
          message:
            "Gemini API key is required. Pass --api-key flag or set GOOGLE_GEMINI_API_KEY environment variable.",
        });
        responseStream.end();
        return;
      }

      // Decode body
      let rawBuffer: Buffer;
      if (event.isBase64Encoded) {
        rawBuffer = Buffer.from(event.body, "base64");
      } else {
        rawBuffer = Buffer.from(event.body, "utf-8");
      }

      console.log(`[lambda-analysis] Raw body received: ${rawBuffer.length} bytes`);

      // Check for gzip
      const hasGzipMagicBytes = isGzipBuffer(rawBuffer);
      console.log(`[lambda-analysis] Gzip detected: ${hasGzipMagicBytes}`);

      let bodyText: string;
      if (hasGzipMagicBytes) {
        const decompressed = gunzipSync(rawBuffer);
        bodyText = decompressed.toString("utf-8");
        console.log(
          `[lambda-analysis] Decompressed: ${rawBuffer.length} -> ${bodyText.length} bytes`
        );
      } else {
        bodyText = rawBuffer.toString("utf-8");
      }

      if (bodyText.length > MAX_BODY_SIZE) {
        write({
          type: "error",
          code: "PAYLOAD_TOO_LARGE",
          message: `Request body exceeds ${MAX_BODY_SIZE / 1024 / 1024}MB limit`,
        });
        responseStream.end();
        return;
      }

      // Parse JSON
      let body: AnalysisRequest;
      try {
        body = JSON.parse(bodyText) as AnalysisRequest;
        console.log(`[lambda-analysis] Parsed ${body.sessions?.length || 0} sessions`);
      } catch (parseError) {
        write({
          type: "error",
          code: "INVALID_JSON",
          message:
            parseError instanceof Error
              ? parseError.message
              : "Invalid JSON in request body",
        });
        responseStream.end();
        return;
      }

      // Validate request
      if (
        !body.sessions ||
        !Array.isArray(body.sessions) ||
        body.sessions.length === 0
      ) {
        write({
          type: "error",
          code: "INVALID_REQUEST",
          message: "At least one session is required",
        });
        responseStream.end();
        return;
      }

      // Progress: Starting
      write({
        type: "progress",
        stage: "parsing",
        progress: 10,
        message: `Parsing ${body.sessions.length} session(s)...`,
      });

      // Parse sessions
      const parsedSessions: ParsedSession[] = [];

      for (let i = 0; i < body.sessions.length; i++) {
        const parsed = parseRemoteSession(body.sessions[i]);
        if (parsed) {
          parsedSessions.push(parsed);
        }

        if (i % 3 === 0) {
          write({
            type: "progress",
            stage: "parsing",
            progress: 10 + Math.floor((i / body.sessions.length) * 20),
            message: `Parsed ${i + 1}/${body.sessions.length} sessions`,
          });
        }
      }

      if (parsedSessions.length === 0) {
        write({
          type: "error",
          code: "NO_VALID_SESSIONS",
          message: "No valid sessions found in request",
        });
        responseStream.end();
        return;
      }

      // Progress: Sessions parsed
      write({
        type: "progress",
        stage: "analyzing",
        progress: 30,
        message: `Analyzing ${parsedSessions.length} valid session(s)...`,
      });

      // Compute metrics
      const metrics = aggregateMetrics(parsedSessions);

      // Progress: Starting LLM analysis
      write({
        type: "progress",
        stage: "analyzing",
        progress: 40,
        message: "Running AI analysis (Stage 1: Data extraction)...",
      });

      // Analysis progress messages
      const analysisMessages = [
        { progress: 42, message: "Extracting behavioral patterns from conversations..." },
        { progress: 45, message: "Analyzing tool usage patterns (Read, Write, Edit)..." },
        { progress: 48, message: "Mapping conversation flow and interaction style..." },
        { progress: 51, message: "Running personality dimension analysis..." },
        { progress: 54, message: "Analyzing communication style preferences..." },
        { progress: 57, message: "Evaluating decision-making patterns..." },
        { progress: 60, message: "Detecting AI collaboration techniques..." },
        { progress: 63, message: "Measuring verification and validation habits..." },
        { progress: 66, message: "Analyzing planning and task decomposition..." },
        { progress: 69, message: "Building personality profile..." },
        { progress: 72, message: "Generating personalized insights..." },
        { progress: 75, message: "Crafting evidence-based observations..." },
        { progress: 78, message: "Synthesizing findings into narrative..." },
        { progress: 81, message: "Finalizing your developer profile..." },
        { progress: 84, message: "Completing deep analysis..." },
      ];
      let messageIndex = 0;

      // Heartbeat interval
      const heartbeatInterval = setInterval(() => {
        try {
          const currentMsg = analysisMessages[messageIndex % analysisMessages.length];
          write({
            type: "progress",
            stage: "analyzing",
            progress: currentMsg.progress,
            message: currentMsg.message,
          });
          messageIndex++;
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 3000);

      // Run analysis
      let evaluation: VerboseEvaluation;
      try {
        const analyzer = new VerboseAnalyzer({
          pipeline: { mode: "two-stage" },
          tier: "enterprise",
          fallbackToLegacy: false,
          geminiApiKey: userGeminiApiKey,
        });

        console.log("[lambda-analysis] Starting analyzeVerbose...");
        evaluation = await analyzer.analyzeVerbose(parsedSessions, metrics, {
          tier: "enterprise",
        });
        console.log("[lambda-analysis] analyzeVerbose completed successfully");
      } finally {
        clearInterval(heartbeatInterval);
      }

      // Progress: Analysis complete
      write({
        type: "progress",
        stage: "storing",
        progress: 90,
        message: "Storing results...",
      });

      // Generate result ID and store
      const resultId = generateResultId();
      await storeResult(resultId, evaluation);

      // Progress: Complete
      write({
        type: "progress",
        stage: "complete",
        progress: 100,
        message: "Analysis complete!",
      });

      // Send final result
      const response: AnalysisResponse = {
        resultId,
        primaryType: evaluation.primaryType,
        controlLevel: evaluation.controlLevel || "developing",
        distribution: evaluation.distribution,
        personalitySummary: evaluation.personalitySummary,
      };

      write({
        type: "result",
        data: response,
      });
    } catch (error) {
      console.error("Analysis error:", error);
      write({
        type: "error",
        code: "ANALYSIS_FAILED",
        message: error instanceof Error ? error.message : "Analysis failed",
      });
    } finally {
      responseStream.end();
    }
  }
);
