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
});
