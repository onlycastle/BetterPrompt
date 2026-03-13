/**
 * API Client
 *
 * HTTP client for communicating with the BetterPrompt server.
 * Authentication is no longer required — all endpoints work without tokens.
 */

import { getConfig } from './config.js';

export interface UserSummary {
  resultId: string;
  analyzedAt: string;
  profile: {
    primaryType: string;
    controlLevel: string;
    matrixName: string;
    personalitySummary: string;
    domainScores: Record<string, number>;
  };
  growthAreas: Array<{
    title: string;
    domain: string;
    severity: string;
    recommendation: string;
  }>;
  strengths: Array<{
    domain: string;
    domainLabel: string;
    topStrength: string;
    domainScore: number;
  }>;
  antiPatterns: Array<{
    pattern: string;
    frequency: number;
    impact: string;
  }>;
  kpt: {
    keep: string[];
    problem: string[];
    tryNext: string[];
  };
}

export interface ApiError {
  error: string;
  message: string;
}

/**
 * Fetch the user's analysis summary from the server.
 * Returns null if no analysis exists yet.
 * Throws on network or auth errors.
 */
export async function fetchUserSummary(): Promise<UserSummary | null> {
  const config = getConfig();

  const url = `${config.serverUrl}/api/analysis/user/summary`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Partial<ApiError>;
    throw new Error(
      `Server error (${response.status}): ${body.message ?? 'Unknown error'}`,
    );
  }

  const data = await response.json() as { summary: UserSummary | null };
  return data.summary;
}

/**
 * Verify server connectivity by hitting /api/auth/me.
 * No authentication required — always succeeds if server is reachable.
 */
export async function verifyAuth(): Promise<{ id: string; email: string } | null> {
  const config = getConfig();

  try {
    const response = await fetch(`${config.serverUrl}/api/auth/me`, {
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) return null;

    const data = await response.json() as { id: string; email: string };
    return data;
  } catch {
    return null;
  }
}
