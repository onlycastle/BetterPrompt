/**
 * Portable Knowledge Resource Matcher
 *
 * Deterministic matching logic (no LLM) that connects growth areas
 * to curated learning resources. This is the shared, repository-free
 * version of the server's Phase 2.75 KnowledgeResourceMatcher.
 *
 * The server version uses repository abstractions (IKnowledgeRepository,
 * IProfessionalInsightRepository) backed by SQLite. This portable version
 * accepts pre-loaded data arrays, making it usable from both server and plugin.
 *
 * Two-level matching:
 * Level 1 (Mandatory Filter): Dimension overlap
 * Level 2 (Relevance Ranking): Keyword + style boosting
 *
 * @module @betterprompt/shared/matching/knowledge-resource-matcher
 */

// ============================================================================
// Types
// ============================================================================

/** A growth area insight for knowledge matching. */
export interface GrowthAreaInsight {
  title: string;
  description: string;
  recommendation: string;
  dimension: string;
}

/** A curated knowledge item (article, tutorial, etc.). */
export interface PortableKnowledgeItem {
  id: string;
  title: string;
  summary: string;
  sourceUrl: string;
  sourceAuthor: string;
  contentType: string;
  tags: string[];
  applicableDimensions: string[];
  subCategories?: Record<string, string[]>;
  relevanceScore: number;
}

/** A curated professional insight. */
export interface PortableProfessionalInsight {
  id: string;
  title: string;
  keyTakeaway: string;
  actionableAdvice: string[];
  sourceAuthor: string;
  sourceUrl: string;
  category: string;
  priority: number;
  applicableDimensions: string[];
  applicableStyles?: string[];
  applicableControlLevels?: string[];
}

/** Matched knowledge item with score. */
export interface MatchedKnowledgeItem {
  id: string;
  title: string;
  summary: string;
  sourceUrl: string;
  sourceAuthor: string;
  contentType: string;
  tags: string[];
  relevanceScore: number;
  matchScore: number;
}

/** Matched professional insight with score. */
export interface MatchedProfessionalInsight {
  id: string;
  title: string;
  keyTakeaway: string;
  actionableAdvice: string[];
  sourceAuthor: string;
  sourceUrl: string;
  category: string;
  priority: number;
  matchScore: number;
}

/** Result: matched resources grouped by dimension. */
export interface DimensionResourceMatch {
  dimension: string;
  dimensionDisplayName: string;
  knowledgeItems: MatchedKnowledgeItem[];
  professionalInsights: MatchedProfessionalInsight[];
}

/** Context extracted from type classification for Level 2 matching. */
export interface MatchingContext {
  primaryType?: string;
  controlLevel?: string;
  growthAreasByDimension: Map<string, GrowthAreaInsight[]>;
}

// ============================================================================
// Dimension Display Names
// ============================================================================

const DIMENSION_DISPLAY_NAMES: Record<string, string> = {
  aiCollaboration: 'AI Collaboration Mastery',
  contextEngineering: 'Context Engineering',
  burnoutRisk: 'Burnout Risk Assessment',
  aiControl: 'AI Control & Verification',
  skillResilience: 'Skill Resilience',
  TrustVerification: 'Trust & Verification',
  KnowledgeGap: 'Knowledge Gaps',
  WorkflowHabit: 'Workflow Habits',
  ContextEfficiency: 'Context Efficiency',
  CommunicationPatterns: 'Communication Patterns',
};

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Match knowledge resources to growth area dimensions.
 *
 * Repository-free version: accepts pre-loaded knowledge items and
 * professional insights arrays directly.
 *
 * @param context - Matching context with growth areas by dimension
 * @param knowledgeItems - Pre-loaded knowledge items (from DB, JSON, or API)
 * @param professionalInsights - Pre-loaded professional insights
 * @returns Array of DimensionResourceMatch, one per dimension with growth areas
 */
