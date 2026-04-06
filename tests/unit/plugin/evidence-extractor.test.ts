/**
 * Tests for the Session Evidence Extractor
 *
 * Verifies that buildEvidenceContexts extracts concrete metrics, tool call
 * sequences, timestamps, and session state from ParsedSession data — supplying
 * the evidence layer needed to populate Evidence field moments in PEA growth areas.
 */

import { describe, expect, it } from 'vitest';
import {
  buildEvidenceContexts,
  buildEvidenceContextIndex,
  extractToolCallDetail,
  formatToolSequence,
} from '../../../packages/plugin/lib/core/evidence-extractor.js';
import { extractPhase1DataFromParsedSessions } from '../../../packages/plugin/lib/core/data-extractor.js';
import type { ParsedSession } from '../../../packages/plugin/lib/core/types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const SESSION_START = '2026-03-25T10:00:00.000Z';
const SESSION_END   = '2026-03-25T10:30:00.000Z';

function makeSession(overrides: Partial<ParsedSession> & {
  messages: ParsedSession['messages'];
}): ParsedSession {
  return {
    sessionId: 'test-session-1',
    projectPath: '/Users/dev/my-project',
    projectName: 'my-project',
    startTime: SESSION_START,
    endTime: SESSION_END,
    durationSeconds: 1800,
    claudeCodeVersion: '2.1.0',
    stats: {
      userMessageCount: 1,
      assistantMessageCount: 1,
      toolCallCount: 0,
      uniqueToolsUsed: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
    },
    source: 'claude-code',
    ...overrides,
  };
}

// ============================================================================
// extractToolCallDetail
// ============================================================================

describe('extractToolCallDetail', () => {
  it('returns file_path for Read', () => {
    expect(extractToolCallDetail('Read', { file_path: 'src/lib/auth.ts' }))
      .toBe('src/lib/auth.ts');
  });

  it('returns file_path for Edit', () => {
    expect(extractToolCallDetail('Edit', { file_path: 'middleware/stripe.ts' }))
      .toBe('middleware/stripe.ts');
  });

  it('returns file_path for Write', () => {
    expect(extractToolCallDetail('Write', { file_path: 'dist/output.js' }))
      .toBe('dist/output.js');
  });

  it('returns pattern + path for Grep', () => {
    expect(extractToolCallDetail('Grep', { pattern: 'isAuthenticated', path: 'src/' }))
      .toBe('isAuthenticated in src/');
  });

  it('returns pattern only for Grep when no path', () => {
    expect(extractToolCallDetail('Grep', { pattern: 'TODO' }))
      .toBe('TODO');
  });

  it('returns pattern + path for Glob', () => {
    expect(extractToolCallDetail('Glob', { pattern: '**/*.test.ts', path: 'tests/' }))
      .toBe('**/*.test.ts in tests/');
  });

  it('returns Bash command (truncated to 120 chars)', () => {
    const longCommand = 'npm run test -- --coverage --reporter=verbose'.padEnd(200, ' -x');
    const result = extractToolCallDetail('Bash', { command: longCommand });
    expect(result).toBeDefined();
    expect(result!.length).toBeLessThanOrEqual(120);
    expect(result!).toContain('npm run test');
  });

  it('returns Task description', () => {
    expect(extractToolCallDetail('Task', { description: 'Analyze auth middleware' }))
      .toBe('Analyze auth middleware');
  });

  it('returns Agent prompt (truncated to 80 chars)', () => {
    const longPrompt = 'Search for all authentication-related patterns across the codebase to find vulnerabilities';
    const result = extractToolCallDetail('Agent', { prompt: longPrompt });
    expect(result).toBeDefined();
    expect(result!.length).toBeLessThanOrEqual(80);
  });

  it('returns URL for WebFetch', () => {
    expect(extractToolCallDetail('WebFetch', { url: 'https://api.example.com/docs' }))
      .toBe('https://api.example.com/docs');
  });

  it('returns undefined for unknown tools', () => {
    expect(extractToolCallDetail('UnknownTool', { foo: 'bar' })).toBeUndefined();
  });

  it('returns undefined when file_path is missing for Read', () => {
    expect(extractToolCallDetail('Read', {})).toBeUndefined();
  });

  it('returns undefined when Grep pattern is missing', () => {
    expect(extractToolCallDetail('Grep', { path: 'src/' })).toBeUndefined();
  });
});

