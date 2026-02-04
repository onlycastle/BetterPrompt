/**
 * Insight Deduplication Utility
 *
 * Prevents the same Professional Insight from appearing in multiple Growth Areas
 * across the entire report. Uses post-processing approach:
 * 1. Collect all candidate insights (LLM referenced + Phase 2.75 fallback)
 * 2. Deduplicate by insight ID - each insight allocated to highest matchScore location
 * 3. Return allocation map for frontend to use
 *
 * @module utils/insight-deduplication
 */

import type { ReferencedInsight } from '../models/worker-insights';
import type { MatchedProfessionalInsight } from '../models/verbose-evaluation';

/**
 * Source of the insight candidate.
 * - 'llm': Referenced by LLM via [pi-XXX] syntax (highest priority)
 * - 'fallback': From Phase 2.75 KnowledgeResourceMatcher
 */
export type InsightSource = 'llm' | 'fallback';

/**
 * Candidate insight for allocation.
 * Multiple candidates may exist for the same insight ID across different growth areas.
 */
export interface InsightCandidate {
  /** The insight data */
  insight: ReferencedInsight;
  /** Match score (LLM = 10.0, fallback = actual matchScore from Phase 2.75) */
  matchScore: number;
  /** Source of this candidate */
  source: InsightSource;
}

/**
 * Growth area with its insight candidates.
 * Used as input for deduplication.
 */
export interface GrowthWithCandidates {
  /** Unique key: "domainKey:growthTitle" */
  key: string;
  /** Domain key (e.g., 'thinkingQuality') */
  domainKey: string;
  /** Growth area title */
  growthTitle: string;
  /** All candidate insights for this growth area */
  candidates: InsightCandidate[];
}

/**
 * Result of deduplication - maps growth area key to allocated insight (or null).
 */
export type InsightAllocation = Map<string, ReferencedInsight | null>;

/**
 * LLM-referenced insights always get priority score of 10.0.
 * This ensures they're never displaced by Phase 2.75 fallbacks.
 */
export const LLM_REFERENCE_SCORE = 10.0;

/**
 * Minimum match score threshold for Phase 2.75 fallback insights.
 * Below this score, the insight is not considered relevant enough.
 *
 * Threshold reasoning:
 * - Base score (priority): 1-10
 * - Style boost: +2.0
 * - Control level boost: +1.5
 * - 5.0 = mid-priority + at least one boost applied
 */
export const FALLBACK_THRESHOLD = 5.0;

/**
 * Maximum number of fallback insights to show per growth area.
 * Keeps the UI clean while still providing value.
 */
export const MAX_FALLBACK_PER_GROWTH = 1;

/**
 * Maximum number of fallback insights across the entire report.
 * Limits total value provided to free users while maintaining quality.
 *
 * Note: LLM-referenced insights (source='llm') are NOT subject to this limit.
 * Only Phase 2.75 fallback insights count toward this cap.
 */
export const MAX_FALLBACK_TOTAL = 1;

/**
 * Deduplicate insights across the entire report.
 *
 * Algorithm:
 * 1. Build a map of insight ID -> all occurrences (location + score + source)
 * 2. For each insight, find the location with highest matchScore
 * 3. Allocate insight to that location only
 * 4. Apply total fallback limit (MAX_FALLBACK_TOTAL) - LLM references unlimited
 * 5. Return allocation map for each growth area key
 *
 * @param allGrowthWithCandidates - All growth areas with their insight candidates
 * @returns Map from growth area key to allocated insight (or null if none)
 *
 * @example
 * ```ts
 * const growthAreas = [
 *   { key: 'thinkingQuality:Error Loop', candidates: [...] },
 *   { key: 'learningBehavior:Knowledge Gap', candidates: [...] },
 * ];
 * const allocation = deduplicateInsights(growthAreas);
 * // allocation.get('thinkingQuality:Error Loop') => ReferencedInsight | null
 * ```
 */
