/**
 * Base Worker - Abstract base class for all analysis workers
 *
 * Workers are independent units of analysis that:
 * - Have a specific phase (1, 2, or 3)
 * - Have a minimum tier requirement
 * - Can run independently and fail gracefully
 * - Return standardized WorkerResult
 *
 * @module analyzer/workers/base-worker
 */

import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client';
import type { Tier } from '../content-gateway';
import type {
  WorkerResult,
  WorkerContext,
  Phase,
  OrchestratorConfig,
} from '../orchestrator/types';

// Re-export types for worker implementations
export type { WorkerResult, WorkerContext, Phase } from '../orchestrator/types';

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
 *   readonly minTier = 'free';
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
  protected baseConfig?: Required<Omit<OrchestratorConfig, 'geminiApiKey'>>;

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

  /**
   * Minimum tier required to run this worker
   *
   * - 'free': Runs for all users
   * - 'premium': Runs for premium and enterprise
   * - 'enterprise': Runs only for enterprise
   */
  abstract readonly minTier: Tier;

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

  /**
   * Check if user tier is sufficient for this worker
   *
   * @param tier - User's tier
   * @returns true if tier is sufficient
   */
  protected isTierSufficient(tier: Tier): boolean {
    const tierOrder: Tier[] = ['free', 'premium', 'enterprise'];
    return tierOrder.indexOf(tier) >= tierOrder.indexOf(this.minTier);
  }

  /**
   * Check basic preconditions for running
   *
   * @param context - Worker context
   * @returns true if basic preconditions are met
   */
  protected checkBasicPreconditions(context: WorkerContext): boolean {
    // Check tier
    if (!this.isTierSufficient(context.tier)) {
      return false;
    }

    // Check sessions exist
    if (context.sessions.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Log a message if verbose mode is enabled
   *
   * @param message - Message to log
   */
  protected log(message: string): void {
    if (this.baseConfig?.verbose) {
      console.log(`[${this.name}] ${message}`);
    }
  }

  /**
   * Create a failed result
   *
   * @param error - Error that occurred
   * @param fallbackData - Fallback data to return
   * @returns WorkerResult with error
   */
  protected createFailedResult(error: Error, fallbackData: TOutput): WorkerResult<TOutput> {
    return {
      data: fallbackData,
      usage: null,
      error,
    };
  }

  /**
   * Create a successful result
   *
   * @param data - Worker output data
   * @param usage - Token usage
   * @returns WorkerResult
   */
  protected createSuccessResult(
    data: TOutput,
    usage: WorkerResult<TOutput>['usage']
  ): WorkerResult<TOutput> {
    return {
      data,
      usage,
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

  /** Minimum tier */
  minTier: Tier;

  /** Factory to create the worker */
  factory: WorkerFactory<TOutput>;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Run a worker with error handling
 *
 * @param worker - Worker to run
 * @param context - Worker context
 * @param fallbackData - Fallback data if worker fails
 * @returns WorkerResult
 */
export async function runWorkerSafely<TOutput>(
  worker: BaseWorker<TOutput>,
  context: WorkerContext,
  fallbackData: TOutput
): Promise<WorkerResult<TOutput>> {
  try {
    // Check if worker can run
    if (!worker.canRun(context)) {
      return {
        data: fallbackData,
        usage: null,
        error: new Error(`Worker ${worker.name} cannot run with current context`),
      };
    }

    // Execute the worker
    return await worker.execute(context);
  } catch (error) {
    console.error(`Worker ${worker.name} failed:`, error);
    return {
      data: fallbackData,
      usage: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Run multiple workers in parallel
 *
 * @param workers - Workers to run
 * @param context - Shared context
 * @param fallbackDataFactory - Function to create fallback data for each worker
 * @returns Map of worker name to result
 */
export async function runWorkersInParallel<TOutput>(
  workers: BaseWorker<TOutput>[],
  context: WorkerContext,
  fallbackDataFactory: (workerName: string) => TOutput
): Promise<Map<string, WorkerResult<TOutput>>> {
  const results = new Map<string, WorkerResult<TOutput>>();

  const promises = workers.map(async (worker) => {
    const fallbackData = fallbackDataFactory(worker.name);
    const result = await runWorkerSafely(worker, context, fallbackData);
    results.set(worker.name, result);
  });

  await Promise.allSettled(promises);

  return results;
}
