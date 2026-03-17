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
import { getConfig } from '../lib/config.js';
import { markAnalysisPending, recoverStaleAnalysisState, shouldTriggerAnalysis } from '../lib/debounce.js';
import { estimateSessionDurationMsFromTranscript } from '../lib/hook-utils.js';
export interface SessionEndHookInput {
    transcript_path?: string;
}
interface SessionEndHookDeps {
    getConfig: typeof getConfig;
    recoverStaleAnalysisState: typeof recoverStaleAnalysisState;
    shouldTriggerAnalysis: typeof shouldTriggerAnalysis;
    markAnalysisPending: typeof markAnalysisPending;
    estimateSessionDurationMsFromTranscript: typeof estimateSessionDurationMsFromTranscript;
}
export interface SessionEndHookResult {
    queued: boolean;
    reason: string;
    durationMs: number;
}
export declare function readHookInput(raw?: string): SessionEndHookInput;
export declare function resolveSessionDurationMs(hookInput: SessionEndHookInput, env: NodeJS.ProcessEnv, estimateDuration?: (transcriptPath: string) => number): number;
export declare function handleSessionEndHook(hookInput: SessionEndHookInput, deps?: SessionEndHookDeps, env?: NodeJS.ProcessEnv): SessionEndHookResult;
export {};
