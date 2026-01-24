/**
 * Agent Teasers - Create preview versions of agent outputs for free tier users
 *
 * Strategy: "Diagnosis Free, Prescription Premium"
 * - FREE tier: Full diagnosis (title, description, evidence, frequency, severity)
 * - PREMIUM tier: Full prescription (recommendations, resources, action steps)
 *
 * This approach:
 * 1. Shows users the VALUE of the analysis (what's wrong, how severe)
 * 2. Motivates upgrade by showing what they could improve
 * 3. Provides actionable solutions only to paid users
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

/** Maximum number of top insights to show in teaser mode */
const TEASER_INSIGHTS_LIMIT = 2;

/**
 * Convert undefined/null to empty string for data fields
 */
function str(value: string | undefined | null): string {
  return value || '';
}

/**
 * Limit topInsights array for teaser display
 */
function limitInsights(insights: string[] | undefined): string[] {
  return insights?.slice(0, TEASER_INSIGHTS_LIMIT) || [];
}

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

  // Pattern Detective: Show full diagnostic data with locked prescriptions
  if (agentOutputs.patternDetective) {
    const pd = agentOutputs.patternDetective;
    result.patternDetective = {
      repeatedQuestionsData: str(pd.repeatedQuestionsData),
      conversationStyleData: str(pd.conversationStyleData),
      requestStartPatternsData: str(pd.requestStartPatternsData),
      overallStyleSummary: str(pd.overallStyleSummary),
      topInsights: limitInsights(pd.topInsights),
      confidenceScore: pd.confidenceScore,
      strengthsData: str(pd.strengthsData),
      growthAreasData: lockPrescriptions(pd.growthAreasData),
      kptKeep: pd.kptKeep,
      kptProblem: pd.kptProblem,
      kptTry: [], // Locked
    };
  }

  // Anti-Pattern Spotter: Show full diagnostic data with locked prescriptions
  if (agentOutputs.antiPatternSpotter) {
    const ap = agentOutputs.antiPatternSpotter;
    result.antiPatternSpotter = {
      errorLoopsData: str(ap.errorLoopsData),
      learningAvoidanceData: str(ap.learningAvoidanceData),
      repeatedMistakesData: str(ap.repeatedMistakesData),
      topInsights: limitInsights(ap.topInsights),
      overallHealthScore: ap.overallHealthScore,
      confidenceScore: ap.confidenceScore,
      strengthsData: str(ap.strengthsData),
      growthAreasData: lockPrescriptions(ap.growthAreasData),
      kptKeep: ap.kptKeep,
      kptProblem: ap.kptProblem,
      kptTry: [], // Locked
    };
  }

  // Context Efficiency: Show full diagnostic metrics with locked prescriptions
  if (agentOutputs.contextEfficiency) {
    const ce = agentOutputs.contextEfficiency;
    result.contextEfficiency = {
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

  // Multitasking: Show full diagnostic metrics with locked prescriptions
  if (agentOutputs.multitasking) {
    const mt = agentOutputs.multitasking;
    result.multitasking = {
      sessionFocusData: str(mt.sessionFocusData),
      contextPollutionData: str(mt.contextPollutionData),
      workUnitSeparationData: str(mt.workUnitSeparationData),
      strategyEvaluationData: str(mt.strategyEvaluationData),
      avgGoalCoherence: mt.avgGoalCoherence,
      avgContextPollutionScore: mt.avgContextPollutionScore,
      workUnitSeparationScore: mt.workUnitSeparationScore,
      fileOverlapRate: mt.fileOverlapRate,
      multitaskingEfficiencyScore: mt.multitaskingEfficiencyScore,
      totalSessionsAnalyzed: mt.totalSessionsAnalyzed,
      projectGroupCount: mt.projectGroupCount,
      topInsights: limitInsights(mt.topInsights),
      confidenceScore: mt.confidenceScore,
      strengthsData: str(mt.strengthsData),
      growthAreasData: lockPrescriptions(mt.growthAreasData),
      contextSwitchCountMin: mt.contextSwitchCountMin,
      contextSwitchCountMax: mt.contextSwitchCountMax,
      longestFocusBlockMinutes: mt.longestFocusBlockMinutes,
    };
  }

  // Type Synthesis: Show basic type info, hide detailed evidence
  // FREE tier needs matrixName/emoji for display, but detailed analysis is premium
  if (agentOutputs.typeSynthesis) {
    const ts = agentOutputs.typeSynthesis;
    result.typeSynthesis = {
      refinedPrimaryType: ts.refinedPrimaryType,
      refinedControlLevel: ts.refinedControlLevel,
      matrixName: ts.matrixName,
      matrixEmoji: ts.matrixEmoji,
      confidenceScore: ts.confidenceScore,
      // Premium-only fields - hidden
      refinedDistribution: '',
      adjustmentReasons: [],
      confidenceBoost: 0,
      synthesisEvidence: '',
    };
  }

  return result as AgentOutputs;
}