// ============================================================================
// formatToolSequence
// ============================================================================

describe('formatToolSequence', () => {
  it('returns empty string for empty sequence', () => {
    expect(formatToolSequence([])).toBe('');
  });

  it('formats single tool call', () => {
    const result = formatToolSequence([{ name: 'Read', detail: 'src/auth.ts' }]);
    expect(result).toBe('after Read(src/auth.ts)');
  });

  it('formats multiple tool calls with "then"', () => {
    const result = formatToolSequence([
      { name: 'Read', detail: 'src/auth.ts' },
      { name: 'Bash', detail: 'npm test' },
    ]);
    expect(result).toBe('after Read(src/auth.ts) then Bash(npm test)');
  });

  it('marks error tool calls with ✗', () => {
    const result = formatToolSequence([
      { name: 'Bash', detail: 'npm test', isError: true },
    ]);
    expect(result).toContain('✗');
    expect(result).toContain('Bash(npm test)');
  });

  it('includes error count suffix when errors present', () => {
    const result = formatToolSequence([
      { name: 'Read', detail: 'file.ts' },
      { name: 'Bash', detail: 'npm test', isError: true },
    ]);
    expect(result).toContain('[1 error]');
  });

  it('handles tools without detail', () => {
    const result = formatToolSequence([{ name: 'Glob' }]);
    expect(result).toBe('after Glob');
  });

  it('respects maxTools limit and adds +N more suffix', () => {
    const tools = Array.from({ length: 6 }, (_, i) => ({
      name: 'Read',
      detail: `file${i}.ts`,
    }));
    const result = formatToolSequence(tools, 4);
    expect(result).toContain('+2 more');
  });
});

// ============================================================================
// buildEvidenceContexts — basic extraction
// ============================================================================

