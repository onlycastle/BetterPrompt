/**
 * Workers Module Exports
 *
 * Pipeline (7 LLM calls total):
 * - Phase 1: DataExtractor (deterministic, no LLM)
 * - Phase 2: ThinkingQuality, CommunicationPatterns, LearningBehavior, ContextEfficiency, SessionOutcome (5 LLM calls)
 *            Each worker outputs capability-specific strengths/growthAreas directly
 * - Phase 2.5: TypeClassifier only (1 LLM call)
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
// Phase 2: Unified Workers (Capability-based, 5 workers)
// ============================================================================

/** ThinkingQuality: Planning + Critical Thinking */
export { ThinkingQualityWorker, createThinkingQualityWorker } from './thinking-quality-worker';

/** CommunicationPatterns: Communication patterns + Signature quotes */
export { CommunicationPatternsWorker, createCommunicationPatternsWorker } from './communication-patterns-worker';

/** LearningBehavior: Knowledge Gaps + Repeated Mistakes */
export { LearningBehaviorWorker, createLearningBehaviorWorker } from './learning-behavior-worker';

/** ContextEfficiency: Token usage and context management */
export { ContextEfficiencyWorker, createContextEfficiencyWorker } from './context-efficiency-worker';

/** SessionOutcome: Goals, friction, success rates (inspired by Claude /insights) */
export { SessionOutcomeWorker, createSessionOutcomeWorker } from './session-outcome-worker';

// ============================================================================
// Phase 2.5: TypeClassifier only (1 LLM call)
// ============================================================================

export { TypeClassifierWorker, createTypeClassifierWorker } from './type-classifier-worker';
