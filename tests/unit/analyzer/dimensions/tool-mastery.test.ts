/**
 * Tool Mastery Dimension Tests
 *
 * Tests for the Tool Mastery Profile calculation.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateToolMastery,
  type ToolMasteryResult,
  type MasteryLevel,
} from '../../../../src/lib/analyzer/dimensions/tool-mastery.js';
import type { ParsedSession, ParsedMessage } from '../../../../src/lib/models/index.js';

/**
 * Helper to create a session with specified tool calls
 */
function createToolSession(tools: string[]): ParsedSession {
  const messages: ParsedMessage[] = [];
  const now = new Date();

  // Create messages with tool calls
  tools.forEach((toolName, index) => {
    // User message
    messages.push({
      role: 'user',
      content: `Use ${toolName} tool`,
      timestamp: new Date(now.getTime() + index * 1000),
      hasToolCalls: false,
    });

    // Assistant message with tool call
    messages.push({
      role: 'assistant',
      content: 'Using the tool',
      timestamp: new Date(now.getTime() + index * 1000 + 500),
      hasToolCalls: true,
      toolCalls: [
        {
          name: toolName,
          input: {},
        },
      ],
    });
  });

  return {
    sessionId: `test-session-${Date.now()}`,
    projectPath: '/test/project',
    messages,
    stats: {
      userMessageCount: tools.length,
      assistantMessageCount: tools.length,
      toolCallCount: tools.length,
      uniqueToolsUsed: Array.from(new Set(tools)),
      totalInputTokens: 100,
      totalOutputTokens: 200,
    },
  };
}

