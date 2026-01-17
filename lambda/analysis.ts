/**
 * Lambda Analysis Handler
 *
 * AWS Lambda version of /api/analysis/remote with:
 * - Lambda Response Streaming for SSE
 * - Supabase Storage integration for large payloads (>6MB)
 * - 15 minute timeout
 *
 * Routes:
 * - POST /upload-url: Generate Supabase Storage signed upload URL
 * - POST /analyze: Analyze from Supabase Storage
 * - POST / (default): Direct upload (legacy, <6MB only)
 */

import { Writable } from "node:stream";
import { gunzipSync } from "node:zlib";
import * as crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * Lambda event type
 */
interface LambdaEvent {
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: boolean;
  rawPath?: string;
  path?: string;
}

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
 * Session data from CLI (legacy v1 format - raw JSONL)
 */
interface RemoteSessionDataV1 {
  sessionId: string;
  projectName: string;
  messageCount: number;
  durationMinutes: number;
  content: string; // Raw JSONL content
}

/**
 * Pre-parsed message from CLI (v2 format)
 */
interface SerializedMessage {
  uuid: string;
  role: 'user' | 'assistant';
  timestamp: string; // ISO string
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
    result?: string;
    isError?: boolean;
  }>;
  tokenUsage?: {
    input: number;
    output: number;
  };
}

/**
 * Pre-parsed session from CLI (v2 format)
 */
interface SerializedSession {
  sessionId: string;
  projectPath: string;
  projectName: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  durationSeconds: number;
  claudeCodeVersion: string;
  messages: SerializedMessage[];
  stats: {
    userMessageCount: number;
    assistantMessageCount: number;
    toolCallCount: number;
    uniqueToolsUsed: string[];
    totalInputTokens: number;
    totalOutputTokens: number;
  };
}

/**
 * Analysis request from CLI (v1 - legacy raw JSONL)
 */
interface AnalysisRequestV1 {
  sessions: RemoteSessionDataV1[];
  totalMessages: number;
  totalDurationMinutes: number;
  version?: undefined | 1;
}

/**
 * Analysis request from CLI (v2 - pre-parsed)
 */
interface AnalysisRequestV2 {
  sessions: SerializedSession[];
  totalMessages: number;
  totalDurationMinutes: number;
  version: 2;
}

