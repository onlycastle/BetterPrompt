/**
 * Tests for Insight Deduplication Utility
 *
 * Verifies that Professional Insights are correctly deduplicated across
 * the entire report, with proper priority handling.
 */

import { describe, it, expect } from 'vitest';
import {
  deduplicateInsights,
  filterFallbackInsights,
  createGrowthKey,
  LLM_REFERENCE_SCORE,
  FALLBACK_THRESHOLD,
  MAX_FALLBACK_PER_GROWTH,
  MAX_FALLBACK_TOTAL,
  type GrowthWithCandidates,
  type InsightCandidate,
} from '../../../src/lib/utils/insight-deduplication';
import type { ReferencedInsight } from '../../../src/lib/models/worker-insights';
import type { MatchedProfessionalInsight } from '../../../src/lib/models/verbose-evaluation';

// Test fixtures
const createInsight = (id: string, title: string = `Insight ${id}`): ReferencedInsight => ({
  id,
  title,
  url: `https://example.com/${id}`,
  keyTakeaway: `Key takeaway for ${id}`,
  actionableAdvice: ['Advice 1', 'Advice 2'],
  category: 'diagnosis',
  sourceAuthor: 'Test Author',
});

const createMatchedInsight = (
  id: string,
  matchScore: number,
  title: string = `Insight ${id}`
): MatchedProfessionalInsight => ({
  id,
  title,
  keyTakeaway: `Key takeaway for ${id}`,
  actionableAdvice: ['Advice 1', 'Advice 2'],
  sourceAuthor: 'Test Author',
  sourceUrl: `https://example.com/${id}`,
  category: 'diagnosis',
  priority: 5,
  matchScore,
});

