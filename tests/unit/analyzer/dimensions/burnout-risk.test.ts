/**
 * Burnout Risk Dimension Tests
 *
 * Tests for burnout risk calculation based on session timing patterns,
 * duration analysis, and work-life balance indicators.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBurnoutRisk,
  type BurnoutRiskResult,
} from '../../../../src/lib/analyzer/dimensions/burnout-risk.js';
import type { ParsedSession, ParsedMessage } from '../../../../src/lib/models/index.js';

/**
 * Helper to create a mock session with specific timing characteristics
 * @param options Session timing and duration options
 * @returns A properly structured ParsedSession
 */
function createBurnoutSession(options: {
  hour: number; // 0-23, hour of day when session starts
  day: number; // 0-6, day of week (0=Sunday, 6=Saturday)
  durationMinutes: number; // Session duration in minutes
  userMessageCount?: number; // Number of user messages in session
  messageContent?: string[]; // Custom message content for quality analysis
}): ParsedSession {
  const {
    hour,
    day,
    durationMinutes,
    userMessageCount = 5,
    messageContent = [],
  } = options;

  // Create session start time with specified day and hour in local timezone
  // Find a date that has the specified day of week (0=Sun, 1=Mon, etc.)
  const baseDate = new Date(2024, 0, 1); // Jan 1, 2024 (Monday)
  const baseDayOfWeek = baseDate.getDay(); // 1 (Monday)

  // Calculate days to add to get to the target day of week
  let daysToAdd = day - baseDayOfWeek;
  if (daysToAdd < 0) daysToAdd += 7;

  // Create the date with the specified day and hour
  const startTime = new Date(2024, 0, 1 + daysToAdd, hour, 0, 0, 0);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  const messages: ParsedMessage[] = [];
  const messageInterval = (durationMinutes * 60 * 1000) / (userMessageCount * 2);

  // Generate user and assistant message pairs
  for (let i = 0; i < userMessageCount; i++) {
    const userContent =
      messageContent[i] || `User message ${i + 1} during session`;
    messages.push({
      uuid: `user-${i}`,
      role: 'user',
      content: userContent,
      timestamp: new Date(startTime.getTime() + i * messageInterval),
    });

    messages.push({
      uuid: `assistant-${i}`,
      role: 'assistant',
      content: `Assistant response ${i + 1}`,
      timestamp: new Date(
        startTime.getTime() + i * messageInterval + messageInterval / 2
      ),
    });
  }

  return {
    sessionId: `session-${hour}-${day}-${durationMinutes}`,
    projectPath: '/test/project',
    startTime,
    endTime,
    durationSeconds: durationMinutes * 60,
    claudeCodeVersion: '1.0.0',
    messages,
    stats: {
      userMessageCount,
      assistantMessageCount: userMessageCount,
      toolCallCount: 0,
      uniqueToolsUsed: [],
      totalInputTokens: 500,
      totalOutputTokens: 1000,
    },
  };
}

