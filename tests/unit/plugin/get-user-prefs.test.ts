import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resetConfig } from '../../../packages/plugin/lib/config.js';
import { writePrefs } from '../../../packages/plugin/lib/prefs.js';
import { execute } from '../../../packages/plugin/mcp/tools/get-user-prefs.js';

describe('get_user_prefs tool', () => {
  const originalHome = process.env.HOME;
  let homeDir = '';

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'betterprompt-get-prefs-'));
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

  it('returns persisted user preferences without requiring direct file reads', async () => {
    writePrefs({
      selectedProjects: ['bp-parity-moneybook', 'bp-parity-youtube'],
      welcomeShown: true,
      welcomeVersion: '2.0',
    });

    const parsed = JSON.parse(await execute());

    expect(parsed.status).toBe('ok');
    expect(parsed.prefs.selectedProjects).toEqual(['bp-parity-moneybook', 'bp-parity-youtube']);
    expect(parsed.prefs.welcomeShown).toBe(true);
    expect(parsed.prefs.welcomeVersion).toBe('2.0');
  });
});
