/**
 * Productivity Analyst Stage Implementation (Module C)
 *
 * Stage 1C of the three-stage pipeline.
 * Uses Gemini 3 Flash for productivity/efficiency extraction from behavioral data.
 *
 * Input: Sessions + Module A output (StructuredAnalysisData)
 * Output: ProductivityAnalysisData
 *
 * @module analyzer/stages/productivity-analyst
 */

import { GeminiClient, type GeminiClientConfig, type TokenUsage } from '../clients/gemini-client';
import type { ParsedSession } from '../../domain/models/analysis';
import type { StructuredAnalysisData } from '../../models/analysis-data';
import {
  ProductivityAnalysisDataSchema,
  type ProductivityAnalysisData,
  createDefaultProductivityAnalysisData,
} from '../../models/productivity-data';
import {
  PRODUCTIVITY_ANALYST_SYSTEM_PROMPT,
  buildProductivityAnalystUserPrompt,
} from './productivity-analyst-prompts';
import {
  formatSessionsForAnalysis,
  PRODUCTIVITY_ANALYST_FORMAT,
} from '../shared/session-formatter';

/**
 * Configuration for the Productivity Analyst stage
 */
export interface ProductivityAnalystConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  maxRetries?: number;
}

/**
 * Result of productivity analyst stage including token usage
 */
export interface ProductivityAnalystResult {
  data: ProductivityAnalysisData;
  usage: TokenUsage | null; // null if fallback to default data
}

/**
 * Default configuration values
 *
 * maxOutputTokens set to maximum (65536) to prevent truncation.
 */
const DEFAULT_CONFIG: Required<Omit<ProductivityAnalystConfig, 'apiKey'>> = {
  model: 'gemini-3-flash-preview',
  temperature: 1.0, // Gemini 3 strongly recommends 1.0
  maxOutputTokens: 65536,
  maxRetries: 2,
};

/**
 * Productivity Analyst Stage - Extracts productivity/efficiency metrics from behavioral data
 *
 * Uses Gemini 3 Flash with structured JSON output.
 * Takes Module A output as additional input for more accurate analysis.
 */
export class ProductivityAnalystStage {
  private client: GeminiClient;
  private config: Required<Omit<ProductivityAnalystConfig, 'apiKey'>>;

  constructor(config: ProductivityAnalystConfig = {}) {
    const clientConfig: GeminiClientConfig = {
      apiKey: config.apiKey,
      model: config.model || DEFAULT_CONFIG.model,
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    };

    this.client = new GeminiClient(clientConfig);
    this.config = {
      model: config.model || DEFAULT_CONFIG.model,
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature,
      maxOutputTokens: config.maxOutputTokens || DEFAULT_CONFIG.maxOutputTokens,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    };
  }

  /**
   * Analyze sessions and Module A output to extract productivity metrics
   * Returns both the productivity data and token usage metadata
   *
   * @param sessions - Raw parsed sessions
   * @param moduleAOutput - Output from Module A (Data Analyst stage)
   */
  async analyze(
    sessions: ParsedSession[],
    moduleAOutput: StructuredAnalysisData
  ): Promise<ProductivityAnalystResult> {
    if (sessions.length === 0) {
      return { data: createDefaultProductivityAnalysisData(), usage: null };
    }

    // Check if Module A has sufficient data for productivity analysis
    if (!this.hasMinimumData(moduleAOutput)) {
      console.warn('Insufficient data from Module A for productivity analysis');
      return { data: createDefaultProductivityAnalysisData(), usage: null };
    }

    const sessionsFormatted = this.formatSessions(sessions);
    const moduleAOutputJson = JSON.stringify(moduleAOutput, null, 2);
    const userPrompt = buildProductivityAnalystUserPrompt(sessionsFormatted, moduleAOutputJson);

    try {
      const result = await this.client.generateStructured({
        systemPrompt: PRODUCTIVITY_ANALYST_SYSTEM_PROMPT,
        userPrompt,
        responseSchema: ProductivityAnalysisDataSchema,
        maxOutputTokens: this.config.maxOutputTokens,
      });

      return {
        data: this.sanitizeResponse(result.data),
        usage: result.usage,
      };
    } catch (error) {
      console.error('Productivity analysis failed:', error);
      return { data: createDefaultProductivityAnalysisData(), usage: null };
    }
  }

  /**
   * Check if Module A output has minimum data required for productivity analysis
   */
  private hasMinimumData(moduleA: StructuredAnalysisData): boolean {
    // Need at least some quotes and patterns for meaningful analysis
    const hasQuotes = moduleA.extractedQuotes && moduleA.extractedQuotes.length >= 3;
    const hasPatterns = moduleA.detectedPatterns && moduleA.detectedPatterns.length >= 1;
    const hasTypeAnalysis = !!(moduleA.typeAnalysis && moduleA.typeAnalysis.primaryType);

    return hasQuotes && hasPatterns && hasTypeAnalysis;
  }

  /**
   * Format sessions for the prompt
   * Uses shared formatter for consistency with cost estimator
   */
  private formatSessions(sessions: ParsedSession[]): string {
    return formatSessionsForAnalysis(sessions, PRODUCTIVITY_ANALYST_FORMAT);
  }

