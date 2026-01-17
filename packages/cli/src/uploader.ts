/**
 * Server Uploader
 *
 * Handles communication with the NoMoreAISlop server
 * Supports SSE streaming for real-time progress updates
 * Uses gzip compression to reduce payload size
 *
 * For large payloads (>5MB), automatically uses Supabase Storage
 * to bypass Lambda Function URL's 6MB request limit.
 */

import { gzipSync } from 'node:zlib';
import type { ScanResult } from './scanner.js';

/**
 * Lambda Function URL for analysis API
 * Calls Lambda directly to bypass Vercel's 4.5MB body size limit
 * - 15 minute timeout
 * - Supports Supabase Storage for large payloads
 */
const DEFAULT_LAMBDA_URL = 'https://kgdby5xqjypfnlihknmcllqwgq0labzp.lambda-url.ap-northeast-2.on.aws';
const LAMBDA_API_URL = process.env.NOSLOP_API_URL || DEFAULT_LAMBDA_URL;

/**
 * Web app base URL for report links
 */
const REPORT_BASE_URL = 'https://www.nomoreaislop.xyz';

/**
 * Threshold for using Supabase Storage upload
 * Lambda Function URL has a hard 6MB request payload limit
 * Use Storage for anything larger than 5MB (with safety margin)
 */
const USE_STORAGE_THRESHOLD = 5 * 1024 * 1024;

/**
 * Maximum payload size (for truncation purposes)
 * This is effectively unlimited now since we use Storage for large payloads
 */
const PAYLOAD_LIMIT = 100 * 1024 * 1024;

/**
 * Target content length per session after truncation (characters)
 */
const TRUNCATED_CONTENT_LENGTH = 150_000;

/**
 * Truncate JSONL content to keep most recent messages
 * Preserves the structure while reducing size
 */
function truncateSessionContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;

  const lines = content.split('\n');
  const result: string[] = [];
  let currentLength = 0;

  // Keep lines from the end (most recent messages) up to maxLength
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (currentLength + line.length + 1 > maxLength) break;
    result.unshift(line);
    currentLength += line.length + 1;
  }

  return result.join('\n');
}

/**
 * Result of payload preparation with size metrics for debugging
 */
interface PreparePayloadResult {
  compressed: Buffer;
  truncated: boolean;
  droppedCount: number;
  originalSizeBytes: number;      // Raw JSON size before any truncation
  truncatedSizeBytes: number;     // JSON size after truncation (before compression)
  compressedSizeBytes: number;    // Final gzip compressed size
}

/**
 * Prepare payload with automatic truncation if needed
 * Returns compressed payload that fits within Lambda limits
 */
function preparePayload(scanResult: ScanResult): PreparePayloadResult {
  // First attempt: full payload
  let sessions = scanResult.sessions.map(s => ({
    sessionId: s.metadata.sessionId,
    projectName: s.metadata.projectName,
    messageCount: s.metadata.messageCount,
    durationMinutes: Math.round(s.metadata.durationSeconds / 60),
    content: s.content,
  }));

  let payload = {
    sessions,
    totalMessages: scanResult.totalMessages,
    totalDurationMinutes: scanResult.totalDurationMinutes,
  };

  // Track original size before any modifications
  const originalJson = JSON.stringify(payload);
  const originalSizeBytes = Buffer.byteLength(originalJson, 'utf-8');

  let compressed = gzipSync(Buffer.from(originalJson, 'utf-8'));

  if (compressed.length <= PAYLOAD_LIMIT) {
    return {
      compressed,
      truncated: false,
      droppedCount: 0,
      originalSizeBytes,
      truncatedSizeBytes: originalSizeBytes,
      compressedSizeBytes: compressed.length,
    };
  }

  // Second attempt: truncate session content
  sessions = scanResult.sessions.map(s => ({
    sessionId: s.metadata.sessionId,
    projectName: s.metadata.projectName,
    messageCount: s.metadata.messageCount,
    durationMinutes: Math.round(s.metadata.durationSeconds / 60),
    content: truncateSessionContent(s.content, TRUNCATED_CONTENT_LENGTH),
  }));

  payload = {
    sessions,
    totalMessages: scanResult.totalMessages,
    totalDurationMinutes: scanResult.totalDurationMinutes,
  };

  let truncatedJson = JSON.stringify(payload);
  compressed = gzipSync(Buffer.from(truncatedJson, 'utf-8'));

  if (compressed.length <= PAYLOAD_LIMIT) {
    return {
      compressed,
      truncated: true,
      droppedCount: 0,
      originalSizeBytes,
      truncatedSizeBytes: Buffer.byteLength(truncatedJson, 'utf-8'),
      compressedSizeBytes: compressed.length,
    };
  }

  // Third attempt: drop sessions until it fits (keep most recent)
  let droppedCount = 0;
  while (sessions.length > 1 && compressed.length > PAYLOAD_LIMIT) {
    sessions.pop(); // Remove oldest session
    droppedCount++;

    payload = {
      sessions,
      totalMessages: sessions.reduce((sum, s) => sum + s.messageCount, 0),
      totalDurationMinutes: sessions.reduce((sum, s) => sum + s.durationMinutes, 0),
    };

    truncatedJson = JSON.stringify(payload);
    compressed = gzipSync(Buffer.from(truncatedJson, 'utf-8'));
  }

  return {
    compressed,
    truncated: true,
    droppedCount,
    originalSizeBytes,
    truncatedSizeBytes: Buffer.byteLength(truncatedJson, 'utf-8'),
    compressedSizeBytes: compressed.length,
  };
}

export interface AnalysisResult {
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
  reportUrl: string;
}

export interface UploadError {
  code: string;
  message: string;
}

