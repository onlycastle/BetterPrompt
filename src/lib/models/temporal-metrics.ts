/**
 * Temporal Metrics - 100% Measurable Data Models
 *
 * These metrics are calculated deterministically from session data,
 * NOT from LLM judgment. This ensures:
 * - Reproducibility: Same input = same output
 * - Testability: Can unit test without mocking LLMs
 * - Transparency: Users know exactly how metrics are derived
 *
 * @module models/temporal-metrics
 */

import { z } from 'zod';

// ============================================================================
// Activity Heatmap (Tier 1: Visual Patterns)
// ============================================================================

/**
 * Activity distribution by time
 * - All counts are deterministic (message counting)
 */
export interface ActivityHeatmap {
  /** Message counts for each hour [0-23] */
  hourlyMessageCount: number[];
  /** Message counts for each day of week [0-6], 0 = Sunday */
  dailyMessageCount: number[];
  /** Top 3 most active hours (sorted by count desc) */
  peakHours: number[];
  /** Bottom 3 least active hours with some activity */
  quietHours: number[];
  /** Total messages counted */
  totalMessages: number;
}

// ============================================================================
// Session Patterns (Tier 2: Session-level Statistics)
// ============================================================================

/**
 * Statistics for sessions starting at a specific hour
 */
export interface HourlySessionStats {
  /** Hour (0-23) */
  hour: number;
  /** Number of sessions that started at this hour */
  sessionCount: number;
  /** Average session duration in minutes */
  avgDurationMinutes: number;
  /** Average number of user messages per session */
  avgMessagesPerSession: number;
  /** Average tool calls per session */
  avgToolCallsPerSession: number;
}

/**
 * Aggregated session patterns
 */
export interface SessionPatterns {
  /** Stats grouped by session start hour */
  byHour: HourlySessionStats[];
  /** Overall average session duration in minutes */
  avgSessionDurationMinutes: number;
  /** Overall average messages per session */
  avgMessagesPerSession: number;
  /** Overall average tool calls per session */
  avgToolCallsPerSession: number;
  /** Total sessions analyzed */
  totalSessions: number;
}

// ============================================================================
// Engagement Signals (Tier 3: Behavioral Indicators)
// ============================================================================

/**
 * Engagement signals derived from message content
 * These are pattern-based, not LLM-judged
 */
export interface EngagementSignals {
  /**
   * Rate of messages containing question marks (?)
   * Proxy for inquiry/clarification behavior
   * Range: 0-1
   */
  questionRate: number;

  /**
   * Rate of very short user messages (<= 20 chars)
   * Includes: "ok", "yes", "done", "thanks", etc.
   * Range: 0-1
   */
  shortResponseRate: number;

  /**
   * Rate of tool error retries (same tool called after error)
   * Indicates persistence/debugging behavior
   * Range: 0-1 (of error occurrences)
   */
  errorRetryRate: number;

  /**
   * Rate of sessions with 5+ user turns
   * Indicates deep engagement sessions
   * Range: 0-1
   */
  deepSessionRate: number;

  /**
   * Average user message length in characters
   */
  avgMessageLength: number;

  /**
   * Rate of messages containing code blocks (```)
   * Range: 0-1
   */
  codeBlockRate: number;
}

// ============================================================================
// Hourly Engagement (Tier 4: Time-based Engagement Comparison)
// ============================================================================

/**
 * Engagement metrics for a specific hour
 * Allows comparing engagement patterns across time
 */
export interface HourlyEngagement {
  /** Hour (0-23) */
  hour: number;
  /** Average session length for sessions starting at this hour (minutes) */
  avgSessionLengthMinutes: number;
  /** Question rate for messages at this hour */
  questionRate: number;
  /** Short response rate for messages at this hour */
  shortResponseRate: number;
  /** Average message length at this hour */
  avgMessageLength: number;
  /** Number of messages analyzed (for confidence) */
  sampleSize: number;
}

// ============================================================================
// Combined Temporal Metrics
// ============================================================================

