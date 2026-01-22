/**
 * Temporal Analyzer Worker - Time-based prompt performance analysis
 *
 * Analyzes qualitative metrics by hour:
 * - Counter-questioning rate
 * - Critical interpretation rate
 * - Verification request rate
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

### 1. QUALITATIVE INTERACTION METRICS (Core Metrics)
For each hour, measure:
- **Counter-questioning rate**: How often the user asks "why?", "really?", "are you sure?", "is there another way?"
- **Critical interpretation rate**: How often the user challenges AI: "but is this correct?", "I don't understand", "doesn't make sense"
- **Verification request rate**: How often the user asks to verify: "check this", "test this", "verify"

### 2. FATIGUE/LAZINESS SIGNALS (Fatigue Metrics)
- **Typo rate**: Uncorrected typos (e.g., teh, taht, etc.)
- **Passive acceptance rate**: AI output accepted without any questioning or verification
- **Short response rate**: "ok", "yes", "sure" without elaboration

### 3. PEAK vs CAUTION HOURS
- Identify hours with HIGHEST critical thinking (counter-questioning + critical interpretation + verification)
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
High quality (counter-questioning/critical interpretation):
- "Why does this happen?" (why question)
- "Really? Are you sure?" (challenging)
- "Is there another way?" (exploring alternatives)
- "Check this" (verification request)

Low quality (fatigue signals):
- "ok" without context (passive acceptance)
- Typos ignored, proceeding anyway
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
  moduleAOutput: string,
  useKorean: boolean = false
): string {
  const koreanInstructions = useKorean
    ? `
## CRITICAL: Korean Output Required

**Write all output in Korean.**

The developer's content is in Korean. You MUST write ALL fields in **Korean**:
- topInsights: Write in Korean
- Peak/Caution hour descriptions: Write in Korean
- Fatigue pattern explanations: Write in Korean
- Recommendations: Write in Korean

Keep technical terms and time formats in English.

`
    : '';

  return `## SESSION DATA (with timestamps)
${sessionsFormatted}

## MODULE A ANALYSIS (for context)
${moduleAOutput}
${koreanInstructions}
## INSTRUCTIONS
Analyze time-based prompt quality patterns:
1. Calculate hourly quality metrics (counter-questioning, critical interpretation, verification)
2. Identify fatigue signals by hour (typos, passive acceptance, short responses)
3. Find peak performance hours (highest critical thinking)
4. Find caution hours (lowest critical thinking / highest fatigue)
5. Detect specific fatigue patterns (late_night_drop, typo_spike, etc.)

Generate exactly 3 actionable temporal insights.${useKorean ? ' (write in Korean)' : ''}

IMPORTANT: Use QUALITATIVE metrics (counter-questioning, critical interpretation, verification) rather than simple prompt length.`;
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
    const userPrompt = buildTemporalUserPrompt(sessionsFormatted, moduleAJson, context.useKorean);

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
