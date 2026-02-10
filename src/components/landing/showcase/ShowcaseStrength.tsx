import { STRENGTH_DATA } from './showcase-data';
import styles from './TasteCards.module.css';

export function ShowcaseStrength() {
  const d = STRENGTH_DATA;

  return (
    <div className={`${styles.card} ${styles.accentGreen}`}>
      {/* Section header */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIconGreen}>&#x2713;</span>
        <span className={styles.sectionLabel}>{d.sectionLabel}</span>
        <span className={styles.countBadgeGreen}>{d.count}</span>
      </div>

      {/* Title */}
      <div className={styles.titleRow}>
        <h3 className={styles.cardTitle}>
          <span className={styles.plusPrefix}>+</span> {d.title}
        </h3>
      </div>

      {/* Description */}
      <p className={styles.description}>{d.description}</p>

      {/* Evidence list */}
      <div className={styles.evidenceList}>
        {d.evidence.map((e, i) => (
          <div key={i}>
            <div className={`${styles.evidenceItem} ${e.expanded ? styles.evidenceExpanded : ''}`}>
              <span className={styles.chevron}>{e.expanded ? '\u25BC' : '\u25B8'}</span>
              <span className={styles.evidenceQuote}>{e.quote}</span>
              <span className={styles.evidenceTag}>{e.tag}</span>
            </div>

            {/* Expanded: original message context */}
            {e.expanded && e.originalMessage && (
              <div className={styles.originalContext}>
                <p className={styles.originalMessage}>{e.originalMessage}</p>
                {e.metadata && (
                  <div className={styles.originalMeta}>
                    <span className={styles.metaText}>{e.metadata}</span>
                    <span className={styles.viewContext}>View Context &#x2192;</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
