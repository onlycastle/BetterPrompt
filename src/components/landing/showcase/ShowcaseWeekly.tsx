import { WEEKLY_DATA } from './showcase-data';
import styles from './TasteCards.module.css';

export function ShowcaseWeekly() {
  const d = WEEKLY_DATA;

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.weeklyHeader}>
        <h3 className={styles.weeklyTitle}>{d.title}</h3>
        <span className={styles.weeklyDate}>{d.dateRange}</span>
      </div>

      {/* Stats grid */}
      <div className={styles.statsGrid}>
        {d.stats.map((s, i) => (
          <div key={i} className={styles.statCell}>
            <span className={styles.statValue}>{s.value}</span>
            <span className={styles.statLabel}>{s.label}</span>
            <span
              className={`${styles.statDelta} ${
                s.direction === 'up' ? styles.deltaUp : styles.deltaDown
              }`}
            >
              {s.delta}
            </span>
          </div>
        ))}
      </div>

      {/* Narrative */}
      <blockquote className={styles.narrative}>{d.narrative}</blockquote>

      {/* Project bars */}
      <div className={styles.projectBars}>
        {d.projects.map((p, i) => (
          <div key={i} className={styles.projectRow}>
            <span className={styles.projectName}>{p.name}</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${p.percentage}%` }} />
            </div>
            <span className={styles.projectPct}>{p.percentage}%</span>
          </div>
        ))}
      </div>

      {/* Top sessions */}
      <div className={styles.topSessions}>
        {d.topSessions.map((s, i) => (
          <div key={i} className={styles.sessionRow}>
            <span className={styles.sessionDate}>{s.date}</span>
            <span className={styles.sessionDuration}>{s.duration}</span>
            <span className={styles.sessionSummary}>{s.summary}</span>
          </div>
        ))}
      </div>

      {/* Highlights */}
      <ul className={styles.highlights}>
        {d.highlights.map((h, i) => (
          <li key={i} className={styles.highlightItem}>
            {h}
          </li>
        ))}
      </ul>
    </div>
  );
}
