/**
 * Desktop Scanner Tests
 *
 * Tests for the session scanner module used by the Electron desktop app.
 * Uses mocked filesystem to test scanning logic without real Claude sessions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

// Mock fs/promises before importing the module
vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

// Import after mocking
import {
  CLAUDE_PROJECTS_DIR,
  listProjectDirs,
  listSessionFiles,
  hasClaudeProjects,
} from '../../../packages/desktop/src/main/scanner.js';

describe('Desktop Scanner', () => {
  beforeEach(() => {
    vol.reset();
  });

  afterEach(() => {
    vol.reset();
    vi.clearAllMocks();
  });

  describe('CLAUDE_PROJECTS_DIR', () => {
    it('should point to ~/.claude/projects/', () => {
      expect(CLAUDE_PROJECTS_DIR).toContain('.claude');
      expect(CLAUDE_PROJECTS_DIR).toContain('projects');
    });
  });

  describe('hasClaudeProjects', () => {
    it('should return true when projects directory exists', async () => {
      // Create the projects directory
      vol.fromJSON({
        [`${CLAUDE_PROJECTS_DIR}/.keep`]: '',
      });

      const result = await hasClaudeProjects();
      expect(result).toBe(true);
    });

    it('should return false when projects directory does not exist', async () => {
      // Empty filesystem
      vol.fromJSON({});

      const result = await hasClaudeProjects();
      expect(result).toBe(false);
    });
  });

  describe('listProjectDirs', () => {
    it('should return empty array when projects directory is empty', async () => {
      vol.fromJSON({
        [`${CLAUDE_PROJECTS_DIR}/.keep`]: '',
      });

      const dirs = await listProjectDirs();
      expect(dirs).toEqual([]);
    });

    it('should list project directories', async () => {
      vol.fromJSON({
        [`${CLAUDE_PROJECTS_DIR}/-Users-dev-project1/.session1.jsonl`]: '{}',
        [`${CLAUDE_PROJECTS_DIR}/-Users-dev-project2/.session2.jsonl`]: '{}',
      });

      const dirs = await listProjectDirs();
      expect(dirs).toHaveLength(2);
      expect(dirs.some((d) => d.includes('project1'))).toBe(true);
      expect(dirs.some((d) => d.includes('project2'))).toBe(true);
    });

    it('should ignore files in projects directory', async () => {
      vol.fromJSON({
        [`${CLAUDE_PROJECTS_DIR}/somefile.txt`]: 'content',
        [`${CLAUDE_PROJECTS_DIR}/-Users-dev-project/.session.jsonl`]: '{}',
      });

      const dirs = await listProjectDirs();
      expect(dirs).toHaveLength(1);
      expect(dirs[0]).toContain('project');
    });

    it('should return empty array when projects directory does not exist', async () => {
      vol.fromJSON({});

      const dirs = await listProjectDirs();
      expect(dirs).toEqual([]);
    });
  });

  describe('listSessionFiles', () => {
    it('should list JSONL files in a project directory', async () => {
      const projectDir = `${CLAUDE_PROJECTS_DIR}/-Users-dev-myproject`;
      vol.fromJSON({
        [`${projectDir}/session1.jsonl`]: '{}',
        [`${projectDir}/session2.jsonl`]: '{}',
        [`${projectDir}/notes.txt`]: 'not a session',
      });

      const files = await listSessionFiles(projectDir);
      expect(files).toHaveLength(2);
      expect(files.every((f) => f.endsWith('.jsonl'))).toBe(true);
    });

    it('should return empty array for empty directory', async () => {
      const projectDir = `${CLAUDE_PROJECTS_DIR}/-Users-dev-emptyproject`;
      vol.fromJSON({
        [`${projectDir}/.keep`]: '',
      });

      const files = await listSessionFiles(projectDir);
      expect(files).toEqual([]);
    });

    it('should return empty array for non-existent directory', async () => {
      const projectDir = `${CLAUDE_PROJECTS_DIR}/-Users-dev-nonexistent`;
      vol.fromJSON({});

      const files = await listSessionFiles(projectDir);
      expect(files).toEqual([]);
    });
  });
});

describe('Scanner Path Utilities', () => {
  /**
   * These tests verify the path encoding/decoding logic
   * that Claude Code uses for project directories.
   *
   * Claude encodes paths by replacing '/' with '-':
   *   /Users/dev/project -> -Users-dev-project
   */

  describe('path encoding pattern', () => {
    it('should understand Claude path encoding convention', () => {
      // This tests our understanding of the encoding pattern
      // NOTE: Claude Code encodes paths by replacing ALL '/' with '-'
      // This means paths containing '-' in folder names get ambiguous
      // E.g., /Users/dev/project -> -Users-dev-project
      const originalPath = '/Users/dev/project';
      const encodedDir = '-Users-dev-project';

      // Decoding: replace '-' with '/' if starts with '-'
      const decoded = encodedDir.startsWith('-')
        ? encodedDir.replace(/-/g, '/')
        : encodedDir;

      expect(decoded).toBe(originalPath);
    });

    it('should extract project name from decoded path', () => {
      // After decoding, the last segment is the project name
      const decodedPath = '/Users/developer/myproject';
      const parts = decodedPath.split('/').filter(Boolean);
      const projectName = parts[parts.length - 1] || 'unknown';

      expect(projectName).toBe('myproject');
    });

    it('should handle paths without leading slash', () => {
      const encodedDir = 'relative-path-project';

      // Non-dash-prefixed paths are returned as-is
      const decoded = encodedDir.startsWith('-')
        ? encodedDir.replace(/-/g, '/')
        : encodedDir;

      expect(decoded).toBe('relative-path-project');
    });

    it('should handle Windows-style paths', () => {
      // Windows paths might be encoded differently
      const encodedDir = '-C-Users-dev-project';
      const decoded = encodedDir.startsWith('-')
        ? encodedDir.replace(/-/g, '/')
        : encodedDir;

      expect(decoded).toBe('/C/Users/dev/project');
    });
  });
});

