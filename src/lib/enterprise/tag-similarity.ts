/**
 * Tag Similarity & Normalization for Team Aggregation
 *
 * When the LLM generates freeform behavioral category tags for growth areas,
 * similar concepts may be expressed differently across developers:
 *   - "error-handling" vs "error handling" vs "Error Handling Patterns"
 *   - "debugging workflow" vs "debug workflows" vs "troubleshooting"
 *   - "api-design" vs "API design" vs "api design patterns"
 *
 * This module provides:
 *   1. normalizeTag() — reduces a tag to a canonical form for deterministic matching
 *   2. computeNormalizedTagOverlap() — counts overlapping tags after normalization
 *   3. areTagsSimilar() — checks if two tags refer to the same concept
 *
 * No LLM calls — all matching is deterministic (string normalization + synonym map).
 *
 * @module tag-similarity
 */

// ---------------------------------------------------------------------------
// Synonym groups — words that should be treated as equivalent
// ---------------------------------------------------------------------------

/**
 * Groups of words that refer to the same concept in the context of
 * developer behavioral patterns. Each group maps to its canonical form
 * (the first element). Order matters: first word is the canonical.
 *
 * Built from observed LLM tag variation in BetterPrompt growth area outputs.
 */
const SYNONYM_GROUPS: string[][] = [
  ['error', 'exception', 'fault', 'errors', 'exceptions'],
  ['debug', 'debugging', 'troubleshoot', 'troubleshooting', 'diagnose', 'diagnosis'],
  ['test', 'testing', 'spec', 'tests'],
  ['refactor', 'refactoring', 'restructure', 'reorganize', 'cleanup'],
  ['document', 'documentation', 'documenting', 'docs', 'doc'],
  ['communicate', 'communication', 'communicating', 'messaging'],
  ['handle', 'handling', 'management', 'manage', 'managing'],
  ['iterate', 'iteration', 'iterating', 'iterative'],
  ['validate', 'validation', 'validating', 'verify', 'verification', 'verifying'],
  ['optimize', 'optimization', 'optimizing', 'performance', 'perf'],
  ['architect', 'architecture', 'design', 'designing', 'structure', 'structuring'],
  ['implement', 'implementation', 'implementing', 'code', 'coding'],
  ['deploy', 'deployment', 'deploying', 'ship', 'shipping'],
  ['configure', 'configuration', 'configuring', 'config', 'setup'],
  ['depend', 'dependency', 'dependencies'],
  ['integrate', 'integration', 'integrating'],
  ['secure', 'security'],
  ['monitor', 'monitoring', 'observe', 'observability'],
  ['automate', 'automation', 'automating'],
  ['maintain', 'maintenance', 'maintaining', 'maintainability'],
  ['scope', 'scoping'],
  ['plan', 'planning'],
  ['review', 'reviewing'],
  ['prompt', 'prompting'],
  ['context', 'contextual'],
];

/** Map from any synonym word → its canonical form (first word in the group) */
const SYNONYM_MAP = new Map<string, string>();
for (const group of SYNONYM_GROUPS) {
  const canonical = group[0];
  for (const word of group) {
    SYNONYM_MAP.set(word, canonical);
  }
}

// ---------------------------------------------------------------------------
// Suffix stripping (lightweight stemming)
// ---------------------------------------------------------------------------

/**
 * Common English suffixes to strip for normalization.
 * Ordered longest-first so "ications" is tried before "tion".
 * Only stripped when the remaining stem is ≥3 characters (avoids over-stemming).
 */
const STRIP_SUFFIXES = [
  'izations', 'isation',
  'fulness', 'iveness',
  'ations', 'ities',
  'ation', 'ment', 'ness', 'ible', 'able',
  'ings', 'tion', 'sion',
  'ing', 'ity', 'ous', 'ive',
  'ly', 'ed', 'er', 'es',
  's',
];

/**
 * Minimal stemmer: strips common suffixes to reduce word variation.
 * Not a full Porter stemmer — intentionally simple to avoid false merges.
 * Examples: "debugging" → "debug", "patterns" → "pattern", "handling" → "handl"
 *
 * The synonym map handles cases where stemming alone isn't enough
 * (e.g., "troubleshoot" vs "debug").
 */
