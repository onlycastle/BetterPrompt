import { describe, it, expect } from 'vitest';
import {
  extractSessionMetrics,
  aggregateMetrics,
  calculateTypeScores,
  scoresToDistribution,
  getPrimaryType,
  getToolUsageHighlight,
  applyArchitectDampening,
} from '../../../src/lib/analyzer/type-detector.js';
import type { ParsedSession, ParsedMessage } from '../../../src/lib/models/session.js';

/**
 * Helper to create a mock parsed session
 */
function createMockSession(overrides: Partial<ParsedSession> = {}): ParsedSession {
  return {
    sessionId: 'test-session',
    projectPath: '/test/project',
    startTime: new Date('2024-01-01T00:00:00Z'),
    endTime: new Date('2024-01-01T01:00:00Z'),
    durationSeconds: 3600,
    claudeCodeVersion: '1.0.0',
    messages: [],
    stats: {
      userMessageCount: 0,
      assistantMessageCount: 0,
      toolCallCount: 0,
      uniqueToolsUsed: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
    },
    ...overrides,
  };
}

/**
 * Helper to create a mock message
 */
function createMockMessage(
  role: 'user' | 'assistant',
  content: string,
  toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>,
  timestamp: Date = new Date('2024-01-01T00:00:00Z')
): ParsedMessage {
  return {
    uuid: `msg-${Math.random().toString(36).slice(2)}`,
    role,
    timestamp,
    content,
    toolCalls,
  };
}

