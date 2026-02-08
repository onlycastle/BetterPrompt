'use client';

import { useInView } from '@/hooks/useInView';
import { PERCENTILE_DATA } from './showcase-data';
import styles from './TasteCards.module.css';

export function TasteCardPercentile() {
  const { ref, isInView } = useInView({ threshold: 0.3 });

  return (
    <div className={styles.card} ref={ref}>
      <span className={styles.label}>BENCHMARK</span>

      <div className={styles.percentileContent}>
        <span className={styles.percentileLabel}>{PERCENTILE_DATA.label}</span>

        <div className={styles.percentileBarTrack}>
          <div
            className={styles.percentileBarFill}
            style={{ width: isInView ? `${PERCENTILE_DATA.percentile}%` : '0%' }}
          />
          <span className={styles.percentileValue}>
            Top {100 - PERCENTILE_DATA.percentile}%
          </span>
        </div>

        <span className={styles.percentileContext}>
          vs. {PERCENTILE_DATA.totalDevelopers.toLocaleString()} developers
        </span>
      </div>
    </div>
  );
}
