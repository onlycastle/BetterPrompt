/**
 * Content Gateway - Tier-based content filtering for VerboseEvaluation
 *
 * Filters verbose analysis content based on user tier (free, premium, enterprise).
 * Implements paywall strategy for monetization.
 *
 * @example
 * ```typescript
 * import { createContentGateway, type Tier } from './content-gateway';
 * import type { VerboseEvaluation } from '../models/verbose-evaluation';
 *
 * const gateway = createContentGateway();
 * const fullEvaluation: VerboseEvaluation = await analyzer.analyzeVerbose(sessions, metrics);
 *
 * // Filter for free tier user
 * const freeVersion = gateway.filter(fullEvaluation, 'free');
 * // Returns: type result, personalitySummary, first 2 dimensions (full), rest empty
 *
 * // Filter for premium tier user
 * const premiumVersion = gateway.filter(fullEvaluation, 'premium');
 * // Returns: all free content + all 6 dimensions + prompt patterns
 *
 * // Enterprise gets everything
 * const enterpriseVersion = gateway.filter(fullEvaluation, 'enterprise');
 *
 * // Create preview for locked content
 * const preview = gateway.createPremiumPreview(fullEvaluation);
 * // Returns: { toolUsageDeepDivePreview: ['Read', 'Write'], ... }
 * ```
 */

import type {
  VerboseEvaluation,
  PerDimensionInsight,
} from '../models/verbose-evaluation';

// ============================================================================
// Types
// ============================================================================

/**
 * User tier levels
 */
export type Tier = 'free' | 'premium' | 'enterprise';

/**
 * Preview of locked premium content (titles only)
 */
export interface PremiumPreview {
  toolUsageDeepDivePreview?: string[];
  tokenEfficiencyPreview?: string;
  growthRoadmapPreview?: string;
  comparativeInsightsPreview?: string[];
  sessionTrendsPreview?: string[];

  // Premium features preview (Anti-Patterns, Critical Thinking, Planning, Personality)
  antiPatternsPreview?: {
    count: number;
    healthScore: number;
  };
  criticalThinkingPreview?: {
    strengthCount: number;
    overallScore: number;
  };
  planningPreview?: {
    maturityLevel: string;
    slashPlanUsage?: number;
  };
  // Personality Insights preview (teaser for the "오!! 완전 나야!!" content)
  personalityInsightsPreview?: {
    available: boolean;
    teaser?: string;
  };
}

// ============================================================================
// Content Gateway Class
// ============================================================================

/**
 * ContentGateway filters verbose evaluation content based on user tier.
 *
 * Tier Access Matrix:
 * - Free: Type result, personalitySummary, first 2 dimensionInsights (full detail), rest get empty arrays
 * - Premium: All dimensionInsights, promptPatterns, actionablePractices,
 *            antiPatternsAnalysis, criticalThinkingAnalysis, planningAnalysis,
 *            personalityInsights (the "오!! 완전 나야!!" storytelling content)
 * - Enterprise: Everything including analytics (toolUsageDeepDive, tokenEfficiency, growthRoadmap, etc.)
 *
 * @example
 * ```typescript
 * const gateway = new ContentGateway();
 * const freeVersion = gateway.filter(evaluation, 'free');
 * const preview = gateway.createPremiumPreview(evaluation);
 * ```
 */
export class ContentGateway {
  /**
   * Filter evaluation content based on tier
   *
   * @param evaluation - Full verbose evaluation
   * @param tier - User tier level
   * @returns Filtered evaluation appropriate for tier
   */
  filter(evaluation: VerboseEvaluation, tier: Tier): VerboseEvaluation {
    switch (tier) {
      case 'free':
        return this.filterFree(evaluation);
      case 'premium':
        return this.filterPremium(evaluation);
      case 'enterprise':
        return evaluation; // Full access
      default:
        // Type guard - should never reach here
        const exhaustive: never = tier;
        throw new Error(`Unknown tier: ${exhaustive}`);
    }
  }

