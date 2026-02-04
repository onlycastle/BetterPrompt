/**
 * Content Writer Stage Implementation
 *
 * Phase 3 of the 4-phase orchestrator pipeline.
 * Uses Gemini 3 Flash for narrative-only content generation.
 * Temperature: 1.0 (Gemini's recommended default).
 *
 * Generates: personalitySummary, topFocusAreas
 * NOTE: promptPatterns generation moved to Phase 2 CommunicationPatternsWorker.
 * All structural assembly is handled by evaluation-assembler.ts
 *
 * Key Design Decision (v4):
 * - topUtterances are now selected from Phase 2 evidence, not arbitrary first 20
 * - This ensures LLM only sees utterances that workers already identified as significant
 * - Prevents pattern-quote mismatch (e.g., "아키텍처 청사진 설계" with "다했어" example)
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

// ─────────────────────────────────────────────────────────────────────────
// Evidence-Based Utterance Extraction
// ─────────────────────────────────────────────────────────────────────────

/**
 * Add utteranceId to the set if it exists
 */
function addUtteranceId(ids: Set<string>, item: { utteranceId?: string }): void {
  if (item.utteranceId) {
    ids.add(item.utteranceId);
  }
}

/**
 * Extract utteranceIds from an array of items with evidence property
 */
function extractFromEvidenceItems(ids: Set<string>, items: any[] | undefined): void {
  if (!items) return;
  for (const item of items) {
    for (const ev of item.evidence || []) {
      addUtteranceId(ids, ev);
    }
  }
}

/**
 * Extract utteranceIds from an array of items with examples property
 */
function extractFromExampleItems(ids: Set<string>, items: any[] | undefined): void {
  if (!items) return;
  for (const item of items) {
    for (const ex of item.examples || []) {
      if (typeof ex === 'object' && ex !== null) {
        addUtteranceId(ids, ex);
      }
    }
  }
}

/**
 * Extract unique utteranceIds that Phase 2 workers used as evidence.
 *
 * These are the utterances that have already been identified as significant
 * by the Phase 2 analysis pipeline. Using these for topUtterances ensures:
 * - LLM only sees contextually relevant utterances
 * - Prevents pattern-example mismatch (e.g., "architecture blueprint" with "done")
 * - Avoids short, generic utterances that don't demonstrate patterns
 *
 * @param agentOutputs - All Phase 2 worker outputs
 * @returns Set of utteranceIds that workers used as evidence
 */
