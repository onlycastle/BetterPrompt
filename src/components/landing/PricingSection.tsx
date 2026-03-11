'use client';

import { Check } from 'lucide-react';
import { track } from '@vercel/analytics';
import { useInView } from '@/hooks/useInView';
import { Button } from '@/components/ui/Button';
import styles from './PricingSection.module.css';

const setupCards = [
  {
    name: 'Next.js Server',
    price: 'Included',
    period: '',
    features: [
      'Runs Gemini analysis locally',
      'Stores auth and reports in SQLite',
      'Serves dashboard, shared reports, and device login',
    ],
    missing: ['No hosted billing', 'No managed SaaS dependencies'],
  },
  {
    name: 'CLI',
    price: 'Included',
    period: '',
    popular: true,
    features: [
      'Scans Claude Code and Cursor history',
      'Uses device login against your server',
      'Uploads session bundles directly to /api/analysis/run',
    ],
    missing: ['No desktop app required'],
  },
  {
    name: 'Local Storage',
    price: 'Included',
    period: '',
    features: [
      'SQLite for users and analysis history',
      'Local knowledge base under ~/.nomoreaislop',
      'Share links based on your result IDs',
    ],
    missing: [],
  },
];

export function PricingSection() {
  const { ref, isInView } = useInView({ threshold: 0.1 });
  const handleCtaClick = () => {
    track('cta_click', { location: 'pricing', type: 'read_setup_guide' });
    window.location.href = '/docs';
  };

  return (
    <section className={styles.section} id="pricing">
      <div ref={ref} className={`${styles.container} ${isInView ? styles.visible : ''}`}>
        <h2 className={styles.headline}>One deployment model. Everything included.</h2>

        <div className={styles.pricing}>
          <div className={styles.pricingGrid}>
            {setupCards.map((tier) => (
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
            onClick={handleCtaClick}
          >
            Read Setup Guide
          </Button>
        </div>

        <p className={styles.requirements}>
          No waitlist, no subscription, and no separate backend service. Run the server and CLI yourself.
        </p>
      </div>
    </section>
  );
}
