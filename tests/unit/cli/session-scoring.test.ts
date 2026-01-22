import { describe, it, expect } from 'vitest';
import {
  extractQualityMetrics,
  calculateQualityScore,
  calculateNoveltyScore,
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
        uniqueFilesRead: new Set(),
        uniqueFilesModified: new Set(),
        promptVocabularySize: 10,
        totalPromptWords: 20,
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
        uniqueFilesRead: new Set(['/f1.ts', '/f2.ts']),
        uniqueFilesModified: new Set(['/f1.ts', '/f2.ts']),
        promptVocabularySize: 50,
        totalPromptWords: 100,
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
        uniqueFilesRead: new Set(['/f1.ts', '/f2.ts']),
        uniqueFilesModified: new Set(['/f1.ts', '/f2.ts']),
        promptVocabularySize: 50,
        totalPromptWords: 100,
      };

      const readOnlyMetrics: SessionQualityMetrics = {
        ...activeMetrics,
        editWriteCount: 0,
        uniqueToolsUsed: new Set(['Read', 'Grep']),
        uniqueFilesModified: new Set(),
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
        uniqueFilesRead: new Set(['/f1.ts', '/f2.ts']),
        uniqueFilesModified: new Set(['/f1.ts', '/f2.ts']),
        promptVocabularySize: 50,
        totalPromptWords: 100,
      };

      const singleToolMetrics: SessionQualityMetrics = {
        ...diverseMetrics,
        uniqueToolsUsed: new Set(['Read']),
        editWriteCount: 0,
        uniqueFilesModified: new Set(),
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
        uniqueFilesRead: new Set(['/f1.ts', '/f2.ts']),
        uniqueFilesModified: new Set(['/f1.ts', '/f2.ts']),
        promptVocabularySize: 50,
        totalPromptWords: 100,
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
        uniqueFilesRead: new Set(['/file1.ts', '/file2.ts']),
        uniqueFilesModified: new Set(['/file1.ts']),
        promptVocabularySize: 50,
        totalPromptWords: 100,
      };

      const score = calculateQualityScore(metrics);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('extractQualityMetrics - novelty metrics', () => {
    it('should track unique files read', () => {
      const content = `
{"type": "assistant", "message": [{"type": "tool_use", "name": "Read", "input": {"file_path": "/src/file1.ts"}}], "timestamp": "2024-01-01T00:00:00Z"}
{"type": "assistant", "message": [{"type": "tool_use", "name": "Read", "input": {"file_path": "/src/file2.ts"}}], "timestamp": "2024-01-01T00:00:01Z"}
{"type": "assistant", "message": [{"type": "tool_use", "name": "Read", "input": {"file_path": "/src/file1.ts"}}], "timestamp": "2024-01-01T00:00:02Z"}
      `.trim();

      const metrics = extractQualityMetrics(content);
      expect(metrics.uniqueFilesRead.size).toBe(2);
      expect(metrics.uniqueFilesRead.has('/src/file1.ts')).toBe(true);
      expect(metrics.uniqueFilesRead.has('/src/file2.ts')).toBe(true);
    });

    it('should track unique files modified', () => {
      const content = `
{"type": "assistant", "message": [{"type": "tool_use", "name": "Edit", "input": {"file_path": "/src/file1.ts"}}], "timestamp": "2024-01-01T00:00:00Z"}
{"type": "assistant", "message": [{"type": "tool_use", "name": "Write", "input": {"file_path": "/src/file2.ts"}}], "timestamp": "2024-01-01T00:00:01Z"}
{"type": "assistant", "message": [{"type": "tool_use", "name": "Edit", "input": {"file_path": "/src/file1.ts"}}], "timestamp": "2024-01-01T00:00:02Z"}
      `.trim();

      const metrics = extractQualityMetrics(content);
      expect(metrics.uniqueFilesModified.size).toBe(2);
      expect(metrics.uniqueFilesModified.has('/src/file1.ts')).toBe(true);
      expect(metrics.uniqueFilesModified.has('/src/file2.ts')).toBe(true);
    });

    it('should track vocabulary from user prompts', () => {
      const content = `
{"type": "user", "message": "Please help me refactor the authentication module", "timestamp": "2024-01-01T00:00:00Z"}
{"type": "user", "message": "Also add some validation logic to the form", "timestamp": "2024-01-01T00:00:01Z"}
      `.trim();

      const metrics = extractQualityMetrics(content);
      expect(metrics.promptVocabularySize).toBeGreaterThan(0);
      expect(metrics.totalPromptWords).toBeGreaterThan(0);
      // Vocabulary size should be less than total words (some words repeat)
      expect(metrics.promptVocabularySize).toBeLessThanOrEqual(metrics.totalPromptWords);
    });

    it('should handle path parameter for Glob tool', () => {
      const content = `
{"type": "assistant", "message": [{"type": "tool_use", "name": "Glob", "input": {"path": "/src"}}], "timestamp": "2024-01-01T00:00:00Z"}
      `.trim();

      const metrics = extractQualityMetrics(content);
      expect(metrics.uniqueToolsUsed.has('Glob')).toBe(true);
    });
  });

  describe('calculateNoveltyScore', () => {
    it('should return high score for diverse file access', () => {
      const diverseMetrics: SessionQualityMetrics = {
        userMessageCount: 5,
        assistantMessageCount: 5,
        totalUserTextLength: 500,
        questionCount: 3,
        iterationCount: 2,
        uniqueToolsUsed: new Set(['Read', 'Edit']),
        editWriteCount: 3,
        searchToolCount: 2,
        errorCount: 0,
        errorRecoveryCount: 0,
        uniqueFilesRead: new Set(['/f1.ts', '/f2.ts', '/f3.ts', '/f4.ts', '/f5.ts']),
        uniqueFilesModified: new Set(['/f1.ts', '/f2.ts', '/f3.ts']),
        promptVocabularySize: 80,
        totalPromptWords: 150,
      };

      const singleFileMetrics: SessionQualityMetrics = {
        ...diverseMetrics,
        uniqueFilesRead: new Set(['/f1.ts']),
        uniqueFilesModified: new Set(['/f1.ts']),
      };

      const diverseScore = calculateNoveltyScore(diverseMetrics);
      const singleFileScore = calculateNoveltyScore(singleFileMetrics);

      expect(diverseScore).toBeGreaterThan(singleFileScore);
    });

    it('should return high score for diverse vocabulary', () => {
      const diverseVocab: SessionQualityMetrics = {
        userMessageCount: 5,
        assistantMessageCount: 5,
        totalUserTextLength: 500,
        questionCount: 3,
        iterationCount: 2,
        uniqueToolsUsed: new Set(['Read', 'Edit']),
        editWriteCount: 3,
        searchToolCount: 2,
        errorCount: 0,
        errorRecoveryCount: 0,
        uniqueFilesRead: new Set(['/f1.ts']),
        uniqueFilesModified: new Set(['/f1.ts']),
        promptVocabularySize: 100,
        totalPromptWords: 150,
      };

      const repetitiveVocab: SessionQualityMetrics = {
        ...diverseVocab,
        promptVocabularySize: 20,
        totalPromptWords: 150,
      };

      const diverseScore = calculateNoveltyScore(diverseVocab);
      const repetitiveScore = calculateNoveltyScore(repetitiveVocab);

      expect(diverseScore).toBeGreaterThan(repetitiveScore);
    });

    it('should return 0 for empty metrics', () => {
      const metrics: SessionQualityMetrics = {
        userMessageCount: 0,
        assistantMessageCount: 0,
        totalUserTextLength: 0,
        questionCount: 0,
        iterationCount: 0,
        uniqueToolsUsed: new Set(),
        editWriteCount: 0,
        searchToolCount: 0,
        errorCount: 0,
        errorRecoveryCount: 0,
        uniqueFilesRead: new Set(),
        uniqueFilesModified: new Set(),
        promptVocabularySize: 0,
        totalPromptWords: 0,
      };

      const score = calculateNoveltyScore(metrics);
      expect(score).toBe(0);
    });

    it('should return score between 0 and 100', () => {
      const metrics: SessionQualityMetrics = {
        userMessageCount: 10,
        assistantMessageCount: 10,
        totalUserTextLength: 2000,
        questionCount: 15,
        iterationCount: 8,
        uniqueToolsUsed: new Set(['Read', 'Edit', 'Grep', 'Glob']),
        editWriteCount: 8,
        searchToolCount: 6,
        errorCount: 0,
        errorRecoveryCount: 0,
        uniqueFilesRead: new Set(['/f1', '/f2', '/f3', '/f4', '/f5', '/f6', '/f7', '/f8', '/f9', '/f10']),
        uniqueFilesModified: new Set(['/f1', '/f2', '/f3', '/f4', '/f5']),
        promptVocabularySize: 200,
        totalPromptWords: 400,
      };

      const score = calculateNoveltyScore(metrics);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});