export function deduplicateInsights(
  allGrowthWithCandidates: GrowthWithCandidates[]
): InsightAllocation {
  // Step 1: Collect all occurrences of each insight ID with source info
  const insightOccurrences = new Map<
    string,
    Array<{
      key: string;
      matchScore: number;
      insight: ReferencedInsight;
      source: InsightSource;
    }>
  >();

  for (const growth of allGrowthWithCandidates) {
    for (const candidate of growth.candidates) {
      const id = candidate.insight.id;
      if (!insightOccurrences.has(id)) {
        insightOccurrences.set(id, []);
      }
      insightOccurrences.get(id)!.push({
        key: growth.key,
        matchScore: candidate.matchScore,
        insight: candidate.insight,
        source: candidate.source,
      });
    }
  }

  // Step 2: For each insight, determine the winning location
  // Map: growth area key -> { insightId, source }
  const allocatedInsights = new Map<string, { insightId: string; source: InsightSource }>();

  for (const [insightId, occurrences] of insightOccurrences) {
    // Sort by matchScore descending (highest first)
    // Stable sort preserves order for equal scores (first occurrence wins)
    occurrences.sort((a, b) => b.matchScore - a.matchScore);
    const winner = occurrences[0];

    // Check if this growth area already has an allocated insight
    const existing = allocatedInsights.get(winner.key);
    if (!existing) {
      // No insight allocated yet - allocate this one
      allocatedInsights.set(winner.key, { insightId, source: winner.source });
    } else {
      // Already has an insight - check if current one has higher score
      // Find the score of the existing allocation
      const existingOccurrence = insightOccurrences.get(existing.insightId)
        ?.find(o => o.key === winner.key);
      if (existingOccurrence && winner.matchScore > existingOccurrence.matchScore) {
        // Current insight has higher score - replace
        allocatedInsights.set(winner.key, { insightId, source: winner.source });
      }
    }
  }

  // Step 3: Apply total fallback limit
  // LLM-referenced insights are unlimited; fallbacks limited to MAX_FALLBACK_TOTAL
  // Sort by matchScore descending so highest-scoring fallbacks are kept
  const sortedAllocations = [...allocatedInsights.entries()].sort((a, b) => {
    const aOccurrence = insightOccurrences.get(a[1].insightId)?.find(o => o.key === a[0]);
    const bOccurrence = insightOccurrences.get(b[1].insightId)?.find(o => o.key === b[0]);
    return (bOccurrence?.matchScore ?? 0) - (aOccurrence?.matchScore ?? 0);
  });

  let fallbackCount = 0;
  const limitedAllocations = new Map<string, { insightId: string; source: InsightSource }>();

  for (const [key, allocation] of sortedAllocations) {
    if (allocation.source === 'llm') {
      // LLM references are unlimited
      limitedAllocations.set(key, allocation);
    } else {
      // Fallback: apply total limit
      if (fallbackCount < MAX_FALLBACK_TOTAL) {
        limitedAllocations.set(key, allocation);
        fallbackCount++;
      }
      // Else: skip this fallback (exceeds total limit)
    }
  }

  // Step 4: Build final allocation map
  const result: InsightAllocation = new Map();

  // Initialize all growth areas with null
  for (const growth of allGrowthWithCandidates) {
    result.set(growth.key, null);
  }

  // Set allocated insights
  for (const [key, { insightId }] of limitedAllocations) {
    const occurrences = insightOccurrences.get(insightId);
    const occurrence = occurrences?.find(o => o.key === key);
    if (occurrence) {
      result.set(key, occurrence.insight);
    }
  }

  return result;
}

/**
 * Create a growth area key for consistent lookup.
 *
 * @param domainKey - Worker domain key (e.g., 'thinkingQuality')
 * @param growthTitle - Title of the growth area
 * @returns Composite key for the allocation map
 */
export function createGrowthKey(domainKey: string, growthTitle: string): string {
  return `${domainKey}:${growthTitle}`;
}

/**
 * Filter fallback insights by threshold and limit.
 *
 * @param insights - Matched professional insights from Phase 2.75
 * @param threshold - Minimum matchScore to include (default: FALLBACK_THRESHOLD)
 * @param limit - Maximum number to return (default: MAX_FALLBACK_PER_GROWTH)
 * @returns Filtered and limited insights, sorted by matchScore descending
 */
export function filterFallbackInsights(
  insights: MatchedProfessionalInsight[] | undefined,
  threshold: number = FALLBACK_THRESHOLD,
  limit: number = MAX_FALLBACK_PER_GROWTH
): MatchedProfessionalInsight[] {
  if (!insights || insights.length === 0) {
    return [];
  }

  return insights
    .filter(i => i.matchScore >= threshold)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}
