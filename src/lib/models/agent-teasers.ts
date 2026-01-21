/**
 * Agent Teasers - Create preview versions of agent outputs for free tier users
 *
 * Strategy:
 * - FREE agents (patternDetective, metacognition): full data
 * - PREMIUM agents: 1 topInsight + overall score only
 *
 * @module models/agent-teasers
 */

import type { AgentOutputs } from './agent-outputs';

/**
 * Create agent teaser outputs for free tier users
 *
 * FREE agents show full data, PREMIUM agents show limited preview.
 */
export function createAgentTeasers(agentOutputs: AgentOutputs | undefined): AgentOutputs | undefined {
  if (!agentOutputs) return undefined;

  return {
    // FREE tier agents - show everything
    patternDetective: agentOutputs.patternDetective,
    metacognition: agentOutputs.metacognition,

    // PREMIUM agents - show teaser (1 insight + scores only)
    antiPatternSpotter: agentOutputs.antiPatternSpotter
      ? {
          errorLoopsData: '',
          learningAvoidanceData: '',
          repeatedMistakesData: '',
          topInsights: agentOutputs.antiPatternSpotter.topInsights?.slice(0, 1) || [],
          overallHealthScore: agentOutputs.antiPatternSpotter.overallHealthScore,
          confidenceScore: agentOutputs.antiPatternSpotter.confidenceScore,
        }
      : undefined,

    knowledgeGap: agentOutputs.knowledgeGap
      ? {
          knowledgeGapsData: '',
          learningProgressData: '',
          recommendedResourcesData: '',
          topInsights: agentOutputs.knowledgeGap.topInsights?.slice(0, 1) || [],
          overallKnowledgeScore: agentOutputs.knowledgeGap.overallKnowledgeScore,
          confidenceScore: agentOutputs.knowledgeGap.confidenceScore,
        }
      : undefined,

    contextEfficiency: agentOutputs.contextEfficiency
      ? {
          contextUsagePatternData: '',
          inefficiencyPatternsData: '',
          promptLengthTrendData: '',
          redundantInfoData: '',
          topInsights: agentOutputs.contextEfficiency.topInsights?.slice(0, 1) || [],
          overallEfficiencyScore: agentOutputs.contextEfficiency.overallEfficiencyScore,
          avgContextFillPercent: agentOutputs.contextEfficiency.avgContextFillPercent,
          confidenceScore: agentOutputs.contextEfficiency.confidenceScore,
        }
      : undefined,

    temporalAnalysis: agentOutputs.temporalAnalysis
      ? {
          hourlyPatternsData: '',
          peakHoursData: '',
          cautionHoursData: '',
          fatiguePatternsData: '',
          qualitativeInsightsData: '',
          topInsights: agentOutputs.temporalAnalysis.topInsights?.slice(0, 1) || [],
          confidenceScore: agentOutputs.temporalAnalysis.confidenceScore,
        }
      : undefined,

    multitasking: agentOutputs.multitasking
      ? {
          sessionFocusData: '',
          contextPollutionData: '',
          workUnitSeparationData: '',
          strategyEvaluationData: '',
          avgGoalCoherence: agentOutputs.multitasking.avgGoalCoherence,
          avgContextPollutionScore: agentOutputs.multitasking.avgContextPollutionScore,
          workUnitSeparationScore: agentOutputs.multitasking.workUnitSeparationScore,
          fileOverlapRate: agentOutputs.multitasking.fileOverlapRate,
          multitaskingEfficiencyScore: agentOutputs.multitasking.multitaskingEfficiencyScore,
          totalSessionsAnalyzed: agentOutputs.multitasking.totalSessionsAnalyzed,
          projectGroupCount: agentOutputs.multitasking.projectGroupCount,
          topInsights: agentOutputs.multitasking.topInsights?.slice(0, 1) || [],
          confidenceScore: agentOutputs.multitasking.confidenceScore,
        }
      : undefined,

    // Type synthesis - hidden for free tier (premium feature)
    typeSynthesis: undefined,
  };
}
