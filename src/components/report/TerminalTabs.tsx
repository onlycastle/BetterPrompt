import styles from './TerminalTabs.module.css';

interface TerminalTabsProps {
  tabs: Array<{
    id: string;
    label: string;
  }>;
  activeIndex: number;
  onTabClick: (index: number) => void;
  showHint?: boolean;
}

/**
 * iTerm2-style tab navigation bar
 * Shows section tabs with keyboard navigation hints
 */
export function TerminalTabs({ tabs, activeIndex, onTabClick, showHint = true }: TerminalTabsProps) {
  return (
    <div className={styles.terminalTabs}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          className={`${styles.terminalTab} ${index === activeIndex ? styles.active : ''}`}
          onClick={() => onTabClick(index)}
          type="button"
        >
          <span className={styles.tabIndex}>{index}:</span>
          <span className={styles.tabText}>{tab.label}</span>
        </button>
      ))}
      {showHint && (
        <span className={styles.tabsHint}>
          ↑↓/jk navigate • 1-{tabs.length} jump
        </span>
      )}
    </div>
  );
}
