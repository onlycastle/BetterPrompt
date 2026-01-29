/**
 * Evidence Verifier Tests
 *
 * Tests for Phase 2.8 Evidence Verification stage.
 * Covers prompt generation, response parsing, and filtering logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EVIDENCE_VERIFIER_SYSTEM_PROMPT,
  buildEvidenceVerifierUserPrompt,
  estimatePromptTokens,
  shouldSplitBatch,
  MAX_PAIRS_PER_BATCH,
} from '../../../../src/lib/analyzer/stages/evidence-verifier-prompts.js';
import {
  EvidenceVerificationResponseSchema,
  type EvidenceVerificationPair,
  type EvidenceVerificationResponse,
  DEFAULT_EVIDENCE_VERIFIER_CONFIG,
} from '../../../../src/lib/models/evidence-verification-data.js';

// ============================================================================
// System Prompt Tests
// ============================================================================

describe('EvidenceVerifierPrompts', () => {
  describe('EVIDENCE_VERIFIER_SYSTEM_PROMPT', () => {
    it('should contain scoring criteria', () => {
      expect(EVIDENCE_VERIFIER_SYSTEM_PROMPT).toContain('0-100');
      expect(EVIDENCE_VERIFIER_SYSTEM_PROMPT).toContain('80-100');
      expect(EVIDENCE_VERIFIER_SYSTEM_PROMPT).toContain('DIRECTLY demonstrates');
    });

    it('should contain strictness guidelines', () => {
      expect(EVIDENCE_VERIFIER_SYSTEM_PROMPT).toContain('Be Strict');
      expect(EVIDENCE_VERIFIER_SYSTEM_PROMPT).toContain('Avoid False Positives');
    });

    it('should specify JSON output format', () => {
      expect(EVIDENCE_VERIFIER_SYSTEM_PROMPT).toContain('results');
      expect(EVIDENCE_VERIFIER_SYSTEM_PROMPT).toContain('JSON');
    });
  });

  describe('buildEvidenceVerifierUserPrompt', () => {
    const samplePairs: EvidenceVerificationPair[] = [
      {
        pairId: 'trust_s_0',
        insightType: 'strength',
        workerDomain: 'trustVerification',
        insightTitle: 'Systematic Output Verification',
        insightDescription: 'You consistently verify AI outputs before accepting them.',
        evidenceQuote: 'Let me check if this handles edge cases correctly',
        utteranceId: 'session1_5',
        evidenceIndex: 0,
      },
      {
        pairId: 'trust_g_0',
        insightType: 'growth',
        workerDomain: 'trustVerification',
        insightTitle: 'Blind Approval Pattern',
        insightDescription: 'Tends to accept AI suggestions without verification.',
        evidenceQuote: 'Looks good, ship it',
        utteranceId: 'session2_3',
        evidenceIndex: 0,
      },
    ];

    it('should include all pair IDs', () => {
      const prompt = buildEvidenceVerifierUserPrompt(samplePairs);
      expect(prompt).toContain('trust_s_0');
      expect(prompt).toContain('trust_g_0');
    });

    it('should include insight titles', () => {
      const prompt = buildEvidenceVerifierUserPrompt(samplePairs);
      expect(prompt).toContain('Systematic Output Verification');
      expect(prompt).toContain('Blind Approval Pattern');
    });

    it('should include evidence quotes', () => {
      const prompt = buildEvidenceVerifierUserPrompt(samplePairs);
      expect(prompt).toContain('edge cases');
      expect(prompt).toContain('ship it');
    });

    it('should indicate total pair count', () => {
      const prompt = buildEvidenceVerifierUserPrompt(samplePairs);
      expect(prompt).toContain('2 total');
    });

    it('should handle empty array', () => {
      const prompt = buildEvidenceVerifierUserPrompt([]);
      expect(prompt).toContain('0 total');
      expect(prompt).toContain('[]');
    });

    it('should truncate long descriptions', () => {
      const longPair: EvidenceVerificationPair = {
        pairId: 'test_0',
        insightType: 'strength',
        workerDomain: 'workflowHabit',
        insightTitle: 'Test',
        insightDescription: 'A'.repeat(500), // Very long description
        evidenceQuote: 'test quote',
        evidenceIndex: 0,
      };
      const prompt = buildEvidenceVerifierUserPrompt([longPair]);
      // Should be truncated to 200 chars with ellipsis
      expect(prompt.length).toBeLessThan(1000);
      expect(prompt).toContain('...');
    });
  });

  describe('estimatePromptTokens', () => {
    it('should return reasonable token estimate', () => {
      const pairs: EvidenceVerificationPair[] = [
        {
          pairId: 'test_0',
          insightType: 'strength',
          workerDomain: 'trustVerification',
          insightTitle: 'Test Title',
          insightDescription: 'Test description.',
          evidenceQuote: 'Test quote',
          evidenceIndex: 0,
        },
      ];
      const tokens = estimatePromptTokens(pairs);
      expect(tokens).toBeGreaterThan(100); // System prompt alone is substantial
      expect(tokens).toBeLessThan(5000); // Should not be excessive for 1 pair
    });

    it('should increase with more pairs', () => {
      const onePair: EvidenceVerificationPair[] = [{
        pairId: 'test_0',
        insightType: 'strength',
        workerDomain: 'trustVerification',
        insightTitle: 'Test',
        insightDescription: 'Description',
        evidenceQuote: 'Quote',
        evidenceIndex: 0,
      }];
      const fivePairs = Array.from({ length: 5 }, (_, i) => ({
        ...onePair[0],
        pairId: `test_${i}`,
      }));

      const oneToken = estimatePromptTokens(onePair);
      const fiveTokens = estimatePromptTokens(fivePairs);

      expect(fiveTokens).toBeGreaterThan(oneToken);
    });
  });

  describe('shouldSplitBatch', () => {
    it('should return false for small batches', () => {
      const pairs = Array.from({ length: 10 }, (_, i) => ({
        pairId: `test_${i}`,
        insightType: 'strength' as const,
        workerDomain: 'trustVerification',
        insightTitle: 'Test',
        insightDescription: 'Desc',
        evidenceQuote: 'Quote',
        evidenceIndex: i,
      }));
      expect(shouldSplitBatch(pairs)).toBe(false);
    });

    it('should return true for large batches', () => {
      const pairs = Array.from({ length: MAX_PAIRS_PER_BATCH + 1 }, (_, i) => ({
        pairId: `test_${i}`,
        insightType: 'strength' as const,
        workerDomain: 'trustVerification',
        insightTitle: 'Test',
        insightDescription: 'Desc',
        evidenceQuote: 'Quote',
        evidenceIndex: i,
      }));
      expect(shouldSplitBatch(pairs)).toBe(true);
    });

    it('should return false at exact limit', () => {
      const pairs = Array.from({ length: MAX_PAIRS_PER_BATCH }, (_, i) => ({
        pairId: `test_${i}`,
        insightType: 'strength' as const,
        workerDomain: 'trustVerification',
        insightTitle: 'Test',
        insightDescription: 'Desc',
        evidenceQuote: 'Quote',
        evidenceIndex: i,
      }));
      expect(shouldSplitBatch(pairs)).toBe(false);
    });
  });
});

// ============================================================================
// Response Schema Tests
// ============================================================================

describe('EvidenceVerificationResponseSchema', () => {
  it('should parse valid response', () => {
    const validResponse = {
      results: [
        {
          pairId: 'trust_s_0',
          relevanceScore: 85,
          reasoning: 'Quote directly shows verification behavior.',
        },
        {
          pairId: 'trust_g_0',
          relevanceScore: 25,
          reasoning: 'Quote is too generic, no clear connection to insight.',
        },
      ],
    };

    const result = EvidenceVerificationResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results).toHaveLength(2);
      expect(result.data.results[0].relevanceScore).toBe(85);
    }
  });

  it('should reject score outside 0-100', () => {
    const invalidResponse = {
      results: [
        {
          pairId: 'test',
          relevanceScore: 150, // Invalid
          reasoning: 'Test',
        },
      ],
    };

    const result = EvidenceVerificationResponseSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });

  it('should reject negative scores', () => {
    const invalidResponse = {
      results: [
        {
          pairId: 'test',
          relevanceScore: -10, // Invalid
          reasoning: 'Test',
        },
      ],
    };

    const result = EvidenceVerificationResponseSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });

  it('should allow empty results array', () => {
    const emptyResponse = { results: [] };
    const result = EvidenceVerificationResponseSchema.safeParse(emptyResponse);
    expect(result.success).toBe(true);
  });

  it('should reject missing pairId', () => {
    const invalidResponse = {
      results: [
        {
          relevanceScore: 50,
          reasoning: 'Test',
        },
      ],
    };

    const result = EvidenceVerificationResponseSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Default Config Tests
// ============================================================================

describe('DEFAULT_EVIDENCE_VERIFIER_CONFIG', () => {
  it('should have threshold of 50', () => {
    expect(DEFAULT_EVIDENCE_VERIFIER_CONFIG.threshold).toBe(50);
  });

  it('should use gemini-3-flash-preview model', () => {
    expect(DEFAULT_EVIDENCE_VERIFIER_CONFIG.model).toBe('gemini-3-flash-preview');
  });

  it('should have lower temperature for consistency', () => {
    expect(DEFAULT_EVIDENCE_VERIFIER_CONFIG.temperature).toBeLessThan(1.0);
  });

  it('should have max retries', () => {
    expect(DEFAULT_EVIDENCE_VERIFIER_CONFIG.maxRetries).toBeGreaterThan(0);
  });
});

// ============================================================================
// Filtering Logic Tests
// ============================================================================

describe('Evidence Filtering Logic', () => {
  const threshold = 50;

  function shouldKeep(score: number): boolean {
    return score >= threshold;
  }

  it('should keep evidence with score >= 50', () => {
    expect(shouldKeep(50)).toBe(true);
    expect(shouldKeep(75)).toBe(true);
    expect(shouldKeep(100)).toBe(true);
  });

  it('should filter evidence with score < 50', () => {
    expect(shouldKeep(49)).toBe(false);
    expect(shouldKeep(25)).toBe(false);
    expect(shouldKeep(0)).toBe(false);
  });

  it('should handle boundary cases', () => {
    expect(shouldKeep(50)).toBe(true);  // Exactly at threshold
    expect(shouldKeep(49.9)).toBe(false); // Just below (if using integers, this wouldn't happen)
    expect(shouldKeep(50.1)).toBe(true); // Just above
  });
});

// ============================================================================
// Statistics Computation Tests
// ============================================================================

describe('Statistics Computation', () => {
  interface MockResult {
    pairId: string;
    relevanceScore: number;
    shouldKeep: boolean;
  }

  function computeStats(
    pairs: EvidenceVerificationPair[],
    results: MockResult[]
  ) {
    const total = pairs.length;
    const kept = results.filter(r => r.shouldKeep).length;
    const filtered = total - kept;
    const avgScore = results.length > 0
      ? results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length
      : 0;

    return { total, kept, filtered, avgScore };
  }

  it('should compute correct totals', () => {
    const pairs: EvidenceVerificationPair[] = Array.from({ length: 5 }, (_, i) => ({
      pairId: `test_${i}`,
      insightType: 'strength' as const,
      workerDomain: 'trustVerification',
      insightTitle: 'Test',
      insightDescription: 'Desc',
      evidenceQuote: 'Quote',
      evidenceIndex: i,
    }));

    const results: MockResult[] = [
      { pairId: 'test_0', relevanceScore: 80, shouldKeep: true },
      { pairId: 'test_1', relevanceScore: 60, shouldKeep: true },
      { pairId: 'test_2', relevanceScore: 40, shouldKeep: false },
      { pairId: 'test_3', relevanceScore: 20, shouldKeep: false },
      { pairId: 'test_4', relevanceScore: 90, shouldKeep: true },
    ];

    const stats = computeStats(pairs, results);

    expect(stats.total).toBe(5);
    expect(stats.kept).toBe(3);
    expect(stats.filtered).toBe(2);
    expect(stats.avgScore).toBe(58); // (80+60+40+20+90)/5
  });

  it('should handle empty results', () => {
    const stats = computeStats([], []);
    expect(stats.total).toBe(0);
    expect(stats.kept).toBe(0);
    expect(stats.filtered).toBe(0);
    expect(stats.avgScore).toBe(0);
  });

  it('should handle all kept', () => {
    const pairs: EvidenceVerificationPair[] = Array.from({ length: 3 }, (_, i) => ({
      pairId: `test_${i}`,
      insightType: 'strength' as const,
      workerDomain: 'trustVerification',
      insightTitle: 'Test',
      insightDescription: 'Desc',
      evidenceQuote: 'Quote',
      evidenceIndex: i,
    }));

    const results: MockResult[] = [
      { pairId: 'test_0', relevanceScore: 100, shouldKeep: true },
      { pairId: 'test_1', relevanceScore: 80, shouldKeep: true },
      { pairId: 'test_2', relevanceScore: 60, shouldKeep: true },
    ];

    const stats = computeStats(pairs, results);
    expect(stats.kept).toBe(3);
    expect(stats.filtered).toBe(0);
  });

  it('should handle all filtered', () => {
    const pairs: EvidenceVerificationPair[] = Array.from({ length: 3 }, (_, i) => ({
      pairId: `test_${i}`,
      insightType: 'growth' as const,
      workerDomain: 'workflowHabit',
      insightTitle: 'Test',
      insightDescription: 'Desc',
      evidenceQuote: 'Quote',
      evidenceIndex: i,
    }));

    const results: MockResult[] = [
      { pairId: 'test_0', relevanceScore: 10, shouldKeep: false },
      { pairId: 'test_1', relevanceScore: 20, shouldKeep: false },
      { pairId: 'test_2', relevanceScore: 30, shouldKeep: false },
    ];

    const stats = computeStats(pairs, results);
    expect(stats.kept).toBe(0);
    expect(stats.filtered).toBe(3);
  });
});
