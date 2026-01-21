import { describe, it, expect } from 'vitest';
import {
  extractQualityMetrics,
  calculateQualityScore,
  type SessionQualityMetrics,
} from '../../../packages/cli/src/session-scoring.js';

describe('Session Scoring', () => {
  describe('extractQualityMetrics', () => {
    it('should count user and assistant messages', () => {
      const content = `
{"type": "user", "message": "Hello", "timestamp": "2024-01-01T00:00:00Z"}
{"type": "assistant", "message": [], "timestamp": "2024-01-01T00:00:01Z"}
{"type": "user", "message": "Thanks", "timestamp": "2024-01-01T00:00:02Z"}
{"type": "assistant", "message": [], "timestamp": "2024-01-01T00:00:03Z"}
      `.trim();

      const metrics = extractQualityMetrics(content);
      expect(metrics.userMessageCount).toBe(2);
      expect(metrics.assistantMessageCount).toBe(2);
    });

    it('should count questions in user messages', () => {
      const content = `
{"type": "user", "message": "Why does this work? How can I fix it?", "timestamp": "2024-01-01T00:00:00Z"}
{"type": "user", "message": "What is the best approach?", "timestamp": "2024-01-01T00:00:01Z"}
      `.trim();

      const metrics = extractQualityMetrics(content);
      expect(metrics.questionCount).toBeGreaterThanOrEqual(3); // "Why", "How", "What", "?"
    });

    it('should detect iteration patterns', () => {
      const content = `
{"type": "user", "message": "Actually, change that to use async instead", "timestamp": "2024-01-01T00:00:00Z"}
{"type": "user", "message": "Wait, try again with the other method", "timestamp": "2024-01-01T00:00:01Z"}
      `.trim();

      const metrics = extractQualityMetrics(content);
      expect(metrics.iterationCount).toBeGreaterThanOrEqual(2); // "change", "try again"
    });

    it('should extract unique tools used', () => {
      const content = `
{"type": "assistant", "message": [{"type": "tool_use", "name": "Read"}], "timestamp": "2024-01-01T00:00:00Z"}
{"type": "assistant", "message": [{"type": "tool_use", "name": "Edit"}], "timestamp": "2024-01-01T00:00:01Z"}
{"type": "assistant", "message": [{"type": "tool_use", "name": "Read"}], "timestamp": "2024-01-01T00:00:02Z"}
      `.trim();

      const metrics = extractQualityMetrics(content);
      expect(metrics.uniqueToolsUsed.size).toBe(2);
      expect(metrics.uniqueToolsUsed.has('Read')).toBe(true);
      expect(metrics.uniqueToolsUsed.has('Edit')).toBe(true);
    });

    it('should count edit/write tools', () => {
      const content = `
{"type": "assistant", "message": [{"type": "tool_use", "name": "Edit"}], "timestamp": "2024-01-01T00:00:00Z"}
{"type": "assistant", "message": [{"type": "tool_use", "name": "Write"}], "timestamp": "2024-01-01T00:00:01Z"}
{"type": "assistant", "message": [{"type": "tool_use", "name": "Edit"}], "timestamp": "2024-01-01T00:00:02Z"}
      `.trim();

      const metrics = extractQualityMetrics(content);
      expect(metrics.editWriteCount).toBe(3);
    });

    it('should count search tools', () => {
      const content = `
{"type": "assistant", "message": [{"type": "tool_use", "name": "Grep"}], "timestamp": "2024-01-01T00:00:00Z"}
{"type": "assistant", "message": [{"type": "tool_use", "name": "Glob"}], "timestamp": "2024-01-01T00:00:01Z"}
{"type": "assistant", "message": [{"type": "tool_use", "name": "Read"}], "timestamp": "2024-01-01T00:00:02Z"}
      `.trim();

      const metrics = extractQualityMetrics(content);
      expect(metrics.searchToolCount).toBe(3);
    });

    it('should track errors and recoveries', () => {
      const content = `
{"type": "assistant", "message": [{"type": "tool_result", "is_error": true}], "timestamp": "2024-01-01T00:00:00Z"}
{"type": "assistant", "message": [{"type": "tool_use", "name": "Edit"}], "timestamp": "2024-01-01T00:00:01Z"}
      `.trim();

      const metrics = extractQualityMetrics(content);
      expect(metrics.errorCount).toBe(1);
      expect(metrics.errorRecoveryCount).toBe(1);
    });

    it('should handle empty content', () => {
      const metrics = extractQualityMetrics('');
      expect(metrics.userMessageCount).toBe(0);
      expect(metrics.assistantMessageCount).toBe(0);
      expect(metrics.uniqueToolsUsed.size).toBe(0);
    });

    it('should handle malformed JSON lines', () => {
      const content = `
{"type": "user", "message": "Hello", "timestamp": "2024-01-01T00:00:00Z"}
not valid json
{"type": "assistant", "message": [], "timestamp": "2024-01-01T00:00:01Z"}
      `.trim();

      const metrics = extractQualityMetrics(content);
      expect(metrics.userMessageCount).toBe(1);
      expect(metrics.assistantMessageCount).toBe(1);
    });

    it('should calculate total user text length', () => {
      const content = `
{"type": "user", "message": "Short", "timestamp": "2024-01-01T00:00:00Z"}
{"type": "user", "message": "A much longer message with more content", "timestamp": "2024-01-01T00:00:01Z"}
      `.trim();

      const metrics = extractQualityMetrics(content);
      expect(metrics.totalUserTextLength).toBeGreaterThan(40);
    });
  });

  describe('calculateQualityScore', () => {
    it('should return 0 for sessions with less than 2 messages', () => {
      const metrics: SessionQualityMetrics = {
        userMessageCount: 1,
        assistantMessageCount: 0,
        totalUserTextLength: 100,
        questionCount: 1,
        iterationCount: 0,
        uniqueToolsUsed: new Set(),
        editWriteCount: 0,
        searchToolCount: 0,
        errorCount: 0,
        errorRecoveryCount: 0,
      };

      expect(calculateQualityScore(metrics)).toBe(0);
    });

    it('should give higher scores to sessions with good turn balance', () => {
      const balancedMetrics: SessionQualityMetrics = {
        userMessageCount: 5,
        assistantMessageCount: 5,
        totalUserTextLength: 500, // 100 chars avg per user message
        questionCount: 3,
        iterationCount: 2,
        uniqueToolsUsed: new Set(['Read', 'Edit', 'Grep']),
        editWriteCount: 3,
        searchToolCount: 2,
        errorCount: 1,
        errorRecoveryCount: 1,
      };

      const imbalancedMetrics: SessionQualityMetrics = {
        ...balancedMetrics,
        userMessageCount: 1,
        assistantMessageCount: 9,
        totalUserTextLength: 100, // Same avg per user message (100 chars)
        questionCount: 1, // Proportionally fewer questions
        iterationCount: 0, // Less iteration with fewer user turns
      };

      const balancedScore = calculateQualityScore(balancedMetrics);
      const imbalancedScore = calculateQualityScore(imbalancedMetrics);

      expect(balancedScore).toBeGreaterThan(imbalancedScore);
    });

    it('should penalize read-only sessions', () => {
      const activeMetrics: SessionQualityMetrics = {
        userMessageCount: 5,
        assistantMessageCount: 5,
        totalUserTextLength: 500,
        questionCount: 3,
        iterationCount: 2,
        uniqueToolsUsed: new Set(['Read', 'Edit', 'Grep']),
        editWriteCount: 3,
        searchToolCount: 2,
        errorCount: 0,
        errorRecoveryCount: 0,
      };

      const readOnlyMetrics: SessionQualityMetrics = {
        ...activeMetrics,
        editWriteCount: 0,
        uniqueToolsUsed: new Set(['Read', 'Grep']),
      };

      const activeScore = calculateQualityScore(activeMetrics);
      const readOnlyScore = calculateQualityScore(readOnlyMetrics);

      expect(activeScore).toBeGreaterThan(readOnlyScore);
    });

    it('should penalize single tool sessions', () => {
      const diverseMetrics: SessionQualityMetrics = {
        userMessageCount: 5,
        assistantMessageCount: 5,
        totalUserTextLength: 500,
        questionCount: 3,
        iterationCount: 2,
        uniqueToolsUsed: new Set(['Read', 'Edit', 'Grep', 'Bash']),
        editWriteCount: 2,
        searchToolCount: 2,
        errorCount: 0,
        errorRecoveryCount: 0,
      };

      const singleToolMetrics: SessionQualityMetrics = {
        ...diverseMetrics,
        uniqueToolsUsed: new Set(['Read']),
        editWriteCount: 0,
      };

      const diverseScore = calculateQualityScore(diverseMetrics);
      const singleToolScore = calculateQualityScore(singleToolMetrics);

      expect(diverseScore).toBeGreaterThan(singleToolScore);
    });

    it('should reward error recovery', () => {
      const recoveredMetrics: SessionQualityMetrics = {
        userMessageCount: 5,
        assistantMessageCount: 5,
        totalUserTextLength: 500,
        questionCount: 3,
        iterationCount: 2,
        uniqueToolsUsed: new Set(['Read', 'Edit', 'Grep']),
        editWriteCount: 3,
        searchToolCount: 2,
        errorCount: 3,
        errorRecoveryCount: 3,
      };

      const unrecoveredMetrics: SessionQualityMetrics = {
        ...recoveredMetrics,
        errorRecoveryCount: 0,
      };

      const recoveredScore = calculateQualityScore(recoveredMetrics);
      const unrecoveredScore = calculateQualityScore(unrecoveredMetrics);

      expect(recoveredScore).toBeGreaterThan(unrecoveredScore);
    });

    it('should return score between 0 and 100', () => {
      const metrics: SessionQualityMetrics = {
        userMessageCount: 10,
        assistantMessageCount: 10,
        totalUserTextLength: 2000,
        questionCount: 15,
        iterationCount: 8,
        uniqueToolsUsed: new Set(['Read', 'Edit', 'Grep', 'Glob', 'Bash', 'Write']),
        editWriteCount: 8,
        searchToolCount: 6,
        errorCount: 2,
        errorRecoveryCount: 2,
      };

      const score = calculateQualityScore(metrics);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});
