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
const DEFAULT_DEPS = {
    isAnalysisPending,
    buildPendingAnalysisAdditionalContext,
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
export function handleSessionStartHook(input, deps = DEFAULT_DEPS) {
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
function main() {
    const output = handleSessionStartHook(readHookInput());
    if (!output) {
        process.exit(0);
    }
    process.stdout.write(JSON.stringify(output));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main();
}
//# sourceMappingURL=session-start-handler.js.map