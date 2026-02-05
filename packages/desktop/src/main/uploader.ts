/**
 * Server Uploader
 *
 * Handles communication with the NoMoreAISlop Lambda server.
 * Supports SSE streaming for real-time progress updates.
 * Uses gzip compression to reduce payload size.
 *
 * Always uploads via S3 presigned URL to bypass Lambda Function URL payload limits.
 * Flow: GET /upload-url → PUT S3 → POST /analyze {s3Key}
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
const REPORT_BASE_URL = 'https://www.nomoreaislop.app';

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
    analyst: number;
    conductor: number;
    speedrunner: number;
    trendsetter: number;
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
 * Upload via S3 presigned URL for large payloads
 *
 * Flow:
 * 1. Get presigned PUT URL from Lambda
 * 2. Upload directly to S3 (bypasses Lambda payload limits)
 * 3. Return s3Key for Lambda to read from S3
 */
async function uploadViaS3(
  compressedBody: Buffer,
  lambdaUrl: string,
  mainWindow: BrowserWindow
): Promise<{ s3Key: string }> {
  const uploadUrlEndpoint = `${lambdaUrl}/upload-url`;
  console.log('[Uploader] Getting S3 presigned URL from:', uploadUrlEndpoint);
  sendProgress(mainWindow, 'preparing', 10, 'Getting S3 upload URL...');

  const urlResponse = await fetch(uploadUrlEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const contentType = urlResponse.headers.get('content-type') || '';
  console.log('[Uploader] /upload-url response:', {
    status: urlResponse.status,
    contentType,
    headers: Object.fromEntries(urlResponse.headers.entries()),
  });

  if (!urlResponse.ok) {
    const errorText = await urlResponse.text().catch(() => '');
    console.error('[Uploader] /upload-url failed:', {
      status: urlResponse.status,
      body: errorText.slice(0, 500),
    });
    throw new Error(`Failed to get S3 upload URL: ${urlResponse.status} ${errorText}`);
  }

  // Validate Content-Type before parsing - catch routing errors early
  if (!contentType.includes('application/json')) {
    const rawText = await urlResponse.text();
    console.error('[Uploader] Routing error - expected JSON from /upload-url:', {
      contentType,
      status: urlResponse.status,
      body: rawText.slice(0, 500),
    });
    throw new Error(
      'Server routing error: /upload-url returned unexpected format. ' +
        'Please try again or contact support if the issue persists.'
    );
  }

  const urlText = await urlResponse.text();
  console.log('[Uploader] /upload-url response body:', urlText.slice(0, 300));

  let urlData: {
    signedUrl?: string;
    s3Key?: string;
    bucket?: string;
    expiresIn?: number;
    error?: string;
  };

  try {
    urlData = JSON.parse(urlText);
  } catch (parseError) {
    console.error('[Uploader] JSON parse error for /upload-url:', {
      error: parseError,
      body: urlText.slice(0, 500),
    });
    throw new Error(`JSON parse error from /upload-url: ${urlText.slice(0, 100)}`);
  }

  if (urlData.error || !urlData.signedUrl || !urlData.s3Key) {
    throw new Error(urlData.error || 'Invalid S3 upload URL response');
  }

  console.log('[Uploader] S3 upload target:', {
    bucket: urlData.bucket,
    s3Key: urlData.s3Key,
    expiresIn: urlData.expiresIn,
  });

  sendProgress(
    mainWindow,
    'preparing',
    30,
    `Uploading ${formatSize(compressedBody.length)} to S3...`
  );

  const uploadResponse = await fetch(urlData.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: new Uint8Array(compressedBody),
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text().catch(() => '');
    throw new Error(`S3 upload failed: ${uploadResponse.status} ${errorText}`);
  }

  console.log('[Uploader] S3 upload complete:', urlData.s3Key);
  sendProgress(mainWindow, 'preparing', 50, 'Upload complete, starting analysis...');

  return { s3Key: urlData.s3Key };
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
  console.log('[Uploader] Starting upload for analysis');
  console.log('[Uploader] Lambda URL:', lambdaUrl);
  console.log('[Uploader] Sessions count:', scanResult.sessions.length);

  const { compressed, truncated, droppedCount, originalSizeBytes, compressedSizeBytes } =
    preparePayload(scanResult, userId);

  const sizeInfo = `${formatSize(originalSizeBytes)} (gzip: ${formatSize(compressedSizeBytes)})`;
  console.log('[Uploader] Payload size:', {
    original: formatSize(originalSizeBytes),
    compressed: formatSize(compressedSizeBytes),
  });

  if (truncated) {
    sendProgress(mainWindow, 'preparing', 0, `${sizeInfo} | Excluded ${droppedCount} session(s) to fit limit`);
  } else {
    sendProgress(mainWindow, 'preparing', 0, `${sizeInfo} | Using secure storage`);
  }

  const { s3Key } = await uploadViaS3(compressed, lambdaUrl, mainWindow);
  console.log('[Uploader] S3 upload complete, s3Key:', s3Key);

  const analyzeUrl = `${lambdaUrl}/analyze`;
  console.log('[Uploader] Starting analysis with s3Key:', analyzeUrl);

  const response = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
    body: JSON.stringify({ s3Key }),
  });

  console.log('[Uploader] /analyze response:', {
    status: response.status,
    contentType: response.headers.get('content-type'),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[Uploader] /analyze failed:', {
      status: response.status,
      body: errorText.slice(0, 500),
    });
    throw new Error(`Analysis request failed: ${response.status} ${errorText}`);
  }

  return handleStreamingResponse(response, mainWindow);
}