describe('buildEvidenceContexts', () => {
  it('returns empty array for empty sessions', () => {
    expect(buildEvidenceContexts([])).toEqual([]);
  });

  it('extracts one evidence context per analyzable user utterance', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Write tests for the auth middleware.',
        },
        {
          uuid: 'assistant-1',
          role: 'assistant',
          timestamp: '2026-03-25T10:01:00.000Z',
          content: 'I will write the tests.',
        },
        {
          uuid: 'user-2',
          role: 'user',
          timestamp: '2026-03-25T10:02:00.000Z',
          content: 'Also add error handling.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts).toHaveLength(2);
  });

  it('generates correct utteranceId matching data-extractor format', () => {
    const session = makeSession({
      sessionId: 'sess-abc',
      messages: [
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Fix the bug.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    // message index 0, sessionId 'sess-abc'
    expect(contexts[0]?.utteranceId).toBe('sess-abc_0');
  });

  it('preserves ISO timestamp from session JSONL', () => {
    const ts = '2026-03-25T10:05:30.000Z';
    const session = makeSession({
      messages: [
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: ts,
          content: 'Run the tests.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts[0]?.timestamp).toBe(ts);
  });

  it('assigns correct sessionId', () => {
    const session = makeSession({
      sessionId: 'my-unique-session',
      messages: [
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Implement the feature.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts[0]?.sessionId).toBe('my-unique-session');
  });
});

// ============================================================================
// buildEvidenceContexts — preceding tool sequence
// ============================================================================

describe('buildEvidenceContexts — preceding tool sequence', () => {
  it('includes preceding assistant tool calls in precedingToolSequence', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'assistant-0',
          role: 'assistant',
          timestamp: '2026-03-25T09:59:00.000Z',
          content: 'Reading the auth file.',
          toolCalls: [
            {
              id: 'tc-1',
              name: 'Read',
              input: { file_path: 'src/auth/middleware.ts' },
            },
          ],
        },
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Add error handling to that file.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts[0]?.precedingToolSequence).toHaveLength(1);
    expect(contexts[0]?.precedingToolSequence[0]).toMatchObject({
      name: 'Read',
      detail: 'src/auth/middleware.ts',
    });
  });

  it('captures multi-step tool sequence from preceding assistant response', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'assistant-0',
          role: 'assistant',
          timestamp: '2026-03-25T09:59:00.000Z',
          content: 'Let me check then run tests.',
          toolCalls: [
            { id: 'tc-1', name: 'Read',  input: { file_path: 'src/auth.ts' } },
            { id: 'tc-2', name: 'Bash',  input: { command: 'npm test' } },
            { id: 'tc-3', name: 'Write', input: { file_path: 'src/auth.test.ts' } },
          ],
        },
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Looks good. Now fix the failing case.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    const seq = contexts[0]?.precedingToolSequence ?? [];
    expect(seq).toHaveLength(3);
    expect(seq[0]).toMatchObject({ name: 'Read',  detail: 'src/auth.ts' });
    expect(seq[1]).toMatchObject({ name: 'Bash',  detail: 'npm test' });
    expect(seq[2]).toMatchObject({ name: 'Write', detail: 'src/auth.test.ts' });
  });

  it('marks error tool calls with isError: true', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'assistant-0',
          role: 'assistant',
          timestamp: '2026-03-25T09:59:00.000Z',
          content: 'Running tests.',
          toolCalls: [
            {
              id: 'tc-1',
              name: 'Bash',
              input: { command: 'npm test' },
              isError: true,
              result: 'Error: 3 tests failed in auth.test.ts',
            },
          ],
        },
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Why is it failing?',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    const toolEvidence = contexts[0]?.precedingToolSequence[0];
    expect(toolEvidence?.isError).toBe(true);
  });

  it('includes errorText (truncated to 200 chars) for failed tool calls', () => {
    const errorMessage = 'Error: auth.test.ts: 3 tests failed\n  - should authenticate user\n  - should reject invalid token\n  - should handle expired session';
    const session = makeSession({
      messages: [
        {
          uuid: 'assistant-0',
          role: 'assistant',
          timestamp: '2026-03-25T09:59:00.000Z',
          content: 'Running tests.',
          toolCalls: [
            {
              id: 'tc-1',
              name: 'Bash',
              input: { command: 'npm test' },
              isError: true,
              result: errorMessage,
            },
          ],
        },
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Fix the failures.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    const toolEvidence = contexts[0]?.precedingToolSequence[0];
    expect(toolEvidence?.errorText).toBeDefined();
    expect(toolEvidence!.errorText!.length).toBeLessThanOrEqual(200);
    expect(toolEvidence!.errorText).toContain('auth.test.ts');
  });

  it('does NOT include errorText for successful tool calls', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'assistant-0',
          role: 'assistant',
          timestamp: '2026-03-25T09:59:00.000Z',
          content: 'Reading auth.ts.',
          toolCalls: [
            {
              id: 'tc-1',
              name: 'Read',
              input: { file_path: 'src/auth.ts' },
              isError: false,
              result: 'export function authenticate() {}',
            },
          ],
        },
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Add a JWT check.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts[0]?.precedingToolSequence[0]?.errorText).toBeUndefined();
  });

  it('returns empty precedingToolSequence for first user message (no preceding assistant)', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Start fresh — implement the auth system.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts[0]?.precedingToolSequence).toEqual([]);
  });

  it('uses the MOST RECENT assistant before each user turn', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'assistant-first',
          role: 'assistant',
          timestamp: '2026-03-25T09:58:00.000Z',
          content: 'First response.',
          toolCalls: [
            { id: 'tc-old', name: 'Read', input: { file_path: 'old.ts' } },
          ],
        },
        {
          uuid: 'assistant-recent',
          role: 'assistant',
          timestamp: '2026-03-25T09:59:00.000Z',
          content: 'Second response.',
          toolCalls: [
            { id: 'tc-new', name: 'Edit', input: { file_path: 'new.ts' } },
          ],
        },
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Looks good.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    // Should use the LAST assistant (the second one with Edit(new.ts))
    const seq = contexts[0]?.precedingToolSequence ?? [];
    expect(seq).toHaveLength(1);
    expect(seq[0]).toMatchObject({ name: 'Edit', detail: 'new.ts' });
  });
});

