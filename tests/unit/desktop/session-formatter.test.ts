/**
 * Desktop Session Formatter Tests
 *
 * Tests for the JSONL parsing and formatting logic used by the desktop app.
 */

import { describe, it, expect } from 'vitest';
import {
  parseSessionContent,
  formatSessionsForAnalysis,
  countFormattedTokens,
  DATA_ANALYST_FORMAT,
  PERSONALITY_ANALYST_FORMAT,
  type ParsedSession,
} from '../../../packages/desktop/src/main/session-formatter.js';

describe('Session Formatter', () => {
  describe('parseSessionContent', () => {
    it('should parse valid JSONL content into ParsedSession', () => {
      const content = `
{"type":"user","uuid":"u1","timestamp":"2024-01-15T10:00:00Z","message":{"content":"Help me fix this bug"}}
{"type":"assistant","uuid":"a1","timestamp":"2024-01-15T10:00:05Z","message":{"content":"I'll help you with that bug.","usage":{"input_tokens":100,"output_tokens":50}}}
{"type":"user","uuid":"u2","timestamp":"2024-01-15T10:00:30Z","message":{"content":"Thanks, that worked!"}}
      `.trim();

      const result = parseSessionContent('test-session', '/test/path', 'test-project', content);

      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe('test-session');
      expect(result!.projectPath).toBe('/test/path');
      expect(result!.projectName).toBe('test-project');
      expect(result!.messages).toHaveLength(3);
      expect(result!.stats.userMessageCount).toBe(2);
      expect(result!.stats.assistantMessageCount).toBe(1);
    });

    it('should return null for empty content', () => {
      const result = parseSessionContent('test', '/path', 'project', '');
      expect(result).toBeNull();
    });

    it('should return null for content with no valid messages', () => {
      const content = `
{"type":"queue-operation","uuid":"q1","timestamp":"2024-01-15T10:00:00Z"}
{"type":"file-history-snapshot","uuid":"f1","timestamp":"2024-01-15T10:00:01Z"}
      `.trim();

      const result = parseSessionContent('test', '/path', 'project', content);
      expect(result).toBeNull();
    });

    it('should parse messages with content blocks array', () => {
      const content = `
{"type":"user","uuid":"u1","timestamp":"2024-01-15T10:00:00Z","message":{"content":[{"type":"text","text":"Hello Claude"}]}}
{"type":"assistant","uuid":"a1","timestamp":"2024-01-15T10:00:05Z","message":{"content":[{"type":"text","text":"Hello! How can I help?"}]}}
      `.trim();

      const result = parseSessionContent('test', '/path', 'project', content);

      expect(result).not.toBeNull();
      expect(result!.messages[0].content).toBe('Hello Claude');
      expect(result!.messages[1].content).toBe('Hello! How can I help?');
    });

    it('should extract tool calls from assistant messages', () => {
      const content = `
{"type":"user","uuid":"u1","timestamp":"2024-01-15T10:00:00Z","message":{"content":"Read the file"}}
{"type":"assistant","uuid":"a1","timestamp":"2024-01-15T10:00:05Z","message":{"content":[{"type":"text","text":"Let me read it"},{"type":"tool_use","id":"tool1","name":"Read","input":{"file_path":"/test.ts"}}]}}
{"type":"user","uuid":"u2","timestamp":"2024-01-15T10:00:10Z","message":{"content":[{"type":"tool_result","tool_use_id":"tool1","content":"file contents here"}]}}
      `.trim();

      const result = parseSessionContent('test', '/path', 'project', content);

      expect(result).not.toBeNull();
      const assistantMsg = result!.messages.find((m) => m.role === 'assistant');
      expect(assistantMsg?.toolCalls).toBeDefined();
      expect(assistantMsg!.toolCalls![0].name).toBe('Read');
      expect(assistantMsg!.toolCalls![0].result).toBe('file contents here');
    });

    it('should calculate session duration correctly', () => {
      const content = `
{"type":"user","uuid":"u1","timestamp":"2024-01-15T10:00:00Z","message":{"content":"Start"}}
{"type":"assistant","uuid":"a1","timestamp":"2024-01-15T10:05:00Z","message":{"content":"End"}}
      `.trim();

      const result = parseSessionContent('test', '/path', 'project', content);

      expect(result).not.toBeNull();
      expect(result!.durationSeconds).toBe(300); // 5 minutes
    });

    it('should compute stats correctly', () => {
      const content = `
{"type":"user","uuid":"u1","timestamp":"2024-01-15T10:00:00Z","message":{"content":"First"}}
{"type":"assistant","uuid":"a1","timestamp":"2024-01-15T10:00:01Z","message":{"content":[{"type":"text","text":"Response"},{"type":"tool_use","id":"t1","name":"Read","input":{}}],"usage":{"input_tokens":100,"output_tokens":50}}}
{"type":"user","uuid":"u2","timestamp":"2024-01-15T10:00:02Z","message":{"content":"Second"}}
{"type":"assistant","uuid":"a2","timestamp":"2024-01-15T10:00:03Z","message":{"content":[{"type":"text","text":"Another"},{"type":"tool_use","id":"t2","name":"Write","input":{}}],"usage":{"input_tokens":150,"output_tokens":75}}}
{"type":"user","uuid":"u3","timestamp":"2024-01-15T10:00:04Z","message":{"content":"Third"}}
      `.trim();

      const result = parseSessionContent('test', '/path', 'project', content);

      expect(result).not.toBeNull();
      expect(result!.stats.userMessageCount).toBe(3);
      expect(result!.stats.assistantMessageCount).toBe(2);
      expect(result!.stats.toolCallCount).toBe(2);
      expect(result!.stats.uniqueToolsUsed).toEqual(['Read', 'Write']);
      expect(result!.stats.totalInputTokens).toBe(250);
      expect(result!.stats.totalOutputTokens).toBe(125);
    });

    it('should skip empty user messages', () => {
      const content = `
{"type":"user","uuid":"u1","timestamp":"2024-01-15T10:00:00Z","message":{"content":""}}
{"type":"user","uuid":"u2","timestamp":"2024-01-15T10:00:01Z","message":{"content":"  "}}
{"type":"user","uuid":"u3","timestamp":"2024-01-15T10:00:02Z","message":{"content":"Valid message"}}
      `.trim();

      const result = parseSessionContent('test', '/path', 'project', content);

      expect(result).not.toBeNull();
      expect(result!.messages).toHaveLength(1);
      expect(result!.messages[0].content).toBe('Valid message');
    });

    it('should handle malformed JSON lines gracefully', () => {
      const content = `
{"type":"user","uuid":"u1","timestamp":"2024-01-15T10:00:00Z","message":{"content":"Valid"}}
{invalid json here}
{"type":"assistant","uuid":"a1","timestamp":"2024-01-15T10:00:05Z","message":{"content":"Also valid"}}
      `.trim();

      const result = parseSessionContent('test', '/path', 'project', content);

      expect(result).not.toBeNull();
      expect(result!.messages).toHaveLength(2);
    });
  });

  describe('formatSessionsForAnalysis', () => {
    const createMockSession = (overrides: Partial<ParsedSession> = {}): ParsedSession => ({
      sessionId: 'test-session',
      projectPath: '/test/path',
      projectName: 'test-project',
      startTime: new Date('2024-01-15T10:00:00Z'),
      endTime: new Date('2024-01-15T10:30:00Z'),
      durationSeconds: 1800,
      claudeCodeVersion: '1.0.0',
      messages: [
        {
          uuid: 'u1',
          role: 'user',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          content: 'Hello, help me with this code',
        },
        {
          uuid: 'a1',
          role: 'assistant',
          timestamp: new Date('2024-01-15T10:00:05Z'),
          content: 'I will help you with that',
          toolCalls: [{ id: 't1', name: 'Read', input: { file_path: '/test.ts' } }],
        },
      ],
      stats: {
        userMessageCount: 1,
        assistantMessageCount: 1,
        toolCallCount: 1,
        uniqueToolsUsed: ['Read'],
        totalInputTokens: 100,
        totalOutputTokens: 50,
      },
      ...overrides,
    });

    it('should format sessions with DATA_ANALYST_FORMAT', () => {
      const session = createMockSession();
      const formatted = formatSessionsForAnalysis([session], DATA_ANALYST_FORMAT);

      expect(formatted).toContain('<session index="1"');
      expect(formatted).toContain('duration_minutes="30"');
      expect(formatted).toContain('DEVELOPER:');
      expect(formatted).toContain('CLAUDE:');
      expect(formatted).toContain('[Tool: Read]');
    });

    it('should format sessions with PERSONALITY_ANALYST_FORMAT', () => {
      const session = createMockSession();
      const formatted = formatSessionsForAnalysis([session], PERSONALITY_ANALYST_FORMAT);

      expect(formatted).toContain('<session index="1"');
      expect(formatted).not.toContain('duration_minutes');
      expect(formatted).toContain('DEVELOPER:');
      // Assistant messages excluded
      expect(formatted).not.toContain('CLAUDE:');
      // Tool calls excluded
      expect(formatted).not.toContain('[Tool:');
    });

    it('should truncate long content', () => {
      const longContent = 'A'.repeat(3000);
      const session = createMockSession({
        messages: [
          {
            uuid: 'u1',
            role: 'user',
            timestamp: new Date(),
            content: longContent,
          },
        ],
      });

      const formatted = formatSessionsForAnalysis([session], DATA_ANALYST_FORMAT);

      expect(formatted).toContain('...[truncated]');
      expect(formatted.length).toBeLessThan(longContent.length);
    });

    it('should format multiple sessions with correct indices', () => {
      const session1 = createMockSession({ sessionId: 'session-1' });
      const session2 = createMockSession({
        sessionId: 'session-2',
        startTime: new Date('2024-01-16T10:00:00Z'),
      });

      const formatted = formatSessionsForAnalysis([session1, session2], DATA_ANALYST_FORMAT);

      expect(formatted).toContain('index="1"');
      expect(formatted).toContain('index="2"');
      expect(formatted).toContain('date="2024-01-15"');
      expect(formatted).toContain('date="2024-01-16"');
    });
  });

  describe('countFormattedTokens', () => {
    const createMockSession = (content: string): ParsedSession => ({
      sessionId: 'test',
      projectPath: '/path',
      projectName: 'project',
      startTime: new Date(),
      endTime: new Date(),
      durationSeconds: 60,
      claudeCodeVersion: '1.0.0',
      messages: [
        {
          uuid: 'u1',
          role: 'user',
          timestamp: new Date(),
          content,
        },
      ],
      stats: {
        userMessageCount: 1,
        assistantMessageCount: 0,
        toolCallCount: 0,
        uniqueToolsUsed: [],
        totalInputTokens: 0,
        totalOutputTokens: 0,
      },
    });

    it('should estimate token count for formatted sessions', () => {
      const session = createMockSession('Hello world, this is a test message');
      const tokenCount = countFormattedTokens([session], DATA_ANALYST_FORMAT);

      expect(tokenCount).toBeGreaterThan(0);
    });

    it('should add overhead for code blocks', () => {
      const plainSession = createMockSession('Here is some text without code');
      const codeSession = createMockSession('Here is code:\n```js\nconsole.log("hi");\n```');

      const plainTokens = countFormattedTokens([plainSession], DATA_ANALYST_FORMAT);
      const codeTokens = countFormattedTokens([codeSession], DATA_ANALYST_FORMAT);

      expect(codeTokens).toBeGreaterThan(plainTokens);
    });

    it('should scale with content length', () => {
      const shortSession = createMockSession('Short');
      const longSession = createMockSession('A'.repeat(1000));

      const shortTokens = countFormattedTokens([shortSession], DATA_ANALYST_FORMAT);
      const longTokens = countFormattedTokens([longSession], DATA_ANALYST_FORMAT);

      expect(longTokens).toBeGreaterThan(shortTokens * 5);
    });
  });

  describe('Format Options', () => {
    it('DATA_ANALYST_FORMAT should have correct settings', () => {
      expect(DATA_ANALYST_FORMAT.maxContentLength).toBe(2000);
      expect(DATA_ANALYST_FORMAT.includeAssistantMessages).toBe(true);
      expect(DATA_ANALYST_FORMAT.includeToolCalls).toBe(true);
      expect(DATA_ANALYST_FORMAT.includeDuration).toBe(true);
    });

    it('PERSONALITY_ANALYST_FORMAT should have correct settings', () => {
      expect(PERSONALITY_ANALYST_FORMAT.maxContentLength).toBe(1500);
      expect(PERSONALITY_ANALYST_FORMAT.includeAssistantMessages).toBe(false);
      expect(PERSONALITY_ANALYST_FORMAT.includeToolCalls).toBe(false);
      expect(PERSONALITY_ANALYST_FORMAT.includeDuration).toBe(false);
    });
  });
});
