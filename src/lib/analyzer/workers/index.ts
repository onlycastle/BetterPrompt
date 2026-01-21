/**
 * Workers Module Exports
 *
 * @module analyzer/workers
 */

export * from './base-worker';

// Phase 1 Workers (Module A, C wrappers - Module B removed)
export { DataAnalystWorker, createDataAnalystWorker } from './data-analyst-worker';
export type { DataAnalystWorkerConfig } from './data-analyst-worker';

export { ProductivityAnalystWorker, createProductivityAnalystWorker } from './productivity-analyst-worker';
export type { ProductivityAnalystWorkerConfig } from './productivity-analyst-worker';

// Phase 2 Workers (4 Wow Agents)
export { PatternDetectiveWorker, createPatternDetectiveWorker } from './pattern-detective-worker';
export type { PatternDetectiveWorkerConfig } from './pattern-detective-worker';

export { AntiPatternSpotterWorker, createAntiPatternSpotterWorker } from './anti-pattern-spotter-worker';
export type { AntiPatternSpotterWorkerConfig } from './anti-pattern-spotter-worker';

export { KnowledgeGapWorker, createKnowledgeGapWorker } from './knowledge-gap-worker';
export type { KnowledgeGapWorkerConfig } from './knowledge-gap-worker';

export { ContextEfficiencyWorker, createContextEfficiencyWorker } from './context-efficiency-worker';
export type { ContextEfficiencyWorkerConfig } from './context-efficiency-worker';

// Phase 2 Workers (NEW - Metacognition + Temporal Analysis)
export { MetacognitionWorker, createMetacognitionWorker } from './metacognition-worker';
export type { MetacognitionWorkerConfig } from './metacognition-worker';

export { TemporalAnalyzerWorker, createTemporalAnalyzerWorker } from './temporal-analyzer-worker';
export type { TemporalAnalyzerWorkerConfig } from './temporal-analyzer-worker';

export { MultitaskingAnalyzerWorker, createMultitaskingAnalyzerWorker } from './multitasking-analyzer-worker';
export type { MultitaskingAnalyzerWorkerConfig } from './multitasking-analyzer-worker';

// Phase 2.5 Worker (Type Synthesis - runs after other Phase 2 workers)
export { TypeSynthesisWorker, createTypeSynthesisWorker } from './type-synthesis-worker';
export type { TypeSynthesisWorkerConfig, TypeSynthesisWorkerContext } from './type-synthesis-worker';
