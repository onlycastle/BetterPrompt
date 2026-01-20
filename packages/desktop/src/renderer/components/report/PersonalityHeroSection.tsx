/**
 * PersonalityHeroSection Component
 *
 * Displays personality insights using 4 storytelling techniques:
 * 1. Specific Evidence - "You said '/plan' 8 times..."
 * 2. Confirmation Pattern - "~시죠?" / "don't you?"
 * 3. Strength-Shadow Connection - strength vs growth side-by-side
 * 4. Daily Life Bridge - connects coding to real life
 *
 * Creates the "Wow, they really know me!" moment.
 */

import type { PersonalityInsights } from '../../types/report';
import { FormattedText } from '../../utils/textFormatting';
import styles from './PersonalityHeroSection.module.css';

interface PersonalityHeroSectionProps {
  insights: PersonalityInsights;
}

export function PersonalityHeroSection({ insights }: PersonalityHeroSectionProps) {
  const {
    coreObservation,
    strengthConnection,
    growthOpportunity,
    dailyLifeConnection,
  } = insights;

  return (
    <div className={styles.container}>
      {/* Hero: Core Observation with confirmation question */}
      <div className={styles.heroCard}>
        <div className={styles.heroIcon}>💡</div>
        <div className={styles.heroContent}>
          <FormattedText
            text={coreObservation}
            as="p"
            className={styles.heroText}
            boldClassName={styles.heroBold}
          />
        </div>
      </div>

      {/* Two-column: Strength vs Growth */}
      <div className={styles.dualCards}>
        <div className={styles.strengthCard}>
          <div className={styles.cardIcon}>✨</div>
          <h4 className={styles.cardLabel}>Your Strength</h4>
          <FormattedText
            text={strengthConnection}
            as="p"
            className={styles.cardText}
          />
        </div>

        <div className={styles.growthCard}>
          <div className={styles.cardIcon}>🌱</div>
          <h4 className={styles.cardLabel}>Growth Edge</h4>
          <FormattedText
            text={growthOpportunity}
            as="p"
            className={styles.cardText}
          />
        </div>
      </div>

      {/* Optional: Daily Life Bridge */}
      {dailyLifeConnection && (
        <div className={styles.bridgeCard}>
          <span className={styles.bridgeIcon}>🏠</span>
          <FormattedText
            text={dailyLifeConnection}
            as="p"
            className={styles.bridgeText}
          />
        </div>
      )}
    </div>
  );
}
