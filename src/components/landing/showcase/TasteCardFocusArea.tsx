import { FOCUS_AREA_DATA } from './showcase-data';
import styles from './TasteCards.module.css';

export function TasteCardFocusArea() {
  return (
    <div className={styles.card}>
      <span className={styles.label}>TOP FOCUS AREA</span>

      <div className={styles.focusContent}>
        <div className={styles.focusHeader}>
          <span className={styles.focusTitle}>{FOCUS_AREA_DATA.title}</span>
          <div className={styles.priorityBar}>
            <div
              className={styles.priorityFill}
              style={{ width: `${FOCUS_AREA_DATA.priorityScore}%` }}
            />
          </div>
        </div>

        <ul className={styles.actionList}>
          <li className={styles.actionItem}>
            <span className={styles.actionBadgeStart}>START</span>
            <span className={styles.actionText}>{FOCUS_AREA_DATA.actions.start}</span>
          </li>
          <li className={styles.actionItem}>
            <span className={styles.actionBadgeStop}>STOP</span>
            <span className={styles.actionText}>{FOCUS_AREA_DATA.actions.stop}</span>
          </li>
          <li className={styles.actionItem}>
            <span className={styles.actionBadgeContinue}>CONTINUE</span>
            <span className={styles.actionText}>{FOCUS_AREA_DATA.actions.continue}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
