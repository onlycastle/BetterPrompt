'use client';

/**
 * Detail Button - Directs users to login and view detailed analysis
 *
 * Flow:
 * 1. Not logged in: Opens LoginModal, then redirects to /personal
 * 2. Logged in: Directly navigates to /personal
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import styles from './PublicResultPage.module.css';

interface DetailButtonProps {
  resultId: string;
}

export function DetailButton({ resultId }: DetailButtonProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  // Redirect to /personal after successful login
  useEffect(() => {
    if (isAuthenticated && shouldRedirect) {
      // Claim the result first, then redirect
      claimAndRedirect();
    }
  }, [isAuthenticated, shouldRedirect]);

  const claimAndRedirect = async () => {
    try {
      // Claim the result to the user's account
      await fetch('/api/analysis/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId }),
      });
    } catch (err) {
      console.warn('Failed to claim result:', err);
    }

    router.push('/personal');
  };

  const handleClick = () => {
    if (isAuthenticated) {
      // Already logged in - claim and go to dashboard
      claimAndRedirect();
    } else {
      // Need to login first
      setShouldRedirect(true);
      setShowLogin(true);
    }
  };

  return (
    <>
      <div className={styles.detailButtonContainer}>
        <button
          className={styles.detailButton}
          onClick={handleClick}
        >
          🔍 로그인하고 더 자세하게 보기
        </button>
        <p className={styles.detailNote}>
          나만의 상세 분석 리포트를 확인하세요
        </p>
      </div>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} pendingResultId={resultId} />
    </>
  );
}
