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
      it('should sort by message count (more messages first)', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        // Few messages session (5 messages, 2 min duration)
        const fewMessages = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:30.000Z', 'Hi'),
          createUserLine('uuid-3', '2024-01-01T10:01:00.000Z', 'Question'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:01:30.000Z', 'Answer'),
          createUserLine('uuid-5', '2024-01-01T10:02:00.000Z', 'Thanks'),
        ].join('\n');

        // Many messages session (9 messages, 2 min duration)
        const manyMessages = [
          createUserLine('uuid-6', '2024-01-01T11:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-7', 'uuid-6', '2024-01-01T11:00:15.000Z', 'Hi'),
          createUserLine('uuid-8', '2024-01-01T11:00:30.000Z', 'Q1'),
          createAssistantLine('uuid-9', 'uuid-8', '2024-01-01T11:00:45.000Z', 'A1'),
          createUserLine('uuid-10', '2024-01-01T11:01:00.000Z', 'Q2'),
          createAssistantLine('uuid-11', 'uuid-10', '2024-01-01T11:01:15.000Z', 'A2'),
          createUserLine('uuid-12', '2024-01-01T11:01:30.000Z', 'Q3'),
          createAssistantLine('uuid-13', 'uuid-12', '2024-01-01T11:01:45.000Z', 'A3'),
          createUserLine('uuid-14', '2024-01-01T11:02:00.000Z', 'Thanks'),
        ].join('\n');

        // Medium messages session (7 messages, 2 min duration)
        const mediumMessages = [
          createUserLine('uuid-15', '2024-01-01T12:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-16', 'uuid-15', '2024-01-01T12:00:20.000Z', 'Hi'),
          createUserLine('uuid-17', '2024-01-01T12:00:40.000Z', 'Q1'),
          createAssistantLine('uuid-18', 'uuid-17', '2024-01-01T12:01:00.000Z', 'A1'),
          createUserLine('uuid-19', '2024-01-01T12:01:20.000Z', 'Q2'),
          createAssistantLine('uuid-20', 'uuid-19', '2024-01-01T12:01:40.000Z', 'A2'),
          createUserLine('uuid-21', '2024-01-01T12:02:00.000Z', 'Thanks'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir, 'few.jsonl')]: fewMessages,
          [join(projectDir, 'many.jsonl')]: manyMessages,
          [join(projectDir, 'medium.jsonl')]: mediumMessages,
        });

        const result = await scanSessions(10);

        expect(result.sessions).toHaveLength(3);
        // Should be sorted by message count: many (9), medium (7), few (5)
        expect(result.sessions[0].metadata.sessionId).toBe('many');
        expect(result.sessions[1].metadata.sessionId).toBe('medium');
        expect(result.sessions[2].metadata.sessionId).toBe('few');
      });

      it('should prioritize project diversity over message count', async () => {
        const projectDir1 = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project1');
        const projectDir2 = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project2');

        // Project1: Many messages (9 messages)
        const project1Many = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:15.000Z', 'Hi'),
          createUserLine('uuid-3', '2024-01-01T10:00:30.000Z', 'Q1'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:00:45.000Z', 'A1'),
          createUserLine('uuid-5', '2024-01-01T10:01:00.000Z', 'Q2'),
          createAssistantLine('uuid-6', 'uuid-5', '2024-01-01T10:01:15.000Z', 'A2'),
          createUserLine('uuid-7', '2024-01-01T10:01:30.000Z', 'Q3'),
          createAssistantLine('uuid-8', 'uuid-7', '2024-01-01T10:01:45.000Z', 'A3'),
          createUserLine('uuid-9', '2024-01-01T10:02:00.000Z', 'Thanks'),
        ].join('\n');

        // Project1: Medium messages (7 messages)
        const project1Medium = [
          createUserLine('uuid-10', '2024-01-01T11:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-11', 'uuid-10', '2024-01-01T11:00:20.000Z', 'Hi'),
          createUserLine('uuid-12', '2024-01-01T11:00:40.000Z', 'Q1'),
          createAssistantLine('uuid-13', 'uuid-12', '2024-01-01T11:01:00.000Z', 'A1'),
          createUserLine('uuid-14', '2024-01-01T11:01:20.000Z', 'Q2'),
          createAssistantLine('uuid-15', 'uuid-14', '2024-01-01T11:01:40.000Z', 'A2'),
          createUserLine('uuid-16', '2024-01-01T11:02:00.000Z', 'Thanks'),
        ].join('\n');

        // Project2: Few messages (5 messages) - should still be included for diversity
        const project2Few = [
          createUserLine('uuid-17', '2024-01-01T12:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-18', 'uuid-17', '2024-01-01T12:00:30.000Z', 'Hi'),
          createUserLine('uuid-19', '2024-01-01T12:01:00.000Z', 'Question'),
          createAssistantLine('uuid-20', 'uuid-19', '2024-01-01T12:01:30.000Z', 'Answer'),
          createUserLine('uuid-21', '2024-01-01T12:02:00.000Z', 'Thanks'),
        ].join('\n');

        vol.fromJSON({
          [join(projectDir1, 'many.jsonl')]: project1Many,
          [join(projectDir1, 'medium.jsonl')]: project1Medium,
          [join(projectDir2, 'few.jsonl')]: project2Few,
        });

        // Request only 2 sessions - should pick best from each project
        const result = await scanSessions(2);

        expect(result.sessions).toHaveLength(2);
        // Should include best from project1 (many) and best from project2 (few)
        const sessionIds = result.sessions.map(s => s.metadata.sessionId);
        expect(sessionIds).toContain('many');
        expect(sessionIds).toContain('few');
      });

      it('should fill remaining slots with best sessions after diversity', async () => {
        const projectDir1 = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project1');
        const projectDir2 = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project2');

        // Project1: 2 sessions
        const project1A = [
          createUserLine('uuid-1', '2024-01-01T10:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-2', 'uuid-1', '2024-01-01T10:00:15.000Z', 'Hi'),
          createUserLine('uuid-3', '2024-01-01T10:00:30.000Z', 'Q1'),
          createAssistantLine('uuid-4', 'uuid-3', '2024-01-01T10:00:45.000Z', 'A1'),
          createUserLine('uuid-5', '2024-01-01T10:01:00.000Z', 'Q2'),
          createAssistantLine('uuid-6', 'uuid-5', '2024-01-01T10:01:15.000Z', 'A2'),
          createUserLine('uuid-7', '2024-01-01T10:01:30.000Z', 'Q3'),
          createAssistantLine('uuid-8', 'uuid-7', '2024-01-01T10:01:45.000Z', 'A3'),
          createUserLine('uuid-9', '2024-01-01T10:02:00.000Z', 'Thanks'),
        ].join('\n'); // 9 messages

        const project1B = [
          createUserLine('uuid-10', '2024-01-01T11:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-11', 'uuid-10', '2024-01-01T11:00:20.000Z', 'Hi'),
          createUserLine('uuid-12', '2024-01-01T11:00:40.000Z', 'Q1'),
          createAssistantLine('uuid-13', 'uuid-12', '2024-01-01T11:01:00.000Z', 'A1'),
          createUserLine('uuid-14', '2024-01-01T11:01:20.000Z', 'Q2'),
          createAssistantLine('uuid-15', 'uuid-14', '2024-01-01T11:01:40.000Z', 'A2'),
          createUserLine('uuid-16', '2024-01-01T11:02:00.000Z', 'Thanks'),
        ].join('\n'); // 7 messages

        // Project2: 1 session
        const project2A = [
          createUserLine('uuid-17', '2024-01-01T12:00:00.000Z', 'Hello'),
          createAssistantLine('uuid-18', 'uuid-17', '2024-01-01T12:00:30.000Z', 'Hi'),
          createUserLine('uuid-19', '2024-01-01T12:01:00.000Z', 'Question'),
          createAssistantLine('uuid-20', 'uuid-19', '2024-01-01T12:01:30.000Z', 'Answer'),
          createUserLine('uuid-21', '2024-01-01T12:02:00.000Z', 'Thanks'),
        ].join('\n'); // 5 messages

        vol.fromJSON({
          [join(projectDir1, 'sessionA.jsonl')]: project1A,
          [join(projectDir1, 'sessionB.jsonl')]: project1B,
          [join(projectDir2, 'sessionA.jsonl')]: project2A,
        });

        // Request 3 sessions
        const result = await scanSessions(3);

        expect(result.sessions).toHaveLength(3);
        // Phase 1: Pick best from each project (sessionA from p1, sessionA from p2)
        // Phase 2: Fill remaining with best overall (sessionB from p1)
        const sessionIds = result.sessions.map(s => s.metadata.sessionId);
        expect(sessionIds).toContain('sessionA'); // from project1 (best)
        expect(sessionIds).toContain('sessionB'); // from project1 (second best overall)
        // project2's sessionA should also be included for diversity
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

      it('should use default maxSessions of 20 when not specified', async () => {
        const projectDir = join(CLAUDE_PROJECTS_DIR, '-Users-dev-project');

        // Create 25 sessions
        for (let i = 1; i <= 25; i++) {
          const hour = String(i % 24).padStart(2, '0');
          const sessionContent = [
            createUserLine(`uuid-${i}-1`, `2024-01-01T${hour}:00:00.000Z`, 'Message 1'),
            createAssistantLine(`uuid-${i}-2`, `uuid-${i}-1`, `2024-01-01T${hour}:00:30.000Z`, 'Response 1'),
            createUserLine(`uuid-${i}-3`, `2024-01-01T${hour}:01:00.000Z`, 'Message 2'),
            createAssistantLine(`uuid-${i}-4`, `uuid-${i}-3`, `2024-01-01T${hour}:01:30.000Z`, 'Response 2'),
            createUserLine(`uuid-${i}-5`, `2024-01-01T${hour}:02:00.000Z`, 'Message 3'),
          ].join('\n');

          vol.fromJSON({
            [join(projectDir, `session${i}.jsonl`)]: sessionContent,
          });
        }

        const result = await scanSessions(); // No parameter

        expect(result.sessions).toHaveLength(20);
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
      it('should include parsed session data', async () => {
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
        // Should have parsed session with messages
        expect(result.sessions[0].parsed).toBeDefined();
        expect(result.sessions[0].parsed.messages).toBeDefined();
        expect(result.sessions[0].parsed.messages.length).toBeGreaterThan(0);
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
