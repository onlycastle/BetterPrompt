import { describe, expect, it } from 'vitest';
import { extractPhase1DataFromParsedSessions } from '../../../packages/plugin/lib/core/data-extractor.js';
import type { ParsedSession } from '../../../packages/plugin/lib/core/types.js';

describe('phase1 extraction meta filtering', () => {
  it('ignores tagged and untagged skill-injected user messages when building developer utterances and activity summaries', async () => {
    const session: ParsedSession = {
      sessionId: 'session-meta',
      projectPath: '/tmp/meta-project',
      projectName: 'meta-project',
      startTime: '2026-03-25T01:00:00.000Z',
      endTime: '2026-03-25T01:05:00.000Z',
      durationSeconds: 300,
      claudeCodeVersion: '2.1.81',
      messages: [
        {
          uuid: 'user-real',
          role: 'user',
          timestamp: '2026-03-25T01:00:00.000Z',
          content: 'Review src/app.ts and keep the existing route structure.',
        },
        {
          uuid: 'assistant-1',
          role: 'assistant',
          timestamp: '2026-03-25T01:00:10.000Z',
          content: 'I will inspect the file first.',
          toolCalls: [
            { id: 'tool-1', name: 'Read', input: {} },
          ],
          tokenUsage: { input: 200, output: 80 },
        },
        {
          uuid: 'user-skill-untagged',
          role: 'user',
          timestamp: '2026-03-25T01:00:20.000Z',
          content: 'Base directory for this skill: /tmp/skill\n\n# Skill',
        },
        {
          uuid: 'user-meta',
          role: 'user',
          timestamp: '2026-03-25T01:00:25.000Z',
          content: 'Base directory for this skill: /tmp/skill',
          isMeta: true,
          sourceToolUseID: 'toolu_meta',
        },
        {
          uuid: 'assistant-2',
          role: 'assistant',
          timestamp: '2026-03-25T01:00:35.000Z',
          content: 'Launching skill...',
          tokenUsage: { input: 120, output: 40 },
        },
      ],
      stats: {
        userMessageCount: 3,
        assistantMessageCount: 2,
        toolCallCount: 1,
        uniqueToolsUsed: ['Read'],
        totalInputTokens: 320,
        totalOutputTokens: 120,
      },
      source: 'claude-code',
    };

    const phase1 = await extractPhase1DataFromParsedSessions([session]);

    expect(phase1.developerUtterances).toHaveLength(1);
    expect(phase1.developerUtterances[0]?.text).toContain('Review src/app.ts');
    expect(phase1.sessionMetrics.totalDeveloperUtterances).toBe(1);
    expect(phase1.activitySessions?.[0]?.userMessageCount).toBe(1);
    expect(phase1.activitySessions?.[0]?.firstUserMessage).toContain('Review src/app.ts');
  });

  it('drops task notifications, local-command output, and expanded skill docs while preserving slash-command args', async () => {
    const session: ParsedSession = {
      sessionId: 'session-command',
      projectPath: '/tmp/command-project',
      projectName: 'command-project',
      startTime: '2026-03-30T16:49:30.000Z',
      endTime: '2026-03-30T16:50:10.000Z',
      durationSeconds: 40,
      claudeCodeVersion: '2.1.81',
      messages: [
        {
          uuid: 'user-real',
          role: 'user',
          timestamp: '2026-03-30T16:49:30.000Z',
          content: 'Summarize the implementation plan and the verification steps.',
        },
        {
          uuid: 'assistant-1',
          role: 'assistant',
          timestamp: '2026-03-30T16:49:31.000Z',
          content: 'I will inspect the repo first.',
          tokenUsage: { input: 180, output: 60 },
        },
        {
          uuid: 'user-command',
          role: 'user',
          timestamp: '2026-03-30T16:49:32.000Z',
          content: '<command-message>ralph-loop</command-message>\n<command-name>/ralph-loop</command-name>\n<command-args>구현 시작해줘</command-args>',
        },
        {
          uuid: 'user-expanded-skill',
          role: 'user',
          timestamp: '2026-03-30T16:49:32.000Z',
          content: '# Ralph Loop\n\nContinue working until the task is complete.\n\n## Phase 1\nInspect progress and resume work.\n\n## Phase 2\nVerify results and clean up state.\n\n## Completion\nRun cancellation after verification.\n',
        },
        {
          uuid: 'user-activation-banner',
          role: 'user',
          timestamp: '2026-03-30T16:49:32.000Z',
          content: '[RALPH LOOP ACTIVATED]\n\n구현 시작해줘\n\n## How Ralph Loop Works\n\n1. Work on the task continuously and thoroughly\n2. Output `<promise>DONE</promise>` when complete\n3. Continue until verified.\n',
        },
        {
          uuid: 'user-local-command',
          role: 'user',
          timestamp: '2026-03-30T16:49:33.000Z',
          content: '<local-command-stdout>Installed betterprompt. Run /reload-plugins to apply.</local-command-stdout>',
        },
        {
          uuid: 'user-task-notification',
          role: 'user',
          timestamp: '2026-03-30T16:49:34.000Z',
          content: '<task-notification>\n<task-id>task-123</task-id>\n<status>completed</status>\n<summary>Agent review completed</summary>\n</task-notification>',
        },
        {
          uuid: 'assistant-2',
          role: 'assistant',
          timestamp: '2026-03-30T16:49:35.000Z',
          content: 'Plan captured.',
          tokenUsage: { input: 200, output: 90 },
        },
      ],
      stats: {
        userMessageCount: 6,
        assistantMessageCount: 2,
        toolCallCount: 0,
        uniqueToolsUsed: [],
        totalInputTokens: 380,
        totalOutputTokens: 150,
      },
      source: 'claude-code',
    };

    const phase1 = await extractPhase1DataFromParsedSessions([session]);

    expect(phase1.developerUtterances).toHaveLength(2);
    expect(phase1.developerUtterances[0]?.text).toContain('implementation plan');
    expect(phase1.developerUtterances[1]?.text).toBe('/ralph-loop\n\n구현 시작해줘');
    expect(phase1.developerUtterances.map(utterance => utterance.text)).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('Installed betterprompt'),
        expect.stringContaining('task-id'),
        expect.stringContaining('## Phase 1'),
      ]),
    );
    expect(phase1.sessionMetrics.totalDeveloperUtterances).toBe(2);
    expect(phase1.activitySessions?.[0]?.userMessageCount).toBe(2);
    expect(phase1.activitySessions?.[0]?.firstUserMessage).toContain('implementation plan');
  });
});
