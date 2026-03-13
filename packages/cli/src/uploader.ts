/**
 * Server Uploader
 *
 * Handles communication with the BetterPrompt server
 * Supports SSE streaming for real-time progress updates
 * Uses gzip compression to reduce payload size
 *
 * Sends pre-parsed session data directly to the self-hosted Next.js server.
 * Authentication is optional — the server works without tokens.
 */

import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { ScanResult } from './scanner.js';
import type { ParsedSession, ParsedMessage } from './session-formatter.js';
import { resolveProjectName } from './lib/project-name-resolver.js';

/**
 * Debug mode - set BETTERPROMPT_DEBUG=1 to enable verbose logging
 */
const DEBUG = process.env.BETTERPROMPT_DEBUG === '1';
function debugLog(...args: unknown[]) {
  if (DEBUG) console.error('[DEBUG]', ...args);
}

function getAnalysisApiUrl(): string {
  const configured = process.env.BETTERPROMPT_API_URL?.trim();
  if (!configured) {
    return `${REPORT_BASE_URL.replace(/\/$/, '')}/api/analysis/run`;
  }

  const normalized = configured.replace(/\/$/, '');
  if (normalized.endsWith('/api/analysis/run')) {
    return normalized;
  }
  if (normalized.endsWith('/api/analysis')) {
    return `${normalized}/run`;
  }
  return `${normalized}/api/analysis/run`;
}

/**
 * Web app base URL for report links
 */
const REPORT_BASE_URL = process.env.BETTERPROMPT_WEB_APP_URL || 'http://localhost:3000';

/**
 * Maximum payload size
 */
const PAYLOAD_LIMIT = 100 * 1024 * 1024;

/**
 * Serialized message format for API
 */
