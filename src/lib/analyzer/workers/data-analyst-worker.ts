/**
 * Data Analyst Worker (Module A)
 *
 * Phase 1 worker that wraps DataAnalystStage.
 * Extracts structured behavioral data from sessions.
 *
 * @module analyzer/workers/data-analyst-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import { DataAnalystStage, type DataAnalystConfig } from '../stages/data-analyst';
import {
  createDefaultStructuredAnalysisData,
  type StructuredAnalysisData,
} from '../../models/analysis-data';
import type { Tier } from '../content-gateway';

/**
 * Worker configuration extending DataAnalystConfig
 */
export interface DataAnalystWorkerConfig extends DataAnalystConfig {
  verbose?: boolean;
}

/**
 * Data Analyst Worker - Wraps DataAnalystStage
 *
 * Phase 1 worker that extracts behavioral patterns from sessions.
 * Always runs (minimum tier: free).
 */
export class DataAnalystWorker extends BaseWorker<StructuredAnalysisData> {
  readonly name = 'DataAnalyst';
  readonly phase = 1 as const;
  readonly minTier: Tier = 'free';

  private stage: DataAnalystStage;
  private verbose: boolean;

  constructor(config: DataAnalystWorkerConfig = {}) {
    super();
    this.stage = new DataAnalystStage({
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
   * DataAnalyst always runs if there are sessions and metrics
   */
  canRun(context: WorkerContext): boolean {
    return context.sessions.length > 0 && context.metrics !== undefined;
  }

  /**
   * Execute the data analyst stage
   */
  async execute(context: WorkerContext): Promise<WorkerResult<StructuredAnalysisData>> {
    if (!context.metrics) {
      return this.createFailedResult(
        new Error('Metrics required for data analysis'),
        createDefaultStructuredAnalysisData()
      );
    }

    this.logMessage('Analyzing sessions for behavioral patterns...');

    try {
      const result = await this.stage.analyze(context.sessions, context.metrics);

      this.logMessage(`Extracted ${result.data.extractedQuotes.length} quotes`);
      this.logMessage(`Detected ${result.data.detectedPatterns.length} patterns`);

      return this.createSuccessResult(result.data, result.usage);
    } catch (error) {
      this.logMessage(`Analysis failed: ${error}`);
      return this.createFailedResult(
        error instanceof Error ? error : new Error(String(error)),
        createDefaultStructuredAnalysisData()
      );
    }
  }

  /**
   * Log message if verbose mode enabled
   * Named logMessage to avoid conflict with base class protected log
   */
  private logMessage(message: string): void {
    if (this.verbose) {
      console.log(`[DataAnalystWorker] ${message}`);
    }
  }
}

/**
 * Factory function for creating DataAnalystWorker
 */
export function createDataAnalystWorker(config?: DataAnalystWorkerConfig): DataAnalystWorker {
  return new DataAnalystWorker(config);
}
