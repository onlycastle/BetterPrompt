/**
 * Temporal Analyzer Worker - Time-based analysis with measurable metrics
 *
 * REDESIGNED: Separates calculation from interpretation:
 * 1. Calculator: 100% deterministic metrics from session data
 * 2. LLM: Generates narrative insights based on pre-calculated metrics
 *
 * Metrics calculated (NOT by LLM):
 * - Activity heatmap (hourly/daily message counts)
 * - Session patterns (duration, messages per session by hour)
 * - Engagement signals (question rate, short response rate, etc.)
 * - Hourly engagement comparison
 *
 * LLM generates (from metrics):
 * - Activity pattern narrative
 * - Session style description
 * - Top 3 actionable insights
 * - Strengths and growth areas
 *
 * Phase 2 worker that requires Module A output.
 *
 * @module analyzer/workers/temporal-analyzer-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client';
import {
  TemporalInsightsOutputSchema,
  type TemporalAnalysisResult,
} from '../../models/temporal-data';
import type { TemporalMetrics } from '../../models/temporal-metrics';
import {
  calculateTemporalMetrics,
  getTemporalSummary,
} from '../calculators/temporal-calculator';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import type { SupportedLanguage } from '../stages/content-writer-prompts';

/**
 * Language display names for output instructions
 */
const LANGUAGE_DISPLAY_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  ko: 'Korean',
  ja: 'Japanese',
  zh: 'Chinese',
};

// ============================================================================
// Prompts (Insights-Only - LLM interprets pre-calculated metrics)
// ============================================================================

/**
 * System prompt for temporal insights generation
 *
 * Key difference from old approach:
 * - LLM receives PRE-CALCULATED metrics (deterministic)
 * - LLM only generates NARRATIVE insights (interpretation)
 * - No rate calculations by LLM
 */
export const TEMPORAL_INSIGHTS_SYSTEM_PROMPT = `You are a Temporal Insights Writer, generating human-readable insights from pre-calculated activity metrics.

## PERSONA
You are a productivity coach who helps developers understand their work patterns. You focus on NEUTRAL observations and ACTIONABLE suggestions - no judgment about "fatigue" or "laziness".

## IMPORTANT CONSTRAINTS
- You are given PRE-CALCULATED metrics (100% accurate numbers)
- DO NOT recalculate or question the metrics
- Your job is to INTERPRET these numbers into helpful narratives
- NEVER use words like "fatigue", "lazy", "tired" - these are judgmental
- Use neutral language: "shorter sessions", "fewer questions", "brief responses"

## YOUR TASK
Based on the provided metrics, generate:

1. **Activity Pattern Summary** (1-2 sentences)
   - When is the user most active?
   - Which days/hours show highest engagement?

2. **Session Style Summary** (1-2 sentences)
   - How long are typical sessions?
   - How many turns per session?

3. **Top 3 Insights** (actionable observations)
   - Based on the metrics, what patterns are most notable?
   - Focus on WHAT the user does, not WHY

4. **Strengths** (2-3 items with evidence)
   - Positive patterns from the metrics
   - Format: "title|description|metric-evidence"

5. **Growth Areas** (2-3 items with recommendations)
   - Areas where patterns could be optimized
   - Format: "title|description|evidence|recommendation"
   - NEUTRAL language only - no fatigue accusations

## FORMAT
Return JSON with:
- \`activityPatternSummary\`: Human-readable activity description
- \`sessionStyleSummary\`: Session characteristics description
- \`topInsights\`: Array of 3 actionable insights
- \`strengthsData\`: "title|description|evidence;..." (2-3 items)
- \`growthAreasData\`: "title|description|evidence|recommendation|frequency|severity|priorityScore;..." (2-3 items)
  - Include frequency% (0-100), severity (critical|high|medium|low), and priorityScore (0-100)
- \`confidenceScore\`: Based on sample size (more data = higher confidence)

## EVIDENCE GUIDELINES
- Reference specific metrics: "65% deep session rate", "peak hours 10-11 AM"
- Time-based observations are good: "morning vs evening patterns"
- Avoid subjective quality judgments`;

