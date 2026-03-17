#!/usr/bin/env node

/**
 * Session Start Hook Handler
 *
 * Injects queued BetterPrompt auto-analysis context at session start so Claude
 * can consume the pending analysis run automatically in the next session.
 */

import { readFileSync } from 'node:fs';
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

function main(): void {
  const output = handleSessionStartHook(readHookInput());
  if (!output) {
    process.exit(0);
  }

  process.stdout.write(JSON.stringify(output));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
