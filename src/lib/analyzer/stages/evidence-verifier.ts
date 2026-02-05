/**
 * Evidence Verifier Stage - Phase 2.8 Evidence Quality Verification
 *
 * Validates that Phase 2 worker-selected evidence quotes actually support
 * their associated insights using LLM-based relevance scoring.
 *
 * Pipeline position: After Phase 2.5 (TypeClassifier), before Phase 3 (ContentWriter)
 *
 * Key features:
 * - Batch verification: Single LLM call for all evidence pairs
 * - Configurable threshold: Default 50, adjustable per deployment
 * - Domain-level stats: Track verification quality per worker domain
 *
 * @module analyzer/stages/evidence-verifier
 */

import { GeminiClient, type GeminiClientConfig, type TokenUsage } from '../clients/gemini-client';
import {
  type EvidenceVerificationPair,
  type EvidenceVerificationResult,
  type EvidenceVerificationStats,
  type EvidenceVerifierConfig,
  EvidenceVerificationResponseSchema,
  DEFAULT_EVIDENCE_VERIFIER_CONFIG,
} from '../../models/evidence-verification-data';
import {
  EVIDENCE_VERIFIER_SYSTEM_PROMPT,
  buildEvidenceVerifierUserPrompt,
  shouldSplitBatch,
  MAX_PAIRS_PER_BATCH,
} from './evidence-verifier-prompts';
import type { AgentOutputs } from '../../models/agent-outputs';
import type { AggregatedWorkerInsights, WorkerInsightsContainer, WorkerStrength, WorkerGrowth, EvidenceItem, InsightEvidence } from '../../models/worker-insights';
import { aggregateWorkerInsights } from '../../models/agent-outputs';
import type { Phase1Output } from '../../models/phase1-output';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of evidence verification stage
 */
export interface EvidenceVerifierResult {
  /** Worker insights with filtered evidence */
  verifiedInsights: AggregatedWorkerInsights;

  /** Verification statistics */
  stats: EvidenceVerificationStats;

  /** Token usage for this stage */
  usage: TokenUsage;
}

// ============================================================================
// Evidence Verifier Stage
// ============================================================================

/**
 * Evidence Verifier Stage - LLM-based evidence quality verification
 *
 * Verifies that worker-selected evidence quotes genuinely support their
 * associated insights. Filters out low-relevance evidence to improve
 * report quality.
 *
 * @example
 * ```typescript
 * const verifier = new EvidenceVerifierStage({
 *   apiKey: process.env.GOOGLE_GEMINI_API_KEY,
 *   threshold: 50,
 *   verbose: true,
 * });
 *
 * const result = await verifier.verify(agentOutputs, phase1Output);
 * console.log(`Kept ${result.stats.kept}/${result.stats.total} evidence pairs`);
 * ```
 */
export class EvidenceVerifierStage {
  private client: GeminiClient;
  private config: Required<Omit<EvidenceVerifierConfig, 'apiKey'>>;

  constructor(config: EvidenceVerifierConfig = {}) {
    const clientConfig: GeminiClientConfig = {
      apiKey: config.apiKey,
      model: config.model || DEFAULT_EVIDENCE_VERIFIER_CONFIG.model,
      temperature: config.temperature ?? DEFAULT_EVIDENCE_VERIFIER_CONFIG.temperature,
      maxRetries: config.maxRetries ?? DEFAULT_EVIDENCE_VERIFIER_CONFIG.maxRetries,
    };

    this.client = new GeminiClient(clientConfig);
    this.config = {
      model: config.model || DEFAULT_EVIDENCE_VERIFIER_CONFIG.model,
      temperature: config.temperature ?? DEFAULT_EVIDENCE_VERIFIER_CONFIG.temperature,
      threshold: config.threshold ?? DEFAULT_EVIDENCE_VERIFIER_CONFIG.threshold,
      verbose: config.verbose ?? DEFAULT_EVIDENCE_VERIFIER_CONFIG.verbose,
      maxRetries: config.maxRetries ?? DEFAULT_EVIDENCE_VERIFIER_CONFIG.maxRetries,
    };
  }

