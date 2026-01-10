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
} from '../models/index.js';

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

    // Score each item by match quality
    const scored = items.map((item) => {
      let score = 0;
      if (item.title.toLowerCase().includes(queryLower)) score += 3;
      if (item.summary.toLowerCase().includes(queryLower)) score += 2;
      if (item.tags.some((t) => t.toLowerCase().includes(queryLower))) score += 2;
      if (item.content.toLowerCase().includes(queryLower)) score += 1;
      return { item, score };
    });

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

    return {
      totalItems: this.collection?.totalItems || 0,
      byCategory,
      byStatus,
    };
  }

  /**
   * Get the collection metadata
   */
  async getCollection(): Promise<KnowledgeCollection | null> {
    await this.ensureInitialized();
    return this.collection;
  }
}

// Singleton instance
export const knowledgeStore = new KnowledgeStore();
