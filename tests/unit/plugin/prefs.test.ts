import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resetConfig } from '../../../packages/plugin/lib/config.js';
import { readPrefs, writePrefs, isFirstRun } from '../../../packages/plugin/lib/prefs.js';

describe('plugin user preferences', () => {
  const originalHome = process.env.HOME;
  let homeDir = '';

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'betterprompt-prefs-'));
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

  it('returns empty object when prefs file does not exist', () => {
    expect(readPrefs()).toEqual({});
  });

  it('writes and reads preferences', () => {
    writePrefs({ welcomeShown: true, welcomeVersion: '1.0' });

    const prefs = readPrefs();
    expect(prefs.welcomeShown).toBe(true);
    expect(prefs.welcomeVersion).toBe('1.0');
  });

  it('merges with existing preferences on write', () => {
    writePrefs({ welcomeShown: true });
    writePrefs({ starAsked: true });

    const prefs = readPrefs();
    expect(prefs.welcomeShown).toBe(true);
    expect(prefs.starAsked).toBe(true);
  });

  it('creates ~/.betterprompt directory if it does not exist', () => {
    writePrefs({ welcomeShown: true });

    const raw = readFileSync(join(homeDir, '.betterprompt', 'prefs.json'), 'utf-8');
    expect(JSON.parse(raw)).toEqual({ welcomeShown: true });
  });

  it('isFirstRun returns true when welcomeCompleted is not set', () => {
    expect(isFirstRun()).toBe(true);
  });

  it('isFirstRun returns true when prefs file does not exist', () => {
    expect(isFirstRun()).toBe(true);
  });

  it('isFirstRun returns false after welcomeCompleted is written', () => {
    writePrefs({ welcomeCompleted: new Date().toISOString() });
    expect(isFirstRun()).toBe(false);
  });
});
