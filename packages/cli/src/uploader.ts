/**
 * Server Uploader
 *
 * Handles communication with the NoMoreAISlop server
 * Supports SSE streaming for real-time progress updates
 * Uses gzip compression to reduce payload size
 */

import { gzipSync } from 'node:zlib';
import type { ScanResult } from './scanner.js';

const API_BASE_URL = process.env.NOSLOP_API_URL || 'https://www.nomoreaislop.xyz';

/**
 * Analysis endpoint path
 * Uses /api/lambda/ which is proxied to AWS Lambda for:
 * - 10MB+ payload support (vs Vercel's 4.5MB)
 * - 15 minute timeout (vs Vercel's 5 minutes)
 */
const ANALYSIS_ENDPOINT = '/api/lambda/';

/**
 * Lambda payload limit (10MB with safety margin)
 */
const PAYLOAD_LIMIT = 10 * 1024 * 1024;

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
 * Prepare payload with automatic truncation if needed
 * Returns compressed payload that fits within Vercel limits
 */
function preparePayload(scanResult: ScanResult): {
  compressed: Buffer;
  truncated: boolean;
  droppedCount: number;
} {
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

  let compressed = gzipSync(Buffer.from(JSON.stringify(payload), 'utf-8'));

  if (compressed.length <= PAYLOAD_LIMIT) {
    return { compressed, truncated: false, droppedCount: 0 };
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

  compressed = gzipSync(Buffer.from(JSON.stringify(payload), 'utf-8'));

  if (compressed.length <= PAYLOAD_LIMIT) {
    return { compressed, truncated: true, droppedCount: 0 };
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

    compressed = gzipSync(Buffer.from(JSON.stringify(payload), 'utf-8'));
  }

  return { compressed, truncated: true, droppedCount };
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
 * Upload session data for analysis with streaming progress
 */
export async function uploadForAnalysis(
  scanResult: ScanResult,
  apiKey: string,
  onProgress?: ProgressCallback
): Promise<AnalysisResult> {
  // Prepare payload with automatic truncation if needed
  const { compressed: compressedBody, truncated, droppedCount } = preparePayload(scanResult);

  // Notify about truncation
  if (truncated) {
    const msg = droppedCount > 0
      ? `Large payload detected. Truncated content and excluded ${droppedCount} session(s) to fit limits.`
      : 'Large payload detected. Session content was truncated to fit limits.';
    onProgress?.('preparing', 0, msg);
  }

  const response = await fetch(`${API_BASE_URL}${ANALYSIS_ENDPOINT}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Content-Encoding': 'gzip',  // Custom header to bypass Vercel interception
      'X-Gemini-API-Key': apiKey,
    },
    body: new Uint8Array(compressedBody),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    let errorMessage = `Server error: ${response.status}`;
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
    return await handleStreamingResponse(response, onProgress);
  } else {
    // Handle legacy JSON response (fallback)
    const result = await response.json() as AnalysisResult;
    return {
      ...result,
      reportUrl: `${API_BASE_URL}/r/${result.resultId}`,
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
              reportUrl: `${API_BASE_URL}/r/${event.data.resultId}`,
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
          reportUrl: `${API_BASE_URL}/r/${event.data.resultId}`,
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
