import { ANTI_PATTERN_DATA } from './showcase-data';
import styles from './TasteCards.module.css';

export function ShowcaseAntiPattern() {
  const d = ANTI_PATTERN_DATA;

  return (
    <div className={`${styles.card} ${styles.accentYellow}`}>
      {/* Section header */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon}>!</span>
        <span className={styles.sectionLabel}>{d.sectionLabel}</span>
        <span className={styles.countBadge}>{d.count}</span>
      </div>

      {/* Title + severity */}
      <div className={styles.titleRow}>
        <h3 className={styles.cardTitle}>{d.title}</h3>
        <span className={styles.severityBadge}>{d.severity}</span>
      </div>

      {/* Meta tags */}
      <div className={styles.metaTags}>
        <span className={styles.metaTagFilled}>{d.metaFoundIn}</span>
        <span className={styles.metaTagOutline}>{d.metaSeverity}</span>
      </div>

      {/* Description */}
      <p className={styles.description}>{d.description}</p>

      {/* Evidence list */}
      <div className={styles.evidenceList}>
        {d.evidence.map((e, i) => (
          <div key={i} className={styles.evidenceItem}>
            <span className={styles.chevron}>&#x25B8;</span>
            <span className={styles.evidenceQuote}>{e.quote}</span>
            <span className={styles.evidenceTag}>{e.tag}</span>
          </div>
        ))}
      </div>

      {/* THE FIX */}
      <div className={styles.fixBlock}>
        <span className={styles.fixLabel}>THE FIX</span>
        <p className={styles.fixText}>{d.fix}</p>
      </div>

      {/* Expert Knowledge */}
      <div className={styles.expertBlock}>
        <div className={styles.expertHeader}>
          <span className={styles.expertTitle}>{d.expertTitle}</span>
          <span className={styles.expertBadge}>{d.expertBadge}</span>
        </div>
        <ul className={styles.expertActions}>
          {d.expertActions.map((action, i) => (
            <li key={i} className={styles.expertAction}>
              {action}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