describe('deduplicateInsights', () => {
  it('should return empty map for empty input', () => {
    const result = deduplicateInsights([]);
    expect(result.size).toBe(0);
  });

  it('should allocate single insight to single growth area', () => {
    const insight = createInsight('pi-001');
    const growthAreas: GrowthWithCandidates[] = [
      {
        key: 'thinkingQuality:Error Loop',
        domainKey: 'thinkingQuality',
        growthTitle: 'Error Loop',
        candidates: [
          { insight, matchScore: 7.0, source: 'fallback' },
        ],
      },
    ];

    const result = deduplicateInsights(growthAreas);
    expect(result.get('thinkingQuality:Error Loop')).toEqual(insight);
  });

  it('should deduplicate same insight across multiple growth areas', () => {
    const insight = createInsight('pi-001');
    const growthAreas: GrowthWithCandidates[] = [
      {
        key: 'thinkingQuality:Error Loop',
        domainKey: 'thinkingQuality',
        growthTitle: 'Error Loop',
        candidates: [
          { insight, matchScore: 5.5, source: 'fallback' },
        ],
      },
      {
        key: 'learningBehavior:Knowledge Gap',
        domainKey: 'learningBehavior',
        growthTitle: 'Knowledge Gap',
        candidates: [
          { insight, matchScore: 7.5, source: 'fallback' },
        ],
      },
    ];

    const result = deduplicateInsights(growthAreas);

    // Insight should be allocated to higher score location only
    expect(result.get('learningBehavior:Knowledge Gap')).toEqual(insight);
    expect(result.get('thinkingQuality:Error Loop')).toBeNull();
  });

  it('should prioritize LLM-referenced insights over fallbacks', () => {
    const insight = createInsight('pi-001');
    const growthAreas: GrowthWithCandidates[] = [
      {
        key: 'thinkingQuality:Error Loop',
        domainKey: 'thinkingQuality',
        growthTitle: 'Error Loop',
        candidates: [
          { insight, matchScore: LLM_REFERENCE_SCORE, source: 'llm' },
        ],
      },
      {
        key: 'learningBehavior:Knowledge Gap',
        domainKey: 'learningBehavior',
        growthTitle: 'Knowledge Gap',
        candidates: [
          { insight, matchScore: 9.5, source: 'fallback' }, // High score but still fallback
        ],
      },
    ];

    const result = deduplicateInsights(growthAreas);

    // LLM reference (score 10.0) should win over fallback (score 9.5)
    expect(result.get('thinkingQuality:Error Loop')).toEqual(insight);
    expect(result.get('learningBehavior:Knowledge Gap')).toBeNull();
  });

  it('should limit total fallback insights across entire report', () => {
    const insight1 = createInsight('pi-001');
    const insight2 = createInsight('pi-002');
    const growthAreas: GrowthWithCandidates[] = [
      {
        key: 'thinkingQuality:Error Loop',
        domainKey: 'thinkingQuality',
        growthTitle: 'Error Loop',
        candidates: [
          { insight: insight1, matchScore: 7.0, source: 'fallback' },
        ],
      },
      {
        key: 'learningBehavior:Knowledge Gap',
        domainKey: 'learningBehavior',
        growthTitle: 'Knowledge Gap',
        candidates: [
          { insight: insight2, matchScore: 6.0, source: 'fallback' },
        ],
      },
    ];

    const result = deduplicateInsights(growthAreas);

    // Only highest-scoring fallback should be allocated (MAX_FALLBACK_TOTAL = 1)
    expect(result.get('thinkingQuality:Error Loop')).toEqual(insight1); // Higher score
    expect(result.get('learningBehavior:Knowledge Gap')).toBeNull(); // Exceeds total limit
  });

  it('should return null for growth areas with no candidates', () => {
    const insight = createInsight('pi-001');
    const growthAreas: GrowthWithCandidates[] = [
      {
        key: 'thinkingQuality:Error Loop',
        domainKey: 'thinkingQuality',
        growthTitle: 'Error Loop',
        candidates: [
          { insight, matchScore: 7.0, source: 'fallback' },
        ],
      },
      {
        key: 'learningBehavior:Knowledge Gap',
        domainKey: 'learningBehavior',
        growthTitle: 'Knowledge Gap',
        candidates: [], // No candidates
      },
    ];

    const result = deduplicateInsights(growthAreas);

    expect(result.get('thinkingQuality:Error Loop')).toEqual(insight);
    expect(result.get('learningBehavior:Knowledge Gap')).toBeNull();
  });

  it('should handle multiple candidates per growth area', () => {
    const insight1 = createInsight('pi-001');
    const insight2 = createInsight('pi-002');
    const growthAreas: GrowthWithCandidates[] = [
      {
        key: 'thinkingQuality:Error Loop',
        domainKey: 'thinkingQuality',
        growthTitle: 'Error Loop',
        candidates: [
          { insight: insight1, matchScore: 5.0, source: 'fallback' },
          { insight: insight2, matchScore: 8.0, source: 'fallback' },
        ],
      },
    ];

    const result = deduplicateInsights(growthAreas);

    // Higher score candidate should be allocated
    expect(result.get('thinkingQuality:Error Loop')).toEqual(insight2);
  });

  it('should NOT limit LLM-referenced insights (unlimited)', () => {
    const insight1 = createInsight('pi-001');
    const insight2 = createInsight('pi-002');
    const insight3 = createInsight('pi-003');
    const growthAreas: GrowthWithCandidates[] = [
      {
        key: 'thinkingQuality:Error Loop',
        domainKey: 'thinkingQuality',
        growthTitle: 'Error Loop',
        candidates: [
          { insight: insight1, matchScore: LLM_REFERENCE_SCORE, source: 'llm' },
        ],
      },
      {
        key: 'learningBehavior:Knowledge Gap',
        domainKey: 'learningBehavior',
        growthTitle: 'Knowledge Gap',
        candidates: [
          { insight: insight2, matchScore: LLM_REFERENCE_SCORE, source: 'llm' },
        ],
      },
      {
        key: 'contextEfficiency:Missing Context',
        domainKey: 'contextEfficiency',
        growthTitle: 'Missing Context',
        candidates: [
          { insight: insight3, matchScore: LLM_REFERENCE_SCORE, source: 'llm' },
        ],
      },
    ];

    const result = deduplicateInsights(growthAreas);

    // All LLM-referenced insights should be allocated (no limit)
    expect(result.get('thinkingQuality:Error Loop')).toEqual(insight1);
    expect(result.get('learningBehavior:Knowledge Gap')).toEqual(insight2);
    expect(result.get('contextEfficiency:Missing Context')).toEqual(insight3);
  });

  it('should allow LLM references alongside one fallback', () => {
    const llmInsight = createInsight('pi-001');
    const fallbackInsight1 = createInsight('pi-002');
    const fallbackInsight2 = createInsight('pi-003');
    const growthAreas: GrowthWithCandidates[] = [
      {
        key: 'thinkingQuality:Error Loop',
        domainKey: 'thinkingQuality',
        growthTitle: 'Error Loop',
        candidates: [
          { insight: llmInsight, matchScore: LLM_REFERENCE_SCORE, source: 'llm' },
        ],
      },
      {
        key: 'learningBehavior:Knowledge Gap',
        domainKey: 'learningBehavior',
        growthTitle: 'Knowledge Gap',
        candidates: [
          { insight: fallbackInsight1, matchScore: 8.0, source: 'fallback' },
        ],
      },
      {
        key: 'contextEfficiency:Missing Context',
        domainKey: 'contextEfficiency',
        growthTitle: 'Missing Context',
        candidates: [
          { insight: fallbackInsight2, matchScore: 6.0, source: 'fallback' },
        ],
      },
    ];

    const result = deduplicateInsights(growthAreas);

    // LLM reference: always allocated
    expect(result.get('thinkingQuality:Error Loop')).toEqual(llmInsight);
    // Highest-scoring fallback: allocated (within MAX_FALLBACK_TOTAL)
    expect(result.get('learningBehavior:Knowledge Gap')).toEqual(fallbackInsight1);
    // Lower-scoring fallback: not allocated (exceeds MAX_FALLBACK_TOTAL)
    expect(result.get('contextEfficiency:Missing Context')).toBeNull();
  });
});

