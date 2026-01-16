/**
 * Session Selector - Duration-based optimal session selection
 *
 * Selects the most informative sessions for analysis based on:
 * - Duration (weight: 0.6) - longer sessions have more behavioral data
 * - Recency (weight: 0.3) - recent sessions are more relevant
 * - Message count (weight: 0.1) - more messages = richer context
 */

import { type SessionMetadata } from '../domain/models/analysis';

export interface SessionSelectionConfig {
  maxSessions: number;
  minDurationSeconds: number;
  recencyWindowDays: number;
  priorityWeight: {
    duration: number;
    recency: number;
    messageCount: number;
  };
}

export const DEFAULT_SELECTION_CONFIG: SessionSelectionConfig = {
  maxSessions: 30,
  minDurationSeconds: 300, // 5 minutes minimum
  recencyWindowDays: 90,
  priorityWeight: {
    duration: 0.6,
    recency: 0.3,
    messageCount: 0.1,
  },
};

interface ScoredSession {
  session: SessionMetadata;
  score: number;
  breakdown: {
    durationScore: number;
    recencyScore: number;
    messageScore: number;
  };
}

/**
 * Calculate normalized score for a session
 */
function calculateSessionScore(
  session: SessionMetadata,
  weights: SessionSelectionConfig['priorityWeight'],
  stats: {
    maxDuration: number;
    minTimestamp: number;
    maxTimestamp: number;
    maxMessages: number;
  }
): ScoredSession {
  // Normalize duration (0-1 scale)
  const durationScore = stats.maxDuration > 0
    ? session.durationSeconds / stats.maxDuration
    : 0;

  // Normalize recency (0-1, more recent = higher)
  const sessionTime = session.timestamp.getTime();
  const timeRange = stats.maxTimestamp - stats.minTimestamp;
  const recencyScore = timeRange > 0
    ? (sessionTime - stats.minTimestamp) / timeRange
    : 1;

  // Normalize message count
  const messageScore = stats.maxMessages > 0
    ? session.messageCount / stats.maxMessages
    : 0;

  const score =
    weights.duration * durationScore +
    weights.recency * recencyScore +
    weights.messageCount * messageScore;

  return {
    session,
    score,
    breakdown: {
      durationScore,
      recencyScore,
      messageScore,
    },
  };
}

/**
 * Select optimal sessions for analysis based on duration, recency, and message count
 *
 * @param allSessions - All available sessions
 * @param config - Selection configuration
 * @returns Selected sessions sorted by score (best first)
 */
export function selectOptimalSessions(
  allSessions: SessionMetadata[],
  config: Partial<SessionSelectionConfig> = {}
): SessionMetadata[] {
  const opts = { ...DEFAULT_SELECTION_CONFIG, ...config };

  // 1. Filter by recency window
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - opts.recencyWindowDays);

  const eligibleSessions = allSessions.filter(
    (s) =>
      s.timestamp >= cutoffDate && s.durationSeconds >= opts.minDurationSeconds
  );

  if (eligibleSessions.length === 0) {
    // Fallback: if no sessions meet criteria, relax duration filter
    const relaxedSessions = allSessions.filter(
      (s) => s.timestamp >= cutoffDate && s.durationSeconds >= 60
    );
    if (relaxedSessions.length === 0) {
      return allSessions.slice(0, opts.maxSessions);
    }
    return relaxedSessions.slice(0, opts.maxSessions);
  }

  // 2. Calculate stats for normalization
  const stats = {
    maxDuration: Math.max(...eligibleSessions.map((s) => s.durationSeconds)),
    minTimestamp: Math.min(
      ...eligibleSessions.map((s) => s.timestamp.getTime())
    ),
    maxTimestamp: Math.max(
      ...eligibleSessions.map((s) => s.timestamp.getTime())
    ),
    maxMessages: Math.max(...eligibleSessions.map((s) => s.messageCount)),
  };

  // 3. Score each session
  const scoredSessions = eligibleSessions.map((session) =>
    calculateSessionScore(session, opts.priorityWeight, stats)
  );

  // 4. Sort by score and take top N
  scoredSessions.sort((a, b) => b.score - a.score);

  return scoredSessions.slice(0, opts.maxSessions).map((s) => s.session);
}

/**
 * Get selection statistics for display
 */
export function getSelectionStats(
  allSessions: SessionMetadata[],
  selectedSessions: SessionMetadata[]
): {
  totalAvailable: number;
  selected: number;
  avgDurationMinutes: number;
  totalDurationMinutes: number;
  dateRange: { oldest: Date; newest: Date } | null;
} {
  const totalDuration = selectedSessions.reduce(
    (sum, s) => sum + s.durationSeconds,
    0
  );

  const dates = selectedSessions.map((s) => s.timestamp);
  const dateRange =
    dates.length > 0
      ? {
          oldest: new Date(Math.min(...dates.map((d) => d.getTime()))),
          newest: new Date(Math.max(...dates.map((d) => d.getTime()))),
        }
      : null;

  return {
    totalAvailable: allSessions.length,
    selected: selectedSessions.length,
    avgDurationMinutes: Math.round(totalDuration / selectedSessions.length / 60),
    totalDurationMinutes: Math.round(totalDuration / 60),
    dateRange,
  };
}
