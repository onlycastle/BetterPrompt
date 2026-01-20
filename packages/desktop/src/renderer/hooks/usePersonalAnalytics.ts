/**
 * React Query hooks for Personal Analytics
 *
 * Builds PersonalAnalyticsExtended from locally stored analysis data,
 * providing full support for Progress and Insights tabs.
 */

import { useQuery } from '@tanstack/react-query';
import type { PersonalAnalyticsExtended, DimensionScores, HistoryEntry, GrowthArea } from '../api/types';
import {
  getStoredAnalysesExtended,
  extractDimensionScores,
  calculateOverallScore,
  type StoredAnalysisExtended,
} from '../utils/analysisStorage';

export const personalKeys = {
  all: ['personal'] as const,
  analytics: (userId: string) => [...personalKeys.all, 'analytics', userId] as const,
};

/**
 * Convert stored analysis to history entry
 */
function toHistoryEntry(stored: StoredAnalysisExtended): HistoryEntry {
  const score = stored.evaluation?.overallScore ||
    calculateOverallScore(stored.evaluation?.dimensionInsights) ||
    0;

  return {
    date: stored.completedAt.split('T')[0],
    overallScore: score,
    dimensions: extractDimensionScores(stored.evaluation?.dimensionInsights),
  };
}

/**
 * Calculate dimension improvements between first and latest
 */
function calculateDimensionDiff(
  first: StoredAnalysisExtended,
  latest: StoredAnalysisExtended
): DimensionScores | undefined {
  const firstDims = extractDimensionScores(first.evaluation?.dimensionInsights);
  const latestDims = extractDimensionScores(latest.evaluation?.dimensionInsights);

  if (!firstDims || !latestDims) return undefined;

  return {
    aiCollaboration: latestDims.aiCollaboration - firstDims.aiCollaboration,
    contextEngineering: latestDims.contextEngineering - firstDims.contextEngineering,
    burnoutRisk: latestDims.burnoutRisk - firstDims.burnoutRisk,
    toolMastery: latestDims.toolMastery - firstDims.toolMastery,
    aiControl: latestDims.aiControl - firstDims.aiControl,
    skillResilience: latestDims.skillResilience - firstDims.skillResilience,
  };
}

/**
 * Generate insights from comparing first and latest analyses
 */
function generateInsights(
  first: StoredAnalysisExtended,
  latest: StoredAnalysisExtended,
  stored: StoredAnalysisExtended[]
): Array<{ type: 'strength' | 'growth' | 'trend'; title: string; description: string }> {
  const insights: Array<{ type: 'strength' | 'growth' | 'trend'; title: string; description: string }> = [];

  const firstScore = calculateOverallScore(first.evaluation?.dimensionInsights);
  const latestScore = calculateOverallScore(latest.evaluation?.dimensionInsights);
  const improvement = latestScore - firstScore;

  if (improvement > 0) {
    insights.push({
      type: 'strength',
      title: 'Consistent Improvement',
      description: `Your overall score has improved by ${improvement} points since your first analysis.`,
    });
  }

  // Find best dimension
  const latestDims = extractDimensionScores(latest.evaluation?.dimensionInsights);
  if (latestDims) {
    const entries = Object.entries(latestDims) as [keyof DimensionScores, number][];
    const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    const dimLabels: Record<keyof DimensionScores, string> = {
      aiCollaboration: 'AI Collaboration',
      contextEngineering: 'Context Engineering',
      burnoutRisk: 'Burnout Risk',
      toolMastery: 'Tool Mastery',
      aiControl: 'AI Control',
      skillResilience: 'Skill Resilience',
    };
    insights.push({
      type: 'strength',
      title: `Strong ${dimLabels[best[0]]}`,
      description: `Your ${dimLabels[best[0]].toLowerCase()} score of ${best[1]} is your top dimension.`,
    });
  }

  // Add trend insight
  if (stored.length >= 2) {
    insights.push({
      type: 'trend',
      title: 'Active Tracking',
      description: `You've completed ${stored.length} analyses. Keep tracking to see your growth!`,
    });
  }

  return insights;
}

/**
 * Build PersonalAnalyticsExtended from stored analyses
 */
function buildAnalyticsFromStored(stored: StoredAnalysisExtended[]): PersonalAnalyticsExtended | null {
  if (stored.length === 0) return null;

  // Stored is newest-first, so first = oldest, latest = newest
  const latest = stored[0];
  const first = stored[stored.length - 1];

  const latestScore = calculateOverallScore(latest.evaluation?.dimensionInsights);
  const firstScore = calculateOverallScore(first.evaluation?.dimensionInsights);

  // Build history (oldest to newest for chart)
  const history = stored.map(toHistoryEntry).reverse();

  // Extract growth areas from latest
  const growthAreas: GrowthArea[] = latest.evaluation?.growthAreas || [];

  return {
    currentType: latest.evaluation?.primaryType || 'unknown',
    firstAnalysisDate: first.completedAt,
    analysisCount: stored.length,
    totalImprovement: latestScore - firstScore,

    currentDimensions: extractDimensionScores(latest.evaluation?.dimensionInsights),
    dimensionImprovements: calculateDimensionDiff(first, latest),

    firstAnalysis: {
      date: first.completedAt.split('T')[0],
      score: firstScore,
      primaryType: first.evaluation?.primaryType || 'unknown',
      dimensions: extractDimensionScores(first.evaluation?.dimensionInsights),
    },
    latestAnalysis: {
      date: latest.completedAt.split('T')[0],
      score: latestScore,
      primaryType: latest.evaluation?.primaryType || 'unknown',
      dimensions: extractDimensionScores(latest.evaluation?.dimensionInsights),
    },

    history,
    growthAreas,
    insights: generateInsights(first, latest, stored),
    goals: [],
  };
}

export function usePersonalAnalytics(_userId?: string) {
  return useQuery<PersonalAnalyticsExtended | null>({
    queryKey: personalKeys.analytics(_userId || ''),
    queryFn: async (): Promise<PersonalAnalyticsExtended | null> => {
      // Build from local storage
      const stored = getStoredAnalysesExtended();
      return buildAnalyticsFromStored(stored);
    },
    staleTime: 1000 * 60 * 5,
  });
}