describe('Scanner Token Estimation', () => {
  /**
   * Tests for token estimation heuristics.
   * These verify the logic used to estimate costs before analysis.
   */

  describe('estimateTokenCount logic', () => {
    const estimateTokenCount = (content: string): number => {
      if (!content) return 0;

      let baseCount = content.length / 4;

      // Code blocks are token-heavy
      const codeBlockMatches = content.match(/```[\s\S]*?```/g);
      if (codeBlockMatches) baseCount += codeBlockMatches.length * 50;

      // JSON structure overhead
      const jsonBraceMatches = content.match(/[{}[\]]/g);
      if (jsonBraceMatches) baseCount += jsonBraceMatches.length * 0.5;

      return Math.ceil(baseCount);
    };

    it('should estimate ~4 chars per token for plain text', () => {
      const text = 'Hello world';
      const estimate = estimateTokenCount(text);
      // 11 chars / 4 = 2.75 -> ceil = 3
      expect(estimate).toBe(3);
    });

    it('should add overhead for code blocks', () => {
      const withCode = 'Here is code:\n```javascript\nconsole.log("hi");\n```';
      const withoutCode = 'Here is code: console.log("hi");';

      const withCodeEstimate = estimateTokenCount(withCode);
      const withoutCodeEstimate = estimateTokenCount(withoutCode);

      // Code block should add ~50 tokens overhead
      expect(withCodeEstimate).toBeGreaterThan(withoutCodeEstimate);
    });

    it('should add overhead for JSON braces', () => {
      const json = '{"key": "value", "array": [1, 2, 3]}';
      const plain = 'key: value, array: 1, 2, 3';

      const jsonEstimate = estimateTokenCount(json);
      const plainEstimate = estimateTokenCount(plain);

      expect(jsonEstimate).toBeGreaterThan(plainEstimate);
    });

    it('should return 0 for empty content', () => {
      expect(estimateTokenCount('')).toBe(0);
    });

    it('should handle multiple code blocks', () => {
      const multiCode = '```js\ncode1\n```\ntext\n```py\ncode2\n```';
      const estimate = estimateTokenCount(multiCode);

      // Should include 2 * 50 = 100 tokens overhead for code blocks
      // Plus base content estimation
      expect(estimate).toBeGreaterThan(100);
    });
  });
});

