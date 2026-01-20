/**
 * Server Uploader
 *
 * Handles communication with the NoMoreAISlop Lambda server.
 * Supports SSE streaming for real-time progress updates.
 * Uses gzip compression to reduce payload size.
 *
 * Based on CLI package implementation, adapted for Electron (CJS).
 */

import { gzipSync } from 'node:zlib';
import type { BrowserWindow } from 'electron';
import type { ScanResult } from './scanner';
import type { ParsedSession, ParsedMessage } from './session-formatter';

/**
 * Lambda Function URL for analysis API
 */
const DEFAULT_LAMBDA_URL =
  'https://kgdby5xqjypfnlihknmcllqwgq0labzp.lambda-url.ap-northeast-2.on.aws';

/**
 * Web app base URL for report links
 */
const REPORT_BASE_URL = 'https://www.nomoreaislop.xyz';

/**
 * Threshold for using Supabase Storage upload (5MB)
 */
const USE_STORAGE_THRESHOLD = 5 * 1024 * 1024;

/**
 * Maximum payload size (100MB)
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
 * API request payload
 */
interface AnalysisPayload {
  sessions: SerializedSession[];
  totalMessages: number;
  totalDurationMinutes: number;
  version: 2;
  userId?: string; // DEPRECATED: Server extracts userId from Authorization header now
}

/**
 * SSE Event types from the server
 */
type SSEEvent =
  | { type: 'progress'; stage: string; progress: number; message: string }
  | { type: 'result'; data: AnalysisResultData }
  | { type: 'error'; code: string; message: string };

interface AnalysisResultData {
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
  personalitySummary?: string;
}

export interface AnalysisResult extends AnalysisResultData {
  reportUrl: string;
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
    projectName: session.projectName,
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
function preparePayload(scanResult: ScanResult, userId?: string): PreparePayloadResult {
  let serializedSessions = scanResult.sessions.map((s) => serializeSession(s.parsed));

  const payload: AnalysisPayload = {
    sessions: serializedSessions,
    totalMessages: scanResult.totalMessages,
    totalDurationMinutes: scanResult.totalDurationMinutes,
    version: 2,
    userId,
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
      totalMessages: serializedSessions.reduce(
        (sum, s) => sum + s.stats.userMessageCount + s.stats.assistantMessageCount,
        0
      ),
      totalDurationMinutes: Math.round(
        serializedSessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60
      ),
      version: 2,
      userId,
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
 * Format bytes to human-readable size
 */
function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes}B`;
}

/**
 * Parse SSE data line
 */
function parseSSELine(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) {
    return null;
  }

  try {
    return JSON.parse(line.slice(6)) as SSEEvent;
  } catch {
    return null;
  }
}

/**
 * Send progress update to renderer
 */
function sendProgress(
  mainWindow: BrowserWindow,
  stage: string,
  percent: number,
  message: string
): void {
  mainWindow.webContents.send('analysis-progress', { stage, percent, message });
}

/**
 * Upload via Supabase Storage for large payloads
 */
async function uploadViaStorage(
  compressedBody: Buffer,
  lambdaUrl: string,
  mainWindow: BrowserWindow
): Promise<{ storagePath: string }> {
  sendProgress(mainWindow, 'preparing', 10, 'Getting upload URL...');

  const urlResponse = await fetch(`${lambdaUrl}/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!urlResponse.ok) {
    const errorText = await urlResponse.text().catch(() => '');
    throw new Error(`Failed to get upload URL: ${urlResponse.status} ${errorText}`);
  }

  // Validate Content-Type before parsing - catch routing errors early
  const contentType = urlResponse.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const rawText = await urlResponse.text();
    console.error('[Uploader] Routing error - expected JSON from /upload-url:', {
      contentType,
      status: urlResponse.status,
      body: rawText.slice(0, 300),
    });
    throw new Error(
      'Server routing error: /upload-url returned unexpected format. ' +
        'Please try again or contact support if the issue persists.'
    );
  }

  const urlData = (await urlResponse.json()) as {
    signedUrl?: string;
    storagePath?: string;
    error?: string;
  };

  if (urlData.error || !urlData.signedUrl || !urlData.storagePath) {
    throw new Error(urlData.error || 'Invalid upload URL response');
  }

  sendProgress(
    mainWindow,
    'preparing',
    30,
    `Uploading ${formatSize(compressedBody.length)} to secure storage...`
  );

  const uploadResponse = await fetch(urlData.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: new Uint8Array(compressedBody),
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text().catch(() => '');
    throw new Error(`Storage upload failed: ${uploadResponse.status} ${errorText}`);
  }

  sendProgress(mainWindow, 'preparing', 50, 'Upload complete, starting analysis...');

  return { storagePath: urlData.storagePath };
}

/**
 * Handle SSE streaming response
 */
async function handleStreamingResponse(
  response: Response,
  mainWindow: BrowserWindow
): Promise<AnalysisResult> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let result: AnalysisResult | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const event = parseSSELine(trimmed);
        if (!event) continue;

        switch (event.type) {
          case 'progress':
            sendProgress(mainWindow, event.stage, event.progress, event.message);
            break;

          case 'result':
            result = {
              ...event.data,
              reportUrl: `${REPORT_BASE_URL}/r/${event.data.resultId}`,
            };
            break;

          case 'error':
            throw new Error(event.message || 'Analysis failed');
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const event = parseSSELine(buffer.trim());
      if (event?.type === 'result') {
        result = {
          ...event.data,
          reportUrl: `${REPORT_BASE_URL}/r/${event.data.resultId}`,
        };
      } else if (event?.type === 'error') {
        throw new Error(event.message || 'Analysis failed');
      }
    }

    if (!result) {
      throw new Error('No result received from server');
    }

    return result;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Upload session data for analysis with streaming progress
 */
export async function uploadForAnalysis(
  scanResult: ScanResult,
  userId: string,
  mainWindow: BrowserWindow,
  accessToken?: string,
  lambdaUrl: string = DEFAULT_LAMBDA_URL
): Promise<AnalysisResult> {
  const { compressed, truncated, droppedCount, originalSizeBytes, compressedSizeBytes } =
    preparePayload(scanResult, userId);

  const sizeInfo = `${formatSize(originalSizeBytes)} (gzip: ${formatSize(compressedSizeBytes)})`;

  // Route based on payload size
  if (compressedSizeBytes > USE_STORAGE_THRESHOLD) {
    sendProgress(mainWindow, 'preparing', 0, `${sizeInfo} | Using secure storage for large payload`);

    const { storagePath } = await uploadViaStorage(compressed, lambdaUrl, mainWindow);

    const response = await fetch(`${lambdaUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: JSON.stringify({ storagePath }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Analysis request failed: ${response.status} ${errorText}`);
    }

    return handleStreamingResponse(response, mainWindow);
  }

  // Small payload: Direct upload
  if (truncated) {
    sendProgress(mainWindow, 'preparing', 0, `${sizeInfo} | Excluded ${droppedCount} session(s) to fit limit`);
  } else {
    sendProgress(mainWindow, 'preparing', 0, sizeInfo);
  }

  const response = await fetch(lambdaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'gzip',
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
    body: new Uint8Array(compressed),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    let errorMessage = `Server error: ${response.status} (payload: ${formatSize(compressedSizeBytes)})`;
    try {
      const error = JSON.parse(responseText) as { message?: string };
      errorMessage = error.message || errorMessage;
    } catch {
      if (responseText) {
        errorMessage = `${errorMessage} - ${responseText.slice(0, 200)}`;
      }
    }
    throw new Error(errorMessage);
  }

  return handleStreamingResponse(response, mainWindow);
}
