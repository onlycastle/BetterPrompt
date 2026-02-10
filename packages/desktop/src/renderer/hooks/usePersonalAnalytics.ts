/**
 * React Query hooks for Personal Analytics
 *
 * Builds PersonalAnalyticsExtended from locally stored analysis data,
 * providing full support for Progress and Insights tabs.
 */

import { useQuery } from '@tanstack/react-query';
import type { PersonalAnalyticsExtended, HistoryEntry, GrowthArea } from '../api/types';
import {
  getStoredAnalysesExtended,
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
  const score = stored.evaluation?.overallScore || 0;

  return {
    date: stored.completedAt.split('T')[0],
    overallScore: score,
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

  const firstScore = first.evaluation?.overallScore || 0;
  const latestScore = latest.evaluation?.overallScore || 0;
  const improvement = latestScore - firstScore;

  if (improvement > 0) {
    insights.push({
      type: 'strength',
      title: 'Consistent Improvement',
      description: `Your overall score has improved by ${improvement} points since your first analysis.`,
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

  const latestScore = latest.evaluation?.overallScore || 0;
  const firstScore = first.evaluation?.overallScore || 0;

  // Build history (oldest to newest for chart)
  const history = stored.map(toHistoryEntry).reverse();

  // Extract growth areas from latest
  const growthAreas: GrowthArea[] = latest.evaluation?.growthAreas || [];

  return {
    currentType: latest.evaluation?.primaryType || 'unknown',
    firstAnalysisDate: first.completedAt,
    analysisCount: stored.length,
    totalImprovement: latestScore - firstScore,

    firstAnalysis: {
      date: first.completedAt.split('T')[0],
      score: firstScore,
      primaryType: first.evaluation?.primaryType || 'unknown',
    },
    latestAnalysis: {
      date: latest.completedAt.split('T')[0],
      score: latestScore,
      primaryType: latest.evaluation?.primaryType || 'unknown',
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
