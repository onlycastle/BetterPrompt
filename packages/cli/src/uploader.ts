/**
 * Server Uploader
 *
 * Handles communication with the NoMoreAISlop server
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
 * Upload session data for analysis
 */
export async function uploadForAnalysis(scanResult: ScanResult): Promise<AnalysisResult> {
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
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as UploadError;
    throw new Error(error.message || `Server error: ${response.status}`);
  }

  const result = await response.json() as AnalysisResult;

  return {
    ...result,
    reportUrl: `${API_BASE_URL}/r/${result.resultId}`,
  };
}
