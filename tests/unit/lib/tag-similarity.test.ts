/**
 * Tests for tag-similarity module
 *
 * Validates the normalization, similarity scoring, and clustering of
 * freeform LLM-generated category tags used in team aggregation.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeTag,
  normalizeTags,
  computeTagSimilarity,
  areTagsSimilar,
  computeNormalizedTagOverlap,
  clusterTags,
  simpleNormalizeTag,
  deduplicateTagsBeforeClustering,
  assignTagClusterLabels,
  buildTagClusterIndex,
} from '@/lib/enterprise/tag-similarity';

// ---------------------------------------------------------------------------
// normalizeTag
// ---------------------------------------------------------------------------

describe('normalizeTag', () => {
  it('returns empty string for empty/whitespace input', () => {
    expect(normalizeTag('')).toBe('');
    expect(normalizeTag('   ')).toBe('');
  });

  it('lowercases and normalizes separators', () => {
    // Hyphens, underscores become spaces, then tokens are sorted
    const result = normalizeTag('Error-Handling');
    expect(result).toContain('error');
    expect(result).toContain('handl');
  });

  it('handles underscored tags', () => {
    const a = normalizeTag('error_handling');
    const b = normalizeTag('error-handling');
    expect(a).toBe(b);
  });

  it('strips filler words like "patterns" and "practices"', () => {
    const a = normalizeTag('error handling patterns');
    const b = normalizeTag('error handling');
    expect(a).toBe(b);
  });

  it('removes articles and prepositions', () => {
    const a = normalizeTag('the art of debugging');
    // "the" and "of" are filler words; "art" is kept; "debugging" → "debug" via synonym
    expect(a).toContain('debug');
    // Should not contain filler words
    expect(a).not.toContain('the');
    expect(a).not.toContain('of');
  });

  it('applies synonym mapping: "documentation" → "document"', () => {
    const a = normalizeTag('documentation');
    const b = normalizeTag('document');
    expect(a).toBe(b);
  });

  it('applies synonym mapping: "testing" → "test"', () => {
    const a = normalizeTag('testing');
    const b = normalizeTag('test');
    expect(a).toBe(b);
  });

  it('applies synonym mapping: "troubleshooting" and "debugging" both map to "debug"', () => {
    const a = normalizeTag('troubleshooting');
    const b = normalizeTag('debugging');
    // Both should map to the same canonical form via synonym groups
    expect(a).toBe(b);
    expect(a).toBe('debug');
  });

  it('deduplicates tokens', () => {
    const result = normalizeTag('error error error');
    const tokens = result.split(' ');
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('sorts tokens alphabetically for order-independent matching', () => {
    const a = normalizeTag('api design');
    const b = normalizeTag('design api');
    expect(a).toBe(b);
  });

  it('handles mixed case, hyphens, and filler words together', () => {
    const a = normalizeTag('Error-Handling Patterns');
    const b = normalizeTag('error handling');
    expect(a).toBe(b);
  });

  it('preserves meaningful short words', () => {
    // "api" is 3 chars and not a filler
    const result = normalizeTag('api');
    expect(result).toBe('api');
  });

  it('normalizes "exception handling" same as "error handling" via synonyms', () => {
    const a = normalizeTag('exception handling');
    const b = normalizeTag('error handling');
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// normalizeTags
// ---------------------------------------------------------------------------

describe('normalizeTags', () => {
  it('normalizes an array and filters empty results', () => {
    const result = normalizeTags(['Error-Handling', '', '  ', 'testing']);
    expect(result.length).toBe(2);
    expect(result).toContain(normalizeTag('error-handling'));
    expect(result).toContain(normalizeTag('testing'));
  });

  it('returns empty for empty input', () => {
    expect(normalizeTags([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeTagSimilarity
// ---------------------------------------------------------------------------

describe('computeTagSimilarity', () => {
  it('returns 1.0 for identical normalized tags', () => {
    expect(computeTagSimilarity('error handl', 'error handl')).toBe(1.0);
  });

  it('returns 0 when either is empty', () => {
    expect(computeTagSimilarity('', 'error')).toBe(0);
    expect(computeTagSimilarity('error', '')).toBe(0);
  });

  it('returns 1.0 when one is a subset of the other', () => {
    // "error" is a subset of "error handl"
    // |intersection| = 1, |smaller| = 1 → 1.0
    expect(computeTagSimilarity('error', 'error handl')).toBe(1.0);
  });

  it('returns partial score for partial overlap', () => {
    // "error handl" vs "error react"
    // intersection = {error} = 1, min(2, 2) = 2 → 0.5
    expect(computeTagSimilarity('error handl', 'error react')).toBe(0.5);
  });

  it('returns 0 for completely disjoint tags', () => {
    expect(computeTagSimilarity('error handl', 'react typescript')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// areTagsSimilar
// ---------------------------------------------------------------------------

describe('areTagsSimilar', () => {
  it('returns true for tags that normalize identically', () => {
    expect(areTagsSimilar('Error-Handling', 'error handling')).toBe(true);
    expect(areTagsSimilar('error_handling_patterns', 'error handling')).toBe(true);
  });

  it('returns true for synonym-equivalent tags', () => {
    expect(areTagsSimilar('testing', 'test')).toBe(true);
    expect(areTagsSimilar('documentation', 'docs')).toBe(true);
  });

  it('returns false for unrelated tags', () => {
    expect(areTagsSimilar('error handling', 'react components')).toBe(false);
    expect(areTagsSimilar('debugging', 'api design')).toBe(false);
  });

  it('returns false for empty tags', () => {
    expect(areTagsSimilar('', 'error')).toBe(false);
    expect(areTagsSimilar('error', '')).toBe(false);
  });

  it('returns true for subset relationships when small set fully overlaps', () => {
    // "api" is subset of "api architect" → 1.0 ≥ 0.75
    expect(areTagsSimilar('api', 'api design')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeNormalizedTagOverlap
// ---------------------------------------------------------------------------

describe('computeNormalizedTagOverlap', () => {
  it('returns 0 for empty arrays', () => {
    expect(computeNormalizedTagOverlap([], ['a'])).toBe(0);
    expect(computeNormalizedTagOverlap(['a'], [])).toBe(0);
    expect(computeNormalizedTagOverlap([], [])).toBe(0);
  });

  it('matches identical tags', () => {
    expect(computeNormalizedTagOverlap(
      ['error-handling', 'react'],
      ['error-handling', 'react'],
    )).toBe(2);
  });

  it('matches tags with different casing and separators', () => {
    expect(computeNormalizedTagOverlap(
      ['Error-Handling', 'React'],
      ['error handling', 'react'],
    )).toBe(2);
  });

  it('matches tags with filler word differences', () => {
    expect(computeNormalizedTagOverlap(
      ['error handling patterns'],
      ['error handling'],
    )).toBe(1);
  });

  it('matches synonym tags', () => {
    expect(computeNormalizedTagOverlap(
      ['testing', 'documentation'],
      ['test', 'docs'],
    )).toBe(2);
  });

  it('returns 0 for completely disjoint tags', () => {
    expect(computeNormalizedTagOverlap(
      ['debugging', 'python'],
      ['react', 'deployment'],
    )).toBe(0);
  });

  it('does not double-count: each B tag matches at most once', () => {
    // Both A tags normalize similarly to 'error', but B only has one 'error' concept
    expect(computeNormalizedTagOverlap(
      ['error-handling', 'exception-handling'],
      ['error handling'],
    )).toBeLessThanOrEqual(1);
  });

  it('handles mixed matches (some exact, some fuzzy)', () => {
    const result = computeNormalizedTagOverlap(
      ['react', 'Error Handling Patterns', 'API Design'],
      ['react', 'error-handling', 'api-design-practices'],
    );
    expect(result).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// clusterTags
// ---------------------------------------------------------------------------

describe('clusterTags', () => {
  it('returns empty for empty input', () => {
    expect(clusterTags([])).toEqual([]);
  });

  it('groups identical tags and counts frequency', () => {
    const result = clusterTags(['react', 'react', 'react']);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
    expect(result[0].displayLabel).toBe('react');
  });

  it('merges case and separator variations into one cluster', () => {
    const result = clusterTags([
      'error-handling',
      'Error Handling',
      'error_handling',
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
  });

  it('merges filler-word variations into one cluster', () => {
    const result = clusterTags([
      'error handling patterns',
      'error handling',
      'error handling practices',
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
  });

  it('keeps distinct concepts separate', () => {
    const result = clusterTags([
      'error handling',
      'api design',
      'testing',
    ]);
    expect(result).toHaveLength(3);
  });

  it('sorts by frequency descending', () => {
    const result = clusterTags([
      'api design',
      'error handling',
      'error handling',
      'error handling',
      'api design',
      'testing',
    ]);
    expect(result[0].displayLabel).toContain('error');
    expect(result[0].count).toBe(3);
    expect(result[1].count).toBe(2);
    expect(result[2].count).toBe(1);
  });

  it('picks most frequent raw form as display label', () => {
    const result = clusterTags([
      'Error-Handling',        // 1x
      'error handling',        // 2x
      'error handling',
    ]);
    expect(result[0].displayLabel).toBe('error handling');
  });

  it('merges synonym variations', () => {
    const result = clusterTags([
      'testing',
      'test',
      'testing patterns',
    ]);
    // All should cluster together since testing→test via synonym
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// simpleNormalizeTag
// ---------------------------------------------------------------------------

describe('simpleNormalizeTag', () => {
  it('returns empty string for empty/whitespace-only input', () => {
    expect(simpleNormalizeTag('')).toBe('');
    expect(simpleNormalizeTag('   ')).toBe('');
  });

  it('lowercases the tag', () => {
    expect(simpleNormalizeTag('Error Handling')).toBe('error handling');
    expect(simpleNormalizeTag('API_DESIGN')).toBe('api design');
  });

  it('replaces hyphens with spaces', () => {
    expect(simpleNormalizeTag('error-handling')).toBe('error handling');
  });

  it('replaces underscores with spaces', () => {
    expect(simpleNormalizeTag('error_handling')).toBe('error handling');
  });

  it('replaces slashes with spaces', () => {
    expect(simpleNormalizeTag('exception/handling')).toBe('exception handling');
  });

  it('strips punctuation characters', () => {
    expect(simpleNormalizeTag('error handling!')).toBe('error handling');
    expect(simpleNormalizeTag('(api-design)')).toBe('api design');
    expect(simpleNormalizeTag('debug & trace')).toBe('debug trace'); // & removed, spaces collapsed
  });

  it('collapses multiple spaces to one', () => {
    expect(simpleNormalizeTag('error  handling')).toBe('error handling');
    expect(simpleNormalizeTag('  api   design  ')).toBe('api design');
  });

  it('trims leading and trailing whitespace', () => {
    expect(simpleNormalizeTag('  error handling  ')).toBe('error handling');
  });

  it('does NOT strip filler words (unlike normalizeTag)', () => {
    // simpleNormalizeTag keeps all tokens — only normalizeTag strips fillers
    const result = simpleNormalizeTag('error handling patterns');
    expect(result).toBe('error handling patterns');
  });

  it('does NOT apply synonym mapping (unlike normalizeTag)', () => {
    // "debugging" should stay "debugging" — synonym collapse happens in normalizeTag
    expect(simpleNormalizeTag('debugging')).toBe('debugging');
    expect(simpleNormalizeTag('troubleshooting')).toBe('troubleshooting');
  });

  it('produces the same output for trivially-equivalent surface forms', () => {
    const a = simpleNormalizeTag('Error-Handling!');
    const b = simpleNormalizeTag('error handling');
    const c = simpleNormalizeTag('  Error_Handling  ');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('keeps distinct concepts distinct', () => {
    expect(simpleNormalizeTag('error handling')).not.toBe(simpleNormalizeTag('api design'));
  });

  it('handles alphanumeric tags without change beyond lowercasing', () => {
    expect(simpleNormalizeTag('react')).toBe('react');
    expect(simpleNormalizeTag('TypeScript')).toBe('typescript');
  });
});

// ---------------------------------------------------------------------------
// deduplicateTagsBeforeClustering
// ---------------------------------------------------------------------------

describe('deduplicateTagsBeforeClustering', () => {
  it('returns empty array for empty input', () => {
    expect(deduplicateTagsBeforeClustering([])).toEqual([]);
  });

  it('passes through a single unique tag unchanged', () => {
    const result = deduplicateTagsBeforeClustering(['error handling']);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('error handling');
  });

  it('collapses hyphenated and plain-space variants into one label', () => {
    const result = deduplicateTagsBeforeClustering([
      'error-handling',
      'error handling',
      'Error Handling',
    ]);
    // All three reduce to "error handling" after simpleNormalize
    expect(result).toHaveLength(3); // frequency preserved: 3 occurrences
    expect(new Set(result).size).toBe(1); // all the same label
  });

  it('preserves frequency by returning canonical label once per original occurrence', () => {
    // 2× "error-handling" + 1× "Error Handling!" → total 3 occurrences
    const result = deduplicateTagsBeforeClustering([
      'error-handling',
      'error-handling',
      'Error Handling!',
    ]);
    expect(result).toHaveLength(3);
  });

  it('picks the most frequent raw form as the canonical label', () => {
    const result = deduplicateTagsBeforeClustering([
      'error handling',   // 2×
      'error handling',
      'error-handling',   // 1×
    ]);
    // "error handling" appears 2× so it should win
    expect(result.every(r => r === 'error handling')).toBe(true);
  });

  it('keeps distinct surface concepts separate', () => {
    const result = deduplicateTagsBeforeClustering([
      'error handling',
      'api design',
      'react',
    ]);
    // 3 distinct groups → 3 entries
    expect(result).toHaveLength(3);
    const unique = new Set(result);
    expect(unique.has('error handling')).toBe(true);
    expect(unique.has('api design')).toBe(true);
    expect(unique.has('react')).toBe(true);
  });

  it('skips blank or punctuation-only tags', () => {
    const result = deduplicateTagsBeforeClustering(['', '!!!', 'react']);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('react');
  });

  it('normalizes trailing punctuation before grouping', () => {
    const result = deduplicateTagsBeforeClustering([
      'error handling!',
      'error handling',
    ]);
    // Both map to "error handling" after stripping '!'
    expect(result).toHaveLength(2);
    expect(new Set(result).size).toBe(1);
  });

  it('collapses underscore and hyphen variants in the same group', () => {
    const result = deduplicateTagsBeforeClustering([
      'api_design',
      'api-design',
      'api design',
    ]);
    expect(result).toHaveLength(3);
    expect(new Set(result).size).toBe(1);
  });

  it('does NOT merge semantically similar but surface-distinct tags', () => {
    // "debugging" and "troubleshooting" are synonyms semantically, but
    // deduplicateTagsBeforeClustering only checks surface equivalence
    const result = deduplicateTagsBeforeClustering([
      'debugging',
      'troubleshooting',
    ]);
    expect(result).toHaveLength(2);
    // They remain distinct at this stage; clusterTags handles semantic merging
    expect(new Set(result).size).toBe(2);
  });

  it('integrates with clusterTags to produce correct frequency counts', () => {
    // Simulate 3 members each tagging the same concept differently
    const rawTags = [
      'error-handling',   // member A
      'Error Handling!',  // member B
      'error_handling',   // member C
    ];
    const preDeduped = deduplicateTagsBeforeClustering(rawTags);
    const clusters = clusterTags(preDeduped);
    // All three should land in one cluster with count 3
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// assignTagClusterLabels
// ---------------------------------------------------------------------------

describe('assignTagClusterLabels', () => {
  // --- basic contract ---

  it('returns an empty Map for empty input', () => {
    const result = assignTagClusterLabels([]);
    expect(result.size).toBe(0);
  });

  it('maps a single tag to itself (its own cluster)', () => {
    const result = assignTagClusterLabels(['react']);
    expect(result.size).toBe(1);
    expect(result.get('react')).toBe('react');
  });

  it('returns a Map with one entry per unique input tag (duplicates share one key)', () => {
    // 'react' appears twice — the Map key is unique so there is still one entry
    const result = assignTagClusterLabels(['react', 'react']);
    expect(result.size).toBe(1);
    expect(result.get('react')).toBe('react');
  });

  // --- near-duplicate / surface-variation grouping ---

  it('assigns the same cluster label to hyphen, underscore, and space variants', () => {
    const result = assignTagClusterLabels([
      'error-handling',
      'error_handling',
      'error handling',
    ]);
    const labels = new Set([
      result.get('error-handling'),
      result.get('error_handling'),
      result.get('error handling'),
    ]);
    // All three should resolve to the same cluster label
    expect(labels.size).toBe(1);
  });

  it('assigns the same cluster label regardless of casing', () => {
    const result = assignTagClusterLabels([
      'Error Handling',
      'ERROR HANDLING',
      'error handling',
    ]);
    const labels = new Set([
      result.get('Error Handling'),
      result.get('ERROR HANDLING'),
      result.get('error handling'),
    ]);
    expect(labels.size).toBe(1);
  });

  it('strips filler words so "error handling patterns" clusters with "error handling"', () => {
    const result = assignTagClusterLabels([
      'error handling patterns',
      'error handling',
    ]);
    expect(result.get('error handling patterns')).toBe(result.get('error handling'));
  });

  it('strips punctuation from tags before clustering', () => {
    const result = assignTagClusterLabels([
      'error handling!',
      'error handling',
    ]);
    expect(result.get('error handling!')).toBe(result.get('error handling'));
  });

  // --- semantically similar (synonym) grouping ---

  it('maps synonym tags to the same cluster label: "debugging" and "troubleshooting"', () => {
    const result = assignTagClusterLabels([
      'debugging',
      'troubleshooting',
    ]);
    // Both normalize to 'debug' via the synonym map
    expect(result.get('debugging')).toBe(result.get('troubleshooting'));
  });

  it('maps "testing" and "test" to the same cluster label', () => {
    const result = assignTagClusterLabels(['testing', 'test']);
    expect(result.get('testing')).toBe(result.get('test'));
  });

  it('maps "documentation" and "docs" to the same cluster label', () => {
    const result = assignTagClusterLabels(['documentation', 'docs']);
    expect(result.get('documentation')).toBe(result.get('docs'));
  });

  it('maps "exception handling" to the same cluster as "error handling" via synonyms', () => {
    const result = assignTagClusterLabels(['exception handling', 'error handling']);
    expect(result.get('exception handling')).toBe(result.get('error handling'));
  });

  // --- distinct concepts stay separate ---

  it('keeps unrelated tags in distinct clusters', () => {
    const result = assignTagClusterLabels([
      'error handling',
      'api design',
      'react',
    ]);
    const labelSet = new Set([
      result.get('error handling'),
      result.get('api design'),
      result.get('react'),
    ]);
    expect(labelSet.size).toBe(3);
  });

  it('keeps "debugging" and "api design" in different clusters', () => {
    const result = assignTagClusterLabels(['debugging', 'api design']);
    expect(result.get('debugging')).not.toBe(result.get('api design'));
  });

  // --- display label selection ---

  it('uses the most-frequent raw form as the cluster display label', () => {
    // 'error handling' appears 2× vs 'error-handling' 1× — 'error handling' should win
    const result = assignTagClusterLabels([
      'error handling',
      'error handling',
      'error-handling',
    ]);
    // All three map to 'error handling' (the most common raw form in the cluster)
    expect(result.get('error handling')).toBe('error handling');
    expect(result.get('error-handling')).toBe('error handling');
  });

  it('mixed batch: near-duplicates cluster together, distinct concepts stay separate', () => {
    const result = assignTagClusterLabels([
      'Error-Handling',     // near-dup of 'error handling'
      'error handling',     // anchor
      'Debugging',          // synonym of 'troubleshooting'
      'troubleshooting',    // synonym of 'Debugging'
      'react',              // unique
    ]);

    // error-handling group
    expect(result.get('Error-Handling')).toBe(result.get('error handling'));

    // debugging/troubleshooting group
    expect(result.get('Debugging')).toBe(result.get('troubleshooting'));

    // react is its own group
    expect(result.get('react')).not.toBe(result.get('error handling'));
    expect(result.get('react')).not.toBe(result.get('Debugging'));
  });

  // --- edge cases ---

  it('maps blank/whitespace-only tags to empty string', () => {
    const result = assignTagClusterLabels(['', '   ']);
    expect(result.get('')).toBe('');
    expect(result.get('   ')).toBe('');
  });

  it('maps punctuation-only tags to empty string', () => {
    const result = assignTagClusterLabels(['!!!', '---']);
    expect(result.get('!!!')).toBe('');
    expect(result.get('---')).toBe('');
  });

  it('maps filler-only tags (e.g. "patterns practices") to empty string', () => {
    // 'patterns' and 'practices' are both filler words
    const result = assignTagClusterLabels(['patterns practices']);
    expect(result.get('patterns practices')).toBe('');
  });

  it('handles a large mixed batch without error', () => {
    const tags = [
      'error-handling', 'Error Handling', 'error_handling',   // near-dups
      'debugging', 'troubleshooting', 'Debugging Workflow',   // synonyms
      'testing', 'test', 'Testing Patterns',                  // synonyms
      'api design', 'API Design Patterns', 'api-design',      // near-dups + filler
      'react', 'React', 'react component',                    // near-dups
      '', 'patterns', '!!!',                                   // empty / filler-only
    ];
    expect(() => assignTagClusterLabels(tags)).not.toThrow();
    const result = assignTagClusterLabels(tags);
    // All valid tags have a label (possibly empty for filler-only)
    expect(result.size).toBe(new Set(tags).size);
  });

  it('returns consistent results when called with same input twice', () => {
    const tags = ['error handling', 'debugging', 'react'];
    const resultA = assignTagClusterLabels(tags);
    const resultB = assignTagClusterLabels(tags);
    for (const tag of tags) {
      expect(resultA.get(tag)).toBe(resultB.get(tag));
    }
  });

  it('every key in the returned Map is one of the original input tags', () => {
    const tags = ['error handling', 'api design', 'react'];
    const result = assignTagClusterLabels(tags);
    for (const key of result.keys()) {
      expect(tags).toContain(key);
    }
  });
});

// ---------------------------------------------------------------------------
// buildTagClusterIndex
// ---------------------------------------------------------------------------

describe('buildTagClusterIndex', () => {
  it('returns an empty Map for an empty input', () => {
    expect(buildTagClusterIndex([]).size).toBe(0);
  });

  it('maps a normalized tag form to its cluster canonical and displayLabel', () => {
    const index = buildTagClusterIndex(['error-handling', 'react']);
    // normalizeTag('error-handling') = 'error handl'
    const entry = index.get(normalizeTag('error-handling'));
    expect(entry).toBeDefined();
    expect(entry!.canonical).toBeTruthy();
    expect(entry!.displayLabel).toBeTruthy();
  });

  it('merges synonym-equivalent tags to the same canonical (exception→error via synonym map)', () => {
    // Both "error handling" and "exception handling" normalize to "error handl"
    // because normalizeTag applies synonym mapping (exception → error)
    const norm1 = normalizeTag('error handling');
    const norm2 = normalizeTag('exception handling');
    // Pre-condition: they normalize identically
    expect(norm1).toBe(norm2);

    const index = buildTagClusterIndex(['error handling', 'exception handling', 'react']);
    // Both normalized forms should map to the same canonical cluster
    const entry1 = index.get(norm1);
    const entry2 = index.get(norm2); // same key as norm1, so same entry
    expect(entry1).toBeDefined();
    expect(entry2).toBeDefined();
    expect(entry1!.canonical).toBe(entry2!.canonical);
  });

  it('assigns the most-frequent raw form as displayLabel within a cluster', () => {
    // "error-handling" appears 3 times, "Error Handling" once → displayLabel = "error-handling"
    const tags = [
      'error-handling', 'error-handling', 'error-handling', 'Error Handling',
    ];
    const index = buildTagClusterIndex(tags);
    const norm = normalizeTag('error-handling');
    const entry = index.get(norm);
    expect(entry).toBeDefined();
    // Most frequent raw form (lowercased) should be "error-handling"
    expect(entry!.displayLabel).toBe('error-handling');
  });

  it('produces stable results across calls with the same input', () => {
    const tags = ['debugging', 'testing', 'react', 'error handling'];
    const indexA = buildTagClusterIndex(tags);
    const indexB = buildTagClusterIndex(tags);
    for (const [norm, entryA] of indexA) {
      const entryB = indexB.get(norm);
      expect(entryB).toBeDefined();
      expect(entryA.canonical).toBe(entryB!.canonical);
      expect(entryA.displayLabel).toBe(entryB!.displayLabel);
    }
  });

  it('each cluster canonical is a valid non-empty string', () => {
    const tags = ['error handling', 'debugging workflow', 'api design', 'testing'];
    const index = buildTagClusterIndex(tags);
    for (const entry of index.values()) {
      expect(entry.canonical.length).toBeGreaterThan(0);
      expect(entry.displayLabel.length).toBeGreaterThan(0);
    }
  });

  it('keys are normalized forms (output of normalizeTag) for the input tags', () => {
    const tags = ['Error-Handling', 'debugging', 'React'];
    const index = buildTagClusterIndex(tags);
    for (const tag of tags) {
      const norm = normalizeTag(tag);
      if (norm.length > 0) {
        // The normalized form should be a key in the index
        expect(index.has(norm)).toBe(true);
      }
    }
  });
});
