import { ACTIVITY_DATA } from './showcase-data';
import styles from './TasteCards.module.css';

const INTENSITY_CLASSES = [
  styles.cell0,
  styles.cell1,
  styles.cell2,
  styles.cell3,
  styles.cell4,
] as const;

export function TasteCardActivity() {
  return (
    <div className={styles.card}>
      <span className={styles.label}>MONTHLY VIBE</span>

      <div className={styles.activityContent}>
        <div className={styles.heatmap}>
          {ACTIVITY_DATA.weeks.map((week, wi) => (
            <div key={wi} className={styles.heatmapWeek}>
              {week.map((level, di) => (
                <div
                  key={di}
                  className={`${styles.heatmapCell} ${INTENSITY_CLASSES[level]}`}
                />
              ))}
            </div>
          ))}
        </div>

        <div className={styles.activityStats}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{ACTIVITY_DATA.sessionsThisMonth}</span>
            <span className={styles.statLabel}>sessions</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{ACTIVITY_DATA.tokensProcessed}</span>
            <span className={styles.statLabel}>tokens</span>
          </div>
        </div>
      </div>
    </div>
  );
}
