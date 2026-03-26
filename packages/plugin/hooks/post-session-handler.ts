#!/usr/bin/env node

/**
 * Session End Hook Handler
 *
 * Called by Claude Code when a session ends.
 * Checks debounce rules and marks analysis as pending for the next session.
 *
 * DEFERRED QUEUE PATTERN:
 * Instead of spawning a detached background process (which has no LLM host),
 * this hook simply marks analysis as "pending" in plugin-state.json.
 * The next Claude Code session detects the pending flag and runs the full
 * skill-based analysis pipeline with Claude Code as the LLM host.
 *
 * Exit codes:
 *   0 = hook ran successfully (analysis may or may not have been queued)
 *   1 = unexpected error
 *
 * This must be fast because SessionEnd hooks default to a 1.5s timeout.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../lib/config.js';
import {
  markAnalysisPending,
  recoverStaleAnalysisState,
  shouldTriggerAnalysis,
} from '../lib/debounce.js';
import {
  estimateSessionDurationMsFromTranscript,
  isInFlightTranscriptBoundary,
} from '../lib/hook-utils.js';
import { debug } from '../lib/logger.js';

export interface SessionEndHookInput {
  transcript_path?: string;
}

interface SessionEndHookDeps {
  getConfig: typeof getConfig;
  recoverStaleAnalysisState: typeof recoverStaleAnalysisState;
  shouldTriggerAnalysis: typeof shouldTriggerAnalysis;
  markAnalysisPending: typeof markAnalysisPending;
  estimateSessionDurationMsFromTranscript: typeof estimateSessionDurationMsFromTranscript;
  isInFlightTranscriptBoundary: typeof isInFlightTranscriptBoundary;
}

export interface SessionEndHookResult {
  queued: boolean;
  reason: string;
  durationMs: number;
}

const DEFAULT_DEPS: SessionEndHookDeps = {
  getConfig,
  recoverStaleAnalysisState,
  shouldTriggerAnalysis,
  markAnalysisPending,
  estimateSessionDurationMsFromTranscript,
  isInFlightTranscriptBoundary,
};

export function readHookInput(raw?: string): SessionEndHookInput {
  try {
    const payload = raw ?? readFileSync(0, 'utf-8').trim();
    return payload ? JSON.parse(payload) as SessionEndHookInput : {};
  } catch {
    return {};
  }
}

export function resolveSessionDurationMs(
  hookInput: SessionEndHookInput,
  env: NodeJS.ProcessEnv,
  estimateDuration: (transcriptPath: string) => number = estimateSessionDurationMsFromTranscript,
): number {
  return Number.parseInt(env.CLAUDE_SESSION_DURATION_MS ?? '0', 10)
    || (hookInput.transcript_path ? estimateDuration(hookInput.transcript_path) : 0);
}

export function handleSessionEndHook(
  hookInput: SessionEndHookInput,
  deps: SessionEndHookDeps = DEFAULT_DEPS,
  env: NodeJS.ProcessEnv = process.env,
): SessionEndHookResult {
  debug('hook', 'session-end');
  const config = deps.getConfig();

  // Skip if auto-analyze is disabled
  if (!config.autoAnalyze) {
    debug('hook', 'session-end: auto-analyze disabled');
    return {
      queued: false,
      reason: 'Auto-analysis disabled',
      durationMs: 0,
    };
  }

  const recoveredState = deps.recoverStaleAnalysisState({
    force: false,
    reason: 'Recovered stale running state on SessionEnd hook startup.',
  });

  const durationMs = resolveSessionDurationMs(
    hookInput,
    env,
    deps.estimateSessionDurationMsFromTranscript,
  );

  if (recoveredState.analysisState === 'running') {
    const stillActive = hookInput.transcript_path
      ? deps.isInFlightTranscriptBoundary(hookInput.transcript_path)
      : false;

    if (stillActive) {
      const reason = 'Analysis still appears to be mid-turn; skipping requeue for this SessionEnd event';
      debug('hook', 'session-end: running analysis still active, skipping requeue', { reason, durationMs });
      return {
        queued: false,
        reason,
        durationMs,
      };
    }

    const reason = 'Active analysis session ended before completion; queued resume for the next session';
    deps.markAnalysisPending();
    debug('hook', 'session-end: interrupted analysis re-queued', { reason, durationMs });
    return {
      queued: true,
      reason,
      durationMs,
    };
  }

  // Check debounce rules
  const result = deps.shouldTriggerAnalysis(durationMs);

  if (!result.shouldAnalyze) {
    debug('hook', 'session-end: analysis skipped', { reason: result.reason, durationMs });
    return {
      queued: false,
      reason: result.reason,
      durationMs,
    };
  }

  // Mark as pending for the next Claude Code session to pick up
  deps.markAnalysisPending();
  debug('hook', 'session-end: analysis queued', { reason: result.reason, durationMs });

  return {
    queued: true,
    reason: result.reason,
    durationMs,
  };
}

function main(): void {
  handleSessionEndHook(readHookInput());
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
