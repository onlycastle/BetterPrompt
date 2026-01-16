/**
 * Knowledge Store
 *
 * Persists knowledge items to the local filesystem.
 * Storage location: ~/.nomoreaislop/knowledge/
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  KnowledgeItem,
  KnowledgeItemSchema,
  KnowledgeCollection,
  TopicCategory,
  SourcePlatform,
} from '../models/index';

/**
 * Storage paths
 */
export const KNOWLEDGE_BASE_PATH = join(homedir(), '.nomoreaislop', 'knowledge');
export const ITEMS_PATH = join(KNOWLEDGE_BASE_PATH, 'items');
export const INDEX_PATH = join(KNOWLEDGE_BASE_PATH, 'index.json');

/**
 * Knowledge store statistics
 */
export interface KnowledgeStats {
  totalItems: number;
  byCategory: Partial<Record<TopicCategory, number>>;
  byStatus: Record<string, number>;
  byPlatform: Partial<Record<SourcePlatform, number>>;
}

/**
 * Quality metrics for the knowledge base
 */
export interface QualityMetrics {
  totalItems: number;
  averageRelevanceScore: number;
  highQualityCount: number; // score >= 0.7
  influencerContentCount: number;
  platformDistribution: Partial<Record<SourcePlatform, number>>;
  categoryDistribution: Partial<Record<TopicCategory, number>>;
  recentItemsCount: number; // Last 7 days
}

/**
 * Advanced search options
 */
export interface AdvancedSearchOptions {
  query?: string;
  platform?: SourcePlatform;
  category?: TopicCategory;
  author?: string;
  influencerId?: string;
  minScore?: number;
  status?: string;
  limit?: number;
  sortBy?: 'relevance' | 'date' | 'score';
}

/**
 * Knowledge Store - Persists knowledge items to disk
 *
 * Storage structure:
 * ~/.nomoreaislop/knowledge/
 *   ├── index.json              # Collection index with category mappings
 *   └── items/
 *       ├── {uuid}.json         # Individual knowledge items
 *       └── ...
 */
export class KnowledgeStore {
  private urlIndex: Map<string, string> = new Map(); // URL -> ID
  private collection: KnowledgeCollection | null = null;
  private initialized = false;

  /**
   * Initialize storage directories and load index
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await mkdir(ITEMS_PATH, { recursive: true });
    await this.loadIndex();
    this.initialized = true;
  }

  /**
   * Ensure store is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Load the collection index from disk
   */
  private async loadIndex(): Promise<void> {
    try {
      const content = await readFile(INDEX_PATH, 'utf-8');
      this.collection = JSON.parse(content) as KnowledgeCollection;

      // Rebuild URL index from items
      const items = await this.listItemsInternal();
      for (const item of items) {
        this.urlIndex.set(item.source.url, item.id);
      }
    } catch {
      // Initialize new collection if file doesn't exist
      this.collection = {
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        categories: {} as Record<TopicCategory, string[]>,
        totalItems: 0,
      };
    }
  }

  /**
   * Save the collection index to disk
   */
  private async saveIndex(): Promise<void> {
    if (!this.collection) return;

    this.collection.updatedAt = new Date().toISOString();
    await writeFile(INDEX_PATH, JSON.stringify(this.collection, null, 2), 'utf-8');
  }

  /**
   * Save a knowledge item to storage
   * @returns Path where item was saved
   */
  async saveItem(item: KnowledgeItem): Promise<string> {
    await this.ensureInitialized();

    const filePath = join(ITEMS_PATH, `${item.id}.json`);
    await writeFile(filePath, JSON.stringify(item, null, 2), 'utf-8');

    // Update URL index
    this.urlIndex.set(item.source.url, item.id);

    // Update collection index
    await this.updateCollection(item);

    return filePath;
  }

