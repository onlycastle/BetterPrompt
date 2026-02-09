/**
 * useGrowthData Hook
 *
 * Fetches benchmark (percentile) data for the current authenticated user.
 * Used by Worker domain sections to display PercentileGauge.
 *
 * NOTE: Benchmark data is an optional enhancement — errors return null
 * (not thrown) so the main report always renders. However, errors are logged
 * to console for debuggability per the No Fallback Policy spirit.
 */

import { useQuery } from '@tanstack/react-query';
import type { BenchmarkPercentiles } from '../types/benchmarks';

interface BenchmarkApiResponse {
  percentiles: {
    period: string;
    totalAnalysesInPeriod: number;
    scores: BenchmarkPercentiles;
    percentileRanks: BenchmarkPercentiles;
  } | null;
}

export function useGrowthData() {
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
    benchmarkPercentiles: benchmarks.data ?? null,
    isLoading: benchmarks.isLoading,
  };
}
