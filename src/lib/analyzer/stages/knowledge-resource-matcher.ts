/**
 * Knowledge Resource Matcher - Phase 2.75 (Deterministic, No LLM)
 *
 * Matches growth areas from Phase 2 analysis to curated learning resources
 * in the Supabase Knowledge Base using two-level matching:
 *
 * Level 1 (Mandatory Filter): Dimension overlap
 *   - Knowledge items: applicableDimensions overlaps growth area dimensions
 *   - Professional insights: applicableDimensions contains dimension
 *
 * Level 2 (Relevance Ranking): Keyword + style boosting
 *   - Tag matching: growth area text vs knowledge item tags
 *   - Style matching: insight applicableStyles vs TypeClassifier primaryType
 *   - Control level matching: insight applicableControlLevels vs TypeClassifier controlLevel
 *   - SubCategory matching: item subCategories keywords vs growth area text
 *
 * @module analyzer/stages/knowledge-resource-matcher
 */

import type { AgentOutputs } from '../../models/agent-outputs';
import type {
  DimensionResourceMatch,
  MatchedKnowledgeItem,
  MatchedProfessionalInsight,
  DimensionNameEnum,
} from '../../models/verbose-evaluation';

/**
 * Growth area insight for knowledge matching.
 * Extracted from v3 workers (ThinkingQuality, LearningBehavior).
 */
interface GrowthAreaInsight {
  title: string;
  description: string;
  recommendation: string;
  dimension: string;
}
import { DIMENSION_DISPLAY_NAMES } from '../../models/verbose-evaluation';
import type { IKnowledgeRepository, IProfessionalInsightRepository } from '../../application/ports/storage';
import type { KnowledgeItem, ProfessionalInsight, DimensionName } from '../../domain/models/knowledge';

// ============================================================================
// Public Interface
// ============================================================================

/**
 * Dependencies for the knowledge resource matcher.
 * Both repositories are required when matcher is invoked.
 */
export interface KnowledgeMatcherDeps {
  knowledgeRepo: IKnowledgeRepository;
  professionalInsightRepo: IProfessionalInsightRepository;
}

/**
 * Context extracted from TypeClassifier for Level 2 matching.
 */
