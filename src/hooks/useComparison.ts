/**
 * useComparison Hook
 *
 * React Query hook for fetching comparison data (free vs premium).
 */

import { useQuery } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

export interface TypeResult {
  primaryType: string;
  distribution: Record<string, number>;
  metrics?: unknown;
  evidence?: unknown[];
  sessionCount?: number;
  analyzedAt?: string;
}

export interface FeatureComparisonItem {
  feature: string;
  description: string;
  free: boolean;
  premium: boolean;
  category: 'analysis' | 'insights' | 'tracking' | 'advanced';
}

export interface FreeReportData {
  tier: 'free';
  reportId: string;
  typeResult: TypeResult;
  lockedFeatures: string[];
}

export interface PremiumReportData {
  tier: 'premium';
  reportId: string;
  typeResult: TypeResult;
  dimensions?: unknown;
  verboseEvaluation?: unknown;
  sessionMetadata?: {
    sessionId?: string;
    durationMinutes?: number;
    messageCount?: number;
    toolCallCount?: number;
  };
}

export interface ComparisonResult {
  free: FreeReportData;
  premium: PremiumReportData;
  featureComparison: FeatureComparisonItem[];
}

export interface FeatureComparisonResponse {
  features: FeatureComparisonItem[];
  byCategory: Record<string, FeatureComparisonItem[]>;
  stats: {
    freeFeatureCount: number;
    premiumFeatureCount: number;
    premiumOnlyCount: number;
  };
}

export interface UseComparisonOptions {
  enabled?: boolean;
  staleTime?: number;
  retry?: boolean | number;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch comparison data for a specific report
 */
export function useComparison(reportId: string | undefined, options?: UseComparisonOptions) {
  return useQuery<ComparisonResult>({
    queryKey: ['comparison', reportId],
    queryFn: async () => {
      if (!reportId) {
        throw new Error('Report ID is required');
      }

      const res = await fetch(`/api/reports/comparison/${reportId}`);

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Report not found. It may have been removed or never existed.');
        }
        if (res.status === 410) {
          throw new Error('This report has expired.');
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch comparison data');
      }

      return res.json();
    },
    enabled: options?.enabled !== false && !!reportId,
    staleTime: options?.staleTime ?? 1000 * 60 * 5, // 5 minutes default
    retry: options?.retry ?? false,
  });
}

/**
 * Fetch feature comparison matrix (no report needed)
 */
export function useFeatureComparison(options?: UseComparisonOptions) {
  return useQuery<FeatureComparisonResponse>({
    queryKey: ['comparison', 'features'],
    queryFn: async () => {
      const res = await fetch('/api/reports/comparison/features');

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch feature comparison');
      }

      return res.json();
    },
    enabled: options?.enabled !== false,
    staleTime: options?.staleTime ?? 1000 * 60 * 30, // 30 minutes (static data)
    retry: options?.retry ?? 1,
  });
}
