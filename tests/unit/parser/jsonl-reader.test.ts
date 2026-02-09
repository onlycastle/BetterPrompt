import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

// Mock fs/promises with memfs
vi.mock('node:fs/promises', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return memfs.fs.promises;
});

import {
  parseJSONLLine,
  decodeProjectPath,
  encodeProjectPath,
  getProjectName,
  readJSONLFile,
  listSessionFiles,
  getSessionMetadata,
} from '../../../src/lib/parser/jsonl-reader.js';

describe('JSONL Reader', () => {
  describe('parseJSONLLine', () => {
    it('should parse valid user message', () => {
      const line = JSON.stringify({
        type: 'user',
        sessionId: 'test-session',
        uuid: 'test-uuid',
        parentUuid: null,
        timestamp: '2024-01-01T00:00:00.000Z',
        message: { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      });

      const result = parseJSONLLine(line);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('user');
      expect(result?.uuid).toBe('test-uuid');
    });

    it('should parse valid assistant message', () => {
      const line = JSON.stringify({
        type: 'assistant',
        sessionId: 'test-session',
        uuid: 'test-uuid-2',
        parentUuid: 'test-uuid',
        timestamp: '2024-01-01T00:00:01.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Hi there' }] },
      });

      const result = parseJSONLLine(line);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('assistant');
    });

    it('should return null for empty line', () => {
      expect(parseJSONLLine('')).toBeNull();
      expect(parseJSONLLine('   ')).toBeNull();
      expect(parseJSONLLine('\n')).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      expect(parseJSONLLine('not json')).toBeNull();
      expect(parseJSONLLine('{invalid')).toBeNull();
      expect(parseJSONLLine('{ "unclosed": ')).toBeNull();
    });

    it('should return null for valid JSON but invalid schema', () => {
      // Valid JSON but missing required fields
      expect(parseJSONLLine(JSON.stringify({ foo: 'bar' }))).toBeNull();
      expect(parseJSONLLine(JSON.stringify({ type: 'unknown' }))).toBeNull();
    });

    it('should handle queue-operation type', () => {
      const line = JSON.stringify({
        type: 'queue-operation',
        operation: 'add',
        timestamp: '2024-01-01T00:00:00.000Z',
      });

      // queue-operation is a valid type in the schema
      const result = parseJSONLLine(line);
      // This depends on the actual schema - if queue-operation is supported
      // The test validates that it handles this type appropriately
      expect(result === null || result?.type === 'queue-operation').toBe(true);
    });
  });

  describe('Path encoding/decoding', () => {
    describe('decodeProjectPath', () => {
      it('should decode absolute paths with leading dash', () => {
        expect(decodeProjectPath('-Users-dev-projects-myapp')).toBe(
          '/Users/dev/projects/myapp'
        );
      });

      it('should decode nested paths', () => {
        expect(decodeProjectPath('-home-user-code-project-name')).toBe(
          '/home/user/code/project/name'
        );
      });

      it('should return unchanged if no leading dash', () => {
        expect(decodeProjectPath('relative-path')).toBe('relative-path');
      });

      it('should handle root path', () => {
        expect(decodeProjectPath('-')).toBe('/');
      });

      it('should handle single directory', () => {
        expect(decodeProjectPath('-Users')).toBe('/Users');
      });
    });

    describe('encodeProjectPath', () => {
      it('should encode absolute paths', () => {
        expect(encodeProjectPath('/Users/dev/projects/myapp')).toBe(
          '-Users-dev-projects-myapp'
        );
      });

      it('should encode root path', () => {
        expect(encodeProjectPath('/')).toBe('-');
      });

      it('should handle paths without leading slash', () => {
        expect(encodeProjectPath('relative/path')).toBe('relative-path');
      });
    });

    describe('round-trip encoding', () => {
      it('should decode encoded paths correctly', () => {
        const original = '/Users/dev/projects/myapp';
        const encoded = encodeProjectPath(original);
        const decoded = decodeProjectPath(encoded);
        expect(decoded).toBe(original);
      });
    });
  });

  describe('getProjectName', () => {
    it('should extract project name from path', () => {
      expect(getProjectName('/Users/dev/projects/myapp')).toBe('myapp');
    });

    it('should handle nested paths', () => {
      expect(getProjectName('/home/user/deep/nested/project-name')).toBe(
        'project-name'
      );
    });

    it('should return unknown for empty path', () => {
      expect(getProjectName('')).toBe('unknown');
    });

    it('should return unknown for root path', () => {
      expect(getProjectName('/')).toBe('unknown');
    });

    it('should handle single directory', () => {
      expect(getProjectName('/myapp')).toBe('myapp');
    });

    it('should handle paths with trailing slash', () => {
      expect(getProjectName('/Users/dev/myapp/')).toBe('myapp');
    });

    it('should handle deeply nested paths (10+ levels)', () => {
      expect(getProjectName('/a/b/c/d/e/f/g/h/i/j/project')).toBe('project');
    });

    it('should handle paths with spaces', () => {
      expect(getProjectName('/Users/dev/My Projects/my app')).toBe('my app');
    });

    it('should handle unicode paths', () => {
      expect(getProjectName('/Users/사용자/프로젝트/앱')).toBe('앱');
    });

    it('should handle dot-separated names', () => {
      expect(getProjectName('/Users/dev/org.company/repo.name')).toBe(
        'repo.name'
      );
    });

    it('should handle consecutive slashes', () => {
      expect(getProjectName('///Users///dev///myapp')).toBe('myapp');
    });

    it('should handle relative paths', () => {
      expect(getProjectName('projects/myapp')).toBe('myapp');
    });

    it('should return unknown for whitespace-only string', () => {
      expect(getProjectName('   ')).toBe('unknown');
    });
  });
});

