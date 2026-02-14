'use client';

import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { track } from '@vercel/analytics';
import { useInView } from '@/hooks/useInView';
import { Button } from '@/components/ui/Button';
import styles from './DownloadSection.module.css';

const howItWorks = [
  {
    step: '1',
    title: 'Sign in and connect',
    text: 'Start in the web dashboard and connect your AI workflow. We analyze session summaries \u2014 not your source code.',
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
      'Full 5-dimension analysis',
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
  const router = useRouter();
  const { ref, isInView } = useInView({ threshold: 0.1 });

  return (
    <section className={styles.section} id="pricing">
      <div ref={ref} className={`${styles.container} ${isInView ? styles.visible : ''}`}>
        <h2 className={styles.headline}>Get started free in minutes</h2>

        <p className={styles.description}>
          See your blind spots, risks, and growth opportunities.
          Free to start. Upgrade only when you want deeper guidance.
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
              track('cta_click', { location: 'pricing', type: 'get_started_free' });
              router.push('/dashboard/analyze');
            }}
          >
            Get Started Free
          </Button>
        </div>

        <p className={styles.requirements}>
          Works with Claude Code today. Cursor &amp; Replit support coming soon.
          <br />
          Start from the web dashboard, then run one command to scan local sessions.
        </p>
      </div>
    </section>
  );
}
