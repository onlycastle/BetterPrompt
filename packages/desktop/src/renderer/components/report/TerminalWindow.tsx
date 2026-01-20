import type { ReactNode } from 'react';
import styles from './TerminalWindow.module.css';

interface TerminalWindowProps {
  children: ReactNode;
  title?: string;
  onClose?: () => void;
}

/**
 * macOS-style terminal window frame with traffic light buttons
 * Provides the outer window chrome for the report UI
 */
export function TerminalWindow({ children, title = 'NoMoreAISlop — analysis-report.html', onClose }: TerminalWindowProps) {
  return (
    <div className={styles.terminalWindow}>
      {/* macOS Titlebar */}
      <div className={styles.terminalTitlebar}>
        <div className={styles.terminalButtons}>
          <button
            type="button"
            className={`${styles.terminalBtn} ${styles.close}`}
            onClick={onClose}
            aria-label="Close"
          />
          <span className={`${styles.terminalBtn} ${styles.minimize}`} />
          <span className={`${styles.terminalBtn} ${styles.maximize}`} />
        </div>
        <span className={styles.terminalTitle}>{title}</span>
        <div className={styles.terminalSpacer} />
      </div>

      {/* Content - Scrollable */}
      <div className={styles.terminalContent}>
        {children}
      </div>
    </div>
  );
}
