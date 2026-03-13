/**
 * Quick Fix Orchestrator
 *
 * Lightweight orchestrator for the Quick Fix analysis path.
 * Only 2 stages: Phase 1 DataExtractor → BottleneckDetector
 *
 * Target: ~30 second time-to-value with 1-2 LLM calls total.
 *
 * Key differences from AnalysisOrchestrator:
 * - No Phase 1.5/2/2.5/2.8/3/4 stages
 * - Single project focus (not all projects)
 * - Returns QuickFixResult (not VerboseEvaluation)
 * - Returns the full OSS quick-fix payload without report gating
 *
 * @module analyzer/orchestrator/quick-fix-orchestrator
 */

import crypto from 'crypto';
import type { ParsedSession, SessionMetrics } from '../../domain/models/analysis';
import { DataExtractorWorker } from '../workers/data-extractor-worker';
import {
  BottleneckDetectorWorker,
  type BottleneckDetectorOutput,
} from '../workers/bottleneck-detector-worker';
import { ContentGateway, type Tier } from '../content-gateway';
import type { OrchestratorConfig, ProgressCallback, Phase1Output, WorkerContext } from './types';

import type { QuickFixResult } from '../../models/quick-fix-data';

// ============================================================================
// Types
// ============================================================================

export interface QuickFixOptions {
  /** Project name being analyzed */
  projectName: string;

  /** Encoded project path */
  projectPath: string;

  /** Progress callback for UI updates */
  onProgress?: ProgressCallback;
}

// ============================================================================
// Quick Fix Orchestrator
// ============================================================================

export class QuickFixOrchestrator {
  private readonly config: OrchestratorConfig;
  private readonly contentGateway: ContentGateway;

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.contentGateway = new ContentGateway();
  }

  /**
   * Run Quick Fix analysis on a single project's sessions.
   *
   * Pipeline: DataExtractor (0 LLM) → BottleneckDetector (1 LLM)
   *
   * @param sessions - Parsed sessions from the selected project (3-5 recent)
   * @param metrics - Session metrics
   * @param tier - Legacy access label kept for API compatibility
   * @param options - Project info and progress callback
   * @returns Quick Fix result
   */
  async analyze(
    sessions: ParsedSession[],
    metrics: SessionMetrics,
    tier: Tier,
    options: QuickFixOptions,
  ): Promise<QuickFixResult> {
    const { projectName, projectPath, onProgress } = options;
    const startTime = Date.now();

    // ── Phase 1: DataExtractor (deterministic, no LLM) ──────────────────
    onProgress?.('phase1', 10, 'Extracting session data...');

    const dataExtractor = new DataExtractorWorker(this.config);
    const context: WorkerContext = {
      sessions,
      metrics,
      tier,
    };

    const phase1Result = await dataExtractor.execute(context);
    const phase1Output: Phase1Output = phase1Result.data;

    onProgress?.('phase1', 30, `Extracted ${phase1Output.developerUtterances.length} utterances`);

    // ── BottleneckDetector (1 LLM call) ─────────────────────────────────
    onProgress?.('bottleneck', 40, 'Detecting bottlenecks...');

    const bottleneckDetector = new BottleneckDetectorWorker(this.config);
    const bottleneckContext: WorkerContext = {
      ...context,
      phase1Output,
    } as WorkerContext & { phase1Output: Phase1Output };

    const bottleneckResult = await bottleneckDetector.execute(bottleneckContext);
    const output: BottleneckDetectorOutput = bottleneckResult.data;

    onProgress?.('bottleneck', 80, `Found ${output.bottlenecks.length} bottlenecks`);

    // ── Assemble result ─────────────────────────────────────────────────
    const result: QuickFixResult = {
      resultId: crypto.randomUUID(),
      projectName,
      projectPath,
      sessionsAnalyzed: sessions.length,
      analyzedAt: new Date().toISOString(),
      overallHealthScore: output.overallHealthScore,
      summary: output.summary,
      bottlenecks: output.bottlenecks,
    };

    // ── Apply tier gating ───────────────────────────────────────────────
    const gatedResult = this.contentGateway.filterQuickFixResult(result, tier);

    const elapsed = Date.now() - startTime;
    onProgress?.('done', 100, `Analysis complete in ${(elapsed / 1000).toFixed(1)}s`);

    return gatedResult;
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createQuickFixOrchestrator(
  config: OrchestratorConfig,
): QuickFixOrchestrator {
  return new QuickFixOrchestrator(config);
}
