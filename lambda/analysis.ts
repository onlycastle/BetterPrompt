/**
 * Lambda Analysis Handler
 *
 * AWS Lambda version of /api/analysis/remote with:
 * - Lambda Response Streaming for SSE
 * - S3 presigned URL for large payloads (client uploads directly to S3)
 * - 15 minute timeout
 *
 * Routes:
 * - POST /upload-url: Generate S3 presigned upload URL
 * - POST /analyze: Analyze from S3
 * - POST / (default): Direct upload (legacy fallback)
 *
 * Architecture (S3 flow):
 * 1. Client calls /upload-url → gets S3 presigned PUT URL
 * 2. Client uploads directly to S3 (bypasses Lambda payload limits)
 * 3. Client calls /analyze with s3Key
 * 4. Lambda reads from S3 (same region = fast), runs analysis
 * 5. Lambda streams SSE progress back to client
 */

import { Writable } from "node:stream";
import { gunzipSync } from "node:zlib";
import * as crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
import type { ProgressCallback } from "../src/lib/analyzer/orchestrator/types";
import { aggregateMetrics } from "../src/lib/analyzer/type-detector";
import type { ParsedSession } from "../src/lib/domain/models/analysis";
import type { VerboseEvaluation } from "../src/lib/models/verbose-evaluation";
import { createSupabaseKnowledgeRepository } from "../src/lib/infrastructure/storage/supabase/knowledge-repo";
import { createSupabaseProfessionalInsightRepository } from "../src/lib/infrastructure/storage/supabase/professional-insight-repo";
import {
  MATRIX_NAMES,
  MATRIX_METADATA,
  type CodingStyleType,
  type AIControlLevel,
} from "../src/lib/models/coding-style";

// Maximum body size - 50MB (Lambda supports up to 6MB sync, but streaming allows more)
const MAX_BODY_SIZE = 50 * 1024 * 1024;

// S3 client for large payload uploads (same region as Lambda for low latency)
const s3Client = new S3Client({ region: process.env.AWS_REGION || "ap-northeast-2" });
const UPLOAD_BUCKET = process.env.UPLOAD_BUCKET_NAME || "";

// Presigned URL expiration (15 minutes - enough time for large uploads)
const PRESIGNED_URL_EXPIRY = 15 * 60;

/**
 * Pre-parsed message from CLI
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
 * Pre-parsed session from CLI
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
 * Activity session metadata (deterministic, from CLI scanner)
 */
interface ActivitySessionInfo {
  sessionId: string;
  projectName: string;
  startTime: string;
  durationMinutes: number;
  messageCount: number;
  summary: string;
}

/**
 * Analysis request from CLI (pre-parsed sessions)
 */
interface AnalysisRequest {
  sessions: SerializedSession[];
  activitySessions?: ActivitySessionInfo[];
  totalMessages: number;
  totalDurationMinutes: number;
  version?: number;
  userId?: string; // DEPRECATED: userId from body is ignored for security. Use Authorization header instead.
}

/**
 * Token usage for a single stage
 */
