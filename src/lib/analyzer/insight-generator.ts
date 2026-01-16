/**
 * Insight Generator - Creates personalized dimension insights
 *
 * Combines:
 * - Knowledge Base resources (from KnowledgeLinker)
 * - Conversation quotes (from DimensionQuoteExtractor)
 * - Template/LLM-based personalized advice
 *
 * Produces DimensionInsight[] for each dimension in the unified report.
 */

import type { ParsedSession } from '../models/index';
import type {
  DimensionName,
  DimensionLevel,
  DimensionResult,
  DimensionInsight,
  ConversationInsight,
  ResearchInsight,
  LearningResource,
  EvidenceQuote,
  EvidenceCategory,
} from '../models/unified-report';
import {
  type KnowledgeLinker,
  type DimensionKnowledge,
  type LinkedInsight,
  type LinkedKnowledge,
  createKnowledgeLinker,
} from './knowledge-linker';
import {
  type ExtractedQuote,
  extractDimensionQuotes,
  extractAllDimensionQuotes,
  toEvidenceQuote,
} from './dimension-quote-extractor';
import {
  generateQuoteAdvice,
  formatProfessionalInsight,
  generateInterpretation,
} from './insight-prompts';

// ============================================
// Constants
// ============================================

const STRENGTH_THRESHOLD = 70;
const MAX_INSIGHTS_PER_DIMENSION = 3;
const DEFAULT_QUOTES_PER_DIMENSION = 3;
const DEFAULT_MAX_EVIDENCE = 10;

/**
 * Score thresholds for dimension level determination
 */
const LEVEL_THRESHOLDS = {
  expert: 85,
  proficient: 70,
  developing: 50,
} as const;

