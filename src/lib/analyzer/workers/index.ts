/**
 * Workers Module Exports
 *
 * v2 Architecture:
 * - Phase 1: DataAnalyst, ProductivityAnalyst, QuoteExtractor (v2)
 * - Phase 2: KnowledgeGap, ContextEfficiency + v2 workers (StrengthGrowth, BehaviorPattern, TypeClassifier)
 * - Phase 2.5: TypeSynthesis
 *
 * @module analyzer/workers
 */

export * from './base-worker';

// ============================================================================
// Phase 1 Workers
// ============================================================================

// Legacy Phase 1 Workers (Module A, C - produce StructuredAnalysisData)
export { DataAnalystWorker, createDataAnalystWorker } from './data-analyst-worker';
export type { DataAnalystWorkerConfig } from './data-analyst-worker';

export { ProductivityAnalystWorker, createProductivityAnalystWorker } from './productivity-analyst-worker';
export type { ProductivityAnalystWorkerConfig } from './productivity-analyst-worker';

// v2 Phase 1 Worker (produces Phase1Output for v2 Phase 2 workers)
export { QuoteExtractorWorker, createQuoteExtractorWorker } from './quote-extractor-worker';
export type { QuoteExtractorWorkerConfig } from './quote-extractor-worker';

// ============================================================================
// Phase 2 Workers
// ============================================================================

// Legacy Phase 2 Workers (kept per v2 plan - use moduleAOutput)
export { KnowledgeGapWorker, createKnowledgeGapWorker } from './knowledge-gap-worker';
export type { KnowledgeGapWorkerConfig } from './knowledge-gap-worker';

export { ContextEfficiencyWorker, createContextEfficiencyWorker } from './context-efficiency-worker';
export type { ContextEfficiencyWorkerConfig } from './context-efficiency-worker';

// v2 Phase 2 Workers (use Phase1Output - context isolated)
export { StrengthGrowthWorker, createStrengthGrowthWorker } from './strength-growth-worker';
export type { StrengthGrowthWorkerConfig } from './strength-growth-worker';

export { BehaviorPatternWorker, createBehaviorPatternWorker } from './behavior-pattern-worker';
export type { BehaviorPatternWorkerConfig } from './behavior-pattern-worker';

export { TypeClassifierWorker, createTypeClassifierWorker } from './type-classifier-worker';
export type { TypeClassifierWorkerConfig } from './type-classifier-worker';

// ============================================================================
// Phase 2.5 Worker (Type Synthesis - runs after other Phase 2 workers)
// ============================================================================

export { TypeSynthesisWorker, createTypeSynthesisWorker } from './type-synthesis-worker';
export type { TypeSynthesisWorkerConfig, TypeSynthesisWorkerContext } from './type-synthesis-worker';

// ============================================================================
// Phase 2 Prompts
// ============================================================================

export * from './prompts/phase2-worker-prompts';
