/**
 * React Query hooks for Personal Analytics
 */

import { useQuery } from '@tanstack/react-query';
import { getPersonalAnalytics } from '../api/client';
import type { PersonalAnalytics } from '../api/types';

// Mock data for development/demo mode
const MOCK_PERSONAL_DATA: PersonalAnalytics = {
  history: [
    { date: '2024-01-01', score: 72, promptCount: 45 },
    { date: '2024-01-08', score: 75, promptCount: 52 },
    { date: '2024-01-15', score: 78, promptCount: 48 },
    { date: '2024-01-22', score: 82, promptCount: 61 },
    { date: '2024-01-29', score: 85, promptCount: 58 },
  ],
  insights: [
    {
      type: 'strength',
      title: 'Consistent Improvement',
      description: 'Your scores have improved by 13 points over the past month.',
    },
    {
      type: 'growth',
      title: 'Context Engineering',
      description: 'Focus on providing more context in your prompts for better results.',
    },
    {
      type: 'trend',
      title: 'Active Usage',
      description: 'You\'re averaging 53 prompts per week, above the typical user.',
    },
  ],
  goals: [
    { id: '1', title: 'Reach Expert Level', progress: 85, target: 100 },
    { id: '2', title: 'Complete 100 Sessions', progress: 67, target: 100 },
  ],
};

export const personalKeys = {
  all: ['personal'] as const,
  analytics: (userId: string) => [...personalKeys.all, 'analytics', userId] as const,
};

export function usePersonalAnalytics(userId?: string) {
  return useQuery<PersonalAnalytics>({
    queryKey: personalKeys.analytics(userId || ''),
    queryFn: async (): Promise<PersonalAnalytics> => {
      if (!userId) {
        // Fall back to mock data when no user
        return MOCK_PERSONAL_DATA;
      }

      try {
        const data = await getPersonalAnalytics(userId);
        return data;
      } catch (error) {
        console.warn('Failed to fetch personal analytics, using mock data:', error);
        return MOCK_PERSONAL_DATA;
      }
    },
    staleTime: 1000 * 60 * 5,
  });
}