const EVIDENCE_CATEGORY_PRIORITY: Record<EvidenceCategory, number> = {
  strength: 0,
  growth: 1,
  pattern: 2,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Determine evidence category based on strength status
 */
function getEvidenceCategory(isStrength: boolean): EvidenceCategory {
  return isStrength ? 'strength' : 'growth';
}

/**
 * Determine insight type based on strength status
 */
function getInsightType(isStrength: boolean): 'reinforcement' | 'improvement' {
  return isStrength ? 'reinforcement' : 'improvement';
}

/**
 * Determine insight sentiment based on strength status
 */
function getInsightSentiment(isStrength: boolean): 'praise' | 'encouragement' {
  return isStrength ? 'praise' : 'encouragement';
}

/**
 * Determine dimension level based on score
 */
function getDimensionLevel(score: number): DimensionLevel {
  if (score >= LEVEL_THRESHOLDS.expert) return 'expert';
  if (score >= LEVEL_THRESHOLDS.proficient) return 'proficient';
  if (score >= LEVEL_THRESHOLDS.developing) return 'developing';
  return 'novice';
}

// ============================================
// Types
// ============================================

export interface InsightGeneratorConfig {
  maxInsightsPerDimension?: number;
  maxQuotesPerDimension?: number;
  includeResearchInsights?: boolean;
  includeLearningResources?: boolean;
}

export interface GeneratedInsights {
  dimension: DimensionName;
  insights: DimensionInsight[];
  evidence: EvidenceQuote[];
  interpretation: string;
}

// ============================================
// InsightGenerator Class
// ============================================

export class InsightGenerator {
  private knowledgeLinker: KnowledgeLinker;
  private config: Required<InsightGeneratorConfig>;

  constructor(
    knowledgeLinker?: KnowledgeLinker,
    config: InsightGeneratorConfig = {}
  ) {
    this.knowledgeLinker = knowledgeLinker ?? createKnowledgeLinker();
    this.config = {
      maxInsightsPerDimension: config.maxInsightsPerDimension ?? MAX_INSIGHTS_PER_DIMENSION,
      maxQuotesPerDimension: config.maxQuotesPerDimension ?? DEFAULT_QUOTES_PER_DIMENSION,
      includeResearchInsights: config.includeResearchInsights ?? true,
      includeLearningResources: config.includeLearningResources ?? true,
    };
  }

  /**
   * Generate insights for a single dimension
   */
  async generateForDimension(
    dimension: DimensionName,
    score: number,
    sessions: ParsedSession[]
  ): Promise<GeneratedInsights> {
    const isStrength = score >= STRENGTH_THRESHOLD;
    const category = getEvidenceCategory(isStrength);

    const [knowledge, quotes] = await Promise.all([
      this.knowledgeLinker.findRelevant(dimension, score),
      Promise.resolve(
        extractDimensionQuotes(sessions, dimension, this.config.maxQuotesPerDimension)
      ),
    ]);

    const insights = this.buildDimensionInsights(
      dimension,
      score,
      isStrength,
      quotes,
      knowledge
    );

    const evidence = quotes.map((q) => toEvidenceQuote(q, category));

    const interpretation = generateInterpretation(
      dimension,
      score,
      getDimensionLevel(score),
      isStrength
    );

    return {
      dimension,
      insights,
      evidence,
      interpretation,
    };
  }

  /**
   * Generate insights for all dimensions
   */
  async generateForAllDimensions(
    dimensionResults: DimensionResult[],
    sessions: ParsedSession[]
  ): Promise<Map<DimensionName, GeneratedInsights>> {
    const results = new Map<DimensionName, GeneratedInsights>();

    const allQuotes = extractAllDimensionQuotes(
      sessions,
      this.config.maxQuotesPerDimension
    );

    const knowledgePromises = dimensionResults.map((dim) =>
      this.knowledgeLinker.findRelevant(dim.name, dim.score)
    );

    const knowledgeResults = await Promise.all(knowledgePromises);

    for (let i = 0; i < dimensionResults.length; i++) {
      const dim = dimensionResults[i];
      const knowledge = knowledgeResults[i];
      const quotes = allQuotes.get(dim.name) ?? [];
      const isStrength = dim.score >= STRENGTH_THRESHOLD;
      const category = getEvidenceCategory(isStrength);

      const insights = this.buildDimensionInsights(
        dim.name,
        dim.score,
        isStrength,
        quotes,
        knowledge
      );

      const evidence = quotes.map((q) => toEvidenceQuote(q, category));

      const interpretation = generateInterpretation(
        dim.name,
        dim.score,
        dim.level,
        isStrength
      );

      results.set(dim.name, {
        dimension: dim.name,
        insights,
        evidence,
        interpretation,
      });
    }

    return results;
  }

  /**
   * Generate evidence quotes for the unified report
   */
  async generateEvidence(
    dimensionResults: DimensionResult[],
    sessions: ParsedSession[],
    maxEvidence: number = DEFAULT_MAX_EVIDENCE
  ): Promise<EvidenceQuote[]> {
    const allEvidence: EvidenceQuote[] = [];

    for (const dim of dimensionResults) {
      const quotes = extractDimensionQuotes(sessions, dim.name, DEFAULT_QUOTES_PER_DIMENSION);
      const isStrength = dim.score >= STRENGTH_THRESHOLD;
      const category = getEvidenceCategory(isStrength);

      for (const quote of quotes) {
        allEvidence.push(toEvidenceQuote(quote, category));
      }
    }

    return this.sortAndLimitEvidence(allEvidence, maxEvidence);
  }

  // ============================================
  // Private Methods
  // ============================================

  private buildDimensionInsights(
    dimension: DimensionName,
    _score: number,
    isStrength: boolean,
    quotes: ExtractedQuote[],
    knowledge: DimensionKnowledge
  ): DimensionInsight[] {
    const insights: DimensionInsight[] = [];
    const type = getInsightType(isStrength);

    // 1. Conversation-based insight (if quotes available)
    if (quotes.length > 0) {
      const primaryQuote = quotes[0];
      const conversationInsight = this.createConversationInsight(
        dimension,
        primaryQuote,
        isStrength
      );

      insights.push({
        type,
        conversationBased: conversationInsight,
      });
    }

    // 2. Research-based insight (from professional insights)
    if (this.config.includeResearchInsights && knowledge.professionalInsights.length > 0) {
      const researchInsight = this.createResearchInsight(
        knowledge.professionalInsights[0]
      );

      insights.push({
        type,
        researchBased: researchInsight,
      });
    }

    // 3. Learning resource insight (from knowledge items)
    if (this.config.includeLearningResources && knowledge.knowledgeItems.length > 0) {
      const learningResource = this.createLearningResource(
        knowledge.knowledgeItems[0],
        knowledge.level
      );

      if (learningResource) {
        insights.push({
          type,
          learningResource,
        });
      }
    }

    return insights.slice(0, this.config.maxInsightsPerDimension);
  }

  private createConversationInsight(
    dimension: DimensionName,
    quote: ExtractedQuote,
    isStrength: boolean
  ): ConversationInsight {
    return {
      quote: quote.quote,
      messageIndex: quote.messageIndex,
      advice: generateQuoteAdvice(dimension, quote, isStrength),
      sentiment: getInsightSentiment(isStrength),
    };
  }

  private createResearchInsight(linkedInsight: LinkedInsight): ResearchInsight {
    return {
      source: `${linkedInsight.source.author} (${linkedInsight.source.type})`,
      insight: formatProfessionalInsight(linkedInsight),
      url: linkedInsight.source.url,
    };
  }

  private createLearningResource(
    item: LinkedKnowledge,
    level: 'beginner' | 'intermediate' | 'advanced'
  ): LearningResource | null {
    if (!item.url) {
      return null;
    }

    return {
      title: item.title,
      url: item.url,
      platform: item.source?.platform ?? 'Web',
      level,
      relevanceScore: item.relevanceScore,
    };
  }

  private sortAndLimitEvidence(
    evidence: EvidenceQuote[],
    limit: number
  ): EvidenceQuote[] {
    return evidence
      .sort((a, b) => EVIDENCE_CATEGORY_PRIORITY[a.category] - EVIDENCE_CATEGORY_PRIORITY[b.category])
      .slice(0, limit);
  }
}

// ============================================
// Factory Function
// ============================================

export function createInsightGenerator(
  knowledgeLinker?: KnowledgeLinker,
  config?: InsightGeneratorConfig
): InsightGenerator {
  return new InsightGenerator(knowledgeLinker, config);
}
