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
 * - Data integrity validation badge (original match indicator)
 *
 * For Free tier: Shows "Unlock to see full context" when expanded.
 */

'use client';

import { useState, useCallback } from 'react';
import type { EvidenceItem, InsightEvidence } from '../../../../lib/models/worker-insights';
import type { UtteranceLookupEntry, TransformationAuditEntry } from '../../../../lib/models/verbose-evaluation';
import styles from './ExpandableEvidence.module.css';

/**
 * Integrity status for evidence display
 *
 * Indicates whether the displayed quote matches the original developer text:
 * - 'verbatim': Quote is unchanged from original (100% match)
 * - 'summarized': Machine content summarized (error logs, stack traces, etc.)
 * - 'mismatch': Unexpected deviation from original (potential data corruption)
 * - 'unknown': No audit data available (legacy entries)
 */
type IntegrityStatus = 'verbatim' | 'summarized' | 'mismatch' | 'unknown';

/**
 * Get integrity badge configuration based on status
 */
function getIntegrityBadge(status: IntegrityStatus): { icon: string; text: string; className: string } {
  if (status === 'verbatim') {
    return { icon: '✓', text: 'Original', className: styles.integrityVerbatim };
  }
  if (status === 'summarized') {
    return { icon: '◐', text: 'Summarized', className: styles.integritySummarized };
  }
  if (status === 'mismatch') {
    return { icon: '⚠', text: 'Check original', className: styles.integrityMismatch };
  }
  return { icon: '', text: '', className: '' };
}

/**
 * Determine integrity status from transformation audit data
 */
function getIntegrityStatus(
  utteranceId: string | undefined,
  transformationAudit?: Map<string, TransformationAuditEntry>
): IntegrityStatus {
  if (!utteranceId || !transformationAudit) return 'unknown';

  const audit = transformationAudit.get(utteranceId);
  if (!audit) return 'verbatim';
  if (audit.isVerbatim) return 'verbatim';
  if (audit.validationPassed === false) return 'mismatch';
  return 'summarized';
}

interface ExpandableEvidenceProps {
  /** Evidence items - can be string (legacy) or InsightEvidence (new) */
  evidence: EvidenceItem[];
  /**
   * Lookup map for utterance details (keyed by utteranceId).
   * When undefined, "View original" is locked (free tier).
   * Data-driven: presence of lookup = paid tier access.
   */
  utteranceLookup?: Map<string, UtteranceLookupEntry>;
  /** Transformation audit map for data integrity verification (keyed by utteranceId) */
  transformationAudit?: Map<string, TransformationAuditEntry>;
  /** Maximum number of evidence items to show initially */
  maxItems?: number;
  /** Callback to open the Source Context sidebar for a specific utterance */
  onViewContext?: (utteranceId: string) => void;
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
 *
 * Data-driven UI:
 * - utterance presence = paid tier (show "View original")
 * - utterance absence = free tier (show locked state)
 */
function EvidenceItemRow({
  item,
  utteranceLookup,
  transformationAudit,
  onViewContext,
}: {
  item: EvidenceItem;
  utteranceLookup?: Map<string, UtteranceLookupEntry>;
  transformationAudit?: Map<string, TransformationAuditEntry>;
  onViewContext?: (utteranceId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const quote = getQuote(item);
  const isStructured = isStructuredEvidence(item);
  const utteranceId = isStructured ? item.utteranceId : undefined;
  const utterance = utteranceId ? utteranceLookup?.get(utteranceId) : undefined;
  // Data-driven: utterance presence indicates paid tier access
  const hasExpandableContent = isStructured && utterance;

  // Data integrity status
  const integrityStatus = getIntegrityStatus(utteranceId, transformationAudit);
  const integrityBadge = getIntegrityBadge(integrityStatus);

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
        {/* Data Integrity Badge */}
        {integrityBadge.icon && (
          <span
            className={`${styles.integrityBadge} ${integrityBadge.className}`}
            title={integrityStatus === 'verbatim' ? 'Quote matches original exactly'
              : integrityStatus === 'summarized' ? 'Machine content (errors, code) summarized for readability'
              : 'Quote may differ from original - click to view source'}
          >
            {integrityBadge.icon}
          </span>
        )}
        {isStructured && item.context && (
          <span className={styles.contextBadge}>{item.context}</span>
        )}
      </div>

      {/* Data-driven: if we have utterance, we can show it (paid tier).
          If hasExpandableContent is true, utterance is defined. */}
      {isExpanded && hasExpandableContent && (
        <div className={styles.expandedContent}>
          {/* Preceding AI snippet preview */}
          {utterance.precedingAISnippet && (
            <div className={styles.aiSnippet}>
              <span className={styles.aiLabel}>AI said before:</span>
              <span className={styles.aiText}>{utterance.precedingAISnippet}</span>
            </div>
          )}
          <div className={styles.originalUtterance}>
            <span className={styles.utteranceLabel}>
              Original Message
              {/* Show integrity status in expanded view */}
              {integrityBadge.text && (
                <span className={`${styles.integrityTag} ${integrityBadge.className}`}>
                  {integrityBadge.icon} {integrityBadge.text}
                </span>
              )}
            </span>
            <p className={styles.utteranceText}>{utterance.text}</p>
          </div>
          {/* Following AI snippet preview */}
          {utterance.followingAISnippet && (
            <div className={styles.aiSnippet}>
              <span className={styles.aiLabel}>AI responded:</span>
              <span className={styles.aiText}>{utterance.followingAISnippet}</span>
            </div>
          )}
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
            {/* View Context button - opens Source Context sidebar */}
            {onViewContext && utteranceId && (
              <button
                className={styles.viewContextButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onViewContext(utteranceId);
                }}
                type="button"
              >
                View Context &rarr;
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * Main ExpandableEvidence component
 *
 * Data-driven UI: No isPaid prop needed.
 * utteranceLookup presence determines if "View original" is available.
 */
export function ExpandableEvidence({
  evidence,
  utteranceLookup,
  transformationAudit,
  maxItems = 3,
  onViewContext,
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
            transformationAudit={transformationAudit}
            onViewContext={onViewContext}
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
