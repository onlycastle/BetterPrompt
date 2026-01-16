import { useState } from 'react';
import type { AnalyzedSessionInfo } from '../../types/verbose';
import styles from './AnalyzedSessions.module.css';

interface AnalyzedSessionsProps {
  sessions?: AnalyzedSessionInfo[];
}

const ChevronDown = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const ChevronUp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 15l-6-6-6 6" />
  </svg>
);

const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

/**
 * Format ISO date to short display format
 */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Unknown';
  }
}

/**
 * Analyzed Sessions - Collapsible section showing which sessions were analyzed
 *
 * Uses terminal log style aesthetic:
 * - Monospace font with $ prompt prefix
 * - Dashed borders between items
 * - Cyan accent for file names
 */
export function AnalyzedSessions({ sessions }: AnalyzedSessionsProps) {
  const [expanded, setExpanded] = useState(false);

  // Don't render if no sessions
  if (!sessions || sessions.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <button
        className={styles.header}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className={styles.headerLeft}>
          <span className={styles.prompt}>$</span>
          <span className={styles.title}>
            ANALYZED SESSIONS ({sessions.length})
          </span>
        </div>
        <div className={styles.headerRight}>
          {expanded ? <ChevronUp /> : <ChevronDown />}
        </div>
      </button>

      {expanded && (
        <div className={styles.sessionList}>
          {sessions.map((session) => (
            <div key={session.sessionId} className={styles.sessionItem}>
              <div className={styles.fileName}>
                <FileIcon />
                <span>{session.fileName}</span>
              </div>
              <div className={styles.metadata}>
                <span className={styles.arrow}>-&gt;</span>
                <span className={styles.project}>{session.projectName}</span>
                <span className={styles.separator}>|</span>
                <span>{session.durationMinutes} min</span>
                <span className={styles.separator}>|</span>
                <span>{session.messageCount} msgs</span>
                <span className={styles.separator}>|</span>
                <span>{formatDate(session.startTime)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!expanded && (
        <div className={styles.collapsedHint}>
          Click to see which sessions were included in this analysis
        </div>
      )}
    </div>
  );
}
