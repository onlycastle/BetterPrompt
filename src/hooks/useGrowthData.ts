/**
 * useGrowthData Hook
 *
 * Fetches growth tracking (progress analytics) and benchmark (percentile) data
 * for the current authenticated user. Both requests are independent and fire
 * in parallel.
 *
 * NOTE: Growth/benchmark data is an optional enhancement — errors return null
 * (not thrown) so the main report always renders. However, errors are logged
 * to console for debuggability per the No Fallback Policy spirit.
 */

import { useQuery } from '@tanstack/react-query';
import type { PersonalAnalytics } from '../types/personal';
import type { BenchmarkPercentiles } from '../types/benchmarks';

interface ProgressApiResponse {
  analytics: PersonalAnalytics;
}

interface BenchmarkApiResponse {
  percentiles: {
    period: string;
    totalAnalysesInPeriod: number;
    scores: BenchmarkPercentiles;
    percentileRanks: BenchmarkPercentiles;
  } | null;
}

export function useGrowthData() {
  // Fetch progress analytics (growth tracking)
  const progress = useQuery<PersonalAnalytics | null>({
    queryKey: ['progress-analytics'],
    queryFn: async () => {
      const res = await fetch('/api/analysis/user/progress');
      if (!res.ok) {
        console.error(`[useGrowthData] Progress API failed: ${res.status} ${res.statusText}`);
        return null;
      }
      const json: ProgressApiResponse = await res.json();
      return json.analytics ?? null;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  // Fetch benchmark percentiles
  const benchmarks = useQuery<BenchmarkPercentiles | null>({
    queryKey: ['benchmark-percentiles'],
    queryFn: async () => {
      const res = await fetch('/api/benchmarks/personal');
      if (!res.ok) {
        console.error(`[useGrowthData] Benchmarks API failed: ${res.status} ${res.statusText}`);
        return null;
      }
      const json: BenchmarkApiResponse = await res.json();
      return json.percentiles?.percentileRanks ?? null;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    progressAnalytics: progress.data ?? null,
    benchmarkPercentiles: benchmarks.data ?? null,
    isLoading: progress.isLoading || benchmarks.isLoading,
  };
}
