#!/usr/bin/env node

/**
 * Session Start Hook Handler
 *
 * Injects queued BetterPrompt auto-analysis context at session start so Claude
 * can consume the pending analysis run automatically in the next session.
 */

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAnalysisPending } from '../lib/debounce.js';
import { buildPendingAnalysisAdditionalContext } from '../lib/hook-utils.js';

export interface SessionStartHookInput {
  source?: 'startup' | 'resume' | 'clear' | 'compact';
}

export interface SessionStartHookOutput {
  hookSpecificOutput: {
    hookEventName: 'SessionStart';
    additionalContext: string;
  };
}

interface SessionStartHookDeps {
  isAnalysisPending: () => boolean;
  buildPendingAnalysisAdditionalContext: () => string;
}

const DEFAULT_DEPS: SessionStartHookDeps = {
  isAnalysisPending,
  buildPendingAnalysisAdditionalContext,
};

export function readHookInput(raw?: string): SessionStartHookInput {
  try {
    const payload = raw ?? readFileSync(0, 'utf-8').trim();
    return payload ? JSON.parse(payload) as SessionStartHookInput : {};
  } catch {
    return {};
  }
}

export function handleSessionStartHook(
  input: SessionStartHookInput,
  deps: SessionStartHookDeps = DEFAULT_DEPS,
): SessionStartHookOutput | null {
  if (!deps.isAnalysisPending() || input.source === 'compact') {
    return null;
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: deps.buildPendingAnalysisAdditionalContext(),
    },
  };
}

/**
 * Ensure native dependencies are installed in the persistent plugin data directory.
 * Runs once on first session; subsequent sessions skip (directory exists).
 */
function ensureNativeDeps(): void {
  const pluginDataDir = process.env.CLAUDE_PLUGIN_DATA;
  if (!pluginDataDir) return;

  const marker = join(pluginDataDir, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
  if (existsSync(marker)) return;

  try {
    execFileSync('npm', ['install', '--prefix', pluginDataDir, 'better-sqlite3@12.8.0'], {
      stdio: 'ignore',
      timeout: 60_000,
    });
  } catch (err) {
    process.stderr.write(`[betterprompt] Failed to install better-sqlite3: ${err instanceof Error ? err.message : err}\n`);
  }
}

function main(): void {
  ensureNativeDeps();

  const output = handleSessionStartHook(readHookInput());
  if (!output) {
    process.exit(0);
  }

  process.stdout.write(JSON.stringify(output));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
