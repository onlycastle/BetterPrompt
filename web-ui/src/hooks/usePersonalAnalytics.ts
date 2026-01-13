/**
 * Personal Analytics Hook
 * React Query hook for individual developer growth tracking
 */

import { useQuery } from '@tanstack/react-query';
import { MOCK_PERSONAL_DATA } from '../data/mockPersonalData';
import type { PersonalAnalytics } from '../types/personal';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Fetch personal analytics for individual developer
 */
export function usePersonalAnalytics(userId?: string) {
  return useQuery<PersonalAnalytics>({
    queryKey: ['personal-analytics', userId],
    queryFn: async (): Promise<PersonalAnalytics> => {
      if (!userId) {
        // Fall back to mock data when no userId is provided
        return MOCK_PERSONAL_DATA;
      }

      try {
        const response = await fetch(`${API_BASE}/api/enterprise/personal/tracking?userId=${userId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch personal analytics');
        }
        const data = await response.json();
        // Transform API response to PersonalAnalytics format
        return {
          ...MOCK_PERSONAL_DATA, // Use mock as base structure
          weeklyTrend: data.metrics || MOCK_PERSONAL_DATA.weeklyTrend,
          overallScore: data.avgScore || MOCK_PERSONAL_DATA.overallScore,
          totalSessions: data.totalSessions || MOCK_PERSONAL_DATA.totalSessions,
          currentStreak: data.streak || MOCK_PERSONAL_DATA.currentStreak,
        };
      } catch (error) {
        console.warn('Failed to fetch personal analytics, using mock data:', error);
        return MOCK_PERSONAL_DATA;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
