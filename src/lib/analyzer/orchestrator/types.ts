/**
 * Orchestrator Types - Core types for Orchestrator + Workers pattern
 *
 * Defines:
 * - WorkerResult: Standard result wrapper for all workers
 * - WorkerContext: Shared context passed between phases
 * - OrchestratorConfig: Configuration for the orchestrator
 *
 * @module analyzer/orchestrator/types
 */

import type { TokenUsage } from '../clients/gemini-client';
import type { ParsedSession, SessionMetrics } from '../../domain/models/analysis';
import type { VerboseEvaluation } from '../../models/verbose-evaluation';
import type { Tier } from '../content-gateway';
import type { SupportedLanguage } from '../stages/content-writer-prompts';
import { getAgentConfig, type AgentId } from '../../domain/models';
import type { IKnowledgeRepository, IProfessionalInsightRepository } from '../../application/ports/storage';
import type { DeterministicScores } from '../stages/deterministic-scorer';
import type { DeterministicTypeResult } from '../stages/deterministic-type-mapper';

// ============================================================================
// Progress Callback
// ============================================================================

/**
 * Callback for reporting real pipeline progress to the caller.
 *
 * Fired after each discrete phase/worker completion so the caller can
 * display honest progress (not simulated).
 *
 * @param stage - Pipeline stage identifier (e.g., "phase1", "phase2_worker", "phase3")
 * @param progress - Progress percentage (0-100)
 * @param message - Human-readable status message
 */
export type ProgressCallback = (stage: string, progress: number, message: string) => void;

// ============================================================================
// Phase Preview (Live Results for CLI Chat Display)
// ============================================================================

/**
 * Preview snippet shown in CLI chat during analysis.
 *
 * Each phase completion emits 1-3 snippets summarizing the result,
 * displayed as streaming chat messages in the terminal.
 */
export interface PreviewSnippet {
  /** Human-readable label, e.g. "Systematic Output Verification" */
  label: string;
  /** Description text, e.g. "You verify AI outputs before committing" */
  text: string;
  /** Emoji icon, e.g. "💪" or "💡" */
  icon: string;
}

/**
 * Callback invoked when a phase completes with preview data for the CLI.
 *
 * @param phase - Phase key (e.g. "session_summaries", "worker_thinkingQuality", "type_classification")
 * @param snippets - Preview snippets to display
 */
export type PhasePreviewCallback = (phase: string, snippets: PreviewSnippet[]) => void;

// ============================================================================
// Worker Result Types
// ============================================================================

/**
 * Standard result wrapper for all workers
 *
 * @template T - The data type produced by the worker
 *
 * @example
 * ```typescript
 * const result: WorkerResult<Phase1Output> = {
 *   data: analysisData,
 *   usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
 * };
 * ```
 */
export interface WorkerResult<T> {
  /** The worker's output data */
  data: T;

  /** Token usage for this worker (null if not tracked or failed) */
  usage: TokenUsage | null;

  /** Error if the worker failed (data will be default/fallback) */
  error?: Error;
}

/**
 * Status of a worker execution
 */
export type WorkerStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Extended result with status information
 */
export interface WorkerResultWithStatus<T> extends WorkerResult<T> {
  /** Worker name for identification */
  workerName: string;

  /** Execution status */
  status: WorkerStatus;

  /** Duration in milliseconds */
  durationMs?: number;
}

// ============================================================================
// Worker Context Types
// ============================================================================

/**
 * Shared context passed to all workers
 *
 * Phase 1 workers receive base context (sessions, metrics, tier).
 * Phase 2 workers receive base context + phase1Output.
 * Phase 2.5 workers receive base context + phase1Output + agentOutputs.
 * Phase 3 (ContentWriter) receives phase1Output + agentOutputs.
 *
 * @example
 * ```typescript
 * const baseContext: WorkerContext = {
 *   sessions,
 *   metrics,
 *   tier: 'pro',
 * };
 * ```
 */
export interface WorkerContext {
  /** Raw parsed sessions */
  sessions: ParsedSession[];

  /** Computed session metrics */
  metrics: SessionMetrics;

  /** User tier level */
  tier: Tier;

  // ─────────────────────────────────────────────────────────────────────────
  // Language Detection (for i18n support)
  // ─────────────────────────────────────────────────────────────────────────

