import { NextRequest, NextResponse } from 'next/server';
import {
  TOPIC_TO_DIMENSION_MAP,
  type DimensionName,
  type KnowledgeItem,
  type TopicCategory,
} from '@/lib/search-agent/models';
import { knowledgeStore } from '@/lib/search-agent/storage/knowledge-store';

function normalizeKnowledgeItem(item: KnowledgeItem): KnowledgeItem & { category: TopicCategory } {
  return {
    ...item,
    category: item.category || 'other',
  };
}

function getItemDimensions(item: KnowledgeItem): DimensionName[] {
  if (item.applicableDimensions?.length) {
    return item.applicableDimensions;
  }
  return [TOPIC_TO_DIMENSION_MAP[item.category || 'other']];
}

function applyFilters(items: KnowledgeItem[], request: NextRequest): KnowledgeItem[] {
  const params = request.nextUrl.searchParams;
  const platform = params.get('platform');
  const category = params.get('category');
  const status = params.get('status');
  const author = params.get('author')?.toLowerCase();
  const influencerId = params.get('influencerId');
  const minScore = params.get('minScore');
  const query = params.get('query')?.toLowerCase();
  const dimension = params.get('dimension');
  const dimensions = params.get('dimensions')
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) as DimensionName[] | undefined;

  let filtered = items.map(normalizeKnowledgeItem);

  if (platform) {
    filtered = filtered.filter((item) => item.source.platform === platform);
  }

  if (category) {
    filtered = filtered.filter((item) => item.category === category);
  }

  if (status) {
    filtered = filtered.filter((item) => item.status === status);
  }

  if (author) {
    filtered = filtered.filter((item) =>
      item.source.author?.toLowerCase().includes(author)
      || item.source.authorHandle?.toLowerCase().includes(author)
    );
  }

  if (influencerId) {
    filtered = filtered.filter((item) => item.source.influencerId === influencerId);
  }

  if (minScore) {
    const threshold = Number.parseFloat(minScore);
    if (Number.isFinite(threshold)) {
      filtered = filtered.filter((item) => item.relevance.score >= threshold);
    }
  }

  if (query) {
    filtered = filtered.filter((item) =>
      item.title.toLowerCase().includes(query)
      || item.summary.toLowerCase().includes(query)
      || item.content.toLowerCase().includes(query)
      || item.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }

  const requestedDimensions = dimensions?.length ? dimensions : (dimension ? [dimension as DimensionName] : []);
  if (requestedDimensions.length > 0) {
    filtered = filtered.filter((item) =>
      requestedDimensions.some((value) => getItemDimensions(item).includes(value))
    );
  }

  const sortBy = request.nextUrl.searchParams.get('sortBy') || 'createdAt';
  const sortOrder = request.nextUrl.searchParams.get('sortOrder') === 'asc' ? 1 : -1;
  filtered.sort((a, b) => {
    if (sortBy === 'relevance') {
      return (a.relevance.score - b.relevance.score) * sortOrder;
    }
    return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortOrder;
  });

  return filtered;
}

export async function GET(request: NextRequest) {
  try {
    const items = applyFilters(await knowledgeStore.listItems(), request);
    const offset = Number.parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);
    const limit = Number.parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const pageOffset = Number.isFinite(offset) && offset > 0 ? offset : 0;
    const pageSize = Number.isFinite(limit) && limit > 0 ? limit : 50;

    return NextResponse.json({
      items: items.slice(pageOffset, pageOffset + pageSize).map(normalizeKnowledgeItem),
      total: items.length,
      page: Math.floor(pageOffset / pageSize) + 1,
      pageSize,
    });
  } catch (error) {
    console.error('[Knowledge/List] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
