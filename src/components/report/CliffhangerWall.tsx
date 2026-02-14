'use client';

/**
 * CliffhangerWall - Dramatic paywall at the story's climax
 *
 * Appears after all growth area diagnoses have been revealed.
 * The user has seen all their problems — now the solutions are just out of reach.
 *
 * Design: Sticky full-viewport section with dark background.
 * Shows the most critical finding with a blurred recommendation preview,
 * progress summary, and a single CTA for payment.
 *
 * Reuses payment logic from UnlockSection (credits, checkout, waitlist).
 */

import { useState, useMemo } from 'react';
import { Coffee, Loader2, Coins } from 'lucide-react';
import type { AggregatedWorkerInsights, WorkerGrowth } from '@/lib/models/worker-insights';
import { WORKER_DOMAIN_CONFIGS } from '@/lib/models/worker-insights';
import styles from './CliffhangerWall.module.css';

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

interface CliffhangerWallProps {
  workerInsights?: AggregatedWorkerInsights;
  resultId?: string;
  credits?: number | null;
  onCreditsUsed?: () => void;
}

/**
 * Find the most critical growth area across all domains
 */
function findMostCritical(workerInsights?: AggregatedWorkerInsights): {
  growth: WorkerGrowth;
  domainTitle: string;
  domainIcon: string;
} | null {
  if (!workerInsights) return null;

  let best: { growth: WorkerGrowth; domainTitle: string; domainIcon: string } | null = null;
  let bestOrder = Infinity;

  for (const config of WORKER_DOMAIN_CONFIGS) {
    const domain = workerInsights[config.key];
    if (!domain?.growthAreas?.length) continue;

    for (const growth of domain.growthAreas) {
      const order = SEVERITY_ORDER[growth.severity ?? 'low'] ?? 3;
      if (order < bestOrder) {
        bestOrder = order;
        best = { growth, domainTitle: config.title, domainIcon: config.icon };
      }
    }
  }

  return best;
}

export function CliffhangerWall({
  workerInsights,
  resultId,
  credits,
  onCreditsUsed,
}: CliffhangerWallProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCreditLoading, setIsCreditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCredits = credits !== null && credits !== undefined && credits > 0;

  // Find the most critical growth area for dramatic highlight
  const critical = useMemo(() => findMostCritical(workerInsights), [workerInsights]);

  // Count strengths and growth areas for progress summary
  const { strengthCount, growthCount } = useMemo(() => {
    let s = 0;
    let g = 0;
    if (!workerInsights) return { strengthCount: s, growthCount: g };
    for (const config of WORKER_DOMAIN_CONFIGS) {
      const domain = workerInsights[config.key];
      if (!domain) continue;
      s += domain.strengths?.length ?? 0;
      g += domain.growthAreas?.length ?? 0;
    }
    return { strengthCount: s, growthCount: g };
  }, [workerInsights]);

  // Payment handlers (same logic as UnlockSection)
  const handleUseCredit = async () => {
    if (!resultId) { setError('Unable to process. Please refresh.'); return; }
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
      if (!response.ok) throw new Error(data.message || 'Failed to use credit');
      if (data.success) {
        onCreditsUsed?.();
      } else if (data.reason === 'insufficient_credits') {
        setError('No credits available.');
        setIsCreditLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsCreditLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!resultId) { setError('Unable to process payment. Please refresh.'); return; }
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create checkout');

      if (!data.checkoutUrl || typeof data.checkoutUrl !== 'string') {
        throw new Error('Invalid checkout URL');
      }
      const checkoutUrl = new URL(data.checkoutUrl);
      if (checkoutUrl.protocol !== 'https:') throw new Error('Invalid checkout URL protocol');
      window.location.href = checkoutUrl.href;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Gradient blur overlay from previous content */}
      <div className={styles.blurGradient} />

      <div className={styles.content}>
        {/* Progress Summary */}
        <div className={styles.progressSummary}>
          <div className={styles.progressItem} data-status="complete">
            <span className={styles.progressCheck}>{'✓'}</span>
            <span>{strengthCount} strengths identified</span>
          </div>
          <div className={styles.progressItem} data-status="complete">
            <span className={styles.progressCheck}>{'✓'}</span>
            <span>{growthCount} issues diagnosed</span>
          </div>
          <div className={styles.progressItem} data-status="locked">
            <span className={styles.progressLock}>{'🔒'}</span>
            <span>{growthCount} action plans locked</span>
          </div>
        </div>

        {/* Most Critical Finding Highlight */}
        {critical && (
          <div className={styles.criticalHighlight}>
            <div className={styles.criticalLabel}>
              Your most pressing issue
            </div>
            <div className={styles.criticalCard}>
              <span className={styles.criticalDomain}>
                {critical.domainIcon} {critical.domainTitle}
              </span>
              <h3 className={styles.criticalTitle}>{critical.growth.title}</h3>
              {critical.growth.recommendationPreview && (
                <div className={styles.criticalBlur}>
                  <p className={styles.blurredText}>
                    {'💡'} {critical.growth.recommendationPreview}...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Heading */}
        <h2 className={styles.heading}>
          The solutions are ready.
        </h2>
        <p className={styles.subheading}>
          Unlock personalized action plans for every issue found.
        </p>

        {/* CTA Buttons */}
        <div className={styles.ctaGroup}>
          {hasCredits ? (
            <button
              className={styles.primaryCta}
              onClick={handleUseCredit}
              disabled={isCreditLoading}
            >
              {isCreditLoading ? (
                <><Loader2 size={18} className={styles.spinner} /> Unlocking...</>
              ) : (
                <><Coins size={18} /> Use 1 Credit ({credits} available)</>
              )}
            </button>
          ) : (
            <button
              className={styles.primaryCta}
              onClick={handleCheckout}
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 size={18} className={styles.spinner} /> Processing...</>
              ) : (
                <><Coffee size={18} /> Unlock for $4.99</>
              )}
            </button>
          )}
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}
      </div>
    </div>
  );
}