  /** Output language detected from user prompts (defaults to 'en') */
  outputLanguage?: SupportedLanguage;

  // ─────────────────────────────────────────────────────────────────────────
  // Deterministic Scoring (rubric-based, consistent across runs)
  // ─────────────────────────────────────────────────────────────────────────

  /** Pre-computed deterministic scores from Phase 1 metrics (rubric-based) */
  deterministicScores?: DeterministicScores;

  /** Pre-computed deterministic type classification (rule-based) */
  deterministicTypeResult?: DeterministicTypeResult;
}

// ============================================================================
// Phase 2 Worker Context
// ============================================================================

import type { Phase1Output } from '../../models/phase1-output';
export type { Phase1Output };

/**
 * Extended WorkerContext for Phase 2 workers that require Phase 1 output
 *
 * In the v2 architecture, Phase 2 workers receive ONLY Phase 1 output
 * (not raw sessions). This is enforced by the orchestrator.
 */
export interface Phase2WorkerContext extends WorkerContext {
  /** Phase 1 extraction output (REQUIRED for Phase 2 workers) */
  phase1Output?: Phase1Output;
}

// ============================================================================
// v2 Architecture Context Types
// ============================================================================

/**
 * Context for v2 Phase 2 workers (Context Isolation)
 *
 * IMPORTANT: v2 Phase 2 workers do NOT receive raw sessions.
 * They receive ONLY the Phase 1 output from DataExtractor.
 *
 * This enforces the architectural principle:
 * - Phase 1 = Pure Extraction (no semantic analysis)
 * - Phase 2 = Semantic Analysis (on extracted data only)
 *
 * Benefits:
 * - Clean separation of concerns
 * - Easier testing (mock Phase 1 output)
 * - Prevents bypassing extraction layer
 */
export interface Phase2V2WorkerContext {
  /** Phase 1 extraction output (REQUIRED) */
  phase1Output: Phase1Output;

  /** User tier level */
  tier: Tier;

  // NOTE: No outputLanguage - Phase 2 v2 workers ALWAYS output English
  // Translation happens in Phase 3 (ContentWriter) only

  // NOTE: No sessions - raw data access is FORBIDDEN for Phase 2 v2 workers
  // This is intentional to enforce context isolation
}

/**
 * Type guard to check if context is v2 Phase 2 context
 */
export function isPhase2V2Context(context: unknown): context is Phase2V2WorkerContext {
  if (typeof context !== 'object' || context === null) return false;
  const ctx = context as Record<string, unknown>;
  return (
    'phase1Output' in ctx &&
    typeof ctx.phase1Output === 'object' &&
    ctx.phase1Output !== null &&
    'tier' in ctx
  );
}

// ============================================================================
// Phase Types
// ============================================================================

/**
 * Analysis pipeline phases
 *
 * - Phase 1: DataExtractor (deterministic)
 * - Phase 2: 5 Insight workers (parallel)
 * - Phase 2.5: StrengthGrowthSynthesizer → TypeClassifier (sequential)
 * - Phase 3: ContentWriter
 */
export type Phase = 1 | 2 | 3;

/**
 * Phase configuration
 */
export interface PhaseConfig {
  /** Phase number */
  phase: Phase;

  /** Human-readable name */
  name: string;

  /** Whether workers in this phase run in parallel */
  parallel: boolean;
}

/**
 * Default phase configurations
 */
export const PHASE_CONFIGS: Record<Phase, PhaseConfig> = {
  1: { phase: 1, name: 'Data Extraction', parallel: true },
  2: { phase: 2, name: 'Insight Generation', parallel: true },
  3: { phase: 3, name: 'Content Generation', parallel: false },
};

// ============================================================================
// Debug Output Types
// ============================================================================

/**
 * Output captured from a single pipeline phase for debugging
 *
 * When `debug: true` is set in OrchestratorConfig, each phase's output
 * is captured into this structure for later inspection.
 */
export interface DebugPhaseOutput {
  /** Phase identifier (e.g., "phase1", "phase2_StrengthGrowth", "phase3") */
  phase: string;

  /** Human-readable phase name (e.g., "DataExtractor", "ContentWriter") */
  phaseName: string;

  /** ISO timestamp when this phase completed */
  completedAt: string;

  /** Duration of this phase in milliseconds */
  durationMs: number;