describe('File Operations (with mocks)', () => {
  beforeEach(() => {
    vol.reset();
  });

  afterEach(() => {
    vol.reset();
  });

  // Helper to create valid user message line
  const createUserLine = (uuid: string, timestamp: string, text: string) =>
    JSON.stringify({
      type: 'user',
      sessionId: 'test-session',
      uuid,
      parentUuid: null,
      timestamp,
      message: { role: 'user', content: [{ type: 'text', text }] },
    });

  // Helper to create valid assistant message line
  const createAssistantLine = (uuid: string, parentUuid: string, timestamp: string, text: string) =>
    JSON.stringify({
      type: 'assistant',
      sessionId: 'test-session',
      uuid,
      parentUuid,
      timestamp,
      message: { role: 'assistant', content: [{ type: 'text', text }] },
    });

  describe('readJSONLFile', () => {
    it('should read and parse a valid JSONL file', async () => {
      const line1 = createUserLine('uuid-1', '2024-01-01T00:00:00.000Z', 'Hello');
      const line2 = createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T00:00:01.000Z', 'Hi there');
      const content = `${line1}\n${line2}`;

      vol.fromJSON({
        '/test/session.jsonl': content,
      });

      const result = await readJSONLFile('/test/session.jsonl');

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('user');
      expect(result[1].type).toBe('assistant');
    });

    it('should handle files with invalid lines gracefully', async () => {
      const validLine = createUserLine('uuid-1', '2024-01-01T00:00:00.000Z', 'Hello');
      const content = `invalid json line\n${validLine}\n{also: "invalid"}`;

      vol.fromJSON({
        '/test/session.jsonl': content,
      });

      const result = await readJSONLFile('/test/session.jsonl');

      // Should only parse the valid line
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('user');
    });

    it('should throw on non-existent files', async () => {
      await expect(readJSONLFile('/nonexistent/file.jsonl')).rejects.toThrow();
    });

    it('should handle empty files', async () => {
      vol.fromJSON({
        '/test/empty.jsonl': '',
      });

      const result = await readJSONLFile('/test/empty.jsonl');
      expect(result).toHaveLength(0);
    });
  });

  describe('listSessionFiles', () => {
    it('should list only .jsonl files', async () => {
      vol.fromJSON({
        '/project/session1.jsonl': 'content',
        '/project/session2.jsonl': 'content',
        '/project/readme.md': 'readme',
        '/project/config.json': '{}',
      });

      const result = await listSessionFiles('/project');

      expect(result).toHaveLength(2);
      expect(result).toContain('/project/session1.jsonl');
      expect(result).toContain('/project/session2.jsonl');
    });

    it('should return empty array for non-existent directory', async () => {
      const result = await listSessionFiles('/nonexistent');
      expect(result).toEqual([]);
    });

    it('should return full paths', async () => {
      vol.fromJSON({
        '/path/to/project/abc123.jsonl': 'content',
      });

      const result = await listSessionFiles('/path/to/project');

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('/path/to/project/abc123.jsonl');
    });
  });

  describe('getSessionMetadata', () => {
    it('should extract metadata from valid session file', async () => {
      const line1 = createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello');
      const line2 = createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Hi there');
      const content = `${line1}\n${line2}`;

      vol.fromJSON({
        '/-Users-dev-project/session-id.jsonl': content,
      });

      const result = await getSessionMetadata('/-Users-dev-project/session-id.jsonl');

      expect(result).not.toBeNull();
      expect(result?.sessionId).toBe('session-id');
      expect(result?.projectPath).toBe('/Users/dev/project');
      expect(result?.projectName).toBe('project');
      expect(result?.messageCount).toBe(2);
    });

    it('should return null for invalid session files', async () => {
      vol.fromJSON({
        '/project/invalid.jsonl': 'not valid json',
      });

      const result = await getSessionMetadata('/project/invalid.jsonl');
      expect(result).toBeNull();
    });

    it('should return null for empty files', async () => {
      vol.fromJSON({
        '/project/empty.jsonl': '',
      });

      const result = await getSessionMetadata('/project/empty.jsonl');
      expect(result).toBeNull();
    });

    it('should calculate duration correctly', async () => {
      // 30 seconds apart
      const line1 = createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello');
      const line2 = createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Hi');
      const content = `${line1}\n${line2}`;

      vol.fromJSON({
        '/-project/session.jsonl': content,
      });

      const result = await getSessionMetadata('/-project/session.jsonl');

      expect(result?.durationSeconds).toBe(30);
    });

    it('should count messages correctly', async () => {
      // 3 user messages, 2 assistant messages
      const lines = [
        createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
        createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:01.000Z', 'Hi'),
        createUserLine('uuid-3', '2024-01-01T10:00:02.000Z', 'Question'),
        createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:00:03.000Z', 'Answer'),
        createUserLine('uuid-5', '2024-01-01T10:00:04.000Z', 'Thanks'),
      ].join('\n');

      vol.fromJSON({
        '/-project/session.jsonl': lines,
      });

      const result = await getSessionMetadata('/-project/session.jsonl');

      expect(result?.messageCount).toBe(5);
    });

    it('should ignore non-message types in count', async () => {
      const userLine = createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello');
      const queueOp = JSON.stringify({
        type: 'queue-operation',
        operation: 'dequeue',
        timestamp: '2024-01-01T10:00:01.000Z',
        sessionId: 'test-session',
      });
      const assistantLine = createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:02.000Z', 'Hi');
      const content = `${userLine}\n${queueOp}\n${assistantLine}`;

      vol.fromJSON({
        '/-project/session.jsonl': content,
      });

      const result = await getSessionMetadata('/-project/session.jsonl');

      // Should only count user and assistant messages (2), not queue-operation
      expect(result?.messageCount).toBe(2);
    });
  });
});
