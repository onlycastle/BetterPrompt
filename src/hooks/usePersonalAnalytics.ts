/**
 * Personal Analytics Hook
 * React Query hook for individual developer growth tracking
 */

import { useQuery } from '@tanstack/react-query';
import type { PersonalAnalytics } from '../types/personal';

/**
 * Fetch personal analytics for the authenticated user
 * Uses /api/analysis/user/progress endpoint which aggregates analysis_results
 */
export function usePersonalAnalytics() {
  return useQuery<PersonalAnalytics | null>({
    queryKey: ['personal-analytics'],
    queryFn: async (): Promise<PersonalAnalytics | null> => {
      const response = await fetch('/api/analysis/user/progress');

      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated - return null
          return null;
        }
        throw new Error('Failed to fetch personal analytics');
      }

      const data = await response.json();
      return data.analytics;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false, // Don't retry on 401
  });
}