  /** The phase's raw output data */
  data: unknown;

  /** Token usage for this phase (null for deterministic phases) */
  tokenUsage: TokenUsage | null;
}

// ============================================================================
// Orchestrator Configuration
// ============================================================================

/**
 * Configuration for the AnalysisOrchestrator
 */
export interface OrchestratorConfig {
  /** Gemini API key for workers */
  geminiApiKey: string;

  /** Model to use (default: gemini-3-flash-preview) */
  model?: string;

  /** Temperature for LLM calls (default: 1.0) */
  temperature?: number;

  /** Max output tokens (default: 65536) */
  maxOutputTokens?: number;

  /** Max retries for failed workers (default: 2) */
  maxRetries?: number;

  /** Whether to continue if a worker fails (default: true) */
  continueOnWorkerFailure?: boolean;

  /** Log worker progress (default: false) */
  verbose?: boolean;

  /** Collect intermediate phase outputs for debugging (default: false) */
  debug?: boolean;

  /** Knowledge repository for Phase 2.75 resource matching (optional — skipped if not provided) */
  knowledgeRepo?: IKnowledgeRepository;

  /** Professional insight repository for Phase 2.75 resource matching (optional — skipped if not provided) */
  professionalInsightRepo?: IProfessionalInsightRepository;
}

/**
 * Default orchestrator configuration
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: Required<Omit<OrchestratorConfig, 'geminiApiKey' | 'knowledgeRepo' | 'professionalInsightRepo'>> = {
  model: 'gemini-3-flash-preview',
  temperature: 1.0,
  maxOutputTokens: 65536,
  maxRetries: 2,
  continueOnWorkerFailure: true,
  verbose: false,
  debug: false,
};

// ============================================================================
// Phase Results Types
// ============================================================================

/**
 * Results from Phase 1 (Data Extraction)
 */
export interface Phase1Results {
  /** DataExtractor output for Phase 2 workers */
  dataExtractor: WorkerResult<Phase1Output>;
}

// ============================================================================
// v3 Architecture Phase Results Types
// ============================================================================

import type { TypeClassifierOutput, KnowledgeGapOutput, ContextEfficiencyOutput } from '../../models/agent-outputs';
import type { ThinkingQualityOutput } from '../../models/thinking-quality-data';
import type { LearningBehaviorOutput } from '../../models/learning-behavior-data';

/**
 * Results from Phase 2 workers (v3 Context Isolated)
 *
 * These workers receive only Phase 1 output (no raw sessions).
 */
export interface Phase2V3Results {
  /** Thinking Quality analysis (planning + critical thinking + communication) */
  thinkingQuality?: WorkerResult<ThinkingQualityOutput>;

  /** Learning Behavior analysis (knowledge gaps + repeated mistakes) */
  learningBehavior?: WorkerResult<LearningBehaviorOutput>;

  /** Context Efficiency analysis */
  contextEfficiency?: WorkerResult<ContextEfficiencyOutput>;

  /** Knowledge Gap analysis (legacy, kept for cached data) */
  knowledgeGap?: WorkerResult<KnowledgeGapOutput>;

  /** Type Classification (Phase 2.5) */
  typeClassifier?: WorkerResult<TypeClassifierOutput>;
}

// ============================================================================
// Analysis Result (Pipeline Output)
// ============================================================================

/**
 * Complete analysis pipeline result
 *
 * Bundles VerboseEvaluation with Phase1Output so that:
 * - Phase1Output can be stored in DB for evidence auditing
 * - Phase1Output can be used for deterministic evidence verification
 * - Callers don't need to track Phase1Output separately
 */
export interface AnalysisResult {
  /** The final evaluation (tier-filtered) */
  evaluation: VerboseEvaluation;

  /** Raw Phase 1 extraction output (for DB storage and evidence auditing) */
  phase1Output: Phase1Output;

  /** Intermediate phase outputs for debugging (only present when debug: true) */
  debugOutputs?: DebugPhaseOutput[];
}

// ============================================================================
// Token Usage Aggregation
// ============================================================================

/**
 * Aggregated token usage across all phases
 */
export interface AggregatedTokenUsage {
  /** Total prompt tokens */
  totalPromptTokens: number;

  /** Total completion tokens */
  totalCompletionTokens: number;

  /** Total tokens */
  totalTokens: number;