interface StageTokenUsage {
  stage: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Pipeline token usage from LLM API responses
 */
interface PipelineTokenUsage {
  stages: StageTokenUsage[];
  totals: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
  model: string;
  modelName: string;
}

/**
 * Analysis result returned to CLI
 */
interface AnalysisResponse {
  resultId: string;
  primaryType: string;
  controlLevel: string;
  controlScore: number;
  matrixName: string;
  matrixEmoji: string;
  distribution: {
    architect: number;
    scientist: number;
    collaborator: number;
    speedrunner: number;
    craftsman: number;
  };
  personalitySummary: string;
  /** Domain skill scores from worker insights (0-100 each) */
  skillScores?: {
    thinking: number;
    communication: number;
    learning: number;
    context: number;
    control: number;
  };
  /** Actual token usage from LLM pipeline (for DEBUG mode) */
  tokenUsage?: PipelineTokenUsage;
}

/**
 * Debug phase output from pipeline (mirrors DebugPhaseOutput from orchestrator)
 */
interface DebugPhaseOutput {
  phase: string;
  phaseName: string;
  completedAt: string;
  durationMs: number;
  data: unknown;
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
}

/**
 * SSE Event types
 */
type SSEEvent =
  | { type: "progress"; stage: string; progress: number; message: string }
  | { type: "phase_preview"; phase: string; snippets: Array<{ label: string; text: string; icon: string }> }
  | { type: "result"; data: AnalysisResponse }
  | { type: "debug_phase"; data: DebugPhaseOutput }
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
 * Convert pre-parsed session to ParsedSession by deserializing ISO date strings
 */
function deserializeSession(data: SerializedSession): ParsedSession {
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
 * Validate Authorization header and extract user ID
 *
 * Security: userId must come from validated JWT, not from request body.
 * This prevents spoofing where attackers claim another user's identity.
 *
 * @param authHeader - Authorization header value (Bearer token)
 * @returns userId if valid, null if no auth or invalid
 */
async function validateAuthToken(
  authHeader: string | undefined
): Promise<{ userId: string } | null> {
  // No auth header = anonymous request (CLI users)
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  if (!token) {
    return null;
  }

  try {
    const supabase = getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.warn("[lambda] Auth validation failed:", error?.message);
      return null;
    }

    console.log(`[lambda] Authenticated user: ${user.id}`);
    return { userId: user.id };
  } catch (error) {
    console.error("[lambda] Auth validation error:", error);
    return null;
  }
}

/**
 * Store analysis result in Supabase
 *
 * @param resultId - Unique result identifier for URL
 * @param evaluation - Tier-filtered VerboseEvaluation
 * @param userId - Optional authenticated user ID
 * @param phase1Output - Optional Phase1Output for evidence auditing and source tracking
 */
async function storeResult(
  resultId: string,
  evaluation: VerboseEvaluation,
  userId?: string,
  phase1Output?: unknown
): Promise<boolean> {
  console.log(`[PHASE:STORE] === Storage Diagnostics ===`);
  console.log(`[PHASE:STORE] resultId: ${resultId}`);
  console.log(`[PHASE:STORE] SUPABASE_URL set: ${!!process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`[PHASE:STORE] SUPABASE_KEY set: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);
  console.log(`[PHASE:STORE] isSupabaseConfigured: ${isSupabaseConfigured()}`);

  if (!isSupabaseConfigured()) {
    console.error("[PHASE:STORE] FAILED - Supabase not configured");
    return false;
  }

  try {
    const supabase = getSupabaseClient();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Debug: log agentOutputs status before storage
    console.log(`[PHASE:STORE] hasAgentOutputs: ${!!evaluation.agentOutputs}`);
    console.log(`[PHASE:STORE] agentOutputs keys: ${evaluation.agentOutputs ? Object.keys(evaluation.agentOutputs).join(', ') : 'none'}`);
    console.log(`[PHASE:STORE] typeClassifier: ${evaluation.agentOutputs?.typeClassifier ? 'present' : 'null'}`);
    console.log(`[PHASE:STORE] hasPhase1Output: ${!!phase1Output}`);

    const insertData: Record<string, unknown> = {
      result_id: resultId,
      evaluation,
      is_paid: false,
      expires_at: expiresAt.toISOString(),
    };

    // Store Phase1Output for evidence auditing and source tracking
    if (phase1Output) {
      insertData.phase1_output = phase1Output;
    }

    // Include user_id if provided (desktop app pre-authenticated flow)
    if (userId) {
      insertData.user_id = userId;
      insertData.claimed_at = new Date().toISOString();
      console.log(`[PHASE:STORE] Storing with user_id: ${userId}`);
    }

    const evaluationSize = JSON.stringify(evaluation).length;
    const phase1Size = phase1Output ? JSON.stringify(phase1Output).length : 0;
    console.log(`[PHASE:STORE] Payload sizes - evaluation: ${evaluationSize} bytes, phase1Output: ${phase1Size} bytes`);

    const { error } = await supabase.from("analysis_results").insert(insertData);

    if (error) {
      console.error(`[PHASE:STORE] FAILED - Supabase error: ${error.message}`);
      console.error(`[PHASE:STORE] Error code: ${error.code}, details: ${error.details}`);
      return false;
    }

    console.log(`[PHASE:STORE] SUCCESS - stored resultId: ${resultId}`);
    return true;
  } catch (error) {
    console.error(`[PHASE:STORE] FAILED - exception:`, error);
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
  write: (event: SSEEvent) => void,
  userId?: string,
  debug?: boolean,
  noTranslate?: boolean
): Promise<void> {
  write({
    type: "progress",
    stage: "parsing",
    progress: 10,
    message: `Loading ${body.sessions.length} pre-parsed session(s)...`,
  });

  const parsedSessions = body.sessions.map(deserializeSession);

  write({
    type: "progress",
    stage: "parsing",
    progress: 30,
    message: `Loaded ${parsedSessions.length} sessions`,
  });

  console.log(`[PHASE:PARSE] Sessions loaded: ${parsedSessions.length}`);

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
    message: "Running AI analysis pipeline...",
  });

