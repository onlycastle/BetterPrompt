import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, err } from '../../../../src/lib/result.js';
import { StorageError, SkillError } from '../../../../src/lib/domain/errors/index.js';
import { createKnowledgeService } from '../../../../src/lib/application/services/knowledge-service.js';
import type { IKnowledgeRepository, IInfluencerRepository, PaginatedResult } from '../../../../src/lib/application/ports/storage.js';
import type { ILLMPort } from '../../../../src/lib/application/ports/llm.js';
import type { KnowledgeItem, KnowledgeStats, Influencer } from '../../../../src/lib/domain/models/index.js';

// Mock KnowledgeItem factory
function createMockKnowledgeItem(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return {
    id: 'test-knowledge-id',
    version: '1.0.0',
    title: 'Test Knowledge Item',
    summary: 'A test summary for the knowledge item',
    content: 'Full content of the knowledge item goes here...',
    category: 'prompting',
    contentType: 'insight',
    tags: ['AI', 'testing'],
    source: {
      url: 'https://example.com/article',
      platform: 'web',
      author: 'Test Author',
      fetchedAt: '2024-01-01T00:00:00.000Z',
    },
    relevance: {
      score: 0.85,
      confidence: 0.9,
      reasoning: 'Highly relevant to AI development',
    },
    status: 'approved',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Mock repository factory
function createMockKnowledgeRepo(): IKnowledgeRepository {
  return {
    save: vi.fn(),
    saveBatch: vi.fn(),
    findById: vi.fn(),
    search: vi.fn(),
    fullTextSearch: vi.fn(),
    getStats: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
    existsByUrl: vi.fn(),
    findSimilar: vi.fn(),
  };
}

function createMockInfluencerRepo(): IInfluencerRepository {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByHandle: vi.fn(),
    findAll: vi.fn(),
    findActive: vi.fn(),
    findByTier: vi.fn(),
    update: vi.fn(),
    incrementContentCount: vi.fn(),
    delete: vi.fn(),
    matchFromContent: vi.fn(),
  };
}

function createMockLLM(): ILLMPort {
  return {
    isAvailable: vi.fn(() => true),
    getModel: vi.fn(() => 'claude-sonnet-4-20250514'),
    evaluateSession: vi.fn(),
    detectCodingStyle: vi.fn(),
    calculateDimensions: vi.fn(),
    extractKnowledge: vi.fn(),
    scoreRelevance: vi.fn(),
  };
}

describe('KnowledgeService', () => {
  let mockKnowledgeRepo: IKnowledgeRepository;
  let mockInfluencerRepo: IInfluencerRepository;
  let mockLLM: ILLMPort;
  let service: ReturnType<typeof createKnowledgeService>;

  beforeEach(() => {
    mockKnowledgeRepo = createMockKnowledgeRepo();
    mockInfluencerRepo = createMockInfluencerRepo();
    mockLLM = createMockLLM();
    service = createKnowledgeService({
      knowledgeRepo: mockKnowledgeRepo,
      influencerRepo: mockInfluencerRepo,
      llm: mockLLM,
    });
  });

  describe('learnFromContent', () => {
    it('should create knowledge item from content', async () => {
      const item = createMockKnowledgeItem();

      vi.mocked(mockKnowledgeRepo.existsByUrl).mockResolvedValue(ok(false));
      vi.mocked(mockInfluencerRepo.matchFromContent).mockResolvedValue(ok(null));
      vi.mocked(mockLLM.extractKnowledge).mockResolvedValue(ok({
        data: {
          title: 'Extracted Title',
          summary: 'Extracted summary',
          category: 'prompting',
          tags: ['AI'],
        },
      }));
      vi.mocked(mockLLM.scoreRelevance).mockResolvedValue(ok({
        data: {
          score: 0.85,
          confidence: 0.9,
          reasoning: 'Highly relevant',
        },
      }));
      vi.mocked(mockKnowledgeRepo.save).mockResolvedValue(ok(item));

      const result = await service.learnFromContent({
        url: 'https://example.com/article',
        content: 'Article content here...',
        platform: 'web',
        author: 'Test Author',
      });

      expect(result.success).toBe(true);
      expect(mockKnowledgeRepo.existsByUrl).toHaveBeenCalledWith('https://example.com/article');
      expect(mockLLM.extractKnowledge).toHaveBeenCalled();
      expect(mockLLM.scoreRelevance).toHaveBeenCalled();
      expect(mockKnowledgeRepo.save).toHaveBeenCalled();
    });

    it('should return error if URL already exists', async () => {
      vi.mocked(mockKnowledgeRepo.existsByUrl).mockResolvedValue(ok(true));

      const result = await service.learnFromContent({
        url: 'https://example.com/existing',
        content: 'Content',
      });

      expect(result.success).toBe(false);
      expect(mockKnowledgeRepo.save).not.toHaveBeenCalled();
    });

    it('should match influencer and increment content count', async () => {
      const item = createMockKnowledgeItem();
      const influencer: Influencer = {
        id: 'influencer-id',
        name: 'Test Influencer',
        description: 'Test',
        credibilityTier: 'high',
        identifiers: [{ platform: 'twitter', handle: 'testhandle' }],
        expertiseTopics: ['AI'],
        contentCount: 5,
        isActive: true,
        addedAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      vi.mocked(mockKnowledgeRepo.existsByUrl).mockResolvedValue(ok(false));
      vi.mocked(mockInfluencerRepo.matchFromContent).mockResolvedValue(ok({
        influencer,
        matchedIdentifier: { platform: 'twitter', handle: 'testhandle' },
        confidence: 0.95,
      }));
      vi.mocked(mockInfluencerRepo.incrementContentCount).mockResolvedValue(ok(undefined));
      vi.mocked(mockLLM.extractKnowledge).mockResolvedValue(ok({ data: {} }));
      vi.mocked(mockLLM.scoreRelevance).mockResolvedValue(ok({
        data: { score: 0.8, confidence: 0.9, reasoning: 'Good' },
      }));
      vi.mocked(mockKnowledgeRepo.save).mockResolvedValue(ok(item));

      await service.learnFromContent({
        url: 'https://twitter.com/testhandle/status/123',
        content: 'Tweet content',
        author: 'testhandle',
      });

      expect(mockInfluencerRepo.incrementContentCount).toHaveBeenCalledWith('influencer-id');
    });

    it('should work without LLM', async () => {
      const serviceWithoutLLM = createKnowledgeService({
        knowledgeRepo: mockKnowledgeRepo,
      });
      const item = createMockKnowledgeItem();

      vi.mocked(mockKnowledgeRepo.existsByUrl).mockResolvedValue(ok(false));
      vi.mocked(mockKnowledgeRepo.save).mockResolvedValue(ok(item));

      const result = await serviceWithoutLLM.learnFromContent({
        url: 'https://example.com/article',
        content: 'Article content...',
        title: 'Manual Title',
      });

      expect(result.success).toBe(true);
      // LLM methods should not be called
      expect(mockLLM.extractKnowledge).not.toHaveBeenCalled();
    });

    it('should set status based on relevance score', async () => {
      vi.mocked(mockKnowledgeRepo.existsByUrl).mockResolvedValue(ok(false));
      vi.mocked(mockInfluencerRepo.matchFromContent).mockResolvedValue(ok(null));
      vi.mocked(mockLLM.extractKnowledge).mockResolvedValue(ok({ data: {} }));
      vi.mocked(mockLLM.scoreRelevance).mockResolvedValue(ok({
        data: { score: 0.5, confidence: 0.8, reasoning: 'Medium relevance' },
      }));
      vi.mocked(mockKnowledgeRepo.save).mockImplementation(async (item) => ok(item));

      await service.learnFromContent({
        url: 'https://example.com/article',
        content: 'Content',
      });

      const savedItem = vi.mocked(mockKnowledgeRepo.save).mock.calls[0][0];
      expect(savedItem.status).toBe('draft'); // score < 0.7
    });
  });

  describe('search', () => {
    it('should search with filters', async () => {
      const items = [createMockKnowledgeItem()];
      const paginatedResult: PaginatedResult<KnowledgeItem> = {
        items,
        total: 1,
        hasMore: false,
      };
      vi.mocked(mockKnowledgeRepo.search).mockResolvedValue(ok(paginatedResult));

      const result = await service.search({ category: 'prompting' }, { limit: 10 });

      expect(result.success).toBe(true);
      expect(mockKnowledgeRepo.search).toHaveBeenCalledWith(
        { category: 'prompting' },
        expect.objectContaining({
          pagination: { limit: 10 },
          sort: { field: 'relevance', direction: 'desc' },
        })
      );
    });
  });

  describe('textSearch', () => {
    it('should perform full-text search', async () => {
      const items = [createMockKnowledgeItem()];
      const paginatedResult: PaginatedResult<KnowledgeItem> = {
        items,
        total: 1,
        hasMore: false,
      };
      vi.mocked(mockKnowledgeRepo.fullTextSearch).mockResolvedValue(ok(paginatedResult));

      const result = await service.textSearch('AI prompting techniques');

      expect(result.success).toBe(true);
      expect(mockKnowledgeRepo.fullTextSearch).toHaveBeenCalledWith(
        'AI prompting techniques',
        undefined,
        undefined
      );
    });
  });

  describe('getById', () => {
    it('should return knowledge item by ID', async () => {
      const item = createMockKnowledgeItem();
      vi.mocked(mockKnowledgeRepo.findById).mockResolvedValue(ok(item));

      const result = await service.getById('test-id');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.id).toBe('test-knowledge-id');
      }
    });

    it('should return null for non-existent ID', async () => {
      vi.mocked(mockKnowledgeRepo.findById).mockResolvedValue(ok(null));

      const result = await service.getById('nonexistent-id');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });
  });

  describe('update', () => {
    it('should update knowledge item', async () => {
      const updatedItem = createMockKnowledgeItem({ title: 'Updated Title' });
      vi.mocked(mockKnowledgeRepo.update).mockResolvedValue(ok(updatedItem));

      const result = await service.update('test-id', { title: 'Updated Title' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Updated Title');
      }
    });
  });

  describe('updateStatus', () => {
    it('should update item status', async () => {
      vi.mocked(mockKnowledgeRepo.updateStatus).mockResolvedValue(ok(undefined));

      const result = await service.updateStatus('test-id', 'approved');

      expect(result.success).toBe(true);
      expect(mockKnowledgeRepo.updateStatus).toHaveBeenCalledWith('test-id', 'approved');
    });
  });

  describe('delete', () => {
    it('should delete knowledge item', async () => {
      vi.mocked(mockKnowledgeRepo.delete).mockResolvedValue(ok(undefined));

      const result = await service.delete('test-id');

      expect(result.success).toBe(true);
      expect(mockKnowledgeRepo.delete).toHaveBeenCalledWith('test-id');
    });
  });

  describe('getStats', () => {
    it('should return knowledge base statistics', async () => {
      const stats: KnowledgeStats = {
        total: 100,
        byCategory: { prompting: 30, workflow: 25, other: 45 },
        byStatus: { approved: 80, draft: 15, archived: 5 },
        averageRelevance: 0.75,
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };
      vi.mocked(mockKnowledgeRepo.getStats).mockResolvedValue(ok(stats));

      const result = await service.getStats();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total).toBe(100);
        expect(result.data.averageRelevance).toBe(0.75);
      }
    });
  });

  describe('findByCategory', () => {
    it('should find items by category', async () => {
      const items = [createMockKnowledgeItem({ category: 'prompting' })];
      const paginatedResult: PaginatedResult<KnowledgeItem> = {
        items,
        total: 1,
        hasMore: false,
      };
      vi.mocked(mockKnowledgeRepo.search).mockResolvedValue(ok(paginatedResult));

      const result = await service.findByCategory('prompting');

      expect(result.success).toBe(true);
      expect(mockKnowledgeRepo.search).toHaveBeenCalledWith(
        { category: 'prompting' },
        expect.anything()
      );
    });
  });

  describe('findHighRelevance', () => {
    it('should find high relevance items', async () => {
      const items = [
        createMockKnowledgeItem({ relevance: { score: 0.9, confidence: 0.95, reasoning: 'High' } }),
      ];
      const paginatedResult: PaginatedResult<KnowledgeItem> = {
        items,
        total: 1,
        hasMore: false,
      };
      vi.mocked(mockKnowledgeRepo.search).mockResolvedValue(ok(paginatedResult));

      const result = await service.findHighRelevance(0.8);

      expect(result.success).toBe(true);
      expect(mockKnowledgeRepo.search).toHaveBeenCalledWith(
        { minScore: 0.8, status: 'approved' },
        expect.objectContaining({
          sort: { field: 'relevance', direction: 'desc' },
        })
      );
    });
  });

  describe('saveBatch', () => {
    it('should save multiple items in batch', async () => {
      const items = [
        createMockKnowledgeItem({ id: '1' }),
        createMockKnowledgeItem({ id: '2' }),
      ];
      vi.mocked(mockKnowledgeRepo.saveBatch).mockResolvedValue(ok(items));

      const result = await service.saveBatch(items);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });
  });

  describe('hasUrl', () => {
    it('should check if URL exists', async () => {
      vi.mocked(mockKnowledgeRepo.existsByUrl).mockResolvedValue(ok(true));

      const result = await service.hasUrl('https://example.com/existing');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(true);
      }
    });
  });

  describe('findSimilar', () => {
    it('should find similar items by title', async () => {
      const items = [createMockKnowledgeItem()];
      vi.mocked(mockKnowledgeRepo.findSimilar).mockResolvedValue(ok(items));

      const result = await service.findSimilar('Test Knowledge');

      expect(result.success).toBe(true);
      expect(mockKnowledgeRepo.findSimilar).toHaveBeenCalledWith('Test Knowledge');
    });
  });
});
