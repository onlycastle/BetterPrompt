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
export interface PluginState {
    lastAnalysisTimestamp: string | null;
    lastAnalysisSessionCount: number;
    analysisInProgress: boolean;
}
export declare function readState(): PluginState;
export declare function writeState(state: PluginState): void;
export interface DebounceResult {
    shouldAnalyze: boolean;
    reason: string;
}
/**
 * Evaluate all debounce rules.
 *
 * @param sessionDurationMs - Duration of the just-ended session in milliseconds.
 *   Pass 0 if unknown (e.g. manual trigger).
 */
export declare function shouldTriggerAnalysis(sessionDurationMs: number): DebounceResult;
/**
 * Mark analysis as in-progress. Called before spawning background analyzer.
 */
export declare function markAnalysisStarted(): void;
/**
 * Mark analysis as complete. Called by background analyzer on success.
 */
export declare function markAnalysisComplete(): void;
/**
 * Clear the in-progress flag. Called on failure or crash recovery.
 */
export declare function markAnalysisFailed(): void;