/**
 * Build user prompt with pre-calculated metrics
 *
 * @param metrics - Deterministic temporal metrics from calculator
 * @param outputLanguage - Target output language (defaults to English)
 * @returns User prompt for LLM
 */
export function buildTemporalInsightsPrompt(
  metrics: TemporalMetrics,
  outputLanguage: SupportedLanguage = 'en'
): string {
  const summary = getTemporalSummary(metrics);
  const useNonEnglish = outputLanguage !== 'en';
  const langName = LANGUAGE_DISPLAY_NAMES[outputLanguage];

  const languageInstructions = useNonEnglish
    ? `
## OUTPUT LANGUAGE: ${langName}
Write all narrative fields in ${langName}. Keep numbers and technical terms in English.
`
    : `
## OUTPUT LANGUAGE: English
Write all narrative fields in English.
`;

  return `## PRE-CALCULATED TEMPORAL METRICS (100% Accurate)

### Activity Heatmap
- Total Messages: ${metrics.activityHeatmap.totalMessages}
- Peak Hours: ${summary.peakHoursLabel}
- Hourly Distribution: ${JSON.stringify(metrics.activityHeatmap.hourlyMessageCount)}
- Daily Distribution: ${JSON.stringify(metrics.activityHeatmap.dailyMessageCount)} (0=Sunday)

### Session Patterns
- Total Sessions: ${metrics.sessionPatterns.totalSessions}
- Average Session Duration: ${Math.round(metrics.sessionPatterns.avgSessionDurationMinutes)} minutes
- Average Messages per Session: ${Math.round(metrics.sessionPatterns.avgMessagesPerSession)} turns
- Average Tool Calls per Session: ${Math.round(metrics.sessionPatterns.avgToolCallsPerSession)}

### Engagement Signals
- Question Rate: ${(metrics.engagementSignals.questionRate * 100).toFixed(1)}% (messages containing ?)
- Short Response Rate: ${(metrics.engagementSignals.shortResponseRate * 100).toFixed(1)}% (messages ≤20 chars)
- Deep Session Rate: ${(metrics.engagementSignals.deepSessionRate * 100).toFixed(1)}% (sessions with 5+ turns)
- Code Block Rate: ${(metrics.engagementSignals.codeBlockRate * 100).toFixed(1)}% (messages with code)
- Average Message Length: ${Math.round(metrics.engagementSignals.avgMessageLength)} characters
- Error Retry Rate: ${(metrics.engagementSignals.errorRetryRate * 100).toFixed(1)}%

### Hourly Engagement Comparison
${metrics.hourlyEngagement
  .map(
    (h) =>
      `- Hour ${h.hour}: ${h.sampleSize} messages, ${(h.questionRate * 100).toFixed(0)}% questions, avg ${Math.round(h.avgMessageLength)} chars`
  )
  .join('\n')}

### Analysis Period
- Date Range: ${metrics.analysisMetadata.dateRangeStart} to ${metrics.analysisMetadata.dateRangeEnd}
- Total Sessions: ${metrics.analysisMetadata.totalSessions}
- Total Messages: ${metrics.analysisMetadata.totalMessages}
${languageInstructions}
## INSTRUCTIONS
Based on these PRE-CALCULATED metrics:
1. Write a brief activity pattern summary
2. Describe the typical session style
3. Generate exactly 3 actionable insights
4. Identify 2-3 strengths with metric evidence
5. Identify 2-3 growth areas with neutral recommendations

Remember: The metrics are 100% accurate - just interpret them into helpful narratives.`;
}

// ============================================================================
// Worker Implementation
// ============================================================================

