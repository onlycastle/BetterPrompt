/**
 * Results Database - Local SQLite storage for analysis results
 *
 * Stores domain analysis results, type classification, and report data
 * at ~/.betterprompt/results.db. Separate from the insight cache DB
 * (insight-cache.db) which stores server-fetched summaries.
 *
 * @module plugin/lib/results-db
 */
import type { DomainResult, DeterministicScores, DeterministicTypeResult, Phase1SessionMetrics, AnalysisReport } from './core/types.js';
/** Create a new analysis run. Returns the run ID. */
export declare function createAnalysisRun(metrics: Phase1SessionMetrics, scores: DeterministicScores): number;
/** Get the current run ID from file cache, falling back to latest DB run */
export declare function getCurrentRunId(): number | null;
/** Get the latest analysis run ID */
export declare function getLatestRunId(): number | null;
/** Get analysis run by ID */
export declare function getAnalysisRun(runId: number): {
    id: number;
    analyzedAt: string;
    metrics: Phase1SessionMetrics;
    scores: DeterministicScores;
    typeResult: DeterministicTypeResult | null;
    content: AnalysisReport['content'] | null;
} | null;
/** Save a domain analysis result */
export declare function saveDomainResult(runId: number, result: DomainResult): void;
/** Get all domain results for a run */
export declare function getDomainResults(runId: number): DomainResult[];
/** Get a specific domain result */
export declare function getDomainResult(runId: number, domain: string): DomainResult | null;
/** Save type classification result */
export declare function saveTypeResult(runId: number, typeResult: DeterministicTypeResult): void;
/** Save content (topFocusAreas, personalitySummary) */
export declare function saveContent(runId: number, content: AnalysisReport['content']): void;
/** Assemble a complete analysis report from the latest run */
export declare function assembleReport(): AnalysisReport | null;
/** Close the database connection */
export declare function closeResultsDb(): void;
