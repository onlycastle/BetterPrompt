/**
 * Burnout Risk Indicators Dimension
 *
 * Analyzes session patterns to detect potential burnout risk.
 * Score 0-100: Lower is healthier.
 *
 * Source: https://www.usehaystack.io/blog/software-developer-burnout-how-to-spot-early-warning-signs
 * "83% of developers experience burnout, AI can accelerate it"
 */

import { type ParsedSession } from '../../models/index.js';

export interface BurnoutRiskResult {
  score: number; // 0-100, lower is healthier (higher = more risk)
  level: 'low' | 'moderate' | 'elevated' | 'high';
  breakdown: {
    afterHoursRate: number; // % sessions after 9 PM
    weekendRate: number; // % sessions on weekends
    lateNightCount: number; // Sessions after midnight
    avgSessionDuration: number; // Average session length in minutes
    sessionTrend: 'increasing' | 'stable' | 'decreasing';
    longestSession: number; // Longest session in minutes
  };
  timeDistribution: {
    businessHours: number;
    evening: number;
    lateNight: number;
    weekend: number;
  };
  recommendations: string[];
  qualityCorrelation: {
    shortSessions: { avgDuration: number; qualityIndicator: string };
    longSessions: { avgDuration: number; qualityIndicator: string };
  };
}

/**
 * Calculate Burnout Risk Score
 */
export function calculateBurnoutRisk(sessions: ParsedSession[]): BurnoutRiskResult {
  if (sessions.length === 0) {
    return createDefaultResult();
  }

  const timeMetrics = analyzeTimePatterns(sessions);
  const durationMetrics = analyzeSessionDurations(sessions);
  const trendMetrics = analyzeSessionTrends(sessions);

  // Calculate risk score
  // Higher values = more risk
  const riskComponents = {
    afterHours: timeMetrics.afterHoursRate * 0.25, // Weight: 25%
    weekend: timeMetrics.weekendRate * 0.20, // Weight: 20%
    lateNight: Math.min(timeMetrics.lateNightRate * 2, 1) * 0.15, // Weight: 15%
    longSessions: durationMetrics.longSessionRate * 0.20, // Weight: 20%
    increasingTrend: trendMetrics.isIncreasing ? 0.10 : 0, // Weight: 10%
    frequency: Math.min(sessions.length / 100, 1) * 0.10, // Weight: 10%
  };

  const rawScore = Object.values(riskComponents).reduce((a, b) => a + b, 0);
  const score = Math.round(rawScore * 100);

  const recommendations = generateRecommendations(timeMetrics, durationMetrics);

  return {
    score,
    level: getLevel(score),
    breakdown: {
      afterHoursRate: Math.round(timeMetrics.afterHoursRate * 100),
      weekendRate: Math.round(timeMetrics.weekendRate * 100),
      lateNightCount: timeMetrics.lateNightCount,
      avgSessionDuration: Math.round(durationMetrics.avgDuration),
      sessionTrend: trendMetrics.trend,
      longestSession: Math.round(durationMetrics.maxDuration),
    },
    timeDistribution: timeMetrics.distribution,
    recommendations,
    qualityCorrelation: durationMetrics.qualityCorrelation,
  };
}

interface TimeMetrics {
  afterHoursRate: number;
  weekendRate: number;
  lateNightRate: number;
  lateNightCount: number;
  distribution: {
    businessHours: number;
    evening: number;
    lateNight: number;
    weekend: number;
  };
}

function analyzeTimePatterns(sessions: ParsedSession[]): TimeMetrics {
  let afterHoursCount = 0;
  let weekendCount = 0;
  let lateNightCount = 0;
  let businessHoursCount = 0;
  let eveningCount = 0;

  for (const session of sessions) {
    const hour = session.startTime.getHours();
    const day = session.startTime.getDay();
    const isWeekend = day === 0 || day === 6;

    if (isWeekend) {
      weekendCount++;
    }

    if (hour >= 21 || hour < 6) {
      lateNightCount++;
      afterHoursCount++;
    } else if (hour >= 18) {
      eveningCount++;
      afterHoursCount++;
    } else if (hour >= 9) {
      businessHoursCount++;
    } else {
      lateNightCount++;
      afterHoursCount++;
    }
  }

  const total = sessions.length;

  return {
    afterHoursRate: total > 0 ? afterHoursCount / total : 0,
    weekendRate: total > 0 ? weekendCount / total : 0,
    lateNightRate: total > 0 ? lateNightCount / total : 0,
    lateNightCount,
    distribution: {
      businessHours: Math.round((businessHoursCount / total) * 100) || 0,
      evening: Math.round((eveningCount / total) * 100) || 0,
      lateNight: Math.round((lateNightCount / total) * 100) || 0,
      weekend: Math.round((weekendCount / total) * 100) || 0,
    },
  };
}

interface DurationMetrics {
  avgDuration: number;
  maxDuration: number;
  longSessionRate: number;
  qualityCorrelation: {
    shortSessions: { avgDuration: number; qualityIndicator: string };
    longSessions: { avgDuration: number; qualityIndicator: string };
  };
}

