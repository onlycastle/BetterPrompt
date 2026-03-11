'use client';

import { useRemoteResult } from './useRemoteResult';
import type { UseRemoteResultResult } from './useRemoteResult';

export interface UseReportPageResult extends UseRemoteResultResult {
  showSuccessToast: boolean;
}

export function useReportPage(resultId: string): UseReportPageResult {
  const result = useRemoteResult(resultId);

  return {
    ...result,
    showSuccessToast: false,
  };
}
