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
import type { StructuredAnalysisData } from '../../models/analysis-data';
import type { ProductivityAnalysisData } from '../../models/productivity-data';
import type { Tier } from '../content-gateway';
import type { SupportedLanguage } from '../stages/content-writer-prompts';
import { getAgentConfig, type AgentId } from '../../domain/models';

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
 * const result: WorkerResult<StructuredAnalysisData> = {
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
 * Phase 1 workers receive base context.
 * Phase 2 workers receive base context + Phase 1 outputs.
 * Phase 3 workers receive everything.
 *
 * @example
 * ```typescript
 * // Phase 1 context
 * const phase1Context: WorkerContext = {
 *   sessions,
 *   metrics,
 *   tier: 'premium',
 * };
 *
 * // Phase 2 context (after Phase 1 completes)
 * const phase2Context: WorkerContext = {
 *   ...phase1Context,
 *   moduleAOutput: dataAnalystResult.data,
 *   moduleCOutput: productivityResult.data,
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
  // Phase 1 Outputs (available in Phase 2+)
  // ─────────────────────────────────────────────────────────────────────────

  /** Module A (Data Analyst) output */
  moduleAOutput?: StructuredAnalysisData;

  /** Module C (Productivity Analyst) output */
  moduleCOutput?: ProductivityAnalysisData;
}

// ============================================================================
// Phase Types
// ============================================================================

/**
 * Analysis pipeline phases
 *
 * - Phase 1: Data Extraction (Module A, C run in parallel)
 * - Phase 2: Insight Generation (4 Wow Agents run in parallel)
 * - Phase 3: Content Generation (ContentWriter)
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
}

/**
 * Default orchestrator configuration
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: Required<Omit<OrchestratorConfig, 'geminiApiKey'>> = {
  model: 'gemini-3-flash-preview',
  temperature: 1.0,
  maxOutputTokens: 65536,
  maxRetries: 2,
  continueOnWorkerFailure: true,
  verbose: false,
};

// ============================================================================
// Phase Results Types
// ============================================================================

/**
 * Results from Phase 1 (Data Extraction)
 */
export interface Phase1Results {
  dataAnalyst: WorkerResult<StructuredAnalysisData>;
  productivityAnalyst: WorkerResult<ProductivityAnalysisData>;
}

/**
 * Results from Phase 2 (Insight Generation)
 */
export interface Phase2Results {
  patternDetective?: WorkerResultWithStatus<unknown>;
  antiPatternSpotter?: WorkerResultWithStatus<unknown>;
  knowledgeGap?: WorkerResultWithStatus<unknown>;
  contextEfficiency?: WorkerResultWithStatus<unknown>;
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

/**
 * Calculate data quality based on session count
 *
 * @param sessionCount - Number of sessions analyzed
 * @returns Quality indicator
 */
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