function analyzeSessionDurations(sessions: ParsedSession[]): DurationMetrics {
  const durations = sessions.map((s) => s.durationSeconds / 60); // in minutes

  if (durations.length === 0) {
    return {
      avgDuration: 0,
      maxDuration: 0,
      longSessionRate: 0,
      qualityCorrelation: {
        shortSessions: { avgDuration: 0, qualityIndicator: 'N/A' },
        longSessions: { avgDuration: 0, qualityIndicator: 'N/A' },
      },
    };
  }

  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxDuration = Math.max(...durations);

  // Long session = over 2 hours
  const longSessionRate = durations.filter((d) => d > 120).length / durations.length;

  // Analyze quality correlation (based on session patterns)
  const shortSessions = sessions.filter((s) => s.durationSeconds < 7200); // < 2 hours
  const longSessions = sessions.filter((s) => s.durationSeconds >= 7200); // >= 2 hours

  const qualityCorrelation = {
    shortSessions: {
      avgDuration:
        shortSessions.length > 0
          ? Math.round(
              shortSessions.reduce((a, s) => a + s.durationSeconds, 0) /
                shortSessions.length /
                60
            )
          : 0,
      qualityIndicator: analyzeQualityIndicator(shortSessions),
    },
    longSessions: {
      avgDuration:
        longSessions.length > 0
          ? Math.round(
              longSessions.reduce((a, s) => a + s.durationSeconds, 0) /
                longSessions.length /
                60
            )
          : 0,
      qualityIndicator: analyzeQualityIndicator(longSessions),
    },
  };

  return {
    avgDuration,
    maxDuration,
    longSessionRate,
    qualityCorrelation,
  };
}

function analyzeQualityIndicator(sessions: ParsedSession[]): string {
  if (sessions.length === 0) return 'N/A';

  // Calculate modification rate as quality proxy
  let totalMessages = 0;
  let modificationMessages = 0;

  const modPatterns = /\b(wrong|error|fix|incorrect|change|no,|actually|wait)\b/i;

  for (const session of sessions) {
    const userMessages = session.messages.filter((m) => m.role === 'user');
    totalMessages += userMessages.length;
    modificationMessages += userMessages.filter((m) =>
      modPatterns.test(m.content)
    ).length;
  }

  const modRate = totalMessages > 0 ? modificationMessages / totalMessages : 0;

  if (modRate < 0.15) return 'High quality (low rework)';
  if (modRate < 0.25) return 'Good quality (moderate rework)';
  if (modRate < 0.40) return 'Moderate quality (some rework)';
  return 'Lower quality (high rework)';
}

interface TrendMetrics {
  trend: 'increasing' | 'stable' | 'decreasing';
  isIncreasing: boolean;
}

function analyzeSessionTrends(sessions: ParsedSession[]): TrendMetrics {
  if (sessions.length < 10) {
    return { trend: 'stable', isIncreasing: false };
  }

  // Sort by date
  const sorted = [...sessions].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );

  // Compare first half vs second half average duration
  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  const firstAvg =
    firstHalf.reduce((a, s) => a + s.durationSeconds, 0) / firstHalf.length;
  const secondAvg =
    secondHalf.reduce((a, s) => a + s.durationSeconds, 0) / secondHalf.length;

  const change = (secondAvg - firstAvg) / firstAvg;

  if (change > 0.15) {
    return { trend: 'increasing', isIncreasing: true };
  }
  if (change < -0.15) {
    return { trend: 'decreasing', isIncreasing: false };
  }
  return { trend: 'stable', isIncreasing: false };
}

function getLevel(score: number): 'low' | 'moderate' | 'elevated' | 'high' {
  if (score <= 25) return 'low';
  if (score <= 45) return 'moderate';
  if (score <= 65) return 'elevated';
  return 'high';
}

function generateRecommendations(
  time: TimeMetrics,
  duration: DurationMetrics
): string[] {
  const recommendations: string[] = [];

  if (time.afterHoursRate > 0.15) {
    recommendations.push('Set a "coding curfew" - no AI after 9 PM');
  }

  if (time.weekendRate > 0.10) {
    recommendations.push('Review weekend sessions - are they necessary?');
  }

  if (time.lateNightCount > 3) {
    recommendations.push(`${time.lateNightCount} late-night sessions detected - prioritize sleep`);
  }

  if (duration.longSessionRate > 0.20) {
    recommendations.push('Long sessions correlate with lower quality - take breaks');
  }

  if (duration.maxDuration > 180) {
    recommendations.push(
      `Your longest session was ${Math.round(duration.maxDuration)} min - try the Pomodoro technique`
    );
  }

  return recommendations.slice(0, 4);
}

function createDefaultResult(): BurnoutRiskResult {
  return {
    score: 0,
    level: 'low',
    breakdown: {
      afterHoursRate: 0,
      weekendRate: 0,
      lateNightCount: 0,
      avgSessionDuration: 0,
      sessionTrend: 'stable',
      longestSession: 0,
    },
    timeDistribution: {
      businessHours: 0,
      evening: 0,
      lateNight: 0,
      weekend: 0,
    },
    recommendations: ['Not enough data for burnout analysis.'],
    qualityCorrelation: {
      shortSessions: { avgDuration: 0, qualityIndicator: 'N/A' },
      longSessions: { avgDuration: 0, qualityIndicator: 'N/A' },
    },
  };
}
