'use client';

import { useState } from 'react';
import { BarChart3, Target, Users, Gift, Coffee, Zap, Lock, Sparkles, Loader2 } from 'lucide-react';
import { WaitlistModal, waitlistConfigs } from '@/components/landing';
import styles from './UnlockSection.module.css';

interface UnlockSectionProps {
  isUnlocked: boolean;
  resultId?: string;
}

/**
 * Benefit categories for the unlock section
 * Grouped into 4 categories for a clean 2x2 grid layout
 */
const benefitCategories = [
  {
    id: 'insights',
    icon: BarChart3,
    title: 'Deep Insights',
    color: 'cyan',
    items: [
      'AI Collaboration breakdown',
      'Control Index deep-dive',
      'Skill Resilience analysis',
    ],
  },
  {
    id: 'tips',
    icon: Target,
    title: 'Improvement Tips',
    color: 'pink',
    items: [
      'Best & worst prompt examples',
      'Personalized growth roadmap',
      'Practice exercises',
    ],
  },
  {
    id: 'comparison',
    icon: Users,
    title: 'Peer Comparison',
    color: 'green',
    items: [
      'Percentile rankings (vs 10K+ users)',
      'Learning velocity tracking',
    ],
  },
  {
    id: 'extras',
    icon: Gift,
    title: 'Extras',
    color: 'yellow',
    items: [
      'Downloadable PDF report',
      'Shareable profile badge',
      'All conversation evidence',
    ],
  },
] as const;

/**
 * CTA section for locked/unlocked states
 * Shows unlock badge when premium, paywall with pricing cards when free
 */
export function UnlockSection({ isUnlocked, resultId }: UnlockSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProWaitlistOpen, setIsProWaitlistOpen] = useState(false);

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
  return (
    <div className={styles.unlockSection}>
      {isUnlocked ? (
        <div className={styles.unlockedBadge}>
          <div className={styles.badgeIcon}>
            <Sparkles size={48} />
          </div>
          <h3 className={styles.badgeTitle}>Full Analysis Unlocked</h3>
          <p className={styles.badgeSubtitle}>
            You have access to all premium features and detailed breakdowns.
          </p>
        </div>
      ) : (
        <div className={styles.lockedContent}>
          {/* Header */}
          <div className={styles.lockIcon}>
            <Lock size={32} />
          </div>
          <h3 className={styles.lockedTitle}>Unlock Your Full Analysis</h3>
          <p className={styles.lockedDescription}>
            See the complete picture of your AI collaboration patterns
          </p>

          {/* Benefits Grid - 2x2 Categories */}
          <div className={styles.benefitsGrid}>
            {benefitCategories.map((category) => {
              const IconComponent = category.icon;
              return (
                <div
                  key={category.id}
                  className={styles.categoryCard}
                  data-color={category.color}
                >
                  <div className={styles.categoryHeader}>
                    <IconComponent size={20} className={styles.categoryIcon} />
                    <span className={styles.categoryTitle}>{category.title}</span>
                  </div>
                  <ul className={styles.categoryItems}>
                    {category.items.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Pricing Cards - ONE-TIME + PRO */}
          <div className={styles.pricingCards}>
            {/* ONE-TIME Card (Primary) */}
            <div className={`${styles.pricingCard} ${styles.primary}`}>
              <div className={styles.pricingHeader}>
                <Coffee size={20} />
                <span>ONE-TIME</span>
              </div>
              <div className={styles.pricingAmount}>$4.99</div>
              <button
                className={styles.unlockCta}
                onClick={handleCheckout}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} />
                    Processing...
                  </>
                ) : (
                  'Unlock Full Report'
                )}
              </button>
              {error && <div className={styles.errorMessage}>{error}</div>}
              <div className={styles.pricingNote}>
                Less than a coffee • Yours forever
              </div>
            </div>

            {/* PRO Card (Secondary) */}
            <div className={`${styles.pricingCard} ${styles.secondary}`}>
              <div className={styles.pricingHeader}>
                <Zap size={20} />
                <span>PRO</span>
              </div>
              <div className={styles.pricingAmount}>$6.99<span>/month</span></div>
              <div className={styles.proFeatures}>
                <div>정기적인 분석을 통한 맞춤형 데이터 분석</div>
                <div>성장을 위한 맞춤형 학습 자료 및 피드백 제공</div>
              </div>
              <button
                className={styles.subscribeCta}
                onClick={() => setIsProWaitlistOpen(true)}
              >
                Subscribe →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRO Waitlist Modal */}
      <WaitlistModal
        isOpen={isProWaitlistOpen}
        onClose={() => setIsProWaitlistOpen(false)}
        config={waitlistConfigs.pro_subscription}
      />
    </div>
  );
}
