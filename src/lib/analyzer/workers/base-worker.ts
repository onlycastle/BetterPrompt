/**
 * Base Worker - Abstract base class for all analysis workers
 *
 * Workers are independent units of analysis that:
 * - Have a specific phase (1, 2, or 3)
 * - Can run independently and fail gracefully
 * - Return standardized WorkerResult
 *
 * Note: Tier-based filtering is handled at the ContentGateway/API level,
 * not at the worker level. All workers run for all users.
 *
 * @module analyzer/workers/base-worker
 */

import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client';
import type {
  WorkerResult,
  WorkerContext,
  Phase,
  Phase2WorkerContext,
  OrchestratorConfig,
} from '../orchestrator/types';
import {
  getInsightsForWorker,
  type WorkerInsightContext,
} from './prompts/knowledge-mapping';

// Re-export types for worker implementations
export type { WorkerResult, WorkerContext, Phase, Phase2WorkerContext } from '../orchestrator/types';

// ============================================================================
// Base Worker Abstract Class
// ============================================================================

/**
 * Abstract base class for all analysis workers
 *
 * @template TOutput - The type of data this worker produces
 *
 * @example
 * ```typescript
 * class DataAnalystWorker extends BaseWorker<StructuredAnalysisData> {
 *   readonly name = 'DataAnalyst';
 *   readonly phase = 1;
 *
 *   canRun(context: WorkerContext): boolean {
 *     return context.sessions.length > 0;
 *   }
 *
 *   async execute(context: WorkerContext): Promise<WorkerResult<StructuredAnalysisData>> {
 *     // Implementation...
 *   }
 * }
 * ```
 */
export abstract class BaseWorker<TOutput> {
  /** Gemini client for LLM calls (optional - Phase 1 workers may use their own stages) */
  protected client?: GeminiClient;

  /** Worker configuration (optional - Phase 1 workers may use their own configs) */
  protected baseConfig?: Required<Omit<OrchestratorConfig, 'geminiApiKey' | 'knowledgeRepo' | 'professionalInsightRepo'>>;

  /**
   * Create a new worker instance
   *
   * @param config - Optional orchestrator configuration. Phase 1 workers that wrap
   *                 existing stages may not need this as they create their own clients.
   */
  constructor(config?: OrchestratorConfig) {
    if (config) {
      this.client = new GeminiClient({
        apiKey: config.geminiApiKey,
        model: config.model,
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        maxRetries: config.maxRetries,
      } as GeminiClientConfig);

      this.baseConfig = {
        model: config.model ?? 'gemini-3-flash-preview',
        temperature: config.temperature ?? 1.0,
        maxOutputTokens: config.maxOutputTokens ?? 65536,
        maxRetries: config.maxRetries ?? 2,
        continueOnWorkerFailure: config.continueOnWorkerFailure ?? true,
        verbose: config.verbose ?? false,
        debug: config.debug ?? false,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Abstract Properties (must be implemented by subclasses)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Unique name for this worker (used in logs and results)
   *
   * @example 'DataAnalyst', 'PatternDetective'
   */
  abstract readonly name: string;

  /**
   * Phase this worker runs in
   *
   * - Phase 1: Data Extraction (Module A, B, C)
   * - Phase 2: Insight Generation (4 Wow Agents)
   * - Phase 3: Content Generation (ContentWriter)
   */
  abstract readonly phase: Phase;

  // ─────────────────────────────────────────────────────────────────────────
  // Abstract Methods (must be implemented by subclasses)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if this worker can run with the given context
   *
   * Override this to add custom preconditions.
   * Default checks: tier is sufficient, sessions exist.
   *
   * @param context - Worker context
   * @returns true if worker can run
   */
  abstract canRun(context: WorkerContext): boolean;

  /**
   * Execute the worker's analysis
   *
   * @param context - Worker context with sessions and any Phase 1 outputs
   * @returns WorkerResult with data and token usage
   */
  abstract execute(context: WorkerContext): Promise<WorkerResult<TOutput>>;

  // ─────────────────────────────────────────────────────────────────────────
  // Protected Helper Methods
  // ─────────────────────────────────────────────────────────────────────────

  protected checkBasicPreconditions(context: WorkerContext): boolean {
    // Check sessions exist
    if (context.sessions.length === 0) {
      return false;
    }

    return true;
  }

  protected log(message: string): void {
    if (this.baseConfig?.verbose) {
      console.log(`[${this.name}] ${message}`);
    }
  }

  protected createSuccessResult(
    data: TOutput,
    usage: WorkerResult<TOutput>['usage']
  ): WorkerResult<TOutput> {
    return {
      data,
      usage,
    };
  }

  /**
   * Check standard Phase 2 worker preconditions.
   *
   * @param context - Worker context (will be type-checked as Phase2WorkerContext)
   * @returns true if Phase 1 output is available with utterances
   */
  protected checkPhase2Preconditions(context: WorkerContext): boolean {
    const phase2Context = context as Phase2WorkerContext;

    if (!phase2Context.phase1Output) {
      this.log('Cannot run: Phase 1 output not available');
      return false;
    }

    if (phase2Context.phase1Output.developerUtterances.length === 0) {
      this.log('Cannot run: No developer utterances to analyze');
      return false;
    }

    return true;
  }

  /**
   * Get Phase 2 context with type assertion.
   *
   * @param context - Worker context
   * @returns Typed Phase2WorkerContext
   */
  protected getPhase2Context(context: WorkerContext): Phase2WorkerContext {
    return context as Phase2WorkerContext;
  }

  /**
   * Combine insights from multiple worker domains.
   *
   * Merges insights from multiple domains, deduplicates by ID, and combines lookup maps.
   *
   * @param workerNames - Array of worker names to get insights for
   * @returns Combined WorkerInsightContext with deduplicated insights
   */
  protected getCombinedInsights(workerNames: string[]): WorkerInsightContext {
    const allContexts = workerNames.map((name) => getInsightsForWorker(name));

    const allInsights = allContexts.flatMap((ctx) => ctx.insights);
    const uniqueInsights = Array.from(
      new Map(allInsights.map((i) => [i.id, i])).values()
    );

    const combinedUrlLookup = new Map<string, string>();
    const combinedTitleLookup = new Map<string, string>();

    for (const ctx of allContexts) {
      for (const [key, value] of ctx.urlLookup) {
        combinedUrlLookup.set(key, value);
      }
      for (const [key, value] of ctx.titleLookup) {
        combinedTitleLookup.set(key, value);
      }
    }

    return {
      insights: uniqueInsights,
      urlLookup: combinedUrlLookup,
      titleLookup: combinedTitleLookup,
    };
  }
}

// ============================================================================
// Worker Factory Types
// ============================================================================

/**
 * Factory function type for creating workers
 */
export type WorkerFactory<TOutput> = (config: OrchestratorConfig) => BaseWorker<TOutput>;

/**
 * Registry entry for a worker
 */
export interface WorkerRegistryEntry<TOutput = unknown> {
  /** Worker name */
  name: string;

  /** Phase this worker runs in */
  phase: Phase;

  /** Factory to create the worker */
  factory: WorkerFactory<TOutput>;
}

// ============================================================================
// Utility Functions - NO FALLBACK POLICY
// ============================================================================
//
// Removed: runWorkerSafely, runWorkersInParallel
//
// These functions were designed for fallback behavior, returning default data
// when workers fail. This hides errors and makes debugging difficult.
//
// Workers should throw errors that propagate to the orchestrator.
// The orchestrator uses Promise.all() to fail fast on any worker error.
