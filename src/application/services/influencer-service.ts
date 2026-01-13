/**
 * Influencer Service
 *
 * Manages influencer detection and registry.
 * Coordinates matching content to known influencers.
 *
 * @module application/services/influencer-service
 */

import { randomUUID } from 'crypto';
import { ok, err, type Result } from '../../lib/result.js';
import { StorageError } from '../../domain/errors/index.js';
import type { IInfluencerRepository, PaginatedResult } from '../ports/storage.js';
import type {
  Influencer,
  InfluencerMatch,
  CredibilityTier,
  InfluencerPlatform,
  PlatformIdentifier,
} from '../../domain/models/index.js';

/**
 * Influencer service dependencies
 */
export interface InfluencerServiceDeps {
  influencerRepo: IInfluencerRepository;
}

/**
 * Create influencer input
 */
export interface CreateInfluencerInput {
  name: string;
  description: string;
  credibilityTier: CredibilityTier;
  identifiers: PlatformIdentifier[];
  expertiseTopics: string[];
  affiliation?: string;
}

/**
 * Influencer statistics
 */
export interface InfluencerStats {
  total: number;
  active: number;
  byTier: Record<CredibilityTier, number>;
  totalContent: number;
}

/**
 * Create Influencer Service
 */
export function createInfluencerService(deps: InfluencerServiceDeps) {
  const { influencerRepo } = deps;

  return {
    /**
     * Create a new influencer
     */
    async create(input: CreateInfluencerInput): Promise<Result<Influencer, StorageError>> {
      const now = new Date().toISOString();

      const influencer: Influencer = {
        id: randomUUID(),
        name: input.name,
        description: input.description,
        credibilityTier: input.credibilityTier,
        identifiers: input.identifiers,
        expertiseTopics: input.expertiseTopics,
        affiliation: input.affiliation,
        contentCount: 0,
        isActive: true,
        addedAt: now,
        updatedAt: now,
      };

      return influencerRepo.save(influencer);
    },

    /**
     * Get influencer by ID
     */
    async getById(id: string): Promise<Result<Influencer | null, StorageError>> {
      return influencerRepo.findById(id);
    },

    /**
     * Get influencer by platform handle
     */
    async getByHandle(
      platform: InfluencerPlatform,
      handle: string
    ): Promise<Result<Influencer | null, StorageError>> {
      return influencerRepo.findByHandle(platform, handle);
    },

    /**
     * List all influencers
     */
    async list(
      options?: { limit?: number; offset?: number }
    ): Promise<Result<PaginatedResult<Influencer>, StorageError>> {
      return influencerRepo.findAll({
        pagination: options,
        sort: { field: 'name', direction: 'asc' },
      });
    },

    /**
     * Get active influencers
     */
    async getActive(): Promise<Result<Influencer[], StorageError>> {
      return influencerRepo.findActive();
    },

    /**
     * Get influencers by credibility tier
     */
    async getByTier(tier: CredibilityTier): Promise<Result<Influencer[], StorageError>> {
      return influencerRepo.findByTier(tier);
    },

    /**
     * Update an influencer
     */
    async update(
      id: string,
      updates: Partial<Omit<Influencer, 'id' | 'addedAt'>>
    ): Promise<Result<Influencer, StorageError>> {
      return influencerRepo.update(id, updates);
    },

    /**
     * Add identifier to influencer
     */
    async addIdentifier(
      id: string,
      identifier: PlatformIdentifier
    ): Promise<Result<Influencer, StorageError>> {
      const result = await influencerRepo.findById(id);
      if (!result.success) {
        return err(result.error);
      }

      if (!result.data) {
        return err(StorageError.notFound('influencers', id));
      }

      const existingIdentifiers = result.data.identifiers || [];

      // Check for duplicate
      const exists = existingIdentifiers.some(
        (i: PlatformIdentifier) => i.platform === identifier.platform && i.handle === identifier.handle
      );

      if (exists) {
        return ok(result.data); // Already exists, no change needed
      }

      return influencerRepo.update(id, {
        identifiers: [...existingIdentifiers, identifier],
      });
    },

    /**
     * Remove identifier from influencer
     */
    async removeIdentifier(
      id: string,
      platform: InfluencerPlatform,
      handle: string
    ): Promise<Result<Influencer, StorageError>> {
      const result = await influencerRepo.findById(id);
      if (!result.success) {
        return err(result.error);
      }

      if (!result.data) {
        return err(StorageError.notFound('influencers', id));
      }

      const updatedIdentifiers = result.data.identifiers.filter(
        (i: PlatformIdentifier) => !(i.platform === platform && i.handle === handle)
      );

      return influencerRepo.update(id, {
        identifiers: updatedIdentifiers,
      });
    },

    /**
     * Deactivate an influencer
     */
    async deactivate(id: string): Promise<Result<Influencer, StorageError>> {
      return influencerRepo.update(id, { isActive: false });
    },

    /**
     * Activate an influencer
     */
    async activate(id: string): Promise<Result<Influencer, StorageError>> {
      return influencerRepo.update(id, { isActive: true });
    },

    /**
     * Delete an influencer
     */
    async delete(id: string): Promise<Result<void, StorageError>> {
      return influencerRepo.delete(id);
    },

    /**
     * Increment content count for an influencer
     */
    async incrementContentCount(id: string): Promise<Result<void, StorageError>> {
      return influencerRepo.incrementContentCount(id);
    },

    /**
     * Match content to an influencer
     */
    async matchFromContent(
      url: string,
      author?: string
    ): Promise<Result<InfluencerMatch | null, StorageError>> {
      return influencerRepo.matchFromContent(url, author);
    },

    /**
     * Find influencers by expertise topic
     */
    async findByTopic(topic: string): Promise<Result<Influencer[], StorageError>> {
      return this.filterInfluencers((i) =>
        i.expertiseTopics.some((t) => t.toLowerCase().includes(topic.toLowerCase()))
      );
    },

    /**
     * Get statistics
     */
    async getStats(): Promise<Result<InfluencerStats, StorageError>> {
      const result = await influencerRepo.findAll({ pagination: { limit: 1000 } });

      if (!result.success) {
        return err(result.error);
      }

      const influencers = result.data.items;

      return ok({
        total: influencers.length,
        active: influencers.filter((i) => i.isActive).length,
        byTier: {
          high: influencers.filter((i) => i.credibilityTier === 'high').length,
          medium: influencers.filter((i) => i.credibilityTier === 'medium').length,
          standard: influencers.filter((i) => i.credibilityTier === 'standard').length,
        },
        totalContent: influencers.reduce((sum, i) => sum + i.contentCount, 0),
      });
    },

    /**
     * Search influencers by name
     */
    async searchByName(query: string): Promise<Result<Influencer[], StorageError>> {
      return this.filterInfluencers((i) =>
        i.name.toLowerCase().includes(query.toLowerCase())
      );
    },

    /**
     * Filter influencers by predicate (internal helper)
     */
    async filterInfluencers(
      predicate: (i: Influencer) => boolean
    ): Promise<Result<Influencer[], StorageError>> {
      const result = await influencerRepo.findAll({ pagination: { limit: 100 } });

      if (!result.success) {
        return err(result.error);
      }

      return ok(result.data.items.filter(predicate));
    },
  };
}

/**
 * Influencer Service type
 */
export type InfluencerService = ReturnType<typeof createInfluencerService>;