/**
 * Complete temporal metrics - all 100% measurable
 */
export interface TemporalMetrics {
  // Tier 1: Activity Heatmap
  activityHeatmap: ActivityHeatmap;

  // Tier 2: Session Patterns
  sessionPatterns: SessionPatterns;

  // Tier 3: Engagement Signals (overall)
  engagementSignals: EngagementSignals;

  // Tier 4: Hourly Engagement (time-based comparison)
  hourlyEngagement: HourlyEngagement[];

  // Metadata
  analysisMetadata: {
    totalSessions: number;
    totalMessages: number;
    dateRangeStart: string; // ISO date
    dateRangeEnd: string; // ISO date
    generatedAt: string; // ISO datetime
  };
}

// ============================================================================
// Zod Schema for Temporal Metrics (for validation/serialization)
// ============================================================================

export const ActivityHeatmapSchema = z.object({
  hourlyMessageCount: z.array(z.number()).length(24),
  dailyMessageCount: z.array(z.number()).length(7),
  peakHours: z.array(z.number()).max(3),
  quietHours: z.array(z.number()).max(3),
  totalMessages: z.number(),
});

export const HourlySessionStatsSchema = z.object({
  hour: z.number().min(0).max(23),
  sessionCount: z.number(),
  avgDurationMinutes: z.number(),
  avgMessagesPerSession: z.number(),
  avgToolCallsPerSession: z.number(),
});

export const SessionPatternsSchema = z.object({
  byHour: z.array(HourlySessionStatsSchema),
  avgSessionDurationMinutes: z.number(),
  avgMessagesPerSession: z.number(),
  avgToolCallsPerSession: z.number(),
  totalSessions: z.number(),
});

export const EngagementSignalsSchema = z.object({
  questionRate: z.number().min(0).max(1),
  shortResponseRate: z.number().min(0).max(1),
  errorRetryRate: z.number().min(0).max(1),
  deepSessionRate: z.number().min(0).max(1),
  avgMessageLength: z.number(),
  codeBlockRate: z.number().min(0).max(1),
});

export const HourlyEngagementSchema = z.object({
  hour: z.number().min(0).max(23),
  avgSessionLengthMinutes: z.number(),
  questionRate: z.number().min(0).max(1),
  shortResponseRate: z.number().min(0).max(1),
  avgMessageLength: z.number(),
  sampleSize: z.number(),
});

export const TemporalMetricsSchema = z.object({
  activityHeatmap: ActivityHeatmapSchema,
  sessionPatterns: SessionPatternsSchema,
  engagementSignals: EngagementSignalsSchema,
  hourlyEngagement: z.array(HourlyEngagementSchema),
  analysisMetadata: z.object({
    totalSessions: z.number(),
    totalMessages: z.number(),
    dateRangeStart: z.string(),
    dateRangeEnd: z.string(),
    generatedAt: z.string(),
  }),
});

// ============================================================================
// Default/Empty Values
// ============================================================================

/**
 * Create empty temporal metrics (for initialization or error cases)
 */
export function createEmptyTemporalMetrics(): TemporalMetrics {
  return {
    activityHeatmap: {
      hourlyMessageCount: new Array(24).fill(0),
      dailyMessageCount: new Array(7).fill(0),
      peakHours: [],
      quietHours: [],
      totalMessages: 0,
    },
    sessionPatterns: {
      byHour: [],
      avgSessionDurationMinutes: 0,
      avgMessagesPerSession: 0,
      avgToolCallsPerSession: 0,
      totalSessions: 0,
    },
    engagementSignals: {
      questionRate: 0,
      shortResponseRate: 0,
      errorRetryRate: 0,
      deepSessionRate: 0,
      avgMessageLength: 0,
      codeBlockRate: 0,
    },
    hourlyEngagement: [],
    analysisMetadata: {
      totalSessions: 0,
      totalMessages: 0,
      dateRangeStart: '',
      dateRangeEnd: '',
      generatedAt: new Date().toISOString(),
    },
  };
}
