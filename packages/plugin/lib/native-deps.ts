/**
 * Shared native dependency installer.
 *
 * Ensures `better-sqlite3` is compiled and available in the persistent
 * plugin data directory.  Safe to call from multiple entry points
 * (SessionStart hook, MCP server startup) — a marker file prevents
 * redundant installs.
 */

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';

export function ensureNativeDeps(opts?: { fatal?: boolean }): void {
  const pluginDataDir = process.env.CLAUDE_PLUGIN_DATA || join(homedir(), '.betterprompt');

  const marker = join(pluginDataDir, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
  if (existsSync(marker)) return;

  try {
    execFileSync('npm', ['install', '--prefix', pluginDataDir, 'better-sqlite3@12.8.0'], {
      stdio: 'ignore',
      timeout: 60_000,
    });
  } catch (err) {
    const msg = `[betterprompt] Failed to install better-sqlite3: ${err instanceof Error ? err.message : err}`;
    if (opts?.fatal) {
      throw new Error(msg);
    }
    process.stderr.write(msg + '\n');
  }
}
