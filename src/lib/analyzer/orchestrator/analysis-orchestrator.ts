/**
 * Analysis Orchestrator - Main orchestrator for the analysis pipeline
 *
 * Coordinates 3 phases of analysis:
 * - Phase 1: Data Extraction (Module A, C in parallel)
 * - Phase 2: Insight Generation (4 Wow Agents in parallel)
 * - Phase 3: Content Generation (ContentWriter)
 *
 * @module analyzer/orchestrator/analysis-orchestrator
 */

import type { ParsedSession, SessionMetrics } from '../../domain/models/analysis';
import type { StructuredAnalysisData } from '../../models/analysis-data';
import { createDefaultStructuredAnalysisData } from '../../models/analysis-data';
import type { ProductivityAnalysisData } from '../../models/productivity-data';
import type { VerboseEvaluation } from '../../models/verbose-evaluation';
import type { AgentOutputs } from '../../models/agent-outputs';
import { createEmptyAgentOutputs } from '../../models/agent-outputs';
import { createDefaultProductivityAnalysisData } from '../../models/productivity-data';
import { ContentWriterStage } from '../stages/content-writer';
import { ContentGateway, type Tier } from '../content-gateway';
import { BaseWorker, runWorkerSafely } from '../workers/base-worker';
import type {
  WorkerResult,
  WorkerContext,
  OrchestratorConfig,
  Phase1Results,
  AggregatedTokenUsage,
} from './types';
import { DEFAULT_ORCHESTRATOR_CONFIG, aggregateWorkerTokenUsage } from './types';
import {
  type StageTokenUsage,
  type PipelineTokenUsage,
  formatActualUsage,
} from '../cost-estimator';

// ============================================================================
// Analysis Orchestrator
// ============================================================================

/**
 * AnalysisOrchestrator - Coordinates the entire analysis pipeline
 *
 * Replaces the monolithic verbose-analyzer.ts with a clean separation:
 * - Orchestrator manages flow and dependencies
 * - Workers perform the actual analysis
 *
 * @example
 * ```typescript
 * const orchestrator = new AnalysisOrchestrator({
 *   geminiApiKey: process.env.GOOGLE_GEMINI_API_KEY!,
 *   verbose: true,
 * });
 *
 * // Register workers
 * orchestrator.registerPhase1Worker(new DataAnalystWorker(config));
 * orchestrator.registerPhase1Worker(new ProductivityAnalystWorker(config));
 *
 * orchestrator.registerPhase2Worker(new PatternDetectiveWorker(config));
 * // ... more workers
 *
 * // Run analysis
 * const result = await orchestrator.analyze(sessions, metrics, 'premium');
 * ```
 */
export class AnalysisOrchestrator {
  private config: Required<OrchestratorConfig>;
  private phase1Workers: BaseWorker<unknown>[] = [];
  private phase2Workers: BaseWorker<unknown>[] = [];
  private contentWriter: ContentWriterStage;
  private contentGateway: ContentGateway;

