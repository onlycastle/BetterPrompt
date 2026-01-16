import styles from './LockedTeasers.module.css';

interface LockedTeasersProps {
  isUnlocked: boolean;
}

const PREMIUM_FEATURES = [
  {
    icon: '🛠️',
    title: 'Tool Usage Deep Dive',
    description: 'Detailed analysis of how you use each tool, with comparisons to expert users and optimization strategies...',
    accentColor: 'var(--neon-magenta)',
  },
  {
    icon: '💰',
    title: 'Token Efficiency Analysis',
    description: 'Your token usage patterns, efficiency score, and estimated monthly savings with optimization tips...',
    accentColor: 'var(--neon-green)',
  },
  {
    icon: '🗺️',
    title: 'Personalized Growth Roadmap',
    description: 'Step-by-step plan to reach the next level, with time estimates and measurable milestones...',
    accentColor: 'var(--neon-cyan)',
  },
  {
    icon: '📊',
    title: 'Comparative Insights',
    description: 'How you compare to 10,000+ developers across key metrics, with percentile rankings...',
    accentColor: 'var(--neon-yellow)',
  },
  {
    icon: '📈',
    title: 'Session Trends',
    description: 'Track your improvement over time across all dimensions with trend analysis...',
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
