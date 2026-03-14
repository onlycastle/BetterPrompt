/**
 * Session Summarizer & Activity Scanner Tests
 *
 * Tests for:
 * - SessionSummarizerStage class (Phase 1.5 LLM stage)
 * - SessionSummaryItemSchema (Zod schema validation)
 * - Activity scanner helpers (stripSystemTags via stripSystemReminders alias, truncateAtWordBoundary)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SessionSummaryItemSchema,
  SessionSummaryBatchLLMSchema,
} from '../../../../src/lib/models/session-summary-data';

// Import activity scanner helpers
import {
  stripSystemReminders,
  truncateAtWordBoundary,
} from '../../../../packages/cli/src/activity-scanner';

// Import stripSystemTags directly for testing new tag patterns
import { stripSystemTags } from '../../../../packages/cli/src/lib/strip-system-tags';

// ---------------------------------------------------------------------------
// Schema Tests
// ---------------------------------------------------------------------------

describe('SessionSummarySchemas', () => {
  describe('SessionSummaryItemSchema', () => {
    it('should accept valid item with sessionId and summary', () => {
      const result = SessionSummaryItemSchema.safeParse({
        sessionId: 'abc-123',
        summary: 'Implement JWT authentication',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sessionId).toBe('abc-123');
        expect(result.data.summary).toBe('Implement JWT authentication');
      }
    });

    it('should reject item without sessionId', () => {
      const result = SessionSummaryItemSchema.safeParse({
        summary: 'Implement JWT authentication',
      });
      expect(result.success).toBe(false);
    });

    it('should reject item without summary', () => {
      const result = SessionSummaryItemSchema.safeParse({
        sessionId: 'abc-123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject completely empty object', () => {
      const result = SessionSummaryItemSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('SessionSummaryBatchLLMSchema', () => {
    it('should accept valid batch with summaries array', () => {
      const result = SessionSummaryBatchLLMSchema.safeParse({
        summaries: [
          { sessionId: 'session-1', summary: 'Implement auth flow' },
          { sessionId: 'session-2', summary: 'Fix responsive layout' },
        ],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summaries).toHaveLength(2);
      }
    });

    it('should accept empty summaries array', () => {
      const result = SessionSummaryBatchLLMSchema.safeParse({
        summaries: [],
      });
      expect(result.success).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Activity Scanner Helper Tests
// ---------------------------------------------------------------------------

describe('stripSystemReminders (backward-compat alias)', () => {
  it('should remove system-reminder tags', () => {
    const input = 'Hello <system-reminder>secret stuff</system-reminder> world';
    expect(stripSystemReminders(input)).toBe('Hello world');
  });

  it('should remove multiple system-reminder tags', () => {
    const input = '<system-reminder>tag1</system-reminder>Hello<system-reminder>tag2</system-reminder>';
    expect(stripSystemReminders(input)).toBe('Hello');
  });

  it('should handle multiline system-reminder content', () => {
    const input = 'Start<system-reminder>\nline1\nline2\n</system-reminder>End';
    expect(stripSystemReminders(input)).toBe('StartEnd');
  });

  it('should return original text when no tags present', () => {
    const input = 'Just normal text';
    expect(stripSystemReminders(input)).toBe('Just normal text');
  });

  it('should handle empty string', () => {
    expect(stripSystemReminders('')).toBe('');
  });

  it('should handle text that is only system-reminder tags', () => {
    const input = '<system-reminder>all tags</system-reminder>';
    expect(stripSystemReminders(input)).toBe('');
  });
});

describe('stripSystemTags (extended tag patterns)', () => {
  it('should remove command-name tags', () => {
    const input = 'Hello <command-name>commit</command-name> world';
    expect(stripSystemTags(input)).toBe('Hello world');
  });

  it('should remove local-command-caveat tags', () => {
    const input = '<local-command-caveat>This command is local only</local-command-caveat>Fix the bug';
    expect(stripSystemTags(input)).toBe('Fix the bug');
  });

  it('should remove command-args tags', () => {
    const input = 'Run <command-args>--verbose --dry-run</command-args> this test';
    expect(stripSystemTags(input)).toBe('Run this test');
  });

  it('should remove task-notification tags', () => {
    const input = '<task-notification>Task 5 completed</task-notification>Continue with implementation';
    expect(stripSystemTags(input)).toBe('Continue with implementation');
  });

  it('should remove multiple different tag types', () => {
    const input = '<system-reminder>reminder</system-reminder>Hello<command-name>cmd</command-name> <local-command-caveat>caveat</local-command-caveat>world';
    expect(stripSystemTags(input)).toBe('Hello world');
  });

  it('should remove noise text patterns', () => {
    const input = 'Hello [Request interrupted by user for tool use] world';
    expect(stripSystemTags(input)).toBe('Hello world');
  });

  it('should remove [Request interrupted by user] pattern', () => {
    const input = 'Start [Request interrupted by user] end';
    expect(stripSystemTags(input)).toBe('Start end');
  });

  it('should handle text that is entirely system tags', () => {
    const input = '<system-reminder>only tags</system-reminder><command-name>nothing</command-name>';
    expect(stripSystemTags(input)).toBe('');
  });
});

describe('truncateAtWordBoundary', () => {
  it('should return short text unchanged', () => {
    expect(truncateAtWordBoundary('Hello world', 80)).toBe('Hello world');
  });

  it('should truncate at word boundary with ellipsis', () => {
    const longText = 'This is a long sentence that should be truncated at a word boundary to keep readability intact';
    const result = truncateAtWordBoundary(longText, 40);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result).toMatch(/\.\.\.$/);
    // Should end at a complete word followed by "..."
    // The last word before "..." should be a complete word (not cut mid-word)
    expect(result).toBe('This is a long sentence that should...');
  });

  it('should handle exact length text', () => {
    const text = 'A'.repeat(80);
    expect(truncateAtWordBoundary(text, 80)).toBe(text);
  });

  it('should use default max length of 80', () => {
    const longText = 'word '.repeat(30); // 150 chars
    const result = truncateAtWordBoundary(longText);
    expect(result.length).toBeLessThanOrEqual(80);
  });

  it('should normalize whitespace', () => {
    const text = 'Hello   world\n\nfoo   bar';
    expect(truncateAtWordBoundary(text, 80)).toBe('Hello world foo bar');
  });

  it('should handle single long word without spaces', () => {
    const longWord = 'A'.repeat(100);
    const result = truncateAtWordBoundary(longWord, 80);
    expect(result.length).toBe(80);
    expect(result).toMatch(/\.\.\.$/);
  });

  it('should handle empty string', () => {
    expect(truncateAtWordBoundary('', 80)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// SessionSummarizerStage Tests (Phase 1.5 LLM stage)
// ---------------------------------------------------------------------------

// Mock GeminiClient before importing the stage
vi.mock('../../../../src/lib/analyzer/clients/gemini-client.js', () => ({
  GeminiClient: vi.fn().mockImplementation(function () {
    return { generateStructured: vi.fn() };
  }),
}));

// Import after mock (must use .js extension to match vitest resolution)
import { SessionSummarizerStage } from '../../../../src/lib/analyzer/stages/session-summarizer.js';
import { buildSessionSummarizerUserPrompt } from '../../../../src/lib/analyzer/stages/session-summarizer-prompts.js';
import { GeminiClient } from '../../../../src/lib/analyzer/clients/gemini-client.js';

describe('SessionSummarizerStage', () => {
  let summarizer: SessionSummarizerStage;

  beforeEach(() => {
    // Configure mock return value for each test
    const mockGenerateStructured = vi.fn().mockResolvedValue({
      data: {
        summaries: [
          { sessionId: 'session-1', summary: 'Implement JWT authentication' },
          { sessionId: 'session-2', summary: 'Fix responsive layout bug' },
        ],
      },
      usage: {
        promptTokens: 500,
        completionTokens: 200,
        totalTokens: 700,
      },
    });

    (GeminiClient as any).mockImplementation(function () {
      return { generateStructured: mockGenerateStructured };
    });

    summarizer = new SessionSummarizerStage({
      apiKey: 'test-api-key',
    });
  });

  it('should return summaries from LLM structured output', async () => {
    const sessions = [
      {
        sessionId: 'session-1',
        projectName: 'my-app',
        messages: [
          { role: 'user', content: 'Help me implement JWT auth' },
          { role: 'assistant', content: 'Sure, let me help...' },
        ],
      },
      {
        sessionId: 'session-2',
        projectName: 'my-app',
        messages: [
          { role: 'user', content: 'The layout is broken on mobile' },
        ],
      },
    ];

    const result = await summarizer.summarize(sessions);

    expect(result.data.summaries).toHaveLength(2);
    expect(result.data.summaries[0].sessionId).toBe('session-1');
    expect(result.data.summaries[0].summary).toBe('Implement JWT authentication');
    expect(result.data.summaries[1].sessionId).toBe('session-2');
    expect(result.usage.totalTokens).toBe(700);
  });

  it('should return empty summaries for empty sessions without LLM call', async () => {
    const result = await summarizer.summarize([]);

    expect(result.data.summaries).toHaveLength(0);
    expect(result.usage.totalTokens).toBe(0);
  });

  it('should call GeminiClient with correct schema', async () => {
    const sessions = [
      {
        sessionId: 's1',
        projectName: 'proj',
        messages: [{ role: 'user', content: 'test' }],
      },
    ];

    await summarizer.summarize(sessions);

    // Verify generateStructured was called with expected params
    const mockInstance = (GeminiClient as any).mock.results[0].value;
    expect(mockInstance.generateStructured).toHaveBeenCalledTimes(1);
    const callArgs = mockInstance.generateStructured.mock.calls[0][0];
    expect(callArgs.systemPrompt).toBeDefined();
    expect(callArgs.userPrompt).toContain('s1');
    expect(callArgs.responseSchema).toBeDefined();
    expect(callArgs.maxOutputTokens).toBe(65536);
  });
});

describe('buildSessionSummarizerUserPrompt', () => {
  it('should format sessions into prompt with IDs and messages', () => {
    const sessions = [
      {
        sessionId: 'abc-123',
        projectName: 'test-project',
        messages: [
          { role: 'user', content: 'Help me with auth' },
          { role: 'assistant', content: 'Sure thing' },
          { role: 'user', content: 'Add JWT tokens' },
        ],
      },
    ];

    const prompt = buildSessionSummarizerUserPrompt(sessions);

    expect(prompt).toContain('abc-123');
    expect(prompt).toContain('test-project');
    expect(prompt).toContain('[user]: Help me with auth');
    expect(prompt).toContain('[user]: Add JWT tokens');
    // Should filter out assistant messages
    expect(prompt).not.toContain('[assistant]');
  });

  it('should handle sessions with no user messages', () => {
    const sessions = [
      {
        sessionId: 'empty-session',
        projectName: 'proj',
        messages: [
          { role: 'assistant', content: 'Hello' },
        ],
      },
    ];

    const prompt = buildSessionSummarizerUserPrompt(sessions);

    expect(prompt).toContain('empty-session');
    expect(prompt).toContain('(no user messages)');
  });

  it('should include only first 5 user messages', () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: 'user',
      content: `Message ${i + 1}`,
    }));

    const sessions = [
      { sessionId: 's1', projectName: 'proj', messages },
    ];

    const prompt = buildSessionSummarizerUserPrompt(sessions);

    expect(prompt).toContain('Message 1');
    expect(prompt).toContain('Message 5');
    expect(prompt).not.toContain('Message 6');
  });
});
