import { describe, it, expect } from 'vitest';
import {
  TextBlockSchema,
  ToolUseBlockSchema,
  ToolResultBlockSchema,
  ContentBlockSchema,
  TokenUsageSchema,
  UserMessageSchema,
  AssistantMessageSchema,
  JSONLLineSchema,
  isConversationMessage,
  isTextBlock,
  isToolUseBlock,
  isToolResultBlock,
} from '../../../src/models/session.js';

describe('Session Models', () => {
  describe('TextBlockSchema', () => {
    it('should validate valid text block', () => {
      const block = { type: 'text', text: 'Hello world' };
      const result = TextBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });

    it('should reject block with wrong type', () => {
      const block = { type: 'not_text', text: 'Hello' };
      const result = TextBlockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });

    it('should reject block missing text field', () => {
      const block = { type: 'text' };
      const result = TextBlockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });
  });

  describe('ToolUseBlockSchema', () => {
    it('should validate valid tool use block', () => {
      const block = {
        type: 'tool_use',
        id: 'tool-123',
        name: 'Read',
        input: { path: '/test/file.ts' },
      };
      const result = ToolUseBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });

    it('should accept empty input object', () => {
      const block = {
        type: 'tool_use',
        id: 'tool-123',
        name: 'Bash',
        input: {},
      };
      const result = ToolUseBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const block = { type: 'tool_use', id: 'tool-123' };
      const result = ToolUseBlockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });
  });

  describe('ToolResultBlockSchema', () => {
    it('should validate tool result with string content', () => {
      const block = {
        type: 'tool_result',
        tool_use_id: 'tool-123',
        content: 'Result text here',
      };
      const result = ToolResultBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });

    it('should validate tool result with array content', () => {
      const block = {
        type: 'tool_result',
        tool_use_id: 'tool-123',
        content: [{ type: 'text', text: 'Result' }],
      };
      const result = ToolResultBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });

    it('should validate tool result with is_error flag', () => {
      const block = {
        type: 'tool_result',
        tool_use_id: 'tool-123',
        content: 'Error occurred',
        is_error: true,
      };
      const result = ToolResultBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_error).toBe(true);
      }
    });
  });

  describe('ContentBlockSchema', () => {
    it('should accept text blocks', () => {
      const result = ContentBlockSchema.safeParse({ type: 'text', text: 'Hello' });
      expect(result.success).toBe(true);
    });

    it('should accept tool_use blocks', () => {
      const result = ContentBlockSchema.safeParse({
        type: 'tool_use',
        id: 'id',
        name: 'Read',
        input: {},
      });
      expect(result.success).toBe(true);
    });

    it('should accept tool_result blocks', () => {
      const result = ContentBlockSchema.safeParse({
        type: 'tool_result',
        tool_use_id: 'id',
        content: 'result',
      });
      expect(result.success).toBe(true);
    });

    it('should reject unknown block types', () => {
      const result = ContentBlockSchema.safeParse({
        type: 'unknown_type',
        data: {},
      });
      expect(result.success).toBe(false);
    });
  });

  describe('TokenUsageSchema', () => {
    it('should validate minimal token usage', () => {
      const usage = {
        input_tokens: 100,
        output_tokens: 50,
      };
      const result = TokenUsageSchema.safeParse(usage);
      expect(result.success).toBe(true);
    });

    it('should validate full token usage with cache', () => {
      const usage = {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 200,
        cache_creation: {
          ephemeral_5m_input_tokens: 50,
          ephemeral_1h_input_tokens: 150,
        },
        service_tier: 'anthropic-api',
      };
      const result = TokenUsageSchema.safeParse(usage);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const usage = { input_tokens: 100 };
      const result = TokenUsageSchema.safeParse(usage);
      expect(result.success).toBe(false);
    });
  });

  describe('UserMessageSchema', () => {
    it('should validate valid user message', () => {
      const message = {
        type: 'user',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00.000Z',
        uuid: 'msg-123',
        parentUuid: null,
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Hello Claude' }],
        },
      };
      const result = UserMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should accept string content in user message', () => {
      const message = {
        type: 'user',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00.000Z',
        uuid: 'msg-123',
        parentUuid: null,
        message: {
          role: 'user',
          content: 'Hello Claude',
        },
      };
      const result = UserMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should accept optional fields', () => {
      const message = {
        type: 'user',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00.000Z',
        uuid: 'msg-123',
        parentUuid: 'parent-123',
        cwd: '/Users/dev/project',
        version: '1.0.0',
        gitBranch: 'main',
        userType: 'developer',
        isSidechain: false,
        message: {
          role: 'user',
          content: 'Test',
        },
      };
      const result = UserMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });
  });

  describe('AssistantMessageSchema', () => {
    it('should validate valid assistant message', () => {
      const message = {
        type: 'assistant',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00.000Z',
        uuid: 'msg-456',
        parentUuid: 'msg-123',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello! How can I help?' }],
        },
      };
      const result = AssistantMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate assistant message with tool calls', () => {
      const message = {
        type: 'assistant',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00.000Z',
        uuid: 'msg-456',
        parentUuid: 'msg-123',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me read that file' },
            { type: 'tool_use', id: 'tool-1', name: 'Read', input: { path: '/test.ts' } },
          ],
        },
      };
      const result = AssistantMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate assistant message with usage info', () => {
      const message = {
        type: 'assistant',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00.000Z',
        uuid: 'msg-456',
        parentUuid: 'msg-123',
        message: {
          role: 'assistant',
          model: 'claude-3-sonnet',
          id: 'response-123',
          type: 'message',
          content: [{ type: 'text', text: 'Response' }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 100,
            output_tokens: 50,
          },
        },
      };
      const result = AssistantMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });
  });

  describe('JSONLLineSchema', () => {
    it('should accept user messages', () => {
      const message = {
        type: 'user',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00.000Z',
        uuid: 'msg-123',
        parentUuid: null,
        message: { role: 'user', content: 'Hello' },
      };
      const result = JSONLLineSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should accept assistant messages', () => {
      const message = {
        type: 'assistant',
        sessionId: 'session-123',
        timestamp: '2024-01-01T00:00:00.000Z',
        uuid: 'msg-456',
        parentUuid: 'msg-123',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hi' }],
        },
      };
      const result = JSONLLineSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should accept queue-operation', () => {
      const operation = {
        type: 'queue-operation',
        operation: 'dequeue',
        timestamp: '2024-01-01T00:00:00.000Z',
        sessionId: 'session-123',
      };
      const result = JSONLLineSchema.safeParse(operation);
      expect(result.success).toBe(true);
    });

    it('should accept file-history-snapshot', () => {
      const snapshot = {
        type: 'file-history-snapshot',
        messageId: 'msg-123',
        isSnapshotUpdate: true,
        snapshot: {
          messageId: 'msg-123',
          trackedFileBackups: {},
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      };
      const result = JSONLLineSchema.safeParse(snapshot);
      expect(result.success).toBe(true);
    });
  });

  describe('Type Guards', () => {
    describe('isConversationMessage', () => {
      it('should return true for user messages', () => {
        const message = {
          type: 'user' as const,
          sessionId: 'session-123',
          timestamp: '2024-01-01T00:00:00.000Z',
          uuid: 'msg-123',
          parentUuid: null,
          message: { role: 'user' as const, content: 'Hello' },
        };
        expect(isConversationMessage(message)).toBe(true);
      });

      it('should return true for assistant messages', () => {
        const message = {
          type: 'assistant' as const,
          sessionId: 'session-123',
          timestamp: '2024-01-01T00:00:00.000Z',
          uuid: 'msg-456',
          parentUuid: 'msg-123',
          message: {
            role: 'assistant' as const,
            content: [{ type: 'text' as const, text: 'Hi' }],
          },
        };
        expect(isConversationMessage(message)).toBe(true);
      });

      it('should return false for queue-operation', () => {
        const operation = {
          type: 'queue-operation' as const,
          operation: 'dequeue' as const,
          timestamp: '2024-01-01T00:00:00.000Z',
          sessionId: 'session-123',
        };
        expect(isConversationMessage(operation)).toBe(false);
      });
    });

    describe('isTextBlock', () => {
      it('should return true for text blocks', () => {
        expect(isTextBlock({ type: 'text', text: 'Hello' })).toBe(true);
      });

      it('should return false for tool_use blocks', () => {
        expect(isTextBlock({ type: 'tool_use', id: '1', name: 'Read', input: {} })).toBe(false);
      });
    });

    describe('isToolUseBlock', () => {
      it('should return true for tool_use blocks', () => {
        expect(isToolUseBlock({ type: 'tool_use', id: '1', name: 'Read', input: {} })).toBe(true);
      });

      it('should return false for text blocks', () => {
        expect(isToolUseBlock({ type: 'text', text: 'Hello' })).toBe(false);
      });
    });

    describe('isToolResultBlock', () => {
      it('should return true for tool_result blocks', () => {
        expect(
          isToolResultBlock({ type: 'tool_result', tool_use_id: '1', content: 'result' })
        ).toBe(true);
      });

      it('should return false for text blocks', () => {
        expect(isToolResultBlock({ type: 'text', text: 'Hello' })).toBe(false);
      });
    });
  });
});