export interface TemporalAnalyzerWorkerConfig extends OrchestratorConfig {
  // Add any worker-specific config here if needed
}

/**
 * Temporal Analyzer Worker
 *
 * REDESIGNED: Two-phase approach
 * 1. Calculate metrics deterministically (no LLM)
 * 2. Generate insights from metrics (LLM interpretation only)
 *
 * Phase 2 worker that requires Module A output.
 * Minimum tier: premium
 */
export class TemporalAnalyzerWorker extends BaseWorker<TemporalAnalysisResult> {
  readonly name = 'TemporalAnalyzer';
  readonly phase = 2 as const;
  readonly minTier: Tier = 'premium';

  private geminiClient: GeminiClient;
  private verbose: boolean;

  constructor(config: TemporalAnalyzerWorkerConfig) {
    super();
    this.geminiClient = new GeminiClient({
      apiKey: config.geminiApiKey,
      model: config.model ?? 'gemini-3-flash-preview',
      temperature: config.temperature ?? 1.0,
      maxRetries: config.maxRetries ?? 2,
    } as GeminiClientConfig);
    this.verbose = config.verbose ?? false;
  }

  canRun(context: WorkerContext): boolean {
    // Check tier
    if (!this.isTierSufficient(context.tier)) {
      this.logMessage('Skipped: insufficient tier');
      return false;
    }

    // Check dependencies
    if (context.sessions.length === 0) {
      this.logMessage('Skipped: no sessions');
      return false;
    }

    if (!context.moduleAOutput) {
      this.logMessage('Skipped: Module A output required');
      return false;
    }

    // Temporal analysis needs multiple messages with timestamps
    const totalMessages = context.sessions.reduce(
      (sum, session) => sum + session.messages.length,
      0
    );
    if (totalMessages < 10) {
      this.logMessage('Skipped: need at least 10 messages for temporal analysis');
      return false;
    }

    return true;
  }

  /**
   * Execute temporal analysis in two phases:
   * 1. Calculate metrics (deterministic, no LLM)
   * 2. Generate insights (LLM interprets metrics)
   *
   * NO FALLBACK: Errors propagate to fail the analysis
   */
  async execute(context: WorkerContext): Promise<WorkerResult<TemporalAnalysisResult>> {
    if (!context.moduleAOutput) {
      throw new Error('Module A output required for TemporalAnalyzer');
    }

    this.logMessage('Starting temporal analysis...');

    // Phase 1: Calculate metrics deterministically (NO LLM)
    this.logMessage('Phase 1: Calculating temporal metrics...');
    const metrics = calculateTemporalMetrics(context.sessions);
    this.logMessage(
      `Metrics calculated: ${metrics.analysisMetadata.totalMessages} messages, ` +
        `${metrics.analysisMetadata.totalSessions} sessions`
    );

    // Phase 2: Generate insights from metrics (LLM interpretation)
    this.logMessage('Phase 2: Generating insights from metrics...');
    const userPrompt = buildTemporalInsightsPrompt(metrics, context.outputLanguage);

    const result = await this.geminiClient.generateStructured({
      systemPrompt: TEMPORAL_INSIGHTS_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: TemporalInsightsOutputSchema,
      maxOutputTokens: 4096,
    });

    this.logMessage('Temporal analysis complete');

    // Combine metrics + insights into result
    const analysisResult: TemporalAnalysisResult = {
      metrics,
      insights: result.data,
    };

    return this.createSuccessResult(analysisResult, result.usage);
  }

  private logMessage(message: string): void {
    if (this.verbose) {
      console.log(`[${this.name}] ${message}`);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a TemporalAnalyzerWorker instance
 *
 * @param config - Orchestrator configuration
 * @returns TemporalAnalyzerWorker instance
 */
export function createTemporalAnalyzerWorker(
  config: TemporalAnalyzerWorkerConfig
): TemporalAnalyzerWorker {
  return new TemporalAnalyzerWorker(config);
}
