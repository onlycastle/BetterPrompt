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
import { markAnalysisPending, recoverStaleAnalysisState, shouldTriggerAnalysis, } from '../lib/debounce.js';
import { estimateSessionDurationMsFromTranscript } from '../lib/hook-utils.js';
const DEFAULT_DEPS = {
    getConfig,
    recoverStaleAnalysisState,
    shouldTriggerAnalysis,
    markAnalysisPending,
    estimateSessionDurationMsFromTranscript,
};
export function readHookInput(raw) {
    try {
        const payload = raw ?? readFileSync(0, 'utf-8').trim();
        return payload ? JSON.parse(payload) : {};
    }
    catch {
        return {};
    }
}
export function resolveSessionDurationMs(hookInput, env, estimateDuration = estimateSessionDurationMsFromTranscript) {
    return Number.parseInt(env.CLAUDE_SESSION_DURATION_MS ?? '0', 10)
        || (hookInput.transcript_path ? estimateDuration(hookInput.transcript_path) : 0);
}
export function handleSessionEndHook(hookInput, deps = DEFAULT_DEPS, env = process.env) {
    const config = deps.getConfig();
    // Skip if auto-analyze is disabled
    if (!config.autoAnalyze) {
        return {
            queued: false,
            reason: 'Auto-analysis disabled',
            durationMs: 0,
        };
    }
    deps.recoverStaleAnalysisState({
        force: true,
        reason: 'Recovered stale running state on SessionEnd hook startup.',
    });
    const durationMs = resolveSessionDurationMs(hookInput, env, deps.estimateSessionDurationMsFromTranscript);
    // Check debounce rules
    const result = deps.shouldTriggerAnalysis(durationMs);
    if (!result.shouldAnalyze) {
        return {
            queued: false,
            reason: result.reason,
            durationMs,
        };
    }
    // Mark as pending for the next Claude Code session to pick up
    deps.markAnalysisPending();
    return {
        queued: true,
        reason: result.reason,
        durationMs,
    };
}
function main() {
    handleSessionEndHook(readHookInput());
    process.exit(0);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main();
}
//# sourceMappingURL=post-session-handler.js.map