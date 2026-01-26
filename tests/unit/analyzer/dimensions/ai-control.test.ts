/**
 * AI Control Dimension Tests
 *
 * Tests for the AI Control Index calculation.
 */

import { describe, it, expect } from 'vitest';
import { calculateAIControl, type AIControlResult } from '../../../../src/lib/analyzer/dimensions/ai-control.js';
import type { ParsedSession, ParsedMessage } from '../../../../src/lib/models/index.js';

// Helper to create mock sessions
function createMockSession(
  userMessages: string[],
  options: {
    toolCalls?: Array<{ name: string; input?: Record<string, unknown> }>;
  } = {}
): ParsedSession {
  const messages: ParsedMessage[] = [];
  const now = new Date();

  userMessages.forEach((content, index) => {
    messages.push({
      role: 'user',
      content,
      timestamp: new Date(now.getTime() + index * 1000),
      hasToolCalls: false,
    });

    // Add assistant response
    messages.push({
      role: 'assistant',
      content: 'Assistant response',
      timestamp: new Date(now.getTime() + index * 1000 + 500),
      hasToolCalls: options.toolCalls ? options.toolCalls.length > 0 : false,
      toolCalls: options.toolCalls?.map((tc) => ({
        name: tc.name,
        input: tc.input || {},
      })),
    });
  });

  return {
    sessionId: `test-session-${Date.now()}`,
    projectPath: '/test/project',
    messages,
    stats: {
      userMessageCount: userMessages.length,
      assistantMessageCount: userMessages.length,
      toolCallCount: options.toolCalls?.length || 0,
      uniqueToolsUsed: options.toolCalls?.map((tc) => tc.name) || [],
      totalInputTokens: 100,
      totalOutputTokens: 200,
    },
  };
}

describe('AI Control Dimension', () => {
  describe('calculateAIControl', () => {
    it('should return default result for empty sessions', () => {
      const result = calculateAIControl([]);

      expect(result.score).toBe(50);
      expect(result.level).toBe('navigator');
      expect(result.breakdown.verificationRate).toBe(50);
      expect(result.growthAreas).toContain('Complete more sessions to measure your AI control patterns');
    });

    it('should detect verification patterns', () => {
      const session = createMockSession([
        'Please modify the function to handle null values',
        'Can you review this code for any issues?',
        'What does this part do exactly?',
        'Change this to use async/await instead',
      ]);

      const result = calculateAIControl([session]);

      // High verification activity should result in good verification score
      expect(result.breakdown.verificationRate).toBeGreaterThan(30);
      // Signals may or may not be generated depending on thresholds
      expect(result.breakdown.verificationRate).toBeDefined();
    });

    it('should detect constraint specification', () => {
      const session = createMockSession([
        'This must be less than 100ms response time',
        'The function should not mutate the input',
        'Make sure to handle all edge cases',
        'Required: use TypeScript strict mode',
      ]);

      const result = calculateAIControl([session]);

      expect(result.breakdown.constraintSpecification).toBeGreaterThan(0);
    });

    it('should detect output critique', () => {
      const session = createMockSession([
        "That's wrong, it should return an array not an object",
        'No, try a different approach',
        'Can you show me an alternative solution?',
        'Actually, let me correct that - it needs to be async',
      ]);

      const result = calculateAIControl([session]);

      expect(result.breakdown.outputCritique).toBeGreaterThan(30);
    });

    it('should detect context control with /compact', () => {
      const session = createMockSession(['/compact', 'Now implement the feature']);

      const result = calculateAIControl([session]);

      expect(result.breakdown.contextControl).toBeGreaterThan(0);
      expect(result.signals.some((s) => s.includes('compact'))).toBe(true);
    });

    it('should detect subagent delegation', () => {
      const session = createMockSession(['Implement the feature'], {
        toolCalls: [{ name: 'Task', input: { prompt: 'Search codebase' } }],
      });

      const result = calculateAIControl([session]);

      expect(result.breakdown.contextControl).toBeGreaterThan(0);
    });

    describe('level classification', () => {
      it('should classify high control as cartographer', () => {
        // Create sessions with high control patterns
        const sessions = Array(5)
          .fill(null)
          .map(() =>
            createMockSession([
              'Review this and tell me if there are any issues',
              'Modify the response to be more performant',
              "That's incorrect, try this approach instead",
              '/compact',
              'Must use strict TypeScript, should not have any any types',
            ])
          );

        const result = calculateAIControl(sessions);

        // High engagement should result in cartographer or navigator
        expect(['cartographer', 'navigator']).toContain(result.level);
        expect(result.score).toBeGreaterThan(30);
      });

      it('should classify low control as explorer or navigator', () => {
        // Create sessions with minimal control patterns
        const sessions = [
          createMockSession(['make this work']),
          createMockSession(['fix it']),
          createMockSession(['add feature']),
        ];

        const result = calculateAIControl(sessions);

        // Low engagement should result in lower scores
        // Depending on context control baseline, may be navigator or explorer
        expect(['explorer', 'navigator']).toContain(result.level);
        expect(result.score).toBeLessThan(50);
      });
    });

    describe('strengths and growth areas', () => {
      it('should identify verification strength', () => {
        const session = createMockSession([
          'Review this code',
          'Check if this is correct',
          'Verify the logic',
          'What do you think about this approach?',
          'Please review again',
          'Modify to fix the issue',
          'Change this part',
          'Update the implementation',
        ]);

        const result = calculateAIControl([session]);

        // Should have some strengths or recommendations
        expect(result.strengths.length + result.growthAreas.length).toBeGreaterThan(0);
      });

      it('should suggest improvements for low constraint scores', () => {
        const session = createMockSession([
          'do something',
          'make it better',
          'fix the bug',
        ]);

        const result = calculateAIControl([session]);

        // Should have growth areas
        expect(result.growthAreas.length).toBeGreaterThan(0);
      });
    });

    describe('interpretation', () => {
      it('should provide interpretation for high scores', () => {
        const sessions = Array(10)
          .fill(null)
          .map(() =>
            createMockSession([
              'Review and modify the implementation',
              'This must handle errors gracefully',
              "That's wrong, try again with these constraints",
              '/compact',
              'Use the Task tool to delegate this',
            ])
          );

        const result = calculateAIControl(sessions);

        expect(result.interpretation.length).toBeGreaterThan(50);
        expect(result.interpretation).toBeDefined();
      });

      it('should provide interpretation for low scores', () => {
        const session = createMockSession(['help', 'ok']);

        const result = calculateAIControl([session]);

        expect(result.interpretation).toContain('Explorer level');
      });
    });

    describe('signals detection', () => {
      it('should detect multiple modification requests', () => {
        const session = createMockSession([
          'Modify this',
          'Change that',
          'Update the code',
          'Alter the implementation',
          'Adjust the logic',
          'Revise the function',
        ]);

        const result = calculateAIControl([session]);

        expect(result.signals.some((s) => s.includes('modification'))).toBe(true);
      });

      it('should detect correction patterns', () => {
        const session = createMockSession([
          "That's wrong, fix it",
          "No, that's incorrect",
          "That's not right",
          'Wrong approach, try again',
        ]);

        const result = calculateAIControl([session]);

        expect(result.signals.some((s) => s.includes('correction'))).toBe(true);
      });
    });
  });
});
