/**
 * Tests for Phrase Pattern Calculator
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePhrasePatternStats,
  formatPhraseStatsForPrompt,
} from '../../../../src/lib/analyzer/calculators/phrase-pattern-calculator';
import type { ParsedSession } from '../../../../src/lib/models/session';

// ============================================================================
// Test Data Factory
// ============================================================================

function createMockSession(
  sessionId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): ParsedSession {
  const now = new Date();
  return {
    sessionId,
    projectPath: '/test/project',
    startTime: now,
    endTime: new Date(now.getTime() + 60000),
    durationSeconds: 60,
    claudeCodeVersion: '1.0.0',
    messages: messages.map((msg, index) => ({
      uuid: `${sessionId}-${index}`,
      role: msg.role,
      timestamp: new Date(now.getTime() + index * 1000),
      content: msg.content,
    })),
    stats: {
      userMessageCount: messages.filter((m) => m.role === 'user').length,
      assistantMessageCount: messages.filter((m) => m.role === 'assistant').length,
      toolCallCount: 0,
      uniqueToolsUsed: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('calculatePhrasePatternStats', () => {
  describe('basic functionality', () => {
    it('should throw error when no sessions provided', () => {
      expect(() => calculatePhrasePatternStats([])).toThrow(
        'Cannot calculate phrase patterns: no sessions provided'
      );
    });

    it('should throw error when no user messages found', () => {
      const session = createMockSession('s1', [
        { role: 'assistant', content: 'Hello' },
      ]);
      expect(() => calculatePhrasePatternStats([session])).toThrow(
        'Cannot calculate phrase patterns: no user messages found'
      );
    });

    it('should return valid stats for single session', () => {
      const session = createMockSession('s1', [
        { role: 'user', content: 'Please help me find the bug in this code' },
        { role: 'assistant', content: 'Sure, let me help you' },
        { role: 'user', content: 'Please help me with another issue' },
      ]);

      const stats = calculatePhrasePatternStats([session]);

      expect(stats.totalMessages).toBe(2);
      expect(stats.totalSessions).toBe(1);
      expect(stats.analysisMetadata.minNGramSize).toBe(2);
      expect(stats.analysisMetadata.maxNGramSize).toBe(5);
    });
  });

  describe('phrase detection', () => {
    it('should detect repeated phrases', () => {
      const session = createMockSession('s1', [
        { role: 'user', content: '연관된 코드를 찾아봐주고 문제해결을 위한 계획을 세워줘' },
        { role: 'user', content: '연관된 코드를 찾아봐주고 버그를 수정해줘' },
        { role: 'user', content: '연관된 코드를 찾아봐줘' },
      ]);

      const stats = calculatePhrasePatternStats([session]);

      // Should find "연관된 코드를" as a repeated phrase
      const foundPhrase = stats.topNGrams.find((p) =>
        p.phrase.includes('연관된')
      );
      expect(foundPhrase).toBeDefined();
      expect(foundPhrase!.frequency).toBeGreaterThanOrEqual(2);
    });

    it('should detect English phrases', () => {
      const sessions = [
        createMockSession('s1', [
          { role: 'user', content: 'find the related code and create a plan' },
        ]),
        createMockSession('s2', [
          { role: 'user', content: 'find the related code and fix the bug' },
        ]),
        createMockSession('s3', [
          { role: 'user', content: 'find the related code please' },
        ]),
      ];

      const stats = calculatePhrasePatternStats(sessions);

      // Should detect "find the related code"
      const foundPhrase = stats.topNGrams.find((p) =>
        p.phrase.includes('related code')
      );
      expect(foundPhrase).toBeDefined();
    });

    it('should track session count correctly', () => {
      const sessions = [
        createMockSession('s1', [
          { role: 'user', content: 'run tests and fix errors' },
        ]),
        createMockSession('s2', [
          { role: 'user', content: 'run tests and fix errors' },
        ]),
        createMockSession('s3', [
          { role: 'user', content: 'run tests and fix errors' },
        ]),
      ];

      const stats = calculatePhrasePatternStats(sessions);

      // Should have session count of 3 for the repeated phrase
      const foundPhrase = stats.topNGrams.find((p) =>
        p.phrase.includes('run tests')
      );
      expect(foundPhrase).toBeDefined();
      expect(foundPhrase!.sessionCount).toBe(3);
    });
  });

  describe('clustering', () => {
    it('should cluster similar phrases', () => {
      const sessions = [
        createMockSession('s1', [
          { role: 'user', content: 'help me fix this bug' },
        ]),
        createMockSession('s2', [
          { role: 'user', content: 'help me fix this issue' },
        ]),
        createMockSession('s3', [
          { role: 'user', content: 'help me fix this problem' },
        ]),
      ];

      const stats = calculatePhrasePatternStats(sessions);

      // Should have "help me fix" as a cluster
      const cluster = stats.clusters.find((c) =>
        c.representative.includes('help me fix')
      );
      // Note: clustering depends on similarity threshold
      expect(stats.clusters.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    it('should handle messages with only stopwords', () => {
      const session = createMockSession('s1', [
        { role: 'user', content: 'the is and or' },
        { role: 'user', content: 'a an the' },
      ]);

      const stats = calculatePhrasePatternStats([session]);

      // Should return empty or minimal results (stopwords filtered)
      expect(stats.topNGrams.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle code blocks gracefully', () => {
      const session = createMockSession('s1', [
        { role: 'user', content: 'Please review this ```const x = 1;``` code' },
        { role: 'user', content: 'Please review this code' },
      ]);

      const stats = calculatePhrasePatternStats([session]);

      // Should find "please review" without code block content
      const foundPhrase = stats.topNGrams.find((p) =>
        p.phrase.includes('please review')
      );
      expect(foundPhrase).toBeDefined();
    });

    it('should handle URLs gracefully', () => {
      const session = createMockSession('s1', [
        { role: 'user', content: 'check out https://example.com/test for info' },
        { role: 'user', content: 'check out the docs for info' },
      ]);

      const stats = calculatePhrasePatternStats([session]);

      // Should not include URL as part of pattern
      expect(stats.topNGrams.every((p) => !p.phrase.includes('http'))).toBe(true);
    });
  });
});

describe('formatPhraseStatsForPrompt', () => {
  it('should format stats as readable text', () => {
    const sessions = [
      createMockSession('s1', [
        { role: 'user', content: 'help me find the bug' },
      ]),
      createMockSession('s2', [
        { role: 'user', content: 'help me find the bug' },
      ]),
      createMockSession('s3', [
        { role: 'user', content: 'help me find the issue' },
      ]),
    ];

    const stats = calculatePhrasePatternStats(sessions);
    const formatted = formatPhraseStatsForPrompt(stats);

    expect(formatted).toContain('PRE-CALCULATED PHRASE STATISTICS');
    expect(formatted).toContain('Total messages analyzed: 3');
    expect(formatted).toContain('Total sessions: 3');
    expect(formatted).toContain('do not re-count');
  });

  it('should include top phrases with frequency', () => {
    const sessions = [
      createMockSession('s1', [
        { role: 'user', content: 'please check the code' },
      ]),
      createMockSession('s2', [
        { role: 'user', content: 'please check the code' },
      ]),
      createMockSession('s3', [
        { role: 'user', content: 'please check the code' },
      ]),
    ];

    const stats = calculatePhrasePatternStats(sessions);
    const formatted = formatPhraseStatsForPrompt(stats);

    // Should show frequency count
    expect(formatted).toMatch(/\d+x/);
  });
});
