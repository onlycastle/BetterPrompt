#!/usr/bin/env node
/**
 * Session Start Hook Handler
 *
 * Injects queued BetterPrompt auto-analysis context at session start so Claude
 * can consume the pending analysis run automatically in the next session.
 */
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
export declare function readHookInput(raw?: string): SessionStartHookInput;
export declare function handleSessionStartHook(input: SessionStartHookInput, deps?: SessionStartHookDeps): SessionStartHookOutput | null;
export {};
