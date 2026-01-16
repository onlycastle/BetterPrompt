import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, err } from '../../../../src/lib/result.js';
import { StorageError } from '../../../../src/lib/domain/errors/index.js';
import { createInfluencerService } from '../../../../src/lib/application/services/influencer-service.js';
import type { IInfluencerRepository, PaginatedResult } from '../../../../src/lib/application/ports/storage.js';
import type { Influencer, InfluencerMatch } from '../../../../src/lib/domain/models/index.js';

// Mock influencer factory
function createMockInfluencer(overrides: Partial<Influencer> = {}): Influencer {
  return {
    id: 'test-influencer-id',
    name: 'Test Influencer',
    description: 'A test influencer',
    credibilityTier: 'high',
    identifiers: [
      { platform: 'twitter', handle: 'testhandle' },
      { platform: 'github', handle: 'testuser' },
    ],
    expertiseTopics: ['AI', 'coding', 'development'],
    contentCount: 5,
    isActive: true,
    addedAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Mock repository factory
function createMockRepository(): IInfluencerRepository {
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

describe('InfluencerService', () => {
  let mockRepo: IInfluencerRepository;
  let service: ReturnType<typeof createInfluencerService>;

  beforeEach(() => {
    mockRepo = createMockRepository();
    service = createInfluencerService({ influencerRepo: mockRepo });
  });

  describe('create', () => {
    it('should create a new influencer', async () => {
      const influencer = createMockInfluencer();
      vi.mocked(mockRepo.save).mockResolvedValue(ok(influencer));

      const result = await service.create({
        name: 'Test Influencer',
        description: 'A test influencer',
        credibilityTier: 'high',
        identifiers: [{ platform: 'twitter', handle: 'testhandle' }],
        expertiseTopics: ['AI', 'coding'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test Influencer');
      }
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should return error when save fails', async () => {
      vi.mocked(mockRepo.save).mockResolvedValue(
        err(StorageError.writeError('influencers'))
      );

      const result = await service.create({
        name: 'Test',
        description: 'Test',
        credibilityTier: 'standard',
        identifiers: [],
        expertiseTopics: [],
      });

      expect(result.success).toBe(false);
    });
  });

  describe('getById', () => {
    it('should return influencer when found', async () => {
      const influencer = createMockInfluencer();
      vi.mocked(mockRepo.findById).mockResolvedValue(ok(influencer));

      const result = await service.getById('test-id');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.id).toBe('test-influencer-id');
      }
    });

    it('should return null when not found', async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue(ok(null));

      const result = await service.getById('nonexistent-id');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });
  });

  describe('getByHandle', () => {
    it('should find influencer by platform handle', async () => {
      const influencer = createMockInfluencer();
      vi.mocked(mockRepo.findByHandle).mockResolvedValue(ok(influencer));

      const result = await service.getByHandle('twitter', 'testhandle');

      expect(result.success).toBe(true);
      expect(mockRepo.findByHandle).toHaveBeenCalledWith('twitter', 'testhandle');
    });
  });

  describe('list', () => {
    it('should list all influencers with pagination', async () => {
      const influencers = [createMockInfluencer({ id: '1' }), createMockInfluencer({ id: '2' })];
      const paginatedResult: PaginatedResult<Influencer> = {
        items: influencers,
        total: 2,
        hasMore: false,
      };
      vi.mocked(mockRepo.findAll).mockResolvedValue(ok(paginatedResult));

      const result = await service.list({ limit: 10, offset: 0 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(2);
      }
    });
  });

  describe('getActive', () => {
    it('should return only active influencers', async () => {
      const activeInfluencers = [
        createMockInfluencer({ id: '1', isActive: true }),
        createMockInfluencer({ id: '2', isActive: true }),
      ];
      vi.mocked(mockRepo.findActive).mockResolvedValue(ok(activeInfluencers));

      const result = await service.getActive();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data.every((i) => i.isActive)).toBe(true);
      }
    });
  });

  describe('getByTier', () => {
    it('should filter by credibility tier', async () => {
      const highTierInfluencers = [createMockInfluencer({ credibilityTier: 'high' })];
      vi.mocked(mockRepo.findByTier).mockResolvedValue(ok(highTierInfluencers));

      const result = await service.getByTier('high');

      expect(result.success).toBe(true);
      expect(mockRepo.findByTier).toHaveBeenCalledWith('high');
    });
  });

  describe('update', () => {
    it('should update influencer properties', async () => {
      const updatedInfluencer = createMockInfluencer({ name: 'Updated Name' });
      vi.mocked(mockRepo.update).mockResolvedValue(ok(updatedInfluencer));

      const result = await service.update('test-id', { name: 'Updated Name' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Updated Name');
      }
    });
  });

  describe('addIdentifier', () => {
    it('should add new identifier to influencer', async () => {
      const influencer = createMockInfluencer();
      const updatedInfluencer = createMockInfluencer({
        identifiers: [
          ...influencer.identifiers,
          { platform: 'youtube', handle: 'newchannel' },
        ],
      });

      vi.mocked(mockRepo.findById).mockResolvedValue(ok(influencer));
      vi.mocked(mockRepo.update).mockResolvedValue(ok(updatedInfluencer));

      const result = await service.addIdentifier('test-id', {
        platform: 'youtube',
        handle: 'newchannel',
      });

      expect(result.success).toBe(true);
      expect(mockRepo.update).toHaveBeenCalled();
    });

    it('should not add duplicate identifier', async () => {
      const influencer = createMockInfluencer({
        identifiers: [{ platform: 'twitter', handle: 'testhandle' }],
      });
      vi.mocked(mockRepo.findById).mockResolvedValue(ok(influencer));

      const result = await service.addIdentifier('test-id', {
        platform: 'twitter',
        handle: 'testhandle',
      });

      expect(result.success).toBe(true);
      // Should return without calling update since identifier already exists
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should return error when influencer not found', async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue(ok(null));

      const result = await service.addIdentifier('nonexistent-id', {
        platform: 'twitter',
        handle: 'handle',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('removeIdentifier', () => {
    it('should remove identifier from influencer', async () => {
      const influencer = createMockInfluencer({
        identifiers: [
          { platform: 'twitter', handle: 'testhandle' },
          { platform: 'github', handle: 'testuser' },
        ],
      });
      const updatedInfluencer = createMockInfluencer({
        identifiers: [{ platform: 'github', handle: 'testuser' }],
      });

      vi.mocked(mockRepo.findById).mockResolvedValue(ok(influencer));
      vi.mocked(mockRepo.update).mockResolvedValue(ok(updatedInfluencer));

      const result = await service.removeIdentifier('test-id', 'twitter', 'testhandle');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.identifiers).toHaveLength(1);
      }
    });
  });

  describe('deactivate and activate', () => {
    it('should deactivate an influencer', async () => {
      const deactivatedInfluencer = createMockInfluencer({ isActive: false });
      vi.mocked(mockRepo.update).mockResolvedValue(ok(deactivatedInfluencer));

      const result = await service.deactivate('test-id');

      expect(result.success).toBe(true);
      expect(mockRepo.update).toHaveBeenCalledWith('test-id', { isActive: false });
    });

    it('should activate an influencer', async () => {
      const activatedInfluencer = createMockInfluencer({ isActive: true });
      vi.mocked(mockRepo.update).mockResolvedValue(ok(activatedInfluencer));

      const result = await service.activate('test-id');

      expect(result.success).toBe(true);
      expect(mockRepo.update).toHaveBeenCalledWith('test-id', { isActive: true });
    });
  });

  describe('delete', () => {
    it('should delete an influencer', async () => {
      vi.mocked(mockRepo.delete).mockResolvedValue(ok(undefined));

      const result = await service.delete('test-id');

      expect(result.success).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith('test-id');
    });
  });

  describe('incrementContentCount', () => {
    it('should increment content count', async () => {
      vi.mocked(mockRepo.incrementContentCount).mockResolvedValue(ok(undefined));

      const result = await service.incrementContentCount('test-id');

      expect(result.success).toBe(true);
      expect(mockRepo.incrementContentCount).toHaveBeenCalledWith('test-id');
    });
  });

  describe('matchFromContent', () => {
    it('should match content to influencer', async () => {
      const match: InfluencerMatch = {
        influencer: createMockInfluencer(),
        matchedIdentifier: { platform: 'twitter', handle: 'testhandle' },
        confidence: 0.95,
      };
      vi.mocked(mockRepo.matchFromContent).mockResolvedValue(ok(match));

      const result = await service.matchFromContent(
        'https://twitter.com/testhandle/status/123',
        'testhandle'
      );

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.influencer.id).toBe('test-influencer-id');
      }
    });

    it('should return null when no match found', async () => {
      vi.mocked(mockRepo.matchFromContent).mockResolvedValue(ok(null));

      const result = await service.matchFromContent('https://unknown.com/page');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });
  });

  describe('findByTopic', () => {
    it('should find influencers by expertise topic', async () => {
      const influencers = [
        createMockInfluencer({ expertiseTopics: ['AI', 'machine learning'] }),
        createMockInfluencer({ expertiseTopics: ['development', 'AI tools'] }),
      ];
      const paginatedResult: PaginatedResult<Influencer> = {
        items: influencers,
        total: 2,
        hasMore: false,
      };
      vi.mocked(mockRepo.findAll).mockResolvedValue(ok(paginatedResult));

      const result = await service.findByTopic('AI');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBeGreaterThan(0);
      }
    });
  });

  describe('searchByName', () => {
    it('should search influencers by name', async () => {
      const influencers = [
        createMockInfluencer({ name: 'John Doe' }),
        createMockInfluencer({ name: 'Jane Smith' }),
      ];
      const paginatedResult: PaginatedResult<Influencer> = {
        items: influencers,
        total: 2,
        hasMore: false,
      };
      vi.mocked(mockRepo.findAll).mockResolvedValue(ok(paginatedResult));

      const result = await service.searchByName('John');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.some((i) => i.name.includes('John'))).toBe(true);
      }
    });
  });

  describe('getStats', () => {
    it('should return influencer statistics', async () => {
      const influencers = [
        createMockInfluencer({ id: '1', credibilityTier: 'high', isActive: true, contentCount: 10 }),
        createMockInfluencer({ id: '2', credibilityTier: 'medium', isActive: true, contentCount: 5 }),
        createMockInfluencer({ id: '3', credibilityTier: 'high', isActive: false, contentCount: 3 }),
      ];
      const paginatedResult: PaginatedResult<Influencer> = {
        items: influencers,
        total: 3,
        hasMore: false,
      };
      vi.mocked(mockRepo.findAll).mockResolvedValue(ok(paginatedResult));

      const result = await service.getStats();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total).toBe(3);
        expect(result.data.active).toBe(2);
        expect(result.data.byTier.high).toBe(2);
        expect(result.data.byTier.medium).toBe(1);
        expect(result.data.totalContent).toBe(18);
      }
    });
  });
});