export function matchKnowledgeResources(
  context: MatchingContext,
  knowledgeItems: PortableKnowledgeItem[],
  professionalInsights: PortableProfessionalInsight[],
): DimensionResourceMatch[] {
  if (context.growthAreasByDimension.size === 0) {
    return [];
  }

  const results: DimensionResourceMatch[] = [];

  for (const [dimension, growthAreas] of context.growthAreasByDimension) {
    // Level 1: Filter items by dimension
    const dimensionItems = knowledgeItems.filter(item =>
      item.applicableDimensions.includes(dimension),
    );

    const dimensionInsights = professionalInsights.filter(insight =>
      insight.applicableDimensions.includes(dimension),
    );

    // Level 2: Score and rank
    const scoredItems = scoreKnowledgeItems(dimensionItems, dimension, growthAreas);
    const scoredInsights = scoreProfessionalInsights(dimensionInsights, context);

    if (scoredItems.length > 0 || scoredInsights.length > 0) {
      results.push({
        dimension,
        dimensionDisplayName: DIMENSION_DISPLAY_NAMES[dimension] ?? dimension,
        knowledgeItems: scoredItems,
        professionalInsights: scoredInsights,
      });
    }
  }

  return results;
}

// ============================================================================
// Domain → Dimension Mapping
// ============================================================================

/** Maps worker domain → knowledge base dimension (used for resource matching, NOT report display). */
const DOMAIN_TO_KB_DIMENSION: Record<string, string> = {
  thinkingQuality: 'TrustVerification',
  communicationPatterns: 'CommunicationPatterns',
  learningBehavior: 'KnowledgeGap',
  contextEfficiency: 'ContextEfficiency',
  sessionOutcome: 'WorkflowHabit',
};

const MISTAKE_CATEGORY_TO_DIMENSION: Record<string, string> = {
  debugging: 'WorkflowHabit',
  syntax: 'KnowledgeGap',
  logic: 'WorkflowHabit',
  testing: 'TrustVerification',
  security: 'TrustVerification',
  architecture: 'ContextEfficiency',
  performance: 'ContextEfficiency',
  documentation: 'CommunicationPatterns',
};

/**
 * Extract matching context from domain results.
 * Can be used by both server and plugin to build context before matching.
 */
export function extractMatchingContextFromDomainResults(
  domainResults: Array<{
    domain: string;
    growthAreas: Array<{ title: string; description: string; recommendation?: string }>;
    data?: Record<string, unknown>;
  }>,
  primaryType?: string,
  controlLevel?: string,
): MatchingContext {
  const growthAreasByDimension = new Map<string, GrowthAreaInsight[]>();

  for (const result of domainResults) {
    const dimension = DOMAIN_TO_KB_DIMENSION[result.domain];
    if (!dimension) continue;

    // Add growth areas from strengths/growthAreas
    for (const area of result.growthAreas) {
      if (!growthAreasByDimension.has(dimension)) {
        growthAreasByDimension.set(dimension, []);
      }
      growthAreasByDimension.get(dimension)!.push({
        title: area.title,
        description: area.description,
        recommendation: area.recommendation ?? '',
        dimension,
      });
    }

    // Extract additional growth areas from thinkingQuality data
    if (result.domain === 'thinkingQuality' && result.data) {
      const antiPatterns = result.data.verificationAntiPatterns;
      if (Array.isArray(antiPatterns)) {
        const dim = 'TrustVerification';
        if (!growthAreasByDimension.has(dim)) {
          growthAreasByDimension.set(dim, []);
        }
        for (const ap of antiPatterns) {
          if (typeof ap === 'object' && ap !== null) {
            const typed = ap as Record<string, unknown>;
            growthAreasByDimension.get(dim)!.push({
              title: String(typed.type ?? '').replace(/_/g, ' '),
              description: `Detected ${String(typed.type ?? '')} pattern`,
              recommendation: typeof typed.improvement === 'string' ? typed.improvement : '',
              dimension: dim,
            });
          }
        }
      }
    }

    // Extract knowledge gaps from learningBehavior data
    if (result.domain === 'learningBehavior' && result.data) {
      const gaps = result.data.knowledgeGaps;
      if (Array.isArray(gaps)) {
        const dim = 'KnowledgeGap';
        if (!growthAreasByDimension.has(dim)) {
          growthAreasByDimension.set(dim, []);
        }
        for (const gap of gaps) {
          if (typeof gap === 'object' && gap !== null) {
            const typed = gap as Record<string, unknown>;
            const topic = String(typed.topic ?? typed.area ?? '');
            growthAreasByDimension.get(dim)!.push({
              title: topic,
              description: `Knowledge gap in ${topic}`,
              recommendation: `Study ${topic} to strengthen understanding`,
              dimension: dim,
            });
          }
        }
      }

      // Extract repeated mistakes → dimension mapping
      const mistakes = result.data.repeatedMistakePatterns;
      if (Array.isArray(mistakes)) {
        for (const rm of mistakes) {
          if (typeof rm === 'object' && rm !== null) {
            const typed = rm as Record<string, unknown>;
            const category = String(typed.category ?? '').toLowerCase();
            const dim = MISTAKE_CATEGORY_TO_DIMENSION[category] ?? 'WorkflowHabit';
            if (!growthAreasByDimension.has(dim)) {
              growthAreasByDimension.set(dim, []);
            }
            growthAreasByDimension.get(dim)!.push({
              title: String(typed.mistakeType ?? typed.category ?? ''),
              description: typeof typed.description === 'string' ? typed.description : '',
              recommendation: typeof typed.recommendation === 'string' ? typed.recommendation : '',
              dimension: dim,
            });
          }
        }
      }
    }
  }

  return {
    primaryType,
    controlLevel,
    growthAreasByDimension,
  };
}

