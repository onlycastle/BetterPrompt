import { SECURITY_RISK_DATA } from './showcase-data';
import type { RiskItem } from './showcase-data';
import styles from './TasteCards.module.css';

/** Map severity level to CSS module class */
const SEVERITY_CLASS: Record<RiskItem['severity'], string> = {
  CRITICAL: styles.severityCritical,
  HIGH: styles.severityHigh,
  MEDIUM: styles.severityMedium,
};

export function ShowcaseWeekly() {
  const d = SECURITY_RISK_DATA;

  return (
    <div className={`${styles.card} ${styles.accentRed}`}>
      {/* Section header */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIconRed}>!</span>
        <span className={styles.sectionLabel}>{d.sectionLabel}</span>
      </div>

      {/* Summary bar */}
      <div className={styles.summaryBar}>
        <span className={styles.totalIssues}>{d.totalIssues} issues found</span>
        <span className={styles.severityCritical}>{d.criticalCount} CRITICAL</span>
        <span className={styles.severityHigh}>{d.highCount} HIGH</span>
        <span className={styles.severityMedium}>{d.mediumCount} MEDIUM</span>
      </div>

      {/* Risk items list */}
      <div className={styles.riskList}>
        {d.items.map((item, i) => (
          <div key={i} className={styles.riskItem}>
            <span className={SEVERITY_CLASS[item.severity]}>{item.severity}</span>
            <div className={styles.riskContent}>
              <span className={styles.riskTitle}>{item.title}</span>
              <span className={styles.riskDetail}>{item.detail}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <p className={styles.riskFooter}>{d.footer}</p>
    </div>
  );
}
