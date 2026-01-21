import { BarChart3, Target, Users, Gift, Coffee, Zap, Lock, Sparkles } from 'lucide-react';
import styles from './UnlockSection.module.css';

interface UnlockSectionProps {
  isUnlocked: boolean;
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
export function UnlockSection({ isUnlocked }: UnlockSectionProps) {
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
              <button className={styles.unlockCta}>
                Unlock Full Report
              </button>
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
                <div>Unlimited analyses</div>
                <div>+ Trend tracking</div>
              </div>
              <button className={styles.subscribeCta}>
                Subscribe →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
