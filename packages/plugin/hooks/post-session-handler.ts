#!/usr/bin/env node

/**
 * Post-Session Hook Handler
 *
 * Called by Claude Code after each session ends.
 * Checks debounce rules and spawns the background analyzer if needed.
 *
 * Exit codes:
 *   0 = hook ran successfully (analysis may or may not have been triggered)
 *   1 = unexpected error
 *
 * This must be fast (<100ms) — it runs synchronously in Claude Code's
 * hook pipeline, so we only check debounce rules and spawn a detached process.
 */

import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../lib/config.js';
import { shouldTriggerAnalysis, markAnalysisStarted } from '../lib/debounce.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function main(): void {
  const config = getConfig();

  // Skip if auto-analyze is disabled
  if (!config.autoAnalyze) {
    process.exit(0);
  }

  // Parse session duration from hook context (if provided via env)
  const durationMs = Number.parseInt(
    process.env.CLAUDE_SESSION_DURATION_MS ?? '0',
    10,
  ) || 0;

  // Check debounce rules
  const result = shouldTriggerAnalysis(durationMs);

  if (!result.shouldAnalyze) {
    // Silent exit — debounce rules not met
    process.exit(0);
  }

  // Mark as in-progress before spawning
  markAnalysisStarted();

  // Spawn background analyzer as a fully detached process
  const analyzerPath = join(__dirname, '..', 'lib', 'background-analyzer.js');

  const child = spawn('node', [analyzerPath], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      BETTERPROMPT_SERVER_URL: config.serverUrl,
      BETTERPROMPT_AUTH_TOKEN: config.authToken,
    },
  });

  // Detach so the hook can exit immediately
  child.unref();

  process.exit(0);
}

main();