function simpleStem(word: string): string {
  if (word.length <= 3) return word;

  for (const suffix of STRIP_SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

// ---------------------------------------------------------------------------
// Filler words to remove from tags
// ---------------------------------------------------------------------------

/** Common filler words that don't contribute to tag identity */
const FILLER_WORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'for', 'to', 'and', 'or', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'that', 'this', 'those', 'these',
  'its', 'their', 'your', 'our',
  'pattern', 'patterns', 'practice', 'practices',
  'behavior', 'behaviors', 'behaviour', 'behaviours',
  'issue', 'issues', 'problem', 'problems',
  'skill', 'skills', 'technique', 'techniques',
  'approach', 'approaches', 'strategy', 'strategies',
  'habit', 'habits', 'workflow', 'workflows',
]);

// ---------------------------------------------------------------------------
// Core normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a freeform tag to its canonical form for clustering.
 *
 * Pipeline:
 *   1. Lowercase
 *   2. Replace hyphens, underscores, slashes with spaces
 *   3. Remove non-alphanumeric (except spaces)
 *   4. Tokenize on spaces
 *   5. Remove filler words
 *   6. Apply synonym mapping (before stemming, since synonyms are exact words)
 *   7. Apply simple stemming
 *   8. Deduplicate tokens
 *   9. Sort alphabetically (order-independent matching)
 *   10. Join with space
 *
 * Examples:
 *   "Error-Handling Patterns" → "error handl"
 *   "error handling"          → "error handl"
 *   "debugging workflow"      → "debug"
 *   "API Design Patterns"     → "api architect"  (design→architect via synonym)
 *
 * @returns Canonical normalized form, or empty string if tag has no content
 */
