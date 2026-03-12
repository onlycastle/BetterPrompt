import type {
  DimensionName,
  KnowledgeItem,
  SourcePlatform,
  TopicCategory,
} from '../models/index';
import { TOPIC_TO_DIMENSION_MAP } from '../models/index';
import { knowledgeStore, type QualityMetrics } from '../storage/index';

export interface KnowledgeFilters {
  dimension?: DimensionName;
  dimensions?: DimensionName[];
  category?: TopicCategory;
  platform?: SourcePlatform;
  status?: string;
  minScore?: number;
  author?: string;
  query?: string;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'relevance_score' | 'created_at' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

function mapCategory(category?: TopicCategory) {
  return category ? TOPIC_TO_DIMENSION_MAP[category] : undefined;
}

function matchesDimension(item: KnowledgeItem, dimensions: DimensionName[]) {
  const itemDimensions = item.applicableDimensions?.length
    ? item.applicableDimensions
    : [TOPIC_TO_DIMENSION_MAP[item.category || 'other']];

  return dimensions.some((dimension) => itemDimensions.includes(dimension));
}

function toSortBy(sortBy?: QueryOptions['sortBy']) {
  switch (sortBy) {
    case 'relevance_score':
      return 'score';
    case 'created_at':
      return 'date';
    default:
      return undefined;
  }
}

function sortItems(
  items: KnowledgeItem[],
  sortBy?: QueryOptions['sortBy'],
  sortOrder: QueryOptions['sortOrder'] = 'desc'
) {
  const multiplier = sortOrder === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    switch (sortBy) {
      case 'relevance_score':
        return (a.relevance.score - b.relevance.score) * multiplier;
      case 'title':
        return a.title.localeCompare(b.title) * multiplier;
      case 'created_at':
      default:
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * multiplier;
    }
  });
}

function paginate<T>(items: T[], options?: QueryOptions): PaginatedResult<T> {
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? items.length;
  const pageItems = items.slice(offset, offset + limit);

  return {
    items: pageItems,
    total: items.length,
    hasMore: offset + limit < items.length,
  };
}

export const knowledgeDb = {
  async save(item: KnowledgeItem): Promise<KnowledgeItem> {
    await knowledgeStore.saveItem(item);
    return item;
  },

  async hasItemByUrl(url: string): Promise<boolean> {
    return knowledgeStore.hasItemByUrl(url);
  },

  async findAll(options?: QueryOptions): Promise<PaginatedResult<KnowledgeItem>> {
    const items = sortItems(await knowledgeStore.listItems(), options?.sortBy, options?.sortOrder);
    return paginate(items, options);
  },

  async search(
    filters: KnowledgeFilters & { query?: string },
    options?: QueryOptions
  ): Promise<PaginatedResult<KnowledgeItem>> {
    const requestedDimensions = filters.dimensions?.length
      ? filters.dimensions
      : filters.dimension
        ? [filters.dimension]
        : mapCategory(filters.category)
          ? [mapCategory(filters.category)!]
          : [];

    let items = await knowledgeStore.searchAdvanced({
      query: filters.query,
      platform: filters.platform,
      category: filters.category,
      author: filters.author,
      minScore: filters.minScore,
      status: filters.status,
      limit: undefined,
      sortBy: toSortBy(options?.sortBy),
    });

    if (requestedDimensions.length > 0) {
      items = items.filter((item) => matchesDimension(item, requestedDimensions));
    }

    const sorted = sortItems(items, options?.sortBy, options?.sortOrder);
    return paginate(sorted, options);
  },

  async findByPlatform(platform: KnowledgeItem['source']['platform']): Promise<KnowledgeItem[]> {
    return knowledgeStore.listByPlatform(platform);
  },

  async getStats() {
    return knowledgeStore.getStats();
  },

  async getQualityMetrics(): Promise<QualityMetrics> {
    return knowledgeStore.getQualityMetrics();
  },
};