  // ── Real progress callback ──────────────────────────────────────────────
  // The orchestrator fires this after each discrete phase/worker completion.
  // Between callbacks, a liveness heartbeat re-sends the last progress with
  // a dot animation so the client knows the connection is alive.
  let lastProgress = 40;
  let lastMessage = "Running AI analysis pipeline...";
  let dotCount = 0;

  const onProgress: ProgressCallback = (stage, progress, message) => {
    lastProgress = progress;
    lastMessage = message;
    dotCount = 0; // reset dot animation on real progress tick
    write({
      type: "progress",
      stage: "analyzing",
      progress,
      message,
    });
  };

  const onPhasePreview = (phase: string, snippets: Array<{ label: string; text: string; icon: string }>) => {
    write({
      type: "phase_preview",
      phase,
      snippets,
    });
  };

  // Liveness heartbeat: re-sends current progress with dot animation every 3s
  // Shows the system is alive during long single-LLM calls (e.g., Phase 3: 15-30s)
  const livenessInterval = setInterval(() => {
    try {
      dotCount = (dotCount % 3) + 1;
      const dots = ".".repeat(dotCount);
      write({
        type: "progress",
        stage: "analyzing",
        progress: lastProgress,
        message: lastMessage.replace(/\.{1,3}$/, "") + dots,
      });
    } catch {
      clearInterval(livenessInterval);
    }
  }, 1000);

  // Run analysis - returns AnalysisResult with evaluation + phase1Output
  let evaluation: VerboseEvaluation;
  let phase1Output: unknown;
  try {
    const analyzer = new VerboseAnalyzer({
      tier: "enterprise",
      geminiApiKey: userGeminiApiKey,
      debug: !!debug,
      knowledgeRepo: createSupabaseKnowledgeRepository(),
      professionalInsightRepo: createSupabaseProfessionalInsightRepository(),
    });

    const activitySessions = body.activitySessions;

    console.log("[PHASE:ANALYZE] Starting analyzeVerbose...");
    const analysisResult = await analyzer.analyzeVerbose(parsedSessions, metrics, {
      tier: "enterprise",
      onProgress,
      onPhasePreview,
      activitySessions,
      noTranslate,
    });
    evaluation = analysisResult.evaluation;
    phase1Output = analysisResult.phase1Output;
    console.log(`[PHASE:ANALYZE] Completed - evaluation keys: ${Object.keys(evaluation).join(', ')}`);
    console.log(`[PHASE:ANALYZE] agentOutputs: ${evaluation.agentOutputs ? 'present' : 'null'}, phase1Output: ${phase1Output ? 'present' : 'null'}`);

    // Emit debug phase outputs as SSE events (before result event)
    if (debug && analysisResult.debugOutputs) {
      console.log(`[PHASE:DEBUG] Emitting ${analysisResult.debugOutputs.length} debug_phase events`);
      for (const debugOutput of analysisResult.debugOutputs) {
        write({ type: "debug_phase", data: debugOutput });
      }
    }
  } finally {
    clearInterval(livenessInterval);
  }

  // Progress: Analysis complete
  write({
    type: "progress",
    stage: "storing",
    progress: 90,
    message: "Storing results...",
  });

