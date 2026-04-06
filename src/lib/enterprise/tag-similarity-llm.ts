/**
 * LLM-Based Semantic Tag Cluster Merging
 *
 * Extends the deterministic tag clustering in tag-similarity.ts with an
 * optional LLM pass that catches conceptually-related tags that share no
 * lexical overlap and would therefore be missed by synonym-map + stemming.
 *
 * Examples the deterministic pass cannot handle:
 *   "reactive debugging loop"    ↔  "break-fix mentality"
 *   "over-prompt construction"   ↔  "verbose request patterns"
 *   "context window hoarding"    ↔  "session scope creep"
 *   "iterative clarification"    ↔  "back-and-forth questioning"
 *
 * Architecture note:
 *   - All individual-level LLM analysis runs in the Claude Code plugin.
 *   - Team-level LLM calls run server-side after all member analyses are aggregated.
 *   - This module follows the same pattern as team-recommendations-prompt.ts:
 *     a standalone server-side module with Anthropic SDK, injected config, and
 *     structured output via tool_use.
 *
 * Usage:
 *   1. Call clusterTags() from tag-similarity.ts (deterministic pass)
 *   2. Call mergeTagClustersByLLM() on the result (semantic pass)
 *   3. Apply the merged mapping to pattern categoryTags
 *
 * @module enterprise/tag-similarity-llm
 */

import Anthropic from '@anthropic-ai/sdk';
import { clusterTags, deduplicateTagsBeforeClustering } from '@/lib/enterprise/tag-similarity';
import type { TeamGrowthAreaPEAAggregate } from '@/types/enterprise';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single tag cluster produced by the deterministic clusterTags() pass. */
export interface TagCluster {
  canonical: string;
  displayLabel: string;
  count: number;
}

/**
 * LLM-merge result: original cluster indices grouped into equivalence sets.
 * Clusters NOT mentioned remain as-is (singleton groups).
 */
