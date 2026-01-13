import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the database module before importing routes
vi.mock('../../../../src/search-agent/db/index.js', () => ({
  influencerDb: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findActive: vi.fn(),
    findByTier: vi.fn(),
    findByName: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deactivate: vi.fn(),
    getStats: vi.fn(),
  },
}));

import { influencerRoutes } from '../../../../src/api/routes/influencers.js';
import { influencerDb } from '../../../../src/search-agent/db/index.js';

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/influencers', influencerRoutes);
  return app;
}

// Mock influencer factory
function createMockInfluencer(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'test-id',
    name: 'Test Influencer',
    description: 'Test description',
    credibility_tier: 'high',
    identifiers: [{ platform: 'twitter', handle: 'testhandle' }],
    expertise_topics: ['AI', 'coding'],
    content_count: 5,
    is_active: true,
    added_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Influencer API Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/influencers', () => {
    it('should list all influencers with stats', async () => {
      const mockInfluencers = [createMockInfluencer({ id: '1' }), createMockInfluencer({ id: '2' })];
      const mockStats = { total: 2, active: 2, byTier: { high: 2, medium: 0, standard: 0 } };

      vi.mocked(influencerDb.findAll).mockResolvedValue(mockInfluencers);
      vi.mocked(influencerDb.getStats).mockResolvedValue(mockStats);

      const response = await request(app).get('/api/influencers');

      expect(response.status).toBe(200);
      expect(response.body.influencers).toHaveLength(2);
      expect(response.body.stats).toEqual(mockStats);
    });

    it('should return 500 on database error', async () => {
      vi.mocked(influencerDb.findAll).mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/influencers');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to list influencers');
    });
  });

  describe('GET /api/influencers/active', () => {
    it('should list only active influencers', async () => {
      const activeInfluencers = [
        createMockInfluencer({ id: '1', is_active: true }),
        createMockInfluencer({ id: '2', is_active: true }),
      ];

      vi.mocked(influencerDb.findActive).mockResolvedValue(activeInfluencers);

      const response = await request(app).get('/api/influencers/active');

      expect(response.status).toBe(200);
      expect(response.body.influencers).toHaveLength(2);
    });
  });

  describe('GET /api/influencers/tier/:tier', () => {
    it('should filter by credibility tier', async () => {
      const highTierInfluencers = [createMockInfluencer({ credibility_tier: 'high' })];

      vi.mocked(influencerDb.findByTier).mockResolvedValue(highTierInfluencers);

      const response = await request(app).get('/api/influencers/tier/high');

      expect(response.status).toBe(200);
      expect(response.body.tier).toBe('high');
      expect(influencerDb.findByTier).toHaveBeenCalledWith('high');
    });

    it('should return 400 for invalid tier', async () => {
      const response = await request(app).get('/api/influencers/tier/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid tier');
    });
  });

  describe('GET /api/influencers/:id', () => {
    it('should return influencer by ID', async () => {
      const mockInfluencer = createMockInfluencer();

      vi.mocked(influencerDb.findById).mockResolvedValue(mockInfluencer);

      const response = await request(app).get('/api/influencers/test-id');

      expect(response.status).toBe(200);
      expect(response.body.influencer.id).toBe('test-id');
    });

    it('should return 404 when not found', async () => {
      vi.mocked(influencerDb.findById).mockResolvedValue(null);

      const response = await request(app).get('/api/influencers/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Influencer not found');
    });
  });

  describe('POST /api/influencers', () => {
    it('should create new influencer', async () => {
      const newInfluencer = createMockInfluencer();

      vi.mocked(influencerDb.findByName).mockResolvedValue(null);
      vi.mocked(influencerDb.save).mockResolvedValue(newInfluencer);

      const response = await request(app)
        .post('/api/influencers')
        .send({
          name: 'Test Influencer',
          identifiers: [{ platform: 'twitter', handle: 'testhandle' }],
          expertiseTopics: ['AI'],
        });

      expect(response.status).toBe(201);
      expect(response.body.influencer).toBeDefined();
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/api/influencers')
        .send({
          identifiers: [{ platform: 'twitter', handle: 'testhandle' }],
          expertiseTopics: ['AI'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Name is required');
    });

    it('should return 400 when identifiers are missing', async () => {
      const response = await request(app)
        .post('/api/influencers')
        .send({
          name: 'Test',
          expertiseTopics: ['AI'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('identifier');
    });

    it('should return 400 when expertiseTopics are missing', async () => {
      const response = await request(app)
        .post('/api/influencers')
        .send({
          name: 'Test',
          identifiers: [{ platform: 'twitter', handle: 'testhandle' }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('expertise topic');
    });

    it('should return 409 when influencer already exists', async () => {
      vi.mocked(influencerDb.findByName).mockResolvedValue(createMockInfluencer());

      const response = await request(app)
        .post('/api/influencers')
        .send({
          name: 'Existing Influencer',
          identifiers: [{ platform: 'twitter', handle: 'testhandle' }],
          expertiseTopics: ['AI'],
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('PATCH /api/influencers/:id', () => {
    it('should update influencer', async () => {
      const updatedInfluencer = createMockInfluencer({ name: 'Updated Name' });

      vi.mocked(influencerDb.update).mockResolvedValue(updatedInfluencer);

      const response = await request(app)
        .patch('/api/influencers/test-id')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.influencer.name).toBe('Updated Name');
    });

    it('should return 404 when influencer not found', async () => {
      vi.mocked(influencerDb.update).mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/influencers/nonexistent')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/influencers/:id', () => {
    it('should delete influencer', async () => {
      vi.mocked(influencerDb.delete).mockResolvedValue(true);

      const response = await request(app).delete('/api/influencers/test-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 when influencer not found', async () => {
      vi.mocked(influencerDb.delete).mockResolvedValue(false);

      const response = await request(app).delete('/api/influencers/nonexistent');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/influencers/:id/deactivate', () => {
    it('should deactivate influencer', async () => {
      vi.mocked(influencerDb.deactivate).mockResolvedValue(true);

      const response = await request(app).post('/api/influencers/test-id/deactivate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 when influencer not found', async () => {
      vi.mocked(influencerDb.deactivate).mockResolvedValue(false);

      const response = await request(app).post('/api/influencers/nonexistent/deactivate');

      expect(response.status).toBe(404);
    });
  });
});
