import { describe, it, expect } from 'vitest';
import {
  TopicCategorySchema,
  DimensionNameSchema,
  ContentTypeSchema,
  SourcePlatformSchema,
  KnowledgeSourceSchema,
  KnowledgeRelevanceSchema,
  KnowledgeStatusSchema,
  KnowledgeItemSchema,
  InsightCategorySchema,
  ProfessionalInsightSchema,
  DEFAULT_SEARCH_TOPICS,
  TOPIC_DISPLAY_NAMES,
  TOPIC_TO_DIMENSION_MAP,
  // Note: INITIAL_INSIGHTS removed - now in database (see supabase/migrations/018_seed_professional_insights.sql)
} from '../../../../src/lib/search-agent/models/knowledge.js';

describe('Knowledge Models', () => {
  describe('TopicCategorySchema', () => {
    it('should accept valid topic categories', () => {
      const validCategories = [
        'context-engineering',
        'claude-code-skills',
        'subagents',
        'memory-management',
        'prompt-engineering',
        'tool-use',
        'workflow-automation',
        'best-practices',
        'other',
      ];

      for (const category of validCategories) {
        expect(TopicCategorySchema.parse(category)).toBe(category);
      }
    });

    it('should reject invalid categories', () => {
      expect(() => TopicCategorySchema.parse('invalid-category')).toThrow();
      expect(() => TopicCategorySchema.parse('')).toThrow();
    });
  });

  describe('DimensionNameSchema', () => {
    it('should accept all valid dimension names', () => {
      const validDimensions = [
        'aiCollaboration',
        'contextEngineering',
        'toolMastery',
        'burnoutRisk',
        'aiControl',
        'skillResilience',
      ];

      for (const dimension of validDimensions) {
        expect(DimensionNameSchema.parse(dimension)).toBe(dimension);
      }
    });

    it('should reject invalid dimension names', () => {
      expect(() => DimensionNameSchema.parse('invalidDimension')).toThrow();
      expect(() => DimensionNameSchema.parse('')).toThrow();
    });
  });

  describe('TOPIC_TO_DIMENSION_MAP', () => {
    it('should map all topic categories to dimensions', () => {
      const categories = TopicCategorySchema.options;
      for (const category of categories) {
        expect(TOPIC_TO_DIMENSION_MAP[category]).toBeDefined();
        // Verify the mapped dimension is valid
        expect(DimensionNameSchema.parse(TOPIC_TO_DIMENSION_MAP[category])).toBe(
          TOPIC_TO_DIMENSION_MAP[category]
        );
      }
    });
  });

  describe('ContentTypeSchema', () => {
    it('should accept valid content types', () => {
      const validTypes = [
        'technique',
        'pattern',
        'tool',
        'configuration',
        'insight',
        'example',
        'reference',
      ];

      for (const type of validTypes) {
        expect(ContentTypeSchema.parse(type)).toBe(type);
      }
    });

    it('should reject invalid content types', () => {
      expect(() => ContentTypeSchema.parse('blog-post')).toThrow();
    });
  });

  describe('SourcePlatformSchema', () => {
    it('should accept valid platforms', () => {
      const validPlatforms = [
        'reddit',
        'twitter',
        'threads',
        'web',
        'manual',
        'youtube',
        'linkedin',
      ];

      for (const platform of validPlatforms) {
        expect(SourcePlatformSchema.parse(platform)).toBe(platform);
      }
    });
  });

  describe('KnowledgeSourceSchema', () => {
    it('should validate complete source', () => {
      const source = {
        platform: 'twitter',
        url: 'https://twitter.com/user/status/123',
        author: 'Test Author',
        authorHandle: '@testauthor',
        publishedAt: '2024-01-01T00:00:00.000Z',
        fetchedAt: '2024-01-02T00:00:00.000Z',
        influencerId: '123e4567-e89b-12d3-a456-426614174000',
        credibilityTier: 'high',
      };

      const result = KnowledgeSourceSchema.safeParse(source);
      expect(result.success).toBe(true);
    });

    it('should validate minimal source (only required fields)', () => {
      const source = {
        platform: 'web',
        url: 'https://example.com/article',
        fetchedAt: '2024-01-01T00:00:00.000Z',
      };

      const result = KnowledgeSourceSchema.safeParse(source);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const source = {
        platform: 'web',
        url: 'not-a-valid-url',
        fetchedAt: '2024-01-01T00:00:00.000Z',
      };

      const result = KnowledgeSourceSchema.safeParse(source);
      expect(result.success).toBe(false);
    });

    it('should reject invalid datetime format', () => {
      const source = {
        platform: 'web',
        url: 'https://example.com',
        fetchedAt: 'invalid-date',
      };

      const result = KnowledgeSourceSchema.safeParse(source);
      expect(result.success).toBe(false);
    });
  });

  describe('KnowledgeRelevanceSchema', () => {
    it('should validate valid relevance scores', () => {
      const relevance = {
        score: 0.85,
        confidence: 0.9,
        reasoning: 'This content is highly relevant to AI development practices',
      };

      const result = KnowledgeRelevanceSchema.safeParse(relevance);
      expect(result.success).toBe(true);
    });

    it('should reject score out of range', () => {
      const relevance = {
        score: 1.5,
        confidence: 0.9,
        reasoning: 'Valid reasoning',
      };

      const result = KnowledgeRelevanceSchema.safeParse(relevance);
      expect(result.success).toBe(false);
    });

    it('should reject reasoning that is too long', () => {
      const relevance = {
        score: 0.5,
        confidence: 0.5,
        reasoning: 'A'.repeat(501),
      };

      const result = KnowledgeRelevanceSchema.safeParse(relevance);
      expect(result.success).toBe(false);
    });
  });

  describe('KnowledgeStatusSchema', () => {
    it('should accept valid statuses', () => {
      const validStatuses = ['draft', 'reviewed', 'approved', 'archived'];

      for (const status of validStatuses) {
        expect(KnowledgeStatusSchema.parse(status)).toBe(status);
      }
    });
  });

  describe('KnowledgeItemSchema', () => {
    const validKnowledgeItem = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      version: '1.0.0' as const,
      title: 'How to Effectively Use Context Engineering',
      summary: 'A comprehensive guide to understanding and implementing context engineering techniques for AI-assisted development workflows'.padEnd(100, '.'),
      content: 'Full detailed content about context engineering...'.padEnd(200, '.'),
      // New: dimension-based classification
      applicableDimensions: ['contextEngineering'],
      subCategories: { contextEngineering: ['context window', 'token optimization'] },
      // Legacy: category (optional now)
      category: 'context-engineering',
      contentType: 'technique',
      tags: ['context', 'AI', 'development'],
      source: {
        platform: 'web',
        url: 'https://example.com/article',
        fetchedAt: '2024-01-01T00:00:00.000Z',
      },
      relevance: {
        score: 0.85,
        confidence: 0.9,
        reasoning: 'Highly relevant to AI development practices',
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      status: 'approved',
    };

    it('should validate complete knowledge item with dimensions', () => {
      const result = KnowledgeItemSchema.safeParse(validKnowledgeItem);
      expect(result.success).toBe(true);
    });

    it('should validate knowledge item without legacy category', () => {
      const withoutCategory = { ...validKnowledgeItem };
      delete (withoutCategory as Record<string, unknown>).category;
      const result = KnowledgeItemSchema.safeParse(withoutCategory);
      expect(result.success).toBe(true);
    });

    it('should reject title that is too short', () => {
      const invalid = { ...validKnowledgeItem, title: 'Short' };
      const result = KnowledgeItemSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject summary that is too short', () => {
      const invalid = { ...validKnowledgeItem, summary: 'Too short' };
      const result = KnowledgeItemSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject empty tags array', () => {
      const invalid = { ...validKnowledgeItem, tags: [] };
      const result = KnowledgeItemSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject too many tags', () => {
      const invalid = {
        ...validKnowledgeItem,
        tags: Array(11).fill('tag'),
      };
      const result = KnowledgeItemSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should accept optional related items', () => {
      const withRelated = {
        ...validKnowledgeItem,
        relatedItems: ['123e4567-e89b-12d3-a456-426614174001'],
        supersedes: '123e4567-e89b-12d3-a456-426614174002',
      };
      const result = KnowledgeItemSchema.safeParse(withRelated);
      expect(result.success).toBe(true);
    });
  });

  describe('InsightCategorySchema', () => {
    it('should accept valid insight categories', () => {
      const validCategories = ['diagnosis', 'trend', 'type-specific', 'tool'];

      for (const category of validCategories) {
        expect(InsightCategorySchema.parse(category)).toBe(category);
      }
    });
  });

  describe('ProfessionalInsightSchema', () => {
    it('should validate complete professional insight', () => {
      const insight = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        version: '1.0.0' as const,
        category: 'diagnosis',
        title: 'Understanding AI Dependency',
        keyTakeaway: 'Recognizing signs of over-reliance on AI tools is crucial for maintaining programming skills',
        actionableAdvice: [
          'Practice coding without AI assistance weekly',
          'Review and understand all AI-generated code',
        ],
        source: {
          type: 'research',
          url: 'https://example.com/research',
          author: 'Research Team',
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        priority: 8,
        enabled: true,
      };

      const result = ProfessionalInsightSchema.safeParse(insight);
      expect(result.success).toBe(true);
    });

    it('should accept optional applicability fields', () => {
      const insight = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        version: '1.0.0' as const,
        category: 'type-specific',
        title: 'Advice for Architects',
        keyTakeaway: 'Planning-focused developers can leverage their strength in AI collaboration',
        actionableAdvice: ['Validate AI output against your plans'],
        source: {
          type: 'blog',
          url: 'https://example.com/blog',
          author: 'Blog Author',
        },
        applicableStyles: ['architect', 'conductor'],
        applicableControlLevels: ['navigator', 'cartographer'],
        applicableDimensions: ['aiControl'],
        minScore: 30,
        maxScore: 70,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        priority: 5,
        enabled: true,
      };

      const result = ProfessionalInsightSchema.safeParse(insight);
      expect(result.success).toBe(true);
    });

    it('should reject priority out of range', () => {
      const insight = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        version: '1.0.0' as const,
        category: 'trend',
        title: 'Some Trend Title Here',
        keyTakeaway: 'Key takeaway for this trend that is at least 20 characters',
        actionableAdvice: ['Action 1'],
        source: {
          type: 'blog',
          url: 'https://example.com',
          author: 'Author',
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        priority: 15, // Out of range (1-10)
        enabled: true,
      };

      const result = ProfessionalInsightSchema.safeParse(insight);
      expect(result.success).toBe(false);
    });
  });

  describe('Constants', () => {
    describe('DEFAULT_SEARCH_TOPICS', () => {
      it('should contain expected topics', () => {
        expect(DEFAULT_SEARCH_TOPICS).toContain('context-engineering');
        expect(DEFAULT_SEARCH_TOPICS).toContain('claude-code-skills');
        expect(DEFAULT_SEARCH_TOPICS).toContain('prompt-engineering');
        expect(DEFAULT_SEARCH_TOPICS.length).toBeGreaterThan(5);
      });

      it('should not include "other"', () => {
        expect(DEFAULT_SEARCH_TOPICS).not.toContain('other');
      });
    });

    describe('TOPIC_DISPLAY_NAMES', () => {
      it('should have display names for all categories', () => {
        const categories = TopicCategorySchema.options;
        for (const category of categories) {
          expect(TOPIC_DISPLAY_NAMES[category]).toBeDefined();
          expect(typeof TOPIC_DISPLAY_NAMES[category]).toBe('string');
        }
      });
    });

    // Note: INITIAL_INSIGHTS tests removed - Professional Insights are now stored in database
    // See supabase/migrations/018_seed_professional_insights.sql for canonical data
  });
});
