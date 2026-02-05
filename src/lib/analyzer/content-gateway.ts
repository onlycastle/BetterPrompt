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
  MatchedKnowledgeItem,
  MatchedProfessionalInsight,
  TopFocusAreas,
} from '../models/verbose-evaluation';
import type { AgentOutputs } from '../models/agent-outputs';
import type { WorkerGrowth } from '../models/worker-insights';
import { FREE_AGENT_IDS } from '../domain/models';

// Extract the workerInsights type from VerboseEvaluation for type safety
type WorkerInsightsRecord = VerboseEvaluation['workerInsights'];

// ============================================================================
// Tier Policy - Single Source of Truth for content filtering
// ============================================================================

/**
 * TIER_POLICY: Declarative definition of what content is available at each tier.
 *
 * Philosophy: "Diagnosis Free, Prescription Paid"
 * - FREE: Show problems (strengths, growth area diagnosis, evidence quotes)
 * - PAID: Show solutions (recommendations, full context, more resources)
 *
 * All tier-based filtering decisions should reference this policy.
 */
export const TIER_POLICY = {
  /** Worker insights filtering */
  workerInsights: {
    /** Strengths are always free (positive feedback builds trust) */
    strengths: 'free',
    /** Growth areas: diagnosis free, prescription paid */
    growthAreas: {
      diagnosis: 'free',      // title, description, evidence
      prescription: 'paid',   // recommendation
    },
  },

  /** Dimension insights filtering */
  dimensionInsights: {
    /** Number of dimensions shown with full detail for free tier */
    freeCount: 2,
  },

  /** Knowledge resources filtering */
  resources: {
    /** Number of resources per dimension for free tier */
    freeLimit: 1,
  },

  /** Evidence/utterance display */
  evidence: {
    /** Evidence quotes are free (they show the problem) */
    quotes: 'free',
    /** Original context lookup requires paid tier */
    originalContext: 'paid',
  },

  /** Agent outputs (legacy agents) */
  agentOutputs: {
    /** Agent IDs that are free (defined in agent-config.ts) */
    freeAgentIds: FREE_AGENT_IDS,
    /** Premium agent teaser limits */
    teaserInsightsLimit: 2,
  },

  /** Top focus areas filtering */
  topFocusAreas: {
    /** Number of fully visible areas for free tier */
    freeFullCount: 1,
  },
} as const;

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
      topFocusAreas: this.createFocusAreaTeaser(evaluation.topFocusAreas),

      // Phase 2 Wow Agents outputs - TEASERS for free users
      // Free agents (patternDetective, metacognition) show full data
      // Premium agents show 1 insight + scores only
      agentOutputs: this.filterAgentOutputs(evaluation.agentOutputs, 'free'),

      // Knowledge Resources - top 1 per type per dimension for free tier
      knowledgeResources: this.filterKnowledgeResourcesFree(evaluation.knowledgeResources),

      // Worker insights - filter recommendations for free tier
      workerInsights: this.filterWorkerInsights(evaluation.workerInsights, 'free'),
    };
  }

  /**
   * Filter knowledge resources for free tier.
   *
   * Free users get top 1 knowledge item + top 1 professional insight unlocked per dimension.
   * Remaining items are sent with locked content (title visible, details empty).
   * Items are pre-sorted by matchScore descending, so index 0 is the best match.
   */
  private filterKnowledgeResourcesFree(
    resources: DimensionResourceMatch[] | undefined
  ): DimensionResourceMatch[] | undefined {
    if (!resources?.length) return undefined;

    const { freeLimit } = TIER_POLICY.resources;
    const filtered = resources
      .map(match => ({
        ...match,
        knowledgeItems: match.knowledgeItems.map((item, i) =>
          i < freeLimit ? item : this.lockKnowledgeItem(item)
        ),
        professionalInsights: match.professionalInsights.map((insight, i) =>
          i < freeLimit ? insight : this.lockProfessionalInsight(insight)
        ),
      }))
      .filter(m => m.knowledgeItems.length > 0 || m.professionalInsights.length > 0);

    return filtered.length > 0 ? filtered : undefined;
  }

  /**
   * Lock a knowledge item for free tier (keep title, clear content).
   * Frontend detects locked state via empty summary field.
   */
  private lockKnowledgeItem(item: MatchedKnowledgeItem): MatchedKnowledgeItem {
    return {
      ...item,
      summary: '',
      sourceUrl: '',
      sourceAuthor: '',
      tags: [],
    };
  }

  /**
   * Lock a professional insight for free tier (keep title/category, clear content).
   * Frontend detects locked state via empty keyTakeaway field.
   */
  private lockProfessionalInsight(insight: MatchedProfessionalInsight): MatchedProfessionalInsight {
    return {
      ...insight,
      keyTakeaway: '',
      actionableAdvice: [],
      sourceUrl: '',
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

  // ==========================================================================
  // Worker Insights Filtering (Phase 2 v3 Workers)
  // ==========================================================================

  /**
   * Filter worker insights based on tier.
   *
   * For FREE tier:
   * - Strengths: Full data (positive feedback builds trust)
   * - Growth Areas: Diagnosis (title, description, evidence) but NO recommendation
   *
   * For PAID tier:
   * - Full data including recommendations
   *
   * @param workerInsights - Full worker insights from analysis
   * @param tier - User tier level
   * @returns Filtered worker insights with recommendations locked for free tier
   */
  filterWorkerInsights(
    workerInsights: WorkerInsightsRecord,
    tier: Tier
  ): WorkerInsightsRecord {
    if (!workerInsights) return undefined;

    // Paid tiers get full access
    if (tier !== 'free') return workerInsights;

    // Free tier: lock recommendations (prescription) but keep diagnosis
    const filtered: NonNullable<WorkerInsightsRecord> = {};

    for (const [key, domain] of Object.entries(workerInsights)) {
      if (!domain) continue;

      filtered[key] = {
        ...domain,
        // Strengths: full (free)
        strengths: domain.strengths,
        // Growth areas: lock recommendation (prescription paid)
        growthAreas: domain.growthAreas.map((g) => this.lockRecommendation(g as WorkerGrowth)),
      };
    }

    return filtered;
  }

  /**
   * Lock recommendation field in a growth area (for free tier).
   * Keeps all diagnosis fields (title, description, evidence, severity).
   */
  private lockRecommendation(growth: WorkerGrowth): WorkerGrowth {
    return {
      ...growth,
      recommendation: '', // Empty = locked (frontend shows lock UI)
    };
  }

  // ==========================================================================
  // Top Focus Areas Filtering
  // ==========================================================================

  /**
   * Create teaser version of top focus areas for free tier.
   * First area is fully visible, remaining are locked (narrative='').
   */
  private createFocusAreaTeaser(
    topFocusAreas: TopFocusAreas | undefined
  ): TopFocusAreas | undefined {
    if (!topFocusAreas?.areas?.length) return undefined;

    const { freeFullCount } = TIER_POLICY.topFocusAreas;

    return {
      summary: topFocusAreas.summary,
      areas: topFocusAreas.areas.map((area, index) =>
        index < freeFullCount
          ? area
          : { ...area, narrative: '', expectedImpact: '', actions: undefined }
      ),
    };
  }

  // ==========================================================================
  // Agent Outputs Filtering (Legacy Agents)
  // ==========================================================================

  /**
   * Create agent teasers for free tier users.
   *
   * FREE agents (defined in agent-config.ts): Full data
   * PREMIUM agents: Limited preview (teaser insights, locked prescriptions)
   *
   * This method is the single source of truth for agent tier filtering,
   * replacing the standalone createAgentTeasers function.
   */
  filterAgentOutputs(
    agentOutputs: AgentOutputs | undefined,
    tier: Tier
  ): AgentOutputs | undefined {
    if (!agentOutputs) return undefined;

    // Paid tiers get full access
    if (tier !== 'free') return agentOutputs;

    // Free tier: apply teaser logic
    return this.createAgentTeasersInternal(agentOutputs);
  }

  /**
   * Internal implementation of agent teaser creation.
   *
   * Strategy: "Diagnosis Free, Prescription Premium"
   * - FREE tier: Full diagnosis (title, description, evidence, frequency, severity)
   * - PREMIUM tier: Full prescription (recommendations, resources, action steps)
   */
  private createAgentTeasersInternal(agentOutputs: AgentOutputs): AgentOutputs {
    const result: Partial<AgentOutputs> = {};
    const { freeAgentIds, teaserInsightsLimit } = TIER_POLICY.agentOutputs;

    // FREE tier agents - pass through unchanged
    for (const id of freeAgentIds) {
      const key = id as keyof AgentOutputs;
      if (agentOutputs[key]) {
        (result as Record<string, unknown>)[key] = agentOutputs[key];
      }
    }

    // PREMIUM agents - create teasers with locked prescriptions

    // Context Efficiency: Show diagnostic metrics with locked prescriptions
    if (agentOutputs.contextEfficiency) {
      const ce = agentOutputs.contextEfficiency;
      result.contextEfficiency = {
        // Structured arrays (new format)
        contextUsagePatterns: ce.contextUsagePatterns || [],
        inefficiencyPatterns: ce.inefficiencyPatterns || [],
        promptLengthTrends: ce.promptLengthTrends || [],
        redundantInfo: ce.redundantInfo || [],
        // Legacy string format for backward compatibility
        contextUsagePatternData: ce.contextUsagePatternData || '',
        inefficiencyPatternsData: ce.inefficiencyPatternsData || '',
        promptLengthTrendData: ce.promptLengthTrendData || '',
        redundantInfoData: ce.redundantInfoData || '',
        topInsights: ce.topInsights?.slice(0, teaserInsightsLimit) || [],
        overallEfficiencyScore: ce.overallEfficiencyScore,
        avgContextFillPercent: ce.avgContextFillPercent,
        confidenceScore: ce.confidenceScore,
        strengthsData: ce.strengthsData || '',
        growthAreasData: this.lockGrowthAreasDataPrescriptions(ce.growthAreasData),
        kptKeep: ce.kptKeep,
        kptProblem: ce.kptProblem,
        kptTry: [], // Locked
      };
    }

    // Temporal Analysis: Show full metrics with locked prescriptions
    if (agentOutputs.temporalAnalysis) {
      const ta = agentOutputs.temporalAnalysis;
      const insights = ta.insights;
      result.temporalAnalysis = {
        metrics: ta.metrics, // Full metrics (deterministic)
        insights: {
          activityPatternSummary: insights?.activityPatternSummary || '',
          sessionStyleSummary: insights?.sessionStyleSummary || '',
          topInsights: insights?.topInsights?.slice(0, teaserInsightsLimit) || [],
          strengthsData: insights?.strengthsData || '',
          growthAreasData: this.lockGrowthAreasDataPrescriptions(insights?.growthAreasData),
          confidenceScore: insights?.confidenceScore ?? 0,
        },
      };
    }

    return result as AgentOutputs;
  }

  /**
   * Lock prescriptions in growthAreasData string format.
   *
   * Input format: "title|desc|evidence|rec|freq|severity|priority;..."
   * Output: Same format with empty recommendation field
   */
  private lockGrowthAreasDataPrescriptions(growthAreasData: string | undefined): string {
    if (!growthAreasData) return '';

    // Parse, lock, and re-serialize
    return growthAreasData
      .split(';')
      .filter(Boolean)
      .map((entry) => {
        const parts = entry.split('|');
        // Format: title|desc|evidence|rec|freq|severity|priority
        // Lock by emptying recommendation (index 3)
        if (parts.length >= 4) {
          parts[3] = ''; // Empty recommendation
        }
        return parts.join('|');
      })
      .join(';');
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