  /**
   * Create preview of locked premium content (titles only)
   *
   * @param evaluation - Full verbose evaluation
   * @returns Preview data with titles/summaries but no detailed content
   */
  createPremiumPreview(evaluation: VerboseEvaluation): PremiumPreview {
    const preview: PremiumPreview = {};

    // Tool usage deep dive - show tool names only
    if (evaluation.toolUsageDeepDive && evaluation.toolUsageDeepDive.length > 0) {
      preview.toolUsageDeepDivePreview = evaluation.toolUsageDeepDive.map(
        (insight) => insight.toolName
      );
    }

    // Token efficiency - show efficiency level only
    if (evaluation.tokenEfficiency) {
      preview.tokenEfficiencyPreview = `Token Efficiency: ${evaluation.tokenEfficiency.efficiencyLevel}`;
    }

    // Growth roadmap - show current level and next milestone
    if (evaluation.growthRoadmap) {
      preview.growthRoadmapPreview = `${evaluation.growthRoadmap.currentLevel} → ${evaluation.growthRoadmap.nextMilestone}`;
    }

    // Comparative insights - show metric names only
    if (evaluation.comparativeInsights && evaluation.comparativeInsights.length > 0) {
      preview.comparativeInsightsPreview = evaluation.comparativeInsights.map(
        (insight) => insight.metric
      );
    }

    // Session trends - show metric names only
    if (evaluation.sessionTrends && evaluation.sessionTrends.length > 0) {
      preview.sessionTrendsPreview = evaluation.sessionTrends.map((trend) => trend.metricName);
    }

    // Anti-Patterns Preview (count and health score only)
    if (evaluation.antiPatternsAnalysis) {
      preview.antiPatternsPreview = {
        count: evaluation.antiPatternsAnalysis.detected?.length ?? 0,
        healthScore: evaluation.antiPatternsAnalysis.overallHealthScore ?? 80,
      };
    }

    // Critical Thinking Preview (strength count and score only)
    if (evaluation.criticalThinkingAnalysis) {
      preview.criticalThinkingPreview = {
        strengthCount: evaluation.criticalThinkingAnalysis.strengths?.length ?? 0,
        overallScore: evaluation.criticalThinkingAnalysis.overallScore ?? 70,
      };
    }

    // Planning Preview (maturity level and /plan usage only)
    if (evaluation.planningAnalysis) {
      preview.planningPreview = {
        maturityLevel: evaluation.planningAnalysis.planningMaturityLevel ?? 'emerging',
        slashPlanUsage: evaluation.planningAnalysis.slashPlanStats?.totalUsage,
      };
    }

    // Personality Insights Preview (teaser for premium storytelling)
    if (evaluation.personalityInsights) {
      // Extract first ~50 chars of coreObservation as teaser
      const teaser = evaluation.personalityInsights.coreObservation
        ? evaluation.personalityInsights.coreObservation.slice(0, 50) + '...'
        : undefined;
      preview.personalityInsightsPreview = {
        available: true,
        teaser,
      };
    }

    return preview;
  }