// ============================================================================
// buildEvidenceContexts — context fill percent
// ============================================================================

describe('buildEvidenceContexts — context fill percent', () => {
  it('computes contextFillPercent from preceding assistant token usage', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'assistant-0',
          role: 'assistant',
          timestamp: '2026-03-25T09:59:00.000Z',
          content: 'Working...',
          tokenUsage: { input: 100_000, output: 500 }, // 50% of 200k
        },
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Continue.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts[0]?.contextFillPercent).toBeCloseTo(50, 1);
  });

  it('caps contextFillPercent at 100 even if tokens exceed context window', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'assistant-0',
          role: 'assistant',
          timestamp: '2026-03-25T09:59:00.000Z',
          content: 'Working...',
          tokenUsage: { input: 220_000, output: 500 }, // over 200k
        },
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Continue.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts[0]?.contextFillPercent).toBe(100);
  });

  it('contextFillPercent is absent when preceding assistant has no token usage', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'assistant-0',
          role: 'assistant',
          timestamp: '2026-03-25T09:59:00.000Z',
          content: 'Working...', // no tokenUsage
        },
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Continue.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts[0]?.contextFillPercent).toBeUndefined();
  });

  it('contextFillPercent is absent for first user message with no preceding assistant', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Start a new task.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts[0]?.contextFillPercent).toBeUndefined();
  });
});

// ============================================================================
// buildEvidenceContexts — cumulative error count
// ============================================================================

describe('buildEvidenceContexts — cumulative error count', () => {
  it('starts at 0 for the first user message (no errors yet)', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'First task.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts[0]?.cumulativeErrorCount).toBe(0);
  });

  it('accumulates errors from preceding assistant responses', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'assistant-0',
          role: 'assistant',
          timestamp: '2026-03-25T09:59:00.000Z',
          content: 'Two calls, two errors.',
          toolCalls: [
            { id: 'tc-1', name: 'Bash', input: { command: 'npm test' }, isError: true, result: 'Error' },
            { id: 'tc-2', name: 'Read', input: { file_path: 'x.ts' }, isError: true, result: 'Not found' },
          ],
        },
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Why are there errors?',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts[0]?.cumulativeErrorCount).toBe(2);
  });

  it('accumulates errors across multiple assistant turns', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'assistant-0',
          role: 'assistant',
          timestamp: '2026-03-25T09:58:00.000Z',
          content: 'First attempt.',
          toolCalls: [
            { id: 'tc-1', name: 'Bash', input: { command: 'tsc' }, isError: true, result: 'Type error' },
          ],
        },
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T09:59:00.000Z',
          content: 'Fix it.',
        },
        {
          uuid: 'assistant-1',
          role: 'assistant',
          timestamp: '2026-03-25T09:59:30.000Z',
          content: 'Trying again.',
          toolCalls: [
            { id: 'tc-2', name: 'Bash', input: { command: 'tsc' }, isError: true, result: 'Still failing' },
            { id: 'tc-3', name: 'Read', input: { file_path: 'tsconfig.json' } },
          ],
        },
        {
          uuid: 'user-2',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Still broken?',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    // user-1: 1 error so far (from assistant-0)
    expect(contexts[0]?.cumulativeErrorCount).toBe(1);
    // user-2: 2 errors so far (from assistant-0 + assistant-1)
    expect(contexts[1]?.cumulativeErrorCount).toBe(2);
  });

  it('does not count successful tool calls as errors', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'assistant-0',
          role: 'assistant',
          timestamp: '2026-03-25T09:59:00.000Z',
          content: 'All good.',
          toolCalls: [
            { id: 'tc-1', name: 'Read',  input: { file_path: 'src/auth.ts' }, isError: false },
            { id: 'tc-2', name: 'Bash',  input: { command: 'npm test' },       isError: false },
            { id: 'tc-3', name: 'Write', input: { file_path: 'out.ts' },       isError: undefined }, // no isError
          ],
        },
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Continue.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts[0]?.cumulativeErrorCount).toBe(0);
  });
});

