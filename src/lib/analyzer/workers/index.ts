/**
 * Workers Module Exports
 *
 * Pipeline (7 LLM calls total):
 * - Phase 1: DataExtractor (deterministic, no LLM)
 * - Phase 2: StrengthGrowth, TrustVerification, WorkflowHabit, KnowledgeGap, ContextEfficiency (5 LLM calls)
 * - Phase 2.5: TypeClassifier (1 LLM call)
 * - Phase 3: ContentWriter (1 LLM call, managed by orchestrator)
 *
 * @module analyzer/workers
 */

export * from './base-worker';

// ============================================================================
// Phase 1: Data Extraction (deterministic, no LLM)
// ============================================================================

export { DataExtractorWorker, createDataExtractorWorker } from './data-extractor-worker';

// ============================================================================
// Phase 2: Insight Generation (5 workers, parallel LLM calls)
// ============================================================================

export { StrengthGrowthWorker, createStrengthGrowthWorker } from './strength-growth-worker';

export { TrustVerificationWorker, createTrustVerificationWorker } from './trust-verification-worker';

export { WorkflowHabitWorker, createWorkflowHabitWorker } from './workflow-habit-worker';

export { KnowledgeGapWorker, createKnowledgeGapWorker } from './knowledge-gap-worker';

export { ContextEfficiencyWorker, createContextEfficiencyWorker } from './context-efficiency-worker';

// ============================================================================
// Phase 2.5: TypeClassifier (classification + synthesis, 1 LLM call)
// ============================================================================

export { TypeClassifierWorker, createTypeClassifierWorker } from './type-classifier-worker';

// ============================================================================
// Phase 2 Prompts
// ============================================================================

export * from './prompts/phase2-worker-prompts';
