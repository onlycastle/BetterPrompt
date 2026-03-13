import type { ReactNode } from 'react';
import styles from './TerminalWindow.module.css';

interface TerminalWindowProps {
  children: ReactNode;
  title?: string;
}

/**
 * macOS-style terminal window frame with traffic light buttons
 * Provides the outer window chrome for the report UI
 */
export function TerminalWindow({ children, title = 'BetterPrompt — analysis-report.html' }: TerminalWindowProps) {
  return (
    <div className={styles.terminalWindow}>
      {/* macOS Titlebar */}
      <div className={styles.terminalTitlebar}>
        <div className={styles.terminalButtons}>
          <span className={`${styles.terminalBtn} ${styles.close}`} />
          <span className={`${styles.terminalBtn} ${styles.minimize}`} />
          <span className={`${styles.terminalBtn} ${styles.maximize}`} />
        </div>
        <span className={styles.terminalTitle}>{title}</span>
        <div className={styles.terminalSpacer} />
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
