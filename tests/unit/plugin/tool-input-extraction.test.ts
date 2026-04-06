/**
 * Tool Input Extraction Tests — AC 4: Each growth area names specific tools,
 * files, or APIs the builder interacted with.
 *
 * Validates:
 * 1. extractToolCallDetail() extracts file paths, commands, and patterns
 *    from tool call inputs for concrete toolsFilesApis population.
 * 2. Growth areas built from extracted data name specific files and tools
 *    (not just generic tool type names) and pass the tool_file_naming rubric.
 * 3. formatToolSequence() produces human-readable context anchors for
 *    evidence moment context fields.
 *
 * @module tests/unit/plugin/tool-input-extraction
 */

import { describe, expect, it } from 'vitest';
import {
  extractToolCallDetail,
  formatToolSequence,
  buildEvidenceContextIndex,
  buildEvidenceContexts,
} from '../../../packages/plugin/lib/core/evidence-extractor.js';
import {
  evaluateQualityRubric,
  containsToolFileApiReference,
  isValidToolFileApiEntry,
  type GrowthAreaPEALLMOutput,
} from '../../../packages/shared/src/schemas/growth-area-pea.js';
import type { ParsedSession } from '../../../packages/plugin/lib/core/types.js';

// ==========================================================================
// extractToolCallDetail
// ==========================================================================

describe('extractToolCallDetail', () => {
  describe('extracts file paths from file-based tools', () => {
    it('extracts file_path from Read tool', () => {
      const detail = extractToolCallDetail('Read', { file_path: 'src/lib/auth.ts' });
      expect(detail).toBe('src/lib/auth.ts');
    });

    it('extracts file_path from Edit tool', () => {
      const detail = extractToolCallDetail('Edit', {
        file_path: 'middleware/stripe.ts',
        old_string: 'foo',
        new_string: 'bar',
      });
      expect(detail).toBe('middleware/stripe.ts');
    });

    it('extracts file_path from Write tool', () => {
      const detail = extractToolCallDetail('Write', {
        file_path: 'src/api/routes.ts',
        content: '...',
      });
      expect(detail).toBe('src/api/routes.ts');
    });
  });

  describe('extracts commands from Bash tool', () => {
    it('extracts npm test command', () => {
      const detail = extractToolCallDetail('Bash', { command: 'npm test' });
      expect(detail).toBe('npm test');
    });

    it('extracts vitest command', () => {
      const detail = extractToolCallDetail('Bash', { command: 'npx vitest run --reporter=verbose' });
      expect(detail).toBe('npx vitest run --reporter=verbose');
    });

    it('truncates long Bash commands at 120 chars', () => {
      const longCommand = 'npm run build && npm run test && npm run lint && npm run typecheck && npm run generate && npm run deploy && npm run verify';
      const detail = extractToolCallDetail('Bash', { command: longCommand });
      expect(detail).toBeDefined();
      expect(detail!.length).toBeLessThanOrEqual(120);
    });

    it('returns git commit command', () => {
      const detail = extractToolCallDetail('Bash', { command: 'git commit -m "fix: auth middleware"' });
      expect(detail).toBe('git commit -m "fix: auth middleware"');
    });
  });

  describe('extracts search patterns from Grep tool', () => {
    it('extracts pattern and path from Grep', () => {
      const detail = extractToolCallDetail('Grep', {
        pattern: 'isAuthenticated',
        path: 'src/middleware',
      });
      expect(detail).toBe('isAuthenticated in src/middleware');
    });

    it('extracts just pattern when no path provided', () => {
      const detail = extractToolCallDetail('Grep', { pattern: 'handleWebhook' });
      expect(detail).toBe('handleWebhook');
    });
  });

  describe('extracts patterns from Glob tool', () => {
    it('extracts glob pattern and directory scope', () => {
      const detail = extractToolCallDetail('Glob', {
        pattern: '**/*.test.ts',
        path: 'src/',
      });
      expect(detail).toBe('**/*.test.ts in src/');
    });

    it('extracts glob pattern without path', () => {
      const detail = extractToolCallDetail('Glob', { pattern: '**/*.ts' });
      expect(detail).toBe('**/*.ts');
    });
  });

  describe('returns undefined for unknown/missing inputs', () => {
    it('returns undefined for TodoWrite (no extractable detail)', () => {
      const detail = extractToolCallDetail('TodoWrite', {
        todos: [{ id: '1', content: 'task', status: 'pending' }],
      });
      expect(detail).toBeUndefined();
    });

    it('returns undefined for Read with missing file_path', () => {
      const detail = extractToolCallDetail('Read', {});
      expect(detail).toBeUndefined();
    });
  });
});

