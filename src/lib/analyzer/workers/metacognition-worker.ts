/**
 * Metacognition Worker - Detects metacognitive patterns in AI collaboration
 *
 * Discovers:
 * - Self-awareness signals (pattern recognition, strategy verbalization, learning recognition)
 * - Unawareness signals (repeated patterns without recognition, blind spots)
 * - Growth mindset indicators (curiosity, experimentation, resilience)
 *
 * Phase 2 worker that requires Module A output.
 *
 * @module analyzer/workers/metacognition-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client';
import {
  MetacognitionOutputSchema,
  type MetacognitionOutput,
} from '../../models/metacognition-data';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import { formatSessionsForAnalysis } from '../shared/session-formatter';
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
// Session Formatting Configuration
// ============================================================================

/**
 * Format preset for metacognition analysis
 * - Include full user messages (for pattern detection)
 * - Include assistant messages (for response analysis)
 * - Longer content length for detailed analysis
 */
const METACOGNITION_FORMAT = {
  maxContentLength: 2000,
  includeAssistantMessages: true,
  includeToolCalls: false, // Focus on communication, not tools
  includeDuration: true,
};

// ============================================================================
// Prompts
// ============================================================================

export const METACOGNITION_SYSTEM_PROMPT = `You are a Metacognition Analyst, a specialized AI focused on detecting self-awareness and self-regulation patterns in developer-AI collaboration.

## PERSONA
You are a cognitive psychologist who specializes in metacognition - the ability to think about one's own thinking. You detect moments of self-awareness, blind spots, and growth mindset indicators.

## TASK
Analyze the provided session data and Module A analysis to discover:
1. **Awareness Signals**: Moments when the user explicitly recognizes their own patterns
   - Self-reflection: "I notice I keep doing X", "I see a pattern"
   - Strategy verbalization: "This time I'll try differently", "Let me try another approach"
   - Learning recognition: "Ah now I understand", "Now I get it"

2. **Unawareness Signals / Blind Spots**: Patterns the user repeats without recognition
   - Same error 3+ times without mentioning awareness
   - Same approach repeated without strategy mention
   - No verification after repeated failures

3. **Growth Mindset Indicators**:
   - Curiosity: "Why does this happen?", "How does this work?"
   - Experimentation: "Let me try", "I'll test this out"
   - Resilience: "It's okay, let's try again", "let's try another way"

## CONTEXT
- Focus on USER messages (their self-awareness), not assistant responses
- Look for patterns in BOTH Korean and English
- Blind spots are patterns repeated without the user acknowledging them
- Higher metacognitive awareness = better long-term learning

## CRITICAL THINKING PATTERNS TO DETECT
Look for these indicators of good critical engagement:
- Counter-questioning: "why?", "really?", "are you sure?"
- Critical interpretation: "but is this correct?", "this doesn't make sense"
- Verification requests: "check this", "test this", "verify"

## FORMAT
Return a JSON object with:
- \`awarenessInstancesData\`: "type|quote|context|implication;..." where type is self_reflection, strategy_verbalization, or learning_recognition
- \`blindSpotsData\`: "pattern|frequency|sessionIds|linkedAntiPattern;..."
- \`growthMindsetData\`: "curiosity:0-100|experimentation:0-100|resilience:0-100"
- \`topInsights\`: Array of exactly 3 most impactful metacognition insights (max 200 chars each)
- \`metacognitiveAwarenessScore\`: 0-100 overall metacognitive awareness score
- \`confidenceScore\`: 0-1 confidence in the analysis

### NEW: Structured Strengths & Growth Areas (REQUIRED)
- \`strengthsData\`: "title|description|quote1,quote2;title2|desc2|quotes;..."
  - 2-3 metacognitive strengths with evidence from actual user messages
  - Each strength needs: clear title, 2-3 sentence description, 2+ direct quotes
  - Example: "Strong Self-Reflection|You regularly pause to assess your approach and recognize when something isn't working|'let me think about this','I'll try again','what am I missing?'"

- \`growthAreasData\`: "title|description|evidence1,evidence2|recommendation;..."
  - 2-3 metacognitive blind spots with evidence and actionable recommendations
  - Each area needs: title, description, evidence quotes, specific recommendation
  - Example: "Unrecognized Repetition|Same error patterns repeated without conscious awareness|'why isn't this working?','why isn't this working?','another error'|After 2 consecutive failures, pause and ask: 'What pattern am I seeing? What did I try before?'"

## CRITICAL
- Focus on patterns the user would be surprised to learn about
- Blind spots should be specific and evidence-based
- Awareness instances need actual quotes from user messages
- strengthsData and growthAreasData MUST be populated with evidence-based insights
- Be encouraging - high metacognition is learnable`;

