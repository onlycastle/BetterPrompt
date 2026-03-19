#!/usr/bin/env node

/**
 * Background Analyzer
 *
 * @deprecated Removed in plugin-only cutover.
 * BetterPrompt no longer spawns detached analysis work or uploads sessions to a
 * Gemini-backed server pipeline. SessionEnd queues the next local Claude Code
 * run instead; use the queued `/bp-analyze` flow plus `sync_to_team` if needed.
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { getErrorLogPath } from './config.js';

function logError(message: string, error?: unknown): void {
  const logPath = getErrorLogPath();
  mkdirSync(dirname(logPath), { recursive: true });
  const timestamp = new Date().toISOString();
  const errorStr = error instanceof Error ? error.stack ?? error.message : String(error ?? '');
  appendFileSync(logPath, `[${timestamp}] ${message} ${errorStr}\n`);
}

async function run(): Promise<void> {
  const message = 'Background analyzer is removed. BetterPrompt now queues local Claude Code analysis for the next session; use `/bp-analyze` and `sync_to_team` instead.';
  logError(message);
  throw new Error(message);
}

run().catch((error) => {
  logError('Background analysis failed', error);
  process.exit(1);
});
