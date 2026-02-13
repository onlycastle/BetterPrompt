'use client';

import { Check } from 'lucide-react';
import { track } from '@vercel/analytics';
import { useInView } from '@/hooks/useInView';
import { Button } from '@/components/ui/Button';
import styles from './DownloadSection.module.css';

const howItWorks = [
  {
    step: '1',
    title: 'Connect your AI tool',
    text: 'Works with Claude Code, Cursor, and more. We read your session logs \u2014 not your source code.',
  },
  {
    step: '2',
    title: 'Get your assessment',
    text: 'Our AI analyzes how you work with AI. Patterns, risks, and opportunities \u2014 all in one report.',
  },
  {
    step: '3',
    title: 'Start improving',
    text: 'Actionable recommendations specific to your workflow. Track your progress over time.',
  },
];

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
    missing: ['Full analysis', 'Security report', 'Progress tracking', 'Learning resources'],
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
    missing: ['Progress tracking', 'Learning resources'],
  },
  {
    name: 'Pro',
    price: '$6.99',
    period: '/mo',
    features: [
      'Everything in Starter',
      'Progress tracking over time',
      'Learning resources',
      'Team comparison (up to 5)',
    ],
    missing: [],
  },
  {
    name: 'Team',
    price: 'Custom',
    period: '',
    features: [
      'Everything in Pro',
      'Team dashboard',
      'Manager insights',
      'SSO + admin controls',
    ],
    missing: [],
  },
];

export function DownloadSection() {
  const { ref, isInView } = useInView({ threshold: 0.1 });

  return (
    <section className={styles.section} id="pricing">
      <div ref={ref} className={`${styles.container} ${isInView ? styles.visible : ''}`}>
        <h2 className={styles.headline}>Get started in 2 minutes</h2>

        <p className={styles.description}>
          Connect your AI tool, get your assessment, and start improving.
          Free to start. Pay only for full insights.
        </p>

        {/* How it works */}
        <div className={styles.howItWorks}>
          <h3 className={styles.howTitle}>How it works</h3>
          <div className={styles.steps}>
            {howItWorks.map((item) => (
              <div key={item.step} className={styles.step}>
                <span className={styles.stepNumber}>{item.step}</span>
                <div className={styles.stepContent}>
                  <span className={styles.stepTitle}>{item.title}</span>
                  <span className={styles.stepText}>{item.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing comparison */}
        <div className={styles.pricing}>
          <h3 className={styles.pricingTitle}>Simple, transparent pricing</h3>
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
              track('pricing_cta_click');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Get your free assessment
          </Button>
        </div>

        <p className={styles.requirements}>
          Works with Claude Code. Cursor &amp; Replit support coming soon.
          <br />
          No installation required &mdash; runs in your browser.
        </p>
      </div>
    </section>
  );
}