  constructor(config: OrchestratorConfig) {
    this.config = {
      ...DEFAULT_ORCHESTRATOR_CONFIG,
      ...config,
      geminiApiKey: config.geminiApiKey,
    };

    // Initialize content writer (Phase 3)
    this.contentWriter = new ContentWriterStage({
      apiKey: this.config.geminiApiKey,
      model: this.config.model,
      temperature: this.config.temperature,
      maxOutputTokens: this.config.maxOutputTokens,
      maxRetries: this.config.maxRetries,
    });

    // Initialize content gateway (tier filtering)
    this.contentGateway = new ContentGateway();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Worker Registration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a Phase 1 worker (Data Extraction)
   */
  registerPhase1Worker(worker: BaseWorker<unknown>): this {
    if (worker.phase !== 1) {
      throw new Error(`Worker ${worker.name} has phase ${worker.phase}, expected 1`);
    }
    this.phase1Workers.push(worker);
    return this;
  }

  /**
   * Register a Phase 2 worker (Insight Generation)
   */
  registerPhase2Worker(worker: BaseWorker<unknown>): this {
    if (worker.phase !== 2) {
      throw new Error(`Worker ${worker.name} has phase ${worker.phase}, expected 2`);
    }
    this.phase2Workers.push(worker);
    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main Analysis Method
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Run the complete analysis pipeline
   *
   * @param sessions - Parsed session data
   * @param metrics - Computed session metrics
   * @param tier - User tier level
   * @returns Tier-filtered VerboseEvaluation
   */
  async analyze(
    sessions: ParsedSession[],
    metrics: SessionMetrics,
    tier: Tier
  ): Promise<VerboseEvaluation> {
    const startTime = Date.now();
    const stageUsages: StageTokenUsage[] = [];

    this.log('Starting analysis pipeline...');
    this.log(`Sessions: ${sessions.length}, Tier: ${tier}`);

    // Create base context for Phase 1
    const baseContext: WorkerContext = {
      sessions,
      metrics,
      tier,
    };

    // ─────────────────────────────────────────────────────────────────────
    // Phase 1: Data Extraction (parallel)
    // ─────────────────────────────────────────────────────────────────────
    this.log('Phase 1: Data Extraction...');
    const phase1Results = await this.runPhase1(baseContext);

    // Track Phase 1 token usage
    if (phase1Results.dataAnalyst.usage) {
      stageUsages.push({
        stage: 'Data Analyst (Module A)',
        ...phase1Results.dataAnalyst.usage,
      });
    }
    if (phase1Results.productivityAnalyst.usage) {
      stageUsages.push({
        stage: 'Productivity Analyst (Module C)',
        ...phase1Results.productivityAnalyst.usage,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Phase 2: Insight Generation (parallel)
    // Workers check their own minTier via canRun() - some workers may be free tier
    // ─────────────────────────────────────────────────────────────────────
    let agentOutputs: AgentOutputs = createEmptyAgentOutputs();

    if (this.phase2Workers.length > 0) {
      this.log('Phase 2: Insight Generation...');
      const phase2Context: WorkerContext = {
        ...baseContext,
        moduleAOutput: phase1Results.dataAnalyst.data,
        moduleCOutput: phase1Results.productivityAnalyst.data,
      };

      const phase2Results = await this.runPhase2(phase2Context);
      agentOutputs = this.mergeAgentOutputs(phase2Results);

      // Track Phase 2 token usage
      for (const [workerName, result] of Object.entries(phase2Results)) {
        if (result?.usage) {
          stageUsages.push({
            stage: `${workerName} (Agent)`,
            ...result.usage,
          });
        }
      }
    } else {
      this.log('Phase 2: Skipped (no workers registered)');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Phase 3: Content Generation (with Phase 2 agent outputs)
    // ─────────────────────────────────────────────────────────────────────
    this.log('Phase 3: Content Generation...');
    const contentResult = await this.contentWriter.transform(
      phase1Results.dataAnalyst.data,
      sessions,
      phase1Results.productivityAnalyst.data,
      agentOutputs
    );

    stageUsages.push({
      stage: 'Content Writer (Stage 2)',
      ...contentResult.usage,
    });

    // ─────────────────────────────────────────────────────────────────────
    // Build Final Evaluation
    // ─────────────────────────────────────────────────────────────────────
    const analyzedSessions = this.extractAnalyzedSessions(sessions);

    const evaluation: VerboseEvaluation = {
      sessionId: sessions[sessions.length - 1]?.sessionId ?? 'unknown',
      analyzedAt: new Date().toISOString(),
      sessionsAnalyzed: sessions.length,
      avgPromptLength: Math.round(metrics.avgPromptLength),
      avgTurnsPerSession: Math.round(metrics.avgTurnsPerSession * 10) / 10,
      analyzedSessions,
      ...contentResult.data,
      productivityAnalysis: phase1Results.productivityAnalyst.data,
      agentOutputs: agentOutputs,
    };

    // Log pipeline summary
    const totalTime = Date.now() - startTime;
    this.logPipelineSummary(stageUsages, totalTime);

    // Apply tier-based filtering
    return this.contentGateway.filter(evaluation, tier);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phase Execution Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Run Phase 1 workers (Data Extraction)
   *
   * Workers run in parallel. Results are keyed by worker name.
   */
  private async runPhase1(context: WorkerContext): Promise<Phase1Results> {
    // Find workers by name
    const dataAnalystWorker = this.phase1Workers.find((w) => w.name === 'DataAnalyst');
    const productivityWorker = this.phase1Workers.find((w) => w.name === 'ProductivityAnalyst');

    // Run workers in parallel
    const [dataResult, productivityResult] = await Promise.all([
      dataAnalystWorker
        ? runWorkerSafely(dataAnalystWorker, context, this.createDefaultAnalysisData())
        : this.createFallbackDataAnalystResult(),
      productivityWorker
        ? runWorkerSafely(productivityWorker, context, createDefaultProductivityAnalysisData())
        : this.createFallbackProductivityResult(),
    ]);

    return {
      dataAnalyst: dataResult as WorkerResult<StructuredAnalysisData>,
      productivityAnalyst: productivityResult as WorkerResult<ProductivityAnalysisData>,
    };
  }

  /**
   * Run Phase 2 workers (Insight Generation)
   *
   * Workers run in parallel. Results are keyed by worker name.
   */
  private async runPhase2(
    context: WorkerContext
  ): Promise<Record<string, WorkerResult<unknown> | undefined>> {
    const results: Record<string, WorkerResult<unknown> | undefined> = {};

    // Run all Phase 2 workers in parallel
    const workerPromises = this.phase2Workers.map(async (worker) => {
      if (!worker.canRun(context)) {
        this.log(`Worker ${worker.name} skipped (cannot run)`);
        return;
      }

      try {
        const result = await worker.execute(context);
        results[worker.name] = result;
        this.log(`Worker ${worker.name} completed`);
      } catch (error) {
        this.log(`Worker ${worker.name} failed: ${error}`);
        results[worker.name] = {
          data: null,
          usage: null,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    });

    await Promise.allSettled(workerPromises);

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Merge Phase 2 worker results into AgentOutputs
   */
  private mergeAgentOutputs(results: Record<string, WorkerResult<unknown> | undefined>): AgentOutputs {
    return {
      // Original 4 agents
      patternDetective: results['PatternDetective']?.data as AgentOutputs['patternDetective'],
      antiPatternSpotter: results['AntiPatternSpotter']?.data as AgentOutputs['antiPatternSpotter'],
      knowledgeGap: results['KnowledgeGap']?.data as AgentOutputs['knowledgeGap'],
      contextEfficiency: results['ContextEfficiency']?.data as AgentOutputs['contextEfficiency'],
      // NEW: Metacognition + Temporal Analysis agents
      metacognition: results['MetacognitionWorker']?.data as AgentOutputs['metacognition'],
      temporalAnalysis: results['TemporalAnalyzer']?.data as AgentOutputs['temporalAnalysis'],
    };
  }

  /**
   * Extract session info for display
   */
  private extractAnalyzedSessions(sessions: ParsedSession[]): VerboseEvaluation['analyzedSessions'] {
    return sessions.map((session) => ({
      sessionId: session.sessionId,
      fileName: `${session.sessionId.slice(0, 8)}.jsonl`,
      projectName: session.projectPath.split('/').pop() ?? 'unknown',
      startTime: session.startTime.toISOString(),
      messageCount: session.messages.length,
      durationMinutes: Math.round(session.durationSeconds / 60),
    }));
  }

  /**
   * Create default/fallback analysis data
   * Delegates to the factory function in analysis-data.ts for consistency
   */
  private createDefaultAnalysisData(): StructuredAnalysisData {
    return createDefaultStructuredAnalysisData();
  }

  /**
   * Create fallback result when DataAnalyst worker is not registered
   */
  private createFallbackDataAnalystResult(): WorkerResult<StructuredAnalysisData> {
    return {
      data: this.createDefaultAnalysisData(),
      usage: null,
      error: new Error('DataAnalyst worker not registered'),
    };
  }

  /**
   * Create fallback result when ProductivityAnalyst worker is not registered
   */
  private createFallbackProductivityResult(): WorkerResult<ProductivityAnalysisData> {
    return {
      data: createDefaultProductivityAnalysisData(),
      usage: null,
      error: new Error('ProductivityAnalyst worker not registered'),
    };
  }

  /**
   * Log a message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[Orchestrator] ${message}`);
    }
  }

  /**
   * Log pipeline summary
   */
  private logPipelineSummary(stageUsages: StageTokenUsage[], totalTimeMs: number): void {
    if (!this.config.verbose) return;

    const totalTokens = stageUsages.reduce((sum, s) => sum + s.totalTokens, 0);
    const totalPrompt = stageUsages.reduce((sum, s) => sum + s.promptTokens, 0);
    const totalCompletion = stageUsages.reduce((sum, s) => sum + s.completionTokens, 0);

    console.log('\n=== Pipeline Summary ===');
    console.log(`Total time: ${(totalTimeMs / 1000).toFixed(2)}s`);
    console.log(`Total tokens: ${totalTokens.toLocaleString()}`);
    console.log(`  Prompt: ${totalPrompt.toLocaleString()}`);
    console.log(`  Completion: ${totalCompletion.toLocaleString()}`);
    console.log('\nBy stage:');
    for (const stage of stageUsages) {
      console.log(`  ${stage.stage}: ${stage.totalTokens.toLocaleString()} tokens`);
    }
    console.log('========================\n');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new AnalysisOrchestrator
 */
export function createAnalysisOrchestrator(config: OrchestratorConfig): AnalysisOrchestrator {
  return new AnalysisOrchestrator(config);
}
