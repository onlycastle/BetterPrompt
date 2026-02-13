import { DEPENDENCY_SCORE_DATA } from './showcase-data';
import styles from './TasteCards.module.css';

/** SVG gauge constants */
const RADIUS = 56;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Map breakdown index to a fill color class */
const FILL_CLASSES = [
  styles.breakdownFillWarn,
  styles.breakdownFillOk,
  styles.breakdownFillGood,
] as const;

export function ShowcaseAntiPattern() {
  const d = DEPENDENCY_SCORE_DATA;
  const offset = CIRCUMFERENCE - (d.scorePercent / 100) * CIRCUMFERENCE;

  return (
    <div className={`${styles.card} ${styles.accentYellow}`}>
      {/* Section header */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon}>!</span>
        <span className={styles.sectionLabel}>{d.sectionLabel}</span>
      </div>

      {/* Gauge visualization */}
      <div className={styles.gaugeContainer}>
        <div className={styles.gaugeRing}>
          <svg className={styles.gaugeSvg} viewBox="0 0 140 140">
            <circle className={styles.gaugeTrack} cx="70" cy="70" r={RADIUS} />
            <circle
              className={styles.gaugeFill}
              cx="70"
              cy="70"
              r={RADIUS}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
            />
          </svg>
          <div className={styles.gaugeCenter}>
            <span className={styles.gaugeValue}>
              {d.scorePercent}
              <span className={styles.gaugeUnit}>%</span>
            </span>
            <span className={styles.gaugeLabel}>{d.scoreLabel}</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className={styles.description}>{d.description}</p>

      {/* Breakdown bars */}
      <div className={styles.breakdownList}>
        {d.breakdown.map((item, i) => (
          <div key={item.label} className={styles.breakdownRow}>
            <span className={styles.breakdownLabel}>{item.label}</span>
            <div className={styles.breakdownTrack}>
              <div
                className={FILL_CLASSES[i] ?? styles.breakdownFillWarn}
                style={{ width: `${item.value}%` }}
              />
            </div>
            <span className={styles.breakdownValue}>{item.value}%</span>
          </div>
        ))}
      </div>

      {/* Insight callout */}
      <div className={styles.insightBlock}>{d.insight}</div>
    </div>
  );
}
