'use client';

/**
 * Unlock Button - Client component for handling login/checkout flow
 *
 * Flow:
 * 1. Not logged in: "Sign in to Unlock" -> LoginModal
 * 2. After login: Auto-claim the result to the user
 * 3. Logged in: "Get Premium Report" -> Polar checkout
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import styles from './PublicResultPage.module.css';

interface UnlockButtonProps {
  resultId: string;
}

export function UnlockButton({ resultId }: UnlockButtonProps) {
  const { isAuthenticated } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  // Track if we were showing login modal when auth state changed
  const wasShowingLogin = useRef(false);

  // Claim the result to the user after login
  const claimResult = useCallback(async () => {
    setIsClaiming(true);
    try {
      const response = await fetch('/api/analysis/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.warn('Failed to claim result:', errorData.message);
        // Don't block the user if claim fails - they can still proceed to checkout
      }
    } catch (err) {
      console.warn('Failed to claim result:', err);
    } finally {
      setIsClaiming(false);
    }
  }, [resultId]);

  // Auto-claim when user logs in while viewing this result
  useEffect(() => {
    if (isAuthenticated && wasShowingLogin.current) {
      wasShowingLogin.current = false;
      setShowLogin(false);
      claimResult();
    }
  }, [isAuthenticated, claimResult]);

  const handleUnlock = useCallback(async () => {
    if (!isAuthenticated) {
      wasShowingLogin.current = true;
      setShowLogin(true);
      return;
    }

    // Authenticated: create checkout session
    setIsCheckoutLoading(true);
    setCheckoutError(null);

    try {
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create checkout');
      }

      const { checkoutUrl } = await response.json();
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error('Checkout error:', err);
      setCheckoutError(err instanceof Error ? err.message : 'Failed to start checkout');
      setIsCheckoutLoading(false);
    }
  }, [isAuthenticated, resultId]);

  const isLoading = isCheckoutLoading || isClaiming;

  return (
    <>
      <div className={styles.unlockOverlay}>
        <button
          className={styles.unlockButton}
          onClick={handleUnlock}
          disabled={isLoading}
        >
          {isClaiming
            ? '⏳ Linking account...'
            : isCheckoutLoading
              ? '⏳ Loading...'
              : isAuthenticated
                ? '✨ Get Premium Report'
                : '🔓 Sign in to Unlock'}
        </button>
        <p className={styles.unlockNote}>
          {checkoutError
            ? checkoutError
            : isAuthenticated
              ? 'Unlock all patterns and detailed insights'
              : 'Create an account to see your full analysis'}
        </p>
      </div>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
}