type AnalysisRequest = AnalysisRequestV1 | AnalysisRequestV2;

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
function parseRemoteSessionV1(data: RemoteSessionDataV1): ParsedSession | null {
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
 * Convert pre-parsed session (v2) to ParsedSession
 * No parsing needed - just deserialize dates
 */
function deserializeSessionV2(data: SerializedSession): ParsedSession {
  return {
    sessionId: data.sessionId,
    projectPath: data.projectPath,
    startTime: new Date(data.startTime),
    endTime: new Date(data.endTime),
    durationSeconds: data.durationSeconds,
    claudeCodeVersion: data.claudeCodeVersion,
    messages: data.messages.map((msg) => ({
      uuid: msg.uuid,
      role: msg.role,
      timestamp: new Date(msg.timestamp),
      content: msg.content,
      toolCalls: msg.toolCalls,
      tokenUsage: msg.tokenUsage,
    })),
    stats: data.stats,
  };
}

/**
 * Check if request is v2 format (pre-parsed)
 */
function isV2Request(body: AnalysisRequest): body is AnalysisRequestV2 {
  return body.version === 2;
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
 * Shared analysis logic - runs the actual analysis pipeline
 */
async function runAnalysis(
  body: AnalysisRequest,
  userGeminiApiKey: string,
  write: (event: SSEEvent) => void
): Promise<void> {
  // Parse sessions based on version
  const parsedSessions: ParsedSession[] = [];

  if (isV2Request(body)) {
    // V2: Pre-parsed sessions - just deserialize dates
    write({
      type: "progress",
      stage: "parsing",
      progress: 10,
      message: `Loading ${body.sessions.length} pre-parsed session(s)...`,
    });

    for (const session of body.sessions) {
      parsedSessions.push(deserializeSessionV2(session));
    }

    write({
      type: "progress",
      stage: "parsing",
      progress: 30,
      message: `Loaded ${parsedSessions.length} sessions`,
    });
  } else {
    // V1: Legacy raw JSONL - parse each session
    write({
      type: "progress",
      stage: "parsing",
      progress: 10,
      message: `Parsing ${body.sessions.length} session(s)...`,
    });

    for (let i = 0; i < body.sessions.length; i++) {
      const parsed = parseRemoteSessionV1(body.sessions[i]);
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
  }

  if (parsedSessions.length === 0) {
    write({
      type: "error",
      code: "NO_VALID_SESSIONS",
      message: "No valid sessions found in request",
    });
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

  // Analysis progress messages (40% to 84% range)
  const analysisMessages = [
    "Extracting behavioral patterns from conversations...",
    "Analyzing tool usage patterns (Read, Write, Edit)...",
    "Mapping conversation flow and interaction style...",
    "Running personality dimension analysis...",
    "Analyzing communication style preferences...",
    "Evaluating decision-making patterns...",
    "Detecting AI collaboration techniques...",
    "Measuring verification and validation habits...",
    "Analyzing planning and task decomposition...",
    "Building personality profile...",
    "Generating personalized insights...",
    "Crafting evidence-based observations...",
    "Synthesizing findings into narrative...",
    "Finalizing your developer profile...",
    "Completing deep analysis...",
  ];
  let messageIndex = 0;

  // Heartbeat interval - send progress updates every 3 seconds
  // Progress is calculated from index (40% to 84%), capped at last message
  const heartbeatInterval = setInterval(() => {
    try {
      const cappedIndex = Math.min(messageIndex, analysisMessages.length - 1);
      const progress = 40 + Math.floor((cappedIndex / (analysisMessages.length - 1)) * 44);
      write({
        type: "progress",
        stage: "analyzing",
        progress,
        message: analysisMessages[cappedIndex],
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
}

/**
 * Handle GET /upload-url - Generate Supabase Storage signed upload URL
 */
async function handleGetUploadUrl(
  event: LambdaEvent,
  responseStream: Writable
): Promise<void> {
  const metadata = {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  };
  responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

  try {
    if (!isSupabaseConfigured()) {
      responseStream.write(JSON.stringify({ error: "Storage not configured" }));
      responseStream.end();
      return;
    }

    const supabase = getSupabaseClient();
    const uploadId = crypto.randomUUID();
    const storagePath = `sessions/${uploadId}.json.gz`;

    console.log(`[lambda] Creating signed upload URL for: ${storagePath}`);

    const { data, error } = await supabase.storage
      .from("uploads")
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error("[lambda] Failed to create upload URL:", error);
      responseStream.write(JSON.stringify({ error: error.message }));
      responseStream.end();
      return;
    }

    console.log(`[lambda] Upload URL created successfully`);
    responseStream.write(JSON.stringify({
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
      storagePath,
    }));
  } catch (err) {
    console.error("[lambda] Upload URL error:", err);
    responseStream.write(JSON.stringify({
      error: err instanceof Error ? err.message : "Unknown error",
    }));
  }
  responseStream.end();
}

/**
 * Handle POST /analyze - Analyze from Supabase Storage
 */
async function handleAnalyzeFromStorage(
  event: LambdaEvent,
  responseStream: Writable
): Promise<void> {
  // Set SSE headers
  const metadata = {
    statusCode: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  };
  responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

  const write = (evt: SSEEvent) => responseStream.write(formatSSE(evt));

  try {
    // Get API key from header
    const userGeminiApiKey =
      event.headers["x-gemini-api-key"] || event.headers["X-Gemini-API-Key"];

    if (!userGeminiApiKey) {
      write({
        type: "error",
        code: "NO_API_KEY",
        message: "Gemini API key is required.",
      });
      responseStream.end();
      return;
    }

    // Parse request body
    let requestBody: { storagePath: string };
    try {
      if (event.isBase64Encoded) {
        requestBody = JSON.parse(Buffer.from(event.body, "base64").toString("utf-8"));
      } else {
        requestBody = JSON.parse(event.body);
      }
    } catch {
      write({
        type: "error",
        code: "INVALID_JSON",
        message: "Invalid JSON in request body",
      });
      responseStream.end();
      return;
    }

    if (!requestBody.storagePath) {
      write({
        type: "error",
        code: "INVALID_REQUEST",
        message: "storagePath is required",
      });
      responseStream.end();
      return;
    }

    write({
      type: "progress",
      stage: "preparing",
      progress: 5,
      message: "Downloading from storage...",
    });

    // Download from Supabase Storage
    const supabase = getSupabaseClient();
    console.log(`[lambda] Downloading from storage: ${requestBody.storagePath}`);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("uploads")
      .download(requestBody.storagePath);

    if (downloadError || !fileData) {
      console.error("[lambda] Download error:", downloadError);
      write({
        type: "error",
        code: "DOWNLOAD_FAILED",
        message: downloadError?.message || "Failed to download from storage",
      });
      responseStream.end();
      return;
    }

    // Convert Blob to Buffer
    const rawBuffer = Buffer.from(await fileData.arrayBuffer());
    console.log(`[lambda] Downloaded ${rawBuffer.length} bytes from storage`);

    // Check for gzip and decompress
    let bodyText: string;
    if (isGzipBuffer(rawBuffer)) {
      const decompressed = gunzipSync(rawBuffer);
      bodyText = decompressed.toString("utf-8");
      console.log(`[lambda] Decompressed: ${rawBuffer.length} -> ${bodyText.length} bytes`);
    } else {
      bodyText = rawBuffer.toString("utf-8");
    }

    // Parse JSON
    let body: AnalysisRequest;
    try {
      body = JSON.parse(bodyText) as AnalysisRequest;
      console.log(`[lambda] Parsed ${body.sessions?.length || 0} sessions from storage`);
    } catch (parseError) {
      write({
        type: "error",
        code: "INVALID_JSON",
        message: "Invalid JSON in stored file",
      });
      responseStream.end();
      return;
    }

    // Validate request
    if (!body.sessions || !Array.isArray(body.sessions) || body.sessions.length === 0) {
      write({
        type: "error",
        code: "INVALID_REQUEST",
        message: "At least one session is required",
      });
      responseStream.end();
      return;
    }

    // Run the shared analysis logic
    await runAnalysis(body, userGeminiApiKey, write);

    // Clean up: delete the uploaded file from storage
    try {
      await supabase.storage.from("uploads").remove([requestBody.storagePath]);
      console.log(`[lambda] Cleaned up storage file: ${requestBody.storagePath}`);
    } catch (cleanupError) {
      console.warn("[lambda] Failed to cleanup storage file:", cleanupError);
    }
  } catch (error) {
    console.error("[lambda] Analysis from storage error:", error);
    write({
      type: "error",
      code: "ANALYSIS_FAILED",
      message: error instanceof Error ? error.message : "Analysis failed",
    });
  } finally {
    responseStream.end();
  }
}

/**
 * Handle direct upload (legacy, <6MB only)
 */
async function handleDirectUpload(
  event: LambdaEvent,
  responseStream: Writable
): Promise<void> {
  // Set SSE headers via metadata
  const metadata = {
    statusCode: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  };
  responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

  const write = (evt: SSEEvent) => responseStream.write(formatSSE(evt));

  try {
    // Get API key from header
    const userGeminiApiKey =
      event.headers["x-gemini-api-key"] || event.headers["X-Gemini-API-Key"];

    if (!userGeminiApiKey) {
      write({
        type: "error",
        code: "NO_API_KEY",
        message: "Gemini API key is required. Pass --api-key flag or set GOOGLE_GEMINI_API_KEY environment variable.",
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

    console.log(`[lambda] Direct upload: ${rawBuffer.length} bytes`);

    // Check for gzip
    const hasGzipMagicBytes = isGzipBuffer(rawBuffer);

    let bodyText: string;
    if (hasGzipMagicBytes) {
      const decompressed = gunzipSync(rawBuffer);
      bodyText = decompressed.toString("utf-8");
      console.log(`[lambda] Decompressed: ${rawBuffer.length} -> ${bodyText.length} bytes`);
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
      console.log(`[lambda] Parsed ${body.sessions?.length || 0} sessions`);
    } catch (parseError) {
      write({
        type: "error",
        code: "INVALID_JSON",
        message: parseError instanceof Error ? parseError.message : "Invalid JSON",
      });
      responseStream.end();
      return;
    }

    // Validate request
    if (!body.sessions || !Array.isArray(body.sessions) || body.sessions.length === 0) {
      write({
        type: "error",
        code: "INVALID_REQUEST",
        message: "At least one session is required",
      });
      responseStream.end();
      return;
    }

    // Run the shared analysis logic
    await runAnalysis(body, userGeminiApiKey, write);
  } catch (error) {
    console.error("[lambda] Direct upload error:", error);
    write({
      type: "error",
      code: "ANALYSIS_FAILED",
      message: error instanceof Error ? error.message : "Analysis failed",
    });
  } finally {
    responseStream.end();
  }
}

/**
 * Lambda handler with Response Streaming and Routing
 */
export const handler = awslambda.streamifyResponse(
  async (event: LambdaEvent, responseStream: Writable) => {
    const path = event.rawPath || event.path || "/";
    console.log(`[lambda] Request path: ${path}`);

    // Route: POST /upload-url - Generate Supabase Storage signed upload URL
    if (path === "/upload-url" || path.endsWith("/upload-url")) {
      return handleGetUploadUrl(event, responseStream);
    }

    // Route: POST /analyze - Analyze from Supabase Storage
    if (path === "/analyze" || path.endsWith("/analyze")) {
      return handleAnalyzeFromStorage(event, responseStream);
    }

    // Default: Legacy direct upload (backward compatible)
    return handleDirectUpload(event, responseStream);
  }
);