// ==========================================================================
// formatToolSequence
// ==========================================================================

describe('formatToolSequence', () => {
  it('formats a single tool with file path detail', () => {
    const result = formatToolSequence([
      { name: 'Read', detail: 'src/lib/auth.ts' },
    ]);
    expect(result).toBe('after Read(src/lib/auth.ts)');
  });

  it('formats a multi-tool sequence with details', () => {
    const result = formatToolSequence([
      { name: 'Read', detail: 'middleware/auth.ts' },
      { name: 'Edit', detail: 'middleware/auth.ts' },
      { name: 'Bash', detail: 'npm test' },
    ]);
    expect(result).toBe('after Read(middleware/auth.ts) then Edit(middleware/auth.ts) then Bash(npm test)');
  });

  it('shows error flag for failed tool calls', () => {
    const result = formatToolSequence([
      { name: 'Bash', detail: 'npm test', isError: true },
    ]);
    expect(result).toContain('Bash(npm test)✗');
    expect(result).toContain('[1 error]');
  });

  it('shows error count for multiple failures', () => {
    const result = formatToolSequence([
      { name: 'Bash', detail: 'npm run build', isError: true },
      { name: 'Bash', detail: 'npm test', isError: true },
    ]);
    expect(result).toContain('[2 errors]');
  });

  it('returns empty string for empty sequence', () => {
    const result = formatToolSequence([]);
    expect(result).toBe('');
  });

  it('includes +N more when sequence exceeds maxTools', () => {
    const result = formatToolSequence([
      { name: 'Read', detail: 'file1.ts' },
      { name: 'Edit', detail: 'file2.ts' },
      { name: 'Bash', detail: 'npm test' },
      { name: 'Read', detail: 'file3.ts' },
      { name: 'Grep', detail: 'pattern' },
    ], 3);
    expect(result).toContain('+2 more');
  });
});

// ==========================================================================
// buildEvidenceContexts + buildEvidenceContextIndex integration
// ==========================================================================

function makeMinimalSession(overrides: Partial<ParsedSession> = {}): ParsedSession {
  return {
    sessionId: 'sess_test',
    projectPath: '/home/dev/my-project',
    projectName: 'my-project',
    startTime: '2026-03-15T10:00:00.000Z',
    endTime: '2026-03-15T10:30:00.000Z',
    durationSeconds: 1800,
    claudeCodeVersion: '1.0.0',
    source: 'claude-code',
    stats: {
      userMessageCount: 2,
      assistantMessageCount: 2,
      toolCallCount: 3,
      uniqueToolsUsed: ['Read', 'Edit', 'Bash'],
      totalInputTokens: 10000,
      totalOutputTokens: 2000,
    },
    messages: [
      {
        uuid: 'msg-1',
        role: 'assistant',
        timestamp: '2026-03-15T10:00:30.000Z',
        content: 'Let me read the auth file.',
        toolCalls: [
          { id: 'tc-1', name: 'Read', input: { file_path: 'src/middleware/auth.ts' }, isError: false },
          { id: 'tc-2', name: 'Edit', input: { file_path: 'src/middleware/auth.ts', old_string: 'x', new_string: 'y' }, isError: false },
        ],
      },
      {
        uuid: 'msg-2',
        role: 'user',
        timestamp: '2026-03-15T10:01:00.000Z',
        content: 'ok now run the tests',
      },
      {
        uuid: 'msg-3',
        role: 'assistant',
        timestamp: '2026-03-15T10:01:30.000Z',
        content: 'Running tests...',
        toolCalls: [
          { id: 'tc-3', name: 'Bash', input: { command: 'npm test' }, isError: true },
        ],
      },
      {
        uuid: 'msg-4',
        role: 'user',
        timestamp: '2026-03-15T10:02:00.000Z',
        content: 'tests still failing, just try again',
      },
    ],
    ...overrides,
  };
}

