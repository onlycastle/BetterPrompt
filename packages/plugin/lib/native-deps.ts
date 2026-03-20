/**
 * Shared native dependency installer.
 *
 * Ensures `better-sqlite3` is compiled and available so that Node's
 * standard module resolution finds it at runtime.
 *
 * Primary strategy: install into `pluginRoot/node_modules/` so that
 * `require('better-sqlite3')` from `dist/` resolves naturally via
 * directory walking.  Fallback: `~/.betterprompt/node_modules/` for
 * callers that don't know the plugin root.
 *
 * Safe to call from multiple entry points (SessionStart hook, MCP
 * server startup) — a marker file prevents redundant installs.
 */

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';

export function ensureNativeDeps(opts?: { pluginRoot?: string; fatal?: boolean }): void {
  const installDir = opts?.pluginRoot ?? process.env.CLAUDE_PLUGIN_DATA ?? join(homedir(), '.betterprompt');

  const marker = join(installDir, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
  if (existsSync(marker)) return;

  try {
    execFileSync('npm', ['install', '--prefix', installDir, 'better-sqlite3@12.8.0'], {
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
