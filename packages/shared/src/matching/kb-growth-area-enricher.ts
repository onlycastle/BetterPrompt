/**
 * KB Growth Area Enricher
 *
 * Wires the deterministic KB matcher into the growth area output pipeline.
 * Processes domain results and attaches one best-match KB tip per growth area
 * using keyword + dimension overlap scoring. No LLM needed.
 *
 * Pipeline position: runs during report assembly (after LLM analysis, before
 * HTML generation). Mutates nothing — returns new domain results with tips attached.
 *
 * Relevance threshold: Tips below KB_TIP_RELEVANCE_THRESHOLD are not attached.
 * Source credibility signal is included in the scoring via credibilityTier boost.
 *
 * @module @betterprompt/shared/matching/kb-growth-area-enricher
 */

import type { DomainResult } from '../schemas/domain-result.js';
import type { KbTipAttachment } from '../schemas/growth-area-pea.js';
import { KB_TIP_RELEVANCE_THRESHOLD } from '../schemas/growth-area-pea.js';
import {
  matchKnowledgeResources,
  extractMatchingContextFromDomainResults,
  inferCredibilityTier,
} from './knowledge-resource-matcher.js';
import type {
  PortableKnowledgeItem,
  PortableProfessionalInsight,
  MatchedKnowledgeItem,
  MatchedProfessionalInsight,
} from './knowledge-resource-matcher.js';

// ============================================================================
// Credibility Tier Scoring Boost
// ============================================================================

/**
 * Scoring multiplier based on source credibility tier.
 *
 * Higher-credibility sources get a boost to their match score,
 * surfacing authoritative content over generic community posts
 * when keyword relevance is similar.
 *
 * Evaluation criterion: source_credibility
 * "KB tip source has demonstrated authority or practitioner credibility"
 */
const CREDIBILITY_MULTIPLIER: Record<string, number> = {
  high: 1.25,     // Official docs, recognized authority, peer-reviewed
  medium: 1.1,    // Known practitioner, established blog
  standard: 1.0,  // Community content, forum posts — no boost
};

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Enrich domain results by attaching one best-match KB tip per growth area.
 *
 * This is the main integration point that wires the KB matcher into
 * the report generation pipeline. Call this during report assembly
 * (e.g., in assembleCanonicalAnalysisRun) before HTML generation.
 *
 * Algorithm per growth area:
 * 1. Use existing KB matcher to find dimension-matched knowledge items
 * 2. For each item, compute relevance score with credibility boost
 * 3. Pick the highest-scoring item above the threshold
 * 4. Attach it as a KbTipAttachment on the growth area
 *
 * Returns new domain results — does NOT mutate the input.
 *
 * @param domainResults - Domain results from analysis (with growth areas)
 * @param knowledgeItems - Pre-loaded knowledge items from KB
 * @param professionalInsights - Pre-loaded professional insights
 * @param primaryType - Developer's primary type classification (optional)
 * @param controlLevel - Developer's control level (optional)
 * @returns Domain results with kbTip attached to each qualifying growth area
 */
export function enrichGrowthAreasWithKbTips(
  domainResults: DomainResult[],
  knowledgeItems: PortableKnowledgeItem[],
  professionalInsights: PortableProfessionalInsight[],
  primaryType?: string,
  controlLevel?: string,
): DomainResult[] {
  // Early return if no KB data to match against
  if (knowledgeItems.length === 0 && professionalInsights.length === 0) {
    return domainResults;
  }

  // Step 1: Build the matching context from all domain results
  const matchingContext = extractMatchingContextFromDomainResults(
    domainResults.map(r => ({
      domain: r.domain,
      growthAreas: r.growthAreas.map(ga => ({
        title: ga.title,
        description: ga.description,
        recommendation: ga.recommendation,
      })),
      data: r.data as Record<string, unknown> | undefined,
    })),
    primaryType,
    controlLevel,
  );

  // Step 2: Run the dimension-level KB match to get scored items per dimension
  const dimensionMatches = matchKnowledgeResources(
    matchingContext,
    knowledgeItems,
    professionalInsights,
  );

  // Build lookup: dimension → scored items/insights
  const dimensionItemsMap = new Map<string, MatchedKnowledgeItem[]>();
  const dimensionInsightsMap = new Map<string, MatchedProfessionalInsight[]>();
  for (const match of dimensionMatches) {
    dimensionItemsMap.set(match.dimension, match.knowledgeItems);
    dimensionInsightsMap.set(match.dimension, match.professionalInsights);
  }

  // Step 3: For each growth area, find the single best-match tip
  return domainResults.map(result => ({
    ...result,
    growthAreas: result.growthAreas.map(ga => {
      const tip = findBestTipForGrowthArea(
        ga,
        result.domain,
        knowledgeItems,
        dimensionItemsMap,
        dimensionInsightsMap,
      );
      if (tip) {
        // Populate both fields:
        // - kbTip: legacy internal field (backward compat for existing consumers)
        // - knowledgeTip: canonical display field used by report renderers and UI components
        // Both carry identical data — dual-write avoids a data migration.
        return { ...ga, kbTip: tip, knowledgeTip: tip };
      }
      return ga;
    }),
  }));
}

// ============================================================================
// Per-Growth-Area Tip Selection
// ============================================================================

/**
 * Domain → KB dimension mapping (mirrors the matcher's internal mapping).
 * Used to look up pre-scored items for each growth area's domain.
 */