/**
 * SSE Event types from the server
 */
type SSEEvent =
  | { type: 'progress'; stage: string; progress: number; message: string }
  | { type: 'result'; data: Omit<AnalysisResult, 'reportUrl'> }
  | { type: 'error'; code: string; message: string };

/**
 * Progress callback for UI updates
 */
export type ProgressCallback = (stage: string, progress: number, message: string) => void;

/**
 * Parse SSE data line
 */
function parseSSELine(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) return null;

  try {
    return JSON.parse(line.slice(6)) as SSEEvent;
  } catch {
    return null;
  }
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
 * Response from /upload-url endpoint
 */
interface UploadUrlResponse {
  signedUrl?: string;
  storagePath?: string;
  token?: string;
  path?: string;
  error?: string;
}

/**
 * Upload large payload via Supabase Storage (presigned URL)
 * Used when payload exceeds Lambda Function URL's 6MB limit
 */
async function uploadViaStorage(
  compressedBody: Buffer,
  onProgress?: ProgressCallback
): Promise<{ storagePath: string }> {
  // 1. Get signed upload URL from Lambda
  onProgress?.('preparing', 10, 'Getting upload URL...');

  const urlResponse = await fetch(`${LAMBDA_API_URL}/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!urlResponse.ok) {
    const errorText = await urlResponse.text().catch(() => '');
    throw new Error(`Failed to get upload URL: ${urlResponse.status} ${errorText}`);
  }

  const urlData = await urlResponse.json() as UploadUrlResponse;

  if (urlData.error || !urlData.signedUrl || !urlData.storagePath) {
    throw new Error(urlData.error || 'Invalid upload URL response');
  }

  // 2. Upload to Supabase Storage via signed URL
  onProgress?.('preparing', 30, `Uploading ${formatSize(compressedBody.length)} to secure storage...`);

  const uploadResponse = await fetch(urlData.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: new Uint8Array(compressedBody),
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text().catch(() => '');
    throw new Error(`Storage upload failed: ${uploadResponse.status} ${errorText}`);
  }

  onProgress?.('preparing', 50, 'Upload complete, starting analysis...');

  return { storagePath: urlData.storagePath };
}

/**
 * Upload session data for analysis with streaming progress
 * Automatically uses Supabase Storage for large payloads (>5MB)
 */
export async function uploadForAnalysis(
  scanResult: ScanResult,
  apiKey: string,
  onProgress?: ProgressCallback
): Promise<AnalysisResult> {
  // Prepare payload with automatic truncation if needed
  const {
    compressed: compressedBody,
    truncated,
    droppedCount,
    originalSizeBytes,
    truncatedSizeBytes,
    compressedSizeBytes,
  } = preparePayload(scanResult);

  // Build size info string for user feedback
  const sizeInfo = truncated
    ? `${formatSize(originalSizeBytes)} → ${formatSize(truncatedSizeBytes)} (gzip: ${formatSize(compressedSizeBytes)})`
    : `${formatSize(originalSizeBytes)} (gzip: ${formatSize(compressedSizeBytes)})`;

  // Route based on payload size
  if (compressedSizeBytes > USE_STORAGE_THRESHOLD) {
    // Large payload: Use Supabase Storage path
    onProgress?.('preparing', 0, `${sizeInfo} | Using secure storage for large payload`);

    const { storagePath } = await uploadViaStorage(compressedBody, onProgress);

    // Trigger analysis from storage
    const response = await fetch(`${LAMBDA_API_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gemini-API-Key': apiKey,
      },
      body: JSON.stringify({ storagePath }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Analysis request failed: ${response.status} ${errorText}`);
    }

    return handleStreamingResponse(response, onProgress);
  }

  // Small payload: Direct upload (legacy path)
  if (truncated) {
    const truncationMsg = droppedCount > 0
      ? `Truncated and excluded ${droppedCount} session(s)`
      : 'Session content truncated';
    onProgress?.('preparing', 0, `${sizeInfo} | ${truncationMsg}`);
  } else {
    onProgress?.('preparing', 0, sizeInfo);
  }

  const response = await fetch(LAMBDA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Content-Encoding': 'gzip',
      'X-Gemini-API-Key': apiKey,
    },
    body: new Uint8Array(compressedBody),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    let errorMessage = `Server error: ${response.status} (payload: ${formatSize(compressedSizeBytes)})`;
    try {
      const error = JSON.parse(responseText) as UploadError;
      errorMessage = error.message || errorMessage;
    } catch {
      // Response is not JSON, include raw text for debugging
      if (responseText) {
        errorMessage = `${errorMessage} - ${responseText.slice(0, 200)}`;
      }
    }
    throw new Error(errorMessage);
  }

  // Check if response is SSE stream
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('text/event-stream')) {
    // Handle SSE streaming response
    return handleStreamingResponse(response, onProgress);
  } else {
    // Handle legacy JSON response (fallback)
    const result = await response.json() as AnalysisResult;
    return {
      ...result,
      reportUrl: `${REPORT_BASE_URL}/r/${result.resultId}`,
    };
  }
}

/**
 * Handle SSE streaming response
 */
async function handleStreamingResponse(
  response: Response,
  onProgress?: ProgressCallback
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

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const event = parseSSELine(trimmed);
        if (!event) continue;

        switch (event.type) {
          case 'progress':
            onProgress?.(event.stage, event.progress, event.message);
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

    // Process any remaining buffer
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
 * Legacy upload function (non-streaming)
 * Kept for backward compatibility
 */
export async function uploadForAnalysisLegacy(scanResult: ScanResult, apiKey: string): Promise<AnalysisResult> {
  return uploadForAnalysis(scanResult, apiKey);
}