describe('buildEvidenceContexts', () => {
  it('extracts file paths from Read/Edit tool calls preceding a user utterance', () => {
    const sessions = [makeMinimalSession()];
    const contexts = buildEvidenceContexts(sessions);

    // Should have contexts for the 2 user messages
    expect(contexts.length).toBe(2);

    // First user utterance (msg-2) should have preceding tool sequence with file paths
    const firstCtx = contexts[0]!;
    expect(firstCtx.utteranceId).toBe('sess_test_1'); // index 1 in messages array
    expect(firstCtx.precedingToolSequence).toHaveLength(2);
    expect(firstCtx.precedingToolSequence[0]!.name).toBe('Read');
    expect(firstCtx.precedingToolSequence[0]!.detail).toBe('src/middleware/auth.ts');
    expect(firstCtx.precedingToolSequence[1]!.name).toBe('Edit');
    expect(firstCtx.precedingToolSequence[1]!.detail).toBe('src/middleware/auth.ts');
  });

  it('marks failed tool calls with isError and includes errorText when available', () => {
    const sessions = [makeMinimalSession()];
    const contexts = buildEvidenceContexts(sessions);

    // Second user utterance (msg-4) has preceding Bash that failed
    const secondCtx = contexts[1]!;
    expect(secondCtx.precedingToolSequence[0]!.name).toBe('Bash');
    expect(secondCtx.precedingToolSequence[0]!.detail).toBe('npm test');
    expect(secondCtx.precedingToolSequence[0]!.isError).toBe(true);
  });

  it('includes cumulative error count for evidence context', () => {
    const sessions = [makeMinimalSession()];
    const contexts = buildEvidenceContexts(sessions);

    // After the failing Bash, cumulativeErrorCount should be 1
    const secondCtx = contexts[1]!;
    expect(secondCtx.cumulativeErrorCount).toBe(1);
  });

  it('includes session turn number starting from 1', () => {
    const sessions = [makeMinimalSession()];
    const contexts = buildEvidenceContexts(sessions);

    expect(contexts[0]!.sessionTurnNumber).toBe(1);
    expect(contexts[1]!.sessionTurnNumber).toBe(2);
  });
});

describe('buildEvidenceContextIndex', () => {
  it('creates O(1) lookup by utteranceId', () => {
    const sessions = [makeMinimalSession()];
    const contexts = buildEvidenceContexts(sessions);
    const index = buildEvidenceContextIndex(contexts);

    expect(index.size).toBe(2);
    const ctx = index.get('sess_test_1');
    expect(ctx).toBeDefined();
    expect(ctx!.precedingToolSequence[0]!.detail).toBe('src/middleware/auth.ts');
  });
});

// ==========================================================================
// Growth area toolsFilesApis with specific file paths from extracted data
// ==========================================================================

