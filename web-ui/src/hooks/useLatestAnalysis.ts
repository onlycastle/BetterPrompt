/**
 * useLatestAnalysis Hook
 *
 * Fetches the most recent analysis automatically.
 * First fetches the list of local analyses, then loads the latest one.
 */

import { useQuery } from '@tanstack/react-query';
import type { VerboseAnalysisData } from '../types/verbose';

interface LocalAnalysisListItem {
  id: string;
  createdAt: string;
  projectPath?: string;
}

interface LocalAnalysisListResponse {
  analyses: LocalAnalysisListItem[];
  count: number;
}

/**
 * Fetch the latest analysis by:
 * 1. Getting the list of all local analyses
 * 2. Taking the most recent one (sorted by createdAt desc)
 * 3. Fetching the full analysis data
 */
async function fetchLatestAnalysis(): Promise<VerboseAnalysisData | null> {
  // Step 1: Get list of all local analyses
  const listRes = await fetch('/api/analysis/local');

  if (!listRes.ok) {
    if (listRes.status === 404) {
      return null;
    }
    throw new Error('Failed to fetch analyses list');
  }

  const listData: LocalAnalysisListResponse = await listRes.json();

  // Return null if no analyses exist
  if (!listData.analyses || listData.analyses.length === 0) {
    return null;
  }

  // Step 2: Get the most recent one (API returns sorted by createdAt desc)
  const latestId = listData.analyses[0].id;

  // Step 3: Fetch full analysis data
  const detailRes = await fetch(`/api/analysis/local/${latestId}`);

  if (!detailRes.ok) {
    throw new Error('Failed to fetch analysis details');
  }

  const response = await detailRes.json();

  // Handle wrapper format from local analysis endpoint
  if (response.data) {
    return response.data as VerboseAnalysisData;
  }

  return response as VerboseAnalysisData;
}

export interface UseLatestAnalysisResult {
  data: VerboseAnalysisData | null;
  isLoading: boolean;
  error: Error | null;
  hasAnalysis: boolean;
  refetch: () => void;
}

export function useLatestAnalysis(): UseLatestAnalysisResult {
  const query = useQuery<VerboseAnalysisData | null>({
    queryKey: ['latest-analysis'],
    queryFn: fetchLatestAnalysis,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    hasAnalysis: query.data !== null && query.data !== undefined,
    refetch: query.refetch,
  };
}

export default useLatestAnalysis;
