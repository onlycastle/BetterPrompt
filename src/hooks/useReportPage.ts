/**
 * useReportPage Hook
 *
 * Shared report page data loading logic used by both the immersive
 * report page (/dashboard/r/:id) and the legacy dashboard report page.
 * Encapsulates remote result fetching, payment success toast state,
 * and auto-retry logic after payment.
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRemoteResult } from './useRemoteResult';
import type { UseRemoteResultResult } from './useRemoteResult';

const MAX_RETRIES = 3;

export interface UseReportPageResult extends UseRemoteResultResult {
  showSuccessToast: boolean;
}

export function useReportPage(resultId: string): UseReportPageResult {
  const searchParams = useSearchParams();
  const paymentSuccess = searchParams.get('payment') === 'success';

  const result = useRemoteResult(resultId);
  const { isPaid, isLoading, refetch } = result;

  const [showSuccessToast, setShowSuccessToast] = useState(paymentSuccess);

  // Auto-dismiss success toast
  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  // Auto-retry when payment succeeded but report still shows locked
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (paymentSuccess && !isPaid && !isLoading && retryCount < MAX_RETRIES) {
      const timer = setTimeout(() => {
        setRetryCount(c => c + 1);
        refetch();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [paymentSuccess, isPaid, isLoading, retryCount, refetch]);

  return {
    ...result,
    showSuccessToast,
  };
}