interface SerializedMessage {
  uuid: string;
  role: 'user' | 'assistant';
  timestamp: string;
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
 * Serialized session format for API
 */
interface SerializedSession {
  sessionId: string;
  projectPath: string;
  projectName: string;
  startTime: string;
  endTime: string;
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
 * API request payload
 */
interface AnalysisPayload {
  sessions: SerializedSession[];
  activitySessions?: ActivitySessionInfo[];
  totalMessages: number;
  totalDurationMinutes: number;
  version: 2;
}

/**
 * Serialize a message for API transmission
 */
function serializeMessage(msg: ParsedMessage): SerializedMessage {
  return {
    uuid: msg.uuid,
    role: msg.role,
    timestamp: msg.timestamp.toISOString(),
    content: msg.content,
    toolCalls: msg.toolCalls,
    tokenUsage: msg.tokenUsage,
  };
}

/**
 * Serialize a session for API transmission
 */
function serializeSession(session: ParsedSession): SerializedSession {
  return {
    sessionId: session.sessionId,
    projectPath: session.projectPath,
    projectName: session.projectName ?? resolveProjectName(session.projectPath),
    startTime: session.startTime.toISOString(),
    endTime: session.endTime.toISOString(),
    durationSeconds: session.durationSeconds,
    claudeCodeVersion: session.claudeCodeVersion,
    messages: session.messages.map(serializeMessage),
    stats: session.stats,
  };
}

/**
 * Result of payload preparation
 */
interface PreparePayloadResult {
  compressed: Buffer;
  truncated: boolean;
  droppedCount: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
}

/**
 * Prepare payload from parsed sessions
 */
function preparePayload(scanResult: ScanResult): PreparePayloadResult {
  let serializedSessions = scanResult.sessions.map(s => serializeSession(s.parsed));

  const payload: AnalysisPayload = {
    sessions: serializedSessions,
    activitySessions: scanResult.activitySessions,
    totalMessages: scanResult.totalMessages,
    totalDurationMinutes: scanResult.totalDurationMinutes,
    version: 2,
  };

  const originalJson = JSON.stringify(payload);
  const originalSizeBytes = Buffer.byteLength(originalJson, 'utf-8');

  let compressed = gzipSync(Buffer.from(originalJson, 'utf-8'));

  if (compressed.length <= PAYLOAD_LIMIT) {
    return {
      compressed,
      truncated: false,
      droppedCount: 0,
      originalSizeBytes,
      compressedSizeBytes: compressed.length,
    };
  }

  // If too large, drop sessions until it fits
  let droppedCount = 0;
  while (serializedSessions.length > 1 && compressed.length > PAYLOAD_LIMIT) {
    serializedSessions.pop();
    droppedCount++;

    const reducedPayload: AnalysisPayload = {
      sessions: serializedSessions,
      activitySessions: scanResult.activitySessions,
      totalMessages: serializedSessions.reduce((sum, s) => sum + s.stats.userMessageCount + s.stats.assistantMessageCount, 0),
      totalDurationMinutes: Math.round(serializedSessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60),
      version: 2,
    };

    const reducedJson = JSON.stringify(reducedPayload);
    compressed = gzipSync(Buffer.from(reducedJson, 'utf-8'));
  }

  return {
    compressed,
    truncated: droppedCount > 0,
    droppedCount,
    originalSizeBytes,
    compressedSizeBytes: compressed.length,
  };
}

/**
 * Token usage for a single stage
 */
export interface StageTokenUsage {
  stage: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Pipeline token usage from LLM API responses
 */
export interface PipelineTokenUsage {
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

export interface AnalysisResult {
  resultId: string;
  primaryType: string;
  controlLevel: string;
  controlScore: number;
  matrixName: string;
  matrixEmoji: string;
  distribution: {
    architect: number;
    analyst: number;
    conductor: number;
    speedrunner: number;
    trendsetter: number;
  };
  personalitySummary: string;
  reportUrl: string;
  /** Domain skill scores from worker insights (0-100 each) */
  skillScores?: {
    thinking: number;
    communication: number;
    learning: number;
    context: number;
    control: number;
  };
  /** Actual token usage from LLM pipeline (available when DEBUG is set) */
  tokenUsage?: PipelineTokenUsage;
}

/**
 * Debug phase output from pipeline (mirrors server-side DebugPhaseOutput)
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
 * SSE Event types from the server
 */
/**
 * Preview snippet for CLI chat display
 */
export interface PreviewSnippet {
  label: string;
  text: string;
  icon: string;
}

/**
 * Callback for phase preview events (CLI chat display)
 */
export type PhasePreviewCallback = (phase: string, snippets: PreviewSnippet[]) => void;

/**
 * SSE Event types from the server
 */
type SSEEvent =
  | { type: 'progress'; stage: string; progress: number; message: string }
  | { type: 'phase_preview'; phase: string; snippets: PreviewSnippet[] }
  | { type: 'result'; data: Omit<AnalysisResult, 'reportUrl'> }
  | { type: 'debug_phase'; data: DebugPhaseOutput }
  | { type: 'error'; code: string; message: string };

/**
 * Progress callback for UI updates
 */
export type ProgressCallback = (stage: string, progress: number, message: string) => void;

/**
 * Parse SSE data line
 */
function parseSSELine(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) {
    debugLog('Non-SSE line skipped:', line.slice(0, 50));
    return null;
  }

  try {
    return JSON.parse(line.slice(6)) as SSEEvent;
  } catch (e) {
    debugLog('SSE parse failed:', {
      line: line.slice(0, 100),
      error: (e as Error).message,
    });
    return null;
  }
}

/**
 * Save debug phase outputs to ~/.betterprompt/debug/{timestamp}/
 */
function saveDebugOutputs(debugOutputs: DebugPhaseOutput[]): void {
  if (debugOutputs.length === 0) return;

  // Create timestamp directory (colons replaced with dashes for filesystem compatibility)
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, '');
  const debugDir = join(homedir(), '.betterprompt', 'debug', timestamp);

  mkdirSync(debugDir, { recursive: true });

  // Write each phase as a separate JSON file
  for (const output of debugOutputs) {
    const fileName = `${output.phase}.json`;
    writeFileSync(
      join(debugDir, fileName),
      JSON.stringify(output.data, null, 2),
      'utf-8'
    );
  }

