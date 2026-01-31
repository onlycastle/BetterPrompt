/**
 * Content Writer Stage Implementation
 *
 * Phase 3 of the 4-phase orchestrator pipeline.
 * Uses Gemini 3 Flash for narrative-only content generation.
 * Temperature: 1.0 (Gemini's recommended default).
 *
 * Generates: personalitySummary, promptPatterns, topFocusAreas
 * All structural assembly is handled by evaluation-assembler.ts
 *
 * @module analyzer/stages/content-writer
 */

import { GeminiClient, type GeminiClientConfig, type TokenUsage } from '../clients/gemini-client';
import {
  NarrativeLLMResponseSchema,
  type NarrativeLLMResponse,
} from '../../models/verbose-evaluation';
import type { AgentOutputs } from '../../models/agent-outputs';
import type { Phase1Output, DeveloperUtterance } from '../../models/phase1-output';
import {
  CONTENT_WRITER_SYSTEM_PROMPT_V3,
  buildContentWriterUserPromptV3,
} from './content-writer-prompts';
import type { DimensionResourceMatch } from '../../models/verbose-evaluation';
import { summarizeAgentOutputsForPhase3 } from './phase3-summarizer';

/**
 * Configuration for the Content Writer stage
 */
export interface ContentWriterConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  maxRetries?: number;
  verbose?: boolean;
}

/**
 * Result of content writer stage including token usage
 */
export interface ContentWriterResult {
  data: any; // NarrativeLLMResponse
  usage: TokenUsage;
}

/**
 * Default configuration values
 *
 * maxOutputTokens set to maximum (65536) to prevent truncation.
 * Gemini 3 Flash supports up to 65536 output tokens.
 */
const DEFAULT_CONFIG: Required<Omit<ContentWriterConfig, 'apiKey'>> = {
  model: 'gemini-3-flash-preview',
  temperature: 1.0, // Gemini 3 strongly recommends 1.0
  maxOutputTokens: 65536,
  maxRetries: 2,
  verbose: false,
};

/**
 * Content Writer Stage - Generates narrative content from Phase 2 analysis
 *
 * Uses Gemini 3 Flash with structured JSON output.
 * Only generates narrative fields (personalitySummary, promptPatterns, topFocusAreas).
 * Structural data assembly is handled by evaluation-assembler.
 */
export class ContentWriterStage {
  private client: GeminiClient;
  private config: Required<Omit<ContentWriterConfig, 'apiKey'>>;

