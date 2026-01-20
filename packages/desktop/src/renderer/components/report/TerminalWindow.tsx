import type { ReactNode } from 'react';
import styles from './TerminalWindow.module.css';

interface TerminalWindowProps {
  children: ReactNode;
  title?: string;
  onClose?: () => void;
  onNewAnalysis?: () => void;
  variant?: 'overlay' | 'inline';
}

/**
 * macOS-style terminal window frame with traffic light buttons
 * Provides the outer window chrome for the report UI
 *
 * Variants:
 * - 'overlay': Fixed position overlay (default, for ResultsPage)
 * - 'inline': Flows within page layout (for AnalyzePage inline report)
 */
export function TerminalWindow({
  children,
  title = 'NoMoreAISlop — analysis-report.html',
  onClose,
  onNewAnalysis,
  variant = 'overlay',
}: TerminalWindowProps) {
  const windowClass = variant === 'inline'
    ? `${styles.terminalWindow} ${styles.terminalWindowInline}`
    : styles.terminalWindow;

  // In inline mode, show New Analysis button instead of close button
  const showCloseButton = variant === 'overlay' && onClose;
  const showNewAnalysisButton = variant === 'inline' && onNewAnalysis;

  return (
    <div className={windowClass}>
      {/* macOS Titlebar */}
      <div className={styles.terminalTitlebar}>
        <div className={styles.terminalButtons}>
          {showCloseButton ? (
            <button
              type="button"
              className={`${styles.terminalBtn} ${styles.close}`}
              onClick={onClose}
              aria-label="Close"
            />
          ) : (
            <span className={`${styles.terminalBtn} ${styles.closeDisabled}`} />
          )}
          <span className={`${styles.terminalBtn} ${styles.minimize}`} />
          <span className={`${styles.terminalBtn} ${styles.maximize}`} />
        </div>
        <span className={styles.terminalTitle}>{title}</span>

        {/* New Analysis button for inline mode */}
        {showNewAnalysisButton ? (
          <button
            type="button"
            className={styles.newAnalysisBtn}
            onClick={onNewAnalysis}
          >
            + New Analysis
          </button>
        ) : (
          <div className={styles.terminalSpacer} />
        )}
      </div>

      {/* Content - Scrollable */}
      <div className={styles.terminalContent}>
        {children}
      </div>
    </div>
  );
}
