'use client';

import { Shield, Lock, Terminal, Check } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import { TerminalCommand } from './TerminalCommand';
import styles from './DownloadSection.module.css';

const features = [
  {
    icon: Terminal,
    title: 'Local Scanning',
    description: 'CLI reads your session files locally, no agents on your machine',
  },
  {
    icon: Shield,
    title: 'Secure Analysis',
    description: 'Data encrypted in transit, only insights stored — not raw sessions',
  },
  {
    icon: Lock,
    title: 'No Installation',
    description: 'Run directly with npx, no global install required',
  },
];

const pricingTiers = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    features: [
      '3 analyses/month',
      'Thinking Quality insights',
      'Diagnosis only',
    ],
    missing: ['Prescriptions', 'Progress tracking', 'Knowledge Base', 'API access'],
  },
  {
    name: 'One-Time',
    price: '$4.99',
    period: '',
    popular: true,
    features: [
      'Unlimited analyses',
      'All 5 worker insights',
      'Diagnosis + Prescriptions',
    ],
    missing: ['Progress tracking', 'Knowledge Base', 'API access'],
  },
  {
    name: 'Pro',
    price: '$6.99',
    period: '/mo',
    features: [
      '4 full reports / month',
      'All 5 worker insights',
      'Diagnosis + Prescriptions',
      'Progress tracking',
      'Full Knowledge Base',
      'API access',
    ],
    missing: [],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    features: [
      'Everything in Pro',
      'Team management',
      'Custom Knowledge Base',
      'SSO integration',
    ],
    missing: [],
  },
];

const howItWorks = [
  { step: '1', text: 'CLI reads your Claude Code sessions locally' },
  { step: '2', text: 'Summaries (not source code) are sent for analysis' },
  { step: '3', text: 'AI generates your personalized report' },
  { step: '4', text: 'Raw data is deleted — only your report is saved' },
];

export function DownloadSection() {
  const { ref, isInView } = useInView({ threshold: 0.1 });

  return (
    <section className={styles.section} id="download">
      <div ref={ref} className={`${styles.container} ${isInView ? styles.visible : ''}`}>
        <h2 className={styles.headline}>Try it now</h2>

        <p className={styles.description}>
          Run the CLI to analyze your Claude Code sessions locally.
          Free to scan. Pay only for full insights.
        </p>

        <div className={styles.downloadCard}>
          <TerminalCommand command="npx no-ai-slop" location="download" />
        </div>

        {/* How it works — privacy explanation */}
        <div className={styles.howItWorks}>
          <h3 className={styles.howTitle}>How it works</h3>
          <div className={styles.steps}>
            {howItWorks.map((item) => (
              <div key={item.step} className={styles.step}>
                <span className={styles.stepNumber}>{item.step}</span>
                <span className={styles.stepText}>{item.text}</span>
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
                      <span className={styles.dash}>—</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.features}>
          {features.map((feature) => (
            <div key={feature.title} className={styles.feature}>
              <div className={styles.featureIcon}>
                <feature.icon size={18} />
              </div>
              <div className={styles.featureContent}>
                <span className={styles.featureTitle}>{feature.title}</span>
                <span className={styles.featureDescription}>
                  {feature.description}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className={styles.requirements}>
          Requires Node.js 18+ · macOS, Linux, or Windows
          <br />
          Currently supports Claude Code. Cursor &amp; GitHub Copilot coming soon.
        </p>
      </div>
    </section>
  );
}
