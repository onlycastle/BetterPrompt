/**
 * Influencer Registry
 *
 * Manages the collection of tracked influencers.
 * Provides CRUD operations and file-based persistence.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  Influencer,
  InfluencerRegistry,
  InfluencerRegistrySchema,
  CredibilityTier,
  DEFAULT_INFLUENCERS,
  normalizeHandle,
} from '../models/influencer.js';

/**
 * Path to influencer registry file
 */
export const INFLUENCER_REGISTRY_PATH = join(
  homedir(),
  '.nomoreaislop',
  'influencers.json'
);

/**
 * Influencer Registry Manager
 *
 * Manages tracked influencers with file-based persistence.
 */
export class InfluencerRegistryManager {
  private registry: InfluencerRegistry;
  private readonly filePath: string;

  constructor(filePath: string = INFLUENCER_REGISTRY_PATH) {
    this.filePath = filePath;
    this.registry = this.loadOrInitialize();
  }

  /**
   * Load registry from file or initialize with defaults
   */
  private loadOrInitialize(): InfluencerRegistry {
    if (existsSync(this.filePath)) {
      try {
        const data = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(data);
        return InfluencerRegistrySchema.parse(parsed);
      } catch (error) {
        console.error('Failed to load influencer registry, initializing fresh:', error);
      }
    }

    // Initialize with defaults
    return this.initializeDefaults();
  }

  /**
   * Initialize registry with default influencers
   */
  private initializeDefaults(): InfluencerRegistry {
    const now = new Date().toISOString();

    const influencers: Influencer[] = DEFAULT_INFLUENCERS.map((inf) => ({
      ...inf,
      id: randomUUID(),
      addedAt: now,
    }));

    const registry: InfluencerRegistry = {
      version: '1.0.0',
      updatedAt: now,
      influencers,
    };

    this.saveToFile(registry);
    return registry;
  }

  /**
   * Save registry to file
   */
  private saveToFile(registry: InfluencerRegistry): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(this.filePath, JSON.stringify(registry, null, 2), 'utf-8');
  }

  /**
   * Save current registry state
   */
  save(): void {
    this.registry.updatedAt = new Date().toISOString();
    this.saveToFile(this.registry);
  }

  /**
   * Get all influencers
   */
  getAll(): Influencer[] {
    return [...this.registry.influencers];
  }

  /**
   * Get active influencers only
   */
  getActive(): Influencer[] {
    return this.registry.influencers.filter((i) => i.isActive);
  }

  /**
   * Get influencer by ID
   */
  getById(id: string): Influencer | undefined {
    return this.registry.influencers.find((i) => i.id === id);
  }

  /**
   * Get influencer by name (case-insensitive)
   */
  getByName(name: string): Influencer | undefined {
    const normalized = name.toLowerCase();
    return this.registry.influencers.find(
      (i) => i.name.toLowerCase() === normalized
    );
  }

  /**
   * Find influencer by platform handle
   */
  findByHandle(platform: string, handle: string): Influencer | undefined {
    const normalizedHandle = normalizeHandle(handle);
    const normalizedPlatform = platform.toLowerCase();

    return this.registry.influencers.find((inf) =>
      inf.identifiers.some(
        (id) =>
          id.platform.toLowerCase() === normalizedPlatform &&
          normalizeHandle(id.handle) === normalizedHandle
      )
    );
  }

  /**
   * Get influencers by credibility tier
   */
  getByTier(tier: CredibilityTier): Influencer[] {
    return this.registry.influencers.filter((i) => i.credibilityTier === tier);
  }

  /**
   * Get influencers by expertise topic
   */
  getByTopic(topic: string): Influencer[] {
    const normalizedTopic = topic.toLowerCase();
    return this.registry.influencers.filter((inf) =>
      inf.expertiseTopics.some((t) => t.toLowerCase().includes(normalizedTopic))
    );
  }

  /**
   * Add a new influencer
   */
  add(
    influencer: Omit<Influencer, 'id' | 'addedAt' | 'contentCount'>
  ): Influencer {
    const now = new Date().toISOString();

    const newInfluencer: Influencer = {
      ...influencer,
      id: randomUUID(),
      addedAt: now,
      contentCount: 0,
    };

    this.registry.influencers.push(newInfluencer);
    this.save();

    return newInfluencer;
  }

  /**
   * Update an existing influencer
   */
  update(id: string, updates: Partial<Omit<Influencer, 'id' | 'addedAt'>>): Influencer | null {
    const index = this.registry.influencers.findIndex((i) => i.id === id);
    if (index === -1) return null;

    const updated: Influencer = {
      ...this.registry.influencers[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.registry.influencers[index] = updated;
    this.save();

    return updated;
  }

  /**
   * Increment content count for an influencer
   */
  incrementContentCount(id: string): void {
    const influencer = this.getById(id);
    if (influencer) {
      this.update(id, {
        contentCount: influencer.contentCount + 1,
        lastContentAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Remove an influencer
   */
  remove(id: string): boolean {
    const index = this.registry.influencers.findIndex((i) => i.id === id);
    if (index === -1) return false;

    this.registry.influencers.splice(index, 1);
    this.save();

    return true;
  }

  /**
   * Deactivate an influencer (soft delete)
   */
  deactivate(id: string): boolean {
    const result = this.update(id, { isActive: false });
    return result !== null;
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    total: number;
    active: number;
    byTier: Record<CredibilityTier, number>;
    totalContent: number;
  } {
    const influencers = this.registry.influencers;

    return {
      total: influencers.length,
      active: influencers.filter((i) => i.isActive).length,
      byTier: {
        high: influencers.filter((i) => i.credibilityTier === 'high').length,
        medium: influencers.filter((i) => i.credibilityTier === 'medium').length,
        standard: influencers.filter((i) => i.credibilityTier === 'standard').length,
      },
      totalContent: influencers.reduce((sum, i) => sum + i.contentCount, 0),
    };
  }

  /**
   * Reset to default influencers
   */
  resetToDefaults(): void {
    this.registry = this.initializeDefaults();
  }

  /**
   * Export registry as JSON
   */
  export(): string {
    return JSON.stringify(this.registry, null, 2);
  }

  /**
   * Import registry from JSON
   */
  import(json: string): void {
    const parsed = JSON.parse(json);
    this.registry = InfluencerRegistrySchema.parse(parsed);
    this.save();
  }
}

// Singleton instance
let registryInstance: InfluencerRegistryManager | null = null;

/**
 * Get the singleton influencer registry instance
 */
export function getInfluencerRegistry(): InfluencerRegistryManager {
  if (!registryInstance) {
    registryInstance = new InfluencerRegistryManager();
  }
  return registryInstance;
}

/**
 * Create a new registry instance (for testing)
 */
export function createInfluencerRegistry(
  filePath?: string
): InfluencerRegistryManager {
  return new InfluencerRegistryManager(filePath);
}
