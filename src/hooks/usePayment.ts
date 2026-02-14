/**
 * usePayment Hook
 *
 * Shared payment logic for credit usage and checkout flow.
 * Used by CliffhangerWall and UnlockSection to avoid duplicating
 * payment handler logic.
 */

import { useState } from 'react';

interface UsePaymentOptions {
  resultId?: string;
  onCreditsUsed?: () => void;
}

interface UsePaymentReturn {
  isCheckoutLoading: boolean;
  isCreditLoading: boolean;
  error: string | null;
  handleUseCredit: () => Promise<void>;
  handleCheckout: () => Promise<void>;
}

export function usePayment({ resultId, onCreditsUsed }: UsePaymentOptions): UsePaymentReturn {
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isCreditLoading, setIsCreditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUseCredit(): Promise<void> {
    if (!resultId) {
      setError('Unable to process. Please refresh and try again.');
      return;
    }

    setIsCreditLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/credits/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resultId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to use credit');
      }

      if (data.success) {
        onCreditsUsed?.();
      } else {
        setError(
          data.reason === 'insufficient_credits'
            ? 'No credits available. Please purchase credits to unlock.'
            : data.message || 'Failed to unlock. Please try again.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsCreditLoading(false);
    }
  }

  async function handleCheckout(): Promise<void> {
    if (!resultId) {
      setError('Unable to process payment. Please refresh and try again.');
      return;
    }

    setIsCheckoutLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create checkout session');
      }

      if (!data.checkoutUrl || typeof data.checkoutUrl !== 'string') {
        throw new Error('Invalid checkout URL received from server');
      }

      const checkoutUrl = new URL(data.checkoutUrl);
      if (checkoutUrl.protocol !== 'https:') {
        throw new Error('Invalid checkout URL protocol');
      }

      window.location.href = checkoutUrl.href;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsCheckoutLoading(false);
    }
  }

  return {
    isCheckoutLoading,
    isCreditLoading,
    error,
    handleUseCredit,
    handleCheckout,
  };
}
