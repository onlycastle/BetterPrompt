/**
 * Results Database - Local SQLite storage for canonical analysis runs.
 *
 * @module plugin/lib/results-db
 */
import type { CanonicalAnalysisRun, CanonicalEvaluationPayload, DeterministicScores, DeterministicTypeResult, DomainResult, Phase1Output, Phase1SessionMetrics, ReportActivitySession } from './core/types.js';
export declare function createAnalysisRun(params: {
    metrics: Phase1SessionMetrics;
    scores: DeterministicScores;
    phase1Output?: Phase1Output;
    activitySessions?: ReportActivitySession[];
    analyzedAt?: string;
}): number;
export declare function getCurrentRunId(): number | null;
export declare function getLatestRunId(): number | null;
export declare function getAnalysisRun(runId: number): {
    id: number;
    analyzedAt: string;
    metrics: Phase1SessionMetrics;
    scores: DeterministicScores;
    typeResult: DeterministicTypeResult | null;
    phase1Output: Phase1Output | null;
    activitySessions: ReportActivitySession[] | null;
    evaluation: CanonicalEvaluationPayload | null;
    content: Record<string, unknown> | null;
} | null;
export declare function saveDomainResult(runId: number, result: DomainResult): void;
export declare function getDomainResults(runId: number): DomainResult[];
export declare function getDomainResult(runId: number, domain: string): DomainResult | null;
export declare function saveTypeResult(runId: number, typeResult: DeterministicTypeResult): void;
export declare function saveContent(runId: number, content: Record<string, unknown>): void;
export declare function saveEvaluation(runId: number, evaluation: CanonicalEvaluationPayload): void;
export declare function assembleCanonicalRun(runId?: number | undefined): CanonicalAnalysisRun | null;
export declare function closeResultsDb(): void;