  constructor(config: ContentWriterConfig = {}) {
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
      verbose: config.verbose ?? DEFAULT_CONFIG.verbose,
    };
  }

  /**
   * Transform Phase 2 analysis into personalized narrative
   *
   * Phase 3 in the 4-phase pipeline:
   * - Phase 2 workers provide semantic analysis (strengths, trust, workflow, etc.)
   * - Phase 2.5 (TypeClassifier) provides classification + synthesis
   * - Phase 3 (this) generates narrative-only content
   * - Structural assembly is handled by evaluation-assembler
   *
   * @param sessionCount - Number of sessions analyzed (from Phase 1 metrics)
   * @param agentOutputs - All Phase 2 + 2.5 worker outputs
   * @param phase1Output - Optional Phase1Output for deterministic evidence verification
   * @param knowledgeResources - Optional DB-backed knowledge resources from Phase 2.75
   * @returns ContentWriterResult with NarrativeLLMResponse and token usage
   */
  async transformV3(
    sessionCount: number,
    agentOutputs: AgentOutputs,
    phase1Output?: Phase1Output,
    knowledgeResources?: DimensionResourceMatch[]
  ): Promise<ContentWriterResult> {
    const agentOutputsSummary = summarizeAgentOutputsForPhase3(agentOutputs);

    // Select top 20 utterances for Content Writer to quote directly
    // No length-based filtering to include diverse utterances
    const topUtterances = phase1Output
      ? phase1Output.developerUtterances
          .slice(0, 20)
          .map(u => ({
            id: u.id,
            text: (u.displayText || u.text).slice(0, 1500),
            wordCount: u.wordCount
          }))
      : undefined;

    const userPrompt = buildContentWriterUserPromptV3(
      agentOutputsSummary,
      sessionCount,
      knowledgeResources,
      topUtterances
    );

    const result = await this.client.generateStructured({
      systemPrompt: CONTENT_WRITER_SYSTEM_PROMPT_V3,
      userPrompt,
      responseSchema: NarrativeLLMResponseSchema,
      maxOutputTokens: this.config.maxOutputTokens,
    });

    // Sanitize narrative-only response
    const sanitized = this.sanitizeNarrativeResponse(result.data, phase1Output);

    return {
      data: sanitized,
      usage: result.usage,
    };
  }

  /**
   * Verify that Phase 2 worker examples (anti-patterns, critical thinking, planning)
   * contain only developer utterances, not AI responses.
   *
   * Must run BEFORE evaluation assembly since premium sections read from agentOutputs.
   * Mutates agentOutputs in place to filter out AI-only quotes.
   */
  public verifyPhase2WorkerExamples(
    agentOutputs: AgentOutputs,
    phase1Output: Phase1Output
  ): void {
    const utteranceLookup = new Map<string, DeveloperUtterance>();
    for (const u of phase1Output.developerUtterances) {
      utteranceLookup.set(u.id, u);
    }

    const { devTexts, aiTexts } = this.buildCorpora(phase1Output);
    if (devTexts.length === 0) return;

    const stats = { verified: 0, replaced: 0, removed: 0 };

    // 1. Anti-pattern examples (have utteranceId → ID-based lookup)
    if (agentOutputs.trustVerification?.antiPatterns) {
      for (const ap of agentOutputs.trustVerification.antiPatterns) {
        if (!Array.isArray(ap.examples)) continue;

        ap.examples = ap.examples.filter((ex: any) => {
          if (!ex.utteranceId) {
            return this.filterBySubstringMatch(ex.quote, devTexts, aiTexts, stats);
          }
          return this.verifyQuoteByUtteranceId(ex, utteranceLookup, stats);
        });
      }
    }

    // 2. Critical thinking moments (have optional utteranceId + quote)
    if (agentOutputs.workflowHabit?.criticalThinkingMoments) {
      agentOutputs.workflowHabit.criticalThinkingMoments =
        agentOutputs.workflowHabit.criticalThinkingMoments.filter((moment: any) => {
          if (!moment.quote || typeof moment.quote !== 'string') return true;

          if (moment.utteranceId) {
            return this.verifyQuoteByUtteranceId(moment, utteranceLookup, stats);
          }

          return this.filterBySubstringMatch(moment.quote, devTexts, aiTexts, stats);
        });
    }

    // 3. Planning habit examples (plain strings, no utteranceId)
    if (agentOutputs.workflowHabit?.planningHabits) {
      for (const habit of agentOutputs.workflowHabit.planningHabits) {
        if (!Array.isArray(habit.examples)) continue;

        habit.examples = habit.examples.filter((example: string) => {
          if (!example || typeof example !== 'string') return true;
          return this.filterBySubstringMatch(example, devTexts, aiTexts, stats);
        });
      }
    }

    // 4. StrengthGrowth evidence (strengths + growth areas)
    if (agentOutputs.strengthGrowth) {
      const filterEvidence = (items: any[] | undefined): void => {
        if (!items) return;
        for (const item of items) {
          if (!Array.isArray(item.evidence)) continue;
          item.evidence = item.evidence.filter((ev: any) => {
            if (ev.utteranceId) {
              return this.verifyQuoteByUtteranceId(ev, utteranceLookup, stats);
            }
            if (!ev.quote || typeof ev.quote !== 'string') return true;
            return this.filterBySubstringMatch(ev.quote, devTexts, aiTexts, stats);
          });
        }
      };

      filterEvidence(agentOutputs.strengthGrowth.strengths);
      filterEvidence(agentOutputs.strengthGrowth.growthAreas);
    }

    const total = stats.verified + stats.replaced + stats.removed;
    if (total > 0) {
      this.log(`Phase 2 worker verification: verified=${stats.verified}, replaced=${stats.replaced}, removed=${stats.removed}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Sanitize narrative-only LLM response
   *
   * Deep clones to avoid mutation. Prompt pattern example verification
   * is handled by evaluation-assembler.sanitizePromptPatterns().
   */
  private sanitizeNarrativeResponse(
    input: NarrativeLLMResponse,
    _phase1Output?: Phase1Output
  ): NarrativeLLMResponse {
    // Deep clone to avoid mutation
    return JSON.parse(JSON.stringify(input)) as NarrativeLLMResponse;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // User-Message-Only Verification Layer
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build normalized text corpora from Phase1Output for quote verification.
   * Returns developer utterance texts and AI response texts, both normalized.
   */
  private buildCorpora(phase1Output: Phase1Output): { devTexts: string[]; aiTexts: string[] } {
    const devTexts = phase1Output.developerUtterances.map(u => this.normalizeText(u.text));
    const aiTexts = phase1Output.aiResponses.map(r => this.normalizeText(r.textSnippet));
    return { devTexts, aiTexts };
  }

  /**
   * Normalize text for comparison: trim, lowercase, collapse whitespace.
   */
  private normalizeText(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Check if a normalized quote matches any text in a corpus.
   */
  private matchesCorpus(normalizedQuote: string, corpus: string[]): boolean {
    return corpus.some(text => text.length > 0 && this.quotesMatch(normalizedQuote, text));
  }

  /**
   * Check if two quote strings match (allowing for truncation and minor differences)
   *
   * Uses a substring containment check: if the shorter quote is contained
   * within the longer one, or vice versa, they're considered matching.
   */
  private quotesMatch(quote1: string, quote2: string): boolean {
    const normalized1 = quote1.trim().toLowerCase().replace(/\s+/g, ' ');
    const normalized2 = quote2.trim().toLowerCase().replace(/\s+/g, ' ');

    if (normalized1 === normalized2) return true;

    // Check substring containment (handles truncation)
    const shorter = normalized1.length <= normalized2.length ? normalized1 : normalized2;
    const longer = normalized1.length > normalized2.length ? normalized1 : normalized2;

    // If the shorter string is at least 30 chars and is contained in the longer, match
    if (shorter.length >= 30 && longer.includes(shorter)) return true;

    // Check prefix match (first 50 chars) — handles minor ending differences
    const prefixLen = Math.min(50, shorter.length);
    if (prefixLen >= 20 && normalized1.slice(0, prefixLen) === normalized2.slice(0, prefixLen)) return true;

    return false;
  }

  /**
   * Verify a quote against a known utterance by ID.
   * If the utteranceId is not found, removes the entry.
   * If the quote doesn't match the original, replaces it with the original text.
   * Returns true to keep, false to remove. Mutates the entry's quote if mismatched.
   */
  private verifyQuoteByUtteranceId(
    entry: { utteranceId: string; quote: string },
    utteranceLookup: Map<string, DeveloperUtterance>,
    stats: { verified: number; replaced: number; removed: number }
  ): boolean {
    const original = utteranceLookup.get(entry.utteranceId);
    if (!original) {
      this.log(`utteranceId "${entry.utteranceId}" not found — removing`);
      stats.removed++;
      return false;
    }

    const originalQuote = original.text.slice(0, 500);
    if (this.quotesMatch(entry.quote, originalQuote)) {
      stats.verified++;
    } else {
      entry.quote = originalQuote;
      stats.replaced++;
    }
    return true;
  }

  /**
   * Filter a quote by substring matching against developer and AI corpora.
   * Returns true to keep, false to remove.
   */
  private filterBySubstringMatch(
    quote: string,
    devTexts: string[],
    aiTexts: string[],
    stats: { verified: number; replaced: number; removed: number }
  ): boolean {
    if (!quote || typeof quote !== 'string') return true;

    const normalized = this.normalizeText(quote);
    if (normalized.length < 15) {
      return true; // Too short to verify
    }

    const matchesDev = this.matchesCorpus(normalized, devTexts);
    const matchesAI = this.matchesCorpus(normalized, aiTexts);

    if (matchesAI && !matchesDev) {
      this.log(`Quote matches AI response, not developer — removing: "${quote.slice(0, 80)}..."`);
      stats.removed++;
      return false;
    }

    if (matchesDev) {
      stats.verified++;
    }
    // No match either way → keep (paraphrased)
    return true;
  }

  /**
   * Log a message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[ContentWriter] ${message}`);
    }
  }
}
