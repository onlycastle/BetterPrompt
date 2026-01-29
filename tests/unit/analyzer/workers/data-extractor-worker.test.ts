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

    it('should filter skill documentation blocks via regex pre-filter', async () => {
      const session = createSession([
        'Base directory for this skill: /Users/test/.claude/skills/my-skill',
        'Can you help me with this bug?',
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      // Skill documentation should be filtered out
      expect(result.data.developerUtterances.length).toBe(1);
      expect(result.data.developerUtterances[0]?.text).toBe('Can you help me with this bug?');
    });

    it('should filter session continuation summaries via regex pre-filter', async () => {
      const session = createSession([
        'This session is being continued from a previous conversation. Here is a summary of the work done so far...',
        'Please continue with the implementation.',
      ]);
      const context = createContext([session]);

      const result = await worker.execute(context);
      expect(result.error).toBeUndefined();
      // Session continuation should be filtered out
      expect(result.data.developerUtterances.length).toBe(1);
      expect(result.data.developerUtterances[0]?.text).toBe('Please continue with the implementation.');
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
