import styles from './LockedTeasers.module.css';

interface LockedTeasersProps {
  isUnlocked: boolean;
}

const PREMIUM_FEATURES = [
  {
    icon: '🤖',
    title: 'Full AI Agent Analysis',
    description: '7 specialized AI agents analyzing your sessions: anti-pattern detection, knowledge gaps, context efficiency, and more...',
    accentColor: 'var(--neon-magenta)',
  },
  {
    icon: '💡',
    title: 'Actionable Recommendations',
    description: 'Specific improvement tips for every pattern, growth area recommendations, and agent-specific action items...',
    accentColor: 'var(--neon-green)',
  },
  {
    icon: '📊',
    title: 'Full Progress History',
    description: 'Track all your analyses over time with skill evolution timeline...',
    accentColor: 'var(--neon-cyan)',
  },
  {
    icon: '🔬',
    title: 'Detailed Dimension Breakdowns',
    description: 'Deep analysis of AI collaboration, context efficiency, temporal patterns, and more...',
    accentColor: 'var(--neon-yellow)',
  },
  {
    icon: '💬',
    title: 'Complete Evidence Quotes',
    description: 'All conversation evidence supporting your analysis and insights...',
    accentColor: 'var(--neon-pink)',
  },
];

/**
 * Premium content teasers with blur effect
 * Shows preview of locked content to encourage unlocking
 */
export function LockedTeasers({ isUnlocked }: LockedTeasersProps) {
  if (isUnlocked) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.title}>Premium Content</div>
      <div className={styles.grid}>
        {PREMIUM_FEATURES.map((feature) => (
          <div
            key={feature.title}
            className={styles.featureCard}
            style={{ '--accent': feature.accentColor } as React.CSSProperties}
          >
            <div className={styles.featureTitle}>
              <span>{feature.icon}</span>
              {feature.title}
            </div>
            <div className={styles.featureDescription}>{feature.description}</div>
          </div>
        ))}
      </div>
      <div className={styles.unlockPrompt}>
        Unlock all premium features for $6.99
      </div>
    </div>
  );
}