describe('Tool Mastery Dimension', () => {
  describe('calculateToolMastery', () => {
    describe('empty or no tool scenarios', () => {
      it('should return default result for empty sessions', () => {
        const result = calculateToolMastery([]);

        expect(result.overallScore).toBe(0);
        expect(result.topTools).toEqual([]);
        expect(result.toolUsage).toEqual({});
        expect(result.underutilizedTools).toEqual([]);
        expect(result.tips).toEqual([
          'Complete more sessions to see your tool mastery profile.',
        ]);
      });

      it('should return default result for sessions with no tool calls', () => {
        const session: ParsedSession = {
          sessionId: 'test-session',
          projectPath: '/test/project',
          messages: [
            {
              role: 'user',
              content: 'Hello',
              timestamp: new Date(),
              hasToolCalls: false,
            },
            {
              role: 'assistant',
              content: 'Hi there',
              timestamp: new Date(),
              hasToolCalls: false,
            },
          ],
          stats: {
            userMessageCount: 1,
            assistantMessageCount: 1,
            toolCallCount: 0,
            uniqueToolsUsed: [],
            totalInputTokens: 50,
            totalOutputTokens: 50,
          },
        };

        const result = calculateToolMastery([session]);

        expect(result.overallScore).toBe(0);
        expect(result.topTools).toEqual([]);
        expect(result.toolUsage).toEqual({});
      });
    });

    describe('diverse tool usage', () => {
      it('should calculate higher score for diverse tool usage', () => {
        const session = createToolSession([
          'Read',
          'Edit',
          'Grep',
          'Glob',
          'Bash',
          'Write',
          'Task',
          'TodoWrite',
        ]);

        const result = calculateToolMastery([session]);

        expect(result.overallScore).toBeGreaterThan(50);
        expect(Object.keys(result.toolUsage).length).toBe(8);
      });

      it('should calculate lower score for limited tool diversity', () => {
        const session = createToolSession(['Read', 'Read', 'Write', 'Write']);

        const result = calculateToolMastery([session]);

        expect(result.overallScore).toBeLessThan(50);
        expect(Object.keys(result.toolUsage).length).toBe(2);
      });
    });

    describe('expected tool usage ratios', () => {
      it('should calculate tool percentages correctly', () => {
        const tools = [
          'Read', // 20%
          'Read',
          'Edit', // 20%
          'Edit',
          'Bash', // 20%
          'Bash',
          'Grep', // 10%
          'Write', // 10%
          'Glob', // 10%
          'Task', // 10%
        ];
        const session = createToolSession(tools);

        const result = calculateToolMastery([session]);

        expect(result.toolUsage['Read'].percentage).toBe(20);
        expect(result.toolUsage['Edit'].percentage).toBe(20);
        expect(result.toolUsage['Bash'].percentage).toBe(20);
        expect(result.toolUsage['Grep'].percentage).toBe(10);
        expect(result.toolUsage['Write'].percentage).toBe(10);
      });

      it('should assign correct mastery levels based on expected usage', () => {
        // Create session with tools at different usage levels
        const tools = [
          'Read', // 1/10 = 10% (expected 20%, ratio 0.5 = basic)
          'Edit',
          'Edit',
          'Edit',
          'Edit', // 4/10 = 40% (expected 20%, ratio 2.0 = expert)
          'Bash',
          'Bash', // 2/10 = 20% (expected 15%, ratio 1.33 = adept)
          'Grep', // 1/10 = 10% (expected 10%, ratio 1.0 = adept)
          'Write',
          'Write', // 2/10 = 20% (expected 10%, ratio 2.0 = expert)
        ];
        const session = createToolSession(tools);

        const result = calculateToolMastery([session]);

        expect(result.toolUsage['Read'].level).toBe('basic'); // ratio < 0.7
        expect(result.toolUsage['Edit'].level).toBe('expert'); // ratio >= 1.5
        expect(result.toolUsage['Bash'].level).toBe('adept'); // 0.7 <= ratio < 1.5
        expect(result.toolUsage['Grep'].level).toBe('adept'); // ratio ~1.0
      });
    });

    describe('advanced tool usage', () => {
      it('should give bonus score for Task usage', () => {
        const sessionWithTask = createToolSession([
          'Read',
          'Edit',
          'Bash',
          'Task',
        ]);
        const sessionWithoutTask = createToolSession(['Read', 'Edit', 'Bash', 'Write']);

        const resultWithTask = calculateToolMastery([sessionWithTask]);
        const resultWithoutTask = calculateToolMastery([sessionWithoutTask]);

        expect(resultWithTask.overallScore).toBeGreaterThan(resultWithoutTask.overallScore);
      });

      it('should give bonus score for TodoWrite usage', () => {
        const sessionWithTodo = createToolSession([
          'Read',
          'Edit',
          'Bash',
          'TodoWrite',
        ]);
        const sessionWithoutTodo = createToolSession(['Read', 'Edit', 'Bash', 'Write']);

        const resultWithTodo = calculateToolMastery([sessionWithTodo]);
        const resultWithoutTodo = calculateToolMastery([sessionWithoutTodo]);

        expect(resultWithTodo.overallScore).toBeGreaterThan(resultWithoutTodo.overallScore);
      });

      it('should give bonus score for WebSearch and WebFetch', () => {
        const sessionWithWeb = createToolSession([
          'Read',
          'Edit',
          'WebSearch',
          'WebFetch',
        ]);
        const sessionWithoutWeb = createToolSession(['Read', 'Edit', 'Bash', 'Write']);

        const resultWithWeb = calculateToolMastery([sessionWithWeb]);
        const resultWithoutWeb = calculateToolMastery([sessionWithoutWeb]);

        expect(resultWithWeb.overallScore).toBeGreaterThan(resultWithoutWeb.overallScore);
      });
    });

    describe('topTools extraction', () => {
      it('should extract top 3 most used tools', () => {
        const tools = [
          'Read',
          'Read',
          'Read',
          'Read',
          'Read', // 5 times
          'Edit',
          'Edit',
          'Edit', // 3 times
          'Bash',
          'Bash', // 2 times
          'Write', // 1 time
          'Grep', // 1 time
        ];
        const session = createToolSession(tools);

        const result = calculateToolMastery([session]);

        expect(result.topTools).toEqual(['Read', 'Edit', 'Bash']);
      });

      it('should handle less than 3 tools correctly', () => {
        const session = createToolSession(['Read', 'Edit']);

        const result = calculateToolMastery([session]);

        expect(result.topTools.length).toBe(2);
        expect(result.topTools).toContain('Read');
        expect(result.topTools).toContain('Edit');
      });
    });

    describe('underutilized tools detection', () => {
      it('should detect underutilized tools', () => {
        // Use only Read heavily, ignore others
        const tools = Array(100).fill('Read');
        const session = createToolSession(tools);

        const result = calculateToolMastery([session]);

        // Should detect Edit, Grep, Glob, Bash, Write as underutilized
        expect(result.underutilizedTools.length).toBeGreaterThan(0);
        expect(result.underutilizedTools).toContain('Edit');
        expect(result.underutilizedTools).toContain('Bash');
      });

      it('should not flag tools with low expected usage as underutilized', () => {
        // WebSearch and WebFetch have expected < 0.03, should not be flagged
        const tools = ['Read', 'Read', 'Edit', 'Edit', 'Bash', 'Bash'];
        const session = createToolSession(tools);

        const result = calculateToolMastery([session]);

        // WebSearch/WebFetch should not be in underutilized (expected too low)
        expect(result.underutilizedTools).not.toContain('WebSearch');
        expect(result.underutilizedTools).not.toContain('WebFetch');
      });

      it('should not flag tools with sufficient usage', () => {
        // Balanced usage
        const tools = [
          'Read',
          'Read',
          'Edit',
          'Edit',
          'Bash',
          'Bash',
          'Grep',
          'Glob',
          'Write',
          'Task',
        ];
        const session = createToolSession(tools);

        const result = calculateToolMastery([session]);

        // With balanced usage, fewer or no tools should be underutilized
        // Each tool gets 10-20% which is close to expected
        expect(result.underutilizedTools.length).toBeLessThan(5);
      });
    });

    describe('tips generation', () => {
      it('should suggest Task tool when underutilized', () => {
        const tools = Array(20)
          .fill('Read')
          .concat(Array(20).fill('Edit'));
        const session = createToolSession(tools);

        const result = calculateToolMastery([session]);

        const hasTaskTip = result.tips.some((tip) =>
          tip.includes('Task tool')
        );
        expect(hasTaskTip).toBe(true);
      });

      it('should suggest search tools when Grep/Glob underutilized', () => {
        const tools = Array(50).fill('Edit');
        const session = createToolSession(tools);

        const result = calculateToolMastery([session]);

        const hasSearchTip = result.tips.some(
          (tip) => tip.includes('Search') || tip.includes('pattern')
        );
        expect(hasSearchTip).toBe(true);
      });

      it('should not suggest WebSearch when underutilized (expected usage too low)', () => {
        // WebSearch has expected 0.03, which is not > 0.03, so it won't be flagged
        const tools = Array(50).fill('Write');
        const session = createToolSession(tools);

        const result = calculateToolMastery([session]);

        // WebSearch should not be in tips because its expected usage is too low (0.03)
        const hasWebSearchTip = result.tips.some((tip) =>
          tip.includes('WebSearch')
        );
        expect(hasWebSearchTip).toBe(false);
      });

      it('should suggest reading more when modifications outpace exploration', () => {
        // Heavy modification (Edit, Write) vs light exploration (Read, Grep, Glob)
        const tools = [
          'Read', // 1 exploration
          'Edit',
          'Edit',
          'Edit',
          'Write',
          'Write',
          'Write', // 6 modifications
        ];
        const session = createToolSession(tools);

        const result = calculateToolMastery([session]);

        const hasExplorationTip = result.tips.some(
          (tip) => tip.includes('reading') || tip.includes('exploration')
        );
        expect(hasExplorationTip).toBe(true);
      });

      it('should limit tips to maximum of 3', () => {
        // Create scenario with many underutilized tools
        const tools = Array(100).fill('Read');
        const session = createToolSession(tools);

        const result = calculateToolMastery([session]);

        expect(result.tips.length).toBeLessThanOrEqual(3);
      });
    });

    describe('tool normalization', () => {
      it('should normalize lowercase tool names', () => {
        const session = createToolSession(['read', 'edit', 'bash']);

        const result = calculateToolMastery([session]);

        expect(result.toolUsage['Read']).toBeDefined();
        expect(result.toolUsage['Edit']).toBeDefined();
        expect(result.toolUsage['Bash']).toBeDefined();
      });

      it('should normalize mixed case tool names', () => {
        const session = createToolSession(['READ', 'GrEp', 'BaSh']);

        const result = calculateToolMastery([session]);

        expect(result.toolUsage['Read']).toBeDefined();
        expect(result.toolUsage['Grep']).toBeDefined();
        expect(result.toolUsage['Bash']).toBeDefined();
      });

      it('should handle TodoWrite variants correctly', () => {
        const session = createToolSession(['todowrite', 'TodoWrite', 'TODOWRITE']);

        const result = calculateToolMastery([session]);

        expect(result.toolUsage['TodoWrite']).toBeDefined();
        expect(result.toolUsage['TodoWrite'].count).toBe(3);
      });

      it('should distinguish Write from TodoWrite', () => {
        const session = createToolSession(['Write', 'TodoWrite', 'write']);

        const result = calculateToolMastery([session]);

        expect(result.toolUsage['Write'].count).toBe(2);
        expect(result.toolUsage['TodoWrite'].count).toBe(1);
      });

      it('should capitalize unknown tools', () => {
        const session = createToolSession(['unknownTool', 'customtool']);

        const result = calculateToolMastery([session]);

        expect(result.toolUsage['UnknownTool']).toBeDefined();
        expect(result.toolUsage['Customtool']).toBeDefined();
      });
    });

    describe('overall score calculation', () => {
      it('should calculate score based on diversity', () => {
        const limitedDiversity = createToolSession(['Read', 'Read', 'Edit', 'Edit']);
        const highDiversity = createToolSession([
          'Read',
          'Edit',
          'Grep',
          'Glob',
          'Bash',
          'Write',
        ]);

        const resultLimited = calculateToolMastery([limitedDiversity]);
        const resultHigh = calculateToolMastery([highDiversity]);

        expect(resultHigh.overallScore).toBeGreaterThan(resultLimited.overallScore);
      });

      it('should calculate score based on balance', () => {
        // Balanced usage close to expected ratios
        const balanced = createToolSession([
          'Read',
          'Read', // 20%
          'Edit',
          'Edit', // 20%
          'Bash',
          'Bash', // 20%
          'Grep', // 10%
          'Glob', // 10%
          'Write', // 10%
          'Task', // 10%
        ]);

        // Imbalanced usage
        const imbalanced = createToolSession([
          'Read',
          'Read',
          'Read',
          'Read',
          'Read',
          'Read',
          'Read',
          'Read',
          'Edit',
          'Bash',
        ]);

        const resultBalanced = calculateToolMastery([balanced]);
        const resultImbalanced = calculateToolMastery([imbalanced]);

        expect(resultBalanced.overallScore).toBeGreaterThan(resultImbalanced.overallScore);
      });

      it('should calculate score based on advanced usage', () => {
        const basic = createToolSession(['Read', 'Edit', 'Bash', 'Write']);
        const advanced = createToolSession([
          'Read',
          'Edit',
          'Task',
          'TodoWrite',
          'WebSearch',
          'WebFetch',
        ]);

        const resultBasic = calculateToolMastery([basic]);
        const resultAdvanced = calculateToolMastery([advanced]);

        expect(resultAdvanced.overallScore).toBeGreaterThan(resultBasic.overallScore);
      });

      it('should produce score within 0-100 range', () => {
        const sessions = [
          createToolSession(['Read']),
          createToolSession([
            'Read',
            'Edit',
            'Grep',
            'Glob',
            'Bash',
            'Write',
            'Task',
            'TodoWrite',
          ]),
          createToolSession(Array(100).fill('Read')),
        ];

        sessions.forEach((session) => {
          const result = calculateToolMastery([session]);
          expect(result.overallScore).toBeGreaterThanOrEqual(0);
          expect(result.overallScore).toBeLessThanOrEqual(100);
        });
      });
    });

    describe('assessment generation', () => {
      it('should generate appropriate assessments for novice level', () => {
        // Use tools far below expected (ratio < 0.3)
        const tools = Array(100).fill('Read').concat(['Edit']); // Edit is 1/101 ~ 1%
        const session = createToolSession(tools);

        const result = calculateToolMastery([session]);

        expect(result.toolUsage['Edit'].level).toBe('novice');
        expect(result.toolUsage['Edit'].assessment).toContain('Try:');
      });

      it('should generate appropriate assessments for expert level', () => {
        // Use tool well above expected (ratio >= 1.5)
        const tools = Array(50).fill('Edit').concat(['Read', 'Bash']);
        const session = createToolSession(tools);

        const result = calculateToolMastery([session]);

        expect(result.toolUsage['Edit'].level).toBe('expert');
        expect(result.toolUsage['Edit'].assessment).toContain('effectively');
      });

      it('should handle unknown tools gracefully in assessment', () => {
        const session = createToolSession(['UnknownTool', 'UnknownTool', 'Read']);

        const result = calculateToolMastery([session]);

        expect(result.toolUsage['UnknownTool']).toBeDefined();
        expect(result.toolUsage['UnknownTool'].assessment).toBeDefined();
      });
    });

    describe('multiple sessions', () => {
      it('should aggregate tool usage across multiple sessions', () => {
        const session1 = createToolSession(['Read', 'Edit', 'Bash']);
        const session2 = createToolSession(['Read', 'Grep', 'Write']);
        const session3 = createToolSession(['Edit', 'Bash', 'Task']);

        const result = calculateToolMastery([session1, session2, session3]);

        expect(result.toolUsage['Read'].count).toBe(2);
        expect(result.toolUsage['Edit'].count).toBe(2);
        expect(result.toolUsage['Bash'].count).toBe(2);
        expect(result.toolUsage['Grep'].count).toBe(1);
        expect(result.toolUsage['Write'].count).toBe(1);
        expect(result.toolUsage['Task'].count).toBe(1);
      });
    });
  });
});
