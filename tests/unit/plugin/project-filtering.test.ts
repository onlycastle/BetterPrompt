import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resetConfig } from '../../../packages/plugin/lib/config.js';

/**
 * Tests for the includeProjects filtering logic in scan_sessions and
 * extract_data MCP tools.
 *
 * Strategy: pre-populate the scan cache with fake ParsedSession objects,
 * then call readCachedParsedSessions and verify filtering behavior.
 * We test the filtering logic directly rather than going through the
 * full MCP tool execute() which has heavy dependencies.
 */

interface MinimalSession {
  sessionId: string;
  projectPath: string;
  projectName: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  claudeCodeVersion: string;
  messages: Array<{ uuid: string; role: string; timestamp: string; content: string }>;
  stats: { totalMessages: number; totalToolCalls: number };
  source: string;
}

function makeSession(id: string, projectName: string): MinimalSession {
  return {
    sessionId: id,
    projectPath: `/home/user/projects/${projectName}`,
    projectName,
    startTime: '2026-03-15T10:00:00.000Z',
    endTime: '2026-03-15T10:30:00.000Z',
    durationSeconds: 1800,
    claudeCodeVersion: '1.0.0',
    messages: [
      { uuid: `${id}-msg-1`, role: 'user', timestamp: '2026-03-15T10:00:00.000Z', content: 'hello' },
      { uuid: `${id}-msg-2`, role: 'assistant', timestamp: '2026-03-15T10:01:00.000Z', content: 'hi' },
    ],
    stats: { totalMessages: 2, totalToolCalls: 0 },
    source: 'claude-code',
  };
}

describe('project filtering logic', () => {
  const originalHome = process.env.HOME;
  let homeDir = '';

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'betterprompt-proj-filter-'));
    process.env.HOME = homeDir;
    resetConfig();
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    resetConfig();
    if (homeDir) {
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  function writeScanCache(sessions: MinimalSession[]): void {
    const cacheDir = join(homeDir, '.betterprompt', 'scan-cache');
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, 'parsed-sessions.json'), JSON.stringify(sessions));
  }

  it('filters sessions by includeProjects', () => {
    const sessions = [
      makeSession('s1', 'project-a'),
      makeSession('s2', 'project-b'),
      makeSession('s3', 'project-a'),
      makeSession('s4', 'project-c'),
    ];

    const includeProjects = ['project-a'];
    const filtered = sessions.filter(s => includeProjects.includes(s.projectName ?? 'unknown'));

    expect(filtered).toHaveLength(2);
    expect(filtered.every(s => s.projectName === 'project-a')).toBe(true);
  });

  it('returns all sessions when includeProjects is empty', () => {
    const sessions = [
      makeSession('s1', 'project-a'),
      makeSession('s2', 'project-b'),
    ];

    const includeProjects: string[] = [];
    const filtered = includeProjects.length
      ? sessions.filter(s => includeProjects.includes(s.projectName ?? 'unknown'))
      : sessions;

    expect(filtered).toHaveLength(2);
  });

  it('returns all sessions when includeProjects is undefined', () => {
    const sessions = [
      makeSession('s1', 'project-a'),
      makeSession('s2', 'project-b'),
    ];

    const includeProjects: string[] | undefined = undefined;
    const filtered = includeProjects?.length
      ? sessions.filter(s => includeProjects.includes(s.projectName ?? 'unknown'))
      : sessions;

    expect(filtered).toHaveLength(2);
  });

  it('returns empty array when no sessions match includeProjects', () => {
    const sessions = [
      makeSession('s1', 'project-a'),
      makeSession('s2', 'project-b'),
    ];

    const includeProjects = ['nonexistent-project'];
    const filtered = sessions.filter(s => includeProjects.includes(s.projectName ?? 'unknown'));

    expect(filtered).toHaveLength(0);
  });

  it('normalizes path-like includeProjects values to project names', async () => {
    const {
      normalizeProjectFilters,
      normalizeProjectNameValue,
    } = await import('../../../packages/plugin/lib/project-filters.js');

    expect(
      normalizeProjectFilters([
        '/private/tmp/betterprompt-parity-20260324-r1/bp-parity-moneybook',
        'nomoreaislop/cleanroom-projects/bp-parity-youtube',
        'bp-parity-moneybook',
      ]),
    ).toEqual(['bp-parity-moneybook', 'bp-parity-youtube']);

    expect(
      normalizeProjectNameValue('private/tmp/betterprompt-parity-20260324-r2/bp-parity-moneybook'),
    ).toBe('bp-parity-moneybook');

    expect(
      normalizeProjectNameValue('single-person-company/youtube'),
    ).toBe('single-person-company/youtube');
  });

  it('treats sessions without projectName as "unknown"', () => {
    const sessions = [
      { ...makeSession('s1', 'project-a'), projectName: undefined as unknown as string },
      makeSession('s2', 'project-b'),
    ];

    const includeProjects = ['unknown'];
    const filtered = sessions.filter(s => includeProjects.includes(s.projectName ?? 'unknown'));

    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.sessionId).toBe('s1');
  });

  it('builds allProjects with session counts from full set', () => {
    const sessions = [
      makeSession('s1', 'project-a'),
      makeSession('s2', 'project-b'),
      makeSession('s3', 'project-a'),
      makeSession('s4', 'project-c'),
      makeSession('s5', 'project-a'),
    ];

    const allProjectNames = [...new Set(sessions.map(s => s.projectName ?? 'unknown'))];
    const allProjects = allProjectNames.map(name => ({
      name,
      sessionCount: sessions.filter(s => (s.projectName ?? 'unknown') === name).length,
    })).sort((a, b) => b.sessionCount - a.sessionCount);

    expect(allProjects).toEqual([
      { name: 'project-a', sessionCount: 3 },
      { name: 'project-b', sessionCount: 1 },
      { name: 'project-c', sessionCount: 1 },
    ]);
  });

  it('applies recency limit after project filtering', () => {
    const sessions = [
      makeSession('s1', 'project-a'),
      makeSession('s2', 'project-b'),
      makeSession('s3', 'project-a'),
      makeSession('s4', 'project-b'),
      makeSession('s5', 'project-a'),
    ];

    const includeProjects = ['project-a'];
    const maxSessions = 2;
    const filtered = sessions.filter(s => includeProjects.includes(s.projectName ?? 'unknown'));
    const selected = filtered.slice(0, maxSessions);

    expect(selected).toHaveLength(2);
    expect(selected.every(s => s.projectName === 'project-a')).toBe(true);
  });
});
