/**
 * Stage Database - SQLite storage for pipeline stage outputs
 *
 * Reuses the shared database connection from results-db to avoid
 * dual-connection write contention on the same results.db file.
 *
 * @module plugin/lib/stage-db
 */
/** Save a stage output. Replaces existing output for same run+stage. */
export declare function saveStageOutput(runId: number, stage: string, data: unknown): void;
/** Get a stage output for a run. Returns null if not found. */
export declare function getStageOutput<T = unknown>(runId: number, stage: string): T | null;
/** Get all stage outputs for a run. */
export declare function getAllStageOutputs(runId: number): Record<string, unknown>;
/** No-op: connection lifecycle is managed by results-db. */
export declare function closeStageDb(): void;
