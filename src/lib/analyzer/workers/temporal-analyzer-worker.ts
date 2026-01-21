/**
 * Temporal Analyzer Worker - Time-based prompt performance analysis
 *
 * Analyzes qualitative metrics by hour:
 * - Counter-questioning rate (역질문)
 * - Critical interpretation rate (비판적 해석)
 * - Verification request rate (검증 요청)
 * - Typo rate & passive acceptance (fatigue signals)
 *
 * Phase 2 worker that requires Module A output.
 *
 * @module analyzer/workers/temporal-analyzer-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client';
import {
  TemporalAnalysisOutputSchema,
  type TemporalAnalysisOutput,
} from '../../models/temporal-data';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import { formatSessionsForAnalysis } from '../shared/session-formatter';

// ============================================================================
// Session Formatting Configuration
// ============================================================================

/**
 * Format preset for temporal analysis
 * - Include timestamps (critical for time analysis)
 * - Include full user messages for quality analysis
 * - Include assistant messages for interaction patterns
 */
const TEMPORAL_FORMAT = {
  maxContentLength: 1500,
  includeAssistantMessages: true,
  includeToolCalls: false,
  includeDuration: true,
  includeTimestamps: true, // Critical for temporal analysis
};

// ============================================================================
// Prompts
// ============================================================================

export const TEMPORAL_SYSTEM_PROMPT = `You are a Temporal Performance Analyst, a specialized AI focused on analyzing time-based patterns in developer-AI collaboration quality.

## PERSONA
You are a productivity researcher who studies how cognitive performance varies throughout the day. You detect fatigue patterns, peak performance hours, and quality degradation signals.

## TASK
Analyze the provided session data to discover time-based patterns using QUALITATIVE metrics:

### 1. QUALITATIVE INTERACTION METRICS (핵심 지표)
For each hour, measure:
- **Counter-questioning rate**: How often the user asks "왜?", "정말?", "확실해?", "why?", "are you sure?", "다른 방법은?"
- **Critical interpretation rate**: How often the user challenges AI: "근데 이거 맞아?", "이해가 안 되는데", "doesn't make sense"
- **Verification request rate**: How often the user asks to verify: "확인해 봐", "test this", "검증해"

### 2. FATIGUE/LAZINESS SIGNALS (피로 지표)
- **Typo rate**: Uncorrected typos (Korean: 오타 방치, English: teh, taht, etc.)
- **Passive acceptance rate**: AI output accepted without any questioning or verification
- **Short response rate**: "ㅇㅋ", "ok", "yes", "ㄱㄱ" without elaboration

### 3. PEAK vs CAUTION HOURS
- Identify hours with HIGHEST critical thinking (역질문 + 비판적 해석 + 검증 요청)
- Identify hours with LOWEST critical thinking / HIGHEST fatigue signals

### 4. FATIGUE PATTERNS
Detect specific patterns:
- \`late_night_drop\`: Critical thinking drops significantly after 22:00
- \`post_lunch_dip\`: Quality dip around 13:00-15:00
- \`end_of_day_rush\`: Quality drops toward session end
- \`typo_spike\`: Sudden increase in typos at specific hours

## CONTEXT
- Message timestamps are provided (ISO format or HH:MM)
- Group by hour (0-23) when analyzing patterns
- Focus on USER messages for quality analysis
- Compare peak hours vs caution hours

## CRITICAL THINKING PATTERN EXAMPLES
High quality (역질문/비판적 해석):
- "왜 이렇게 되는 거야?" (why question)
- "정말? 확실해?" (challenging)
- "다른 방법은 없어?" (exploring alternatives)
- "확인해 봐" (verification request)

Low quality (피로 시그널):
- "ㅇㅋ" without context (passive acceptance)
- "오타 있는데 그냥 진행" (typo ignored)
- AI output copied without any questions

## FORMAT
Return a JSON object with:
- \`hourlyPatternsData\`: "hour:sampleCount:counterQuestionRate:criticalRate:verificationRate:typoRate:passiveAcceptanceRate;..."
- \`peakHoursData\`: "hours(comma-sep)|characteristics|avgCounterQ:avgCritical:avgVerification"
- \`cautionHoursData\`: "hours(comma-sep)|characteristics|passiveAcceptanceRate:typoRate:criticalThinkingDrop%"
- \`fatiguePatternsData\`: "type|hours(comma-sep)|evidence|recommendation;..."
- \`qualitativeInsightsData\`: "type(strength/improvement)|insight|evidence|linkedHours(comma-sep);..."
- \`topInsights\`: Array of exactly 3 most impactful temporal insights (max 200 chars each)
- \`confidenceScore\`: 0-1 confidence in the analysis

## CRITICAL
- Rate values should be 0.00-1.00 (proportion)
- Only report patterns with sufficient evidence (3+ messages in that hour)
- Focus on ACTIONABLE insights
- Be specific about time-based recommendations`;

export function buildTemporalUserPrompt(
  sessionsFormatted: string,
  moduleAOutput: string
): string {
  return `## SESSION DATA (with timestamps)
${sessionsFormatted}

## MODULE A ANALYSIS (for context)
${moduleAOutput}

## INSTRUCTIONS
Analyze time-based prompt quality patterns:
1. Calculate hourly quality metrics (counter-questioning, critical interpretation, verification)
2. Identify fatigue signals by hour (typos, passive acceptance, short responses)
3. Find peak performance hours (highest critical thinking)
4. Find caution hours (lowest critical thinking / highest fatigue)
5. Detect specific fatigue patterns (late_night_drop, typo_spike, etc.)

Generate exactly 3 actionable temporal insights.

IMPORTANT: Use QUALITATIVE metrics (역질문, 비판적 해석, 검증 요청) rather than simple prompt length.`;
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
 * Phase 2 worker that analyzes time-based quality patterns.
 * Requires Module A output (from Phase 1).
 * Minimum tier: premium
 */
export class TemporalAnalyzerWorker extends BaseWorker<TemporalAnalysisOutput> {
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
   * NO FALLBACK: Errors propagate to fail the analysis
   */
  async execute(context: WorkerContext): Promise<WorkerResult<TemporalAnalysisOutput>> {
    if (!context.moduleAOutput) {
      throw new Error('Module A output required for TemporalAnalyzer');
    }

    this.logMessage('Starting temporal analysis...');

    // NO try-catch: let errors propagate
    // Format sessions with timestamps
    const sessionsFormatted = formatSessionsForAnalysis(
      context.sessions,
      TEMPORAL_FORMAT
    );

    // Prepare Module A output
    const moduleAJson = JSON.stringify(context.moduleAOutput, null, 2);

    // Build prompt
    const userPrompt = buildTemporalUserPrompt(sessionsFormatted, moduleAJson);

    // Call Gemini with structured output
    const result = await this.geminiClient.generateStructured({
      systemPrompt: TEMPORAL_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: TemporalAnalysisOutputSchema,
      maxOutputTokens: 8192,
    });

    this.logMessage('Temporal analysis complete');

    return this.createSuccessResult(result.data, result.usage);
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