// ============================================================================
// buildEvidenceContexts — session turn number
// ============================================================================

describe('buildEvidenceContexts — session turn number', () => {
  it('assigns 1-indexed turn numbers to user turns', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'First task.',
        },
        {
          uuid: 'assistant-1',
          role: 'assistant',
          timestamp: '2026-03-25T10:01:00.000Z',
          content: 'Done.',
        },
        {
          uuid: 'user-2',
          role: 'user',
          timestamp: '2026-03-25T10:02:00.000Z',
          content: 'Second task.',
        },
        {
          uuid: 'assistant-2',
          role: 'assistant',
          timestamp: '2026-03-25T10:03:00.000Z',
          content: 'Also done.',
        },
        {
          uuid: 'user-3',
          role: 'user',
          timestamp: '2026-03-25T10:04:00.000Z',
          content: 'Third task.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts).toHaveLength(3);
    expect(contexts[0]?.sessionTurnNumber).toBe(1);
    expect(contexts[1]?.sessionTurnNumber).toBe(2);
    expect(contexts[2]?.sessionTurnNumber).toBe(3);
  });

  it('resets turn count for each session', () => {
    const session1 = makeSession({
      sessionId: 'sess-1',
      messages: [
        { uuid: 'u1', role: 'user', timestamp: '2026-03-25T10:00:00.000Z', content: 'A' },
        { uuid: 'a1', role: 'assistant', timestamp: '2026-03-25T10:01:00.000Z', content: 'B' },
        { uuid: 'u2', role: 'user', timestamp: '2026-03-25T10:02:00.000Z', content: 'C' },
      ],
    });
    const session2 = makeSession({
      sessionId: 'sess-2',
      messages: [
        { uuid: 'u1', role: 'user', timestamp: '2026-03-26T10:00:00.000Z', content: 'D' },
      ],
    });

    const contexts = buildEvidenceContexts([session1, session2]);
    // Session 1: turns 1, 2
    const sess1Contexts = contexts.filter(c => c.sessionId === 'sess-1');
    expect(sess1Contexts[0]?.sessionTurnNumber).toBe(1);
    expect(sess1Contexts[1]?.sessionTurnNumber).toBe(2);
    // Session 2: turn 1 (resets)
    const sess2Contexts = contexts.filter(c => c.sessionId === 'sess-2');
    expect(sess2Contexts[0]?.sessionTurnNumber).toBe(1);
  });
});

// ============================================================================
// buildEvidenceContexts — session duration at turn
// ============================================================================

