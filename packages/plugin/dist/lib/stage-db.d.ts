/**
 * Stage Database - SQLite storage for pipeline stage outputs
 *
 * Extends the results database with a stage_outputs table for
 * storing non-domain stage results (session summaries, project
 * summaries, weekly insights, etc.).
 *
 * @module plugin/lib/stage-db
 */
/** Save a stage output. Replaces existing output for same run+stage. */
export declare function saveStageOutput(runId: number, stage: string, data: unknown): void;
/** Get a stage output for a run. Returns null if not found. */
export declare function getStageOutput<T = unknown>(runId: number, stage: string): T | null;
/** Get all stage outputs for a run. */
export declare function getAllStageOutputs(runId: number): Record<string, unknown>;
/** Close the database connection. */
export declare function closeStageDb(): void;
