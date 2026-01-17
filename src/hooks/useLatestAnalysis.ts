/**
 * useLatestAnalysis Hook
 *
 * Fetches the most recent analysis automatically.
 * Priority order:
 * 1. User's claimed remote analyses (from Supabase)
 * 2. Local analyses (from ~/.nomoreaislop/reports/)
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

interface UserAnalysisItem {
  id: string;
  resultId: string;
  evaluation: VerboseAnalysisData;
  isPaid: boolean;
  claimedAt: string;
  source: 'remote';
}

interface UserAnalysisResponse {
  analyses: UserAnalysisItem[];
  count: number;
}

/**
 * Try to fetch user's claimed remote analyses first
 */
async function fetchUserAnalyses(): Promise<UserAnalysisItem[] | null> {
  try {
    console.log('[useLatestAnalysis] Fetching /api/analysis/user...');
    const res = await fetch('/api/analysis/user', {
      credentials: 'include', // Ensure cookies are sent with request
    });

    console.log('[useLatestAnalysis] Response status:', res.status);

    if (!res.ok) {
      // User not authenticated or other error - fall back to local
      console.log('[useLatestAnalysis] API returned non-ok, falling back to local');
      return null;
    }

    const data: UserAnalysisResponse = await res.json();
    console.log('[useLatestAnalysis] API response:', {
      count: data.count,
      analysesLength: data.analyses?.length,
      firstHasEvaluation: data.analyses?.[0]?.evaluation ? 'yes' : 'no',
    });
    return data.analyses || null;
  } catch (error) {
    console.error('[useLatestAnalysis] Fetch error:', error);
    return null;
  }
}

/**
 * Fetch local analyses as fallback
 */
async function fetchLocalAnalyses(): Promise<VerboseAnalysisData | null> {
  const listRes = await fetch('/api/analysis/local');

  if (!listRes.ok) {
    if (listRes.status === 404) {
      return null;
    }
    throw new Error('Failed to fetch analyses list');
  }

  const listData: LocalAnalysisListResponse = await listRes.json();

  if (!listData.analyses || listData.analyses.length === 0) {
    return null;
  }

  const latestId = listData.analyses[0].id;
  const detailRes = await fetch(`/api/analysis/local/${latestId}`);

  if (!detailRes.ok) {
    throw new Error('Failed to fetch analysis details');
  }

  const response = await detailRes.json();

  if (response.data) {
    return response.data as VerboseAnalysisData;
  }

  return response as VerboseAnalysisData;
}

/**
 * Fetch the latest analysis by:
 * 1. First try user's claimed remote analyses (if authenticated)
 * 2. Fall back to local analyses
 */
async function fetchLatestAnalysis(): Promise<VerboseAnalysisData | null> {
  console.log('[useLatestAnalysis] fetchLatestAnalysis called');

  // Step 1: Try user's claimed remote analyses
  const userAnalyses = await fetchUserAnalyses();

  console.log('[useLatestAnalysis] userAnalyses result:', {
    isNull: userAnalyses === null,
    length: userAnalyses?.length,
  });

  if (userAnalyses && userAnalyses.length > 0) {
    // Return the evaluation from the most recent claimed analysis
    const latest = userAnalyses[0];
    console.log('[useLatestAnalysis] Using remote analysis:', {
      resultId: latest.resultId,
      hasEvaluation: !!latest.evaluation,
      evaluationKeys: latest.evaluation ? Object.keys(latest.evaluation) : [],
    });
    return latest.evaluation;
  }

  // Step 2: Fall back to local analyses
  console.log('[useLatestAnalysis] Falling back to local analyses');
  const localResult = await fetchLocalAnalyses();
  console.log('[useLatestAnalysis] Local analyses result:', {
    isNull: localResult === null,
    hasData: !!localResult,
  });
  return localResult;
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