describe('filterFallbackInsights', () => {
  it('should return empty array for undefined input', () => {
    const result = filterFallbackInsights(undefined);
    expect(result).toEqual([]);
  });

  it('should return empty array for empty input', () => {
    const result = filterFallbackInsights([]);
    expect(result).toEqual([]);
  });

  it('should filter by threshold', () => {
    const insights: MatchedProfessionalInsight[] = [
      createMatchedInsight('pi-001', 4.0),
      createMatchedInsight('pi-002', 6.0),
      createMatchedInsight('pi-003', 3.0),
    ];

    const result = filterFallbackInsights(insights, 5.0);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('pi-002');
  });

  it('should limit results', () => {
    const insights: MatchedProfessionalInsight[] = [
      createMatchedInsight('pi-001', 7.0),
      createMatchedInsight('pi-002', 8.0),
      createMatchedInsight('pi-003', 6.0),
    ];

    const result = filterFallbackInsights(insights, 5.0, 2);

    expect(result).toHaveLength(2);
    // Should be sorted by matchScore descending
    expect(result[0].id).toBe('pi-002');
    expect(result[1].id).toBe('pi-001');
  });

  it('should use default threshold and limit', () => {
    const insights: MatchedProfessionalInsight[] = [
      createMatchedInsight('pi-001', FALLBACK_THRESHOLD - 0.1), // Below threshold
      createMatchedInsight('pi-002', FALLBACK_THRESHOLD + 1.0), // Above threshold
      createMatchedInsight('pi-003', FALLBACK_THRESHOLD + 2.0), // Above threshold (higher)
    ];

    const result = filterFallbackInsights(insights);

    // Default limit is 1
    expect(result).toHaveLength(MAX_FALLBACK_PER_GROWTH);
    expect(result[0].id).toBe('pi-003'); // Highest score
  });
});

describe('createGrowthKey', () => {
  it('should create composite key from domain and title', () => {
    const key = createGrowthKey('thinkingQuality', 'Error Loop Pattern');
    expect(key).toBe('thinkingQuality:Error Loop Pattern');
  });

  it('should handle empty strings', () => {
    const key = createGrowthKey('', '');
    expect(key).toBe(':');
  });

  it('should handle titles with colons', () => {
    const key = createGrowthKey('learningBehavior', 'Issue: Missing Verification');
    expect(key).toBe('learningBehavior:Issue: Missing Verification');
  });
});

describe('constants', () => {
  it('should have LLM_REFERENCE_SCORE as highest priority', () => {
    expect(LLM_REFERENCE_SCORE).toBe(10.0);
  });

  it('should have reasonable FALLBACK_THRESHOLD', () => {
    expect(FALLBACK_THRESHOLD).toBe(5.0);
    expect(FALLBACK_THRESHOLD).toBeGreaterThan(0);
    expect(FALLBACK_THRESHOLD).toBeLessThan(LLM_REFERENCE_SCORE);
  });

  it('should have MAX_FALLBACK_PER_GROWTH as 1', () => {
    expect(MAX_FALLBACK_PER_GROWTH).toBe(1);
  });

  it('should have MAX_FALLBACK_TOTAL as 1', () => {
    expect(MAX_FALLBACK_TOTAL).toBe(1);
  });
});