  // Write manifest
  const manifest = {
    createdAt: new Date().toISOString(),
    phaseCount: debugOutputs.length,
    totalDurationMs: debugOutputs.reduce((sum, o) => sum + o.durationMs, 0),
    phases: debugOutputs.map(o => ({
      phase: o.phase,
      phaseName: o.phaseName,
      completedAt: o.completedAt,
      durationMs: o.durationMs,
      tokenUsage: o.tokenUsage,
      file: `${o.phase}.json`,
    })),
  };

  writeFileSync(
    join(debugDir, '_manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  console.error(`[DEBUG] Phase outputs saved to: ${debugDir}`);
}

/**
 * Format bytes to human-readable size string
 */
function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes}B`;
}

/**
 * Options for upload and analysis
 */
export interface UploadOptions {
  noTranslate?: boolean;
}

/**
 * Upload session data for analysis with streaming progress
 */
export async function uploadForAnalysis(
  scanResult: ScanResult,
  accessToken: string = '',
  onProgress?: ProgressCallback,
  onPhasePreview?: PhasePreviewCallback,
  options?: UploadOptions
): Promise<AnalysisResult> {
  const {
    compressed: compressedBody,
    truncated,
    droppedCount,
    originalSizeBytes,
    compressedSizeBytes,
  } = preparePayload(scanResult);

  const sizeInfo = `${formatSize(originalSizeBytes)} (gzip: ${formatSize(compressedSizeBytes)})`;
  const analysisUrl = getAnalysisApiUrl();

  if (truncated) {
    onProgress?.('preparing', 0, `${sizeInfo} | Excluded ${droppedCount} session(s) to fit limit`);
  } else {
    onProgress?.('preparing', 0, `${sizeInfo} | Sending to self-hosted server`);
  }

  onProgress?.('preparing', 5, `Uploading ${formatSize(compressedBody.length)} to ${analysisUrl}...`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'Content-Encoding': 'gzip',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  if (DEBUG) {
    headers['X-Debug'] = '1';
  }

  const response = await fetch(
    options?.noTranslate ? `${analysisUrl}?noTranslate=1` : analysisUrl,
    {
      method: 'POST',
      headers,
      body: new Uint8Array(compressedBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Analysis request failed: ${response.status} ${errorText}`);
  }

  return handleStreamingResponse(response, onProgress, onPhasePreview);
}

/**
 * Handle SSE streaming response
 */
async function handleStreamingResponse(
  response: Response,
  onProgress?: ProgressCallback,
  onPhasePreview?: PhasePreviewCallback
): Promise<AnalysisResult> {
  debugLog('SSE response:', {
    status: response.status,
    contentType: response.headers.get('content-type'),
    contentEncoding: response.headers.get('content-encoding'),
  });

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let result: AnalysisResult | null = null;
  let isFirstChunk = true;
  const debugOutputs: DebugPhaseOutput[] = [];

  /** Process a single SSE event, updating result/debugOutputs or throwing on error */
  function handleEvent(event: SSEEvent): void {
    switch (event.type) {
      case 'progress':
        onProgress?.(event.stage, event.progress, event.message);
        break;

      case 'phase_preview':
        onPhasePreview?.(event.phase, event.snippets);
        break;

      case 'result':
        result = {
          ...event.data,
          reportUrl: `${REPORT_BASE_URL}/dashboard/r/${event.data.resultId}`,
        };
        break;

      case 'debug_phase':
        debugOutputs.push(event.data);
        break;

      case 'error':
        throw new Error(event.message || 'Analysis failed');
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      if (isFirstChunk && value) {
        debugLog('SSE first chunk:', {
          bytes: value.length,
          preview: chunk.slice(0, 150),
        });
        isFirstChunk = false;
      }

      buffer += chunk;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const event = parseSSELine(trimmed);
        if (event) handleEvent(event);
      }
    }

    // Process any remaining data in the buffer
    if (buffer.trim()) {
      const event = parseSSELine(buffer.trim());
      if (event) handleEvent(event);
    }

    // Save debug outputs to disk if any were received
    if (debugOutputs.length > 0) {
      saveDebugOutputs(debugOutputs);
    }

    if (!result) {
      throw new Error('No result received from server');
    }

    return result;
  } finally {
    reader.releaseLock();
  }
}
