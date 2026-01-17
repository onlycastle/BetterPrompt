/**
 * Server Uploader
 *
 * Handles communication with the NoMoreAISlop server
 * Supports SSE streaming for real-time progress updates
 */

import type { ScanResult } from './scanner.js';

const API_BASE_URL = process.env.NOSLOP_API_URL || 'https://www.nomoreaislop.xyz';

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
  const payload = {
    sessions: scanResult.sessions.map(s => ({
      sessionId: s.metadata.sessionId,
      projectName: s.metadata.projectName,
      messageCount: s.metadata.messageCount,
      durationMinutes: Math.round(s.metadata.durationSeconds / 60),
      content: s.content,
    })),
    totalMessages: scanResult.totalMessages,
    totalDurationMinutes: scanResult.totalDurationMinutes,
  };

  const response = await fetch(`${API_BASE_URL}/api/analysis/remote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Gemini-API-Key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as UploadError;
    throw new Error(error.message || `Server error: ${response.status}`);
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

      // DEBUG: Log raw SSE data
      console.error('[DEBUG] Raw chunk:', JSON.stringify(value ? decoder.decode(value) : 'empty'));

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const event = parseSSELine(trimmed);
        console.error('[DEBUG] Parsed event:', event ? event.type : 'null', trimmed.slice(0, 100));
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
      console.error('[DEBUG] Stream ended without result. Final buffer:', buffer);
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
