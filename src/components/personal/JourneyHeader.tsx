/**
 * JourneyHeader Component
 * Hero section showing user's current type and growth milestone
 */

import { TrendingUp } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { TYPE_METADATA } from '../../types/enterprise';
import type { PersonalAnalytics } from '../../types/personal';
import styles from './JourneyHeader.module.css';

export interface JourneyHeaderProps {
  analytics: PersonalAnalytics;
}

export function JourneyHeader({ analytics }: JourneyHeaderProps) {
  const typeMetadata = TYPE_METADATA[analytics.currentType];
  const formattedDate = new Date(analytics.firstAnalysisDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <Card padding="lg" className={styles.hero}>
      <CardContent>
        <div className={styles.heroContent}>
          <div className={styles.typeSection}>
            <span className={styles.emoji} role="img" aria-label={typeMetadata.label}>
              {typeMetadata.emoji}
            </span>
            <div className={styles.typeInfo}>
              <h2 className={styles.typeLabel}>{typeMetadata.label}</h2>
              <p className={styles.subtitle}>Your current AI coding style</p>
            </div>
          </div>

          <div className={styles.statsSection}>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{analytics.analysisCount}</div>
              <div className={styles.statLabel}>Analyses</div>
            </div>

            <div className={styles.divider} />

            <div className={styles.statItem}>
              <div className={styles.statValue}>{formattedDate}</div>
              <div className={styles.statLabel}>Growing since</div>
            </div>
          </div>

          {analytics.totalImprovement > 0 && (
            <div className={styles.milestone}>
              <TrendingUp size={20} className={styles.milestoneIcon} />
              <p className={styles.milestoneText}>
                You've improved <strong>{analytics.totalImprovement} points</strong> since your first analysis!
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