export function normalizeTag(tag: string): string {
  // Steps 1-3: lowercase, replace separators, strip non-alphanum
  const cleaned = tag
    .toLowerCase()
    .replace(/[-_/]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

  if (cleaned.length === 0) return '';

  // Steps 4-5: tokenize and remove fillers
  const tokens = cleaned.split(/\s+/).filter(t => t.length > 0 && !FILLER_WORDS.has(t));

  if (tokens.length === 0) return '';

  // Steps 6-7: synonym map, then stem
  const normalized = tokens.map(token => {
    // Check synonym map first (exact word match)
    const synonym = SYNONYM_MAP.get(token);
    if (synonym) return synonym;
    // Then try stemming and check synonym map again
    const stemmed = simpleStem(token);
    const synonymOfStem = SYNONYM_MAP.get(stemmed);
    return synonymOfStem ?? stemmed;
  });

  // Steps 8-9: deduplicate and sort
  const unique = [...new Set(normalized)].sort();

  return unique.join(' ');
}

/**
 * Batch-normalize an array of tags, returning deduplicated normalized forms.
 * Preserves frequency information by not deduplicating here — that's the
 * caller's responsibility.
 */
export function normalizeTags(tags: string[]): string[] {
  return tags.map(normalizeTag).filter(t => t.length > 0);
}

// ---------------------------------------------------------------------------
// Similarity scoring between two normalized tags
// ---------------------------------------------------------------------------

/**
 * Compute similarity between two already-normalized tags using token overlap.
 * Returns a value between 0 and 1 (Jaccard-like coefficient).
 *
 * Formula: |intersection| / |smaller set|
 * Using the smaller set as denominator means a subset always scores 1.0,
 * which is the right behavior for tags like "error" matching "error handl".
 *
 * @param normA - First normalized tag (output of normalizeTag)
 * @param normB - Second normalized tag (output of normalizeTag)
 * @returns Similarity score [0, 1]
 */
export function computeTagSimilarity(normA: string, normB: string): number {
  if (normA === normB) return 1.0;
  if (normA.length === 0 || normB.length === 0) return 0;

  const tokensA = normA.split(' ');
  const tokensB = new Set(normB.split(' '));

  const intersection = tokensA.filter(t => tokensB.has(t)).length;
  const smallerSize = Math.min(tokensA.length, tokensB.size);

  if (smallerSize === 0) return 0;
  return intersection / smallerSize;
}

/**
 * Check whether two raw (un-normalized) tags refer to the same concept.
 * Threshold: similarity ≥ 0.75 after normalization.
 *
 * Examples of tags that match:
 *   - "Error-Handling" ↔ "error handling" (identical after normalize)
 *   - "debugging workflow" ↔ "troubleshooting" (synonym: debug ↔ troubleshoot → no, different)
 *   - "API Design" ↔ "api-design-patterns" (same after filler removal)
 *
 * @param tagA - Raw freeform tag
 * @param tagB - Raw freeform tag
 * @returns true if the tags are semantically similar enough to cluster
 */
export function areTagsSimilar(tagA: string, tagB: string): boolean {
  const normA = normalizeTag(tagA);
  const normB = normalizeTag(tagB);

  if (normA.length === 0 || normB.length === 0) return false;

  return computeTagSimilarity(normA, normB) >= 0.75;
}

// ---------------------------------------------------------------------------
// Enhanced tag overlap computation
// ---------------------------------------------------------------------------

/**
 * Compute the number of semantically overlapping tags between two sets.
 *
 * Unlike the original computeTagOverlapCount (exact case-insensitive match),
 * this version:
 *   1. Normalizes all tags to canonical forms
 *   2. Matches normalized forms (handles "error-handling" ↔ "error handling")
 *   3. Falls back to similarity scoring for partial matches
 *
 * Each tag in tagsA can match at most one tag in tagsB (greedy, no double-counting).
 *
 * @returns Count of tags from tagsA that have a semantic match in tagsB
 */
export function computeNormalizedTagOverlap(tagsA: string[], tagsB: string[]): number {
  if (tagsA.length === 0 || tagsB.length === 0) return 0;

  const normsA = tagsA.map(normalizeTag);
  const normsB = tagsB.map(normalizeTag);

  // Build a set of normalized B tags for fast exact lookup
  const normBSet = new Set(normsB.filter(n => n.length > 0));

  let matchCount = 0;
  const usedB = new Set<string>(); // Track consumed B tags

  for (const normA of normsA) {
    if (normA.length === 0) continue;

    // Pass 1: exact normalized match
    if (normBSet.has(normA) && !usedB.has(normA)) {
      matchCount++;
      usedB.add(normA);
      continue;
    }

    // Pass 2: similarity-based match (for partial overlaps)
    let bestMatch: string | null = null;
    let bestScore = 0;
    for (const normB of normsB) {
      if (normB.length === 0 || usedB.has(normB)) continue;
      const score = computeTagSimilarity(normA, normB);
      if (score >= 0.75 && score > bestScore) {
        bestScore = score;
        bestMatch = normB;
      }
    }
    if (bestMatch) {
      matchCount++;
      usedB.add(bestMatch);
    }
  }

  return matchCount;
}

// ---------------------------------------------------------------------------
// Simple pre-normalization (before full semantic clustering)
// ---------------------------------------------------------------------------

/**
 * Perform minimal string normalization on a freeform tag:
 *   1. Lowercase
 *   2. Replace hyphens, underscores, slashes with spaces (separator → space)
 *   3. Remove non-alphanumeric characters except spaces (strips punctuation)
 *   4. Collapse consecutive whitespace to a single space
 *   5. Trim leading/trailing whitespace
 *
 * This is intentionally simpler than normalizeTag() — it does NOT apply
 * filler removal, synonym mapping, or stemming.  Its purpose is to collapse
 * trivially-equivalent forms (different case / separators / punctuation)
 * into a single canonical surface string so that a cheap pre-deduplication
 * pass can run before the more expensive semantic clustering.
 *
 * Examples:
 *   "Error-Handling!"       → "error handling"
 *   "  API_Design  "        → "api design"
 *   "error handling"        → "error handling"   (unchanged)
 *   "exception/handling"    → "exception handling"
 *
 * @returns Simplified normalized form, or empty string for blank/punctuation-only input
 */
export function simpleNormalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[-_/]/g, ' ')        // separators → space
    .replace(/[^a-z0-9\s]/g, '')   // strip non-alphanumeric except spaces
    .replace(/\s+/g, ' ')          // collapse multiple spaces
    .trim();
}

/**
 * Deduplicate a raw-tag array by exact or near-exact surface similarity
 * **before** semantic clustering is applied.
 *
 * Two tags are considered the same at this stage when they produce an
 * identical result from simpleNormalizeTag() (i.e. same after lowercasing,
 * separator normalization, and punctuation removal).
 *
 * Algorithm:
 *   1. Group tags by their simpleNormalizeTag() form.
 *   2. Within each group choose the most frequently occurring raw form as
 *      the canonical display label.
 *   3. Return the canonical label repeated once for each original occurrence
 *      in the group — this preserves the cumulative frequency count so that
 *      the downstream clusterTags() can still rank tags by frequency.
 *
 * Example:
 *   Input:  ["error-handling", "Error Handling!", "error handling", "react"]
 *   Groups: { "error handling" → ["error-handling"×1, "Error Handling!"×1, "error handling"×1] }
 *           { "react" → ["react"×1] }
 *   Output: ["error handling", "error handling", "error handling", "react"]
 *   (all three error-handling variants replaced by most-frequent form, repeated 3×)
 *
 * @param tags - Raw freeform tags from LLM output (may contain duplicates/variations)
 * @returns Deduplicated array with frequencies preserved for downstream clustering
 */
