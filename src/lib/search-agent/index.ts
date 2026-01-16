/**
 * Search Agent Module
 *
 * Gathers, evaluates, and organizes AI engineering knowledge.
 *
 * @module search-agent
 */

// ============================================================================
// Models
// ============================================================================
export * from './models/index';

// ============================================================================
// Skills
// ============================================================================
export {
  // Base
  BaseSkill,
  SkillError,
  type SkillResult,
  type SkillConfig,
  // Gatherer
  GathererSkill,
  createGatherer,
  createSearchQuery,
  type GathererInput,
  type GathererOutput,
  type WebSearchItem,
  // Judge
  JudgeSkill,
  createJudge,
  type JudgeInput,
  type JudgeOutput,
  // Organizer
  OrganizerSkill,
  createOrganizer,
  type OrganizerInput,
  type OrganizerOutput,
  type RawContent,
  // Transcript
  TranscriptSkill,
  createTranscriptSkill,
  parseYouTubeVideoId,
  parseYouTubePlaylistId,
  isYouTubeUrl,
  TranscriptError,
  type TranscriptInput,
  type TranscriptOutput,
  type VideoAnalysisResult,
  type YouTubeTranscript,
  type AnalyzedTranscript,
  // Criteria & Taxonomy
  RELEVANCE_CRITERIA,
  KNOWLEDGE_TAXONOMY,
  getTaxonomyNode,
  // Discovery
  DiscoverySkill,
  createDiscoverySkill,
  aggregateInfluencers,
  generateSearchQueries,
  getTopicQueries,
  estimateQueryCount,
  type DiscoveryInput,
  type DiscoveryOutput,
  type WebSearchResult,
  type SearchQueryDef,
} from './skills/index';

// ============================================================================
// Storage (Legacy - File-based)
// ============================================================================
export {
  KnowledgeStore,
  knowledgeStore,
  KNOWLEDGE_BASE_PATH,
  type KnowledgeStats,
  type QualityMetrics,
  type AdvancedSearchOptions,
} from './storage/index';

// ============================================================================
// Database (Supabase)
// ============================================================================
export {
  knowledgeDb,
  influencerDb,
  type KnowledgeFilters,
  type QueryOptions,
  type PaginatedResult,
} from './db/index';

// ============================================================================
// Influencers
// ============================================================================
export {
  InfluencerRegistryManager,
  getInfluencerRegistry,
  createInfluencerRegistry,
  INFLUENCER_REGISTRY_PATH,
  InfluencerDetector,
  getInfluencerDetector,
  createInfluencerDetector,
  type DetectionResult,
} from './influencers/index';

// ============================================================================
// Orchestration
// ============================================================================

import { randomUUID } from 'node:crypto';
import { createGatherer, GathererOutput, WebSearchItem } from './skills/gatherer/index';
import { createJudge, JudgeOutput } from './skills/judge/index';
import { createOrganizer, OrganizerOutput, RawContent } from './skills/organizer/index';
import { SearchQuery, KnowledgeItem } from './models/index';
import { knowledgeDb } from './db/index';
import type { SkillConfig } from './skills/base-skill';

/**
 * Learning pipeline configuration
 */
export interface LearnConfig extends SkillConfig {
  /** Minimum relevance score to accept (default: 0.7) */
  minScore?: number;
  /** Whether to include items for review (score 0.4-0.7) */
  includeForReview?: boolean;
}

/**
 * Learning pipeline result
 */
export interface LearnResult {
  gathered: GathererOutput;
  judged: JudgeOutput;
  organized: OrganizerOutput;
  summary: {
    totalGathered: number;
    totalJudged: number;
    totalAccepted: number;
    totalOrganized: number;
    duplicatesSkipped: number;
    errors: number;
  };
}

/**
 * Run the full learning pipeline
 *
 * Orchestrates: Gatherer → Judge → Organizer
 *
 * @param searchResults - Pre-fetched search results (from WebSearch tool)
 * @param config - Optional configuration
 * @returns Pipeline result with all outputs
 *
 * @example
 * ```typescript
 * // With search results from WebSearch
 * const results = await learn([
 *   { url: 'https://example.com/article', title: 'Title', content: 'Content...' }
 * ]);
 * console.log(`Organized ${results.summary.totalOrganized} items`);
 * ```
 */