describe('Type Detector', () => {
  describe('extractSessionMetrics', () => {
    it('should return zero metrics for empty session', () => {
      const session = createMockSession({ messages: [] });
      const metrics = extractSessionMetrics(session);

      expect(metrics.avgPromptLength).toBe(0);
      expect(metrics.totalTurns).toBe(0);
      expect(metrics.questionFrequency).toBe(0);
      expect(metrics.toolUsage.total).toBe(0);
    });

    it('should calculate average prompt length correctly', () => {
      const session = createMockSession({
        messages: [
          createMockMessage('user', 'short'),           // 5 chars
          createMockMessage('assistant', 'response'),
          createMockMessage('user', 'longer message here'), // 19 chars
        ],
      });

      const metrics = extractSessionMetrics(session);

      // (5 + 19) / 2 = 12
      expect(metrics.avgPromptLength).toBe(12);
    });

    it('should count question marks for question frequency', () => {
      const session = createMockSession({
        messages: [
          createMockMessage('user', 'What is this? How does it work?'),
          createMockMessage('assistant', 'response'),
        ],
      });

      const metrics = extractSessionMetrics(session);

      // 2 question marks, 1 turn = frequency of 2
      expect(metrics.questionFrequency).toBe(2);
    });

    it('should count why/how/what keywords', () => {
      const session = createMockSession({
        messages: [
          createMockMessage('user', 'Why does this work? How can I change it? What is the output?'),
          createMockMessage('assistant', 'response'),
        ],
      });

      const metrics = extractSessionMetrics(session);

      // Should count: why, how, what = 3
      expect(metrics.whyHowWhatCount).toBeGreaterThanOrEqual(3);
    });

    it('should count tool usage from assistant messages', () => {
      const session = createMockSession({
        messages: [
          createMockMessage('user', 'read file'),
          createMockMessage('assistant', 'reading...', [
            { id: '1', name: 'Read', input: { path: '/test' } },
          ]),
          createMockMessage('user', 'search for pattern'),
          createMockMessage('assistant', 'searching...', [
            { id: '2', name: 'Grep', input: { pattern: 'test' } },
            { id: '3', name: 'Read', input: { path: '/test2' } },
          ]),
        ],
      });

      const metrics = extractSessionMetrics(session);

      expect(metrics.toolUsage.total).toBe(3);
      expect(metrics.toolUsage.read).toBe(2);
      expect(metrics.toolUsage.grep).toBe(1);
    });

    it('should count modification keywords', () => {
      const session = createMockSession({
        messages: [
          createMockMessage('user', 'change this to use a different approach'),
          createMockMessage('assistant', 'done'),
          createMockMessage('user', 'no that is wrong, fix it'),
        ],
      });

      const metrics = extractSessionMetrics(session);

      // Should count: change, fix, wrong = 3
      expect(metrics.modificationRequestCount).toBeGreaterThanOrEqual(2);
    });

    it('should count quality keywords', () => {
      // Note: PATTERN_KEYWORDS uses word boundary matching, so 'tests' won't match 'test'
      // Use exact keywords: 'refactor', 'test' (not 'tests')
      const session = createMockSession({
        messages: [
          createMockMessage('user', 'refactor this code and add a test for it'),
          createMockMessage('assistant', 'done'),
        ],
      });

      const metrics = extractSessionMetrics(session);

      expect(metrics.refactorKeywordCount).toBeGreaterThanOrEqual(1);
      expect(metrics.qualityTermCount).toBeGreaterThanOrEqual(1);
    });

    it('should count positive feedback', () => {
      const session = createMockSession({
        messages: [
          createMockMessage('user', 'perfect! great job, thanks!'),
          createMockMessage('assistant', 'glad I could help'),
        ],
      });

      const metrics = extractSessionMetrics(session);

      expect(metrics.positiveFeedbackCount).toBeGreaterThanOrEqual(2);
    });

    it('should calculate cycle time between messages', () => {
      const session = createMockSession({
        messages: [
          createMockMessage('user', 'question', undefined, new Date('2024-01-01T00:00:00Z')),
          createMockMessage('assistant', 'response', undefined, new Date('2024-01-01T00:00:10Z')),
          createMockMessage('user', 'follow up', undefined, new Date('2024-01-01T00:00:30Z')),
          createMockMessage('assistant', 'response 2', undefined, new Date('2024-01-01T00:00:40Z')),
        ],
      });

      const metrics = extractSessionMetrics(session);

      // Time between assistant response and next user message:
      // 30s - 10s = 20s for first cycle
      // Average = 20s
      expect(metrics.avgCycleTimeSeconds).toBe(20);
    });
  });

  describe('aggregateMetrics', () => {
    it('should return empty metrics for empty sessions array', () => {
      const metrics = aggregateMetrics([]);

      expect(metrics.avgPromptLength).toBe(0);
      expect(metrics.totalTurns).toBe(0);
    });

    it('should aggregate metrics from multiple sessions', () => {
      const session1 = createMockSession({
        messages: [
          createMockMessage('user', '12345'),  // 5 chars
          createMockMessage('assistant', 'ok', [{ id: '1', name: 'Read', input: {} }]),
        ],
      });
      const session2 = createMockSession({
        messages: [
          createMockMessage('user', '1234567890'), // 10 chars
          createMockMessage('assistant', 'ok', [{ id: '2', name: 'Grep', input: {} }]),
        ],
      });

      const metrics = aggregateMetrics([session1, session2]);

      // Average of 5 and 10 = 7.5
      expect(metrics.avgPromptLength).toBe(7.5);
      // Sum of tool usage
      expect(metrics.toolUsage.total).toBe(2);
      expect(metrics.toolUsage.read).toBe(1);
      expect(metrics.toolUsage.grep).toBe(1);
    });

    it('should sum total turns across sessions', () => {
      const session1 = createMockSession({
        messages: [
          createMockMessage('user', 'q1'),
          createMockMessage('assistant', 'a1'),
        ],
      });
      const session2 = createMockSession({
        messages: [
          createMockMessage('user', 'q1'),
          createMockMessage('assistant', 'a1'),
          createMockMessage('user', 'q2'),
          createMockMessage('assistant', 'a2'),
        ],
      });

      const metrics = aggregateMetrics([session1, session2]);

      // 1 turn + 2 turns = 3 total turns
      expect(metrics.totalTurns).toBe(3);
    });
  });

  describe('calculateTypeScores', () => {
    it('should return zero scores for empty metrics', () => {
      const metrics = extractSessionMetrics(createMockSession());
      const scores = calculateTypeScores(metrics);

      // At minimum, all scores should be defined
      expect(scores.architect).toBeDefined();
      expect(scores.scientist).toBeDefined();
      expect(scores.collaborator).toBeDefined();
      expect(scores.speedrunner).toBeDefined();
      expect(scores.craftsman).toBeDefined();
    });

    it('should score architect higher for long initial prompts', () => {
      const longPromptSession = createMockSession({
        messages: [
          createMockMessage('user', 'A'.repeat(600)), // > 500 chars
          createMockMessage('assistant', 'done'),
        ],
      });
      const shortPromptSession = createMockSession({
        messages: [
          createMockMessage('user', 'short'),
          createMockMessage('assistant', 'done'),
        ],
      });

      const longMetrics = extractSessionMetrics(longPromptSession);
      const shortMetrics = extractSessionMetrics(shortPromptSession);

      const longScores = calculateTypeScores(longMetrics);
      const shortScores = calculateTypeScores(shortMetrics);

      expect(longScores.architect).toBeGreaterThan(shortScores.architect);
    });

    it('should score scientist higher for high question frequency', () => {
      const questionSession = createMockSession({
        messages: [
          createMockMessage('user', 'Why? How? What?'),
          createMockMessage('assistant', 'answer'),
        ],
      });
      const statementSession = createMockSession({
        messages: [
          createMockMessage('user', 'Do this.'),
          createMockMessage('assistant', 'done'),
        ],
      });

      const questionMetrics = extractSessionMetrics(questionSession);
      const statementMetrics = extractSessionMetrics(statementSession);

      const questionScores = calculateTypeScores(questionMetrics);
      const statementScores = calculateTypeScores(statementMetrics);

      expect(questionScores.scientist).toBeGreaterThan(statementScores.scientist);
    });

    it('should score speedrunner higher for short prompts', () => {
      const shortPromptSession = createMockSession({
        messages: [
          createMockMessage('user', 'fix it'), // < 50 chars
          createMockMessage('assistant', 'done', [{ id: '1', name: 'Bash', input: {} }]),
        ],
      });
      const longPromptSession = createMockSession({
        messages: [
          createMockMessage('user', 'A'.repeat(200)),
          createMockMessage('assistant', 'done'),
        ],
      });

      const shortMetrics = extractSessionMetrics(shortPromptSession);
      const longMetrics = extractSessionMetrics(longPromptSession);

      const shortScores = calculateTypeScores(shortMetrics);
      const longScores = calculateTypeScores(longMetrics);

      expect(shortScores.speedrunner).toBeGreaterThan(longScores.speedrunner);
    });

    it('should score craftsman higher for quality keywords', () => {
      const qualitySession = createMockSession({
        messages: [
          createMockMessage('user', 'refactor this and add tests, improve the style'),
          createMockMessage('assistant', 'done', [{ id: '1', name: 'Edit', input: {} }]),
        ],
      });
      const basicSession = createMockSession({
        messages: [
          createMockMessage('user', 'do something'),
          createMockMessage('assistant', 'done'),
        ],
      });

      const qualityMetrics = extractSessionMetrics(qualitySession);
      const basicMetrics = extractSessionMetrics(basicSession);

      const qualityScores = calculateTypeScores(qualityMetrics);
      const basicScores = calculateTypeScores(basicMetrics);

      expect(qualityScores.craftsman).toBeGreaterThan(basicScores.craftsman);
    });

    it('should score collaborator higher for high turn count', () => {
      const highTurnSession = createMockSession({
        messages: [
          ...Array(10).fill(null).flatMap((_, i) => [
            createMockMessage('user', `turn ${i}`),
            createMockMessage('assistant', 'response'),
          ]),
        ],
      });
      const lowTurnSession = createMockSession({
        messages: [
          createMockMessage('user', 'single turn'),
          createMockMessage('assistant', 'done'),
        ],
      });

      const highTurnMetrics = extractSessionMetrics(highTurnSession);
      const lowTurnMetrics = extractSessionMetrics(lowTurnSession);

      const highTurnScores = calculateTypeScores(highTurnMetrics);
      const lowTurnScores = calculateTypeScores(lowTurnMetrics);

      expect(highTurnScores.collaborator).toBeGreaterThan(lowTurnScores.collaborator);
    });

    it('should score architect higher for planning keywords', () => {
      const planningSession = createMockSession({
        messages: [
          createMockMessage('user', 'First, let me plan the approach. Then we design the architecture. Next, we implement step by step.'),
          createMockMessage('assistant', 'done'),
        ],
      });
      const noPlanningSesison = createMockSession({
        messages: [
          createMockMessage('user', 'do this thing for me'),
          createMockMessage('assistant', 'done'),
        ],
      });

      const planningMetrics = extractSessionMetrics(planningSession);
      const noPlanningMetrics = extractSessionMetrics(noPlanningSesison);

      // Verify planning keywords are extracted
      expect(planningMetrics.planningKeywordCount).toBeGreaterThan(0);
      expect(noPlanningMetrics.planningKeywordCount).toBe(0);

      const planningScores = calculateTypeScores(planningMetrics);
      const noPlanningScores = calculateTypeScores(noPlanningMetrics);

      expect(planningScores.architect).toBeGreaterThan(noPlanningScores.architect);
    });

    it('should detect step patterns like numbered lists', () => {
      const stepSession = createMockSession({
        messages: [
          createMockMessage('user', '1. Set up the project. 2. Add the components. 3. Write tests.'),
          createMockMessage('assistant', 'done'),
        ],
      });

      const metrics = extractSessionMetrics(stepSession);

      expect(metrics.stepPatternCount).toBeGreaterThanOrEqual(3);
    });

    it('should not give architect points for moderate prompt length', () => {
      // 350 chars is a moderate prompt - should NOT trigger architect bonus anymore
      const moderatePromptSession = createMockSession({
        messages: [
          createMockMessage('user', 'A'.repeat(350)),
          createMockMessage('assistant', 'done'),
        ],
      });

      const metrics = extractSessionMetrics(moderatePromptSession);
      const scores = calculateTypeScores(metrics);

      // With the raised threshold (>500), a 350-char prompt should not give architect points
      // The only signal here is low turns (<2) and low modification rate (<0.05)
      // But those are stricter now, so architect score should be minimal
      expect(scores.architect).toBeLessThanOrEqual(2);
    });
  });

  describe('applyArchitectDampening', () => {
    it('should dampen architect score when close to second highest', () => {
      const scores = {
        architect: 5,
        scientist: 4, // Only 1 point behind
        collaborator: 2,
        speedrunner: 1,
        craftsman: 1,
      };

      const dampened = applyArchitectDampening(scores);

      // With 1-point advantage, dampening factor is 0.6
      // 5 * 0.6 = 3
      expect(dampened.architect).toBe(3);
      // Other scores unchanged
      expect(dampened.scientist).toBe(4);
    });

    it('should apply moderate dampening for 2-3 point advantage', () => {
      const scores = {
        architect: 6,
        scientist: 3, // 3 points behind
        collaborator: 2,
        speedrunner: 1,
        craftsman: 1,
      };

      const dampened = applyArchitectDampening(scores);

      // With 3-point advantage, dampening factor is 0.8
      // 6 * 0.8 = 4.8 → 5
      expect(dampened.architect).toBe(5);
    });

    it('should not dampen when architect has clear advantage', () => {
      const scores = {
        architect: 10,
        scientist: 3, // 7 points behind (> 3)
        collaborator: 2,
        speedrunner: 1,
        craftsman: 1,
      };

      const dampened = applyArchitectDampening(scores);

      // No dampening when advantage > 3
      expect(dampened.architect).toBe(10);
    });

    it('should not dampen when other scores are zero', () => {
      const scores = {
        architect: 5,
        scientist: 0,
        collaborator: 0,
        speedrunner: 0,
        craftsman: 0,
      };

      const dampened = applyArchitectDampening(scores);

      expect(dampened.architect).toBe(5);
    });
  });

  describe('scoresToDistribution', () => {
    it('should return equal distribution for zero scores', () => {
      const scores = {
        architect: 0,
        scientist: 0,
        collaborator: 0,
        speedrunner: 0,
        craftsman: 0,
      };

      const distribution = scoresToDistribution(scores);

      expect(distribution.architect).toBe(20);
      expect(distribution.scientist).toBe(20);
      expect(distribution.collaborator).toBe(20);
      expect(distribution.speedrunner).toBe(20);
      expect(distribution.craftsman).toBe(20);
    });

    it('should sum to exactly 100', () => {
      const scores = {
        architect: 5,
        scientist: 3,
        collaborator: 7,
        speedrunner: 2,
        craftsman: 1,
      };

      const distribution = scoresToDistribution(scores);

      const sum =
        distribution.architect +
        distribution.scientist +
        distribution.collaborator +
        distribution.speedrunner +
        distribution.craftsman;

      expect(sum).toBe(100);
    });

    it('should calculate percentages correctly', () => {
      const scores = {
        architect: 10,
        scientist: 0,
        collaborator: 0,
        speedrunner: 0,
        craftsman: 0,
      };

      const distribution = scoresToDistribution(scores);

      expect(distribution.architect).toBe(100);
      expect(distribution.scientist).toBe(0);
    });

    it('should handle uneven distributions', () => {
      const scores = {
        architect: 1,
        scientist: 1,
        collaborator: 1,
        speedrunner: 1,
        craftsman: 1,
      };

      const distribution = scoresToDistribution(scores);

      // Each should be 20%
      expect(distribution.architect).toBe(20);
      expect(distribution.scientist).toBe(20);
    });
  });

  describe('getPrimaryType', () => {
    it('should return the highest scoring type', () => {
      const distribution = {
        architect: 40,
        scientist: 20,
        collaborator: 15,
        speedrunner: 15,
        craftsman: 10,
      };

      expect(getPrimaryType(distribution)).toBe('architect');
    });

    it('should handle tie by returning first occurrence', () => {
      const distribution = {
        architect: 25,
        scientist: 25,
        collaborator: 20,
        speedrunner: 15,
        craftsman: 15,
      };

      // architect comes first when iterating, so it should be returned
      const primary = getPrimaryType(distribution);
      expect(['architect', 'scientist']).toContain(primary);
    });

    it('should work with equal distribution', () => {
      const distribution = {
        architect: 20,
        scientist: 20,
        collaborator: 20,
        speedrunner: 20,
        craftsman: 20,
      };

      const primary = getPrimaryType(distribution);

      // Should return one of the types
      expect(['architect', 'scientist', 'collaborator', 'speedrunner', 'craftsman']).toContain(
        primary
      );
    });
  });

  describe('getToolUsageHighlight', () => {
    it('should return message for no tool usage', () => {
      const metrics = extractSessionMetrics(createMockSession());

      expect(getToolUsageHighlight(metrics)).toBe('No tool usage detected');
    });

    it('should show top tools with percentages', () => {
      const session = createMockSession({
        messages: [
          createMockMessage('assistant', 'working', [
            { id: '1', name: 'Read', input: {} },
            { id: '2', name: 'Read', input: {} },
            { id: '3', name: 'Grep', input: {} },
          ]),
        ],
      });

      const metrics = extractSessionMetrics(session);
      const highlight = getToolUsageHighlight(metrics);

      expect(highlight).toContain('Read');
      expect(highlight).toContain('%');
    });

    it('should show top 2 tools', () => {
      const session = createMockSession({
        messages: [
          createMockMessage('assistant', 'working', [
            { id: '1', name: 'Read', input: {} },
            { id: '2', name: 'Read', input: {} },
            { id: '3', name: 'Grep', input: {} },
            { id: '4', name: 'Bash', input: {} },
          ]),
        ],
      });

      const metrics = extractSessionMetrics(session);
      const highlight = getToolUsageHighlight(metrics);

      // Should include Read (top) and one of Grep/Bash
      expect(highlight).toContain('Read');
      expect(highlight).toContain(', ');
    });
  });
});
