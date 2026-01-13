/**
 * Personal Analytics Hook
 * React Query hook for individual developer growth tracking
 */

import { useQuery } from '@tanstack/react-query';
import { MOCK_PERSONAL_DATA } from '../data/mockPersonalData';
import type { PersonalAnalytics } from '../types/personal';

/**
 * Fetch personal analytics for individual developer
 */
export function usePersonalAnalytics() {
  return useQuery<PersonalAnalytics>({
    queryKey: ['personal-analytics'],
    queryFn: async (): Promise<PersonalAnalytics> => {
      // TODO: Replace with actual API call when backend is ready
      // return await fetch('/api/personal/analytics').then(r => r.json());
      return MOCK_PERSONAL_DATA;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
