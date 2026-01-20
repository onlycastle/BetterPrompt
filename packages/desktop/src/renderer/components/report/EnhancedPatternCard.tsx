/**
 * EnhancedPatternCard Component
 *
 * Enhanced prompt pattern card with:
 * - All examples displayed (expandable if more than 2)
 * - Full tip with expert source attribution
 * - Better visual design
 */

import { useState } from 'react';
import type { PromptPattern } from '../../types/report';
import { FormattedText } from '../../utils/textFormatting';
import styles from './EnhancedPatternCard.module.css';

interface EnhancedPatternCardProps {
  pattern: PromptPattern;
  index: number;
}

const EFFECTIVENESS_LABELS = {
  highly_effective: 'Highly Effective',
  effective: 'Effective',
  could_improve: 'Could Improve',
};

export function EnhancedPatternCard({ pattern, index }: EnhancedPatternCardProps) {
  const [showAllExamples, setShowAllExamples] = useState(false);
  const [showFullTip, setShowFullTip] = useState(false);

  const examples = pattern.examples || [];
  const hasMoreExamples = examples.length > 2;
  const displayedExamples = showAllExamples ? examples : examples.slice(0, 2);

  // Check if tip is long (more than 200 chars)
  const tipIsLong = pattern.tip && pattern.tip.length > 200;
  const displayedTip = showFullTip || !tipIsLong
    ? pattern.tip
    : pattern.tip?.slice(0, 200) + '...';

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.patternIndex}>#{index + 1}</span>
          <h3 className={styles.patternName}>{pattern.patternName}</h3>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles[pattern.frequency]}`}>
            {pattern.frequency}
          </span>
          {pattern.effectiveness && (
            <span className={`${styles.badge} ${styles[pattern.effectiveness]}`}>
              {EFFECTIVENESS_LABELS[pattern.effectiveness]}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <div className={styles.description}>
        <FormattedText text={pattern.description} as="p" />
      </div>

      {/* Examples */}
      {examples.length > 0 && (
        <div className={styles.examplesSection}>
          <div className={styles.examplesHeader}>
            <span className={styles.examplesLabel}>
              📝 Examples ({examples.length})
            </span>
            {hasMoreExamples && (
              <button
                className={styles.expandButton}
                onClick={() => setShowAllExamples(!showAllExamples)}
              >
                {showAllExamples ? 'Show less' : `Show all ${examples.length}`}
              </button>
            )}
          </div>
          <div className={styles.examplesList}>
            {displayedExamples.map((ex, j) => (
              <div key={j} className={styles.exampleItem}>
                <div className={styles.quoteBox}>
                  <span className={styles.quoteIcon}>"</span>
                  <code className={styles.quoteText}>{ex.quote}</code>
                  <span className={styles.quoteIcon}>"</span>
                </div>
                <div className={styles.analysisBox}>
                  <FormattedText text={ex.analysis} as="span" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tip */}
      {pattern.tip && (
        <div className={styles.tipSection}>
          <div className={styles.tipHeader}>
            <span className={styles.tipIcon}>💡</span>
            <span className={styles.tipLabel}>Expert Tip</span>
          </div>
          <div className={styles.tipContent}>
            <FormattedText text={displayedTip || ''} as="p" />
            {tipIsLong && (
              <button
                className={styles.expandButton}
                onClick={() => setShowFullTip(!showFullTip)}
              >
                {showFullTip ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
