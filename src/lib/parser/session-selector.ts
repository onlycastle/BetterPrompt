/**
 * Session Selector - Context-aware optimal session selection
 *
 * Selects the most informative sessions for analysis based on:
 * - Message count (weight: 0.5) - more messages = richer behavioral data
 * - Context optimality (weight: 0.25) - lower utilization = cleaner AI responses
 * - Recency (weight: 0.25) - recent sessions are more relevant
 *
 * Context optimality: Sessions with avg context utilization <60% are preferred
 * because high utilization (>60%) correlates with AI confusion/hallucinations.
 */

import { type SessionMetadata } from '../domain/models/analysis';

/**
 * Context utilization threshold - sessions above this may have degraded AI quality
 */
const CONTEXT_OPTIMAL_THRESHOLD = 60;

export interface SessionSelectionConfig {
  maxSessions: number;
  minMessageCount: number;
  recencyWindowDays: number;
  priorityWeight: {
    messageCount: number;
    contextOptimality: number;
    recency: number;
  };
}

export const DEFAULT_SELECTION_CONFIG: SessionSelectionConfig = {
  maxSessions: 30,
  minMessageCount: 10, // Minimum 10 messages for meaningful analysis
  recencyWindowDays: 90,
  priorityWeight: {
    messageCount: 0.5,
    contextOptimality: 0.25,
    recency: 0.25,
  },
};

interface ScoredSession {
  session: SessionMetadata;
  score: number;
  breakdown: {
    messageScore: number;
    contextOptimalityScore: number;
    recencyScore: number;
  };
}

/**
 * Calculate normalized score for a session
 */
function calculateSessionScore(
  session: SessionMetadata,
  weights: SessionSelectionConfig['priorityWeight'],
  stats: {
    minTimestamp: number;
    maxTimestamp: number;
    maxMessages: number;
  }
): ScoredSession {
  // Normalize message count (0-1 scale, more = better)
  const messageScore = stats.maxMessages > 0
    ? session.messageCount / stats.maxMessages
    : 0;

  // Context optimality: Lower utilization = better score
  // Score 1.0 if utilization <= 60%, decreasing linearly to 0 at 100%
  let contextOptimalityScore: number;
  if (session.avgContextUtilization === undefined) {
    // Fallback: neutral score if no utilization data
    contextOptimalityScore = 0.5;
  } else if (session.avgContextUtilization <= CONTEXT_OPTIMAL_THRESHOLD) {
    // Below threshold: full score
    contextOptimalityScore = 1.0;
  } else {
    // Above threshold: linear penalty (60% → 1.0, 100% → 0.0)
    contextOptimalityScore = Math.max(
      0,
      1 - (session.avgContextUtilization - CONTEXT_OPTIMAL_THRESHOLD) / (100 - CONTEXT_OPTIMAL_THRESHOLD)
    );
  }

  // Normalize recency (0-1, more recent = higher)
  const sessionTime = session.timestamp.getTime();
  const timeRange = stats.maxTimestamp - stats.minTimestamp;
  const recencyScore = timeRange > 0
    ? (sessionTime - stats.minTimestamp) / timeRange
    : 1;

  const score =
    weights.messageCount * messageScore +
    weights.contextOptimality * contextOptimalityScore +
    weights.recency * recencyScore;

  return {
    session,
    score,
    breakdown: {
      messageScore,
      contextOptimalityScore,
      recencyScore,
    },
  };
}

/**
 * Select optimal sessions for analysis based on message count, context optimality, and recency
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

  // 1. Filter by recency window and minimum message count
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - opts.recencyWindowDays);

  const eligibleSessions = allSessions.filter(
    (s) =>
      s.timestamp >= cutoffDate && s.messageCount >= opts.minMessageCount
  );

  if (eligibleSessions.length === 0) {
    // Fallback: if no sessions meet criteria, relax message count filter
    const relaxedSessions = allSessions.filter(
      (s) => s.timestamp >= cutoffDate && s.messageCount >= 5
    );
    if (relaxedSessions.length === 0) {
      return allSessions.slice(0, opts.maxSessions);
    }
    return relaxedSessions.slice(0, opts.maxSessions);
  }

  // 2. Calculate stats for normalization
  const stats = {
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