  // Generate result ID and store (includes phase1Output for evidence auditing)
  const resultId = generateResultId();
  const stored = await storeResult(resultId, evaluation, userId, phase1Output);
  if (!stored) {
    write({
      type: "error",
      code: "STORE_FAILED",
      message: "Failed to store analysis results. The analysis completed but could not be saved. Please try again.",
    });
    return;
  }

  // Progress: Complete
  write({
    type: "progress",
    stage: "complete",
    progress: 100,
    message: "Analysis complete!",
  });

  // Get type and level for matrix lookup
  const primaryType = evaluation.primaryType as CodingStyleType;
  const controlLevel = (evaluation.controlLevel || "developing") as AIControlLevel;

  // Get controlScore, matrixName, matrixEmoji from TypeClassifier or compute from constants
  const controlScore = evaluation.controlScore
    ?? evaluation.agentOutputs?.typeClassifier?.controlScore
    ?? 50;
  const matrixName = evaluation.agentOutputs?.typeClassifier?.matrixName
    ?? MATRIX_NAMES[primaryType]?.[controlLevel]
    ?? `${primaryType} ${controlLevel}`;
  const matrixEmoji = evaluation.agentOutputs?.typeClassifier?.matrixEmoji
    ?? MATRIX_METADATA[primaryType]?.[controlLevel]?.emoji
    ?? '🎯';

  // Extract skill scores from workerInsights (domainScore per worker domain)
  const wi = evaluation.workerInsights as Record<string, { domainScore?: number }> | undefined;
  const skillScores = wi ? {
    thinking: wi.thinkingQuality?.domainScore ?? 0,
    communication: wi.communicationPatterns?.domainScore ?? 0,
    learning: wi.learningBehavior?.domainScore ?? 0,
    context: wi.contextEfficiency?.domainScore ?? 0,
    control: controlScore,
  } : undefined;

  // Send final result
  console.log(`[PHASE:RESPONSE] Sending result event with resultId: ${resultId}`);
  const response: AnalysisResponse = {
    resultId,
    primaryType,
    controlLevel,
    controlScore,
    matrixName,
    matrixEmoji,
    distribution: evaluation.distribution,
    personalitySummary: evaluation.personalitySummary,
    skillScores,
    tokenUsage: evaluation.pipelineTokenUsage,
  };

  write({
    type: "result",
    data: response,
  });
}