function extractEvidenceUtteranceIds(agentOutputs: AgentOutputs): Set<string> {
  const ids = new Set<string>();
  const tq = agentOutputs.thinkingQuality;

  // ThinkingQuality extractions
  if (tq) {
    extractFromExampleItems(ids, tq.verificationAntiPatterns);
    extractFromExampleItems(ids, tq.planningHabits);

    // criticalThinkingMoments have direct utteranceId
    for (const ct of tq.criticalThinkingMoments || []) {
      addUtteranceId(ids, ct);
    }

    extractFromEvidenceItems(ids, tq.strengths);
    extractFromEvidenceItems(ids, tq.growthAreas);
  }

  // CommunicationPatterns extractions (v3.1 - separate worker)
  if (agentOutputs.communicationPatterns) {
    extractFromExampleItems(ids, agentOutputs.communicationPatterns.communicationPatterns);
    extractFromEvidenceItems(ids, agentOutputs.communicationPatterns.strengths);
    extractFromEvidenceItems(ids, agentOutputs.communicationPatterns.growthAreas);
  }

  // LearningBehavior extractions
  if (agentOutputs.learningBehavior) {
    extractFromEvidenceItems(ids, agentOutputs.learningBehavior.strengths);
    extractFromEvidenceItems(ids, agentOutputs.learningBehavior.growthAreas);
  }

  // Legacy workers (kept for cached data)
  if (agentOutputs.contextEfficiency) {
    extractFromEvidenceItems(ids, agentOutputs.contextEfficiency.strengths);
    extractFromEvidenceItems(ids, agentOutputs.contextEfficiency.growthAreas);
  }

  if (agentOutputs.knowledgeGap) {
    extractFromEvidenceItems(ids, agentOutputs.knowledgeGap.strengths);
    extractFromEvidenceItems(ids, agentOutputs.knowledgeGap.growthAreas);
  }

  return ids;
}

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

    // ── Evidence-Based Utterance Selection (v4) ─────────────────────────────
    // Instead of selecting arbitrary first 20 utterances, we now use
    // utterances that Phase 2 workers identified as evidence.
    //
    // This ensures:
    // - LLM only sees utterances that workers deemed significant
    // - Prevents pattern-example mismatch (e.g., "architecture blueprint" + "done")
    // - Avoids short/generic utterances that don't demonstrate patterns
    //
    // No Fallback Policy: If no evidence utterances found, throw error.
    // This indicates Phase 2 workers failed to produce any evidence, which
    // should be investigated rather than silently hidden with default data.
    const evidenceIds = extractEvidenceUtteranceIds(agentOutputs);
    const topUtterances = this.extractTopUtterances(phase1Output, evidenceIds);

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
   * Extract top utterances from Phase 1 based on evidence IDs.
   * Throws if no evidence found or no matches.
   */
  private extractTopUtterances(
    phase1Output: Phase1Output | undefined,
    evidenceIds: Set<string>
  ): { id: string; text: string; wordCount: number }[] | undefined {
    if (!phase1Output) return undefined;

    if (evidenceIds.size === 0) {
      throw new Error(
        'Phase 2 evidence extraction produced no utteranceIds. ' +
        'This indicates a failure in insight generation that must be investigated. ' +
        'Check that Phase 2 workers are correctly outputting evidence with utteranceId fields.'
      );
    }

    const topUtterances = phase1Output.developerUtterances
      .filter(u => evidenceIds.has(u.id))
      .map(u => ({
        id: u.id,
        text: (u.displayText || u.text).slice(0, 1500),
        wordCount: u.wordCount
      }));

    this.log(`Using ${topUtterances.length} evidence-based utterances (from ${evidenceIds.size} Phase 2 evidence IDs)`);

    if (topUtterances.length === 0) {
      throw new Error(
        `Phase 2 produced ${evidenceIds.size} evidence IDs but none matched Phase 1 utterances. ` +
        'This indicates a mismatch between Phase 1 and Phase 2 data.'
      );
    }

    return topUtterances;
  }

  /**
   * Verify that Phase 2 worker examples contain only developer utterances.
   *
   * Must run BEFORE evaluation assembly since premium sections read from agentOutputs.
   * Mutates agentOutputs in place to filter out invalid quotes and replace with originals.
   */
  public verifyPhase2WorkerExamples(
    agentOutputs: AgentOutputs,
    phase1Output: Phase1Output
  ): void {
    const utteranceLookup = new Map<string, DeveloperUtterance>();
    for (const u of phase1Output.developerUtterances) {
      utteranceLookup.set(u.id, u);
    }

    const stats = { verified: 0, replaced: 0, removed: 0, noUtteranceId: 0 };

    const filterExamplesArray = (items: any[] | undefined, label: string): void => {
      if (!items) return;
      for (const item of items) {
        if (!Array.isArray(item.examples)) continue;
        item.examples = item.examples.filter((ex: any) =>
          this.verifyExampleItem(ex, utteranceLookup, stats, label)
        );
      }
    };

    const filterEvidenceArray = (items: any[] | undefined, label: string): void => {
      if (!items) return;
      for (const item of items) {
        if (!Array.isArray(item.evidence)) continue;
        item.evidence = item.evidence.filter((ev: any) =>
          this.verifyExampleItem(ev, utteranceLookup, stats, label)
        );
      }
    };

    const tq = agentOutputs.thinkingQuality;
    if (tq) {
      filterExamplesArray(tq.verificationAntiPatterns, 'Anti-pattern');
      filterExamplesArray(tq.planningHabits, 'Planning habit');
      filterEvidenceArray(tq.strengths, 'ThinkingQuality');
      filterEvidenceArray(tq.growthAreas, 'ThinkingQuality');

      // criticalThinkingMoments require special handling (top-level array)
      if (tq.criticalThinkingMoments) {
        tq.criticalThinkingMoments = tq.criticalThinkingMoments.filter((moment: any) => {
          if (!moment.quote || typeof moment.quote !== 'string') return true;
          return this.verifyExampleItem(moment, utteranceLookup, stats, 'Critical thinking');
        });
      }
    }

    if (agentOutputs.learningBehavior) {
      filterEvidenceArray(agentOutputs.learningBehavior.strengths, 'LearningBehavior');
      filterEvidenceArray(agentOutputs.learningBehavior.growthAreas, 'LearningBehavior');
    }

    // Legacy workers
    if (agentOutputs.contextEfficiency) {
      filterEvidenceArray(agentOutputs.contextEfficiency.strengths, 'ContextEfficiency');
      filterEvidenceArray(agentOutputs.contextEfficiency.growthAreas, 'ContextEfficiency');
    }

    if (agentOutputs.knowledgeGap) {
      filterEvidenceArray(agentOutputs.knowledgeGap.strengths, 'KnowledgeGap');
      filterEvidenceArray(agentOutputs.knowledgeGap.growthAreas, 'KnowledgeGap');
    }

    const total = stats.verified + stats.replaced + stats.removed + stats.noUtteranceId;
    if (total > 0) {
      this.log(`Phase 2 verification: verified=${stats.verified}, replaced=${stats.replaced}, removed=${stats.removed}, noUtteranceId=${stats.noUtteranceId}`);
    }
  }

  /**
   * Verify a single example/evidence item. Returns true to keep, false to remove.
   */
  private verifyExampleItem(
    item: any,
    utteranceLookup: Map<string, DeveloperUtterance>,
    stats: { verified: number; replaced: number; removed: number; noUtteranceId: number },
    label: string
  ): boolean {
    if (typeof item === 'string') {
      this.log(`${label} is plain string (no utteranceId) - removing: "${item.slice(0, 50)}..."`);
      stats.noUtteranceId++;
      return false;
    }
    if (!item.utteranceId) {
      this.log(`${label} missing utteranceId - removing: "${String(item.quote || item).slice(0, 50)}..."`);
      stats.noUtteranceId++;
      return false;
    }
    return this.verifyQuoteByUtteranceId(item, utteranceLookup, stats);
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
  // Utterance ID-Based Verification Layer
  // ─────────────────────────────────────────────────────────────────────────

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
   * Always replaces the quote with the original displayText (or text) to guarantee accuracy.
   * This ensures LLM paraphrasing doesn't corrupt the original developer words.
   * Returns true to keep, false to remove. Mutates the entry's quote.
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

    // Always use displayText (sanitized) if available, otherwise fall back to raw text
    // This guarantees the quote is the original developer's words, not LLM paraphrase
    const originalQuote = (original.displayText || original.text).slice(0, 500);

    if (this.quotesMatch(entry.quote, originalQuote)) {
      // Quote already matches original — mark verified but still ensure we use original
      entry.quote = originalQuote;
      stats.verified++;
    } else {
      // Quote was paraphrased by LLM — replace with original
      entry.quote = originalQuote;
      stats.replaced++;
    }
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