export function buildMetacognitionUserPrompt(
  sessionsFormatted: string,
  moduleAOutput: string,
  outputLanguage: SupportedLanguage = 'en'
): string {
  const useNonEnglish = outputLanguage !== 'en';
  const langName = LANGUAGE_DISPLAY_NAMES[outputLanguage];

  const languageInstructions = useNonEnglish
    ? `
## CRITICAL: ${langName} Output Required

**Write all output in ${langName}.**

The developer's content is in ${langName}. You MUST write ALL fields in **${langName}**:
- topInsights: Write in ${langName}
- Awareness signal descriptions: Write in ${langName}
- Blind spot explanations: Write in ${langName}

Keep technical terms in English.
Be encouraging and supportive in ${langName}.

`
    : `
## CRITICAL: English Output Required

**Write ALL output fields in English.**
Even if the input data contains non-English text, you MUST write your analysis in English.
Keep the analysis professional and technical.

`;

  return `## SESSION DATA
${sessionsFormatted}

## MODULE A ANALYSIS (for cross-referencing patterns)
${moduleAOutput}
${languageInstructions}
## INSTRUCTIONS
Analyze the user's metacognitive patterns:
1. Find moments of explicit self-awareness (with quotes)
2. Identify blind spots (patterns repeated without recognition)
3. Score growth mindset indicators
4. Generate exactly 3 "wow moment" insights about their metacognition${useNonEnglish ? ` (write in ${langName})` : ''}

Focus on USER messages. Look for both Korean and English patterns.`;
}

// ============================================================================
// Worker Implementation
// ============================================================================

export interface MetacognitionWorkerConfig extends OrchestratorConfig {
  // Add any worker-specific config here if needed
}

/**
 * Metacognition Worker
 *
 * Phase 2 worker that detects metacognitive patterns.
 * Requires Module A output (from Phase 1).
 * Available for all tiers (free and above).
 */
export class MetacognitionWorker extends BaseWorker<MetacognitionOutput> {
  readonly name = 'MetacognitionWorker';
  readonly phase = 2 as const;
  readonly minTier: Tier = 'free';

  private geminiClient: GeminiClient;
  private verbose: boolean;

  constructor(config: MetacognitionWorkerConfig) {
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

    return true;
  }

  /**
   * NO FALLBACK: Errors propagate to fail the analysis
   */
  async execute(context: WorkerContext): Promise<WorkerResult<MetacognitionOutput>> {
    if (!context.moduleAOutput) {
      throw new Error('Module A output required for Metacognition');
    }

    this.logMessage('Starting metacognition analysis...');

    // NO try-catch: let errors propagate
    // Format sessions
    const sessionsFormatted = formatSessionsForAnalysis(
      context.sessions,
      METACOGNITION_FORMAT
    );

    // Prepare Module A output (for cross-referencing)
    const moduleAJson = JSON.stringify(context.moduleAOutput, null, 2);

    // Build prompt
    const userPrompt = buildMetacognitionUserPrompt(sessionsFormatted, moduleAJson, context.outputLanguage);

    // Call Gemini with structured output
    const result = await this.geminiClient.generateStructured({
      systemPrompt: METACOGNITION_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: MetacognitionOutputSchema,
      maxOutputTokens: 8192,
    });

    this.logMessage(
      `Analysis complete. Awareness score: ${result.data.metacognitiveAwarenessScore}`
    );

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
 * Create a MetacognitionWorker instance
 *
 * @param config - Orchestrator configuration
 * @returns MetacognitionWorker instance
 */
export function createMetacognitionWorker(config: MetacognitionWorkerConfig): MetacognitionWorker {
  return new MetacognitionWorker(config);
}