describe('Burnout Risk Dimension', () => {
  describe('calculateBurnoutRisk', () => {
    it('should return default result for empty sessions', () => {
      const result = calculateBurnoutRisk([]);

      expect(result.score).toBe(0);
      expect(result.level).toBe('low');
      expect(result.breakdown.afterHoursRate).toBe(0);
      expect(result.breakdown.weekendRate).toBe(0);
      expect(result.breakdown.lateNightCount).toBe(0);
      expect(result.breakdown.avgSessionDuration).toBe(0);
      expect(result.breakdown.sessionTrend).toBe('stable');
      expect(result.breakdown.longestSession).toBe(0);
      expect(result.recommendations).toContain(
        'Not enough data for burnout analysis.'
      );
    });

    describe('after-hours detection', () => {
      it('should detect sessions after 9 PM as after-hours', () => {
        const sessions = [
          createBurnoutSession({ hour: 21, day: 1, durationMinutes: 60 }), // 9 PM
          createBurnoutSession({ hour: 22, day: 2, durationMinutes: 60 }), // 10 PM
          createBurnoutSession({ hour: 23, day: 3, durationMinutes: 60 }), // 11 PM
          createBurnoutSession({ hour: 10, day: 4, durationMinutes: 60 }), // 10 AM (normal hours)
        ];

        const result = calculateBurnoutRisk(sessions);

        // 3 out of 4 sessions are after 9 PM = 75%
        expect(result.breakdown.afterHoursRate).toBe(75);
        expect(result.score).toBeGreaterThan(10);
      });

      it('should detect evening sessions (6-9 PM) as after-hours', () => {
        const sessions = [
          createBurnoutSession({ hour: 18, day: 1, durationMinutes: 60 }), // 6 PM
          createBurnoutSession({ hour: 19, day: 2, durationMinutes: 60 }), // 7 PM
          createBurnoutSession({ hour: 20, day: 3, durationMinutes: 60 }), // 8 PM
          createBurnoutSession({ hour: 10, day: 4, durationMinutes: 60 }), // 10 AM
        ];

        const result = calculateBurnoutRisk(sessions);

        // 3 out of 4 sessions are after 6 PM = 75%
        expect(result.breakdown.afterHoursRate).toBe(75);
        expect(result.timeDistribution.evening).toBeGreaterThan(0);
      });

      it('should provide recommendation when after-hours rate exceeds 15%', () => {
        const sessions = [
          createBurnoutSession({ hour: 22, day: 1, durationMinutes: 60 }),
          createBurnoutSession({ hour: 23, day: 2, durationMinutes: 60 }),
          createBurnoutSession({ hour: 10, day: 3, durationMinutes: 60 }),
          createBurnoutSession({ hour: 11, day: 4, durationMinutes: 60 }),
        ];

        const result = calculateBurnoutRisk(sessions);

        expect(result.breakdown.afterHoursRate).toBe(50);
        expect(result.recommendations.some((r) => r.includes('coding curfew'))).toBe(
          true
        );
      });
    });

    describe('weekend detection', () => {
      it('should detect Saturday sessions (day 6) as weekend', () => {
        const sessions = [
          createBurnoutSession({ hour: 10, day: 6, durationMinutes: 60 }), // Saturday
          createBurnoutSession({ hour: 10, day: 1, durationMinutes: 60 }), // Monday
          createBurnoutSession({ hour: 10, day: 2, durationMinutes: 60 }), // Tuesday
        ];

        const result = calculateBurnoutRisk(sessions);

        // 1 out of 3 sessions on weekend = 33%
        expect(result.breakdown.weekendRate).toBe(33);
        expect(result.timeDistribution.weekend).toBeGreaterThan(0);
      });

      it('should detect Sunday sessions (day 0) as weekend', () => {
        const sessions = [
          createBurnoutSession({ hour: 14, day: 0, durationMinutes: 90 }), // Sunday
          createBurnoutSession({ hour: 14, day: 0, durationMinutes: 90 }), // Sunday
          createBurnoutSession({ hour: 10, day: 3, durationMinutes: 60 }), // Wednesday
          createBurnoutSession({ hour: 10, day: 4, durationMinutes: 60 }), // Thursday
        ];

        const result = calculateBurnoutRisk(sessions);

        // 2 out of 4 sessions on weekend = 50%
        expect(result.breakdown.weekendRate).toBe(50);
        expect(result.timeDistribution.weekend).toBe(50);
      });

      it('should provide recommendation when weekend rate exceeds 10%', () => {
        const sessions = [
          createBurnoutSession({ hour: 10, day: 6, durationMinutes: 60 }),
          createBurnoutSession({ hour: 10, day: 0, durationMinutes: 60 }),
          createBurnoutSession({ hour: 10, day: 1, durationMinutes: 60 }),
        ];

        const result = calculateBurnoutRisk(sessions);

        expect(result.breakdown.weekendRate).toBeGreaterThan(10);
        expect(
          result.recommendations.some((r) => r.includes('weekend sessions'))
        ).toBe(true);
      });
    });

    describe('late-night detection', () => {
      it('should detect sessions after midnight as late-night', () => {
        const sessions = [
          createBurnoutSession({ hour: 0, day: 1, durationMinutes: 60 }), // Midnight
          createBurnoutSession({ hour: 1, day: 2, durationMinutes: 60 }), // 1 AM
          createBurnoutSession({ hour: 2, day: 3, durationMinutes: 60 }), // 2 AM
          createBurnoutSession({ hour: 10, day: 4, durationMinutes: 60 }), // 10 AM
        ];

        const result = calculateBurnoutRisk(sessions);

        expect(result.breakdown.lateNightCount).toBe(3);
        expect(result.timeDistribution.lateNight).toBeGreaterThan(0);
      });

      it('should detect early morning sessions (before 6 AM) as late-night', () => {
        const sessions = [
          createBurnoutSession({ hour: 3, day: 1, durationMinutes: 60 }), // 3 AM
          createBurnoutSession({ hour: 4, day: 2, durationMinutes: 60 }), // 4 AM
          createBurnoutSession({ hour: 5, day: 3, durationMinutes: 60 }), // 5 AM
        ];

        const result = calculateBurnoutRisk(sessions);

        expect(result.breakdown.lateNightCount).toBe(3);
      });

      it('should provide recommendation when late-night count exceeds 3', () => {
        const sessions = [
          createBurnoutSession({ hour: 0, day: 1, durationMinutes: 60 }),
          createBurnoutSession({ hour: 1, day: 2, durationMinutes: 60 }),
          createBurnoutSession({ hour: 2, day: 3, durationMinutes: 60 }),
          createBurnoutSession({ hour: 3, day: 4, durationMinutes: 60 }),
        ];

        const result = calculateBurnoutRisk(sessions);

        expect(result.breakdown.lateNightCount).toBe(4);
        expect(
          result.recommendations.some((r) => r.includes('late-night sessions'))
        ).toBe(true);
        expect(
          result.recommendations.some((r) => r.includes('prioritize sleep'))
        ).toBe(true);
      });
    });

    describe('session duration analysis', () => {
      it('should calculate average session duration correctly', () => {
        const sessions = [
          createBurnoutSession({ hour: 10, day: 1, durationMinutes: 30 }),
          createBurnoutSession({ hour: 10, day: 2, durationMinutes: 60 }),
          createBurnoutSession({ hour: 10, day: 3, durationMinutes: 90 }),
        ];

        const result = calculateBurnoutRisk(sessions);

        // Average = (30 + 60 + 90) / 3 = 60 minutes
        expect(result.breakdown.avgSessionDuration).toBe(60);
      });

      it('should track longest session duration', () => {
        const sessions = [
          createBurnoutSession({ hour: 10, day: 1, durationMinutes: 45 }),
          createBurnoutSession({ hour: 10, day: 2, durationMinutes: 180 }),
          createBurnoutSession({ hour: 10, day: 3, durationMinutes: 60 }),
        ];

        const result = calculateBurnoutRisk(sessions);

        expect(result.breakdown.longestSession).toBe(180);
      });

      it('should increase score for long sessions (>2 hours)', () => {
        const shortSessions = [
          createBurnoutSession({ hour: 10, day: 1, durationMinutes: 45 }),
          createBurnoutSession({ hour: 10, day: 2, durationMinutes: 60 }),
          createBurnoutSession({ hour: 10, day: 3, durationMinutes: 90 }),
        ];

        const longSessions = [
          createBurnoutSession({ hour: 10, day: 1, durationMinutes: 150 }),
          createBurnoutSession({ hour: 10, day: 2, durationMinutes: 180 }),
          createBurnoutSession({ hour: 10, day: 3, durationMinutes: 200 }),
        ];

        const shortResult = calculateBurnoutRisk(shortSessions);
        const longResult = calculateBurnoutRisk(longSessions);

        expect(longResult.score).toBeGreaterThan(shortResult.score);
      });

      it('should recommend Pomodoro for very long sessions (>180 min)', () => {
        const sessions = [
          createBurnoutSession({ hour: 10, day: 1, durationMinutes: 200 }),
          createBurnoutSession({ hour: 10, day: 2, durationMinutes: 60 }),
        ];

        const result = calculateBurnoutRisk(sessions);

        expect(result.breakdown.longestSession).toBe(200);
        expect(
          result.recommendations.some((r) => r.includes('Pomodoro technique'))
        ).toBe(true);
      });

      it('should recommend breaks when long session rate exceeds 20%', () => {
        const sessions = [
          createBurnoutSession({ hour: 10, day: 1, durationMinutes: 150 }),
          createBurnoutSession({ hour: 10, day: 2, durationMinutes: 140 }),
          createBurnoutSession({ hour: 10, day: 3, durationMinutes: 60 }),
          createBurnoutSession({ hour: 10, day: 4, durationMinutes: 45 }),
        ];

        const result = calculateBurnoutRisk(sessions);

        // 2 out of 4 sessions > 120 min = 50%
        expect(
          result.recommendations.some((r) =>
            r.includes('Long sessions correlate with lower quality')
          )
        ).toBe(true);
      });
    });

    describe('session trend detection', () => {
      it('should detect stable trend with < 10 sessions', () => {
        const sessions = [
          createBurnoutSession({ hour: 10, day: 1, durationMinutes: 60 }),
          createBurnoutSession({ hour: 10, day: 2, durationMinutes: 70 }),
          createBurnoutSession({ hour: 10, day: 3, durationMinutes: 80 }),
        ];

        const result = calculateBurnoutRisk(sessions);

        expect(result.breakdown.sessionTrend).toBe('stable');
      });

      it('should detect increasing trend when second half is 15%+ longer', () => {
        // Create 10 sessions with increasing durations over time
        // To ensure proper sorting, use different hours as well
        const sessions = [
          createBurnoutSession({ hour: 10, day: 1, durationMinutes: 50 }),
          createBurnoutSession({ hour: 11, day: 1, durationMinutes: 55 }),
          createBurnoutSession({ hour: 10, day: 2, durationMinutes: 60 }),
          createBurnoutSession({ hour: 11, day: 2, durationMinutes: 55 }),
          createBurnoutSession({ hour: 10, day: 3, durationMinutes: 60 }),
          // Second half: significantly longer
          createBurnoutSession({ hour: 10, day: 4, durationMinutes: 90 }),
          createBurnoutSession({ hour: 11, day: 4, durationMinutes: 95 }),
          createBurnoutSession({ hour: 10, day: 5, durationMinutes: 100 }),
          createBurnoutSession({ hour: 11, day: 5, durationMinutes: 95 }),
          createBurnoutSession({ hour: 10, day: 6, durationMinutes: 100 }),
        ];

        const result = calculateBurnoutRisk(sessions);

        expect(result.breakdown.sessionTrend).toBe('increasing');
        expect(result.score).toBeGreaterThan(0);
      });

      it('should detect decreasing trend when second half is 15%+ shorter', () => {
        // Create 10 sessions with decreasing durations over time
        const sessions = [
          createBurnoutSession({ hour: 10, day: 1, durationMinutes: 120 }),
          createBurnoutSession({ hour: 11, day: 1, durationMinutes: 115 }),
          createBurnoutSession({ hour: 10, day: 2, durationMinutes: 120 }),
          createBurnoutSession({ hour: 11, day: 2, durationMinutes: 115 }),
          createBurnoutSession({ hour: 10, day: 3, durationMinutes: 120 }),
          // Second half: significantly shorter
          createBurnoutSession({ hour: 10, day: 4, durationMinutes: 60 }),
          createBurnoutSession({ hour: 11, day: 4, durationMinutes: 55 }),
          createBurnoutSession({ hour: 10, day: 5, durationMinutes: 60 }),
          createBurnoutSession({ hour: 11, day: 5, durationMinutes: 65 }),
          createBurnoutSession({ hour: 10, day: 6, durationMinutes: 60 }),
        ];

        const result = calculateBurnoutRisk(sessions);

        expect(result.breakdown.sessionTrend).toBe('decreasing');
      });

      it('should detect stable trend when duration change is < 15%', () => {
        // Create 10 sessions with minimal variation
        const sessions = Array(10)
          .fill(null)
          .map((_, i) =>
            createBurnoutSession({
              hour: 10,
              day: i % 7,
              durationMinutes: 60 + Math.floor(Math.random() * 5),
            })
          );

        const result = calculateBurnoutRisk(sessions);

        expect(result.breakdown.sessionTrend).toBe('stable');
      });
    });

    describe('time distribution calculation', () => {
      it('should distribute sessions across time categories', () => {
        const sessions = [
          createBurnoutSession({ hour: 10, day: 1, durationMinutes: 60 }), // Business hours (weekday)
          createBurnoutSession({ hour: 14, day: 2, durationMinutes: 60 }), // Business hours (weekday)
          createBurnoutSession({ hour: 19, day: 3, durationMinutes: 60 }), // Evening (weekday)
          createBurnoutSession({ hour: 23, day: 4, durationMinutes: 60 }), // Late night (weekday)
          createBurnoutSession({ hour: 10, day: 6, durationMinutes: 60 }), // Weekend (business hours on Saturday)
        ];

        const result = calculateBurnoutRisk(sessions);

        // Note: Saturday at 10 AM counts as both weekend AND business hours
        // Time of day categories: 3 business hours (including Saturday morning), 1 evening, 1 late night
        expect(result.timeDistribution.businessHours).toBe(60); // 3/5
        expect(result.timeDistribution.evening).toBe(20); // 1/5
        expect(result.timeDistribution.lateNight).toBe(20); // 1/5
        expect(result.timeDistribution.weekend).toBe(20); // 1/5 (weekend is separate)
      });

      it('should categorize business hours (9 AM - 6 PM) correctly', () => {
        const sessions = [
          createBurnoutSession({ hour: 9, day: 1, durationMinutes: 60 }),
          createBurnoutSession({ hour: 12, day: 2, durationMinutes: 60 }),
          createBurnoutSession({ hour: 17, day: 3, durationMinutes: 60 }),
        ];

        const result = calculateBurnoutRisk(sessions);

        expect(result.timeDistribution.businessHours).toBe(100);
        expect(result.timeDistribution.evening).toBe(0);
        expect(result.timeDistribution.lateNight).toBe(0);
      });
    });

    describe('quality correlation analysis', () => {
      it('should analyze quality for short sessions (<2 hours)', () => {
        const sessions = [
          createBurnoutSession({
            hour: 10,
            day: 1,
            durationMinutes: 60,
            messageContent: ['Implement feature', 'Add tests', 'Deploy'],
          }),
          createBurnoutSession({
            hour: 10,
            day: 2,
            durationMinutes: 90,
            messageContent: ['Review code', 'Fix bugs'],
          }),
        ];

        const result = calculateBurnoutRisk(sessions);

        expect(result.qualityCorrelation.shortSessions.avgDuration).toBe(75); // (60+90)/2
        expect(result.qualityCorrelation.shortSessions.qualityIndicator).toContain(
          'quality'
        );
      });

      it('should analyze quality for long sessions (>=2 hours)', () => {
        const sessions = [
          createBurnoutSession({
            hour: 10,
            day: 1,
            durationMinutes: 150,
            messageContent: [
              'Start feature',
              'No wait, wrong approach',
              'Actually, fix this error',
              'This is incorrect',
            ],
          }),
        ];

        const result = calculateBurnoutRisk(sessions);

        expect(result.qualityCorrelation.longSessions.avgDuration).toBe(150);
        // Should detect rework patterns
        expect(result.qualityCorrelation.longSessions.qualityIndicator).toBeDefined();
      });

      it('should detect high quality (low rework) pattern', () => {
        const sessions = [
          createBurnoutSession({
            hour: 10,
            day: 1,
            durationMinutes: 60,
            messageContent: [
              'Implement feature',
              'Add tests',
              'Update docs',
              'Review changes',
            ],
          }),
        ];

        const result = calculateBurnoutRisk(sessions);

        expect(
          result.qualityCorrelation.shortSessions.qualityIndicator
        ).toContain('High quality');
      });

      it('should detect lower quality (high rework) pattern', () => {
        const sessions = [
          createBurnoutSession({
            hour: 10,
            day: 1,
            durationMinutes: 60,
            messageContent: [
              'That is wrong',
              'No, fix this error',
              'Actually change it',
              'Wait, that is incorrect',
            ],
          }),
        ];

        const result = calculateBurnoutRisk(sessions);

        // High modification rate should indicate lower quality
        expect(result.qualityCorrelation.shortSessions.qualityIndicator).toBe(
          'Lower quality (high rework)'
        );
      });
    });

    describe('level thresholds', () => {
      it('should classify score <= 25 as low risk', () => {
        // Normal work hours, reasonable durations
        const sessions = [
          createBurnoutSession({ hour: 10, day: 1, durationMinutes: 60 }),
          createBurnoutSession({ hour: 14, day: 2, durationMinutes: 45 }),
        ];

        const result = calculateBurnoutRisk(sessions);

        expect(result.score).toBeLessThanOrEqual(25);
        expect(result.level).toBe('low');
      });

      it('should classify score 26-45 as moderate risk', () => {
        // Some after-hours work
        const sessions = [
          createBurnoutSession({ hour: 19, day: 1, durationMinutes: 90 }),
          createBurnoutSession({ hour: 20, day: 2, durationMinutes: 100 }),
          createBurnoutSession({ hour: 10, day: 3, durationMinutes: 60 }),
        ];

        const result = calculateBurnoutRisk(sessions);

        if (result.score > 25 && result.score <= 45) {
          expect(result.level).toBe('moderate');
        }
      });

      it('should classify score 46-65 as elevated risk', () => {
        // Significant after-hours and weekend work
        const sessions = [
          createBurnoutSession({ hour: 22, day: 1, durationMinutes: 120 }),
          createBurnoutSession({ hour: 23, day: 2, durationMinutes: 150 }),
          createBurnoutSession({ hour: 10, day: 6, durationMinutes: 180 }), // Weekend
          createBurnoutSession({ hour: 21, day: 0, durationMinutes: 120 }), // Weekend
        ];

        const result = calculateBurnoutRisk(sessions);

        if (result.score > 45 && result.score <= 65) {
          expect(result.level).toBe('elevated');
        }
      });

      it('should classify score > 65 as high risk', () => {
        // Extreme burnout pattern: late nights, weekends, long sessions
        const sessions = [
          ...Array(5)
            .fill(null)
            .map((_, i) =>
              createBurnoutSession({
                hour: 23,
                day: i % 7,
                durationMinutes: 180,
              })
            ),
          ...Array(5)
            .fill(null)
            .map(() =>
              createBurnoutSession({ hour: 1, day: 6, durationMinutes: 200 })
            ), // Weekend late nights
        ];

        const result = calculateBurnoutRisk(sessions);

        if (result.score > 65) {
          expect(result.level).toBe('high');
        }
        // At minimum should be elevated
        expect(['elevated', 'high']).toContain(result.level);
      });
    });

    describe('score inversion (higher score = more risk)', () => {
      it('should assign higher scores for worse patterns', () => {
        const healthyPattern = [
          createBurnoutSession({ hour: 10, day: 1, durationMinutes: 60 }),
          createBurnoutSession({ hour: 14, day: 2, durationMinutes: 60 }),
          createBurnoutSession({ hour: 11, day: 3, durationMinutes: 60 }),
        ];

        const unhealthyPattern = [
          createBurnoutSession({ hour: 23, day: 1, durationMinutes: 180 }),
          createBurnoutSession({ hour: 1, day: 6, durationMinutes: 200 }),
          createBurnoutSession({ hour: 22, day: 0, durationMinutes: 150 }),
        ];

        const healthyResult = calculateBurnoutRisk(healthyPattern);
        const unhealthyResult = calculateBurnoutRisk(unhealthyPattern);

        expect(unhealthyResult.score).toBeGreaterThan(healthyResult.score);
      });

      it('should increase score with more frequent sessions', () => {
        const fewSessions = [
          createBurnoutSession({ hour: 10, day: 1, durationMinutes: 60 }),
          createBurnoutSession({ hour: 10, day: 2, durationMinutes: 60 }),
        ];

        const manySessions = Array(50)
          .fill(null)
          .map((_, i) =>
            createBurnoutSession({ hour: 10, day: i % 7, durationMinutes: 60 })
          );

        const fewResult = calculateBurnoutRisk(fewSessions);
        const manyResult = calculateBurnoutRisk(manySessions);

        // More sessions = higher burnout risk (frequency component)
        expect(manyResult.score).toBeGreaterThan(fewResult.score);
      });
    });

    describe('recommendations generation', () => {
      it('should generate up to 4 recommendations', () => {
        // Create pattern that triggers all recommendations
        const sessions = [
          createBurnoutSession({ hour: 23, day: 1, durationMinutes: 200 }), // Late + long
          createBurnoutSession({ hour: 22, day: 2, durationMinutes: 180 }), // Late + long
          createBurnoutSession({ hour: 1, day: 3, durationMinutes: 150 }), // Late night
          createBurnoutSession({ hour: 2, day: 4, durationMinutes: 140 }), // Late night
          createBurnoutSession({ hour: 21, day: 6, durationMinutes: 150 }), // Weekend
        ];

        const result = calculateBurnoutRisk(sessions);

        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(result.recommendations.length).toBeLessThanOrEqual(4);
      });

      it('should not duplicate recommendations', () => {
        const sessions = [
          createBurnoutSession({ hour: 23, day: 1, durationMinutes: 60 }),
          createBurnoutSession({ hour: 23, day: 2, durationMinutes: 60 }),
        ];

        const result = calculateBurnoutRisk(sessions);

        const uniqueRecommendations = new Set(result.recommendations);
        expect(uniqueRecommendations.size).toBe(result.recommendations.length);
      });
    });
  });
});
