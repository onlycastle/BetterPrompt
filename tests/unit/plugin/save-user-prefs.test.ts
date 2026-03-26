import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resetConfig } from '../../../packages/plugin/lib/config.js';
import { readPrefs } from '../../../packages/plugin/lib/prefs.js';
import { readState } from '../../../packages/plugin/lib/debounce.js';
import { execute } from '../../../packages/plugin/mcp/tools/save-user-prefs.js';

describe('save_user_prefs tool', () => {
  const originalHome = process.env.HOME;
  let homeDir = '';

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'betterprompt-save-prefs-'));
    process.env.HOME = homeDir;
    resetConfig();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    resetConfig();
    if (homeDir) {
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it('merges prefs and stamps welcomeCompleted with the exact current timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-24T22:31:47.123Z'));

    const parsed = JSON.parse(await execute({
      selectedProjects: ['bp-parity-moneybook', 'bp-parity-youtube'],
      welcomeShown: true,
      welcomeVersion: '2.0',
      markWelcomeCompleted: true,
    }));

    expect(parsed.status).toBe('ok');
    expect(parsed.prefs.selectedProjects).toEqual(['bp-parity-moneybook', 'bp-parity-youtube']);
    expect(parsed.prefs.welcomeShown).toBe(true);
    expect(parsed.prefs.welcomeVersion).toBe('2.0');
    expect(parsed.prefs.welcomeCompleted).toBe('2026-03-24T22:31:47.123Z');
    expect(readPrefs().welcomeCompleted).toBe('2026-03-24T22:31:47.123Z');
  });

  it('returns noop when no fields are provided', async () => {
    const parsed = JSON.parse(await execute({}));

    expect(parsed.status).toBe('noop');
    expect(parsed.prefs).toEqual({});
  });

  it('normalizes welcomeVersion when the caller sends a JSON-encoded string literal', async () => {
    const parsed = JSON.parse(await execute({
      welcomeShown: true,
      welcomeVersion: '"2.0"',
    }));

    expect(parsed.status).toBe('ok');
    expect(parsed.prefs.welcomeVersion).toBe('2.0');
    expect(readPrefs().welcomeVersion).toBe('2.0');
  });

  it('queues analysis as pending when queueAnalysis is true', async () => {
    const parsed = JSON.parse(await execute({
      queueAnalysis: true,
    }));

    expect(parsed.status).toBe('ok');
    expect(parsed.analysisQueued).toBe(true);
    expect(parsed.message).toContain('queued analysis');

    const state = readState();
    expect(state.analysisState).toBe('pending');
    expect(state.analysisPending).toBe(true);
    expect(state.pendingSince).toBeTruthy();
  });

  it('does not queue analysis when queueAnalysis is omitted', async () => {
    const parsed = JSON.parse(await execute({
      starAsked: true,
    }));

    expect(parsed.status).toBe('ok');
    expect(parsed.analysisQueued).toBeUndefined();

    const state = readState();
    expect(state.analysisState).not.toBe('pending');
  });
});