const DOMAIN_TO_KB_DIMENSION: Record<string, string> = {
  thinkingQuality: 'TrustVerification',
  communicationPatterns: 'CommunicationPatterns',
  learningBehavior: 'KnowledgeGap',
  contextEfficiency: 'ContextEfficiency',
  sessionOutcome: 'WorkflowHabit',
  // v2 domains map to their closest KB dimensions
  aiPartnership: 'TrustVerification',
  sessionCraft: 'ContextEfficiency',
  toolMastery: 'WorkflowHabit',
  skillResilience: 'KnowledgeGap',
  sessionMastery: 'WorkflowHabit',
};

/**
 * Find the single best-match KB tip for a specific growth area.
 *
 * Scoring approach:
 * 1. Start with the pre-computed matchScore from the KB matcher
 * 2. Apply credibility boost based on source's credibilityTier
 * 3. Apply per-growth-area keyword affinity boost (title + description overlap)
 * 4. Normalize to 0-1 range and compare against threshold
 *
 * Returns null if no item exceeds the relevance threshold.
 */
function findBestTipForGrowthArea(
  growthArea: DomainResult['growthAreas'][number],
  domain: string,
  allKnowledgeItems: PortableKnowledgeItem[],
  dimensionItemsMap: Map<string, MatchedKnowledgeItem[]>,
  dimensionInsightsMap: Map<string, MatchedProfessionalInsight[]>,
): KbTipAttachment | null {
  const dimension = DOMAIN_TO_KB_DIMENSION[domain];
  if (!dimension) return null;

  const growthText = `${growthArea.title} ${growthArea.description} ${growthArea.recommendation}`.toLowerCase();

  // Collect candidate tips from both knowledge items and professional insights
  const candidates: Array<{
    tipId: string;
    title: string;
    summary: string;
    sourceUrl: string;
    sourceAuthor: string;
    sourcePlatform?: string;
    credibilityTier?: 'high' | 'medium' | 'standard';
    baseScore: number;
  }> = [];

  // Add knowledge items from this dimension.
  // Credibility tier is now resolved at the matcher level and carried
  // through MatchedKnowledgeItem, so no need for runtime patching.
  const dimensionItems = dimensionItemsMap.get(dimension) ?? [];
  for (const item of dimensionItems) {
    // Look up the original item for sourcePlatform (carried in portable format)
    const originalItem = allKnowledgeItems.find(ki => ki.id === item.id);
    candidates.push({
      tipId: item.id,
      title: item.title,
      summary: item.summary,
      sourceUrl: item.sourceUrl,
      sourceAuthor: item.sourceAuthor,
      sourcePlatform: item.sourcePlatform ?? originalItem?.sourcePlatform,
      credibilityTier: item.credibilityTier ?? inferCredibilityTier(
        originalItem?.credibilityTier,
        originalItem?.sourcePlatform,
      ),
      baseScore: item.matchScore,
    });
  }

  // Add professional insights from this dimension.
  // Professional insights carry credibilityTier from the matcher (baseline 'medium').
  const dimensionInsights = dimensionInsightsMap.get(dimension) ?? [];
  for (const insight of dimensionInsights) {
    candidates.push({
      tipId: insight.id,
      title: insight.title,
      summary: insight.keyTakeaway,
      sourceUrl: insight.sourceUrl,
      sourceAuthor: insight.sourceAuthor,
      sourcePlatform: undefined,
      credibilityTier: insight.credibilityTier,
      baseScore: insight.matchScore,
    });
  }

  if (candidates.length === 0) return null;

  // Score each candidate with credibility boost and growth-area affinity
  let bestCandidate: typeof candidates[number] | null = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    // Base score from KB matcher (0-10 scale)
    let score = candidate.baseScore;

    // Credibility boost: multiply by tier factor
    const credMultiplier = CREDIBILITY_MULTIPLIER[candidate.credibilityTier ?? 'standard'] ?? 1.0;
    score *= credMultiplier;

    // Per-growth-area keyword affinity: check if tip title/summary keywords
    // appear in this specific growth area's text
    const tipKeywords = extractKeywords(candidate.title + ' ' + candidate.summary);
    const affinityBoost = computeKeywordAffinity(tipKeywords, growthText);
    score += affinityBoost;

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  if (!bestCandidate) return null;

  // Normalize score to 0-1 range (KB matcher scores are 0-10)
  const normalizedScore = Math.min(bestScore / 10, 1);

  // Apply relevance threshold
  if (normalizedScore < KB_TIP_RELEVANCE_THRESHOLD) return null;

  return {
    tipId: bestCandidate.tipId,
    title: bestCandidate.title,
    summary: bestCandidate.summary,
    sourceUrl: bestCandidate.sourceUrl,
    sourceAuthor: bestCandidate.sourceAuthor,
    sourcePlatform: bestCandidate.sourcePlatform,
    credibilityTier: bestCandidate.credibilityTier,
    relevanceScore: Math.round(normalizedScore * 100) / 100,
  };
}

// ============================================================================
// Keyword Helpers
// ============================================================================

/** Extract meaningful keywords from text (lowercase, deduplicated, min 3 chars). */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'you',
    'are', 'was', 'were', 'been', 'will', 'can', 'has', 'have', 'had',
    'not', 'but', 'use', 'using', 'how', 'when', 'what', 'which',
    'more', 'also', 'than', 'into', 'each', 'all', 'their', 'some',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w));

  return [...new Set(words)];
}

/**
 * Compute how many tip keywords appear in the growth area text.
 * Returns a boost score (0-2 range) based on keyword overlap density.
 */
function computeKeywordAffinity(tipKeywords: string[], growthText: string): number {
  if (tipKeywords.length === 0) return 0;

  const matchCount = tipKeywords.filter(kw => growthText.includes(kw)).length;
  const overlapRatio = matchCount / tipKeywords.length;

  // Scale to 0-2 range: high overlap gets meaningful boost
  return Math.min(overlapRatio * 2, 2);
}