  /**
   * Filter for free tier users
   *
   * Free tier gets:
   * - Type result (primaryType, controlLevel, distribution)
   * - Personality summary
   * - First 2 dimension insights (fully detailed)
   * - Remaining 4 dimensions get empty strengths/growthAreas arrays (teaser)
   * - No prompt patterns
   * - No actionable practices
   * - No personality insights (premium storytelling)
   * - No anti-patterns/critical thinking/planning analysis
   * - No premium analytics fields
   */
  private filterFree(evaluation: VerboseEvaluation): VerboseEvaluation {
    // Filter dimension insights - first 2 full, rest empty
    const filteredInsights = evaluation.dimensionInsights.map((insight, index) => {
      if (index < 2) {
        // First 2 dimensions: keep all details
        return insight;
      } else {
        // Remaining dimensions: show structure but empty arrays
        return this.emptyDimensionInsight(insight);
      }
    });

    return {
      // Metadata
      sessionId: evaluation.sessionId,
      analyzedAt: evaluation.analyzedAt,
      sessionsAnalyzed: evaluation.sessionsAnalyzed,

      // Type result (free)
      primaryType: evaluation.primaryType,
      controlLevel: evaluation.controlLevel,
      distribution: evaluation.distribution,

      // Personality summary (free)
      personalitySummary: evaluation.personalitySummary,

      // Dimension insights (first 2 only)
      dimensionInsights: filteredInsights,

      // Deprecated fields (keep for backward compatibility)
      strengths: evaluation.strengths,
      growthAreas: evaluation.growthAreas,

      // Prompt patterns (locked for free)
      promptPatterns: [],

      // Premium fields (all undefined)
      toolUsageDeepDive: undefined,
      tokenEfficiency: undefined,
      growthRoadmap: undefined,
      comparativeInsights: undefined,
      sessionTrends: undefined,

      // Personality insights (locked for free - premium storytelling)
      personalityInsights: undefined,

      // Premium/Enterprise analysis features (locked for free)
      antiPatternsAnalysis: undefined,
      criticalThinkingAnalysis: undefined,
      planningAnalysis: undefined,

      // Actionable practices (locked for free)
      actionablePractices: undefined,
    };
  }

  /**
   * Filter for premium tier users
   *
   * Premium tier gets:
   * - Everything in free tier
   * - All 6 dimension insights (fully detailed)
   * - Prompt patterns
   * - Actionable practices (expert advice adoption)
   * - Personality insights (premium storytelling - "오!! 완전 나야!!")
   * - Anti-patterns analysis (growth opportunities)
   * - Critical thinking analysis (verification habits)
   * - Planning analysis (/plan usage, maturity level)
   * - No enterprise analytics fields (locked for enterprise)
   */
  private filterPremium(evaluation: VerboseEvaluation): VerboseEvaluation {
    return {
      // Metadata
      sessionId: evaluation.sessionId,
      analyzedAt: evaluation.analyzedAt,
      sessionsAnalyzed: evaluation.sessionsAnalyzed,

      // Type result
      primaryType: evaluation.primaryType,
      controlLevel: evaluation.controlLevel,
      distribution: evaluation.distribution,

      // Personality summary
      personalitySummary: evaluation.personalitySummary,

      // All dimension insights (premium)
      dimensionInsights: evaluation.dimensionInsights,

      // Deprecated fields
      strengths: evaluation.strengths,
      growthAreas: evaluation.growthAreas,

      // Prompt patterns (premium)
      promptPatterns: evaluation.promptPatterns,

      // Premium analytics fields (locked for enterprise)
      toolUsageDeepDive: undefined,
      tokenEfficiency: undefined,
      growthRoadmap: undefined,
      comparativeInsights: undefined,
      sessionTrends: undefined,

      // Personality insights (premium - "오!! 완전 나야!!" storytelling)
      personalityInsights: evaluation.personalityInsights,

      // Premium analysis features (Anti-Patterns, Critical Thinking, Planning)
      antiPatternsAnalysis: evaluation.antiPatternsAnalysis,
      criticalThinkingAnalysis: evaluation.criticalThinkingAnalysis,
      planningAnalysis: evaluation.planningAnalysis,

      // Actionable practices (premium)
      actionablePractices: evaluation.actionablePractices,
    };
  }

  /**
   * Create an empty dimension insight (keeps structure but removes content)
   */
  private emptyDimensionInsight(insight: PerDimensionInsight): PerDimensionInsight {
    return {
      dimension: insight.dimension,
      dimensionDisplayName: insight.dimensionDisplayName,
      strengths: [], // Empty - locked for free tier
      growthAreas: [], // Empty - locked for free tier
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Factory function for convenience
 */
export function createContentGateway(): ContentGateway {
  return new ContentGateway();
}
