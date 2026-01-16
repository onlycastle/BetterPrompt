/**
 * AI Collaboration Dimension Tests
 *
 * Tests for the AI Collaboration Mastery calculation.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateAICollaboration,
  type AICollaborationResult,
} from '../../../../src/lib/analyzer/dimensions/ai-collaboration.js';
import type { ParsedSession, ParsedMessage } from '../../../../src/lib/models/index.js';

// Helper to create mock sessions
function createMockSession(
  userMessages: string[],
  options: {
    toolCalls?: Array<{ name: string; input?: Record<string, unknown> }>;
    assistantMessages?: string[];
  } = {}
): ParsedSession {
  const messages: ParsedMessage[] = [];
  const now = new Date();
  let toolCallIndex = 0;

  userMessages.forEach((content, index) => {
    messages.push({
      role: 'user',
      content,
      timestamp: new Date(now.getTime() + index * 1000),
      hasToolCalls: false,
    });

    // Add assistant response
    const assistantContent = options.assistantMessages?.[index] || 'Assistant response';
    const toolCallsForMessage = options.toolCalls?.filter(() => toolCallIndex++ === index);

    messages.push({
      role: 'assistant',
      content: assistantContent,
      timestamp: new Date(now.getTime() + index * 1000 + 500),
      hasToolCalls: toolCallsForMessage ? toolCallsForMessage.length > 0 : false,
      toolCalls: toolCallsForMessage?.map((tc) => ({
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

// Helper to create session with specific tool calls in assistant messages
function createSessionWithToolCalls(
  userMessages: string[],
  toolCallsPerMessage: Array<Array<{ name: string; input?: Record<string, unknown> }>>
): ParsedSession {
  const messages: ParsedMessage[] = [];
  const now = new Date();
  const allToolCalls: Array<{ name: string; input?: Record<string, unknown> }> = [];

  userMessages.forEach((content, index) => {
    messages.push({
      role: 'user',
      content,
      timestamp: new Date(now.getTime() + index * 1000),
      hasToolCalls: false,
    });

    const toolCalls = toolCallsPerMessage[index] || [];
    allToolCalls.push(...toolCalls);

    messages.push({
      role: 'assistant',
      content: 'Assistant response',
      timestamp: new Date(now.getTime() + index * 1000 + 500),
      hasToolCalls: toolCalls.length > 0,
      toolCalls: toolCalls.map((tc) => ({
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
      toolCallCount: allToolCalls.length,
      uniqueToolsUsed: [...new Set(allToolCalls.map((tc) => tc.name))],
      totalInputTokens: 100,
      totalOutputTokens: 200,
    },
  };
}

describe('AI Collaboration Dimension', () => {
  describe('calculateAICollaboration', () => {
    it('should return default result for empty sessions', () => {
      const result = calculateAICollaboration([]);

      expect(result.score).toBe(50);
      expect(result.level).toBe('developing');
      expect(result.breakdown.structuredPlanning.score).toBe(50);
      expect(result.breakdown.aiOrchestration.score).toBe(50);
      expect(result.breakdown.criticalVerification.score).toBe(50);
      expect(result.breakdown.structuredPlanning.todoWriteUsage).toBe(0);
      expect(result.breakdown.structuredPlanning.stepByStepPlans).toBe(0);
      expect(result.breakdown.structuredPlanning.specFileReferences).toBe(0);
      expect(result.breakdown.aiOrchestration.taskToolUsage).toBe(0);
      expect(result.breakdown.aiOrchestration.multiAgentSessions).toBe(0);
      expect(result.breakdown.aiOrchestration.parallelWorkflows).toBe(0);
      expect(result.breakdown.criticalVerification.codeReviewRequests).toBe(0);
      expect(result.breakdown.criticalVerification.testRequests).toBe(0);
      expect(result.breakdown.criticalVerification.outputModifications).toBe(0);
      expect(result.strengths).toEqual([]);
      expect(result.growthAreas).toContain('Complete more sessions to get personalized insights');
      expect(result.interpretation).toContain('Not enough data');
    });

    describe('Structured Planning', () => {
      it('should detect TodoWrite tool usage', () => {
        const session = createSessionWithToolCalls(
          ['Create a new feature', 'Implement the component', 'Add tests'],
          [
            [{ name: 'TodoWrite', input: { task: 'Create feature' } }],
            [{ name: 'TodoWrite', input: { task: 'Implement component' } }],
            [{ name: 'TodoWrite', input: { task: 'Add tests' } }],
          ]
        );

        const result = calculateAICollaboration([session]);

        expect(result.breakdown.structuredPlanning.todoWriteUsage).toBe(3);
        expect(result.breakdown.structuredPlanning.score).toBeGreaterThan(0);
      });

      it('should detect step-by-step plans', () => {
        const session = createMockSession([
          'First: set up the database, Second: create the API, Finally: add authentication',
          '1. Install dependencies 2. Configure settings 3. Test the setup',
          'Step 1 is complete, moving to step 2 now',
        ]);

        const result = calculateAICollaboration([session]);

        expect(result.breakdown.structuredPlanning.stepByStepPlans).toBeGreaterThanOrEqual(2);
        expect(result.breakdown.structuredPlanning.score).toBeGreaterThan(0);
      });

      it('should detect spec file references', () => {
        const session = createMockSession([
          'Follow the requirements.md for this feature',
          'Check design.md for the UI specs',
          'See plan.md for the implementation strategy',
        ]);

        const result = calculateAICollaboration([session]);

        expect(result.breakdown.structuredPlanning.specFileReferences).toBeGreaterThanOrEqual(3);
        expect(result.breakdown.structuredPlanning.score).toBeGreaterThan(0);
      });

      it('should calculate high planning score with multiple indicators', () => {
        const session = createSessionWithToolCalls(
          [
            'First: read requirements.md, Second: create plan, Third: implement',
            'Step 1: Set up project, Step 2: Add features',
            'Step 3: Test everything, Step 4: Deploy',
            'Follow the spec.md and design.md',
          ],
          [
            [{ name: 'TodoWrite', input: { task: 'Read requirements' } }],
            [{ name: 'TodoWrite', input: { task: 'Create plan' } }],
            [{ name: 'TodoWrite', input: { task: 'Add features' } }],
            [{ name: 'TodoWrite', input: { task: 'Test' } }],
          ]
        );

        const result = calculateAICollaboration([session]);

        expect(result.breakdown.structuredPlanning.todoWriteUsage).toBe(4);
        expect(result.breakdown.structuredPlanning.stepByStepPlans).toBeGreaterThanOrEqual(3);
        expect(result.breakdown.structuredPlanning.specFileReferences).toBeGreaterThanOrEqual(2);
        expect(result.breakdown.structuredPlanning.score).toBeGreaterThan(40);
      });
    });

    describe('AI Orchestration', () => {
      it('should detect Task tool usage', () => {
        const session = createSessionWithToolCalls(
          ['Search the codebase', 'Analyze this file', 'Review the architecture'],
          [
            [{ name: 'Task', input: { prompt: 'Search codebase' } }],
            [{ name: 'Task', input: { prompt: 'Analyze file' } }],
            [{ name: 'Task', input: { prompt: 'Review architecture' } }],
          ]
        );

        const result = calculateAICollaboration([session]);

        expect(result.breakdown.aiOrchestration.taskToolUsage).toBe(3);
        expect(result.breakdown.aiOrchestration.score).toBeGreaterThan(0);
      });

      it('should detect multi-agent sessions', () => {
        const session = createSessionWithToolCalls(
          ['Use the oracle agent to debug this', 'Have the librarian find docs'],
          [
            [{ name: 'Task', input: { subagent: 'oracle', prompt: 'Debug issue' } }],
            [{ name: 'Task', input: { agent: 'librarian', prompt: 'Find docs' } }],
          ]
        );

        const result = calculateAICollaboration([session]);

        expect(result.breakdown.aiOrchestration.multiAgentSessions).toBeGreaterThanOrEqual(1);
        expect(result.breakdown.aiOrchestration.score).toBeGreaterThan(0);
      });

      it('should detect parallel workflows', () => {
        const session = createSessionWithToolCalls(
          ['Run multiple tasks in parallel'],
          [
            [
              { name: 'Task', input: { prompt: 'Task 1' } },
              { name: 'Task', input: { prompt: 'Task 2' } },
              { name: 'Task', input: { prompt: 'Task 3' } },
            ],
          ]
        );

        const result = calculateAICollaboration([session]);

        expect(result.breakdown.aiOrchestration.parallelWorkflows).toBe(1);
        expect(result.breakdown.aiOrchestration.score).toBeGreaterThan(0);
      });

      it('should calculate high orchestration score with multiple indicators', () => {
        const session = createSessionWithToolCalls(
          [
            'Use Task tool here',
            'Delegate to subagent oracle',
            'Run tasks in parallel',
            'Another Task call',
            'More delegation',
          ],
          [
            [{ name: 'Task', input: { prompt: 'Task 1' } }],
            [{ name: 'Task', input: { subagent: 'oracle', prompt: 'Debug' } }],
            [
              { name: 'Task', input: { prompt: 'Parallel 1' } },
              { name: 'Task', input: { prompt: 'Parallel 2' } },
            ],
            [{ name: 'Task', input: { prompt: 'Task 2' } }],
            [{ name: 'Task', input: { agent: 'librarian', prompt: 'Research' } }],
          ]
        );

        const result = calculateAICollaboration([session]);

        expect(result.breakdown.aiOrchestration.taskToolUsage).toBeGreaterThanOrEqual(5);
        expect(result.breakdown.aiOrchestration.multiAgentSessions).toBeGreaterThanOrEqual(1);
        expect(result.breakdown.aiOrchestration.parallelWorkflows).toBe(1);
        expect(result.breakdown.aiOrchestration.score).toBeGreaterThan(40);
      });
    });

    describe('Critical Verification', () => {
      it('should detect code review requests', () => {
        const session = createMockSession([
          'Please review this code',
          'Can you check if this is correct?',
          'Verify the logic here',
          'Examine this implementation',
        ]);

        const result = calculateAICollaboration([session]);

        expect(result.breakdown.criticalVerification.codeReviewRequests).toBeGreaterThanOrEqual(4);
        expect(result.breakdown.criticalVerification.score).toBeGreaterThan(0);
      });

      it('should detect test requests', () => {
        const session = createMockSession([
          'Run npm test',
          'Execute the unit tests',
          'Run pytest on this module',
          'Test this with jest',
        ]);

        const result = calculateAICollaboration([session]);

        expect(result.breakdown.criticalVerification.testRequests).toBeGreaterThanOrEqual(4);
        expect(result.breakdown.criticalVerification.score).toBeGreaterThan(0);
      });

      it('should detect output modifications', () => {
        const session = createMockSession([
          'Change this to use async/await',
          'Fix the error handling',
          'Update the return type',
          "That's incorrect, modify it",
          "No, that doesn't work, try again",
        ]);

        const result = calculateAICollaboration([session]);

        expect(result.breakdown.criticalVerification.outputModifications).toBeGreaterThanOrEqual(5);
        expect(result.breakdown.criticalVerification.score).toBeGreaterThan(0);
      });

      it('should calculate high verification score with multiple indicators', () => {
        const session = createMockSession([
          'Review this code carefully',
          'Run the test suite',
          'Change this to fix the bug',
          'Verify the implementation',
          'Test this thoroughly',
          'Modify the approach',
        ]);

        const result = calculateAICollaboration([session]);

        expect(result.breakdown.criticalVerification.codeReviewRequests).toBeGreaterThanOrEqual(2);
        expect(result.breakdown.criticalVerification.testRequests).toBeGreaterThanOrEqual(2);
        expect(result.breakdown.criticalVerification.outputModifications).toBeGreaterThanOrEqual(2);
        expect(result.breakdown.criticalVerification.score).toBeGreaterThan(40);
      });
    });

    describe('Multiple Sessions Aggregation', () => {
      it('should aggregate metrics across multiple sessions', () => {
        const session1 = createSessionWithToolCalls(
          ['First: plan, Second: implement'],
          [[{ name: 'TodoWrite', input: { task: 'Plan' } }], []]
        );

        const session2 = createSessionWithToolCalls(
          ['Use Task tool to search'],
          [[{ name: 'Task', input: { prompt: 'Search' } }]]
        );

        const session3 = createMockSession(['Review this code', 'Run tests']);

        const result = calculateAICollaboration([session1, session2, session3]);

        expect(result.breakdown.structuredPlanning.todoWriteUsage).toBe(1);
        expect(result.breakdown.structuredPlanning.stepByStepPlans).toBeGreaterThanOrEqual(1);
        expect(result.breakdown.aiOrchestration.taskToolUsage).toBe(1);
        expect(result.breakdown.criticalVerification.codeReviewRequests).toBeGreaterThanOrEqual(1);
        expect(result.breakdown.criticalVerification.testRequests).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Score Boundary Validation', () => {
      it('should keep scores within 0-100 range', () => {
        // Create sessions with extreme values
        const sessions = Array(20)
          .fill(null)
          .map(() =>
            createSessionWithToolCalls(
              [
                'First: plan, Second: implement, Third: test',
                'Review and test everything',
                'Follow requirements.md',
              ],
              [
                [{ name: 'TodoWrite', input: { task: 'Task 1' } }],
                [{ name: 'Task', input: { subagent: 'oracle', prompt: 'Debug' } }],
                [],
              ]
            )
          );

        const result = calculateAICollaboration(sessions);

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        expect(result.breakdown.structuredPlanning.score).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.structuredPlanning.score).toBeLessThanOrEqual(100);
        expect(result.breakdown.aiOrchestration.score).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.aiOrchestration.score).toBeLessThanOrEqual(100);
        expect(result.breakdown.criticalVerification.score).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.criticalVerification.score).toBeLessThanOrEqual(100);
      });
    });

    describe('Level Threshold Verification', () => {
      it('should classify score < 40 as novice', () => {
        const session = createMockSession(['do something', 'make it work']);

        const result = calculateAICollaboration([session]);

        if (result.score < 40) {
          expect(result.level).toBe('novice');
        }
      });

      it('should classify score 40-59 as developing', () => {
        const session = createMockSession([
          'First: do this',
          'Review the code',
          'make some changes',
        ]);

        const result = calculateAICollaboration([session]);

        if (result.score >= 40 && result.score < 60) {
          expect(result.level).toBe('developing');
        }
      });

      it('should classify score 60-79 as proficient', () => {
        const sessions = Array(3)
          .fill(null)
          .map(() =>
            createSessionWithToolCalls(
              [
                'First: plan, Second: implement',
                'Review this code',
                'Run tests',
                'Follow requirements.md',
              ],
              [
                [{ name: 'TodoWrite', input: { task: 'Plan' } }],
                [{ name: 'Task', input: { prompt: 'Search' } }],
                [],
                [],
              ]
            )
          );

        const result = calculateAICollaboration(sessions);

        if (result.score >= 60 && result.score < 80) {
          expect(result.level).toBe('proficient');
        }
      });

      it('should classify score >= 80 as expert', () => {
        const sessions = Array(5)
          .fill(null)
          .map(() =>
            createSessionWithToolCalls(
              [
                'First: check requirements.md, Second: create plan.md, Third: implement',
                'Review this carefully',
                'Run all tests',
                'Change this to fix the issue',
                'Use Task tool to delegate',
              ],
              [
                [{ name: 'TodoWrite', input: { task: 'Check requirements' } }],
                [{ name: 'TodoWrite', input: { task: 'Create plan' } }],
                [
                  { name: 'Task', input: { subagent: 'oracle', prompt: 'Debug' } },
                  { name: 'Task', input: { subagent: 'librarian', prompt: 'Research' } },
                ],
                [],
                [{ name: 'Task', input: { prompt: 'Delegate task' } }],
              ]
            )
          );

        const result = calculateAICollaboration(sessions);

        if (result.score >= 80) {
          expect(result.level).toBe('expert');
        }
      });
    });

    describe('Strengths Array Generation', () => {
      it('should identify planning strength for high planning scores', () => {
        const sessions = Array(3)
          .fill(null)
          .map(() =>
            createSessionWithToolCalls(
              [
                'First: plan, Second: implement, Third: test',
                'Follow requirements.md',
                'Check design.md',
              ],
              [
                [{ name: 'TodoWrite', input: { task: 'Plan' } }],
                [{ name: 'TodoWrite', input: { task: 'Implement' } }],
                [{ name: 'TodoWrite', input: { task: 'Test' } }],
              ]
            )
          );

        const result = calculateAICollaboration(sessions);

        if (result.breakdown.structuredPlanning.score >= 70) {
          expect(result.strengths.some((s) => s.includes('structured planning'))).toBe(true);
        }
      });

      it('should identify orchestration strength for high orchestration scores', () => {
        const sessions = Array(3)
          .fill(null)
          .map(() =>
            createSessionWithToolCalls(
              ['Use Task tool', 'Delegate to subagent', 'Run parallel tasks'],
              [
                [{ name: 'Task', input: { prompt: 'Task 1' } }],
                [{ name: 'Task', input: { subagent: 'oracle', prompt: 'Debug' } }],
                [
                  { name: 'Task', input: { prompt: 'Parallel 1' } },
                  { name: 'Task', input: { prompt: 'Parallel 2' } },
                ],
              ]
            )
          );

        const result = calculateAICollaboration(sessions);

        if (result.breakdown.aiOrchestration.score >= 70) {
          expect(result.strengths.some((s) => s.includes('orchestration'))).toBe(true);
        }
      });

      it('should identify verification strength for high verification scores', () => {
        const sessions = Array(3)
          .fill(null)
          .map(() =>
            createMockSession([
              'Review this code',
              'Run tests',
              'Change this to fix it',
              'Verify the implementation',
              'Test again',
            ])
          );

        const result = calculateAICollaboration(sessions);

        if (result.breakdown.criticalVerification.score >= 70) {
          expect(result.strengths.some((s) => s.includes('verification'))).toBe(true);
        }
      });

      it('should limit strengths to 4 items', () => {
        const sessions = Array(10)
          .fill(null)
          .map(() =>
            createSessionWithToolCalls(
              [
                'First: plan, Second: implement',
                'Review code',
                'Run tests',
                'Follow requirements.md',
              ],
              [
                [{ name: 'TodoWrite', input: { task: 'Plan' } }],
                [
                  { name: 'Task', input: { subagent: 'oracle', prompt: 'Debug' } },
                  { name: 'Task', input: { prompt: 'Task 2' } },
                ],
                [],
                [],
              ]
            )
          );

        const result = calculateAICollaboration(sessions);

        expect(result.strengths.length).toBeLessThanOrEqual(4);
      });
    });

    describe('Growth Areas Array Generation', () => {
      it('should suggest planning improvements for low planning scores', () => {
        const session = createMockSession(['do something', 'make it work', 'fix it']);

        const result = calculateAICollaboration([session]);

        if (result.breakdown.structuredPlanning.score < 40) {
          expect(
            result.growthAreas.some((ga) => ga.includes('step-by-step') || ga.includes('TodoWrite'))
          ).toBe(true);
        }
      });

      it('should suggest orchestration improvements for low orchestration scores', () => {
        const session = createMockSession(['implement feature', 'add tests', 'deploy']);

        const result = calculateAICollaboration([session]);

        if (result.breakdown.aiOrchestration.score < 40) {
          expect(result.growthAreas.some((ga) => ga.includes('Task tool'))).toBe(true);
        }
      });

      it('should suggest verification improvements for low verification scores', () => {
        const session = createMockSession(['build this', 'create that', 'add feature']);

        const result = calculateAICollaboration([session]);

        if (result.breakdown.criticalVerification.score < 40) {
          expect(
            result.growthAreas.some((ga) => ga.includes('review') || ga.includes('test'))
          ).toBe(true);
        }
      });

      it('should suggest spec files when none are referenced', () => {
        const session = createMockSession(['implement feature', 'add component', 'create page']);

        const result = calculateAICollaboration([session]);

        expect(result.growthAreas.some((ga) => ga.includes('spec files'))).toBe(true);
      });

      it('should suggest Task tool when not used with sufficient messages', () => {
        const session = createMockSession([
          'implement this',
          'add that',
          'create something',
          'build feature',
          'add tests',
          'deploy code',
        ]);

        const result = calculateAICollaboration([session]);

        expect(result.growthAreas.some((ga) => ga.includes('Task tool'))).toBe(true);
      });

      it('should limit growth areas to 4 items', () => {
        const session = createMockSession(['do something', 'make it work']);

        const result = calculateAICollaboration([session]);

        expect(result.growthAreas.length).toBeLessThanOrEqual(4);
      });
    });

    describe('Interpretation String Generation', () => {
      it('should provide expert interpretation for scores >= 80', () => {
        const sessions = Array(5)
          .fill(null)
          .map(() =>
            createSessionWithToolCalls(
              [
                'First: read requirements.md, Second: plan',
                'Review code',
                'Run tests',
                'Fix issues',
              ],
              [
                [{ name: 'TodoWrite', input: { task: 'Read requirements' } }],
                [
                  { name: 'Task', input: { subagent: 'oracle', prompt: 'Debug' } },
                  { name: 'Task', input: { prompt: 'Task 2' } },
                ],
                [],
                [],
              ]
            )
          );

        const result = calculateAICollaboration(sessions);

        if (result.score >= 80) {
          expect(result.interpretation).toContain('Expert-level');
          expect(result.interpretation).toContain('force multiplier');
        }
      });

      it('should provide proficient interpretation for scores 60-79', () => {
        const sessions = Array(3)
          .fill(null)
          .map(() =>
            createSessionWithToolCalls(
              ['First: plan', 'Review code', 'Run tests'],
              [[{ name: 'TodoWrite', input: { task: 'Plan' } }], [], []]
            )
          );

        const result = calculateAICollaboration(sessions);

        if (result.score >= 60 && result.score < 80) {
          expect(result.interpretation).toContain('Proficient');
        }
      });

      it('should provide developing interpretation for scores 40-59', () => {
        const session = createMockSession([
          'First: do this',
          'Review code',
          'make changes',
          'test it',
        ]);

        const result = calculateAICollaboration([session]);

        if (result.score >= 40 && result.score < 60) {
          expect(result.interpretation).toContain('Developing');
        }
      });

      it('should provide novice interpretation for scores < 40', () => {
        const session = createMockSession(['do something', 'fix it', 'make it work']);

        const result = calculateAICollaboration([session]);

        if (result.score < 40) {
          expect(result.interpretation).toContain('Room for growth');
        }
      });

      it('should always return a non-empty interpretation', () => {
        const session = createMockSession(['test message']);

        const result = calculateAICollaboration([session]);

        expect(result.interpretation).toBeTruthy();
        expect(result.interpretation.length).toBeGreaterThan(0);
      });
    });
  });
});
