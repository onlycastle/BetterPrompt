/**
 * Productivity Analyst Worker (Module C)
 *
 * Phase 1 worker that wraps ProductivityAnalystStage.
 * Extracts productivity metrics from behavioral data.
 * Requires Module A output to run.
 *
 * @module analyzer/workers/productivity-analyst-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import { ProductivityAnalystStage, type ProductivityAnalystConfig } from '../stages/productivity-analyst';
import { createDefaultProductivityAnalysisData, type ProductivityAnalysisData } from '../../models/productivity-data';
import type { Tier } from '../content-gateway';

/**
 * Worker configuration extending ProductivityAnalystConfig
 */
export interface ProductivityAnalystWorkerConfig extends ProductivityAnalystConfig {
  verbose?: boolean;
}

/**
 * Productivity Analyst Worker - Wraps ProductivityAnalystStage
 *
 * Phase 1 worker that extracts productivity metrics.
 * Runs for premium and enterprise tiers only.
 */
export class ProductivityAnalystWorker extends BaseWorker<ProductivityAnalysisData> {
  readonly name = 'ProductivityAnalyst';
  readonly phase = 1 as const;
  readonly minTier: Tier = 'free'; // Generate data for all tiers, but display is tier-gated

  private stage: ProductivityAnalystStage;
  private verbose: boolean;

  constructor(config: ProductivityAnalystWorkerConfig = {}) {
    super();
    this.stage = new ProductivityAnalystStage({
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
      maxRetries: config.maxRetries,
    });
    this.verbose = config.verbose ?? false;
  }

  /**
   * Check if worker can run
   * ProductivityAnalyst needs sessions and Module A output
   */
  canRun(context: WorkerContext): boolean {
    return context.sessions.length > 0 && context.moduleAOutput !== undefined;
  }

  /**
   * Execute the productivity analyst stage
   */
  async execute(context: WorkerContext): Promise<WorkerResult<ProductivityAnalysisData>> {
    // If no Module A output, return default data
    if (!context.moduleAOutput) {
      this.logMessage('No Module A output available, returning default productivity data');
      return this.createSuccessResult(createDefaultProductivityAnalysisData(), null);
    }

    this.logMessage('Analyzing productivity metrics...');

    try {
      const result = await this.stage.analyze(context.sessions, context.moduleAOutput);

      if (result.usage) {
        this.logMessage(`Productivity score: ${result.data.overallProductivityScore}`);
        this.logMessage(`Iteration cycles detected: ${result.data.iterationSummary.totalCycles}`);
      } else {
        this.logMessage('Using default data (insufficient data or error)');
      }

      return this.createSuccessResult(result.data, result.usage);
    } catch (error) {
      this.logMessage(`Analysis failed: ${error}`);
      // Return default data on error instead of failing
      return this.createSuccessResult(createDefaultProductivityAnalysisData(), null);
    }
  }

  /**
   * Log message if verbose mode enabled
   * Named logMessage to avoid conflict with base class protected log
   */
  private logMessage(message: string): void {
    if (this.verbose) {
      console.log(`[ProductivityAnalystWorker] ${message}`);
    }
  }
}

/**
 * Factory function for creating ProductivityAnalystWorker
 */
export function createProductivityAnalystWorker(
  config?: ProductivityAnalystWorkerConfig
): ProductivityAnalystWorker {
  return new ProductivityAnalystWorker(config);
}
