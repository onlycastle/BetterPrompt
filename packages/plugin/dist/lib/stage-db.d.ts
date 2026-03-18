/**
 * Stage Database - SQLite storage for pipeline stage outputs
 *
 * Reuses the shared database connection from results-db to avoid
 * dual-connection write contention on the same results.db file.
 *
 * @module plugin/lib/stage-db
 */
export declare const REQUIRED_STAGE_NAMES: readonly ["sessionSummaries", "thinkingQuality", "communicationPatterns", "learningBehavior", "contextEfficiency", "sessionOutcome", "projectSummaries", "weeklyInsights", "typeClassification", "evidenceVerification", "contentWriter"];
export type StageLifecycleStatus = 'validated' | 'failed' | 'running' | 'queued';
export interface StageStatusRecord {
    runId: number;
    stage: string;
    required: boolean;
    status: StageLifecycleStatus;
    attemptCount: number;
    lastError: string | null;
    updatedAt: string;
    createdAt: string;
}
export interface StageGateIssue {
    stage: string;
    required: boolean;
    status: StageLifecycleStatus | 'missing';
    attemptCount: number;
    lastError: string | null;
    updatedAt: string | null;
}
export declare function recordStageStatus(runId: number, stage: string, params: {
    status: StageLifecycleStatus;
    lastError?: string | null;
    required?: boolean;
}): void;
export declare function getStageStatuses(runId: number): StageStatusRecord[];
/** Save a stage output. Replaces existing output for same run+stage. */
export declare function saveStageOutput(runId: number, stage: string, data: unknown): void;
/** Get a stage output for a run. Returns null if not found. */
export declare function getStageOutput<T = unknown>(runId: number, stage: string): T | null;
/** Get all stage outputs for a run. */
export declare function getAllStageOutputs(runId: number): Record<string, unknown>;
export declare function getStageGateIssues(runId: number): StageGateIssue[];
/** No-op: connection lifecycle is managed by results-db. */
export declare function closeStageDb(): void;
