/**
 * Unified Analyzer
 *
 * Integrates all analysis components to generate a complete UnifiedReport:
 * - Pattern-based dimension analysis (6 dimensions)
 * - Type detection (5 coding styles)
 * - Insight generation (KB + quotes + advice)
 * - Schema conversion (to UnifiedReport)
 *
 * This is the main entry point for the hyper-personalized analysis pipeline.
 */

import type { ParsedSession, TypeResult } from '../models/index.js';
import type {
  UnifiedReport,
  DimensionResult,
  DimensionName,
  Tier,
} from '../models/unified-report.js';
import type { VerboseEvaluation } from '../models/verbose-evaluation.js';
import { calculateAllDimensions, type FullAnalysisResult } from './dimensions/index.js';
import {
  aggregateMetrics,
  calculateTypeScores,
  scoresToDistribution,
  getPrimaryType,
} from './type-detector.js';
import {
  InsightGenerator,
  createInsightGenerator,
  type InsightGeneratorConfig,
  type GeneratedInsights,
} from './insight-generator.js';
import { createKnowledgeLinker, type KnowledgeLinker } from './knowledge-linker.js';
import {
  toUnifiedReport,
  dimensionsToDimensionResults,
  generateSummary,
  type ConversionInput,
} from '../models/schema-bridge.js';

// ============================================
// Types
// ============================================

export interface UnifiedAnalyzerConfig {
  /**
   * Custom KnowledgeLinker instance (for testing or custom KB)
   */
  knowledgeLinker?: KnowledgeLinker;

  /**
   * InsightGenerator configuration
   */
  insightConfig?: InsightGeneratorConfig;

  /**
   * User tier for premium content
   */
  tier?: Tier;

  /**
   * Skip insight generation (for faster analysis)
   */
  skipInsights?: boolean;
}

export interface AnalyzeOptions {
  /**
   * Verbose evaluation from VerboseAnalyzer (optional)
   */
  verbose?: VerboseEvaluation;

  /**
   * Override tier for this analysis
   */
  tier?: Tier;
}

export interface UnifiedAnalysisResult {
  /**
   * Complete unified report
   */
  report: UnifiedReport;

  /**
   * Raw dimension analysis (for debugging)
   */
  dimensions: FullAnalysisResult;

  /**
   * Type detection result
   */
  typeResult: TypeResult;

  /**
   * Generated insights by dimension
   */
  insights: Map<DimensionName, GeneratedInsights>;
}

// ============================================
// UnifiedAnalyzer Class
// ============================================

export class UnifiedAnalyzer {
  private insightGenerator: InsightGenerator;
  private tier: Tier;
  private skipInsights: boolean;

  constructor(config: UnifiedAnalyzerConfig = {}) {
    const knowledgeLinker = config.knowledgeLinker ?? createKnowledgeLinker();
    this.insightGenerator = createInsightGenerator(knowledgeLinker, config.insightConfig);
    this.tier = config.tier ?? 'free';
    this.skipInsights = config.skipInsights ?? false;
  }

  /**
   * Analyze sessions and generate a complete UnifiedReport
   */
  async analyze(
    sessions: ParsedSession[],
    options: AnalyzeOptions = {}
  ): Promise<UnifiedAnalysisResult> {
    if (sessions.length === 0) {
      throw new Error('At least one session is required for analysis');
    }

    const tier = options.tier ?? this.tier;

    // Step 1: Calculate pattern-based dimensions
    const dimensions = calculateAllDimensions(sessions);

    // Step 2: Detect coding style type
    const typeResult = this.detectType(sessions);

    // Step 3: Convert to dimension results (without insights)
    const dimensionResults = dimensionsToDimensionResults(dimensions);

    // Step 4: Generate insights (if not skipped)
    let insights: Map<DimensionName, GeneratedInsights>;
    let enrichedDimensions: DimensionResult[];

    if (this.skipInsights) {
      insights = new Map();
      enrichedDimensions = dimensionResults;
    } else {
      insights = await this.insightGenerator.generateForAllDimensions(
        dimensionResults,
        sessions
      );
      enrichedDimensions = this.injectInsights(dimensionResults, insights);
    }

    // Step 5: Build conversion input
    const conversionInput: ConversionInput = {
      verbose: options.verbose,
      typeResult,
      dimensions,
      tier,
    };

    // Step 6: Generate unified report
    const baseReport = toUnifiedReport(conversionInput);

    // Step 7: Replace dimensions with enriched ones (with insights)
    const report: UnifiedReport = {
      ...baseReport,
      dimensions: enrichedDimensions,
      summary: generateSummary(enrichedDimensions),
    };

    return {
      report,
      dimensions,
      typeResult,
      insights,
    };
  }