  /**
   * Sanitize response to ensure schema compliance
   */
  private sanitizeResponse(input: ProductivityAnalysisData): ProductivityAnalysisData {
    // Deep clone to avoid mutation
    const sanitized = JSON.parse(JSON.stringify(input)) as ProductivityAnalysisData;

    // Ensure flattened string fields are strings
    sanitized.iterationCyclesData = this.ensureString(sanitized.iterationCyclesData);
    sanitized.learningSignalsData = this.ensureString(sanitized.learningSignalsData);
    sanitized.efficiencyMetricsData = this.ensureString(sanitized.efficiencyMetricsData);

    // Ensure iterationSummary has all fields
    const defaultIterationSummary = {
      totalCycles: 0,
      avgTurnsPerCycle: 0,
      efficientCycleRate: 0.5,
      mostCommonTrigger: 'exploration' as const,
      predominantResolution: 'resolved' as const,
    };

    if (!sanitized.iterationSummary) {
      sanitized.iterationSummary = defaultIterationSummary;
    } else {
      sanitized.iterationSummary = {
        ...defaultIterationSummary,
        ...sanitized.iterationSummary,
      };
    }

    // Clamp iteration summary values
    sanitized.iterationSummary.totalCycles = Math.max(0, sanitized.iterationSummary.totalCycles || 0);
    sanitized.iterationSummary.avgTurnsPerCycle = Math.max(0, sanitized.iterationSummary.avgTurnsPerCycle || 0);
    sanitized.iterationSummary.efficientCycleRate = this.clamp(sanitized.iterationSummary.efficientCycleRate || 0.5, 0, 1);

    // Ensure learningVelocity has all fields
    const defaultLearningVelocity = {
      signalsPerSession: 0,
      avgDepth: 'moderate' as const,
      learningStyle: 'balanced' as const,
      overallTransferability: 0.5,
    };

    if (!sanitized.learningVelocity) {
      sanitized.learningVelocity = defaultLearningVelocity;
    } else {
      sanitized.learningVelocity = {
        ...defaultLearningVelocity,
        ...sanitized.learningVelocity,
      };
    }

    // Clamp learningVelocity values
    sanitized.learningVelocity.signalsPerSession = Math.max(0, sanitized.learningVelocity.signalsPerSession || 0);
    sanitized.learningVelocity.overallTransferability = this.clamp(sanitized.learningVelocity.overallTransferability || 0.5, 0, 1);

    // Ensure keyIndicators has all fields
    const defaultKeyIndicators = {
      firstTrySuccessRate: 0.5,
      contextSwitchFrequency: 0,
      productiveTurnRatio: 0.5,
      avgTurnsToFirstSolution: 3,
    };

    if (!sanitized.keyIndicators) {
      sanitized.keyIndicators = defaultKeyIndicators;
    } else {
      sanitized.keyIndicators = {
        ...defaultKeyIndicators,
        ...sanitized.keyIndicators,
      };
    }

    // Clamp keyIndicators values
    sanitized.keyIndicators.firstTrySuccessRate = this.clamp(sanitized.keyIndicators.firstTrySuccessRate || 0.5, 0, 1);
    sanitized.keyIndicators.contextSwitchFrequency = Math.max(0, sanitized.keyIndicators.contextSwitchFrequency || 0);
    sanitized.keyIndicators.productiveTurnRatio = this.clamp(sanitized.keyIndicators.productiveTurnRatio || 0.5, 0, 1);
    sanitized.keyIndicators.avgTurnsToFirstSolution = Math.max(0, sanitized.keyIndicators.avgTurnsToFirstSolution || 3);

    // Ensure collaborationEfficiency has all fields
    const defaultCollaborationEfficiency = {
      requestClarity: 0.5,
      specificationCompleteness: 0.5,
      proactiveVsReactiveRatio: 1,
      contextProvisionFrequency: 0.5,
    };

    if (!sanitized.collaborationEfficiency) {
      sanitized.collaborationEfficiency = defaultCollaborationEfficiency;
    } else {
      sanitized.collaborationEfficiency = {
        ...defaultCollaborationEfficiency,
        ...sanitized.collaborationEfficiency,
      };
    }

    // Clamp collaborationEfficiency values
    sanitized.collaborationEfficiency.requestClarity = this.clamp(sanitized.collaborationEfficiency.requestClarity || 0.5, 0, 1);
    sanitized.collaborationEfficiency.specificationCompleteness = this.clamp(sanitized.collaborationEfficiency.specificationCompleteness || 0.5, 0, 1);
    sanitized.collaborationEfficiency.proactiveVsReactiveRatio = Math.max(0, sanitized.collaborationEfficiency.proactiveVsReactiveRatio || 1);
    sanitized.collaborationEfficiency.contextProvisionFrequency = this.clamp(sanitized.collaborationEfficiency.contextProvisionFrequency || 0.5, 0, 1);

    // Clamp overall scores
    sanitized.overallProductivityScore = this.clamp(sanitized.overallProductivityScore || 50, 0, 100);
    sanitized.confidenceScore = this.clamp(sanitized.confidenceScore || 0.5, 0, 1);

    // Truncate summary
    sanitized.summary = this.truncate(sanitized.summary || '', 500);

    return sanitized;
  }

  /**
   * Ensure value is a string
   */
  private ensureString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    return String(value);
  }

  /**
   * Clamp a number to a range
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Truncate string to max length with ellipsis
   */
  private truncate(str: string, maxLen: number): string {
    if (!str || str.length <= maxLen) return str;
    return str.slice(0, maxLen - 3) + '...';
  }
}

/**
 * Factory function for creating ProductivityAnalystStage
 */
export function createProductivityAnalystStage(
  config?: ProductivityAnalystConfig
): ProductivityAnalystStage {
  return new ProductivityAnalystStage(config);
}
