/**
 * Public Result Page
 *
 * Displays analysis results from CLI (npx no-ai-slop).
 * Accessed via /r/:resultId - shareable public link.
 * Implements tiered access:
 * - Non-authenticated: Show blur + "Sign in to unlock"
 * - Authenticated + unpaid: Show blur + "Get Premium"
 * - Authenticated + paid: Show full report
 */

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { FormattedText } from '@/utils/textFormatting';
import styles from './PublicResultPage.module.css';

// ============================================================================
// Types
// ============================================================================

interface PreviewMetadata {
  totalPromptPatterns: number;
  totalGrowthAreas: number;
  previewCount: number;
  hasPartialItem: boolean;
}

interface ResultData {
  resultId: string;
  isPaid: boolean;
  evaluation: {
    primaryType: string;
    controlLevel?: string;
    distribution: {
      architect: number;
      scientist: number;
      collaborator: number;
      speedrunner: number;
      craftsman: number;
    };
    personalitySummary: string;
    promptPatterns?: Array<{
      patternName: string;
      description: string;
      frequency: string;
    }>;
    dimensionInsights?: Array<{
      dimensionName: string;
      score: number;
      strengths: Array<{ title: string; description: string }>;
      growthAreas: Array<{ title: string; description: string }>;
    }>;
  };
  preview?: PreviewMetadata;
}

const TYPE_META: Record<string, { emoji: string; name: string; tagline: string }> = {
  architect: { emoji: '🏗️', name: 'Architect', tagline: 'Strategic thinker who plans before diving into code' },
  scientist: { emoji: '🔬', name: 'Scientist', tagline: 'Truth-seeker who always verifies AI output' },
  collaborator: { emoji: '🤝', name: 'Collaborator', tagline: 'Partnership master who finds answers through dialogue' },
  speedrunner: { emoji: '⚡', name: 'Speedrunner', tagline: 'Agile executor who delivers through fast iteration' },
  craftsman: { emoji: '🔧', name: 'Craftsman', tagline: 'Artisan who prioritizes code quality above all' },
};

async function fetchResult(resultId: string): Promise<ResultData> {
  const response = await fetch(`/api/analysis/results/${resultId}`);
  if (!response.ok) {
    throw new Error('Result not found');
  }
  return response.json();
}

export function PublicResultPage() {
  const { resultId } = useParams<{ resultId: string }>();
  const { isAuthenticated } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['publicResult', resultId],
    queryFn: () => fetchResult(resultId!),
    enabled: !!resultId,
  });

  // Unlock button handler - creates Polar checkout
  const handleUnlock = useCallback(async () => {
    if (!isAuthenticated) {
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

  // Determine if premium content should be locked
  // Locked if: not authenticated OR (authenticated but not paid)
  const isPremiumLocked = !data?.isPaid;

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading your results...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <div className={styles.errorIcon}>🔍</div>
          <h1>Result Not Found</h1>
          <p>This analysis result may have expired or doesn't exist.</p>
          <a href="https://npmjs.com/package/no-ai-slop" className={styles.ctaButton}>
            Try no-ai-slop yourself
          </a>
        </div>
      </div>
    );
  }

  const { evaluation, preview } = data;
  const typeMeta = TYPE_META[evaluation.primaryType] || TYPE_META.collaborator;

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <div className={styles.hero}>
        <div className={styles.typeEmoji}>{typeMeta.emoji}</div>
        <h1 className={styles.typeName}>{typeMeta.name}</h1>
        <p className={styles.typeTagline}>{typeMeta.tagline}</p>
      </div>

      {/* Distribution */}
      <div className={styles.card}>
        <h2>Type Distribution</h2>
        <div className={styles.distribution}>
          {Object.entries(evaluation.distribution).map(([type, percentage]) => {
            const meta = TYPE_META[type];
            const isMain = type === evaluation.primaryType;
            return (
              <div key={type} className={`${styles.barRow} ${isMain ? styles.primary : ''}`}>
                <div className={styles.barLabel}>
                  <span>{meta.emoji}</span>
                  <span>{meta.name}</span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className={styles.barValue}>{Math.round(percentage)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className={styles.card}>
        <h2>Your AI Collaboration Style</h2>
        <FormattedText text={evaluation.personalitySummary} as="p" className={styles.summary} />
      </div>

      {/* Prompt Patterns - Premium section with auth-based blur */}
      {evaluation.promptPatterns && evaluation.promptPatterns.length > 0 && (
        <div className={styles.card}>
          <h2>Your Prompt Patterns</h2>
          <div className={isPremiumLocked ? styles.blurredSection : ''}>
            <div className={isPremiumLocked ? styles.blurredContent : ''}>
              <div className={styles.patterns}>
                {evaluation.promptPatterns.map((pattern, idx) => (
                  <div key={idx} className={styles.patternItem}>
                    <h3>{pattern.patternName}</h3>
                    <p>{pattern.description}</p>
                    <span className={styles.frequency}>{pattern.frequency}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Unlock overlay for locked premium content */}
            {isPremiumLocked && (
              <div className={styles.unlockOverlay}>
                <button
                  className={styles.unlockButton}
                  onClick={handleUnlock}
                  disabled={isCheckoutLoading}
                >
                  {isCheckoutLoading
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
            )}
          </div>

          {/* Additional patterns count for premium users who haven't paid */}
          {isPremiumLocked && preview && preview.totalPromptPatterns > (evaluation.promptPatterns?.length || 0) && (
            <p className={styles.moreContent}>
              +{preview.totalPromptPatterns - (evaluation.promptPatterns?.length || 0)} more patterns available
            </p>
          )}
        </div>
      )}

      {/* Share & CTA */}
      <div className={styles.footer}>
        <button
          onClick={() => navigator.clipboard.writeText(window.location.href)}
          className={styles.shareButton}
        >
          📋 Copy Link
        </button>
        <a
          href="https://npmjs.com/package/no-ai-slop"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.ctaLink}
        >
          Get your own analysis →
        </a>
      </div>

      {/* Login Modal */}
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
