/**
 * JourneyHeader Component
 * Displays current type, analysis count, and improvement score
 */

import type { PersonalAnalyticsExtended } from '../../api/types';
import styles from './JourneyHeader.module.css';

export interface JourneyHeaderProps {
  analytics: PersonalAnalyticsExtended;
}

const TYPE_DATA: Record<string, { emoji: string; label: string; description: string }> = {
  architect: {
    emoji: '🏗️',
    label: 'The Architect',
    description: 'You design systems with AI as your collaborator',
  },
  speedrunner: {
    emoji: '⚡',
    label: 'The Speedrunner',
    description: 'You move fast and iterate quickly with AI',
  },
  perfectionist: {
    emoji: '🎯',
    label: 'The Perfectionist',
    description: 'You refine every detail until it\'s just right',
  },
  explorer: {
    emoji: '🧭',
    label: 'The Explorer',
    description: 'You discover new possibilities through AI collaboration',
  },
  pragmatist: {
    emoji: '🛠️',
    label: 'The Pragmatist',
    description: 'You focus on practical solutions that work',
  },
  unknown: {
    emoji: '🎭',
    label: 'Unknown Type',
    description: 'Complete more analyses to discover your style',
  },
};

export function JourneyHeader({ analytics }: JourneyHeaderProps) {
  const typeData = TYPE_DATA[analytics.currentType] || TYPE_DATA.unknown;

  return (
    <div className={styles.hero}>
      <div className={styles.typeSection}>
        <span className={styles.emoji}>{typeData.emoji}</span>
        <div className={styles.typeInfo}>
          <h2 className={styles.typeName}>{typeData.label}</h2>
          <p className={styles.typeDescription}>{typeData.description}</p>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{analytics.analysisCount}</span>
          <span className={styles.statLabel}>
            {analytics.analysisCount === 1 ? 'Analysis' : 'Analyses'}
          </span>
        </div>

        {analytics.totalImprovement !== 0 && (
          <div className={`${styles.stat} ${analytics.totalImprovement > 0 ? styles.positive : styles.negative}`}>
            <span className={styles.statValue}>
              {analytics.totalImprovement > 0 ? '+' : ''}
              {analytics.totalImprovement}
            </span>
            <span className={styles.statLabel}>points since first</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default JourneyHeader;
