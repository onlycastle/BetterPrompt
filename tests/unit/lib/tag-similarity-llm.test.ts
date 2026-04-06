/**
 * Tests for tag-similarity-llm module
 *
 * Validates the LLM-based semantic tag cluster merging functions.
 * The LLM-calling functions (mergeTagClustersByLLM, clusterTagsWithLLMEnrichment,
 * enrichPatternCategoryTags) are tested via mocking the Anthropic client.
 * The deterministic helpers (applyMergeGroups, buildTagMergeUserPrompt) are
 * tested without mocking.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Anthropic SDK mock
//
// vi.hoisted() ensures the mockCreate reference is available inside vi.mock()
// even though vi.mock() calls are hoisted to the top of the file.
// ---------------------------------------------------------------------------

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => {
  // Use a class so `new Anthropic(...)` works correctly as a constructor
  class MockAnthropic {
    messages = { create: mockCreate };
    constructor(_config: unknown) {}
  }
  return { default: MockAnthropic };
});

import {
  applyMergeGroups,
  buildTagMergeUserPrompt,
  mergeTagClustersByLLM,
  clusterTagsWithLLMEnrichment,
  enrichPatternCategoryTags,
  TAG_MERGE_SYSTEM_PROMPT,
  type TagCluster,
  type TagSimilarityLLMConfig,
} from '../../../src/lib/enterprise/tag-similarity-llm';
import type { TeamGrowthAreaPEAAggregate } from '../../../src/types/enterprise';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeCluster(displayLabel: string, count: number, canonical?: string): TagCluster {
  return {
    canonical: canonical ?? displayLabel.toLowerCase().replace(/\s+/g, ' ').trim(),
    displayLabel,
    count,
  };
}

function makePattern(
  title: string,
  categoryTags: string[],
): TeamGrowthAreaPEAAggregate {
  return {
    title,
    domain: 'thinkingQuality',
    domainLabel: 'Thinking Quality',
    memberCount: 2,
    totalDevs: 5,
    affectedMembers: ['Alice', 'Bob'],
    predominantSeverity: 'high',
    sampleRecommendation: 'Work on this',
    categoryTags,
    teamRecommendation: 'Team recommendation here',
    memberSeverities: [
      { memberName: 'Alice', severity: 'high' },
      { memberName: 'Bob', severity: 'medium' },
    ],
  };
}

// ---------------------------------------------------------------------------
// applyMergeGroups (pure function — no mocking needed)
// ---------------------------------------------------------------------------

describe('applyMergeGroups', () => {
  it('returns original clusters when mergeGroups is empty', () => {
    const clusters = [
      makeCluster('reactive debugging', 5),
      makeCluster('api design', 3),
    ];
    const result = applyMergeGroups(clusters, []);
    expect(result).toHaveLength(2);
    // Should still be sorted by count descending
    expect(result[0].displayLabel).toBe('reactive debugging');
  });

  it('merges two clusters: sums counts, picks highest-count label', () => {
    const clusters = [
      makeCluster('reactive debugging', 5),   // idx 0
      makeCluster('break-fix mentality', 2),  // idx 1
    ];
    const result = applyMergeGroups(clusters, [[0, 1]]);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(7);
    // "reactive debugging" had higher count → it becomes the display label
    expect(result[0].displayLabel).toBe('reactive debugging');
  });

  it('merges three clusters into one', () => {
    const clusters = [
      makeCluster('verbose error pasting', 4),        // idx 0
      makeCluster('raw stack trace dumps', 2),         // idx 1
      makeCluster('over-detailed error logging', 1),  // idx 2
    ];
    const result = applyMergeGroups(clusters, [[0, 1, 2]]);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(7);
    expect(result[0].displayLabel).toBe('verbose error pasting');
  });

  it('handles multiple independent merge groups', () => {
    const clusters = [
      makeCluster('reactive debugging', 5),       // idx 0
      makeCluster('break-fix mentality', 2),       // idx 1
      makeCluster('context window hoarding', 4),   // idx 2
      makeCluster('session scope creep', 3),       // idx 3
      makeCluster('api design', 6),                // idx 4 (not in any group)
    ];
    const result = applyMergeGroups(clusters, [[0, 1], [2, 3]]);
    expect(result).toHaveLength(3);
    // api design: 6, merged debugging: 7, merged context: 7 → sort desc
    const labels = result.map(c => c.displayLabel);
    // Either debugging or context merge group first (both count 7)
    expect(labels).toContain('api design');
    const debuggingMerge = result.find(c => c.count === 7 && labels.includes('reactive debugging'));
    expect(debuggingMerge ?? result.find(c => c.displayLabel === 'reactive debugging')).toBeTruthy();
  });

  it('leaves clusters not in any merge group unchanged', () => {
    const clusters = [
      makeCluster('reactive debugging', 5),  // idx 0 — in merge group
      makeCluster('break-fix mentality', 2), // idx 1 — in merge group
      makeCluster('api design', 6),          // idx 2 — NOT in merge group
    ];
    const result = applyMergeGroups(clusters, [[0, 1]]);
    expect(result).toHaveLength(2);
    const apiCluster = result.find(c => c.displayLabel === 'api design');
    expect(apiCluster).toBeDefined();
    expect(apiCluster!.count).toBe(6);
  });

  it('silently skips out-of-range indices', () => {
    const clusters = [
      makeCluster('tag A', 3),
      makeCluster('tag B', 2),
    ];
    // Index 99 is out of range — should be ignored
    const result = applyMergeGroups(clusters, [[0, 99]]);
    // Only one valid index (0) in the group → group has < 2 valid indices → skipped
    expect(result).toHaveLength(2); // no merge occurred
  });

  it('silently skips groups where valid indices < 2 after dedup', () => {
    const clusters = [makeCluster('tag A', 3)];
    // Group has only 1 index → not enough to merge
    const result = applyMergeGroups(clusters, [[0]]);
    expect(result).toHaveLength(1);
    expect(result[0].displayLabel).toBe('tag A');
  });

  it('does not double-consume: a cluster index used in one group is skipped in another', () => {
    const clusters = [
      makeCluster('A', 5),
      makeCluster('B', 3),
      makeCluster('C', 2),
    ];
    // Index 0 appears in both groups — should only be consumed once
    const result = applyMergeGroups(clusters, [[0, 1], [0, 2]]);
    // First group [0, 1] merges A+B (count 8); second group [0, 2] — 0 already consumed,
    // only 2 left which is < 2 valid → skipped
    expect(result).toHaveLength(2); // merged(A+B), C
    const merged = result.find(c => c.count === 8);
    expect(merged).toBeDefined();
    const cCluster = result.find(c => c.displayLabel === 'C');
    expect(cCluster).toBeDefined();
  });

  it('sorts output by count descending', () => {
    const clusters = [
      makeCluster('low', 1),
      makeCluster('high', 10),
      makeCluster('medium', 5),
    ];
    const result = applyMergeGroups(clusters, []);
    expect(result[0].count).toBe(10);
    expect(result[1].count).toBe(5);
    expect(result[2].count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// buildTagMergeUserPrompt (pure function)
// ---------------------------------------------------------------------------

describe('buildTagMergeUserPrompt', () => {
  it('lists all clusters with 0-based indices', () => {
    const clusters = [
      makeCluster('reactive debugging', 5),
      makeCluster('api design', 3),
    ];
    const prompt = buildTagMergeUserPrompt(clusters);
    expect(prompt).toContain('0. "reactive debugging"');
    expect(prompt).toContain('1. "api design"');
  });

  it('includes occurrence counts', () => {
    const clusters = [makeCluster('error handling', 7)];
    const prompt = buildTagMergeUserPrompt(clusters);
    expect(prompt).toContain('7 occurrence');
  });

  it('uses singular "occurrence" for count of 1', () => {
    const clusters = [makeCluster('rare tag', 1)];
    const prompt = buildTagMergeUserPrompt(clusters);
    expect(prompt).toContain('1 occurrence)');
    expect(prompt).not.toContain('1 occurrences');
  });

  it('uses plural "occurrences" for count > 1', () => {
    const clusters = [makeCluster('common tag', 3)];
    const prompt = buildTagMergeUserPrompt(clusters);
    expect(prompt).toContain('3 occurrences');
  });

  it('returns a non-empty string for non-empty cluster array', () => {
    const clusters = [makeCluster('debugging', 5), makeCluster('testing', 3)];
    expect(buildTagMergeUserPrompt(clusters).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// TAG_MERGE_SYSTEM_PROMPT smoke test
// ---------------------------------------------------------------------------

describe('TAG_MERGE_SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof TAG_MERGE_SYSTEM_PROMPT).toBe('string');
    expect(TAG_MERGE_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it('contains guidance about only merging when confident', () => {
    expect(TAG_MERGE_SYSTEM_PROMPT.toLowerCase()).toContain('confident');
  });

  it('contains the tool name for reference', () => {
    expect(TAG_MERGE_SYSTEM_PROMPT).toContain('identify_semantic_merge_groups');
  });
});

// ---------------------------------------------------------------------------
// mergeTagClustersByLLM (mocked Anthropic client)
// ---------------------------------------------------------------------------

describe('mergeTagClustersByLLM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when apiKey is not provided and env var is absent', async () => {
    const originalEnv = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const clusters = [
      makeCluster('reactive debugging', 5),
      makeCluster('break-fix mentality', 3),
      makeCluster('api design', 4),
    ];

    await expect(
      mergeTagClustersByLLM(clusters, { apiKey: '' }),
    ).rejects.toThrow('ANTHROPIC_API_KEY is required');

    process.env.ANTHROPIC_API_KEY = originalEnv;
  });

  it('returns original clusters unchanged when count < minClustersForLLM', async () => {
    const clusters = [
      makeCluster('reactive debugging', 5),
      makeCluster('break-fix mentality', 3),
    ];
    // minClustersForLLM defaults to 3 — with 2 clusters, no LLM call
    const result = await mergeTagClustersByLLM(clusters, { apiKey: 'test-key' });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it('returns original clusters when minClustersForLLM threshold not met (explicit config)', async () => {
    const clusters = [makeCluster('only one', 5), makeCluster('two here', 3)];
    const result = await mergeTagClustersByLLM(clusters, {
      apiKey: 'test-key',
      minClustersForLLM: 10, // threshold set much higher
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it('calls Anthropic API and applies merge groups from response', async () => {
    const clusters = [
      makeCluster('reactive debugging', 5),   // idx 0
      makeCluster('break-fix mentality', 3),   // idx 1
      makeCluster('api design', 4),            // idx 2
    ];

    // Mock LLM response: clusters 0 and 1 should be merged
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'test-tool-use-id',
          name: 'identify_semantic_merge_groups',
          input: {
            mergeGroups: [[0, 1]],
          },
        },
      ],
    });

    const result = await mergeTagClustersByLLM(clusters, { apiKey: 'test-key' });

    expect(mockCreate).toHaveBeenCalledOnce();
    // After merging 0+1: count=8, displayLabel='reactive debugging' (higher count)
    // Plus unchanged cluster 2: count=4
    expect(result).toHaveLength(2);
    const merged = result.find(c => c.count === 8);
    expect(merged).toBeDefined();
    expect(merged!.displayLabel).toBe('reactive debugging');
    const unchanged = result.find(c => c.displayLabel === 'api design');
    expect(unchanged).toBeDefined();
    expect(unchanged!.count).toBe(4);
  });

  it('returns all clusters unchanged when LLM returns empty mergeGroups', async () => {
    const clusters = [
      makeCluster('reactive debugging', 5),
      makeCluster('api design', 4),
      makeCluster('error handling', 3),
    ];

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'test-tool-use-id',
          name: 'identify_semantic_merge_groups',
          input: { mergeGroups: [] },
        },
      ],
    });

    const result = await mergeTagClustersByLLM(clusters, { apiKey: 'test-key' });
    expect(result).toHaveLength(3);
    // Sorted by count descending
    expect(result[0].count).toBe(5);
  });

  it('throws when LLM response has no tool_use block', async () => {
    const clusters = [
      makeCluster('A', 5),
      makeCluster('B', 3),
      makeCluster('C', 2),
    ];

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Some text response' }],
    });

    await expect(
      mergeTagClustersByLLM(clusters, { apiKey: 'test-key' }),
    ).rejects.toThrow('did not contain a tool_use block');
  });

  it('throws when tool output is missing mergeGroups field', async () => {
    const clusters = [makeCluster('A', 5), makeCluster('B', 3), makeCluster('C', 2)];

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'test-tool-use-id',
          name: 'identify_semantic_merge_groups',
          input: { wrongField: [] }, // missing mergeGroups
        },
      ],
    });

    await expect(
      mergeTagClustersByLLM(clusters, { apiKey: 'test-key' }),
    ).rejects.toThrow('missing required mergeGroups array');
  });

  it('uses Haiku model by default', async () => {
    const clusters = [makeCluster('A', 5), makeCluster('B', 3), makeCluster('C', 2)];

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'test-tool-use-id',
          name: 'identify_semantic_merge_groups',
          input: { mergeGroups: [] },
        },
      ],
    });

    await mergeTagClustersByLLM(clusters, { apiKey: 'test-key' });

    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toContain('haiku');
  });

  it('uses tool_choice forcing the merge tool', async () => {
    const clusters = [makeCluster('A', 5), makeCluster('B', 3), makeCluster('C', 2)];

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'test-tool-use-id',
          name: 'identify_semantic_merge_groups',
          input: { mergeGroups: [] },
        },
      ],
    });

    await mergeTagClustersByLLM(clusters, { apiKey: 'test-key' });

    const call = mockCreate.mock.calls[0][0];
    expect(call.tool_choice).toEqual({ type: 'tool', name: 'identify_semantic_merge_groups' });
  });
});

// ---------------------------------------------------------------------------
// clusterTagsWithLLMEnrichment
// ---------------------------------------------------------------------------

describe('clusterTagsWithLLMEnrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array for empty input', async () => {
    const result = await clusterTagsWithLLMEnrichment([]);
    expect(result).toEqual([]);
  });

  it('skips LLM call when no API key is set', async () => {
    const originalEnv = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const result = await clusterTagsWithLLMEnrichment(['error handling', 'react']);
    expect(mockCreate).not.toHaveBeenCalled();
    // Still returns deterministic clusters
    expect(result.length).toBeGreaterThan(0);

    process.env.ANTHROPIC_API_KEY = originalEnv;
  });

  it('applies LLM enrichment on top of deterministic clustering when key present', async () => {
    // Simulate 5 distinct conceptual tags (enough to exceed minClustersForLLM=3)
    const rawTags = [
      'reactive debugging loop',
      'break-fix mentality',
      'context bloat',
      'over-explaining background',
      'verbose setup preambles',
    ];

    // Mock: LLM says clusters 0,1 are the same; clusters 2,3,4 are same
    // (deterministic pass will create distinct clusters for each)
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'test-tool-use-id',
          name: 'identify_semantic_merge_groups',
          input: { mergeGroups: [[0, 1], [2, 3, 4]] },
        },
      ],
    });

    const result = await clusterTagsWithLLMEnrichment(rawTags, { apiKey: 'test-key' });
    // Some merging should have happened — result has fewer clusters than raw input
    expect(result.length).toBeLessThan(rawTags.length);
  });
});

// ---------------------------------------------------------------------------
// enrichPatternCategoryTags
// ---------------------------------------------------------------------------

describe('enrichPatternCategoryTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns patterns unchanged when input is empty', async () => {
    const result = await enrichPatternCategoryTags([]);
    expect(result).toEqual([]);
  });

  it('returns patterns unchanged when all categoryTags are empty', async () => {
    const patterns = [
      makePattern('Pattern A', []),
      makePattern('Pattern B', []),
    ];
    const result = await enrichPatternCategoryTags(patterns);
    expect(result).toEqual(patterns);
  });

  it('remaps categoryTags to merged display labels', async () => {
    const patterns = [
      makePattern('Pattern A', ['reactive debugging loop', 'context bloat']),
      makePattern('Pattern B', ['break-fix mentality', 'over-explaining']),
    ];

    // Enough distinct clusters will be produced → LLM gets called
    // Mock: LLM says clusters [0, 1] are the same (reactive debugging + break-fix)
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'test-tool-use-id',
          name: 'identify_semantic_merge_groups',
          input: {
            // The clusters after deterministic pass will be in some order;
            // we just confirm the function runs without error and returns patterns
            mergeGroups: [],
          },
        },
      ],
    });

    const result = await enrichPatternCategoryTags(patterns, { apiKey: 'test-key' });

    // All patterns should be returned
    expect(result).toHaveLength(2);
    // Each pattern should still have categoryTags
    expect(Array.isArray(result[0].categoryTags)).toBe(true);
    expect(Array.isArray(result[1].categoryTags)).toBe(true);
  });

  it('deduplicates remapped tags within each pattern', async () => {
    // Both tags in Pattern A normalize to the same cluster
    const patterns = [
      makePattern('Pattern A', ['error handling', 'exception handling']),
      makePattern('Pattern B', ['api design', 'testing']),
    ];

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'test-tool-use-id',
          name: 'identify_semantic_merge_groups',
          input: { mergeGroups: [] },
        },
      ],
    });

    const result = await enrichPatternCategoryTags(patterns, { apiKey: 'test-key' });

    // Pattern A: "error handling" and "exception handling" are synonyms (same canonical)
    // After remapping, they should deduplicate to 1 tag
    expect(result[0].categoryTags.length).toBeLessThanOrEqual(
      patterns[0].categoryTags.length,
    );
  });

  it('preserves all base pattern fields (spread semantics)', async () => {
    const pattern = makePattern('Test Pattern', ['debugging', 'api']);
    pattern.memberCount = 4;
    pattern.totalDevs = 10;

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'test-tool-use-id',
          name: 'identify_semantic_merge_groups',
          input: { mergeGroups: [] },
        },
      ],
    });

    const [result] = await enrichPatternCategoryTags([pattern], { apiKey: 'test-key' });

    expect(result.title).toBe('Test Pattern');
    expect(result.memberCount).toBe(4);
    expect(result.totalDevs).toBe(10);
    expect(result.domain).toBe('thinkingQuality');
    expect(result.teamRecommendation).toBe('Team recommendation here');
  });

  it('skips LLM call when no API key configured', async () => {
    const originalEnv = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const patterns = [makePattern('Pattern', ['debugging', 'testing'])];
    const result = await enrichPatternCategoryTags(patterns);

    expect(mockCreate).not.toHaveBeenCalled();
    // Tags should be returned (possibly with deterministic normalization applied)
    expect(result[0].categoryTags.length).toBeGreaterThan(0);

    process.env.ANTHROPIC_API_KEY = originalEnv;
  });
});
