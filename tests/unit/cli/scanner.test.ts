import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Mock fs/promises with memfs
vi.mock('node:fs/promises', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return memfs.fs.promises;
});

import {
  hasClaudeProjects,
  scanSessions,
  CLAUDE_PROJECTS_DIR,
  type SessionMetadata,
  type SessionData,
  type ScanResult,
} from '../../../packages/cli/src/scanner.js';

describe('CLI Scanner', () => {
  beforeEach(() => {
    vol.reset();
  });

  afterEach(() => {
    vol.reset();
  });

  // Helper to create valid JSONL message lines
  const createUserLine = (uuid: string, timestamp: string, text: string) =>
    JSON.stringify({
      type: 'user',
      sessionId: 'test-session',
      uuid,
      parentUuid: null,
      timestamp,
      message: { role: 'user', content: [{ type: 'text', text }] },
    });

  const createAssistantLine = (
    uuid: string,
    parentUuid: string,
    timestamp: string,
    text: string
  ) =>
    JSON.stringify({
      type: 'assistant',
      sessionId: 'test-session',
      uuid,
      parentUuid,
      timestamp,
      message: { role: 'assistant', content: [{ type: 'text', text }] },
    });

  const createQueueOperation = (timestamp: string) =>
    JSON.stringify({
      type: 'queue-operation',
      operation: 'dequeue',
      timestamp,
      sessionId: 'test-session',
    });

  describe('hasClaudeProjects', () => {
    it('should return true when Claude projects directory exists', async () => {
      vol.fromJSON({
        [join(CLAUDE_PROJECTS_DIR, '.keep')]: '',
      });

      const result = await hasClaudeProjects();
      expect(result).toBe(true);
    });

    it('should return false when Claude projects directory does not exist', async () => {
      const result = await hasClaudeProjects();
      expect(result).toBe(false);
    });

    it('should return false when directory is inaccessible', async () => {
      // memfs returns false for non-existent paths
      const result = await hasClaudeProjects();
      expect(result).toBe(false);
    });
  });

  describe('scanSessions', () => {
    describe('basic scanning', () => {
      it('should scan and return sessions from Claude projects directory', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-myproject');
        const session1Content = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Hi'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Question'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:01:30.000Z', 'Answer'),
          createUserLine('uuid-5', '2024-01-01T10:02:00.000Z', 'Thanks'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'session1.jsonl')]: session1Content,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(1);
        expect(result.sessions[0].metadata.sessionId).toBe('session1');
        expect(result.sessions[0].metadata.projectPath).toBe('/Users/dev/myproject');
        expect(result.sessions[0].metadata.messageCount).toBe(5);
        expect(result.totalMessages).toBe(5);
      });

      it('should return empty result when no sessions found', async () => {
        vol.fromJSON({
          [join(CLAUDE_PROJECTS_DIR, '.keep')]: '',
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(0);
        expect(result.totalMessages).toBe(0);
        expect(result.totalDurationMinutes).toBe(0);
      });

      it('should scan multiple project directories', async () => {
        const project1Dir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project1');
        const project2Dir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project2');

        const session1 = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Hi'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Question'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:01:30.000Z', 'Answer'),
          createUserLine('uuid-5', '2024-01-01T10:02:00.000Z', 'Thanks'),
        ].join('\n');

        const session2 = [
          createUserLine('uuid-6', '2024-01-02T10:00:00.000Z', 'Test'),
          createAssistantLine('uuid-7', 'uuid-6', '2024-01-02T10:00:30.000Z', 'Response'),
          createUserLine('uuid-8', '2024-01-02T10:01:00.000Z', 'More'),
          createAssistantLine('uuid-9', 'uuid-8', '2024-01-02T10:01:30.000Z', 'Data'),
          createUserLine('uuid-10', '2024-01-02T10:02:00.000Z', 'End'),
        ].join('\n');

        vol.fromJSON({
          [join(project1Dir, 'session-a.jsonl')]: session1,
          [join(project2Dir, 'session-b.jsonl')]: session2,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(2);
        expect(result.totalMessages).toBe(10);
      });

      it('should handle multiple sessions in same project directory', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        const session1 = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Hi'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Question'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:01:30.000Z', 'Answer'),
          createUserLine('uuid-5', '2024-01-01T10:02:00.000Z', 'Thanks'),
        ].join('\n');

        const session2 = [
          createUserLine('uuid-6', '2024-01-02T11:00:00.000Z', 'Another'),
          createAssistantLine('uuid-7', 'uuid-6', '2024-01-02T11:00:30.000Z', 'Session'),
          createUserLine('uuid-8', '2024-01-02T11:01:00.000Z', 'Here'),
          createAssistantLine('uuid-9', 'uuid-8', '2024-01-02T11:01:30.000Z', 'Now'),
          createUserLine('uuid-10', '2024-01-02T11:02:00.000Z', 'Done'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'session1.jsonl')]: session1,
          [join(projectDir, 'session2.jsonl')]: session2,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(2);
        expect(result.totalMessages).toBe(10);
      });
    });

    describe('session filtering', () => {
      it('should filter out sessions with fewer than 5 messages', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        // Session with 3 messages (should be filtered out)
        const tooShort = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Hi'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Bye'),
        ].join('\n');

        // Session with exactly 5 messages (should be included)
        const exactlyFive = [
          createUserLine('uuid-4', '2024-01-02T10:00:00.000Z', 'Start'),
          createAssistantLine('uuid-5', 'uuid-4', '2024-01-02T10:00:30.000Z', 'Response'),
          createUserLine('uuid-6', '2024-01-02T10:01:00.000Z', 'Middle'),
          createAssistantLine('uuid-7', 'uuid-6', '2024-01-02T10:01:30.000Z', 'Continue'),
          createUserLine('uuid-8', '2024-01-02T10:02:00.000Z', 'End'),
        ].join('\n');

        // Session with 7 messages (should be included)
        const moreThanFive = [
          createUserLine('uuid-9', '2024-01-03T10:00:00.000Z', 'Long'),
          createAssistantLine('uuid-10', 'uuid-9', '2024-01-03T10:00:30.000Z', 'Session'),
          createUserLine('uuid-11', '2024-01-03T10:01:00.000Z', 'With'),
          createAssistantLine('uuid-12', 'uuid-11', '2024-01-03T10:01:30.000Z', 'Many'),
          createUserLine('uuid-13', '2024-01-03T10:02:00.000Z', 'Messages'),
          createAssistantLine('uuid-14', 'uuid-13', '2024-01-03T10:02:30.000Z', 'Here'),
          createUserLine('uuid-15', '2024-01-03T10:03:00.000Z', 'Now'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'too-short.jsonl')]: tooShort,
          [join(projectDir, 'exactly-five.jsonl')]: exactlyFive,
          [join(projectDir, 'more-than-five.jsonl')]: moreThanFive,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(2);
        expect(result.sessions.some((s) => s.metadata.sessionId === 'too-short')).toBe(false);
        expect(result.sessions.some((s) => s.metadata.sessionId === 'exactly-five')).toBe(true);
        expect(result.sessions.some((s) => s.metadata.sessionId === 'more-than-five')).toBe(true);
      });

      it('should ignore non-conversation lines in message count', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        // 5 conversation messages + 2 queue operations = should be included
        const sessionContent = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
          createQueueOperation('2024-01-01T10:00:15.000Z'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Hi'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Question'),
          createQueueOperation('2024-01-01T10:01:15.000Z'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:01:30.000Z', 'Answer'),
          createUserLine('uuid-5', '2024-01-01T10:02:00.000Z', 'Thanks'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'session.jsonl')]: sessionContent,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(1);
        expect(result.sessions[0].metadata.messageCount).toBe(5);
      });

      it('should filter out sessions with invalid or missing timestamps', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        // Session with messages but no timestamps
        const noTimestamps = [
          JSON.stringify({
            type: 'user',
            sessionId: 'test',
            uuid: 'uuid-1',
            parentUuid: null,
            message: { role: 'user', content: 'Hello' },
          }),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'no-timestamps.jsonl')]: noTimestamps,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(0);
      });

      it('should filter out empty files', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        vol.fromJSON({
          [join(projectDir, 'empty.jsonl')]: '',
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(0);
      });

      it('should filter out files with only whitespace', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        vol.fromJSON({
          [join(projectDir, 'whitespace.jsonl')]: '\n\n  \n\t\n  ',
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(0);
      });
    });

    describe('session sorting', () => {
      it('should sort by duration (longer sessions first)', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        // Short session (30 seconds)
        const shortSession = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Quick'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:10.000Z', 'Fast'),
          createUserLine('uuid-3', '2024-01-01T10:00:20.000Z', 'Done'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:00:30.000Z', 'Thanks'),
          createUserLine('uuid-5', '2024-01-01T10:00:30.000Z', 'Bye'),
        ].join('\n');

        // Long session (10 minutes)
        const longSession = [
          createUserLine('uuid-6', '2024-01-01T11:00:00.000Z', 'Long'),
          createAssistantLine('uuid-7', 'uuid-6', '2024-01-01T11:05:00.000Z', 'Taking'),
          createUserLine('uuid-8', '2024-01-01T11:08:00.000Z', 'Time'),
          createAssistantLine('uuid-9', 'uuid-8', '2024-01-01T11:09:00.000Z', 'Here'),
          createUserLine('uuid-10', '2024-01-01T11:10:00.000Z', 'Done'),
        ].join('\n');

        // Medium session (2 minutes)
        const mediumSession = [
          createUserLine('uuid-11', '2024-01-01T12:00:00.000Z', 'Medium'),
          createAssistantLine('uuid-12', 'uuid-11', '2024-01-01T12:00:30.000Z', 'Length'),
          createUserLine('uuid-13', '2024-01-01T12:01:00.000Z', 'Session'),
          createAssistantLine('uuid-14', 'uuid-13', '2024-01-01T12:01:30.000Z', 'Now'),
          createUserLine('uuid-15', '2024-01-01T12:02:00.000Z', 'End'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'short.jsonl')]: shortSession,
          [join(projectDir, 'long.jsonl')]: longSession,
          [join(projectDir, 'medium.jsonl')]: mediumSession,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(3);
        // Should be sorted: long (600s), medium (120s), short (30s)
        expect(result.sessions[0].metadata.sessionId).toBe('long');
        expect(result.sessions[1].metadata.sessionId).toBe('medium');
        expect(result.sessions[2].metadata.sessionId).toBe('short');
      });

      it('should use recency as tiebreaker when durations are similar (within 60s)', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        // Older session (duration: 120s)
        const olderSession = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Older'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Session'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Here'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:01:30.000Z', 'Now'),
          createUserLine('uuid-5', '2024-01-01T10:02:00.000Z', 'End'),
        ].join('\n');

        // Newer session (duration: 150s - within 60s difference)
        const newerSession = [
          createUserLine('uuid-6', '2024-01-02T10:00:00.000Z', 'Newer'),
          createAssistantLine('uuid-7', 'uuid-6', '2024-01-02T10:00:40.000Z', 'Session'),
          createUserLine('uuid-8', '2024-01-02T10:01:20.000Z', 'Here'),
          createAssistantLine('uuid-9', 'uuid-8', '2024-01-02T10:02:00.000Z', 'Now'),
          createUserLine('uuid-10', '2024-01-02T10:02:30.000Z', 'End'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'older.jsonl')]: olderSession,
          [join(projectDir, 'newer.jsonl')]: newerSession,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(2);
        // Newer session should come first due to recency tiebreaker
        expect(result.sessions[0].metadata.sessionId).toBe('newer');
        expect(result.sessions[1].metadata.sessionId).toBe('older');
      });

      it('should prioritize duration over recency when difference > 60s', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        // Recent but short session (duration: 60s)
        const recentShort = [
          createUserLine('uuid-1', '2024-01-02T10:00:00.000Z', 'Recent'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-02T10:00:15.000Z', 'Short'),
          createUserLine('uuid-3', '2024-01-02T10:00:30.000Z', 'Quick'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-02T10:00:45.000Z', 'Done'),
          createUserLine('uuid-5', '2024-01-02T10:01:00.000Z', 'End'),
        ].join('\n');

        // Older but long session (duration: 300s - 5 minutes)
        const olderLong = [
          createUserLine('uuid-6', '2024-01-01T10:00:00.000Z', 'Older'),
          createAssistantLine('uuid-7', 'uuid-6', '2024-01-01T10:01:00.000Z', 'Longer'),
          createUserLine('uuid-8', '2024-01-01T10:02:00.000Z', 'Taking'),
          createAssistantLine('uuid-9', 'uuid-8', '2024-01-01T10:04:00.000Z', 'Time'),
          createUserLine('uuid-10', '2024-01-01T10:05:00.000Z', 'End'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'recent-short.jsonl')]: recentShort,
          [join(projectDir, 'older-long.jsonl')]: olderLong,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(2);
        // Older but longer session should come first
        expect(result.sessions[0].metadata.sessionId).toBe('older-long');
        expect(result.sessions[1].metadata.sessionId).toBe('recent-short');
      });
    });

    describe('maxSessions limit', () => {
      it('should respect maxSessions parameter', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        // Create 5 sessions
        for (let i = 1; i <= 5; i++) {
          const sessionContent = [
            createUserLine(`uuid-${i}-1`, `2024-01-0${i}T10:00:00.000Z`, 'Message 1'),
            createAssistantLine(`uuid-${i}-2`, `uuid-${i}-1`, `2024-01-0${i}T10:00:30.000Z`, 'Response 1'),
            createUserLine(`uuid-${i}-3`, `2024-01-0${i}T10:01:00.000Z`, 'Message 2'),
            createAssistantLine(`uuid-${i}-4`, `uuid-${i}-3`, `2024-01-0${i}T10:01:30.000Z`, 'Response 2'),
            createUserLine(`uuid-${i}-5`, `2024-01-0${i}T10:02:00.000Z`, 'Message 3'),
          ].join('\n');

          vol.fromJSON({
            [join(projectDir, `session${i}.jsonl`)]: sessionContent,
          });
        }

        const result = await scanSessions(3);

        expect(result.sessions).toHaveLength(3);
      });

      it('should return all sessions if fewer than maxSessions', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        // Create only 2 sessions
        for (let i = 1; i <= 2; i++) {
          const sessionContent = [
            createUserLine(`uuid-${i}-1`, `2024-01-0${i}T10:00:00.000Z`, 'Message 1'),
            createAssistantLine(`uuid-${i}-2`, `uuid-${i}-1`, `2024-01-0${i}T10:00:30.000Z`, 'Response 1'),
            createUserLine(`uuid-${i}-3`, `2024-01-0${i}T10:01:00.000Z`, 'Message 2'),
            createAssistantLine(`uuid-${i}-4`, `uuid-${i}-3`, `2024-01-0${i}T10:01:30.000Z`, 'Response 2'),
            createUserLine(`uuid-${i}-5`, `2024-01-0${i}T10:02:00.000Z`, 'Message 3'),
          ].join('\n');

          vol.fromJSON({
            [join(projectDir, `session${i}.jsonl`)]: sessionContent,
          });
        }

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(2);
      });

      it('should use default maxSessions of 10 when not specified', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        // Create 15 sessions
        for (let i = 1; i <= 15; i++) {
          const sessionContent = [
            createUserLine(`uuid-${i}-1`, `2024-01-01T${String(i).padStart(2, '0')}:00:00.000Z`, 'Message 1'),
            createAssistantLine(`uuid-${i}-2`, `uuid-${i}-1`, `2024-01-01T${String(i).padStart(2, '0')}:00:30.000Z`, 'Response 1'),
            createUserLine(`uuid-${i}-3`, `2024-01-01T${String(i).padStart(2, '0')}:01:00.000Z`, 'Message 2'),
            createAssistantLine(`uuid-${i}-4`, `uuid-${i}-3`, `2024-01-01T${String(i).padStart(2, '0')}:01:30.000Z`, 'Response 2'),
            createUserLine(`uuid-${i}-5`, `2024-01-01T${String(i).padStart(2, '0')}:02:00.000Z`, 'Message 3'),
          ].join('\n');

          vol.fromJSON({
            [join(projectDir, `session${i}.jsonl`)]: sessionContent,
          });
        }

        const result = await scanSessions(); // No parameter

        expect(result.sessions).toHaveLength(10);
      });
    });

    describe('path decoding', () => {
      it('should decode project path with leading dash', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-projects-myapp');

        const sessionContent = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Hi'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Question'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:01:30.000Z', 'Answer'),
          createUserLine('uuid-5', '2024-01-01T10:02:00.000Z', 'Thanks'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'session.jsonl')]: sessionContent,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(1);
        expect(result.sessions[0].metadata.projectPath).toBe('/Users/dev/projects/myapp');
        expect(result.sessions[0].metadata.projectName).toBe('myapp');
      });

      it('should handle deeply nested project paths', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-home-user-code-workspace-nested-project');

        const sessionContent = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Hi'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Question'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:01:30.000Z', 'Answer'),
          createUserLine('uuid-5', '2024-01-01T10:02:00.000Z', 'Thanks'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'session.jsonl')]: sessionContent,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(1);
        expect(result.sessions[0].metadata.projectPath).toBe('/home/user/code/workspace/nested/project');
        expect(result.sessions[0].metadata.projectName).toBe('project');
      });

      it('should handle project directory without leading dash', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, 'relative-path');

        const sessionContent = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Hi'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Question'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:01:30.000Z', 'Answer'),
          createUserLine('uuid-5', '2024-01-01T10:02:00.000Z', 'Thanks'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'session.jsonl')]: sessionContent,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(1);
        // Should not decode if no leading dash
        expect(result.sessions[0].metadata.projectPath).toBe('relative-path');
      });
    });

    describe('metadata calculation', () => {
      it('should calculate duration correctly in seconds', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        // Session spanning 5 minutes (300 seconds)
        const sessionContent = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Start'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:01:00.000Z', 'Response'),
          createUserLine('uuid-3', '2024-01-01T10:02:00.000Z', 'Middle'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:04:00.000Z', 'Continuing'),
          createUserLine('uuid-5', '2024-01-01T10:05:00.000Z', 'End'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'session.jsonl')]: sessionContent,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(1);
        expect(result.sessions[0].metadata.durationSeconds).toBe(300);
      });

      it('should round total duration to minutes', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        // Session of 150 seconds (2.5 minutes, should round to 3)
        const sessionContent = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Start'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Response'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Middle'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:01:30.000Z', 'Continuing'),
          createUserLine('uuid-5', '2024-01-01T10:02:30.000Z', 'End'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'session.jsonl')]: sessionContent,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(1);
        expect(result.totalDurationMinutes).toBe(3);
      });

      it('should extract session ID from filename', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        const sessionContent = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Hi'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Question'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:01:30.000Z', 'Answer'),
          createUserLine('uuid-5', '2024-01-01T10:02:00.000Z', 'Thanks'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'abc-123-xyz.jsonl')]: sessionContent,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(1);
        expect(result.sessions[0].metadata.sessionId).toBe('abc-123-xyz');
      });

      it('should include file path in metadata', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');
        const expectedFilePath = join(projectDir, 'test-session.jsonl');

        const sessionContent = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Hi'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Question'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:01:30.000Z', 'Answer'),
          createUserLine('uuid-5', '2024-01-01T10:02:00.000Z', 'Thanks'),
        ].join('\n');

        vol.fromJSON({
          [expectedFilePath]: sessionContent,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(1);
        expect(result.sessions[0].metadata.filePath).toBe(expectedFilePath);
      });

      it('should use first message timestamp for session timestamp', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        const sessionContent = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'First'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:01:00.000Z', 'Response'),
          createUserLine('uuid-3', '2024-01-01T10:02:00.000Z', 'Middle'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:03:00.000Z', 'Continuing'),
          createUserLine('uuid-5', '2024-01-01T10:04:00.000Z', 'Last'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'session.jsonl')]: sessionContent,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(1);
        expect(result.sessions[0].metadata.timestamp).toEqual(new Date('2024-01-01T10:00:00.000Z'));
      });
    });

    describe('content inclusion', () => {
      it('should include raw JSONL content in session data', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        const sessionContent = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Hi'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Question'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:01:30.000Z', 'Answer'),
          createUserLine('uuid-5', '2024-01-01T10:02:00.000Z', 'Thanks'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'session.jsonl')]: sessionContent,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(1);
        expect(result.sessions[0].content).toBe(sessionContent);
      });

      it('should handle unreadable files gracefully', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        // Create valid metadata session
        const validSession = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Hi'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Question'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:01:30.000Z', 'Answer'),
          createUserLine('uuid-5', '2024-01-01T10:02:00.000Z', 'Thanks'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'valid.jsonl')]: validSession,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(1);
      });
    });

    describe('aggregation', () => {
      it('should calculate total messages correctly', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        const session1 = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'A'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'B'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'C'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:01:30.000Z', 'D'),
          createUserLine('uuid-5', '2024-01-01T10:02:00.000Z', 'E'),
        ].join('\n');

        const session2 = [
          createUserLine('uuid-6', '2024-01-02T10:00:00.000Z', 'F'),
          createAssistantLine('uuid-7', 'uuid-6', '2024-01-02T10:00:30.000Z', 'G'),
          createUserLine('uuid-8', '2024-01-02T10:01:00.000Z', 'H'),
          createAssistantLine('uuid-9', 'uuid-8', '2024-01-02T10:01:30.000Z', 'I'),
          createUserLine('uuid-10', '2024-01-02T10:02:00.000Z', 'J'),
          createAssistantLine('uuid-11', 'uuid-10', '2024-01-02T10:02:30.000Z', 'K'),
          createUserLine('uuid-12', '2024-01-02T10:03:00.000Z', 'L'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'session1.jsonl')]: session1,
          [join(projectDir, 'session2.jsonl')]: session2,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(2);
        expect(result.totalMessages).toBe(12); // 5 + 7
      });

      it('should calculate total duration in minutes correctly', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        // Session 1: 120 seconds (2 minutes)
        const session1 = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Start'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Response'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Middle'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:01:30.000Z', 'Continue'),
          createUserLine('uuid-5', '2024-01-01T10:02:00.000Z', 'End'),
        ].join('\n');

        // Session 2: 180 seconds (3 minutes)
        const session2 = [
          createUserLine('uuid-6', '2024-01-02T10:00:00.000Z', 'Start'),
          createAssistantLine('uuid-7', 'uuid-6', '2024-01-02T10:01:00.000Z', 'Response'),
          createUserLine('uuid-8', '2024-01-02T10:02:00.000Z', 'Middle'),
          createAssistantLine('uuid-9', 'uuid-8', '2024-01-02T10:02:30.000Z', 'Continue'),
          createUserLine('uuid-10', '2024-01-02T10:03:00.000Z', 'End'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'session1.jsonl')]: session1,
          [join(projectDir, 'session2.jsonl')]: session2,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(2);
        expect(result.totalDurationMinutes).toBe(5); // 2 + 3
      });
    });

    describe('error handling', () => {
      it('should handle corrupted JSONL gracefully', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        const corruptedContent = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
          'THIS IS NOT VALID JSON',
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Hi'),
          '{"incomplete": ',
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Question'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'corrupted.jsonl')]: corruptedContent,
        });

        const result = await scanSessions(10);

        // Should still parse valid lines, but won't meet minimum message count
        expect(result.sessions).toHaveLength(0);
      });

      it('should handle non-JSONL files in directory', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        const validSession = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Hi'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Question'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:01:30.000Z', 'Answer'),
          createUserLine('uuid-5', '2024-01-01T10:02:00.000Z', 'Thanks'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'session.jsonl')]: validSession,
          [join(projectDir, 'README.md')]: '# Documentation',
          [join(projectDir, 'config.json')]: '{"setting": true}',
          [join(projectDir, '.gitignore')]: '*.log',
        });

        const result = await scanSessions(10);

        // Should only process .jsonl files
        expect(result.sessions).toHaveLength(1);
      });

      it('should handle directory with no JSONL files', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        vol.fromJSON({
          [join(projectDir, 'README.md')]: '# Documentation',
          [join(projectDir, 'notes.txt')]: 'Some notes',
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(0);
      });
    });
  });
});
