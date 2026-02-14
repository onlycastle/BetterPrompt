'use client';

import { useState } from 'react';
import { Coffee, Zap, Lock, Loader2, Coins, Building2 } from 'lucide-react';
import { WaitlistModal, waitlistConfigs } from '@/components/landing';
import styles from './UnlockSection.module.css';

/**
 * Preview data for a locked worker domain (passed from DashboardReportContent).
 * Contains just enough info to show a value teaser in the unlock section.
 */
export interface LockedDomainPreview {
  icon: string;
  title: string;
  score: number;
  topStrength: { title: string; descriptionPreview?: string };
  topGrowth: { title: string; descriptionPreview?: string };
  growthCount: number;
}

interface UnlockSectionProps {
  isUnlocked: boolean;
  resultId?: string;
  /** User's credit balance (null if not authenticated) */
  credits?: number | null;
  /** Callback after credits are used successfully */
  onCreditsUsed?: () => void;
  /** Preview data for locked worker domains */
  lockedDomains?: LockedDomainPreview[];
}

/**
 * CTA section for locked/unlocked states
 * Shows unlock badge when premium, paywall with pricing cards when free
 *
 * Credit Flow:
 * - If credits > 0: Show "Use 1 Credit to Unlock" button with balance
 * - If credits === 0 or null: Show $4.99 one-time payment option
 */