interface MergeGroupOutput {
  /** Each sub-array is a list of cluster indices (0-based) to merge together. */
  mergeGroups: number[][];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface TagSimilarityLLMConfig {
  /** Anthropic API key. Defaults to ANTHROPIC_API_KEY env var. */
  apiKey?: string;
  /**
   * Model to use. Defaults to claude-haiku-4-20250514.
   * Haiku is sufficient for this structured classification task.
   */
  model?: string;
  /** Max output tokens. Defaults to 1024. */
  maxTokens?: number;
  /**
   * Minimum cluster count to trigger LLM enrichment.
   * With fewer clusters, the LLM call is not worth the latency.
   * Defaults to 3.
   */
  minClustersForLLM?: number;
}

const DEFAULT_CONFIG: Required<TagSimilarityLLMConfig> = {
  apiKey: '',
  model: 'claude-haiku-4-20250514',
  maxTokens: 1024,
  minClustersForLLM: 3,
};

// ---------------------------------------------------------------------------
// Prompt constants
// ---------------------------------------------------------------------------

export const TAG_MERGE_SYSTEM_PROMPT = `You are an expert in developer behavior analysis.

You will receive a list of tag clusters extracted from software developers' AI session logs.
Each cluster represents a behavioral pattern observed across one or more developers.

The clusters have already been normalized using text similarity (synonym mapping, stemming, filler removal).
Your task is to identify clusters that the text matching MISSED — clusters that describe the SAME underlying developer behavior despite using completely different vocabulary.

## Rules for merging

Only merge clusters when you are highly confident they represent the same underlying developer behavior:
- They describe the same underlying developer behavior (not just related topics)
- A manager reading both would say "these are the same problem"
- They belong to the same behavioral category (e.g., both about debugging style, both about context management)

DO NOT merge clusters when:
- They are merely related or thematically similar
- One is a subset or special case of the other
- They describe different manifestations of a broad theme
- You are uncertain

## Examples of correct merges
- "reactive debugging loop" + "break-fix mentality" → same behavior (fix without understanding)
- "context window hoarding" + "session scope creep" → same behavior (accumulating too much context)
- "verbose error pasting" + "raw stack trace dumps" → same behavior (pasting full errors without summarizing)

## Examples of incorrect merges
- "debugging" + "testing" → related but different behaviors
- "api design" + "error handling" → different aspects of development
- "communication" + "documentation" → different behavioral patterns

Respond only using the identify_semantic_merge_groups tool.`;

// ---------------------------------------------------------------------------
// Tool definition (Anthropic structured output)
// ---------------------------------------------------------------------------

const TAG_MERGE_TOOL: Anthropic.Tool = {
  name: 'identify_semantic_merge_groups',
  description: 'Identify which tag clusters describe the same underlying developer behavior and should be merged',
  input_schema: {
    type: 'object' as const,
    properties: {
      mergeGroups: {
        type: 'array',
        description: 'Each sub-array contains the 0-based indices of clusters that should be merged. Only include groups with 2+ indices. Do not list singleton clusters.',
        items: {
          type: 'array',
          description: 'Indices of clusters that represent the same behavioral concept',
          items: { type: 'number' },
          minItems: 2,
        },
      },
    },
    required: ['mergeGroups'],
  },
};

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Build the user-facing prompt listing all clusters for LLM comparison.
 *
 * Each cluster is shown with its display label and occurrence count,
 * so the LLM can consider frequency when identifying the most representative label.
 */
export function buildTagMergeUserPrompt(clusters: TagCluster[]): string {
  const clusterLines = clusters.map((c, idx) =>
    `${idx}. "${c.displayLabel}" (${c.count} occurrence${c.count !== 1 ? 's' : ''})`,
  ).join('\n');

  return `Analyze these tag clusters from developer behavior analysis and identify which ones describe the same underlying behavioral pattern:

${clusterLines}

Identify merge groups — sets of indices (0-based) where the clusters describe the same developer behavior. Only merge when confident. Return an empty array if no merges are warranted.`;
}

// ---------------------------------------------------------------------------
// Core LLM merge function
// ---------------------------------------------------------------------------

/**
 * Use an LLM to identify semantically equivalent clusters and merge them.
 *
 * The deterministic pass in clusterTags() handles lexical variants of the
 * same concept (synonym mapping, stemming, filler removal). This function
 * handles the remaining gap: clusters that use entirely different vocabulary
 * to describe the same behavioral pattern.
 *
 * A single LLM call covers all clusters — O(1) API calls regardless of cluster count.
 *
 * @param clusters - Output of clusterTags() — already deterministically merged
 * @param config - Optional Anthropic API configuration
 * @returns Merged clusters, sorted by count descending
 *
 * @throws {Error} If ANTHROPIC_API_KEY is missing or the API call fails
 * @throws {Error} If the LLM response does not include a valid tool_use block
 */
export async function mergeTagClustersByLLM(
  clusters: TagCluster[],
  config: TagSimilarityLLMConfig = {},
): Promise<TagCluster[]> {
  const resolvedConfig: Required<TagSimilarityLLMConfig> = {
    apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY ?? DEFAULT_CONFIG.apiKey,
    model: config.model ?? DEFAULT_CONFIG.model,
    maxTokens: config.maxTokens ?? DEFAULT_CONFIG.maxTokens,
    minClustersForLLM: config.minClustersForLLM ?? DEFAULT_CONFIG.minClustersForLLM,
  };

  // Skip if not enough clusters to warrant an LLM call
  if (clusters.length < resolvedConfig.minClustersForLLM) {
    return clusters;
  }

  if (!resolvedConfig.apiKey) {
    throw new Error(
      'mergeTagClustersByLLM: ANTHROPIC_API_KEY is required. ' +
      'Set the environment variable or pass config.apiKey.',
    );
  }

  const client = new Anthropic({ apiKey: resolvedConfig.apiKey });
  const userPrompt = buildTagMergeUserPrompt(clusters);

  const response = await client.messages.create({
    model: resolvedConfig.model,
    max_tokens: resolvedConfig.maxTokens,
    system: TAG_MERGE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    tools: [TAG_MERGE_TOOL],
    tool_choice: { type: 'tool', name: 'identify_semantic_merge_groups' },
  });

  // Extract the structured tool_use block
  const toolUseBlock = response.content.find(b => b.type === 'tool_use');
  if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
    throw new Error(
      'mergeTagClustersByLLM: LLM response did not contain a tool_use block. ' +
      `Stop reason: ${response.stop_reason}`,
    );
  }