describe('Scanner Session Selection', () => {
  /**
   * Tests for the auto-selection algorithm.
   * Verifies that selection balances recency, content, and diversity.
   */

  describe('selection algorithm concepts', () => {
    interface MockSession {
      sessionId: string;
      projectPath: string;
      timestamp: Date;
      tokenCount: number;
    }

    const selectBestSessions = (
      sessions: MockSession[],
      targetCount: number
    ): MockSession[] => {
      if (sessions.length <= targetCount) return [...sessions];

      // Group by project
      const byProject = new Map<string, MockSession[]>();
      for (const session of sessions) {
        const key = session.projectPath;
        if (!byProject.has(key)) byProject.set(key, []);
        byProject.get(key)!.push(session);
      }

      const selected: MockSession[] = [];
      const selectedIds = new Set<string>();

      // Phase 1: Pick best from each project (diversity)
      const sortedProjects = Array.from(byProject.entries()).sort(
        ([, a], [, b]) => b[0].tokenCount - a[0].tokenCount
      );

      for (const [, projectSessions] of sortedProjects) {
        if (selected.length >= targetCount) break;
        const best = projectSessions.sort((a, b) => b.tokenCount - a.tokenCount)[0];
        selected.push(best);
        selectedIds.add(best.sessionId);
      }

      // Phase 2: Fill remaining with highest token sessions
      if (selected.length < targetCount) {
        const remaining = sessions
          .filter((s) => !selectedIds.has(s.sessionId))
          .sort((a, b) => b.tokenCount - a.tokenCount);

        for (const session of remaining) {
          if (selected.length >= targetCount) break;
          selected.push(session);
        }
      }

      return selected;
    };

    it('should return all sessions when count is below target', () => {
      const sessions: MockSession[] = [
        { sessionId: '1', projectPath: '/p1', timestamp: new Date(), tokenCount: 100 },
        { sessionId: '2', projectPath: '/p2', timestamp: new Date(), tokenCount: 200 },
      ];

      const selected = selectBestSessions(sessions, 10);
      expect(selected).toHaveLength(2);
    });

    it('should prioritize project diversity', () => {
      const sessions: MockSession[] = [
        { sessionId: '1', projectPath: '/project-a', timestamp: new Date(), tokenCount: 500 },
        { sessionId: '2', projectPath: '/project-a', timestamp: new Date(), tokenCount: 400 },
        { sessionId: '3', projectPath: '/project-b', timestamp: new Date(), tokenCount: 300 },
        { sessionId: '4', projectPath: '/project-c', timestamp: new Date(), tokenCount: 200 },
      ];

      const selected = selectBestSessions(sessions, 3);

      // Should include sessions from different projects
      const projects = new Set(selected.map((s) => s.projectPath));
      expect(projects.size).toBeGreaterThan(1);
    });

    it('should favor sessions with higher token counts', () => {
      const sessions: MockSession[] = [
        { sessionId: '1', projectPath: '/p1', timestamp: new Date(), tokenCount: 100 },
        { sessionId: '2', projectPath: '/p2', timestamp: new Date(), tokenCount: 500 },
        { sessionId: '3', projectPath: '/p3', timestamp: new Date(), tokenCount: 300 },
      ];

      const selected = selectBestSessions(sessions, 2);

      // Should include high-token sessions
      const totalTokens = selected.reduce((sum, s) => sum + s.tokenCount, 0);
      expect(totalTokens).toBeGreaterThanOrEqual(800); // 500 + 300
    });
  });
});