describe('buildEvidenceContexts — session duration at turn', () => {
  it('computes elapsed seconds from session start', () => {
    const session = makeSession({
      startTime: '2026-03-25T10:00:00.000Z',
      messages: [
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:05:30.000Z', // 330 seconds after start
          content: 'Now.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts[0]?.sessionDurationAtTurnSec).toBe(330);
  });

  it('returns 0 for messages at session start', () => {
    const session = makeSession({
      startTime: '2026-03-25T10:00:00.000Z',
      messages: [
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z', // same as start
          content: 'First!',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts[0]?.sessionDurationAtTurnSec).toBe(0);
  });

  it('sessionDurationAtTurnSec increases for later turns', () => {
    const session = makeSession({
      startTime: '2026-03-25T10:00:00.000Z',
      messages: [
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:01:00.000Z', // 60s
          content: 'Turn 1.',
        },
        {
          uuid: 'assistant-1',
          role: 'assistant',
          timestamp: '2026-03-25T10:02:00.000Z',
          content: 'Response.',
        },
        {
          uuid: 'user-2',
          role: 'user',
          timestamp: '2026-03-25T10:15:00.000Z', // 900s
          content: 'Turn 2.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts[0]?.sessionDurationAtTurnSec).toBe(60);
    expect(contexts[1]?.sessionDurationAtTurnSec).toBe(900);
  });
});

// ============================================================================
// buildEvidenceContexts — meta message filtering
// ============================================================================

describe('buildEvidenceContexts — meta message filtering', () => {
  it('skips messages with isMeta: true', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'user-meta',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Meta content.',
          isMeta: true,
        },
        {
          uuid: 'user-real',
          role: 'user',
          timestamp: '2026-03-25T10:00:05.000Z',
          content: 'Real user message.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.utteranceId).toBe('test-session-1_1'); // index 1 (not 0)
  });

  it('skips messages with sourceToolUseID set (tool result messages)', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'user-tool-result',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Tool result content.',
          sourceToolUseID: 'toolu_abc123',
        },
        {
          uuid: 'user-real',
          role: 'user',
          timestamp: '2026-03-25T10:00:05.000Z',
          content: 'Real user message.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.utteranceId).toBe('test-session-1_1');
  });

  it('skips skill injection messages', () => {
    const session = makeSession({
      messages: [
        {
          uuid: 'user-skill',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Base directory for this skill: /path/to/skill\n\n# Skill content here.',
        },
        {
          uuid: 'user-real',
          role: 'user',
          timestamp: '2026-03-25T10:00:05.000Z',
          content: 'Implement feature X.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.utteranceId).toBe('test-session-1_1');
  });
});

// ============================================================================
// buildEvidenceContexts — multi-session
// ============================================================================

describe('buildEvidenceContexts — multi-session', () => {
  it('processes multiple sessions and maintains session isolation', () => {
    const session1 = makeSession({
      sessionId: 'session-A',
      messages: [
        { uuid: 'u1', role: 'user', timestamp: '2026-03-25T10:00:00.000Z', content: 'A1' },
        { uuid: 'u2', role: 'user', timestamp: '2026-03-25T10:01:00.000Z', content: 'A2' },
      ],
    });
    const session2 = makeSession({
      sessionId: 'session-B',
      messages: [
        { uuid: 'u1', role: 'user', timestamp: '2026-03-26T10:00:00.000Z', content: 'B1' },
      ],
    });

    const contexts = buildEvidenceContexts([session1, session2]);
    expect(contexts).toHaveLength(3);

    const aSessions = contexts.filter(c => c.sessionId === 'session-A');
    const bSessions = contexts.filter(c => c.sessionId === 'session-B');
    expect(aSessions).toHaveLength(2);
    expect(bSessions).toHaveLength(1);
  });

  it('cumulative error count does NOT bleed across sessions', () => {
    const session1 = makeSession({
      sessionId: 'session-1',
      messages: [
        {
          uuid: 'assistant-0',
          role: 'assistant',
          timestamp: '2026-03-25T09:59:00.000Z',
          content: 'Error.',
          toolCalls: [
            { id: 'tc-1', name: 'Bash', input: { command: 'test' }, isError: true, result: 'fail' },
          ],
        },
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Why?',
        },
      ],
    });
    const session2 = makeSession({
      sessionId: 'session-2',
      startTime: '2026-03-26T10:00:00.000Z',
      messages: [
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-26T10:00:00.000Z',
          content: 'Fresh start.',
        },
      ],
    });

    const contexts = buildEvidenceContexts([session1, session2]);
    const s1Context = contexts.find(c => c.sessionId === 'session-1');
    const s2Context = contexts.find(c => c.sessionId === 'session-2');
    expect(s1Context?.cumulativeErrorCount).toBe(1);
    expect(s2Context?.cumulativeErrorCount).toBe(0); // clean slate
  });
});

// ============================================================================
// buildEvidenceContextIndex
// ============================================================================

describe('buildEvidenceContextIndex', () => {
  it('creates a Map keyed by utteranceId', () => {
    const session = makeSession({
      sessionId: 'test-session-1',
      messages: [
        { uuid: 'u1', role: 'user', timestamp: '2026-03-25T10:00:00.000Z', content: 'Message 1' },
        { uuid: 'a1', role: 'assistant', timestamp: '2026-03-25T10:01:00.000Z', content: 'Response' },
        { uuid: 'u2', role: 'user', timestamp: '2026-03-25T10:02:00.000Z', content: 'Message 2' },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    const index = buildEvidenceContextIndex(contexts);

    expect(index).toBeInstanceOf(Map);
    expect(index.has('test-session-1_0')).toBe(true);
    expect(index.has('test-session-1_2')).toBe(true);
  });

  it('enables O(1) lookup by utteranceId', () => {
    const session = makeSession({
      sessionId: 'lookup-test',
      messages: [
        { uuid: 'u1', role: 'user', timestamp: '2026-03-25T10:00:00.000Z', content: 'Target message' },
      ],
    });

    const contexts = buildEvidenceContexts([session]);
    const index = buildEvidenceContextIndex(contexts);

    const ctx = index.get('lookup-test_0');
    expect(ctx).toBeDefined();
    expect(ctx?.sessionId).toBe('lookup-test');
  });

  it('returns empty Map for empty contexts array', () => {
    const index = buildEvidenceContextIndex([]);
    expect(index.size).toBe(0);
  });
});

// ============================================================================
// Integration: evidence contexts appear in Phase 1 output
// ============================================================================

describe('Phase 1 integration — evidenceContexts in output', () => {
  it('extractPhase1DataFromParsedSessions includes evidenceContexts', async () => {
    const session = makeSession({
      sessionId: 'phase1-test',
      startTime: '2026-03-25T10:00:00.000Z', // explicit session start
      messages: [
        {
          uuid: 'assistant-0',
          role: 'assistant',
          timestamp: '2026-03-25T10:00:00.000Z', // at session start
          content: 'Reading auth file.',
          toolCalls: [
            { id: 'tc-1', name: 'Read', input: { file_path: 'src/auth.ts' } },
          ],
          tokenUsage: { input: 80_000, output: 400 },
        },
        {
          uuid: 'user-1',
          role: 'user',
          timestamp: '2026-03-25T10:01:00.000Z', // 60 seconds after session start
          content: 'Add JWT verification to auth.ts.',
        },
      ],
    });

    const phase1 = await extractPhase1DataFromParsedSessions([session]);

    expect(phase1.evidenceContexts).toBeDefined();
    expect(Array.isArray(phase1.evidenceContexts)).toBe(true);
    expect(phase1.evidenceContexts).toHaveLength(1);

    const ctx = phase1.evidenceContexts![0]!;
    expect(ctx.utteranceId).toBe('phase1-test_1');
    expect(ctx.sessionId).toBe('phase1-test');
    expect(ctx.timestamp).toBe('2026-03-25T10:01:00.000Z');
    expect(ctx.precedingToolSequence).toHaveLength(1);
    expect(ctx.precedingToolSequence[0]).toMatchObject({
      name: 'Read',
      detail: 'src/auth.ts',
    });
    expect(ctx.contextFillPercent).toBeCloseTo(40, 0); // 80k/200k = 40%
    expect(ctx.cumulativeErrorCount).toBe(0);
    expect(ctx.sessionTurnNumber).toBe(1);
    expect(ctx.sessionDurationAtTurnSec).toBe(60); // 60 seconds after start
  });

  it('evidenceContexts utteranceIds match developerUtterances ids', async () => {
    const session = makeSession({
      sessionId: 'id-parity',
      messages: [
        {
          uuid: 'u1',
          role: 'user',
          timestamp: '2026-03-25T10:00:00.000Z',
          content: 'Task 1.',
        },
        {
          uuid: 'a1',
          role: 'assistant',
          timestamp: '2026-03-25T10:01:00.000Z',
          content: 'Done.',
        },
        {
          uuid: 'u2',
          role: 'user',
          timestamp: '2026-03-25T10:02:00.000Z',
          content: 'Task 2.',
        },
      ],
    });

    const phase1 = await extractPhase1DataFromParsedSessions([session]);

    const utteranceIds = new Set(phase1.developerUtterances.map(u => u.id));
    const evidenceIds = new Set((phase1.evidenceContexts ?? []).map(c => c.utteranceId));

    // Every evidence context utteranceId must match a developer utterance
    for (const eid of evidenceIds) {
      expect(utteranceIds.has(eid)).toBe(true);
    }
  });
});
