#!/usr/bin/env node

/**
 * Session Start Hook Handler
 *
 * Injects queued BetterPrompt auto-analysis context at session start so Claude
 * can consume the pending analysis run automatically in the next session.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAnalysisPending } from '../lib/debounce.js';
import { buildPendingAnalysisAdditionalContext, buildFirstRunAdditionalContext } from '../lib/hook-utils.js';
import { isFirstRun } from '../lib/prefs.js';
import { ensureNativeDeps } from '../lib/native-deps.js';
import { debug } from '../lib/logger.js';

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
  isFirstRun: () => boolean;
  buildFirstRunAdditionalContext: () => string;
  isAnalysisPending: () => boolean;
  buildPendingAnalysisAdditionalContext: () => string;
}

const DEFAULT_DEPS: SessionStartHookDeps = {
  isFirstRun,
  buildFirstRunAdditionalContext,
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
  debug('hook', 'session-start', { source: input.source });

  if (input.source === 'compact') {
    debug('hook', 'session-start: compact source, skipping');
    return null;
  }

  if (deps.isFirstRun()) {
    debug('hook', 'session-start: first run detected');
    return {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: deps.buildFirstRunAdditionalContext(),
      },
    };
  }

  if (deps.isAnalysisPending()) {
    debug('hook', 'session-start: pending analysis detected');
    return {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: deps.buildPendingAnalysisAdditionalContext(),
      },
    };
  }

  debug('hook', 'session-start: no action needed');
  return null;
}

function main(): void {
  const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  ensureNativeDeps({ pluginRoot });

  const output = handleSessionStartHook(readHookInput());
  if (!output) {
    process.exit(0);
  }

  process.stdout.write(JSON.stringify(output));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