// ============================================================================
// Level 2 Scoring: Knowledge Items
// ============================================================================

function scoreKnowledgeItems(
  items: PortableKnowledgeItem[],
  dimension: string,
  growthAreas: GrowthAreaInsight[],
): MatchedKnowledgeItem[] {
  return items
    .map(item => {
      const baseScore = item.relevanceScore * 5;
      const tagScore = computeTagOverlap(item.tags, growthAreas);
      const subCatScore = computeSubCategoryOverlap(
        item.subCategories?.[dimension],
        growthAreas,
      );
      const matchScore = Math.min(baseScore + tagScore + subCatScore, 10);

      return {
        id: item.id,
        title: item.title,
        summary: item.summary,
        sourceUrl: item.sourceUrl,
        sourceAuthor: item.sourceAuthor,
        contentType: item.contentType,
        tags: item.tags,
        relevanceScore: item.relevanceScore,
        matchScore: Math.round(matchScore * 100) / 100,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

// ============================================================================
// Level 2 Scoring: Professional Insights
// ============================================================================

function scoreProfessionalInsights(
  insights: PortableProfessionalInsight[],
  context: MatchingContext,
): MatchedProfessionalInsight[] {
  return insights
    .map(insight => {
      let score = insight.priority;

      if (context.primaryType && insight.applicableStyles?.includes(context.primaryType)) {
        score += 2.0;
      }
      if (context.controlLevel && insight.applicableControlLevels?.includes(context.controlLevel)) {
        score += 1.5;
      }

      const matchScore = Math.min(score, 10);

      return {
        id: insight.id,
        title: insight.title,
        keyTakeaway: insight.keyTakeaway,
        actionableAdvice: insight.actionableAdvice,
        sourceAuthor: insight.sourceAuthor,
        sourceUrl: insight.sourceUrl,
        category: insight.category,
        priority: insight.priority,
        matchScore: Math.round(matchScore * 100) / 100,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

// ============================================================================
// Tag & SubCategory Overlap (exported for testing)
// ============================================================================

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
    growthText.includes(tag.toLowerCase().replace(/-/g, ' ')),
  ).length;

  return Math.min(matchCount, 3);
}

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
    growthText.includes(kw.toLowerCase()),
  ).length;

  return Math.min(matchCount * 0.5, 2);
}
