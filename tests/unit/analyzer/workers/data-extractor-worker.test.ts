import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataExtractorWorker } from '../../../../src/lib/analyzer/workers/data-extractor-worker.js';
import type { ParsedSession, ParsedMessage } from '../../../../src/lib/models/session.js';
import type { WorkerContext } from '../../../../src/lib/analyzer/workers/base-worker.js';
import * as geminiClientModule from '../../../../src/lib/analyzer/clients/gemini-client.js';

/**
 * Unit tests for DataExtractorWorker system tag stripping.
 *
 * These tests verify that system-injected tags in Claude Code JSONL
 * are properly stripped before being passed to downstream workers.
 */
describe('DataExtractorWorker', () => {
  let worker: DataExtractorWorker;

  beforeEach(() => {
    worker = new DataExtractorWorker();
  });

  /**
   * Helper to create a minimal ParsedSession with user messages
   */
  function createSession(userContents: string[]): ParsedSession {
    const messages: ParsedMessage[] = userContents.map((content, i) => ({
      role: 'user' as const,
      content,
      timestamp: new Date(),
      toolCalls: [],
    }));

    return {
      sessionId: 'test-session',
      projectPath: '/test/project',
      messages,
      messageCount: messages.length,
      durationSeconds: 60,
    };
  }

  function createContext(sessions: ParsedSession[]): WorkerContext {
    return {
      sessions,
      locale: 'en',
      tier: 'free',
    };
  }

  describe('stripSystemTags', () => {
    it('should remove <system-reminder> tags', async () => {
      const session = createSession([
        '<system-reminder>SessionStart:clear hook success</system-reminder>Hello, help me with this code',
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      expect(result.data.developerUtterances[0]?.text).toBe('Hello, help me with this code');
    });

    it('should remove <command-name> and <command-message> tags', async () => {
      const session = createSession([
        '<command-name>/clear</command-name><command-message>Clearing context</command-message>Now let me ask a question',
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      expect(result.data.developerUtterances[0]?.text).toBe('Now let me ask a question');
    });

    it('should remove <command-args> tags', async () => {
      const session = createSession([
        '<command-args>--verbose</command-args>Run this command please',
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      expect(result.data.developerUtterances[0]?.text).toBe('Run this command please');
    });

    it('should remove <local-command-stdout> tags', async () => {
      const session = createSession([
        '<local-command-stdout>npm install completed</local-command-stdout>What happened?',
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      expect(result.data.developerUtterances[0]?.text).toBe('What happened?');
    });

    it('should remove <local-command-caveat> tags', async () => {
      const session = createSession([
        '<local-command-caveat>This may take a while</local-command-caveat>Please wait for it',
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      expect(result.data.developerUtterances[0]?.text).toBe('Please wait for it');
    });

    it('should preserve user text mixed with system tags', async () => {
      const session = createSession([
        'Hello <system-reminder>Some system info</system-reminder> I need help <command-name>/test</command-name> with my code',
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      expect(result.data.developerUtterances[0]?.text).toBe('Hello I need help with my code');
    });

    it('should skip utterances that are only system tags', async () => {
      const session = createSession([
        '<system-reminder>SessionStart hook</system-reminder><command-name>/clear</command-name>',
        'This is a real user message',
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      // Should only have 1 utterance (the second one with real user text)
      expect(result.data.developerUtterances.length).toBe(1);
      expect(result.data.developerUtterances[0]?.text).toBe('This is a real user message');
    });

    it('should not modify normal user messages without system tags', async () => {
      const session = createSession([
        'How do I implement a binary search?',
        'Can you add error handling?',
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      expect(result.data.developerUtterances.length).toBe(2);
      expect(result.data.developerUtterances[0]?.text).toBe('How do I implement a binary search?');
      expect(result.data.developerUtterances[1]?.text).toBe('Can you add error handling?');
    });

    it('should handle multiline system tags', async () => {
      const session = createSession([
        `<system-reminder>
This is a
multiline system reminder
with various content
</system-reminder>Please help me`,
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      expect(result.data.developerUtterances[0]?.text).toBe('Please help me');
    });

    it('should collapse multiple spaces after tag removal', async () => {
      const session = createSession([
        'Hello   <system-reminder>test</system-reminder>   world',
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      expect(result.data.developerUtterances[0]?.text).toBe('Hello world');
    });

    it('should handle nested-looking patterns correctly', async () => {
      // Not actually nested, but sequential tags
      const session = createSession([
        '<system-reminder>First</system-reminder><system-reminder>Second</system-reminder>User text',
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      expect(result.data.developerUtterances[0]?.text).toBe('User text');
    });

    it('should remove <local-command-stderr> tags', async () => {
      const session = createSession([
        '<local-command-stderr>Error: command failed</local-command-stderr>What went wrong?',
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      expect(result.data.developerUtterances[0]?.text).toBe('What went wrong?');
    });

    it('should remove <task-notification> tags', async () => {
      const session = createSession([
        '<task-notification><task-id>a123</task-id><status>completed</status><summary>Task done</summary></task-notification>Now what?',
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      expect(result.data.developerUtterances[0]?.text).toBe('Now what?');
    });

    it('should remove individual task tags', async () => {
      const session = createSession([
        '<task-id>abc123</task-id><status>completed</status><result>Success</result><output-file>/tmp/out.txt</output-file>Check the result',
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      expect(result.data.developerUtterances[0]?.text).toBe('Check the result');
    });
  });

  describe('duplicate message deduplication', () => {
    /**
     * Tests for deduplicating messages that Claude Code splits into multiple
     * JSONL lines (e.g., complex messages with image+text).
     *
     * Root cause: Claude Code may split a single user input into multiple
     * JSONL entries with identical timestamps and content.
     */

    /**
     * Helper to create a ParsedSession with messages that have specific timestamps
     */
    function createSessionWithTimestamps(
      messages: Array<{ content: string; timestamp: Date; role?: 'user' | 'assistant' }>
    ): ParsedSession {
      const parsedMessages: ParsedMessage[] = messages.map((msg) => ({
        role: msg.role ?? 'user',
        content: msg.content,
        timestamp: msg.timestamp,
        toolCalls: [],
      }));

      return {
        sessionId: 'test-session',
        projectPath: '/test/project',
        messages: parsedMessages,
        messageCount: parsedMessages.length,
        durationSeconds: 60,
      };
    }

    it('should deduplicate messages with identical timestamp and text', async () => {
      const sameTimestamp = new Date('2026-01-28T09:12:34.518Z');
      const duplicateText = '이 프로젝트는 모바일 청첩장을 커스텀하게 만들어주는 서비스입니다.';

      const session = createSessionWithTimestamps([
        { content: duplicateText, timestamp: sameTimestamp },
        { content: duplicateText, timestamp: sameTimestamp }, // Duplicate
        { content: duplicateText, timestamp: sameTimestamp }, // Duplicate
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      // Should only have 1 utterance after deduplication
      expect(result.data.developerUtterances.length).toBe(1);
      expect(result.data.developerUtterances[0]?.text).toBe(duplicateText);
    });

    it('should keep messages with same text but different timestamps', async () => {
      const text = 'Please help me with this code.';
      const timestamp1 = new Date('2026-01-28T09:00:00.000Z');
      const timestamp2 = new Date('2026-01-28T10:00:00.000Z');

      const session = createSessionWithTimestamps([
        { content: text, timestamp: timestamp1 },
        { content: text, timestamp: timestamp2 }, // Different timestamp = not a duplicate
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      // Should have 2 utterances (different timestamps)
      expect(result.data.developerUtterances.length).toBe(2);
    });

    it('should keep messages with same timestamp but different text', async () => {
      const sameTimestamp = new Date('2026-01-28T09:12:34.518Z');

      const session = createSessionWithTimestamps([
        { content: 'First message content', timestamp: sameTimestamp },
        { content: 'Second message content', timestamp: sameTimestamp }, // Same timestamp but different text
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      // Should have 2 utterances (different text)
      expect(result.data.developerUtterances.length).toBe(2);
    });

    it('should preserve turnIndex of first occurrence', async () => {
      const sameTimestamp = new Date('2026-01-28T09:12:34.518Z');
      const duplicateText = 'Duplicate message here.';

      const session = createSessionWithTimestamps([
        { content: 'First unique message', timestamp: new Date('2026-01-28T09:00:00.000Z') },
        { content: duplicateText, timestamp: sameTimestamp },
        { content: duplicateText, timestamp: sameTimestamp }, // Duplicate - should be skipped
        { content: 'Another unique message', timestamp: new Date('2026-01-28T09:15:00.000Z') },
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      // Should have 3 utterances (first, duplicate, and another)
      expect(result.data.developerUtterances.length).toBe(3);
      // The duplicate message should have turnIndex 1 (first occurrence)
      const duplicateUtterance = result.data.developerUtterances.find(u => u.text === duplicateText);
      expect(duplicateUtterance?.turnIndex).toBe(1);
    });

    it('should deduplicate after stripping system tags', async () => {
      const sameTimestamp = new Date('2026-01-28T09:12:34.518Z');
      const coreText = 'Help me with this bug.';

      const session = createSessionWithTimestamps([
        { content: `<system-reminder>Some reminder</system-reminder>${coreText}`, timestamp: sameTimestamp },
        { content: coreText, timestamp: sameTimestamp }, // Same text after tag stripping
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      // Should only have 1 utterance after deduplication
      expect(result.data.developerUtterances.length).toBe(1);
      expect(result.data.developerUtterances[0]?.text).toBe(coreText);
    });

    it('should handle mixed duplicates and unique messages', async () => {
      const ts1 = new Date('2026-01-28T09:00:00.000Z');
      const ts2 = new Date('2026-01-28T09:10:00.000Z');
      const ts3 = new Date('2026-01-28T09:20:00.000Z');

      const session = createSessionWithTimestamps([
        { content: 'Message A', timestamp: ts1 },
        { content: 'Message A', timestamp: ts1 }, // Duplicate of first
        { content: 'Message B', timestamp: ts2 },
        { content: 'Message C', timestamp: ts3 },
        { content: 'Message C', timestamp: ts3 }, // Duplicate of fourth
        { content: 'Message C', timestamp: ts3 }, // Another duplicate
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      // Should have 3 unique utterances: A, B, C
      expect(result.data.developerUtterances.length).toBe(3);
      expect(result.data.developerUtterances.map(u => u.text)).toEqual([
        'Message A',
        'Message B',
        'Message C',
      ]);
    });
  });

  describe('segment-aware metrics (/clear splitting)', () => {
    /**
     * Helper to create a ParsedSession with user and assistant messages.
     * Generates alternating user/assistant pairs for realistic structure.
     */
    function createChatSession(
      userContents: string[],
      sessionId = 'test-session'
    ): ParsedSession {
      const messages: ParsedMessage[] = [];
      for (const content of userContents) {
        messages.push({
          role: 'user' as const,
          content,
          timestamp: new Date(),
          toolCalls: [],
        });
        messages.push({
          role: 'assistant' as const,
          content: 'OK, done.',
          timestamp: new Date(),
          toolCalls: [],
        });
      }
      return {
        sessionId,
        projectPath: '/test/project',
        messages,
        messageCount: messages.length,
        durationSeconds: 120,
      };
    }

    it('should split 30-message session with 2 /clear into 3 medium segments', async () => {
      // 10 user messages + /clear + 10 user messages + /clear + 10 user messages
      const userContents: string[] = [];
      for (let i = 0; i < 10; i++) userContents.push(`Task A message ${i}`);
      userContents.push('/clear');
      for (let i = 0; i < 10; i++) userContents.push(`Task B message ${i}`);
      userContents.push('<command-name>/clear</command-name>');
      for (let i = 0; i < 10; i++) userContents.push(`Task C message ${i}`);

      const session = createChatSession(userContents);
      const context = createContext([session]);
      const result = await worker.execute(context);

      expect(result.error).toBeUndefined();
      const hints = result.data.sessionMetrics.sessionHints;
      // 3 segments of 10 user messages each → all medium (4-10)
      expect(hints.mediumSessions).toBe(3);
      expect(hints.longSessions).toBe(0);
      expect(hints.shortSessions).toBe(0);
    });

    it('should not count /clear messages in user counts', async () => {
      // 3 user messages + /clear + 3 user messages
      const userContents = [
        'msg1', 'msg2', 'msg3',
        '/clear',
        'msg4', 'msg5', 'msg6',
      ];
      const session = createChatSession(userContents);
      const context = createContext([session]);
      const result = await worker.execute(context);

      expect(result.error).toBeUndefined();
      const hints = result.data.sessionMetrics.sessionHints;
      // 2 segments of 3 user messages each → both short (<=3)
      expect(hints.shortSessions).toBe(2);
      expect(hints.mediumSessions).toBe(0);
      expect(hints.longSessions).toBe(0);
    });

    it('should behave identically for sessions without /clear', async () => {
      const userContents = ['msg1', 'msg2', 'msg3', 'msg4', 'msg5'];
      const session = createChatSession(userContents);
      const context = createContext([session]);
      const result = await worker.execute(context);

      expect(result.error).toBeUndefined();
      const hints = result.data.sessionMetrics.sessionHints;
      // 5 user messages, no /clear → single medium segment
      expect(hints.mediumSessions).toBe(1);
      expect(hints.shortSessions).toBe(0);
      expect(hints.longSessions).toBe(0);
    });

    it('should detect <command-name>/clear</command-name> tag format', async () => {
      const userContents = [
        'msg1', 'msg2',
        '<command-name>/clear</command-name>',
        'msg3', 'msg4',
      ];
      const session = createChatSession(userContents);
      const context = createContext([session]);
      const result = await worker.execute(context);

      expect(result.error).toBeUndefined();
      const hints = result.data.sessionMetrics.sessionHints;
      // 2 segments: [msg1, msg2] and [msg3, msg4] → both short
      expect(hints.shortSessions).toBe(2);
    });

    it('should apply excessive iteration threshold per segment', async () => {
      // Segment 1: 12 user messages (excessive), Segment 2: 5 user messages (not excessive)
      const userContents: string[] = [];
      for (let i = 0; i < 12; i++) userContents.push(`long task msg ${i}`);
      userContents.push('/clear');
      for (let i = 0; i < 5; i++) userContents.push(`short task msg ${i}`);

      const session = createChatSession(userContents);
      const context = createContext([session]);
      const result = await worker.execute(context);

      expect(result.error).toBeUndefined();
      const friction = result.data.sessionMetrics.frictionSignals;
      // Only segment 1 has 12 user messages (>=10), segment 2 has 5
      expect(friction.excessiveIterationSessions).toBe(1);

      const hints = result.data.sessionMetrics.sessionHints;
      expect(hints.longSessions).toBe(1);   // 12 messages → long
      expect(hints.mediumSessions).toBe(1);  // 5 messages → medium
    });

    it('should handle consecutive /clear commands', async () => {
      const userContents = [
        'msg1', 'msg2',
        '/clear',
        '/clear',
        'msg3',
      ];
      const session = createChatSession(userContents);
      const context = createContext([session]);
      const result = await worker.execute(context);

      expect(result.error).toBeUndefined();
      const hints = result.data.sessionMetrics.sessionHints;
      // 3 segments: [msg1,msg2], [assistant-only from between clears], [msg3]
      // The middle segment has 0 user messages → short (<=3).
      // All 3 segments count as short.
      expect(hints.shortSessions).toBe(3);
      expect(hints.mediumSessions).toBe(0);
    });

    it('should compute avgTurnsPerSession using segment count as denominator', async () => {
      // 1 physical session, but 2 logical segments
      const userContents = [
        'msg1', 'msg2', 'msg3', 'msg4',  // 4 user messages
        '/clear',
        'msg5', 'msg6',  // 2 user messages
      ];
      const session = createChatSession(userContents);
      const context = createContext([session]);
      const result = await worker.execute(context);

      expect(result.error).toBeUndefined();
      const hints = result.data.sessionMetrics.sessionHints;
      // Total 6 user turns / 2 segments = 3.0
      expect(hints.avgTurnsPerSession).toBe(3);
    });
  });

  describe('LLM-based system metadata filtering', () => {
    /**
     * Helper to create a long text that exceeds the LLM filter threshold (100 chars)
     */
    function createLongText(base: string, minLength: number = 150): string {
      const padding = ' This is additional context to make the message longer.';
      let result = base;
      while (result.length < minLength) {
        result += padding;
      }
      return result;
    }

    it('should filter skill documentation blocks via LLM classification', async () => {
      // Mock LLM to classify skill documentation as system metadata
      const mockGenerateStructured = vi.fn().mockResolvedValue({
        data: {
          classifications: [
            { classification: 'system', confidence: 0.95, reason: 'Skill documentation' },
            { classification: 'developer', confidence: 0.9, reason: 'User request' },
          ],
        },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      vi.spyOn(geminiClientModule, 'GeminiClient').mockImplementation(() => ({
        generateStructured: mockGenerateStructured,
      }) as unknown as geminiClientModule.GeminiClient);

      const session = createSession([
        'Base directory for this skill: /Users/test/.claude/skills/my-skill ' + 'x'.repeat(100),  // Make long enough for LLM
        'Can you help me with this bug? ' + 'x'.repeat(100),  // Make long enough for LLM
      ]);
      const context = createContext([session]);

      const testWorker = new DataExtractorWorker();
      const result = await testWorker.execute(context);
      expect(result.error).toBeUndefined();
      // Skill documentation should be filtered out (LLM classified as system)
      expect(result.data.developerUtterances.length).toBe(1);
      expect(result.data.developerUtterances[0]?.text).toContain('Can you help me with this bug');

      vi.restoreAllMocks();
    });

    it('should filter session continuation summaries via LLM classification', async () => {
      // Mock LLM to classify session continuation as system metadata
      const mockGenerateStructured = vi.fn().mockResolvedValue({
        data: {
          classifications: [
            { classification: 'system', confidence: 0.95, reason: 'Session continuation summary' },
            { classification: 'developer', confidence: 0.9, reason: 'User request' },
          ],
        },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      vi.spyOn(geminiClientModule, 'GeminiClient').mockImplementation(() => ({
        generateStructured: mockGenerateStructured,
      }) as unknown as geminiClientModule.GeminiClient);

      const session = createSession([
        'This session is being continued from a previous conversation. Here is a summary of the work done so far... ' + 'x'.repeat(100),
        'Please continue with the implementation. ' + 'x'.repeat(100),
      ]);
      const context = createContext([session]);

      const testWorker = new DataExtractorWorker();
      const result = await testWorker.execute(context);
      expect(result.error).toBeUndefined();
      // Session continuation should be filtered out (LLM classified as system)
      expect(result.data.developerUtterances.length).toBe(1);
      expect(result.data.developerUtterances[0]?.text).toContain('Please continue with the implementation');

      vi.restoreAllMocks();
    });

    it('should filter plan execution prompts via LLM classification', async () => {
      // Mock LLM to classify plan execution prompt as system metadata
      const mockGenerateStructured = vi.fn().mockResolvedValue({
        data: {
          classifications: [
            { classification: 'system', confidence: 0.95, reason: 'Plan execution prompt' },
            { classification: 'developer', confidence: 0.9, reason: 'User request' },
          ],
        },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      vi.spyOn(geminiClientModule, 'GeminiClient').mockImplementation(() => ({
        generateStructured: mockGenerateStructured,
      }) as unknown as geminiClientModule.GeminiClient);

      const session = createSession([
        'Implement the following plan: # My Plan ## Step 1 Do something... ' + 'x'.repeat(100),
        'Can you add error handling? ' + 'x'.repeat(100),
      ]);
      const context = createContext([session]);

      const testWorker = new DataExtractorWorker();
      const result = await testWorker.execute(context);
      expect(result.error).toBeUndefined();
      // Plan execution prompt should be filtered out (LLM classified as system)
      expect(result.data.developerUtterances.length).toBe(1);
      expect(result.data.developerUtterances[0]?.text).toContain('Can you add error handling');

      vi.restoreAllMocks();
    });

    it('should skip LLM classification for short utterances', async () => {
      // Short messages (< 100 chars) should pass through without LLM call
      const session = createSession([
        'Fix the bug', // Short - no LLM needed
        'Add tests',   // Short - no LLM needed
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      expect(result.data.developerUtterances.length).toBe(2);
    });

    it('should use LLM to classify long utterances when API is available', async () => {
      // Mock the GeminiClient to simulate LLM classification
      const mockGenerateStructured = vi.fn().mockResolvedValue({
        data: {
          classifications: [
            { classification: 'system', confidence: 0.95, reason: 'Skill documentation' },
            { classification: 'developer', confidence: 0.9, reason: 'User request' },
          ],
        },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      vi.spyOn(geminiClientModule, 'GeminiClient').mockImplementation(() => ({
        generateStructured: mockGenerateStructured,
      }) as unknown as geminiClientModule.GeminiClient);

      const longSystemMetadata = createLongText(
        'This is some skill documentation that explains how to use the feature.'
      );
      const longDeveloperInput = createLongText(
        'Can you help me implement the authentication system?'
      );

      const session = createSession([
        longSystemMetadata,
        longDeveloperInput,
      ]);
      const context = createContext([session]);

      const testWorker = new DataExtractorWorker();
      const result = await testWorker.execute(context);

      expect(result.error).toBeUndefined();
      // LLM should have been called for the long utterances
      expect(mockGenerateStructured).toHaveBeenCalledTimes(1);
      // First utterance (system) should be filtered, second (developer) should remain
      expect(result.data.developerUtterances.length).toBe(1);
      expect(result.data.developerUtterances[0]?.text).toContain('authentication system');

      vi.restoreAllMocks();
    });

    it('should keep utterances when LLM classification fails', async () => {
      // Mock LLM failure
      vi.spyOn(geminiClientModule, 'GeminiClient').mockImplementation(() => ({
        generateStructured: vi.fn().mockRejectedValue(new Error('API error')),
      }) as unknown as geminiClientModule.GeminiClient);

      const longText = createLongText('This is a long developer message about implementing features.');

      const session = createSession([longText]);
      const context = createContext([session]);

      const testWorker = new DataExtractorWorker();
      const result = await testWorker.execute(context);

      expect(result.error).toBeUndefined();
      // On LLM failure, utterances should be kept (conservative approach)
      expect(result.data.developerUtterances.length).toBe(1);

      vi.restoreAllMocks();
    });

    it('should only filter system content with high confidence', async () => {
      // Mock LLM returning low confidence system classification
      const mockGenerateStructured = vi.fn().mockResolvedValue({
        data: {
          classifications: [
            // Low confidence - should NOT be filtered
            { classification: 'system', confidence: 0.5, reason: 'Uncertain' },
          ],
        },
        usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75 },
      });

      vi.spyOn(geminiClientModule, 'GeminiClient').mockImplementation(() => ({
        generateStructured: mockGenerateStructured,
      }) as unknown as geminiClientModule.GeminiClient);

      const ambiguousText = createLongText(
        'The system configuration requires specific setup steps.'
      );

      const session = createSession([ambiguousText]);
      const context = createContext([session]);

      const testWorker = new DataExtractorWorker();
      const result = await testWorker.execute(context);

      expect(result.error).toBeUndefined();
      // Low confidence system classification should keep the utterance
      expect(result.data.developerUtterances.length).toBe(1);

      vi.restoreAllMocks();
    });

    it('should detect frustration expressions in user messages', async () => {
      const session = createSession([
        'same error again, still not working',
        'Help me fix the login',
      ]);
      const context = createContext([session]);
      const result = await worker.execute(context);

      expect(result.error).toBeUndefined();
      const friction = result.data.sessionMetrics.frictionSignals;
      // "same error" or "again" or "still not working" → at least 1 match
      expect(friction.frustrationExpressionCount).toBeGreaterThanOrEqual(1);
    });

    it('should count max 1 frustration expression per message', async () => {
      // One message with multiple frustration patterns
      const session = createSession([
        'frustrated again, same error, still broken, why is this not working',
      ]);
      const context = createContext([session]);
      const result = await worker.execute(context);

      expect(result.error).toBeUndefined();
      const friction = result.data.sessionMetrics.frictionSignals;
      // Only 1 message, so max 1 count even though multiple patterns match
      expect(friction.frustrationExpressionCount).toBe(1);
    });

    it('should detect bare retry after error', async () => {
      // This test uses direct worker execution which computes friction from raw sessions + utterances
      // We need user messages with precedingAIHadError context
      const messages: ParsedMessage[] = [
        // First: user asks something
        { role: 'user', content: 'Fix the build', timestamp: new Date(), toolCalls: [] },
        // AI responds with an error
        {
          role: 'assistant',
          content: 'Error: build failed',
          timestamp: new Date(),
          toolCalls: [{ name: 'Bash', input: 'npm run build', result: 'Error: Cannot find module', isError: true }],
        },
        // User gives bare retry (short, no analysis)
        { role: 'user', content: 'try again', timestamp: new Date(), toolCalls: [] },
        // AI responds with another error
        {
          role: 'assistant',
          content: 'Error: still failing',
          timestamp: new Date(),
          toolCalls: [{ name: 'Bash', input: 'npm run build', result: 'Error: Cannot find module', isError: true }],
        },
        // User gives another bare retry
        { role: 'user', content: 'fix it', timestamp: new Date(), toolCalls: [] },
      ];

      const session: ParsedSession = {
        sessionId: 'test-bare-retry',
        projectPath: '/test/project',
        messages,
        messageCount: messages.length,
        durationSeconds: 60,
      };
      const context = createContext([session]);
      const result = await worker.execute(context);

      expect(result.error).toBeUndefined();
      const friction = result.data.sessionMetrics.frictionSignals;
      // "try again" and "fix it" are both bare retries after errors
      expect(friction.bareRetryAfterErrorCount).toBeGreaterThanOrEqual(2);
    });

    it('should compute error chain max length from consecutive errors', async () => {
      const messages: ParsedMessage[] = [
        { role: 'user', content: 'Build the project', timestamp: new Date(), toolCalls: [] },
        {
          role: 'assistant', content: 'Error occurred',
          timestamp: new Date(),
          toolCalls: [{ name: 'Bash', input: 'build', result: 'Error: fail 1', isError: true }],
        },
        { role: 'user', content: 'try again please', timestamp: new Date(), toolCalls: [] },
        {
          role: 'assistant', content: 'Error occurred again',
          timestamp: new Date(),
          toolCalls: [{ name: 'Bash', input: 'build', result: 'Error: fail 2', isError: true }],
        },
        { role: 'user', content: 'one more time', timestamp: new Date(), toolCalls: [] },
        {
          role: 'assistant', content: 'Still failing',
          timestamp: new Date(),
          toolCalls: [{ name: 'Bash', input: 'build', result: 'Error: fail 3', isError: true }],
        },
        { role: 'user', content: 'ok what about this approach instead?', timestamp: new Date(), toolCalls: [] },
        // No error this time
        { role: 'assistant', content: 'Success!', timestamp: new Date(), toolCalls: [] },
        { role: 'user', content: 'great', timestamp: new Date(), toolCalls: [] },
      ];

      const session: ParsedSession = {
        sessionId: 'test-error-chain',
        projectPath: '/test/project',
        messages,
        messageCount: messages.length,
        durationSeconds: 120,
      };
      const context = createContext([session]);
      const result = await worker.execute(context);

      expect(result.error).toBeUndefined();
      const friction = result.data.sessionMetrics.frictionSignals;
      // 3 consecutive error turns: try again, one more time, ok what about...
      expect(friction.errorChainMaxLength).toBeGreaterThanOrEqual(3);
    });

    it('should detect repeated tool error patterns', async () => {
      const messages: ParsedMessage[] = [
        { role: 'user', content: 'Run the tests', timestamp: new Date(), toolCalls: [] },
        {
          role: 'assistant', content: 'Running...',
          timestamp: new Date(),
          toolCalls: [
            { name: 'Bash', input: 'npm test', result: 'Error: Cannot find module at /src/foo.ts:42:10', isError: true },
          ],
        },
        { role: 'user', content: 'Try running again', timestamp: new Date(), toolCalls: [] },
        {
          role: 'assistant', content: 'Running...',
          timestamp: new Date(),
          toolCalls: [
            // Same error type, different file path → should be same fingerprint
            { name: 'Bash', input: 'npm test', result: 'Error: Cannot find module at /src/bar.ts:99:5', isError: true },
          ],
        },
        { role: 'user', content: 'And again', timestamp: new Date(), toolCalls: [] },
        {
          role: 'assistant', content: 'Running...',
          timestamp: new Date(),
          toolCalls: [
            // Different error type
            { name: 'Bash', input: 'npm test', result: 'TypeError: undefined is not a function', isError: true },
          ],
        },
      ];

      const session: ParsedSession = {
        sessionId: 'test-repeated-errors',
        projectPath: '/test/project',
        messages,
        messageCount: messages.length,
        durationSeconds: 60,
      };
      const context = createContext([session]);
      const result = await worker.execute(context);

      expect(result.error).toBeUndefined();
      const friction = result.data.sessionMetrics.frictionSignals;
      // "Cannot find module" appeared 2x with different paths → 1 repeated pattern
      expect(friction.repeatedToolErrorPatterns).toBeGreaterThanOrEqual(1);
    });

    it('should report zero for new friction signals when no patterns present', async () => {
      const session = createSession([
        'Help me write a function',
        'Add error handling please',
      ]);
      const context = createContext([session]);
      const result = await worker.execute(context);

      expect(result.error).toBeUndefined();
      const friction = result.data.sessionMetrics.frictionSignals;
      expect(friction.frustrationExpressionCount).toBe(0);
      expect(friction.repeatedToolErrorPatterns).toBe(0);
      expect(friction.bareRetryAfterErrorCount).toBe(0);
      expect(friction.errorChainMaxLength).toBe(0);
    });

    it('should accumulate token usage from LLM filtering', async () => {
      const mockGenerateStructured = vi.fn().mockResolvedValue({
        data: {
          classifications: [
            { classification: 'developer', confidence: 0.9, reason: 'User request' },
          ],
        },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      vi.spyOn(geminiClientModule, 'GeminiClient').mockImplementation(() => ({
        generateStructured: mockGenerateStructured,
      }) as unknown as geminiClientModule.GeminiClient);

      const longText = createLongText('Help me implement this feature please.');

      const session = createSession([longText]);
      const context = createContext([session]);

      const testWorker = new DataExtractorWorker();
      const result = await testWorker.execute(context);

      expect(result.error).toBeUndefined();
      // Token usage should be reported
      expect(result.usage).toBeDefined();
      expect(result.usage?.totalTokens).toBe(150);

      vi.restoreAllMocks();
    });
  });
});
