/**
 * React Query hooks for Comparison API
 */

import { useQuery } from '@tanstack/react-query';
import { getComparison, getFeatureComparison } from '../api/client';

export const comparisonKeys = {
  all: ['comparison'] as const,
  detail: (reportId: string) => [...comparisonKeys.all, reportId] as const,
  features: () => [...comparisonKeys.all, 'features'] as const,
};

export function useComparison(reportId: string | undefined) {
  return useQuery({
    queryKey: comparisonKeys.detail(reportId || ''),
    queryFn: () => getComparison(reportId!),
    enabled: !!reportId,
  });
}

export function useFeatureComparison() {
  return useQuery({
    queryKey: comparisonKeys.features(),
    queryFn: getFeatureComparison,
  });
}
