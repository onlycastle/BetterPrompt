/**
 * useAnalysisReport Hook
 *
 * React Query hook for fetching verbose analysis report data.
 * Supports both API fetching and local file loading via query parameter.
 *
 * @module hooks/useAnalysisReport
 */

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import type { VerboseAnalysisData } from '../types/verbose.js';

// Re-export types for consumers
export type {
  VerboseAnalysisData,
  DimensionEvidence,
  DimensionStrength,
  DimensionGrowthArea,
  PerDimensionInsight,
  PromptPattern,
  PromptPatternExample,
  CodingStyleType,
  AIControlLevel,
  TypeDistribution,
  LocalAnalysis,
  VerboseTypeMetadata,
} from '../types/verbose.js';

export { VERBOSE_TYPE_METADATA as TYPE_METADATA } from '../types/verbose.js';

export interface UseAnalysisReportOptions {
  enabled?: boolean;
  staleTime?: number;
  retry?: boolean | number;
}

/**
 * Fetch analysis data from API endpoint
 */
async function fetchAnalysis(
  effectiveId: string,
  isLocal: boolean
): Promise<VerboseAnalysisData> {
  const endpoint = isLocal
    ? `/api/analysis/local/${effectiveId}`
    : `/api/analysis/${effectiveId}`;

  const res = await fetch(endpoint);

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        isLocal
          ? 'Local analysis not found. It may have been deleted or expired.'
          : 'Report not found. It may have been removed or never existed.'
      );
    }
    if (res.status === 410) {
      throw new Error('This analysis has expired.');
    }
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch analysis');
  }

  const response = await res.json();

  // Handle local analysis wrapper format
  if (isLocal && response.data) {
    return response.data as VerboseAnalysisData;
  }

  return response as VerboseAnalysisData;
}

/**
 * Hook for fetching verbose analysis report data.
 *
 * Supports two modes:
 * 1. API mode: Fetches from /api/analysis/:reportId
 * 2. Local mode: Fetches from local file via /api/analysis/local/:localId
 *
 * The mode is determined by URL query parameter:
 * - /analysis/abc123 -> API mode (reportId = abc123)
 * - /analysis?local=xyz789 -> Local mode (localId = xyz789)
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useAnalysisReport('report-123');
 * // or with local file:
 * // URL: /analysis?local=local-id-456
 * const { data, isLoading, error } = useAnalysisReport();
 * ```
 */
export function useAnalysisReport(
  reportId?: string,
  options?: UseAnalysisReportOptions
) {
  const [searchParams] = useSearchParams();
  const localId = searchParams.get('local');

  const effectiveId = localId || reportId;
  const isLocal = Boolean(localId);

  return useQuery<VerboseAnalysisData>({
    queryKey: ['analysis-report', effectiveId, isLocal],
    queryFn: () => {
      if (!effectiveId) {
        throw new Error('Report ID or local ID is required');
      }
      return fetchAnalysis(effectiveId, isLocal);
    },
    enabled: options?.enabled !== false && Boolean(effectiveId),
    staleTime: options?.staleTime ?? 1000 * 60 * 5, // 5 minutes default
    retry: options?.retry ?? false, // Don't retry by default for 404/410 errors
  });
}

export default useAnalysisReport;
