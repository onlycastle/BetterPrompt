/**
 * Content Gateway - Tier-based content filtering for VerboseEvaluation
 *
 * Filters verbose analysis content based on user tier (free, one_time, pro, enterprise).
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
 * // Filter for pro tier user (full access)
 * const proVersion = gateway.filter(fullEvaluation, 'pro');
 * // Returns: all content including dimensions, prompt patterns, analytics
 *
 * // Create preview for locked content
 * const preview = gateway.createPremiumPreview(fullEvaluation);
 * // Returns: { toolUsageDeepDivePreview: ['Read', 'Write'], ... }
 * ```
 */

import type {
  VerboseEvaluation,
  PerDimensionInsight,
  DimensionResourceMatch,
} from '../models/verbose-evaluation';
import type { AgentOutputs } from '../models/agent-outputs';
import { createAgentTeasers } from '../models/agent-teasers';

// ============================================================================
// Types
// ============================================================================

/**
 * User tier levels (4-tier system)
 * - free: Limited content, 3 analyses/month
 * - one_time: Full content, 1-credit purchase
 * - pro: Full content, subscription
 * - enterprise: Full content + team management
 */
export type Tier = 'free' | 'one_time' | 'pro' | 'enterprise';

/**
 * Preview of locked premium content (titles only)
 */
export interface PremiumPreview {
  toolUsageDeepDivePreview?: string[];
  tokenEfficiencyPreview?: string;
  growthRoadmapPreview?: string;
  comparativeInsightsPreview?: string[];
  sessionTrendsPreview?: string[];

  // Premium features preview (Anti-Patterns, Critical Thinking, Planning)
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
}

// ============================================================================
// Content Gateway Class
// ============================================================================

/**
 * ContentGateway filters verbose evaluation content based on user tier.
 *
 * Tier Access Matrix (4-tier system):
 * - Free: Type result, personalitySummary, first 2 dimensionInsights (full detail), rest get empty arrays
 * - One-time/Pro/Enterprise: Full access - all dimensions, prompt patterns, analytics, agent outputs
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
      case 'one_time':
      case 'pro':
      case 'enterprise':
        return evaluation; // Full access
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
      // Metadata (all tiers)
      sessionId: evaluation.sessionId,
      analyzedAt: evaluation.analyzedAt,
      sessionsAnalyzed: evaluation.sessionsAnalyzed,
      avgPromptLength: evaluation.avgPromptLength,
      avgTurnsPerSession: evaluation.avgTurnsPerSession,
      analyzedSessions: evaluation.analyzedSessions,

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

      // Premium/Enterprise analysis features (locked for free)
      antiPatternsAnalysis: undefined,
      criticalThinkingAnalysis: undefined,
      planningAnalysis: undefined,

      // Actionable practices (locked for free)
      actionablePractices: undefined,

      // Module C outputs (locked for free)
      productivityAnalysis: undefined,
      topFocusAreas: undefined,

      // Phase 2 Wow Agents outputs - TEASERS for free users
      // Free agents (patternDetective, metacognition) show full data
      // Premium agents show 1 insight + scores only
      agentOutputs: createAgentTeasers(evaluation.agentOutputs),

      // Knowledge Resources - top 1 per type per dimension for free tier
      knowledgeResources: this.filterKnowledgeResourcesFree(evaluation.knowledgeResources),
    };
  }

  /**
   * Filter knowledge resources for free tier.
   *
   * Free users get top 1 knowledge item + top 1 professional insight per dimension.
   * Items are pre-sorted by matchScore descending, so .slice(0, 1) picks the best.
   */
  private filterKnowledgeResourcesFree(
    resources: DimensionResourceMatch[] | undefined
  ): DimensionResourceMatch[] | undefined {
    if (!resources || resources.length === 0) return undefined;
    const filtered = resources.map(match => ({
      ...match,
      knowledgeItems: match.knowledgeItems.slice(0, 1),
      professionalInsights: match.professionalInsights.slice(0, 1),
    })).filter(m => m.knowledgeItems.length > 0 || m.professionalInsights.length > 0);
    return filtered.length > 0 ? filtered : undefined;
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