export function UnlockSection({ isUnlocked, resultId, credits, onCreditsUsed, lockedDomains }: UnlockSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCreditLoading, setIsCreditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProWaitlistOpen, setIsProWaitlistOpen] = useState(false);
  const [isEnterpriseContactOpen, setIsEnterpriseContactOpen] = useState(false);

  // Determine if user has credits available
  const hasCredits = credits !== null && credits !== undefined && credits > 0;

  /**
   * Handle using a credit to unlock the report
   * Calls /api/credits/use and triggers refetch on success
   */
  const handleUseCredit = async () => {
    if (!resultId) {
      setError('Unable to process. Please refresh and try again.');
      return;
    }

    setIsCreditLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/credits/use', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ resultId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to use credit');
      }

      if (data.success) {
        // Trigger parent refetch to reload the report with full data
        onCreditsUsed?.();
      } else {
        setError(data.reason === 'insufficient_credits'
          ? 'No credits available. Please purchase credits to unlock.'
          : data.message || 'Failed to unlock. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsCreditLoading(false);
    }
  };

  /**
   * Handle checkout button click
   * Calls the checkout API and redirects to Polar payment page
   */
  const handleCheckout = async () => {
    if (!resultId) {
      setError('Unable to process payment. Please refresh and try again.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resultId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create checkout session');
      }

      // Validate checkout URL before redirect
      if (!data.checkoutUrl || typeof data.checkoutUrl !== 'string') {
        throw new Error('Invalid checkout URL received from server');
      }

      try {
        const checkoutUrl = new URL(data.checkoutUrl);
        // Only allow HTTPS URLs for security
        if (checkoutUrl.protocol !== 'https:') {
          throw new Error('Invalid checkout URL protocol');
        }
        // Redirect to Polar checkout page
        window.location.href = checkoutUrl.href;
      } catch {
        throw new Error('Invalid checkout URL format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsLoading(false);
    }
  };
  // Don't render anything when already unlocked - the badge adds no value
  if (isUnlocked) {
    return null;
  }

  return (
    <div id="unlock-section" className={styles.unlockSection}>
      <div className={styles.lockedContent}>
          {/* Header */}
          <div className={styles.lockIcon}>
            <Lock size={32} />
          </div>
          <h3 className={styles.lockedTitle}>Unlock Your Full Analysis</h3>
          <p className={styles.lockedDescription}>
            See the complete picture of your AI collaboration patterns
          </p>

          {/* Preview Gallery - What You're Missing */}
          {lockedDomains && lockedDomains.length > 0 && (
            <div className={styles.previewGallery}>
              <p className={styles.previewGalleryTitle}>What You&apos;re Missing</p>
              <div className={styles.previewGrid}>
                {lockedDomains.map((domain) => (
                  <div key={domain.title} className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span className={styles.previewCardIcon}>{domain.icon}</span>
                      <span className={styles.previewCardTitle}>{domain.title}</span>
                      <span className={styles.previewCardScore}>{domain.score}</span>
                    </div>
                    <div className={styles.previewCardBody}>
                      {domain.topStrength.title && (
                        <div className={styles.previewItem}>
                          <span className={styles.previewItemLabel}>Strength</span>
                          <span className={styles.previewItemTitle}>{domain.topStrength.title}</span>
                          {domain.topStrength.descriptionPreview && (
                            <p className={styles.previewBlurred}>
                              {domain.topStrength.descriptionPreview}...
                            </p>
                          )}
                        </div>
                      )}
                      {domain.topGrowth.title && (
                        <div className={styles.previewItem} data-type="growth">
                          <span className={styles.previewItemLabel}>Growth Area</span>
                          <span className={styles.previewItemTitle}>{domain.topGrowth.title}</span>
                          {domain.topGrowth.descriptionPreview && (
                            <p className={styles.previewBlurred}>
                              {domain.topGrowth.descriptionPreview}...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    {domain.growthCount > 1 && (
                      <div className={styles.previewCardFooter}>
                        +{domain.growthCount - 1} more growth area{domain.growthCount - 1 !== 1 ? 's' : ''} with action plans
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pricing Cards - CREDIT (if available) + ONE-TIME + PRO */}
          <div className={hasCredits ? styles.pricingCardsWithCredit : styles.pricingCards}>
            {/* CREDIT Card (shown when user has credits) */}
            {hasCredits && (
              <div className={`${styles.pricingCard} ${styles.credit}`}>
                <div className={styles.pricingHeader}>
                  <Coins size={20} />
                  <span>USE CREDIT</span>
                </div>
                <div className={styles.creditBalance}>
                  <span className={styles.creditCount}>{credits}</span>
                  <span className={styles.creditLabel}>
                    credit{credits !== 1 ? 's' : ''} available
                  </span>
                </div>
                <button
                  className={styles.creditCta}
                  onClick={handleUseCredit}
                  disabled={isCreditLoading}
                >
                  {isCreditLoading ? (
                    <>
                      <Loader2 size={16} className={styles.spinner} />
                      Unlocking...
                    </>
                  ) : (
                    'Use 1 Credit to Unlock'
                  )}
                </button>
                {error && <div className={styles.errorMessage}>{error}</div>}
                <div className={styles.pricingNote}>
                  Instant access • No payment required
                </div>
              </div>
            )}

            {/* ONE-TIME Card (Primary when no credits, Secondary when credits available) */}
            <div className={`${styles.pricingCard} ${hasCredits ? styles.secondary : styles.primary}`}>
              <div className={styles.pricingHeader}>
                <Coffee size={20} />
                <span>ONE-TIME</span>
              </div>
              <div className={styles.pricingAmount}>$4.99</div>
              <ul className={styles.featureList}>
                <li>Unlock all contents</li>
                <li>One-time payment</li>
                <li>Yours forever</li>
              </ul>
              <button
                className={hasCredits ? styles.subscribeCta : styles.unlockCta}
                onClick={handleCheckout}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} />
                    Processing...
                  </>
                ) : (
                  'Unlock Now'
                )}
              </button>
              {!hasCredits && error && <div className={styles.errorMessage}>{error}</div>}
              {process.env.NODE_ENV !== 'production' && (
                <p className={styles.testHint}>Test coupon: PO100LAR</p>
              )}
            </div>

            {/* PRO Card (Secondary) - Only show when no credits to avoid 3-card clutter */}
            {!hasCredits && (
              <div className={`${styles.pricingCard} ${styles.secondary}`}>
                <div className={styles.pricingHeader}>
                  <Zap size={20} />
                  <span>PRO</span>
                </div>
                <div className={styles.pricingAmount}>$6.99<span>/month</span></div>
                <ul className={styles.featureList}>
                  <li>4 full reports / month</li>
                  <li>Personalized insights</li>
                  <li>Progress tracking</li>
                </ul>
                <button
                  className={styles.subscribeCta}
                  onClick={() => setIsProWaitlistOpen(true)}
                >
                  Subscribe →
                </button>
              </div>
            )}

            {/* ENTERPRISE Card - Always show when no credits */}
            {!hasCredits && (
              <div className={`${styles.pricingCard} ${styles.enterprise}`}>
                <div className={styles.pricingHeader}>
                  <Building2 size={20} />
                  <span>ENTERPRISE</span>
                </div>
                <div className={styles.pricingAmount}>Custom</div>
                <ul className={styles.featureList}>
                  <li>Team capability assessment</li>
                  <li>Member performance tracking</li>
                  <li>Admin dashboard</li>
                </ul>
                <button
                  className={styles.contactCta}
                  onClick={() => setIsEnterpriseContactOpen(true)}
                >
                  Contact Us
                </button>
              </div>
            )}
          </div>

          {/* Discord Community CTA */}
          <div className={styles.discord}>
            <blockquote className={styles.discordQuote}>
              <span className={styles.discordLine1}>Want to share and discuss how to use AI wisely with others?</span>
              <span className={styles.discordLine2}>Join our Discord community.</span>
            </blockquote>
            <a
              href="https://discord.gg/xS3eDseCFH"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.discordLink}
            >
              <svg
                className={styles.discordIcon}
                viewBox="0 -28.5 256 256"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="xMidYMid"
              >
                <path
                  d="M216.856 16.597A208.502 208.502 0 0 0 164.042 0c-2.275 4.113-4.933 9.645-6.766 14.046-19.692-2.961-39.203-2.961-58.533 0-1.832-4.4-4.55-9.933-6.846-14.046a207.809 207.809 0 0 0-52.855 16.638C5.618 67.147-3.443 116.4 1.087 164.956c22.169 16.555 43.653 26.612 64.775 33.193A161.094 161.094 0 0 0 79.735 175.3a136.413 136.413 0 0 1-21.846-10.632 108.636 108.636 0 0 0 5.356-4.237c42.122 19.702 87.89 19.702 129.51 0a131.66 131.66 0 0 0 5.355 4.237 136.07 136.07 0 0 1-21.886 10.653c4.006 8.02 8.638 15.67 13.873 22.848 21.142-6.58 42.646-16.637 64.815-33.213 5.316-56.288-9.08-105.09-38.056-148.36ZM85.474 135.095c-12.645 0-23.015-11.805-23.015-26.18s10.149-26.2 23.015-26.2c12.867 0 23.236 11.804 23.015 26.2.02 14.375-10.148 26.18-23.015 26.18Zm85.051 0c-12.645 0-23.014-11.805-23.014-26.18s10.148-26.2 23.014-26.2c12.867 0 23.236 11.804 23.015 26.2 0 14.375-10.148 26.18-23.015 26.18Z"
                  fill="currentColor"
                />
              </svg>
              <span>Join the Community</span>
            </a>
          </div>
        </div>

      {/* PRO Waitlist Modal */}
      <WaitlistModal
        isOpen={isProWaitlistOpen}
        onClose={() => setIsProWaitlistOpen(false)}
        config={waitlistConfigs.pro_subscription}
      />

      {/* Enterprise Contact Modal */}
      <WaitlistModal
        isOpen={isEnterpriseContactOpen}
        onClose={() => setIsEnterpriseContactOpen(false)}
        config={waitlistConfigs.enterprise_contact}
      />
    </div>
  );
}