  /**
   * Quick analysis without LLM calls (pattern-based only)
   */
  analyzeSync(sessions: ParsedSession[]): {
    dimensions: FullAnalysisResult;
    typeResult: TypeResult;
    dimensionResults: DimensionResult[];
  } {
    if (sessions.length === 0) {
      throw new Error('At least one session is required for analysis');
    }

    const dimensions = calculateAllDimensions(sessions);
    const typeResult = this.detectType(sessions);
    const dimensionResults = dimensionsToDimensionResults(dimensions);

    return {
      dimensions,
      typeResult,
      dimensionResults,
    };
  }

  /**
   * Generate insights for existing dimension results
   */
  async generateInsights(
    dimensionResults: DimensionResult[],
    sessions: ParsedSession[]
  ): Promise<Map<DimensionName, GeneratedInsights>> {
    return this.insightGenerator.generateForAllDimensions(dimensionResults, sessions);
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Detect coding style type from sessions
   */
  private detectType(sessions: ParsedSession[]): TypeResult {
    const metrics = aggregateMetrics(sessions);
    const scores = calculateTypeScores(metrics);
    const distribution = scoresToDistribution(scores);
    const primaryType = getPrimaryType(distribution);

    return {
      analyzedAt: new Date().toISOString(),
      primaryType,
      distribution,
      metrics: {
        avgPromptLength: metrics.avgPromptLength,
        avgFirstPromptLength: metrics.avgFirstPromptLength,
        avgTurnsPerSession: metrics.avgTurnsPerSession,
        questionFrequency: metrics.questionFrequency,
        modificationRate: metrics.modificationRate,
        toolUsageHighlight: this.getToolUsageHighlight(metrics),
      },
      evidence: [],
      sessionCount: sessions.length,
    };
  }

  /**
   * Get tool usage highlight string
   */
  private getToolUsageHighlight(metrics: ReturnType<typeof aggregateMetrics>): string {
    const { toolUsage } = metrics;
    if (toolUsage.total === 0) return 'No tool usage detected';

    const tools = [
      { name: 'Read', count: toolUsage.read },
      { name: 'Grep', count: toolUsage.grep },
      { name: 'Glob', count: toolUsage.glob },
      { name: 'Task', count: toolUsage.task },
      { name: 'Plan', count: toolUsage.plan },
      { name: 'Bash', count: toolUsage.bash },
      { name: 'Write', count: toolUsage.write },
      { name: 'Edit', count: toolUsage.edit },
    ].sort((a, b) => b.count - a.count);

    const top2 = tools.slice(0, 2).filter((t) => t.count > 0);
    if (top2.length === 0) return 'Minimal tool usage';

    return top2
      .map((t) => `${t.name} (${Math.round((t.count / toolUsage.total) * 100)}%)`)
      .join(', ');
  }

  /**
   * Inject generated insights into dimension results
   */
  private injectInsights(
    dimensionResults: DimensionResult[],
    insights: Map<DimensionName, GeneratedInsights>
  ): DimensionResult[] {
    return dimensionResults.map((dim) => {
      const generated = insights.get(dim.name);
      if (!generated) {
        return dim;
      }

      return {
        ...dim,
        insights: generated.insights,
        interpretation: generated.interpretation || dim.interpretation,
      };
    });
  }
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a new UnifiedAnalyzer instance
 */
export function createUnifiedAnalyzer(config?: UnifiedAnalyzerConfig): UnifiedAnalyzer {
  return new UnifiedAnalyzer(config);
}

/**
 * Quick analysis helper (single function call)
 */
export async function analyzeUnified(
  sessions: ParsedSession[],
  options?: AnalyzeOptions & UnifiedAnalyzerConfig
): Promise<UnifiedReport> {
  const analyzer = createUnifiedAnalyzer(options);
  const result = await analyzer.analyze(sessions, options);
  return result.report;
}
