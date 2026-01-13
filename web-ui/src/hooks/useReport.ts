/**
 * useReport Hook
 *
 * React Query hook for fetching report data from the API.
 */

import { useQuery } from '@tanstack/react-query';
import type { ReportData } from '../types/report';

export interface UseReportOptions {
  enabled?: boolean;
  staleTime?: number;
  retry?: boolean | number;
}

/**
 * Fetch a report by ID
 */
export function useReport(reportId: string | undefined, options?: UseReportOptions) {
  return useQuery<ReportData>({
    queryKey: ['report', reportId],
    queryFn: async () => {
      if (!reportId) {
        throw new Error('Report ID is required');
      }

      const res = await fetch(`/api/reports/${reportId}`);

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Report not found. It may have been removed or never existed.');
        }
        if (res.status === 410) {
          throw new Error('This report has expired.');
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch report');
      }

      return res.json();
    },
    enabled: options?.enabled !== false && !!reportId,
    staleTime: options?.staleTime ?? 1000 * 60 * 5, // 5 minutes default
    retry: options?.retry ?? false, // Don't retry by default for 404/410 errors
  });
}

/**
 * Record a share action for analytics
 */
export async function recordShare(
  reportId: string,
  platform: string = 'unknown'
): Promise<void> {
  try {
    await fetch(`/api/reports/${reportId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ platform }),
    });
  } catch (error) {
    console.error('Failed to record share:', error);
  }
}
