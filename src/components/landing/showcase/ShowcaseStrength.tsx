import { GROWTH_PATH_DATA } from './showcase-data';
import styles from './TasteCards.module.css';

export function ShowcaseStrength() {
  const d = GROWTH_PATH_DATA;

  return (
    <div className={`${styles.card} ${styles.accentGreen}`}>
      {/* Section header */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIconGreen}>&#x2191;</span>
        <span className={styles.sectionLabel}>{d.sectionLabel}</span>
      </div>

      {/* Profile type badge */}
      <span className={styles.profileBadge}>{d.profileType}</span>

      {/* Timeline progression */}
      <div className={styles.timeline}>
        {d.weeks.map((w) => (
          <div key={w.week} className={styles.timelineItem}>
            <div className={styles.timelineMeta}>
              <span className={styles.weekLabel}>{w.week}</span>
              <span className={styles.weekDescription}>{w.label}</span>
            </div>
            <div className={styles.progressRow}>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${w.score}%` }} />
              </div>
              <span className={styles.progressScore}>{w.score}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <p className={styles.growthSummary}>{d.summary}</p>
    </div>
  );
}
