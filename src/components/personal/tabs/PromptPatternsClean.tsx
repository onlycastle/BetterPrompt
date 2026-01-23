/**
 * PromptPatternsClean Component
 * Notion/Linear style prompt patterns display
 */

import { Card } from '../../ui/Card';
import type { PromptPattern, PromptFrequency, PromptEffectiveness } from '../../../types/verbose';
import styles from './PromptPatternsClean.module.css';

interface PromptPatternsCleanProps {
  patterns: PromptPattern[];
  isPaid?: boolean;
}

const FREQUENCY_STYLES: Record<PromptFrequency, { label: string; className: string }> = {
  frequent: { label: 'Frequent', className: styles.frequencyHigh },
  occasional: { label: 'Occasional', className: styles.frequencyMedium },
  rare: { label: 'Rare', className: styles.frequencyLow },
};

const EFFECTIVENESS_STYLES: Record<PromptEffectiveness, { label: string; className: string }> = {
  highly_effective: { label: 'Highly Effective', className: styles.effectivenessHigh },
  effective: { label: 'Effective', className: styles.effectivenessMedium },
  could_improve: { label: 'Opportunity', className: styles.effectivenessLow },
};

export function PromptPatternsClean({ patterns, isPaid = false }: PromptPatternsCleanProps) {
  if (!patterns || patterns.length === 0) {
    return null;
  }

  // All patterns visible to everyone - "진단 무료, 처방 유료"
  const tipsCount = patterns.filter(p => p.tip).length;

  return (
    <div className={styles.container}>
      {patterns.map((pattern, idx) => (
        <Card key={idx} padding="md" className={styles.patternCard}>
          <div className={styles.header}>
            <h4 className={styles.patternName}>{pattern.patternName}</h4>
            <div className={styles.badges}>
              <span className={`${styles.badge} ${FREQUENCY_STYLES[pattern.frequency].className}`}>
                {FREQUENCY_STYLES[pattern.frequency].label}
              </span>
              <span className={`${styles.badge} ${EFFECTIVENESS_STYLES[pattern.effectiveness].className}`}>
                {EFFECTIVENESS_STYLES[pattern.effectiveness].label}
              </span>
            </div>
          </div>

          <p className={styles.description}>{pattern.description}</p>

          {pattern.examples.length > 0 && (
            <div className={styles.examples}>
              <div className={styles.examplesLabel}>Examples</div>
              {pattern.examples.slice(0, 2).map((ex, exIdx) => (
                <div key={exIdx} className={styles.example}>
                  <blockquote className={styles.quote}>"{ex.quote}"</blockquote>
                  <p className={styles.analysis}>{ex.analysis}</p>
                </div>
              ))}
            </div>
          )}

          {pattern.tip && (
            <div className={`${styles.tip} ${!isPaid ? styles.tipLocked : ''}`}>
              <span className={styles.tipLabel}>💡 Tip:</span>
              {isPaid ? (
                <span className={styles.tipText}>{pattern.tip}</span>
              ) : (
                <span className={styles.tipLockedContent}>
                  <span className={styles.blurredText}>{pattern.tip.slice(0, 30)}...</span>
                  <span className={styles.unlockBadge}>🔒 See improvement tip</span>
                </span>
              )}
            </div>
          )}
        </Card>
      ))}

      {/* Teaser for free users - shows tips count */}
      {!isPaid && tipsCount > 0 && (
        <div className={styles.teaser}>
          <span className={styles.teaserIcon}>🔓</span>
          <span className={styles.teaserText}>{tipsCount} improvement tips + personalized recommendations</span>
        </div>
      )}
    </div>
  );
}

export default PromptPatternsClean;