describe('tool_file_naming rubric with extracted file paths', () => {
  it('passes when toolsFilesApis includes specific file paths from session', () => {
    // This simulates a growth area where the LLM used extractedToolCallDetail
    // to populate toolsFilesApis with specific file names
    const pea: GrowthAreaPEALLMOutput = {
      pattern: {
        title: 'Untested Error Handling in middleware/auth.ts After Edit Calls',
        description:
          'In 4 of 6 sessions, after invoking Edit on src/middleware/auth.ts to add error handlers, ' +
          'the developer never ran npm test via Bash to validate the changes. This leaves ' +
          'untested error paths in the auth middleware that handle webhook validation failures.',
        severity: 'high',
        toolsFilesApis: ['Edit', 'src/middleware/auth.ts', 'npm test', 'Bash'],
      },
      evidence: [
        {
          utteranceId: 'sess_abc_5',
          sessionId: 'sess_abc',
          quote: 'ok now let me add a try-catch to the auth handler and move on',
          context: 'In the payment-api project, after Read(src/middleware/auth.ts) then Edit(src/middleware/auth.ts) — developer added error handler without running tests',
          observation: 'Added catch block to auth middleware without running npm test first',
        },
        {
          utteranceId: 'sess_def_8',
          sessionId: 'sess_def',
          quote: 'the webhook handler crashes but I am not sure which catch is wrong',
          context: 'In the payment-api project, after Bash(npm test) with 3 errors — previously untested catch block masked the real auth error',
          observation: 'Debugging auth middleware failure caused by untested catch block from 2 sessions ago',
        },
      ],
      action: {
        instruction: 'After each Edit call on middleware/*.ts files, immediately run npm test via Bash before moving to the next task. This creates a test-before-move-on discipline for auth middleware changes.',
        verificationCheck: 'Session log shows Bash(npm test) tool_use block immediately following Edit(middleware/*.ts) in auth-related sessions.',
        goalRelevance: 'Your payment-api handles Stripe webhooks — untested auth middleware errors silently drop webhook validation, causing revenue loss.',
      },
      domain: 'toolMastery',
      categoryTags: ['error-handling', 'test-coverage', 'middleware-testing'],
    };

    const rubric = evaluateQualityRubric(pea);
    expect(rubric.toolFileNaming).toBe(true);
    expect(rubric.verifiableAction).toBe(true);
    expect(rubric.distinctMoments).toBe(true);
  });

  it('isValidToolFileApiEntry accepts extracted file paths', () => {
    // These are the kinds of values extractToolCallDetail returns for file-based tools
    expect(isValidToolFileApiEntry('src/middleware/auth.ts')).toBe(true);
    expect(isValidToolFileApiEntry('middleware/stripe.ts')).toBe(true);
    expect(isValidToolFileApiEntry('packages/shared/src/schemas/domain-result.ts')).toBe(true);
    expect(isValidToolFileApiEntry('src/lib/')).toBe(true);
  });

  it('containsToolFileApiReference accepts formatted tool sequences as context', () => {
    // These are the kinds of strings formatToolSequence produces
    expect(containsToolFileApiReference('after Read(src/middleware/auth.ts) then Edit(src/middleware/auth.ts)')).toBe(true);
    expect(containsToolFileApiReference('after Bash(npm test) [1 error]')).toBe(true);
    expect(containsToolFileApiReference('after Grep(isAuthenticated in src/middleware)')).toBe(true);
  });

  it('passes when description contains formatted tool sequence with file paths', () => {
    const pea: GrowthAreaPEALLMOutput = {
      pattern: {
        title: 'Bare Retry After Bash(npm test) Failure Without Reading Error',
        description:
          'In 3 of 5 sessions, after Bash(npm test) returns an error, the developer ' +
          'immediately retries the same command without reading the error output. ' +
          'The pattern is most visible when npm test fails on src/lib/auth.test.ts — ' +
          'the developer retries 2-3 times before finally reading the error message.',
        severity: 'medium',
        toolsFilesApis: ['Bash', 'npm test', 'src/lib/auth.test.ts'],
      },
      evidence: [
        {
          utteranceId: 'sess_abc_7',
          sessionId: 'sess_abc',
          quote: 'still failing, try the tests again',
          context: 'after Bash(npm test) [1 error] — developer immediately retried without inspecting the error output',
          observation: 'Bare retry after Bash npm test failure in auth test suite',
        },
        {
          utteranceId: 'sess_def_9',
          sessionId: 'sess_def',
          quote: 'run the tests one more time',
          context: 'after Bash(npm test) [2 errors] — second bare retry without reading the error message',
          observation: 'Second consecutive retry without addressing the underlying test failure',
        },
      ],
      action: {
        instruction: 'After each failed Bash(npm test), use Read on the affected test file (src/lib/*.test.ts) before retrying. This ensures you understand what failed before repeating the same command.',
        verificationCheck: 'Session log shows Read tool_use call between consecutive Bash(npm test) calls when previous attempt had errors.',
        goalRelevance: 'Your auth module has complex integration tests — bare retries miss the root cause and waste session turns on guesswork.',
      },
      domain: 'sessionMastery',
      categoryTags: ['bare-retry', 'error-reading', 'test-debugging'],
    };

    const rubric = evaluateQualityRubric(pea);
    expect(rubric.toolFileNaming).toBe(true);
    expect(rubric.verifiableAction).toBe(true);
  });
});
