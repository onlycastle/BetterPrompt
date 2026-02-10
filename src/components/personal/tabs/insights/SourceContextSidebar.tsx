/**
 * SourceContextSidebar Component
 *
 * Slide-in sidebar that displays the full conversation context for an evidence item.
 * Shows the AI → Developer message thread, transformation info (if content was
 * summarized), and session metadata.
 *
 * Follows ProfessionalInsightSidebar pattern:
 * - 420px panel, slide-in from right
 * - Backdrop overlay with click-to-close
 * - Keyboard accessible (Escape to close)
 * - Mobile responsive (full-width overlay)
 *
 * Progressive Disclosure (Level 3):
 * 1. Evidence collapsed: Truncated quote (existing)
 * 2. Evidence expanded inline: Full original message + metadata (existing)
 * 3. "View Context" → Opens this sidebar with conversation thread (NEW)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { UtteranceLookupEntry, TransformationAuditEntry } from '../../../../lib/models/verbose-evaluation';
import styles from './SourceContextSidebar.module.css';

interface SourceContextSidebarProps {
  /** The utterance to display context for, or null if sidebar is closed */
  utterance: UtteranceLookupEntry | null;
  /** Transformation audit entry (if content was summarized) */
  audit?: TransformationAuditEntry | null;
  /** Whether the sidebar is open */
  isOpen: boolean;
  /** Callback to close the sidebar */
  onClose: () => void;
}

/**
 * Human-readable label for transformation types
 */
const TRANSFORMATION_LABELS: Record<string, string> = {
  error_summarized: 'Error log summarized',
  stack_trace_summarized: 'Stack trace summarized',
  code_block_summarized: 'Code block summarized',
  system_tag_removed: 'System tags removed',
  truncated: 'Content truncated',
  mixed: 'Multiple transformations applied',
};

/**
 * Format timestamp for display
 */
function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function SourceContextSidebar({
  utterance,
  audit,
  isOpen,
  onClose,
}: SourceContextSidebarProps) {
  const [showRawOriginal, setShowRawOriginal] = useState(false);

  // Handle Escape key to close sidebar
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  // Add/remove event listener for Escape key + lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, handleKeyDown]);

  // Reset raw toggle when utterance changes
  useEffect(() => {
    setShowRawOriginal(false);
  }, [utterance?.id]);

  if (!isOpen || !utterance) {
    return null;
  }

  const hasAudit = audit && !audit.isVerbatim;
  const transformationLabel = hasAudit
    ? TRANSFORMATION_LABELS[audit.transformationType] || audit.transformationType
    : null;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <aside
        className={styles.sidebar}
        onClick={(e) => e.stopPropagation()}
        aria-label="Source Context"
      >
        {/* Header */}
        <header className={styles.header}>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close sidebar"
            type="button"
          >
            <span className={styles.closeIcon}>&times;</span>
          </button>
          <span className={styles.headerLabel}>Source Context</span>
        </header>

        {/* Conversation Thread */}
        <div className={styles.content}>
          <div className={styles.threadContainer}>
            {/* AI Message (if preceding AI snippet available) */}
            {utterance.precedingAISnippet && (
              <div className={styles.messageBubble}>
                <div className={styles.messageHeader}>
                  <span className={styles.roleLabel}>
                    <span className={styles.roleIcon}>AI</span>
                    AI Response
                  </span>
                </div>
                <p className={styles.messageText}>{utterance.precedingAISnippet}</p>
              </div>
            )}

            {/* Developer Message */}
            <div className={`${styles.messageBubble} ${styles.devMessage}`}>
              <div className={styles.messageHeader}>
                <span className={styles.roleLabel}>
                  <span className={`${styles.roleIcon} ${styles.devRoleIcon}`}>Dev</span>
                  Developer
                </span>
              </div>
              <p className={styles.messageText}>{utterance.text}</p>
            </div>

            {/* AI Response (if following AI snippet available) */}
            {utterance.followingAISnippet && (
              <div className={styles.messageBubble}>
                <div className={styles.messageHeader}>
                  <span className={styles.roleLabel}>
                    <span className={styles.roleIcon}>AI</span>
                    AI Response
                  </span>
                </div>
                <p className={styles.messageText}>{utterance.followingAISnippet}</p>
              </div>
            )}
          </div>

          {/* Transformation Info (if content was summarized) */}
          {hasAudit && transformationLabel && (
            <div className={styles.transformationSection}>
              <div className={styles.transformationBadge}>
                <span className={styles.transformationIcon}>&#9684;</span>
                Content was summarized ({transformationLabel})
              </div>
              <button
                className={styles.rawToggleButton}
                onClick={() => setShowRawOriginal(!showRawOriginal)}
                type="button"
              >
                {showRawOriginal ? 'Hide Raw Original' : 'Show Raw Original'}
                <span className={styles.toggleChevron}>
                  {showRawOriginal ? '\u25B2' : '\u25BC'}
                </span>
              </button>
              {showRawOriginal && (
                <div className={styles.rawContent}>
                  <pre className={styles.rawText}>{audit.originalText}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Metadata Footer */}
        <footer className={styles.footer}>
          <div className={styles.metadataGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Session</span>
              <span className={styles.metaValue}>{utterance.sessionId.slice(0, 8)}...</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Turn</span>
              <span className={styles.metaValue}>#{utterance.turnIndex}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Timestamp</span>
              <span className={styles.metaValue}>{formatTimestamp(utterance.timestamp)}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Characters</span>
              <span className={styles.metaValue}>{utterance.text.length.toLocaleString()}</span>
            </div>
          </div>
        </footer>
      </aside>
    </div>
  );
}
