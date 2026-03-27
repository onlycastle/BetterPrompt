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
 * Safe to call from multiple entry points (SessionStart hook, CLI
 * startup) — a marker file prevents redundant installs.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { debug, info, error as logError } from './logger.js';

export function ensureNativeDeps(opts?: { pluginRoot?: string; fatal?: boolean }): void {
  const installDir = opts?.pluginRoot ?? join(homedir(), '.betterprompt');

  // Ensure the data directory exists before any install attempt
  const dataDir = join(homedir(), '.betterprompt');
  try {
    mkdirSync(dataDir, { recursive: true });
  } catch {
    // best-effort — directory may already exist
  }

  const marker = join(installDir, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
  if (existsSync(marker)) {
    debug('native-deps', 'marker found, skipping install', { installDir });
    return;
  }

  info('native-deps', 'installing better-sqlite3', { installDir });
  try {
    // Capture output for diagnostics instead of silently ignoring
    const output = execFileSync('npm', ['install', '--prefix', installDir, 'better-sqlite3@12.8.0'], {
      timeout: 120_000,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (output) {
      debug('native-deps', 'npm output', { output: output.slice(0, 500) });
    }
    info('native-deps', 'install succeeded');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const stderr = (err as { stderr?: string }).stderr ?? '';
    logError('native-deps', 'install failed', {
      error: errorMsg,
      ...(stderr ? { stderr: stderr.slice(0, 1000) } : {}),
      hint: 'Ensure Node.js >=18 and build tools are available (Xcode CLI on macOS, build-essential on Linux)',
    });
    if (opts?.fatal) {
      throw new Error(
        `[betterprompt] Failed to install better-sqlite3: ${errorMsg}\n` +
        (stderr ? `npm stderr: ${stderr.slice(0, 500)}\n` : '') +
        'Hint: Ensure Node.js >=18 and build tools are installed (macOS: xcode-select --install)',
      );
    }
  }
}
