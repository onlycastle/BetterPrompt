/**
 * ExpandableEvidence Component
 *
 * Displays evidence items with expandable detail view.
 * Supports both legacy string evidence and new structured evidence with utteranceId linking.
 *
 * When expanded, shows:
 * - Full original utterance text (from utteranceLookup)
 * - Session ID and turn index metadata
 * - Timestamp of the original message
 *
 * For Free tier: Shows "Unlock to see full context" when expanded.
 */

'use client';

import { useState, useCallback } from 'react';
import type { EvidenceItem, InsightEvidence } from '../../../lib/models/worker-insights';
import type { UtteranceLookupEntry } from '../../../lib/models/verbose-evaluation';
import styles from './ExpandableEvidence.module.css';

interface ExpandableEvidenceProps {
  /** Evidence items - can be string (legacy) or InsightEvidence (new) */
  evidence: EvidenceItem[];
  /** Lookup map for utterance details (keyed by utteranceId) */
  utteranceLookup?: Map<string, UtteranceLookupEntry>;
  /** Whether user has paid tier for full content */
  isPaid: boolean;
  /** Maximum number of evidence items to show initially */
  maxItems?: number;
}

/**
 * Check if an evidence item is structured (has utteranceId)
 */
function isStructuredEvidence(item: EvidenceItem): item is InsightEvidence {
  return typeof item === 'object' && 'utteranceId' in item;
}

/**
 * Get display quote from evidence item
 */
function getQuote(item: EvidenceItem): string {
  if (isStructuredEvidence(item)) {
    return item.quote;
  }
  return item;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * Single expandable evidence item
 */
function EvidenceItemRow({
  item,
  utteranceLookup,
  isPaid,
}: {
  item: EvidenceItem;
  utteranceLookup?: Map<string, UtteranceLookupEntry>;
  isPaid: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const quote = getQuote(item);
  const isStructured = isStructuredEvidence(item);
  const utteranceId = isStructured ? item.utteranceId : undefined;
  const utterance = utteranceId ? utteranceLookup?.get(utteranceId) : undefined;
  const hasExpandableContent = isStructured && utterance;

  const toggleExpand = useCallback(() => {
    if (hasExpandableContent) {
      setIsExpanded((prev) => !prev);
    }
  }, [hasExpandableContent]);

  // Truncate quote for display
  const displayQuote = quote.length > 120 ? `${quote.slice(0, 117)}...` : quote;

  return (
    <li className={styles.evidenceItem}>
      <div
        className={`${styles.evidenceRow} ${hasExpandableContent ? styles.expandable : ''} ${isExpanded ? styles.expanded : ''}`}
        onClick={toggleExpand}
        role={hasExpandableContent ? 'button' : undefined}
        tabIndex={hasExpandableContent ? 0 : undefined}
        onKeyDown={hasExpandableContent ? (e) => e.key === 'Enter' && toggleExpand() : undefined}
      >
        <span className={styles.chevron}>
          {hasExpandableContent ? (isExpanded ? '▼' : '▶') : '›'}
        </span>
        <span className={styles.quoteText}>{displayQuote}</span>
        {isStructured && item.context && (
          <span className={styles.contextBadge}>{item.context}</span>
        )}
      </div>

      {isExpanded && hasExpandableContent && (
        <div className={styles.expandedContent}>
          {isPaid ? (
            <>
              <div className={styles.originalUtterance}>
                <span className={styles.utteranceLabel}>Original Message</span>
                <p className={styles.utteranceText}>{utterance.text}</p>
              </div>
              <div className={styles.metadata}>
                <span className={styles.metaItem}>
                  <span className={styles.metaIcon}>📁</span>
                  Session: {utterance.sessionId.slice(0, 8)}...
                </span>
                <span className={styles.metaItem}>
                  <span className={styles.metaIcon}>💬</span>
                  Turn #{utterance.turnIndex}
                </span>
                <span className={styles.metaItem}>
                  <span className={styles.metaIcon}>🕐</span>
                  {formatTimestamp(utterance.timestamp)}
                </span>
              </div>
            </>
          ) : (
            <div className={styles.lockedExpand}>
              <span className={styles.lockIcon}>🔒</span>
              <span className={styles.lockText}>Unlock to see full context</span>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Main ExpandableEvidence component
 */
export function ExpandableEvidence({
  evidence,
  utteranceLookup,
  isPaid,
  maxItems = 3,
}: ExpandableEvidenceProps) {
  const [showAll, setShowAll] = useState(false);

  if (!evidence || evidence.length === 0) {
    return null;
  }

  const displayItems = showAll ? evidence : evidence.slice(0, maxItems);
  const hasMore = evidence.length > maxItems;

  return (
    <div className={styles.container}>
      <span className={styles.evidenceLabel}>Evidence</span>
      <ul className={styles.evidenceList}>
        {displayItems.map((item, idx) => (
          <EvidenceItemRow
            key={idx}
            item={item}
            utteranceLookup={utteranceLookup}
            isPaid={isPaid}
          />
        ))}
      </ul>
      {hasMore && !showAll && (
        <button
          className={styles.showMoreButton}
          onClick={() => setShowAll(true)}
          type="button"
        >
          Show {evidence.length - maxItems} more...
        </button>
      )}
    </div>
  );
}

export default ExpandableEvidence;
