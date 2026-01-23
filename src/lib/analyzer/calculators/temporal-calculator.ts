/**
 * Temporal Calculator - Pure Functions for Measurable Metrics
 *
 * All functions in this module are pure (no side effects, deterministic).
 * They calculate temporal metrics from session data without any LLM involvement.
 *
 * Design principles:
 * - No LLM calls - all metrics are computed deterministically
 * - No side effects - pure functions only
 * - No fallbacks - throws on invalid input (fail fast)
 *
 * @module analyzer/calculators/temporal-calculator
 */

import type { ParsedSession, ParsedMessage } from '../../models/session';
import type {
  TemporalMetrics,
  ActivityHeatmap,
  SessionPatterns,
  HourlySessionStats,
  EngagementSignals,
  HourlyEngagement,
} from '../../models/temporal-metrics';

// ============================================================================
// Constants
// ============================================================================

/** Threshold for "short" response (characters) */
const SHORT_MESSAGE_THRESHOLD = 20;

/** Threshold for "deep" session (user messages) */
const DEEP_SESSION_THRESHOLD = 5;

/** Regex for question detection */
const QUESTION_REGEX = /\?/;

/** Regex for code block detection */
const CODE_BLOCK_REGEX = /```/;

// ============================================================================
// Main Calculator Function
// ============================================================================

/**
 * Calculate all temporal metrics from session data
 *
 * @param sessions - Parsed sessions to analyze
 * @returns Complete temporal metrics object
 * @throws Error if sessions array is empty
 */
export function calculateTemporalMetrics(sessions: ParsedSession[]): TemporalMetrics {
  if (sessions.length === 0) {
    throw new Error('Cannot calculate temporal metrics: no sessions provided');
  }

  // Extract all user messages with their timestamps
  const userMessages = extractUserMessages(sessions);

  // Calculate each tier of metrics
  const activityHeatmap = calculateActivityHeatmap(userMessages);
  const sessionPatterns = calculateSessionPatterns(sessions);
  const engagementSignals = calculateEngagementSignals(userMessages, sessions);
  const hourlyEngagement = calculateHourlyEngagement(userMessages, sessions);

  // Build metadata
  const timestamps = userMessages.map((m) => m.timestamp.getTime());
  const dateRangeStart = new Date(Math.min(...timestamps)).toISOString().split('T')[0];
  const dateRangeEnd = new Date(Math.max(...timestamps)).toISOString().split('T')[0];

  return {
    activityHeatmap,
    sessionPatterns,
    engagementSignals,
    hourlyEngagement,
    analysisMetadata: {
      totalSessions: sessions.length,
      totalMessages: userMessages.length,
      dateRangeStart,
      dateRangeEnd,
      generatedAt: new Date().toISOString(),
    },
  };
}

// ============================================================================
// Tier 1: Activity Heatmap
// ============================================================================

/**
 * Calculate activity distribution by hour and day
 */
function calculateActivityHeatmap(userMessages: ParsedMessage[]): ActivityHeatmap {
  // Initialize counts
  const hourlyMessageCount = new Array(24).fill(0);
  const dailyMessageCount = new Array(7).fill(0);

  // Count messages by hour and day
  for (const msg of userMessages) {
    const hour = msg.timestamp.getHours();
    const day = msg.timestamp.getDay();
    hourlyMessageCount[hour]++;
    dailyMessageCount[day]++;
  }

  // Find peak hours (top 3 with activity)
  const hourlyWithIndex = hourlyMessageCount
    .map((count, hour) => ({ hour, count }))
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count);

  const peakHours = hourlyWithIndex.slice(0, 3).map((h) => h.hour);

  // Find quiet hours (bottom 3 with some activity)
  const quietHours = hourlyWithIndex
    .slice(-3)
    .reverse()
    .filter((h) => h.count > 0)
    .map((h) => h.hour);

  return {
    hourlyMessageCount,
    dailyMessageCount,
    peakHours,
    quietHours,
    totalMessages: userMessages.length,
  };
}

// ============================================================================
// Tier 2: Session Patterns
// ============================================================================

/**
 * Calculate session-level statistics
 */
function calculateSessionPatterns(sessions: ParsedSession[]): SessionPatterns {
  // Group sessions by start hour
  const sessionsByHour = new Map<number, ParsedSession[]>();

  for (const session of sessions) {
    const startHour = session.startTime.getHours();
    const existing = sessionsByHour.get(startHour) || [];
    existing.push(session);
    sessionsByHour.set(startHour, existing);
  }

  // Calculate stats for each hour
  const byHour: HourlySessionStats[] = [];

  for (const [hour, hourSessions] of sessionsByHour) {
    const durations = hourSessions.map((s) => s.durationSeconds / 60);
    const messageCounts = hourSessions.map((s) => s.stats.userMessageCount);
    const toolCallCounts = hourSessions.map((s) => s.stats.toolCallCount);

    byHour.push({
      hour,
      sessionCount: hourSessions.length,
      avgDurationMinutes: average(durations),
      avgMessagesPerSession: average(messageCounts),
      avgToolCallsPerSession: average(toolCallCounts),
    });
  }

  // Sort by hour
  byHour.sort((a, b) => a.hour - b.hour);

  // Calculate overall averages
  const allDurations = sessions.map((s) => s.durationSeconds / 60);
  const allMessageCounts = sessions.map((s) => s.stats.userMessageCount);
  const allToolCallCounts = sessions.map((s) => s.stats.toolCallCount);

  return {
    byHour,
    avgSessionDurationMinutes: average(allDurations),
    avgMessagesPerSession: average(allMessageCounts),
    avgToolCallsPerSession: average(allToolCallCounts),
    totalSessions: sessions.length,
  };
}

// ============================================================================
// Tier 3: Engagement Signals
// ============================================================================

/**
 * Calculate engagement signals from message content
 */
function calculateEngagementSignals(
  userMessages: ParsedMessage[],
  sessions: ParsedSession[]
): EngagementSignals {
  if (userMessages.length === 0) {
    return {
      questionRate: 0,
      shortResponseRate: 0,
      errorRetryRate: 0,
      deepSessionRate: 0,
      avgMessageLength: 0,
      codeBlockRate: 0,
    };
  }

  // Question rate
  const questionsCount = userMessages.filter((m) => QUESTION_REGEX.test(m.content)).length;
  const questionRate = questionsCount / userMessages.length;

  // Short response rate
  const shortCount = userMessages.filter(
    (m) => m.content.trim().length <= SHORT_MESSAGE_THRESHOLD
  ).length;
  const shortResponseRate = shortCount / userMessages.length;

  // Code block rate
  const codeBlockCount = userMessages.filter((m) => CODE_BLOCK_REGEX.test(m.content)).length;
  const codeBlockRate = codeBlockCount / userMessages.length;

  // Average message length
  const totalLength = userMessages.reduce((sum, m) => sum + m.content.length, 0);
  const avgMessageLength = totalLength / userMessages.length;

  // Error retry rate (need to analyze assistant messages for tool errors)
  const errorRetryRate = calculateErrorRetryRate(sessions);

  // Deep session rate
  const deepSessions = sessions.filter(
    (s) => s.stats.userMessageCount >= DEEP_SESSION_THRESHOLD
  ).length;
  const deepSessionRate = deepSessions / sessions.length;

  return {
    questionRate: round(questionRate, 3),
    shortResponseRate: round(shortResponseRate, 3),
    errorRetryRate: round(errorRetryRate, 3),
    deepSessionRate: round(deepSessionRate, 3),
    avgMessageLength: round(avgMessageLength, 1),
    codeBlockRate: round(codeBlockRate, 3),
  };
}

/**
 * Calculate rate of retrying after tool errors
 */
function calculateErrorRetryRate(sessions: ParsedSession[]): number {
  let totalErrors = 0;
  let retries = 0;

  for (const session of sessions) {
    const assistantMessages = session.messages.filter((m) => m.role === 'assistant');

    for (let i = 0; i < assistantMessages.length; i++) {
      const msg = assistantMessages[i];
      if (!msg.toolCalls) continue;

      for (const toolCall of msg.toolCalls) {
        if (toolCall.isError) {
          totalErrors++;

          // Check if next message has same tool (retry)
          const nextMsg = assistantMessages[i + 1];
          if (nextMsg?.toolCalls?.some((tc) => tc.name === toolCall.name)) {
            retries++;
          }
        }
      }
    }
  }

  return totalErrors > 0 ? retries / totalErrors : 0;
}

// ============================================================================
// Tier 4: Hourly Engagement
// ============================================================================

/**
 * Calculate engagement metrics broken down by hour
 */
function calculateHourlyEngagement(
  userMessages: ParsedMessage[],
  sessions: ParsedSession[]
): HourlyEngagement[] {
  // Group messages by hour
  const messagesByHour = new Map<number, ParsedMessage[]>();

  for (const msg of userMessages) {
    const hour = msg.timestamp.getHours();
    const existing = messagesByHour.get(hour) || [];
    existing.push(msg);
    messagesByHour.set(hour, existing);
  }

  // Calculate session lengths by start hour
  const sessionLengthsByHour = new Map<number, number[]>();
  for (const session of sessions) {
    const hour = session.startTime.getHours();
    const existing = sessionLengthsByHour.get(hour) || [];
    existing.push(session.durationSeconds / 60);
    sessionLengthsByHour.set(hour, existing);
  }

  // Build hourly engagement for hours with activity
  const result: HourlyEngagement[] = [];

  for (const [hour, messages] of messagesByHour) {
    if (messages.length < 1) continue;

    const questionCount = messages.filter((m) => QUESTION_REGEX.test(m.content)).length;
    const shortCount = messages.filter(
      (m) => m.content.trim().length <= SHORT_MESSAGE_THRESHOLD
    ).length;
    const totalLength = messages.reduce((sum, m) => sum + m.content.length, 0);

    const sessionLengths = sessionLengthsByHour.get(hour) || [];

    result.push({
      hour,
      avgSessionLengthMinutes: sessionLengths.length > 0 ? round(average(sessionLengths), 1) : 0,
      questionRate: round(questionCount / messages.length, 3),
      shortResponseRate: round(shortCount / messages.length, 3),
      avgMessageLength: round(totalLength / messages.length, 1),
      sampleSize: messages.length,
    });
  }

  // Sort by hour
  result.sort((a, b) => a.hour - b.hour);

  return result;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract all user messages from sessions
 */
function extractUserMessages(sessions: ParsedSession[]): ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  for (const session of sessions) {
    for (const msg of session.messages) {
      if (msg.role === 'user') {
        messages.push(msg);
      }
    }
  }

  return messages;
}

/**
 * Calculate average of numbers
 */
function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((a, b) => a + b, 0);
  return sum / numbers.length;
}

/**
 * Round to specified decimal places
 */
function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ============================================================================
// Export summary statistics for UI display
// ============================================================================

/**
 * Get a human-readable summary of temporal patterns
 * (This is deterministic - no LLM needed)
 */
export function getTemporalSummary(metrics: TemporalMetrics): {
  peakHoursLabel: string;
  avgSessionLabel: string;
  engagementHighlight: string;
} {
  const { activityHeatmap, sessionPatterns, engagementSignals } = metrics;

  // Format peak hours
  const peakHoursLabel =
    activityHeatmap.peakHours.length > 0
      ? activityHeatmap.peakHours.map(formatHour).join(', ')
      : 'No clear pattern';

  // Format session duration
  const avgMinutes = Math.round(sessionPatterns.avgSessionDurationMinutes);
  const avgMsgs = Math.round(sessionPatterns.avgMessagesPerSession);
  const avgSessionLabel = `${avgMinutes} min, ${avgMsgs} turns`;

  // Pick most notable engagement signal
  let engagementHighlight = '';
  if (engagementSignals.questionRate > 0.3) {
    engagementHighlight = `High inquiry rate (${Math.round(engagementSignals.questionRate * 100)}% questions)`;
  } else if (engagementSignals.deepSessionRate > 0.5) {
    engagementHighlight = `${Math.round(engagementSignals.deepSessionRate * 100)}% deep sessions (5+ turns)`;
  } else if (engagementSignals.codeBlockRate > 0.2) {
    engagementHighlight = `Frequent code sharing (${Math.round(engagementSignals.codeBlockRate * 100)}% with code)`;
  } else {
    engagementHighlight = `Avg ${Math.round(engagementSignals.avgMessageLength)} chars per message`;
  }

  return {
    peakHoursLabel,
    avgSessionLabel,
    engagementHighlight,
  };
}

/**
 * Format hour number to readable string (e.g., 14 -> "2 PM")
 */
function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}