/**
 * Handle GET /upload-url - Generate S3 presigned upload URL
 *
 * Uses AWS S3 in the same region as Lambda for:
 * - Low latency uploads (same region)
 * - Direct S3 access from Lambda (no external network)
 * - Support for large files (up to 5GB with multipart)
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
    if (!UPLOAD_BUCKET) {
      console.error("[lambda] UPLOAD_BUCKET_NAME not configured");
      responseStream.write(JSON.stringify({ error: "Storage not configured" }));
      responseStream.end();
      return;
    }

    const uploadId = crypto.randomUUID();
    const s3Key = `sessions/${uploadId}.json.gz`;

    console.log(`[lambda] Creating S3 presigned URL for: ${s3Key} in bucket: ${UPLOAD_BUCKET}`);

    // Generate presigned PUT URL for direct client upload
    const command = new PutObjectCommand({
      Bucket: UPLOAD_BUCKET,
      Key: s3Key,
      ContentType: "application/octet-stream",
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRY,
    });

    console.log(`[lambda] S3 presigned URL created successfully`);
    responseStream.write(JSON.stringify({
      signedUrl,
      s3Key,
      bucket: UPLOAD_BUCKET,
      expiresIn: PRESIGNED_URL_EXPIRY,
    }));
  } catch (err) {
    console.error("[lambda] S3 upload URL error:", err);
    responseStream.write(JSON.stringify({
      error: err instanceof Error ? err.message : "Unknown error",
    }));
  }
  responseStream.end();
}

/**
 * Handle POST /analyze - Analyze from S3
 *
 * Reads session data from S3 (same region as Lambda for low latency),
 * runs analysis, and streams progress via SSE.
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

  let s3Key: string | undefined;

  try {
    // Validate auth token and extract userId (optional - CLI users don't need auth)
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const authResult = await validateAuthToken(authHeader);
    const userId = authResult?.userId;

    // Check for debug mode (X-Debug: 1 header from CLI)
    const debug = event.headers?.['x-debug'] === '1';

    // Use server-side API key (not from request headers)
    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (!geminiApiKey) {
      write({
        type: "error",
        code: "SERVER_CONFIG_ERROR",
        message: "Server API key not configured. Please contact support.",
      });
      responseStream.end();
      return;
    }

    if (!UPLOAD_BUCKET) {
      write({
        type: "error",
        code: "SERVER_CONFIG_ERROR",
        message: "Storage not configured. Please contact support.",
      });
      responseStream.end();
      return;
    }

    // Parse request body
    let requestBody: { s3Key: string; noTranslate?: boolean };
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

    if (!requestBody.s3Key) {
      write({
        type: "error",
        code: "INVALID_REQUEST",
        message: "s3Key is required",
      });
      responseStream.end();
      return;
    }

    s3Key = requestBody.s3Key;

    write({
      type: "progress",
      stage: "preparing",
      progress: 5,
      message: "Downloading from S3...",
    });

    // Download from S3 (same region = fast)
    console.log(`[lambda] Downloading from S3: ${UPLOAD_BUCKET}/${s3Key}`);

    const getCommand = new GetObjectCommand({
      Bucket: UPLOAD_BUCKET,
      Key: s3Key,
    });

    const s3Response = await s3Client.send(getCommand);

    if (!s3Response.Body) {
      write({
        type: "error",
        code: "DOWNLOAD_FAILED",
        message: "Failed to download from S3: empty response",
      });
      responseStream.end();
      return;
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of s3Response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const rawBuffer = Buffer.concat(chunks);
    console.log(`[lambda] Downloaded ${rawBuffer.length} bytes from S3`);

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
      console.log(`[lambda] Parsed ${body.sessions?.length || 0} sessions from S3`);
    } catch {
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

    // Run the shared analysis logic (userId from auth validation above)
    await runAnalysis(body, geminiApiKey, write, userId, debug, requestBody.noTranslate);

    // Clean up: delete the uploaded file from S3
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: UPLOAD_BUCKET,
        Key: s3Key,
      });
      await s3Client.send(deleteCommand);
      console.log(`[lambda] Cleaned up S3 file: ${s3Key}`);
    } catch (cleanupError) {
      console.warn("[lambda] Failed to cleanup S3 file:", cleanupError);
    }
  } catch (error) {
    console.error("[lambda] Analysis from S3 error:", error);
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
    // Validate auth token and extract userId (optional - CLI users don't need auth)
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const authResult = await validateAuthToken(authHeader);
    const userId = authResult?.userId;

    // Check for debug mode (X-Debug: 1 header from CLI)
    const debug = event.headers?.['x-debug'] === '1';

    // Use server-side API key (not from request headers)
    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (!geminiApiKey) {
      write({
        type: "error",
        code: "SERVER_CONFIG_ERROR",
        message: "Server API key not configured. Please contact support.",
      });
      responseStream.end();
      return;
    }

    // Validate request body exists
    if (!event.body) {
      write({
        type: "error",
        code: "INVALID_REQUEST",
        message: "Request body is required. Use POST with session data.",
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

    // Decompress if gzipped
    let bodyText: string;
    if (isGzipBuffer(rawBuffer)) {
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

    // Run the shared analysis logic (userId from auth validation above)
    await runAnalysis(body, geminiApiKey, write, userId, debug);
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
    // Diagnostic logging for routing issues
    console.log('[lambda] Event routing debug:', JSON.stringify({
      rawPath: event.rawPath,
      path: event.path,
      method: (event as { requestContext?: { http?: { method?: string } } }).requestContext?.http?.method,
    }));

    const path = event.rawPath || event.path || "/";
    console.log(`[lambda] Resolved path: ${path}`);

    // Route: GET /health - Health check for load balancers and monitoring
    if (path === "/health" || path.endsWith("/health")) {
      const metadata = {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
      };
      responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);
      responseStream.write(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
      responseStream.end();
      return;
    }

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
