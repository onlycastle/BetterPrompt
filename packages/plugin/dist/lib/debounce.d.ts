/**
 * Debounce Logic
 *
 * Determines whether an auto-analysis should be triggered based on:
 *   1. Cooldown: ≥4 hours since last analysis
 *   2. Threshold: ≥N new sessions since last analysis (configurable)
 *   3. Duration: Just-ended session was ≥3 minutes
 *   4. Guard: No analysis already in progress
 *
 * State tracked in ~/.betterprompt/plugin-state.json
 */
export type AnalysisLifecycleState = 'idle' | 'pending' | 'running' | 'complete' | 'failed';
export interface PluginState {
    lastAnalysisTimestamp: string | null;
    lastAnalysisSessionCount: number;
    analysisState: AnalysisLifecycleState;
    analysisInProgress: boolean;
    /** Set by post-session hook; cleared when next Claude Code session runs analysis */
    analysisPending: boolean;
    /** ISO timestamp when analysis was queued */
    pendingSince: string | null;
    lastError: string | null;
    stateUpdatedAt: string | null;
}
export declare function readState(): PluginState;
export declare function writeState(state: PluginState): void;
export interface DebounceResult {
    shouldAnalyze: boolean;
    reason: string;
}
export declare function getAnalysisLifecycleState(): AnalysisLifecycleState;
export declare function recoverStaleAnalysisState(options?: {
    force?: boolean;
    reason?: string;
}): PluginState;
/**
 * Evaluate all debounce rules.
 *
 * @param sessionDurationMs - Duration of the just-ended session in milliseconds.
 *   Pass 0 if unknown (e.g. manual trigger).
 */
export declare function shouldTriggerAnalysis(sessionDurationMs: number): DebounceResult;
/**
 * Mark analysis as in-progress. Called when the queued local analysis starts.
 */
export declare function markAnalysisStarted(): void;
/**
 * Mark analysis as complete. Called after the local pipeline finishes successfully.
 */
export declare function markAnalysisComplete(sessionCount?: number): void;
/**
 * Clear the in-progress flag. Called on failure or crash recovery.
 */
export declare function markAnalysisFailed(error?: unknown): void;
/**
 * Mark analysis as pending for next Claude Code session.
 * Called by the post-session hook instead of spawning a background process.
 */
export declare function markAnalysisPending(): void;
/**
 * Check if there is a pending analysis queued by a previous session's hook.
 */
export declare function isAnalysisPending(): boolean;
/**
 * Clear the pending flag. Called when the pending analysis starts or is dismissed.
 */
export declare function clearAnalysisPending(): void;
