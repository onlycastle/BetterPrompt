/**
 * Agent Teasers - Create preview versions of agent outputs for free tier users
 *
 * @deprecated This module is deprecated. Use ContentGateway.filterAgentOutputs() instead.
 *
 * The tier filtering logic has been consolidated into ContentGateway
 * (src/lib/analyzer/content-gateway.ts) as the single source of truth.
 *
 * This file is kept for backward compatibility with existing imports.
 * All new code should use ContentGateway directly.
 *
 * Migration:
 * ```typescript
 * // OLD (deprecated)
 * import { createAgentTeasers } from '../models/agent-teasers';
 * const teasers = createAgentTeasers(agentOutputs);
 *
 * // NEW (recommended)
 * import { createContentGateway } from '../analyzer/content-gateway';
 * const gateway = createContentGateway();
 * const teasers = gateway.filterAgentOutputs(agentOutputs, 'free');
 * ```
 *
 * Strategy: "Diagnosis Free, Prescription Premium"
 * - FREE tier: Full diagnosis (title, description, evidence, frequency, severity)
 * - PREMIUM tier: Full prescription (recommendations, resources, action steps)
 *
 * IMPORTANT: Agent tier assignments are defined in src/lib/domain/models/agent-config.ts
 * That is the SINGLE SOURCE OF TRUTH for which agents are FREE vs PREMIUM.
 *
 * @module models/agent-teasers
 */

import type { AgentOutputs } from './agent-outputs';
import { parseGrowthAreasData } from './agent-outputs';
import { FREE_AGENT_IDS } from '../domain/models';

// ============================================================================
// Helper Functions
// ============================================================================

const TEASER_INSIGHTS_LIMIT = 2;

/** Convert undefined/null to empty string */
const str = (value: string | undefined | null): string => value || '';

/** Limit topInsights array for teaser display */
const limitInsights = (insights: string[] | undefined): string[] =>
  insights?.slice(0, TEASER_INSIGHTS_LIMIT) || [];

/**
 * Create a growth areas string with recommendations locked
 * Keeps all diagnosis info (title, desc, evidence, frequency, severity) but removes recommendations
 *
 * @param growthAreasData - Original pipe-separated growth areas string
 * @returns Growth areas string with empty recommendations
 */
function lockPrescriptions(growthAreasData: string | undefined): string {
  if (!growthAreasData) return '';

  const areas = parseGrowthAreasData(growthAreasData);
  return areas
    .map((area) => {
      // Format: title|desc|evidence|rec|freq|severity|priority
      // Lock by keeping diagnosis, emptying recommendation
      const parts = [
        area.title,
        area.description,
        area.evidence.join(','),
        '', // Empty recommendation (locked)
        area.frequency?.toString() ?? '',
        area.severity ?? '',
        area.priorityScore?.toString() ?? '',
      ];
      return parts.join('|');
    })
    .join(';');
}

/**
 * Create agent teaser outputs for free tier users
 *
 * @deprecated Use ContentGateway.filterAgentOutputs() instead.
 * This function is kept for backward compatibility.
 *
 * FREE agents show full data, PREMIUM agents show limited preview.
 * Agent tier assignments come from agent-config.ts (single source of truth).
 */
export function createAgentTeasers(agentOutputs: AgentOutputs | undefined): AgentOutputs | undefined {
  if (!agentOutputs) return undefined;

  // Build result starting with FREE tier agents (pass through unchanged)
  const result: Partial<AgentOutputs> = {};

  // FREE tier agents - show everything
  // (Tier defined in agent-config.ts: currently metacognition, knowledgeGap)
  for (const id of FREE_AGENT_IDS) {
    const key = id as keyof AgentOutputs;
    if (agentOutputs[key]) {
      (result as Record<string, unknown>)[key] = agentOutputs[key];
    }
  }

  // PREMIUM agents - show teaser (1 insight + scores only)
  // Each agent has unique structure, so teasers are defined explicitly

  // Context Efficiency: Show full diagnostic metrics with locked prescriptions
  if (agentOutputs.contextEfficiency) {
    const ce = agentOutputs.contextEfficiency;
    result.contextEfficiency = {
      // Structured arrays (new format)
      contextUsagePatterns: ce.contextUsagePatterns || [],
      inefficiencyPatterns: ce.inefficiencyPatterns || [],
      promptLengthTrends: ce.promptLengthTrends || [],
      redundantInfo: ce.redundantInfo || [],
      // Legacy string format for backward compatibility
      contextUsagePatternData: str(ce.contextUsagePatternData),
      inefficiencyPatternsData: str(ce.inefficiencyPatternsData),
      promptLengthTrendData: str(ce.promptLengthTrendData),
      redundantInfoData: str(ce.redundantInfoData),
      topInsights: limitInsights(ce.topInsights),
      overallEfficiencyScore: ce.overallEfficiencyScore,
      avgContextFillPercent: ce.avgContextFillPercent,
      confidenceScore: ce.confidenceScore,
      strengthsData: str(ce.strengthsData),
      growthAreasData: lockPrescriptions(ce.growthAreasData),
      kptKeep: ce.kptKeep,
      kptProblem: ce.kptProblem,
      kptTry: [], // Locked
    };
  }

  // Temporal Analysis: Show full metrics and diagnostic insights
  if (agentOutputs.temporalAnalysis) {
    const ta = agentOutputs.temporalAnalysis;
    const insights = ta.insights;
    result.temporalAnalysis = {
      metrics: ta.metrics, // Full metrics (deterministic)
      insights: {
        activityPatternSummary: str(insights?.activityPatternSummary),
        sessionStyleSummary: str(insights?.sessionStyleSummary),
        topInsights: limitInsights(insights?.topInsights),
        strengthsData: str(insights?.strengthsData),
        growthAreasData: lockPrescriptions(insights?.growthAreasData),
        confidenceScore: insights?.confidenceScore ?? 0,
      },
    };
  }

  return result as AgentOutputs;
}
