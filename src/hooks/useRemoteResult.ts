/**
 * useRemoteResult Hook
 *
 * Fetches a specific analysis result by resultId for the /r/[resultId] page.
 * Handles both paid and free (preview) states.
 */

import { useQuery } from '@tanstack/react-query';
import type { VerboseAnalysisData } from '../types/verbose';
import type { AgentOutputs } from '../lib/models/agent-outputs';

/**
 * Preview metadata returned by API for free users
 */
export interface RemoteResultPreview {
  totalPromptPatterns: number;
  totalGrowthAreas: number;
  previewCount: number;
  hasPartialItem: boolean;
}

/**
 * API response structure from /api/analysis/results/[resultId]
 */
export interface RemoteResultResponse {
  resultId: string;
  isPaid: boolean;
  evaluation: VerboseAnalysisData;
  preview?: RemoteResultPreview;
  credits: number | null;
}

/**
 * Error response from API
 */
interface APIErrorResponse {
  error: string;
  message: string;
}

/**
 * Fetch analysis result by ID
 */
async function fetchRemoteResult(resultId: string): Promise<RemoteResultResponse> {
  const res = await fetch(`/api/analysis/results/${resultId}`, {
    credentials: 'include', // Include cookies for auth
  });

  if (!res.ok) {
    const errorData: APIErrorResponse = await res.json().catch(() => ({
      error: 'Unknown error',
      message: 'Failed to parse error response',
    }));

    // Create a custom error with status code
    const error = new Error(errorData.message || 'Failed to load analysis');
    (error as Error & { status: number }).status = res.status;
    throw error;
  }

  const data: RemoteResultResponse = await res.json();

  // Ensure agentOutputs is properly typed
  if (data.evaluation.agentOutputs) {
    data.evaluation.agentOutputs = data.evaluation.agentOutputs as AgentOutputs;
  }

  return data;
}

export interface UseRemoteResultResult {
  /** The evaluation data (full or preview depending on isPaid) */
  data: VerboseAnalysisData | null;
  /** Whether the result is paid (full access) or free (preview) */
  isPaid: boolean;
  /** Preview metadata for free users */
  preview: RemoteResultPreview | null;
  /** User's credit balance (null if not authenticated) */
  credits: number | null;
  /** Loading state */
  isLoading: boolean;
  /** Error object if request failed */
  error: (Error & { status?: number }) | null;
  /** HTTP status code from error */
  errorStatus: number | null;
  /** Refetch function */
  refetch: () => void;
}

/**
 * Hook to fetch a remote analysis result by ID
 *
 * @param resultId - The unique result identifier (e.g., "jmjV2UnU")
 * @returns Object containing data, loading state, error, and metadata
 *
 * @example
 * ```tsx
 * const { data, isPaid, isLoading, error, errorStatus } = useRemoteResult('jmjV2UnU');
 *
 * if (isLoading) return <Spinner />;
 * if (errorStatus === 404) return <NotFound />;
 * if (error) return <Error message={error.message} />;
 *
 * return isPaid
 *   ? <FullReport data={data} />
 *   : <PreviewReport data={data} />;
 * ```
 */
export function useRemoteResult(resultId: string | null): UseRemoteResultResult {
  const query = useQuery<RemoteResultResponse>({
    queryKey: ['remote-result', resultId],
    queryFn: () => fetchRemoteResult(resultId!),
    enabled: !!resultId, // Only fetch if resultId is provided
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on 404 or 410 (not found / expired)
      const status = (error as Error & { status?: number }).status;
      if (status === 404 || status === 410) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const errorWithStatus = query.error as (Error & { status?: number }) | null;

  return {
    data: query.data?.evaluation ?? null,
    isPaid: query.data?.isPaid ?? false,
    preview: query.data?.preview ?? null,
    credits: query.data?.credits ?? null,
    isLoading: query.isLoading,
    error: errorWithStatus,
    errorStatus: errorWithStatus?.status ?? null,
    refetch: query.refetch,
  };
}

export default useRemoteResult;
