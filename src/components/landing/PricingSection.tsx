'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { track } from '@vercel/analytics';
import { useInView } from '@/hooks/useInView';
import { Button } from '@/components/ui/Button';
import { WaitlistModal, waitlistConfigs } from './WaitlistModal';
import styles from './PricingSection.module.css';

const pricingTiers = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    features: [
      '3 assessments/month',
      'Core AI Builder Profile',
      'Basic behavior analysis',
    ],
    missing: ['Full 6-dimension analysis', 'Priority processing', 'Progress tracking'],
  },
  {
    name: 'Starter',
    price: '$4.99',
    period: '',
    popular: true,
    features: [
      'Unlimited assessments',
      'Full 6-dimension analysis',
      'Security risk report',
      'Growth recommendations',
    ],
    missing: ['Progress tracking', 'Pattern history', 'Learning resources'],
  },
  {
    name: 'Pro',
    price: '$6.99',
    period: '/mo',
    features: [
      'Everything in Starter',
      'Progress tracking over time',
      'Pattern history',
      'Learning resources',
    ],
    missing: [],
  },
];

export function PricingSection() {
  const { ref, isInView } = useInView({ threshold: 0.1 });
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);

  return (
    <section className={styles.section} id="pricing">
      <div ref={ref} className={`${styles.container} ${isInView ? styles.visible : ''}`}>
        <h2 className={styles.headline}>Start free. Upgrade when you want more.</h2>

        {/* Pricing comparison */}
        <div className={styles.pricing}>
          <div className={styles.pricingGrid}>
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`${styles.pricingCard} ${tier.popular ? styles.pricingPopular : ''}`}
              >
                {tier.popular && (
                  <span className={styles.popularBadge}>Most Popular</span>
                )}
                <h4 className={styles.tierName}>{tier.name}</h4>
                <div className={styles.tierPrice}>
                  <span className={styles.priceValue}>{tier.price}</span>
                  {tier.period && <span className={styles.pricePeriod}>{tier.period}</span>}
                </div>
                <ul className={styles.tierFeatures}>
                  {tier.features.map((f) => (
                    <li key={f} className={styles.tierFeature}>
                      <Check size={14} className={styles.checkIcon} />
                      <span>{f}</span>
                    </li>
                  ))}
                  {tier.missing.map((f) => (
                    <li key={f} className={styles.tierMissing}>
                      <span className={styles.dash}>&mdash;</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.ctaRow}>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              track('cta_click', { location: 'pricing', type: 'try_it_free' });
              setIsWaitlistOpen(true);
            }}
          >
            Try It Free
          </Button>
        </div>

        <p className={styles.requirements}>
          All plans include privacy-first analysis. Your session data never leaves your machine.
        </p>
      </div>
      <WaitlistModal
        isOpen={isWaitlistOpen}
        onClose={() => setIsWaitlistOpen(false)}
        config={waitlistConfigs.free_trial}
      />
    </section>
  );
}