  const output = toolUseBlock.input as MergeGroupOutput;

  if (!Array.isArray(output?.mergeGroups)) {
    throw new Error(
      'mergeTagClustersByLLM: tool output missing required mergeGroups array. ' +
      `Received: ${JSON.stringify(output)}`,
    );
  }

  return applyMergeGroups(clusters, output.mergeGroups);
}

// ---------------------------------------------------------------------------
// Merge application
// ---------------------------------------------------------------------------

/**
 * Apply LLM-identified merge groups to a cluster array.
 *
 * For each merge group:
 * - Combine all cluster counts
 * - Use the display label from the highest-count cluster in the group
 * - Use the canonical from the highest-count cluster
 *
 * Clusters not mentioned in any merge group are passed through unchanged.
 *
 * Invalid indices (out of range) are silently skipped — LLM output is not trusted
 * to always produce valid indices.
 *
 * @param clusters - Original cluster array (0-indexed)
 * @param mergeGroups - Groups of indices to merge (from LLM output)
 * @returns Merged clusters sorted by count descending
 */
export function applyMergeGroups(
  clusters: TagCluster[],
  mergeGroups: number[][],
): TagCluster[] {
  // Track which cluster indices have been consumed by a merge
  const consumed = new Set<number>();

  const mergedClusters: TagCluster[] = [];

  for (const group of mergeGroups) {
    // Filter to valid, unconsumed indices
    const validIndices = group.filter(
      idx => Number.isInteger(idx) && idx >= 0 && idx < clusters.length && !consumed.has(idx),
    );

    if (validIndices.length < 2) {
      // Skip invalid or already-consumed groups
      continue;
    }

    // Mark as consumed
    for (const idx of validIndices) consumed.add(idx);

    // Compute merged cluster: pick representative from highest-count member
    const groupClusters = validIndices.map(idx => clusters[idx]);
    const totalCount = groupClusters.reduce((sum, c) => sum + c.count, 0);

    // The cluster with the highest count becomes the representative
    const representative = groupClusters.reduce(
      (best, c) => c.count > best.count ? c : best,
      groupClusters[0],
    );

    mergedClusters.push({
      canonical: representative.canonical,
      displayLabel: representative.displayLabel,
      count: totalCount,
    });
  }

  // Add all clusters NOT consumed by any merge group
  for (let idx = 0; idx < clusters.length; idx++) {
    if (!consumed.has(idx)) {
      mergedClusters.push(clusters[idx]);
    }
  }

  // Sort by count descending (same ordering contract as clusterTags())
  return mergedClusters.sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Full pipeline: deterministic + LLM enrichment
// ---------------------------------------------------------------------------

/**
 * Full semantic tag clustering pipeline: deterministic pass + LLM enrichment.
 *
 * This is the async, LLM-enriched version of clusterTags() from tag-similarity.ts.
 *
 * Pipeline:
 *   1. deduplicateTagsBeforeClustering() — surface-level dedup (cheap, exact)
 *   2. clusterTags() — deterministic semantic clustering (synonym map + stemming)
 *   3. mergeTagClustersByLLM() — LLM-based conceptual merging (catches lexical gaps)
 *
 * Use this instead of clusterTags() when:
 *   - You have ANTHROPIC_API_KEY available
 *   - The tag set is large enough to warrant LLM cost (≥3 clusters after deterministic pass)
 *   - Latency is acceptable (one Haiku API call, ~1-2 seconds)
 *
 * Falls back to deterministic-only if API key is absent (no error thrown).
 *
 * @param rawTags - Raw freeform tags from LLM output across multiple developers
 * @param config - Optional Anthropic API configuration
 * @returns Semantically merged clusters, sorted by count descending
 */
export async function clusterTagsWithLLMEnrichment(
  rawTags: string[],
  config: TagSimilarityLLMConfig = {},
): Promise<TagCluster[]> {
  if (rawTags.length === 0) return [];

  // Step 1: Surface-level dedup (exact/near-exact surface forms)
  const preDeduped = deduplicateTagsBeforeClustering(rawTags);

  // Step 2: Deterministic semantic clustering
  const deterministicClusters = clusterTags(preDeduped);

  if (deterministicClusters.length === 0) return [];

  // Step 3: LLM enrichment (optional — skip if no API key)
  const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) {
    // No API key — return deterministic clusters without error
    return deterministicClusters;
  }

  return mergeTagClustersByLLM(deterministicClusters, { ...config, apiKey });
}

