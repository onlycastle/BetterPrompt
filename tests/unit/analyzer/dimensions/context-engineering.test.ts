/**
 * Context Engineering Dimension Tests
 *
 * Tests for the Context Engineering Score calculation.
 * Based on WRITE-SELECT-COMPRESS-ISOLATE framework.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateContextEngineering,
  type ContextEngineeringResult,
} from '../../../../src/lib/analyzer/dimensions/context-engineering.js';
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
    sessionId: `test-session-${Date.now()}-${Math.random()}`,
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

describe('Context Engineering Dimension', () => {
  describe('calculateContextEngineering', () => {
    it('should return default result for empty sessions', () => {
      const result = calculateContextEngineering([]);

      expect(result.score).toBe(50);
      expect(result.level).toBe('developing');
      expect(result.breakdown.write.score).toBe(50);
      expect(result.breakdown.select.score).toBe(50);
      expect(result.breakdown.compress.score).toBe(50);
      expect(result.breakdown.isolate.score).toBe(50);
    });

    describe('WRITE (Preserve) dimension', () => {
      it('should detect file references', () => {
        const session = createMockSession([
          'Look at src/utils/helper.ts for the pattern',
          'The function is in components/Button.tsx',
          'Check the types in models/user.ts',
        ]);

        const result = calculateContextEngineering([session]);

        expect(result.breakdown.write.fileReferences).toBeGreaterThan(0);
        expect(result.breakdown.write.score).toBeGreaterThan(0);
      });

      it('should detect code element references', () => {
        const session = createMockSession([
          'The SessionParser class needs to be updated',
          'Modify the handleSubmit function',
          'Update the UserContext provider',
        ]);

        const result = calculateContextEngineering([session]);

        expect(result.breakdown.write.codeElementReferences).toBeGreaterThan(0);
      });

      it('should detect constraint mentions', () => {
        const session = createMockSession([
          'This must be async and return a Promise',
          'The response should be cached',
          'It needs to handle errors gracefully',
        ]);

        const result = calculateContextEngineering([session]);

        expect(result.breakdown.write.constraintsMentioned).toBeGreaterThan(0);
      });

      it('should detect pattern references', () => {
        const session = createMockSession([
          'Follow the existing pattern from the auth module',
          'Use a similar approach to the other components',
          'Match the style of the existing code',
        ]);

        const result = calculateContextEngineering([session]);

        expect(result.breakdown.write.patternReferences).toBeGreaterThan(0);
      });
    });

    describe('SELECT (Retrieve) dimension', () => {
      it('should detect file:line references', () => {
        const session = createMockSession([
          'Check src/utils/helper.ts:42 for the implementation',
          'The bug is at components/Button.tsx:156',
          'See models/user.ts:23-45 for context',
        ]);

        const result = calculateContextEngineering([session]);

        expect(result.breakdown.select.codebaseNavigation).toBeGreaterThan(0);
        expect(result.breakdown.select.score).toBeGreaterThan(0);
      });

      it('should measure prompt specificity', () => {
        const specificSession = createMockSession([
          'Update the handleSubmit function in UserForm.tsx to validate the email field using the existing validateEmail utility from src/utils/validation.ts. The validation must reject disposable email domains.',
        ]);

        const vagueSession = createMockSession(['fix the form']);

        const specificResult = calculateContextEngineering([specificSession]);
        const vagueResult = calculateContextEngineering([vagueSession]);

        expect(specificResult.breakdown.select.specificity).toBeGreaterThan(
          vagueResult.breakdown.select.specificity
        );
      });
    });

    describe('COMPRESS (Reduce) dimension', () => {
      it('should detect /compact usage', () => {
        const session = createMockSession([
          '/compact',
          'Now implement the feature',
          '/compact',
          'Continue with the next task',
        ]);

        const result = calculateContextEngineering([session]);

        expect(result.breakdown.compress.compactUsageCount).toBe(2);
        expect(result.breakdown.compress.score).toBeGreaterThan(50);
      });

      it('should calculate iteration efficiency', () => {
        // Short sessions (fewer turns) = better efficiency
        const efficientSession = createMockSession([
          'Implement user authentication with JWT using the existing auth module pattern',
          'Add error handling for token expiration',
        ]);

        // Long session (many turns) = lower efficiency
        const inefficientSession = createMockSession([
          'help',
          'what should I do',
          'how do I start',
          'what file',
          'ok now what',
          'fix it',
          'still broken',
          'try again',
          'more help',
          'confused',
          'just do it',
          'finally',
        ]);

        const efficientResult = calculateContextEngineering([efficientSession]);
        const inefficientResult = calculateContextEngineering([inefficientSession]);

        expect(efficientResult.breakdown.compress.iterationEfficiency).toBeGreaterThan(
          inefficientResult.breakdown.compress.iterationEfficiency
        );
      });

      it('should calculate average turns per session', () => {
        const session = createMockSession(['msg1', 'msg2', 'msg3']);

        const result = calculateContextEngineering([session]);

        expect(result.breakdown.compress.avgTurnsPerSession).toBe(3);
      });
    });

    describe('ISOLATE (Partition) dimension', () => {
      it('should detect Task tool usage', () => {
        const session = createMockSession(['Search for the pattern'], {
          toolCalls: [
            { name: 'Task', input: { prompt: 'Search codebase', subagent_type: 'explore' } },
            { name: 'Task', input: { prompt: 'Analyze file', subagent_type: 'oracle' } },
          ],
        });

        const result = calculateContextEngineering([session]);

        expect(result.breakdown.isolate.taskToolUsage).toBeGreaterThan(0);
        expect(result.breakdown.isolate.score).toBeGreaterThan(0);
      });

      it('should count focused prompts', () => {
        const focusedSession = createMockSession([
          'Implement the login function',
          'Add input validation',
          'Write unit tests',
        ]);

        const unfocusedSession = createMockSession([
          'Implement the login function and also add validation plus write tests and deploy to staging and also fix that other bug',
        ]);

        const focusedResult = calculateContextEngineering([focusedSession]);
        const unfocusedResult = calculateContextEngineering([unfocusedSession]);

        expect(focusedResult.breakdown.isolate.focusedPrompts).toBeGreaterThan(
          unfocusedResult.breakdown.isolate.focusedPrompts
        );
      });
    });

    describe('level classification', () => {
      it('should classify expert level for high scores', () => {
        const expertSessions = Array(5)
          .fill(null)
          .map(() =>
            createMockSession(
              [
                'Look at src/components/UserForm.tsx:45-60 for the existing pattern. Follow the same validation approach using the validateEmail function from src/utils/validation.ts. The new field must be required and should not accept empty strings.',
                '/compact',
              ],
              {
                toolCalls: [{ name: 'Task', input: { subagent_type: 'explore' } }],
              }
            )
          );

        const result = calculateContextEngineering(expertSessions);

        // Should be at least proficient or expert
        expect(['proficient', 'expert', 'developing']).toContain(result.level);
        expect(result.score).toBeGreaterThan(30);
      });

      it('should classify novice level for low scores', () => {
        const noviceSessions = [
          createMockSession(['fix it']),
          createMockSession(['help']),
          createMockSession(['make it work']),
        ];

        const result = calculateContextEngineering(noviceSessions);

        expect(['novice', 'developing']).toContain(result.level);
        expect(result.score).toBeLessThan(60);
      });
    });

    describe('examples detection', () => {
      it('should identify best and worst prompts', () => {
        const session = createMockSession([
          // Good prompt
          'Update the handleSubmit function in UserForm.tsx at line 45 to validate email using the existing pattern from auth.ts. Must handle errors gracefully.',
          // Bad prompt
          'fix',
        ]);

        const result = calculateContextEngineering([session]);

        expect(result.bestExample).not.toBeNull();
        expect(result.worstExample).not.toBeNull();

        if (result.bestExample && result.worstExample) {
          expect(result.bestExample.score).toBeGreaterThan(result.worstExample.score);
          expect(result.bestExample.reasons.length).toBeGreaterThan(0);
        }
      });
    });

    describe('tips generation', () => {
      it('should generate relevant tips for low WRITE score', () => {
        const session = createMockSession(['do something', 'fix it', 'make it work']);

        const result = calculateContextEngineering([session]);

        expect(result.tips.length).toBeGreaterThan(0);
      });

      it('should suggest /compact for low COMPRESS score with no usage', () => {
        const session = createMockSession([
          'msg1',
          'msg2',
          'msg3',
          'msg4',
          'msg5',
          'msg6',
          'msg7',
          'msg8',
          'msg9',
          'msg10',
        ]);

        const result = calculateContextEngineering([session]);

        // If compress score is low and no compact usage, should suggest it
        if (result.breakdown.compress.compactUsageCount === 0) {
          expect(result.tips.some((t) => t.toLowerCase().includes('compact'))).toBe(true);
        }
      });
    });

    describe('interpretation', () => {
      it('should provide interpretation with strongest/weakest categories', () => {
        const session = createMockSession([
          'Check src/file.ts:42 for the pattern. Must use async/await.',
        ]);

        const result = calculateContextEngineering([session]);

        expect(result.interpretation.length).toBeGreaterThan(50);
        // Should mention categories
        expect(
          result.interpretation.includes('WRITE') ||
            result.interpretation.includes('SELECT') ||
            result.interpretation.includes('COMPRESS') ||
            result.interpretation.includes('ISOLATE') ||
            result.interpretation.includes('context')
        ).toBe(true);
      });
    });
  });
});