  /**
   * Verify evidence quality for all Phase 2 worker outputs
   *
   * @param agentOutputs - All Phase 2 worker outputs
   * @param phase1Output - Phase 1 output for utterance lookup
   * @returns Verified insights with filtered evidence and statistics
   */
  async verify(
    agentOutputs: AgentOutputs,
    phase1Output: Phase1Output
  ): Promise<EvidenceVerifierResult> {
    // Step 1: Aggregate worker insights into unified structure
    const rawInsights = aggregateWorkerInsights(agentOutputs);

    // Step 2: Collect all (insight, evidence) pairs for batch verification
    const pairs = this.collectEvidencePairs(rawInsights, phase1Output);

    // If no pairs to verify, return early with empty stats
    if (pairs.length === 0) {
      this.log('No evidence pairs to verify');
      return {
        verifiedInsights: rawInsights,
        stats: this.createEmptyStats(),
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    this.log(`Collected ${pairs.length} evidence pairs for verification`);

    // Step 3: Verify evidence in batches (handles large datasets)
    const { results, usage } = await this.verifyBatch(pairs);

    // Step 4: Apply verification results to filter evidence
    const verifiedInsights = this.applyVerificationResults(rawInsights, results);

    // Step 5: Compute statistics
    const stats = this.computeStats(pairs, results);

    this.log(`Verification complete: kept=${stats.kept}/${stats.total}, avgScore=${stats.avgScore.toFixed(1)}`);

    return { verifiedInsights, stats, usage };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Evidence Collection
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Collect all (insight, evidence) pairs from worker insights
   */
  private collectEvidencePairs(
    insights: AggregatedWorkerInsights,
    phase1Output: Phase1Output
  ): EvidenceVerificationPair[] {
    const pairs: EvidenceVerificationPair[] = [];
    const utteranceLookup = this.buildUtteranceLookup(phase1Output);
    let pairIndex = 0;

    // Helper to add pairs from a worker domain
    const addFromDomain = (
      domain: keyof AggregatedWorkerInsights,
      container: WorkerInsightsContainer | undefined
    ) => {
      if (!container) return;

      // Process strengths
      for (const strength of container.strengths) {
        for (let i = 0; i < strength.evidence.length; i++) {
          const ev = strength.evidence[i];
          const quote = this.extractQuoteText(ev, utteranceLookup);
          if (quote) {
            pairs.push({
              pairId: `${domain}_s_${pairIndex++}`,
              insightType: 'strength',
              workerDomain: domain,
              insightTitle: strength.title,
              insightDescription: strength.description,
              evidenceQuote: quote,
              utteranceId: this.extractUtteranceId(ev),
              evidenceIndex: i,
            });
          }
        }
      }

      // Process growth areas
      for (const growth of container.growthAreas) {
        for (let i = 0; i < growth.evidence.length; i++) {
          const ev = growth.evidence[i];
          const quote = this.extractQuoteText(ev, utteranceLookup);
          if (quote) {
            pairs.push({
              pairId: `${domain}_g_${pairIndex++}`,
              insightType: 'growth',
              workerDomain: domain,
              insightTitle: growth.title,
              insightDescription: growth.description,
              evidenceQuote: quote,
              utteranceId: this.extractUtteranceId(ev),
              evidenceIndex: i,
            });
          }
        }
      }
    };

    // Process v3 worker domains
    addFromDomain('thinkingQuality', insights.thinkingQuality);
    addFromDomain('learningBehavior', insights.learningBehavior);
    addFromDomain('contextEfficiency', insights.contextEfficiency);

    // Legacy (kept for cached data)
    addFromDomain('knowledgeGap', insights.knowledgeGap);

    return pairs;
  }

  /**
   * Build utterance lookup map for resolving utteranceIds to text
   */
  private buildUtteranceLookup(phase1Output: Phase1Output): Map<string, string> {
    const lookup = new Map<string, string>();
    for (const u of phase1Output.developerUtterances) {
      lookup.set(u.id, u.text);
    }
    return lookup;
  }

  /**
   * Extract quote text from evidence item
   */
  private extractQuoteText(
    ev: EvidenceItem,
    utteranceLookup: Map<string, string>
  ): string | null {
    if (typeof ev === 'string') {
      return ev.length > 0 ? ev : null;
    }

    // InsightEvidence with utteranceId
    const structured = ev as InsightEvidence;
    if (structured.quote && structured.quote.length > 0) {
      return structured.quote;
    }

    // Try to resolve from utterance lookup
    if (structured.utteranceId) {
      const text = utteranceLookup.get(structured.utteranceId);
      return text?.slice(0, 500) ?? null;
    }

    return null;
  }

  /**
   * Extract utteranceId from evidence item if present
   */
  private extractUtteranceId(ev: EvidenceItem): string | undefined {
    if (typeof ev === 'string') return undefined;
    return (ev as InsightEvidence).utteranceId;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LLM Verification
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Verify evidence pairs using LLM (handles batching if needed)
   */
  private async verifyBatch(
    pairs: EvidenceVerificationPair[]
  ): Promise<{ results: EvidenceVerificationResult[]; usage: TokenUsage }> {
    if (!shouldSplitBatch(pairs)) {
      return this.verifySingleBatch(pairs);
    }
    return this.verifyInBatches(pairs);
  }

  /**
   * Verify a single batch of evidence pairs
   */
  private async verifySingleBatch(
    pairs: EvidenceVerificationPair[]
  ): Promise<{ results: EvidenceVerificationResult[]; usage: TokenUsage }> {
    const response = await this.client.generateStructured({
      systemPrompt: EVIDENCE_VERIFIER_SYSTEM_PROMPT,
      userPrompt: buildEvidenceVerifierUserPrompt(pairs),
      responseSchema: EvidenceVerificationResponseSchema,
      maxOutputTokens: 65536,
    });

    const results = this.convertToVerificationResults(response.data.results);
    return { results, usage: response.usage };
  }

  /**
   * Verify evidence pairs in multiple batches
   */
  private async verifyInBatches(
    pairs: EvidenceVerificationPair[]
  ): Promise<{ results: EvidenceVerificationResult[]; usage: TokenUsage }> {
    const allResults: EvidenceVerificationResult[] = [];
    const totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const batchCount = Math.ceil(pairs.length / MAX_PAIRS_PER_BATCH);

    for (let i = 0; i < pairs.length; i += MAX_PAIRS_PER_BATCH) {
      const batchIndex = Math.floor(i / MAX_PAIRS_PER_BATCH) + 1;
      this.log(`Processing batch ${batchIndex}/${batchCount}`);

      const batch = pairs.slice(i, i + MAX_PAIRS_PER_BATCH);
      const { results, usage } = await this.verifySingleBatch(batch);

      allResults.push(...results);
      totalUsage.promptTokens += usage.promptTokens;
      totalUsage.completionTokens += usage.completionTokens;
      totalUsage.totalTokens += usage.totalTokens;
    }

    return { results: allResults, usage: totalUsage };
  }

  /**
   * Convert LLM results to processed results with shouldKeep decision
   */
  private convertToVerificationResults(
    llmResults: Array<{ pairId: string; relevanceScore: number; reasoning: string }>
  ): EvidenceVerificationResult[] {
    return llmResults.map((r) => ({
      pairId: r.pairId,
      relevanceScore: r.relevanceScore,
      reasoning: r.reasoning,
      shouldKeep: r.relevanceScore >= this.config.threshold,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Result Application
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Apply verification results to filter evidence from insights
   */
  private applyVerificationResults(
    insights: AggregatedWorkerInsights,
    results: EvidenceVerificationResult[]
  ): AggregatedWorkerInsights {
    // Build lookup for quick access
    const resultLookup = new Map<string, EvidenceVerificationResult>();
    for (const r of results) {
      resultLookup.set(r.pairId, r);
    }

    // Deep clone to avoid mutation
    const verified = JSON.parse(JSON.stringify(insights)) as AggregatedWorkerInsights;

    // Helper to filter evidence in a container
    const filterContainer = (
      domain: keyof AggregatedWorkerInsights,
      container: WorkerInsightsContainer | undefined
    ) => {
      if (!container) return;

      // Filter strengths' evidence
      let strengthPairIndex = 0;
      for (const strength of container.strengths) {
        // Store original length BEFORE filtering to maintain correct pairId alignment
        const originalLength = strength.evidence.length;
        strength.evidence = strength.evidence.filter((_, i) => {
          const pairId = `${domain}_s_${strengthPairIndex + i}`;
          const result = resultLookup.get(pairId);
          if (!result) return true; // Keep if not verified (shouldn't happen)

          if (!result.shouldKeep) {
            this.log(`Filtered evidence for "${strength.title}": score=${result.relevanceScore}, reason="${result.reasoning.slice(0, 50)}..."`);
          }
          return result.shouldKeep;
        });
        strengthPairIndex += originalLength; // Use original length to maintain pairId alignment
      }

      // Filter growth areas' evidence
      let growthPairIndex = 0;
      for (const growth of container.growthAreas) {
        // Store original length BEFORE filtering to maintain correct pairId alignment
        const originalLength = growth.evidence.length;
        growth.evidence = growth.evidence.filter((_, i) => {
          const pairId = `${domain}_g_${growthPairIndex + i}`;
          const result = resultLookup.get(pairId);
          if (!result) return true;

          if (!result.shouldKeep) {
            this.log(`Filtered evidence for "${growth.title}": score=${result.relevanceScore}`);
          }
          return result.shouldKeep;
        });
        growthPairIndex += originalLength; // Use original length to maintain pairId alignment
      }
    };

    // Apply filtering to v3 worker domains
    filterContainer('thinkingQuality', verified.thinkingQuality);
    filterContainer('learningBehavior', verified.learningBehavior);
    filterContainer('contextEfficiency', verified.contextEfficiency);

    // Legacy (kept for cached data)
    filterContainer('knowledgeGap', verified.knowledgeGap);

    return verified;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Statistics
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute verification statistics
   */
  private computeStats(
    pairs: EvidenceVerificationPair[],
    results: EvidenceVerificationResult[]
  ): EvidenceVerificationStats {
    const total = pairs.length;
    const kept = results.filter((r) => r.shouldKeep).length;
    const filtered = total - kept;
    const avgScore = results.length > 0
      ? results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length
      : 0;

    // Per-domain stats
    const byDomain: Record<string, { total: number; kept: number; filtered: number }> = {};

    for (const pair of pairs) {
      if (!byDomain[pair.workerDomain]) {
        byDomain[pair.workerDomain] = { total: 0, kept: 0, filtered: 0 };
      }
      byDomain[pair.workerDomain].total++;

      const result = results.find((r) => r.pairId === pair.pairId);
      if (result?.shouldKeep) {
        byDomain[pair.workerDomain].kept++;
      } else {
        byDomain[pair.workerDomain].filtered++;
      }
    }

    return { total, kept, filtered, avgScore, byDomain };
  }

  /**
   * Create empty stats for early return
   */
  private createEmptyStats(): EvidenceVerificationStats {
    return {
      total: 0,
      kept: 0,
      filtered: 0,
      avgScore: 0,
      byDomain: {},
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Logging
  // ─────────────────────────────────────────────────────────────────────────

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[EvidenceVerifier] ${message}`);
    }
  }
}