export async function learn(
  searchResults: WebSearchItem[],
  config?: LearnConfig
): Promise<LearnResult> {
  const skillConfig: SkillConfig = {
    apiKey: config?.apiKey,
    model: config?.model,
    maxRetries: config?.maxRetries,
  };

  // Create search query for tracking
  const query: SearchQuery = {
    id: randomUUID(),
    terms: ['learn'],
    platforms: ['web'],
    maxResults: searchResults.length,
    language: 'en',
    createdAt: new Date().toISOString(),
  };

  // Step 1: Gather - Process and enhance search results
  const gatherer = createGatherer(skillConfig);
  const gatherResult = await gatherer.execute({
    query,
    searchResults,
  });

  if (!gatherResult.success || !gatherResult.data) {
    throw new Error(`Gather failed: ${gatherResult.error}`);
  }

  // Step 2: Judge - Evaluate relevance of enhanced results
  const judge = createJudge(skillConfig);

  // Get existing knowledge summaries for novelty check
  const existingResult = await knowledgeDb.findAll();
  const existingKnowledge = existingResult.items.map((item) => item.summary);

  const judgeResult = await judge.execute({
    results: gatherResult.data.enhancedResults,
    existingKnowledge,
    minScore: config?.minScore,
  });

  if (!judgeResult.success || !judgeResult.data) {
    throw new Error(`Judge failed: ${judgeResult.error}`);
  }

  // Step 3: Organize - Transform accepted items into knowledge
  const organizer = createOrganizer(skillConfig);

  // Include for-review items if configured
  const itemsToOrganize = config?.includeForReview
    ? [...judgeResult.data.accepted, ...judgeResult.data.forReview]
    : judgeResult.data.accepted;

  // Build raw content map
  const rawContents = new Map<string, RawContent>();
  for (const result of gatherResult.data.enhancedResults) {
    rawContents.set(result.url, {
      title: result.title,
      content: result.content,
    });
  }

  const organizeResult = await organizer.execute({
    judgments: itemsToOrganize,
    rawContents,
  });

  if (!organizeResult.success || !organizeResult.data) {
    throw new Error(`Organize failed: ${organizeResult.error}`);
  }

  return {
    gathered: gatherResult.data,
    judged: judgeResult.data,
    organized: organizeResult.data,
    summary: {
      totalGathered: gatherResult.data.enhancedResults.length,
      totalJudged: judgeResult.data.judgments.length,
      totalAccepted: judgeResult.data.accepted.length,
      totalOrganized: organizeResult.data.items.length,
      duplicatesSkipped: organizeResult.data.duplicatesSkipped,
      errors: organizeResult.data.errors.length,
    },
  };
}

/**
 * Search the knowledge base
 *
 * @param query - Search query string
 * @param limit - Maximum results (default: 10)
 * @returns Matching knowledge items
 */
export async function searchKnowledge(
  query: string,
  limit: number = 10
): Promise<KnowledgeItem[]> {
  const result = await knowledgeDb.search({ query }, { limit });
  return result.items;
}

/**
 * Get knowledge base statistics
 *
 * @returns Statistics about the knowledge base
 */
export async function getKnowledgeStats() {
  return knowledgeDb.getStats();
}

/**
 * Get top-rated knowledge items
 *
 * @param limit - Maximum items to return
 * @returns Top-rated knowledge items
 */
export async function getTopKnowledge(limit: number = 10): Promise<KnowledgeItem[]> {
  const result = await knowledgeDb.search({}, {
    limit,
    sortBy: 'relevance_score',
    sortOrder: 'desc',
  });
  return result.items;
}

/**
 * Get knowledge items by platform
 *
 * @param platform - Source platform to filter by
 * @returns Knowledge items from that platform
 */
export async function getKnowledgeByPlatform(
  platform: import('./models/index.js').SourcePlatform
): Promise<KnowledgeItem[]> {
  return knowledgeDb.findByPlatform(platform);
}

/**
 * Get knowledge items by author
 *
 * @param author - Author name or handle to search for
 * @returns Knowledge items from that author
 */
export async function getKnowledgeByAuthor(author: string): Promise<KnowledgeItem[]> {
  const result = await knowledgeDb.search({ author }, { limit: 100 });
  return result.items;
}

/**
 * Advanced knowledge search with multiple filters
 *
 * @param options - Search options
 * @returns Matching knowledge items
 */
export async function searchKnowledgeAdvanced(
  options: import('./storage/index.js').AdvancedSearchOptions
): Promise<KnowledgeItem[]> {
  // Map legacy options to new filter format
  const dbSortBy = options.sortBy === 'relevance' ? 'relevance_score' :
                   options.sortBy === 'date' ? 'created_at' : 'created_at';

  const result = await knowledgeDb.search({
    platform: options.platform,
    category: options.category,
    author: options.author,
    minScore: options.minScore,
    query: options.query,
  }, {
    limit: options.limit || 20,
    sortBy: dbSortBy,
    sortOrder: 'desc',
  });
  return result.items;
}

/**
 * Get quality metrics for the knowledge base
 *
 * @returns Quality metrics including scores, distributions, and counts
 */
export async function getQualityMetrics(): Promise<import('./storage/index.js').QualityMetrics> {
  return knowledgeDb.getQualityMetrics();
}

/**
 * Learn from a YouTube video transcript
 *
 * @param url - YouTube video or playlist URL
 * @param config - Optional skill configuration
 * @returns Transcript analysis results
 */
export async function learnFromYouTube(
  url: string,
  config?: SkillConfig & { processPlaylist?: boolean; maxPlaylistVideos?: number }
): Promise<import('./skills/transcript/index.js').TranscriptOutput> {
  const { createTranscriptSkill } = await import('./skills/transcript/index.js');
  const skill = createTranscriptSkill(config);
  const result = await skill.execute({
    url,
    processPlaylist: config?.processPlaylist,
    maxPlaylistVideos: config?.maxPlaylistVideos,
  });

  if (!result.success || !result.data) {
    throw new Error(`Transcript learning failed: ${result.error}`);
  }

  return result.data;
}
