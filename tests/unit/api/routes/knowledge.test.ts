import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the database module before importing routes
vi.mock('../../../../src/search-agent/db/index.js', () => ({
  knowledgeDb: {
    search: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
    getStats: vi.fn(),
    getQualityMetrics: vi.fn(),
  },
}));

import { knowledgeRoutes } from '../../../../src/api/routes/knowledge.js';
import { knowledgeDb } from '../../../../src/search-agent/db/index.js';

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/knowledge', knowledgeRoutes);
  return app;
}

// Mock knowledge item factory
function createMockKnowledgeItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'test-id',
    title: 'Test Knowledge Item',
    summary: 'A test summary',
    content: 'Full content here...',
    category: 'prompting',
    content_type: 'insight',
    tags: ['AI', 'testing'],
    source_url: 'https://example.com/article',
    source_platform: 'web',
    source_author: 'Test Author',
    relevance_score: 0.85,
    relevance_confidence: 0.9,
    relevance_reasoning: 'Highly relevant',
    status: 'approved',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Knowledge API Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/knowledge', () => {
    it('should list knowledge items', async () => {
      const mockItems = [createMockKnowledgeItem({ id: '1' }), createMockKnowledgeItem({ id: '2' })];

      vi.mocked(knowledgeDb.search).mockResolvedValue({
        items: mockItems,
        total: 2,
        limit: 50,
        offset: 0,
      });

      const response = await request(app).get('/api/knowledge');

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('should apply filters from query params', async () => {
      vi.mocked(knowledgeDb.search).mockResolvedValue({
        items: [],
        total: 0,
        limit: 10,
        offset: 0,
      });

      await request(app).get('/api/knowledge?category=prompting&status=approved&limit=10');

      expect(knowledgeDb.search).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'prompting',
          status: 'approved',
        }),
        expect.objectContaining({
          limit: 10,
        })
      );
    });

    it('should apply sorting from query params', async () => {
      vi.mocked(knowledgeDb.search).mockResolvedValue({
        items: [],
        total: 0,
        limit: 50,
        offset: 0,
      });

      await request(app).get('/api/knowledge?sortBy=relevance&sortOrder=desc');

      expect(knowledgeDb.search).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          sortBy: 'relevance_score',
          sortOrder: 'desc',
        })
      );
    });

    it('should handle minScore filter', async () => {
      vi.mocked(knowledgeDb.search).mockResolvedValue({
        items: [],
        total: 0,
        limit: 50,
        offset: 0,
      });

      await request(app).get('/api/knowledge?minScore=0.8');

      expect(knowledgeDb.search).toHaveBeenCalledWith(
        expect.objectContaining({
          minScore: 0.8,
        }),
        expect.anything()
      );
    });

    it('should return 500 on database error', async () => {
      vi.mocked(knowledgeDb.search).mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/knowledge');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to list knowledge items');
    });
  });

  describe('GET /api/knowledge/stats', () => {
    it('should return knowledge base statistics', async () => {
      const mockStats = {
        total: 100,
        byCategory: { prompting: 30, workflow: 25, other: 45 },
        byStatus: { approved: 80, draft: 15, archived: 5 },
        averageRelevance: 0.75,
      };

      vi.mocked(knowledgeDb.getStats).mockResolvedValue(mockStats);

      const response = await request(app).get('/api/knowledge/stats');

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(100);
      expect(response.body.averageRelevance).toBe(0.75);
    });

    it('should return 500 on error', async () => {
      vi.mocked(knowledgeDb.getStats).mockRejectedValue(new Error('Stats error'));

      const response = await request(app).get('/api/knowledge/stats');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get statistics');
    });
  });

  describe('GET /api/knowledge/metrics', () => {
    it('should return quality metrics', async () => {
      const mockMetrics = {
        highRelevanceCount: 50,
        lowRelevanceCount: 10,
        avgConfidence: 0.85,
        categoryCoverage: 0.9,
      };

      vi.mocked(knowledgeDb.getQualityMetrics).mockResolvedValue(mockMetrics);

      const response = await request(app).get('/api/knowledge/metrics');

      expect(response.status).toBe(200);
      expect(response.body.highRelevanceCount).toBe(50);
    });

    it('should return 500 on error', async () => {
      vi.mocked(knowledgeDb.getQualityMetrics).mockRejectedValue(new Error('Metrics error'));

      const response = await request(app).get('/api/knowledge/metrics');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get metrics');
    });
  });

  describe('GET /api/knowledge/:id', () => {
    it('should return knowledge item by ID', async () => {
      const mockItem = createMockKnowledgeItem();

      vi.mocked(knowledgeDb.findById).mockResolvedValue(mockItem);

      const response = await request(app).get('/api/knowledge/test-id');

      expect(response.status).toBe(200);
      expect(response.body.item.id).toBe('test-id');
    });

    it('should return 404 when not found', async () => {
      vi.mocked(knowledgeDb.findById).mockResolvedValue(null);

      const response = await request(app).get('/api/knowledge/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Knowledge item not found');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(knowledgeDb.findById).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/knowledge/test-id');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get knowledge item');
    });
  });

  describe('DELETE /api/knowledge/:id', () => {
    it('should delete knowledge item', async () => {
      vi.mocked(knowledgeDb.delete).mockResolvedValue(true);

      const response = await request(app).delete('/api/knowledge/test-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.id).toBe('test-id');
    });

    it('should return 404 when not found', async () => {
      vi.mocked(knowledgeDb.delete).mockResolvedValue(false);

      const response = await request(app).delete('/api/knowledge/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Knowledge item not found');
    });

    it('should return 500 on delete error', async () => {
      vi.mocked(knowledgeDb.delete).mockRejectedValue(new Error('Delete error'));

      const response = await request(app).delete('/api/knowledge/test-id');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete knowledge item');
    });
  });
});
