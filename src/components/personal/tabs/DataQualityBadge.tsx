/**
 * DataQualityBadge Component
 *
 * Displays analysis metadata (confidence, data quality, messages analyzed)
 * to build user trust through transparency.
 *
 * - Shows data quality (high/medium/low based on session count)
 * - Shows overall confidence score
 * - Optionally expands to show per-agent confidence breakdown
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { AnalysisMetadata } from '../../../types/verbose';
import styles from './DataQualityBadge.module.css';

interface DataQualityBadgeProps {
  metadata: AnalysisMetadata;
  /** Compact mode shows only the badge, no details */
  compact?: boolean;
}

/**
 * Get quality badge configuration
 */
function getQualityConfig(quality: AnalysisMetadata['dataQuality']): {
  emoji: string;
  label: string;
  description: string;
  className: string;
} {
  switch (quality) {
    case 'high':
      return {
        emoji: '✅',
        label: 'High Quality',
        description: '10+ sessions analyzed',
        className: styles.qualityHigh,
      };
    case 'medium':
      return {
        emoji: '⚠️',
        label: 'Medium Quality',
        description: '5-9 sessions analyzed',
        className: styles.qualityMedium,
      };
    case 'low':
      return {
        emoji: '📊',
        label: 'Limited Data',
        description: '<5 sessions analyzed',
        className: styles.qualityLow,
      };
  }
}

/**
 * Format confidence as percentage
 */
function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Get confidence level description
 */
function getConfidenceLevel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.6) return 'Medium';
  return 'Low';
}

export function DataQualityBadge({ metadata, compact = false }: DataQualityBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const qualityConfig = getQualityConfig(metadata.dataQuality);

  if (compact) {
    return (
      <div className={`${styles.badge} ${qualityConfig.className}`} title={qualityConfig.description}>
        <span className={styles.badgeEmoji}>{qualityConfig.emoji}</span>
        <span className={styles.badgeLabel}>{qualityConfig.label}</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Main Summary Row */}
      <div className={styles.summaryRow}>
        <div className={`${styles.badge} ${qualityConfig.className}`}>
          <span className={styles.badgeEmoji}>{qualityConfig.emoji}</span>
          <span className={styles.badgeLabel}>{qualityConfig.label}</span>
        </div>

        <div className={styles.confidenceChip}>
          <span className={styles.confidenceLabel}>Confidence:</span>
          <span className={styles.confidenceValue}>
            {formatConfidence(metadata.overallConfidence)}
          </span>
          <span className={styles.confidenceLevel}>
            ({getConfidenceLevel(metadata.overallConfidence)})
          </span>
        </div>

        <div className={styles.messagesChip}>
          <Info size={14} className={styles.infoIcon} />
          <span>{metadata.totalMessagesAnalyzed.toLocaleString()} messages analyzed</span>
        </div>

        {metadata.agentConfidences && metadata.agentConfidences.length > 0 && (
          <button
            type="button"
            className={styles.expandButton}
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            {expanded ? 'Hide details' : 'Show details'}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && metadata.agentConfidences && (
        <div className={styles.detailsPanel}>
          <h4 className={styles.detailsTitle}>Confidence by Analysis Agent</h4>
          <div className={styles.agentGrid}>
            {metadata.agentConfidences.map((agent) => (
              <div key={agent.agentId} className={styles.agentCard}>
                <span className={styles.agentName}>{agent.agentName}</span>
                <span className={styles.agentConfidence}>
                  {formatConfidence(agent.confidenceScore)}
                </span>
                <div
                  className={styles.confidenceBar}
                  style={{ '--confidence': agent.confidenceScore } as React.CSSProperties}
                />
              </div>
            ))}
          </div>

          {metadata.insightsFiltered !== undefined && metadata.insightsFiltered > 0 && (
            <p className={styles.filteredNote}>
              {metadata.insightsFiltered} low-confidence insight
              {metadata.insightsFiltered > 1 ? 's' : ''} filtered out
              (below {formatConfidence(metadata.confidenceThreshold ?? 0.7)} threshold)
            </p>
          )}

          {metadata.analysisDateRange && (
            <p className={styles.dateRange}>
              Analysis period:{' '}
              {new Date(metadata.analysisDateRange.earliest).toLocaleDateString()} -{' '}
              {new Date(metadata.analysisDateRange.latest).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default DataQualityBadge;