  /** Breakdown by worker */
  byWorker: Record<string, TokenUsage>;
}

/**
 * Aggregate token usage from multiple worker results
 */
export function aggregateWorkerTokenUsage(
  results: Record<string, WorkerResult<unknown>>
): AggregatedTokenUsage {
  const aggregated: AggregatedTokenUsage = {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    byWorker: {},
  };

  for (const [workerName, result] of Object.entries(results)) {
    if (result.usage) {
      aggregated.totalPromptTokens += result.usage.promptTokens;
      aggregated.totalCompletionTokens += result.usage.completionTokens;
      aggregated.totalTokens += result.usage.totalTokens;
      aggregated.byWorker[workerName] = result.usage;
    }
  }

  return aggregated;
}

// ============================================================================
// Confidence Aggregation
// ============================================================================

/**
 * Confidence score from a single agent
 */
export interface AgentConfidenceScore {
  agentId: string;
  agentName: string;
  confidenceScore: number;
}

/**
 * Aggregated analysis metadata with confidence scores
 */
export interface AnalysisMetadataResult {
  /** Overall confidence (weighted average of agent scores) */
  overallConfidence: number;
  /** Individual agent confidence scores */
  agentConfidences: AgentConfidenceScore[];
  /** Data quality indicator based on session count */
  dataQuality: 'high' | 'medium' | 'low';
  /** Total messages analyzed */
  totalMessagesAnalyzed: number;
  /** Minimum confidence threshold applied */
  confidenceThreshold: number;
  /** Number of insights filtered due to low confidence */
  insightsFiltered: number;
}

/**
 * Default confidence threshold (0.70)
 * Insights with confidence below this are filtered or flagged
 */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.70;

export function calculateDataQuality(sessionCount: number): 'high' | 'medium' | 'low' {
  if (sessionCount >= 10) return 'high';
  if (sessionCount >= 5) return 'medium';
  return 'low';
}

/**
 * Extract confidence score from an agent output object
 *
 * @param output - Agent output that may contain confidenceScore
 * @returns Confidence score (0-1) or undefined if not found
 */
export function extractConfidence(output: unknown): number | undefined {
  if (typeof output !== 'object' || output === null) return undefined;
  const conf = (output as Record<string, unknown>).confidenceScore;
  return typeof conf === 'number' && conf >= 0 && conf <= 1 ? conf : undefined;
}

/**
 * Aggregate confidence scores from all agent outputs
 *
 * @param agentOutputs - Object containing all agent outputs
 * @param sessions - Sessions for message counting
 * @param threshold - Minimum confidence threshold
 * @returns Aggregated analysis metadata
 */
export function aggregateConfidenceScores(
  agentOutputs: Record<string, unknown>,
  sessions: ParsedSession[],
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD
): AnalysisMetadataResult {
  const agentConfidences: AgentConfidenceScore[] = [];
  let totalConfidence = 0;
  let countWithConfidence = 0;
  let insightsFiltered = 0;

  for (const [agentId, output] of Object.entries(agentOutputs)) {
    if (!output) continue;

    // Handle nested structure (e.g., temporalAnalysis.insights)
    let confidence = extractConfidence(output);
    if (confidence === undefined) {
      const nested = (output as Record<string, unknown>).insights;
      confidence = extractConfidence(nested);
    }

    if (confidence !== undefined) {
      // Get agent name from single source of truth (agent-config.ts)
      const config = getAgentConfig(agentId as AgentId);
      agentConfidences.push({
        agentId,
        agentName: config?.name ?? agentId,
        confidenceScore: confidence,
      });

      totalConfidence += confidence;
      countWithConfidence++;

      // Count insights that would be filtered
      if (confidence < threshold) {
        insightsFiltered++;
      }
    }
  }

  // Calculate overall confidence (weighted average)
  const overallConfidence = countWithConfidence > 0
    ? Math.round((totalConfidence / countWithConfidence) * 100) / 100
    : 0;

  // Count total messages
  const totalMessagesAnalyzed = sessions.reduce(
    (sum, s) => sum + s.messages.length,
    0
  );

  return {
    overallConfidence,
    agentConfidences,
    dataQuality: calculateDataQuality(sessions.length),
    totalMessagesAnalyzed,
    confidenceThreshold: threshold,
    insightsFiltered,
  };
}