export interface MatchingContext {
  primaryType?: string;
  controlLevel?: string;
  growthAreasByDimension: Map<string, GrowthAreaInsight[]>;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Match knowledge resources to growth area dimensions.
 *
 * Runs after Phase 2.5 (TypeClassifier) to leverage primaryType and controlLevel
 * for style-based boosting of professional insights.
 *
 * @param agentOutputs - Combined Phase 2 + Phase 2.5 outputs
 * @param deps - Repository dependencies for Supabase queries
 * @returns Array of DimensionResourceMatch, one per dimension with growth areas
 */
export async function matchKnowledgeResources(
  agentOutputs: AgentOutputs,
  deps: KnowledgeMatcherDeps,
): Promise<DimensionResourceMatch[]> {
  // 1. Extract context from agentOutputs
  const context = extractMatchingContext(agentOutputs);

  // No growth areas → nothing to match
  if (context.growthAreasByDimension.size === 0) {
    return [];
  }

  const dimensions = [...context.growthAreasByDimension.keys()];

  // 2. Level 1: Fetch knowledge items filtered by dimensions (single DB query)
  const knowledgeResult = await deps.knowledgeRepo.search(
    { dimensions: dimensions as DimensionName[], status: 'approved' },
    { sort: { field: 'relevance', direction: 'desc' }, pagination: { limit: 50 } }
  );

  if (!knowledgeResult.success) {
    throw new Error(`Knowledge repo search failed: ${knowledgeResult.error.message}`);
  }

  // 3. Level 1: Fetch professional insights for each dimension
  const allInsights: Map<string, ProfessionalInsight[]> = new Map();
  for (const dim of dimensions) {
    // findApplicable takes dimension + score; use 50 as neutral midpoint
    const insightResult = await deps.professionalInsightRepo.findApplicable(
      dim as DimensionName,
      50
    );
    if (!insightResult.success) {
      throw new Error(`Professional insight repo failed for ${dim}: ${insightResult.error.message}`);
    }
    allInsights.set(dim, insightResult.data);
  }

  // 4. Level 2: Score and group by dimension
  const results: DimensionResourceMatch[] = [];

  for (const dim of dimensions) {
    const growthAreas = context.growthAreasByDimension.get(dim)!;

    // Score knowledge items for this dimension
    const scoredItems = scoreKnowledgeItems(
      knowledgeResult.data.items,
      dim,
      growthAreas,
    );

    // Score professional insights for this dimension
    const scoredInsights = scoreProfessionalInsights(
      allInsights.get(dim) ?? [],
      context,
    );

    // Only include dimensions that have at least one resource
    if (scoredItems.length > 0 || scoredInsights.length > 0) {
      results.push({
        dimension: dim as DimensionNameEnum,
        dimensionDisplayName: DIMENSION_DISPLAY_NAMES[dim as DimensionNameEnum] ?? dim,
        knowledgeItems: scoredItems,
        professionalInsights: scoredInsights,
      });
    }
  }

  return results;
}

// ============================================================================
// Context Extraction
// ============================================================================

/**
 * Extract matching context from agentOutputs.
 *
 * Groups growth areas by dimension. Sources from v3 workers:
 * - ThinkingQuality.verificationAntiPatterns → TrustVerification dimension
 * - LearningBehavior.repeatedMistakePatterns → category-based dimension
 */
export function extractMatchingContext(agentOutputs: AgentOutputs): MatchingContext {
  const growthAreasByDimension = new Map<string, GrowthAreaInsight[]>();

  // Source 1: ThinkingQuality anti-patterns → TrustVerification dimension
  if (agentOutputs.thinkingQuality?.verificationAntiPatterns) {
    const dim = 'TrustVerification';
    if (!growthAreasByDimension.has(dim)) {
      growthAreasByDimension.set(dim, []);
    }
    for (const ap of agentOutputs.thinkingQuality.verificationAntiPatterns) {
      growthAreasByDimension.get(dim)!.push({
        title: ap.type.replace(/_/g, ' '),
        description: `Detected ${ap.type} pattern with ${ap.frequency} frequency`,
        recommendation: ap.improvement || `Address the ${ap.type} pattern`,
        dimension: dim,
      });
    }
  }

  // Source 2: LearningBehavior repeated mistakes → category-based dimension
  if (agentOutputs.learningBehavior?.repeatedMistakePatterns) {
    for (const rm of agentOutputs.learningBehavior.repeatedMistakePatterns) {
      // Map category to dimension (e.g., "debugging" → "WorkflowHabit")
      const dim = mapMistakeCategoryToDimension(rm.category);
      if (!growthAreasByDimension.has(dim)) {
        growthAreasByDimension.set(dim, []);
      }
      growthAreasByDimension.get(dim)!.push({
        title: rm.mistakeType,
        description: `Repeated ${rm.occurrenceCount}x: ${rm.mistakeType}`,
        recommendation: rm.recommendation || `Address the ${rm.mistakeType} pattern`,
        dimension: dim,
      });
    }
  }

  // Source 3: LearningBehavior knowledge gaps → KnowledgeGap dimension
  if (agentOutputs.learningBehavior?.knowledgeGaps) {
    const dim = 'KnowledgeGap';
    if (!growthAreasByDimension.has(dim)) {
      growthAreasByDimension.set(dim, []);
    }
    for (const kg of agentOutputs.learningBehavior.knowledgeGaps) {
      growthAreasByDimension.get(dim)!.push({
        title: kg.topic,
        description: `Knowledge gap in ${kg.topic} (depth: ${kg.depth})`,
        recommendation: `Study ${kg.topic} to strengthen understanding`,
        dimension: dim,
      });
    }
  }

  return {
    primaryType: agentOutputs.typeClassifier?.primaryType,
    controlLevel: agentOutputs.typeClassifier?.controlLevel,
    growthAreasByDimension,
  };
}

/**
 * Map mistake category to a dimension for resource matching.
 */
function mapMistakeCategoryToDimension(category: string): string {
  const categoryMap: Record<string, string> = {
    debugging: 'WorkflowHabit',
    syntax: 'KnowledgeGap',
    logic: 'WorkflowHabit',
    testing: 'TrustVerification',
    security: 'TrustVerification',
    architecture: 'ContextEfficiency',
    performance: 'ContextEfficiency',
    documentation: 'CommunicationPatterns',
  };
  return categoryMap[category.toLowerCase()] || 'WorkflowHabit';
}

// ============================================================================
// Level 2 Scoring: Knowledge Items
// ============================================================================

/**
 * Score and filter knowledge items for a specific dimension.
 *
 * Only items whose applicableDimensions include this dimension are considered.
 * Score = base relevance (0-5) + tag overlap (0-3) + subCategory overlap (0-2).
 *
 * @returns Sorted by matchScore descending
 */
function scoreKnowledgeItems(
  items: KnowledgeItem[],
  dimension: string,
  growthAreas: GrowthAreaInsight[],
): MatchedKnowledgeItem[] {
  const scored: MatchedKnowledgeItem[] = [];

  for (const item of items) {
    // Level 1: Must have this dimension in applicableDimensions
    if (!item.applicableDimensions.includes(dimension as DimensionName)) {
      continue;
    }

    // Level 2: Score
    const baseScore = item.relevance.score * 5; // 0-5
    const tagScore = computeTagOverlap(item.tags, growthAreas);
    const subCatScore = computeSubCategoryOverlap(
      item.subCategories?.[dimension as DimensionName],
      growthAreas,
    );
    const matchScore = Math.min(baseScore + tagScore + subCatScore, 10);

    scored.push({
      id: item.id,
      title: item.title,
      summary: item.summary,
      sourceUrl: item.source.url,
      sourceAuthor: item.source.author,
      contentType: item.contentType,
      tags: item.tags,
      relevanceScore: item.relevance.score,
      matchScore: Math.round(matchScore * 100) / 100,
    });
  }

  // Sort by matchScore descending
  scored.sort((a, b) => b.matchScore - a.matchScore);

  return scored;
}

// ============================================================================
// Level 2 Scoring: Professional Insights
// ============================================================================

/**
 * Score professional insights for a specific dimension.
 *
 * Score = priority base (1-10) + style boost (+2.0) + control level boost (+1.5).
 * Capped at 10.
 *
 * @returns Sorted by matchScore descending
 */
function scoreProfessionalInsights(
  insights: ProfessionalInsight[],
  context: MatchingContext,
): MatchedProfessionalInsight[] {
  const scored: MatchedProfessionalInsight[] = [];

  for (const insight of insights) {
    let score = insight.priority; // base: 1-10

    // Style boost: if insight's applicableStyles includes TypeClassifier's primaryType
    if (
      context.primaryType &&
      insight.applicableStyles?.includes(context.primaryType)
    ) {
      score += 2.0;
    }

    // Control level boost: if insight's applicableControlLevels includes controlLevel
    if (
      context.controlLevel &&
      insight.applicableControlLevels?.includes(context.controlLevel)
    ) {
      score += 1.5;
    }

    const matchScore = Math.min(score, 10);

    scored.push({
      id: insight.id,
      title: insight.title,
      keyTakeaway: insight.keyTakeaway,
      actionableAdvice: insight.actionableAdvice,
      sourceAuthor: insight.source.author,
      sourceUrl: insight.source.url,
      category: insight.category,
      priority: insight.priority,
      matchScore: Math.round(matchScore * 100) / 100,
    });
  }

  // Sort by matchScore descending
  scored.sort((a, b) => b.matchScore - a.matchScore);

  return scored;
}

// ============================================================================
// Tag & SubCategory Overlap Functions
// ============================================================================

/**
 * Count how many knowledge item tags appear in growth area text.
 *
 * Concatenates title + description + recommendation from all growth areas
 * in the dimension, lowercases, then checks for substring matches.
 * Hyphenated tags (e.g., "context-engineering") are normalized to spaces.
 *
 * @returns Score 0-3 (capped)
 */
export function computeTagOverlap(
  tags: string[],
  growthAreas: GrowthAreaInsight[],
): number {
  if (tags.length === 0 || growthAreas.length === 0) return 0;

  const growthText = growthAreas
    .map(ga => `${ga.title} ${ga.description} ${ga.recommendation}`)
    .join(' ')
    .toLowerCase();

  const matchCount = tags.filter(tag =>
    growthText.includes(tag.toLowerCase().replace(/-/g, ' '))
  ).length;

  return Math.min(matchCount, 3); // cap at 3
}

/**
 * Count keyword matches from subCategories.
 *
 * SubCategories are dimension-specific keyword arrays on knowledge items.
 * Currently sparse in DB but included for future-proofing — new data
 * automatically improves matching without code changes.
 *
 * @returns Score 0-2 (capped)
 */
export function computeSubCategoryOverlap(
  keywords: string[] | undefined,
  growthAreas: GrowthAreaInsight[],
): number {
  if (!keywords || keywords.length === 0) return 0;

  const growthText = growthAreas
    .map(ga => `${ga.title} ${ga.description}`)
    .join(' ')
    .toLowerCase();

  const matchCount = keywords.filter(kw =>
    growthText.includes(kw.toLowerCase())
  ).length;

  return Math.min(matchCount * 0.5, 2); // cap at 2
}