// ---------------------------------------------------------------------------
// Pattern-level enrichment (entry point for analysis route)
// ---------------------------------------------------------------------------

/**
 * Enrich cross-developer pattern aggregates by applying LLM-based semantic
 * tag clustering to each pattern's categoryTags.
 *
 * This is the primary entry point for the analysis route. It:
 *   1. Collects ALL tags across ALL patterns into a global vocabulary
 *   2. Applies the full clustering pipeline (deterministic + LLM) to the global vocabulary
 *   3. Builds a canonical → merged-label mapping
 *   4. Re-maps each pattern's categoryTags using the merged mapping
 *
 * Using a global vocabulary (vs. per-pattern clustering) ensures that:
 *   - "reactive debugging" on Pattern A merges with "break-fix loop" on Pattern B
 *     even though they appear in different patterns
 *   - The LLM sees the full context of all tag concepts in one call
 *   - Total API calls = 1 regardless of pattern count
 *
 * @param patterns - Aggregated cross-developer patterns from aggregateGrowthAreasPEA()
 * @param config - Optional Anthropic API configuration
 * @returns Same patterns with enriched (LLM-merged) categoryTags
 *
 * @throws If ANTHROPIC_API_KEY is set but the API call fails (No Fallback Policy)
 */
export async function enrichPatternCategoryTags(
  patterns: TeamGrowthAreaPEAAggregate[],
  config: TagSimilarityLLMConfig = {},
): Promise<TeamGrowthAreaPEAAggregate[]> {
  if (patterns.length === 0) return patterns;

  // Collect the global raw tag vocabulary across all patterns
  const allRawTags = patterns.flatMap(p => p.categoryTags);

  if (allRawTags.length === 0) return patterns;

  // Run full pipeline on global vocabulary
  const enrichedClusters = await clusterTagsWithLLMEnrichment(allRawTags, config);

  if (enrichedClusters.length === 0) return patterns;

  // Build a lookup: deterministic-canonical → merged display label
  // We need to map each raw tag → its enriched display label.
  //
  // Strategy:
  //   1. For each enriched cluster, we know its displayLabel and canonical.
  //   2. For each raw tag in a pattern, normalize it → canonical.
  //   3. Match against enriched clusters using the same normalization.
  //
  // Import normalizeTag from tag-similarity to do step 2.
  const { normalizeTag } = await import('@/lib/enterprise/tag-similarity');

  // Build canonical → displayLabel map from enriched clusters
  const canonicalToLabel = new Map<string, string>();
  for (const cluster of enrichedClusters) {
    canonicalToLabel.set(cluster.canonical, cluster.displayLabel);
  }

  // For raw tags not matching any enriched canonical exactly, build a
  // similarity-based fallback using the enriched cluster canonicals.
  const { computeTagSimilarity } = await import('@/lib/enterprise/tag-similarity');

  /**
   * Map a single raw tag to its enriched display label.
   * Priority: exact canonical match → best similarity match → original tag.
   */
  function remapTag(rawTag: string): string {
    const norm = normalizeTag(rawTag);
    if (!norm) return rawTag;

    // Exact canonical match
    if (canonicalToLabel.has(norm)) {
      return canonicalToLabel.get(norm)!;
    }

    // Similarity-based match (handles partial overlaps after merging)
    let bestLabel = rawTag;
    let bestScore = 0;
    for (const [canonical, label] of canonicalToLabel) {
      const score = computeTagSimilarity(norm, canonical);
      if (score >= 0.75 && score > bestScore) {
        bestScore = score;
        bestLabel = label;
      }
    }

    return bestLabel;
  }

  // Apply remapping to each pattern's categoryTags, then deduplicate
  return patterns.map(pattern => {
    const remapped = pattern.categoryTags.map(remapTag);
    // Deduplicate while preserving first occurrence order
    const seen = new Set<string>();
    const deduped = remapped.filter(tag => {
      const lower = tag.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });

    return {
      ...pattern,
      categoryTags: deduped,
    };
  });
}
