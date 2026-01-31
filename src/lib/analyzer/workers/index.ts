/**
 * Workers Module Exports
 *
 * Pipeline (7 LLM calls total):
 * - Phase 1: DataExtractor (deterministic, no LLM)
 * - Phase 2: TrustVerification, WorkflowHabit, KnowledgeGap, ContextEfficiency, CommunicationPatterns (5 LLM calls)
 *            Each worker outputs domain-specific strengths/growthAreas directly
 * - Phase 2.5: TypeClassifier only (1 LLM call)
 *            StrengthGrowthSynthesizer REMOVED - workers output insights directly
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
// Each worker outputs domain-specific strengths/growthAreas directly
// ============================================================================

export { TrustVerificationWorker, createTrustVerificationWorker } from './trust-verification-worker';

export { WorkflowHabitWorker, createWorkflowHabitWorker } from './workflow-habit-worker';

export { KnowledgeGapWorker, createKnowledgeGapWorker } from './knowledge-gap-worker';

export { ContextEfficiencyWorker, createContextEfficiencyWorker } from './context-efficiency-worker';

export { CommunicationPatternsWorker, createCommunicationPatternsWorker } from './communication-patterns-worker';

// ============================================================================
// Phase 2.5: TypeClassifier only (1 LLM call)
// StrengthGrowthSynthesizer REMOVED - insights come from Phase 2 workers directly
// ============================================================================

export { TypeClassifierWorker, createTypeClassifierWorker } from './type-classifier-worker';