export function deduplicateTagsBeforeClustering(tags: string[]): string[] {
  if (tags.length === 0) return [];

  // Group by simple-normalized form; track raw label → frequency within each group
  const groups = new Map<string, Map<string, number>>();

  for (const raw of tags) {
    const key = simpleNormalizeTag(raw);
    if (key.length === 0) continue; // skip blank/punctuation-only tags

    const group = groups.get(key) ?? new Map<string, number>();
    group.set(raw, (group.get(raw) ?? 0) + 1);
    groups.set(key, group);
  }

  const result: string[] = [];

  for (const rawCounts of groups.values()) {
    // Find the raw form with the highest frequency in this group
    let bestLabel = '';
    let bestLabelCount = 0;
    let totalCount = 0;

    for (const [label, count] of rawCounts) {
      totalCount += count;
      if (count > bestLabelCount) {
        bestLabelCount = count;
        bestLabel = label;
      }
    }

    // Return the winning label once per original occurrence so that downstream
    // clusterTags() sees the correct total frequency for the merged concept
    for (let i = 0; i < totalCount; i++) {
      result.push(bestLabel);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Per-tag cluster label assignment
// ---------------------------------------------------------------------------

/**
 * Assign each input tag to its canonical cluster display label.
 *
 * Groups all input tags into semantic clusters (via the same normalization
 * pipeline as clusterTags()) and returns a Map where each original input tag
 * is keyed to the display label of the cluster it belongs to.
 *
 * Tags that represent the same underlying concept — whether through casing
 * differences, separator variation, filler-word wrapping, or synonym
 * equivalence — will map to the *same* cluster display label.  The display
 * label is always the most-frequent raw form in the cluster (mirroring
 * clusterTags() behavior).
 *
 * Tags whose entire content reduces to empty (blank, punctuation-only, or
 * filler-only) map to an empty string.
 *
 * Algorithm:
 *   1. Run clusterTags() on the full input array to obtain canonical clusters.
 *   2. For each input tag, normalize it → canonical form.
 *   3. Attempt an exact canonical match against the clusters.
 *   4. If no exact match, find the highest-similarity cluster (≥ 0.75).
 *   5. Return that cluster's displayLabel; fall back to the lowercased tag
 *      when no cluster can be found (should not normally occur).
 *
 * Examples:
 *   Input:  ['error-handling', 'Error Handling', 'debugging', 'troubleshooting', 'react']
 *   Output (Map):
 *     'error-handling'   → 'error handling'
 *     'Error Handling'   → 'error handling'
 *     'debugging'        → 'debugging'         (or 'troubleshooting' — whichever is first/most-frequent)
 *     'troubleshooting'  → 'debugging'          (synonym: both normalize to 'debug')
 *     'react'            → 'react'
 *
 * @param tags - Array of freeform tag strings (may contain duplicates and variations)
 * @returns Map<originalTag, clusterDisplayLabel>
 */
export function assignTagClusterLabels(tags: string[]): Map<string, string> {
  if (tags.length === 0) return new Map();

  // Obtain canonical clusters from the full input
  const clusters = clusterTags(tags);

  const result = new Map<string, string>();

  for (const tag of tags) {
    if (result.has(tag)) continue; // Already resolved (duplicates share the same answer)

    const canonical = normalizeTag(tag);

    if (canonical.length === 0) {
      // Blank/punctuation-only/filler-only tag — no meaningful cluster
      result.set(tag, '');
      continue;
    }

    // Pass 1: exact canonical match against cluster list
    let matchedCluster = clusters.find(c => c.canonical === canonical);

    if (!matchedCluster) {
      // Pass 2: similarity-based match (mirrors clusterTags internal logic)
      let bestScore = 0;
      for (const cluster of clusters) {
        const score = computeTagSimilarity(canonical, cluster.canonical);
        if (score >= 0.75 && score > bestScore) {
          bestScore = score;
          matchedCluster = cluster;
        }
      }
    }

    // Assign the cluster's display label, or fall back to lowercased tag
    result.set(tag, matchedCluster?.displayLabel ?? tag.toLowerCase().trim());
  }

  return result;
}

// ---------------------------------------------------------------------------
// Full semantic tag clustering
// ---------------------------------------------------------------------------

/**
 * Merge a set of raw tags into deduplicated, canonical-form clusters.
 *
 * Groups tags that normalize to the same canonical form, keeping the
 * most common raw form as the display label. Returns entries sorted
 * by frequency (descending).
 *
 * Used by aggregateGrowthAreasPEA to produce clean, deduplicated tag lists
 * for team-level pattern display.
 *
 * @param rawTags - Array of raw freeform tags (may contain duplicates and variations)
 * @returns Array of { canonical, displayLabel, count } sorted by count desc
 */
export function clusterTags(
  rawTags: string[],
): Array<{ canonical: string; displayLabel: string; count: number }> {
  if (rawTags.length === 0) return [];

  // Group raw tags by their canonical form
  const groups = new Map<string, Map<string, number>>();

  for (const raw of rawTags) {
    const canonical = normalizeTag(raw);
    if (canonical.length === 0) continue;

    // Find existing group via exact canonical match or similarity
    let targetCanonical = canonical;
    if (!groups.has(canonical)) {
      // Check if a similar canonical already exists
      for (const existingCanonical of groups.keys()) {
        if (computeTagSimilarity(canonical, existingCanonical) >= 0.75) {
          targetCanonical = existingCanonical;
          break;
        }
      }
    }

    const group = groups.get(targetCanonical) ?? new Map<string, number>();
    const lowerRaw = raw.toLowerCase().trim();
    group.set(lowerRaw, (group.get(lowerRaw) ?? 0) + 1);
    groups.set(targetCanonical, group);
  }

  // For each group, pick the most frequent raw form as display label
  const result: Array<{ canonical: string; displayLabel: string; count: number }> = [];

  for (const [canonical, rawCounts] of groups) {
    let bestLabel = '';
    let bestCount = 0;
    let totalCount = 0;

    for (const [label, count] of rawCounts) {
      totalCount += count;
      if (count > bestCount) {
        bestCount = count;
        bestLabel = label;
      }
    }

    result.push({ canonical, displayLabel: bestLabel, count: totalCount });
  }

  return result.sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Per-normalized-form cluster assignment index
// ---------------------------------------------------------------------------

/**
 * Build a lookup from normalized tag form → cluster canonical + display label.
 *
 * This is the "per-tag assignment" companion to clusterTags().  While
 * clusterTags() returns a summary of clusters, buildTagClusterIndex() tells
 * you *which* cluster each individual normalized tag form belongs to — enabling
 * per-tag canonical resolution in an inverted index.
 *
 * The key insight: two different raw tags like "error handling" and
 * "exception handling" both normalize to "error handl" (synonym: exception→error).
 * After clusterTags() groups them, buildTagClusterIndex() maps the normalized
 * form "error handl" → the cluster's canonical key and display label.
 *
 * Used by groupPatternsByTag() to ensure similar tags from *different* patterns
 * are merged under the same canonical cluster label before frequency counting,
 * implementing cross-developer pattern tag unification (Sub-AC 14b).
 *
 * Algorithm:
 *   1. Run clusterTags() on all raw tags to obtain canonical clusters with
 *      frequency-ranked display labels.
 *   2. For each distinct normalized form, find its cluster by:
 *      a. Exact match on cluster.canonical
 *      b. Best-similarity match (≥ 0.75) — mirrors clusterTags internal logic
 *   3. Return a Map from normalized form → { canonical, displayLabel }.
 *
 * @param rawTags - Flat array of all raw tags to cluster (typically all tags
 *   from all cross-developer patterns in the current team view)
 * @returns Map<normalizedTagForm, { canonical: string; displayLabel: string }>
 *   where `canonical` is the cluster's representative normalized form and
 *   `displayLabel` is the most-frequent raw form for that cluster.
 */
export function buildTagClusterIndex(
  rawTags: string[],
): Map<string, { canonical: string; displayLabel: string }> {
  if (rawTags.length === 0) return new Map();

  // Obtain canonical clusters (frequency-ranked display labels)
  const clusters = clusterTags(rawTags);
  if (clusters.length === 0) return new Map();

  const index = new Map<string, { canonical: string; displayLabel: string }>();

  for (const raw of rawTags) {
    const norm = normalizeTag(raw);
    if (norm.length === 0 || index.has(norm)) continue;

    // Find the cluster this normalized form belongs to.
    // Priority: exact canonical match, then best similarity match.
    let matched: { canonical: string; displayLabel: string } | undefined;
    let bestScore = 0;

    for (const cluster of clusters) {
      if (cluster.canonical === norm) {
        // Exact canonical match → always wins, no need to keep searching
        matched = { canonical: cluster.canonical, displayLabel: cluster.displayLabel };
        break;
      }
      const score = computeTagSimilarity(norm, cluster.canonical);
      if (score >= 0.75 && score > bestScore) {
        bestScore = score;
        matched = { canonical: cluster.canonical, displayLabel: cluster.displayLabel };
      }
    }

    if (matched) {
      index.set(norm, matched);
    }
  }

  return index;
}
