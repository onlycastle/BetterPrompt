import { describe, it, expect } from 'vitest';
import {
  RelevanceDimensionSchema,
  RecommendationSchema,
  RelevanceAssessmentSchema,
  InfluencerMatchInfoSchema,
  JudgmentResultSchema,
  JudgmentStatsSchema,
  DEFAULT_DIMENSION_WEIGHTS,
  RELEVANCE_THRESHOLDS,
} from '../../../../src/lib/search-agent/models/relevance.js';

describe('Relevance Models', () => {
  describe('RelevanceDimensionSchema', () => {
    it('should validate valid dimension', () => {
      const dimension = {
        score: 0.85,
        weight: 0.25,
        reasoning: 'This content is highly relevant to the topic',
      };

      const result = RelevanceDimensionSchema.safeParse(dimension);
      expect(result.success).toBe(true);
    });

    it('should reject score out of range', () => {
      const dimension = {
        score: 1.5,
        weight: 0.25,
        reasoning: 'Valid reasoning',
      };

      const result = RelevanceDimensionSchema.safeParse(dimension);
      expect(result.success).toBe(false);
    });

    it('should reject weight out of range', () => {
      const dimension = {
        score: 0.5,
        weight: 1.5,
        reasoning: 'Valid reasoning',
      };

      const result = RelevanceDimensionSchema.safeParse(dimension);
      expect(result.success).toBe(false);
    });

    it('should reject reasoning that is too long', () => {
      const dimension = {
        score: 0.5,
        weight: 0.5,
        reasoning: 'A'.repeat(3001),
      };

      const result = RelevanceDimensionSchema.safeParse(dimension);
      expect(result.success).toBe(false);
    });
  });

  describe('RecommendationSchema', () => {
    it('should accept valid recommendations', () => {
      expect(RecommendationSchema.parse('accept')).toBe('accept');
      expect(RecommendationSchema.parse('review')).toBe('review');
      expect(RecommendationSchema.parse('reject')).toBe('reject');
    });

    it('should reject invalid recommendations', () => {
      expect(() => RecommendationSchema.parse('maybe')).toThrow();
      expect(() => RecommendationSchema.parse('')).toThrow();
    });
  });

  describe('RelevanceAssessmentSchema', () => {
    const validDimension = {
      score: 0.8,
      weight: 0.2,
      reasoning: 'Good reasoning for this dimension',
    };

    const validAssessment = {
      topicRelevance: validDimension,
      projectFit: validDimension,
      actionability: validDimension,
      novelty: validDimension,
      credibility: validDimension,
      overallScore: 0.8,
      confidence: 0.9,
      recommendation: 'accept',
      reasoning: 'This content meets all criteria and should be included in the knowledge base. '.repeat(2),
    };

    it('should validate complete assessment', () => {
      const result = RelevanceAssessmentSchema.safeParse(validAssessment);
      expect(result.success).toBe(true);
    });

    it('should reject missing dimensions', () => {
      const { topicRelevance, ...incomplete } = validAssessment;
      const result = RelevanceAssessmentSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('should reject reasoning that is too short', () => {
      const invalid = { ...validAssessment, reasoning: 'Too short' };
      const result = RelevanceAssessmentSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject reasoning that is too long', () => {
      const invalid = { ...validAssessment, reasoning: 'A'.repeat(501) };
      const result = RelevanceAssessmentSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('InfluencerMatchInfoSchema', () => {
    it('should validate complete influencer match', () => {
      const match = {
        influencerId: '123e4567-e89b-12d3-a456-426614174000',
        influencerName: 'Test Influencer',
        credibilityTier: 'high',
        boostApplied: 0.2,
      };

      const result = InfluencerMatchInfoSchema.safeParse(match);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const match = {
        influencerId: 'not-a-uuid',
        influencerName: 'Test',
        credibilityTier: 'high',
        boostApplied: 0.2,
      };

      const result = InfluencerMatchInfoSchema.safeParse(match);
      expect(result.success).toBe(false);
    });

    it('should reject invalid credibility tier', () => {
      const match = {
        influencerId: '123e4567-e89b-12d3-a456-426614174000',
        influencerName: 'Test',
        credibilityTier: 'legendary',
        boostApplied: 0.2,
      };

      const result = InfluencerMatchInfoSchema.safeParse(match);
      expect(result.success).toBe(false);
    });

    it('should reject boost out of range', () => {
      const match = {
        influencerId: '123e4567-e89b-12d3-a456-426614174000',
        influencerName: 'Test',
        credibilityTier: 'high',
        boostApplied: 0.6, // Max is 0.5
      };

      const result = InfluencerMatchInfoSchema.safeParse(match);
      expect(result.success).toBe(false);
    });
  });

  describe('JudgmentResultSchema', () => {
    const validDimension = {
      score: 0.8,
      weight: 0.2,
      reasoning: 'Good reasoning for this dimension',
    };

    const validAssessment = {
      topicRelevance: validDimension,
      projectFit: validDimension,
      actionability: validDimension,
      novelty: validDimension,
      credibility: validDimension,
      overallScore: 0.8,
      confidence: 0.9,
      recommendation: 'accept',
      reasoning: 'This content meets all criteria and should be included in the knowledge base. '.repeat(2),
    };

    it('should validate complete judgment result', () => {
      const judgment = {
        sourceUrl: 'https://example.com/article',
        assessment: validAssessment,
        suggestedCategory: 'context-engineering',
        suggestedTags: ['AI', 'context', 'engineering'],
        extractedInsights: [
          'Context engineering is crucial for AI performance',
          'Always provide clear examples',
        ],
        judgedAt: '2024-01-01T00:00:00.000Z',
      };

      const result = JudgmentResultSchema.safeParse(judgment);
      expect(result.success).toBe(true);
    });

    it('should accept optional influencer match', () => {
      const judgment = {
        sourceUrl: 'https://example.com/article',
        assessment: validAssessment,
        suggestedCategory: 'prompt-engineering',
        suggestedTags: ['prompts'],
        extractedInsights: ['Insight 1'],
        judgedAt: '2024-01-01T00:00:00.000Z',
        influencerMatch: {
          influencerId: '123e4567-e89b-12d3-a456-426614174000',
          influencerName: 'Expert Influencer',
          credibilityTier: 'high',
          boostApplied: 0.15,
        },
      };

      const result = JudgmentResultSchema.safeParse(judgment);
      expect(result.success).toBe(true);
    });

    it('should reject too many extracted insights', () => {
      const judgment = {
        sourceUrl: 'https://example.com/article',
        assessment: validAssessment,
        suggestedCategory: 'context-engineering',
        suggestedTags: ['tag'],
        extractedInsights: Array(6).fill('Insight'),
        judgedAt: '2024-01-01T00:00:00.000Z',
      };

      const result = JudgmentResultSchema.safeParse(judgment);
      expect(result.success).toBe(false);
    });
  });

  describe('JudgmentStatsSchema', () => {
    it('should validate complete stats', () => {
      const stats = {
        totalJudged: 100,
        acceptRate: 0.65,
        avgScore: 0.72,
        categoryDistribution: {
          'context-engineering': 25,
          'prompt-engineering': 20,
          'tool-use': 15,
          other: 40,
        },
      };

      const result = JudgmentStatsSchema.safeParse(stats);
      expect(result.success).toBe(true);
    });

    it('should reject rates out of range', () => {
      const stats = {
        totalJudged: 100,
        acceptRate: 1.5, // Should be 0-1
        avgScore: 0.72,
        categoryDistribution: {},
      };

      const result = JudgmentStatsSchema.safeParse(stats);
      expect(result.success).toBe(false);
    });
  });

  describe('Constants', () => {
    describe('DEFAULT_DIMENSION_WEIGHTS', () => {
      it('should have all required dimensions', () => {
        const requiredDimensions = [
          'topicRelevance',
          'projectFit',
          'actionability',
          'novelty',
          'credibility',
        ];

        for (const dimension of requiredDimensions) {
          expect(DEFAULT_DIMENSION_WEIGHTS[dimension]).toBeDefined();
          expect(DEFAULT_DIMENSION_WEIGHTS[dimension]).toBeGreaterThan(0);
          expect(DEFAULT_DIMENSION_WEIGHTS[dimension]).toBeLessThanOrEqual(1);
        }
      });

      it('should sum to approximately 1', () => {
        const sum = Object.values(DEFAULT_DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1, 2);
      });
    });

    describe('RELEVANCE_THRESHOLDS', () => {
      it('should have correct ordering', () => {
        expect(RELEVANCE_THRESHOLDS.accept).toBeGreaterThan(RELEVANCE_THRESHOLDS.review);
        expect(RELEVANCE_THRESHOLDS.review).toBeGreaterThan(RELEVANCE_THRESHOLDS.reject);
      });

      it('should have accept at 0.7', () => {
        expect(RELEVANCE_THRESHOLDS.accept).toBe(0.7);
      });

      it('should have review at 0.4', () => {
        expect(RELEVANCE_THRESHOLDS.review).toBe(0.4);
      });

      it('should have reject at 0', () => {
        expect(RELEVANCE_THRESHOLDS.reject).toBe(0);
      });
    });
  });
});