  /**
   * Load a knowledge item by ID
   */
  async loadItem(id: string): Promise<KnowledgeItem | null> {
    await this.ensureInitialized();

    try {
      const filePath = join(ITEMS_PATH, `${id}.json`);
      const content = await readFile(filePath, 'utf-8');
      const result = KnowledgeItemSchema.safeParse(JSON.parse(content));
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if an item already exists by URL
   */
  async hasItemByUrl(url: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.urlIndex.has(url);
  }

  /**
   * Get an item by its source URL
   */
  async getItemByUrl(url: string): Promise<KnowledgeItem | null> {
    await this.ensureInitialized();

    const id = this.urlIndex.get(url);
    if (!id) return null;
    return this.loadItem(id);
  }

  /**
   * List all knowledge items (internal, no init check)
   */
  private async listItemsInternal(): Promise<KnowledgeItem[]> {
    try {
      const files = await readdir(ITEMS_PATH);
      const items: KnowledgeItem[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const id = file.replace('.json', '');
        const item = await this.loadItem(id);
        if (item) items.push(item);
      }

      return items;
    } catch {
      return [];
    }
  }

  /**
   * List all knowledge items
   */
  async listItems(): Promise<KnowledgeItem[]> {
    await this.ensureInitialized();
    return this.listItemsInternal();
  }

  /**
   * List items by category
   */
  async listByCategory(category: TopicCategory): Promise<KnowledgeItem[]> {
    await this.ensureInitialized();

    const ids = this.collection?.categories[category] || [];
    const items: KnowledgeItem[] = [];

    for (const id of ids) {
      const item = await this.loadItem(id);
      if (item) items.push(item);
    }

    return items;
  }

  /**
   * Search items by text query (simple text matching)
   */
  async search(query: string, limit: number = 10): Promise<KnowledgeItem[]> {
    await this.ensureInitialized();

    const items = await this.listItems();
    const queryLower = query.toLowerCase();

    // Score each item by match quality using the shared helper
    const scored = items.map((item) => ({
      item,
      score: this.calculateTextMatchScore(item, queryLower),
    }));

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.item);
  }

  /**
   * Get items with high relevance scores
   */
  async getTopItems(limit: number = 10): Promise<KnowledgeItem[]> {
    await this.ensureInitialized();

    const items = await this.listItems();
    return items
      .filter((item) => item.status === 'approved' || item.status === 'reviewed')
      .sort((a, b) => b.relevance.score - a.relevance.score)
      .slice(0, limit);
  }

  /**
   * Update the collection index with a new/updated item
   */
  private async updateCollection(item: KnowledgeItem): Promise<void> {
    if (!this.collection) {
      this.collection = {
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        categories: {} as Record<TopicCategory, string[]>,
        totalItems: 0,
      };
    }

    // Add to category if not already present
    const categories = this.collection.categories;
    if (!categories[item.category]) {
      categories[item.category] = [];
    }

    const categoryItems = categories[item.category];
    if (categoryItems && !categoryItems.includes(item.id)) {
      categoryItems.push(item.id);
      this.collection.totalItems++;
    }

    await this.saveIndex();
  }

  /**
   * Delete an item by ID
   */
  async deleteItem(id: string): Promise<boolean> {
    await this.ensureInitialized();

    const item = await this.loadItem(id);
    if (!item) return false;

    try {
      const { unlink } = await import('node:fs/promises');
      const filePath = join(ITEMS_PATH, `${id}.json`);
      await unlink(filePath);

      // Remove from URL index
      this.urlIndex.delete(item.source.url);

      // Remove from collection
      const categoryItems = this.collection?.categories[item.category];
      if (categoryItems) {
        const idx = categoryItems.indexOf(id);
        if (idx !== -1) {
          categoryItems.splice(idx, 1);
          if (this.collection) {
            this.collection.totalItems--;
          }
        }
        await this.saveIndex();
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<KnowledgeStats> {
    await this.ensureInitialized();

    const items = await this.listItems();

    const byStatus: Record<string, number> = {};
    for (const item of items) {
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    }

    const byCategory: Partial<Record<TopicCategory, number>> = {};
    for (const [cat, ids] of Object.entries(this.collection?.categories || {})) {
      byCategory[cat as TopicCategory] = ids.length;
    }

    const byPlatform: Partial<Record<SourcePlatform, number>> = {};
    for (const item of items) {
      const platform = item.source.platform;
      byPlatform[platform] = (byPlatform[platform] || 0) + 1;
    }

    return {
      totalItems: this.collection?.totalItems || 0,
      byCategory,
      byStatus,
      byPlatform,
    };
  }

  /**
   * Get the collection metadata
   */
  async getCollection(): Promise<KnowledgeCollection | null> {
    await this.ensureInitialized();
    return this.collection;
  }

  /**
   * List items by platform
   */
  async listByPlatform(platform: SourcePlatform): Promise<KnowledgeItem[]> {
    await this.ensureInitialized();
    const items = await this.listItems();
    return items.filter((item) => item.source.platform === platform);
  }

  /**
   * List items by author (name or handle)
   */
  async listByAuthor(author: string): Promise<KnowledgeItem[]> {
    await this.ensureInitialized();
    const items = await this.listItems();
    const normalizedAuthor = author.toLowerCase();

    return items.filter((item) => {
      const sourceAuthor = item.source.author?.toLowerCase();
      const sourceHandle = item.source.authorHandle?.toLowerCase();
      return (
        sourceAuthor?.includes(normalizedAuthor) ||
        sourceHandle?.includes(normalizedAuthor)
      );
    });
  }

  /**
   * List items by influencer ID
   */
  async listByInfluencer(influencerId: string): Promise<KnowledgeItem[]> {
    await this.ensureInitialized();
    const items = await this.listItems();
    return items.filter((item) => item.source.influencerId === influencerId);
  }

  /**
   * List items with high credibility (from tracked influencers)
   */
  async listHighCredibility(): Promise<KnowledgeItem[]> {
    await this.ensureInitialized();
    const items = await this.listItems();
    return items.filter(
      (item) => item.source.credibilityTier === 'high' || item.source.influencerId
    );
  }

  /**
   * Advanced search with multiple filters
   */
  async searchAdvanced(options: AdvancedSearchOptions): Promise<KnowledgeItem[]> {
    await this.ensureInitialized();
    let items = await this.listItems();

    // Apply filters
    if (options.platform) {
      items = items.filter((i) => i.source.platform === options.platform);
    }

    if (options.category) {
      items = items.filter((i) => i.category === options.category);
    }

    if (options.author) {
      const normalizedAuthor = options.author.toLowerCase();
      items = items.filter((i) => {
        const sourceAuthor = i.source.author?.toLowerCase();
        const sourceHandle = i.source.authorHandle?.toLowerCase();
        return (
          sourceAuthor?.includes(normalizedAuthor) ||
          sourceHandle?.includes(normalizedAuthor)
        );
      });
    }

    if (options.influencerId) {
      items = items.filter((i) => i.source.influencerId === options.influencerId);
    }

    if (options.minScore !== undefined) {
      items = items.filter((i) => i.relevance.score >= options.minScore!);
    }

    if (options.status) {
      items = items.filter((i) => i.status === options.status);
    }

    if (options.query) {
      const queryLower = options.query.toLowerCase();
      items = items.filter((i) =>
        i.title.toLowerCase().includes(queryLower) ||
        i.summary.toLowerCase().includes(queryLower) ||
        i.tags.some((t) => t.toLowerCase().includes(queryLower)) ||
        i.content.toLowerCase().includes(queryLower)
      );
    }

    // Sort
    switch (options.sortBy) {
      case 'date':
        items.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'score':
        items.sort((a, b) => b.relevance.score - a.relevance.score);
        break;
      case 'relevance':
      default:
        // Keep original order or apply text match scoring if query provided
        if (options.query) {
          const queryLower = options.query.toLowerCase();
          items.sort((a, b) => {
            const scoreA = this.calculateTextMatchScore(a, queryLower);
            const scoreB = this.calculateTextMatchScore(b, queryLower);
            return scoreB - scoreA;
          });
        }
        break;
    }

    // Apply limit
    if (options.limit) {
      items = items.slice(0, options.limit);
    }

    return items;
  }

  /**
   * Calculate text match score for sorting
   */
  private calculateTextMatchScore(item: KnowledgeItem, query: string): number {
    let score = 0;
    if (item.title.toLowerCase().includes(query)) score += 3;
    if (item.summary.toLowerCase().includes(query)) score += 2;
    if (item.tags.some((t) => t.toLowerCase().includes(query))) score += 2;
    if (item.content.toLowerCase().includes(query)) score += 1;
    return score;
  }

  /**
   * Get quality metrics for the knowledge base
   */
  async getQualityMetrics(): Promise<QualityMetrics> {
    await this.ensureInitialized();
    const items = await this.listItems();

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const platformDistribution: Partial<Record<SourcePlatform, number>> = {};
    const categoryDistribution: Partial<Record<TopicCategory, number>> = {};
    let totalScore = 0;
    let highQualityCount = 0;
    let influencerContentCount = 0;
    let recentItemsCount = 0;

    for (const item of items) {
      // Platform distribution
      const platform = item.source.platform;
      platformDistribution[platform] = (platformDistribution[platform] || 0) + 1;

      // Category distribution
      categoryDistribution[item.category] = (categoryDistribution[item.category] || 0) + 1;

      // Score metrics
      totalScore += item.relevance.score;
      if (item.relevance.score >= 0.7) {
        highQualityCount++;
      }

      // Influencer content
      if (item.source.influencerId || item.source.credibilityTier === 'high') {
        influencerContentCount++;
      }

      // Recent items
      const itemDate = new Date(item.createdAt);
      if (itemDate >= sevenDaysAgo) {
        recentItemsCount++;
      }
    }

    return {
      totalItems: items.length,
      averageRelevanceScore: items.length > 0 ? totalScore / items.length : 0,
      highQualityCount,
      influencerContentCount,
      platformDistribution,
      categoryDistribution,
      recentItemsCount,
    };
  }
}

// Singleton instance
export const knowledgeStore = new KnowledgeStore();
