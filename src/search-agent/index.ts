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
export * from './models/index.js';

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
  // Criteria & Taxonomy
  RELEVANCE_CRITERIA,
  KNOWLEDGE_TAXONOMY,
  getTaxonomyNode,
} from './skills/index.js';

// ============================================================================
// Storage
// ============================================================================
export {
  KnowledgeStore,
  knowledgeStore,
  KNOWLEDGE_BASE_PATH,
  type KnowledgeStats,
} from './storage/index.js';

// ============================================================================
// Orchestration
// ============================================================================

import { randomUUID } from 'node:crypto';
import { createGatherer, GathererOutput, WebSearchItem } from './skills/gatherer/index.js';
import { createJudge, JudgeOutput } from './skills/judge/index.js';
import { createOrganizer, OrganizerOutput, RawContent } from './skills/organizer/index.js';
import { SearchQuery, KnowledgeItem } from './models/index.js';
import { knowledgeStore } from './storage/index.js';
import type { SkillConfig } from './skills/base-skill.js';

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
  await knowledgeStore.initialize();
  const existingItems = await knowledgeStore.listItems();
  const existingKnowledge = existingItems.map((item) => item.summary);

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
  await knowledgeStore.initialize();
  return knowledgeStore.search(query, limit);
}

/**
 * Get knowledge base statistics
 *
 * @returns Statistics about the knowledge base
 */
export async function getKnowledgeStats() {
  await knowledgeStore.initialize();
  return knowledgeStore.getStats();
}

/**
 * Get top-rated knowledge items
 *
 * @param limit - Maximum items to return
 * @returns Top-rated knowledge items
 */
export async function getTopKnowledge(limit: number = 10): Promise<KnowledgeItem[]> {
  await knowledgeStore.initialize();
  return knowledgeStore.getTopItems(limit);
}
