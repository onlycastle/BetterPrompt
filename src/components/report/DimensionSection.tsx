import type { ReactNode, CSSProperties } from 'react';
import styles from './DimensionSection.module.css';

interface DimensionBreakdown {
  score: number;
  [key: string]: any;
}

interface DimensionResult {
  score: number;
  level: string;
  interpretation: string;
  breakdown: Record<string, DimensionBreakdown>;
  strengths?: string[];
  growthAreas?: string[];
  tips?: string[];
  warnings?: string[];
  recommendations?: string[];
  signals?: string[];
}

interface DimensionSectionProps {
  dimension: DimensionResult;
  title: string;
  icon: string;
  subtitle?: string;
  isUnlocked: boolean;
  accentColor: string;
  levelLabels?: Record<string, string>;
  breakdownLabels?: Record<string, string>;
  renderCustomMetrics?: () => ReactNode;
}

/**
 * Reusable dimension section component
 * Shows score, level, breakdown metrics, and growth areas (blurred if locked)
 */
export function DimensionSection({
  dimension,
  title,
  icon,
  subtitle,
  isUnlocked,
  accentColor,
  levelLabels = {},
  breakdownLabels = {},
  renderCustomMetrics,
}: DimensionSectionProps) {
  const blurClass = isUnlocked ? '' : styles.blurred;

  // Level-to-style class mapping
  const LEVEL_CLASSES: Record<string, string> = {
    expert: styles.healthy,
    proficient: styles.healthy,
    resilient: styles.healthy,
    'ai-master': styles.healthy,
    developing: styles.balanced,
    high: styles.warning,
    'at-risk': styles.warning,
    'vibe-coder': styles.warning,
  };

  // Get level class for styling
  function getLevelClass(level: string): string {
    return LEVEL_CLASSES[level] ?? styles.moderate;
  }

  // Get metric color based on score thresholds
  function getMetricColor(score: number): string {
    if (score >= 75) return styles.green;
    if (score >= 50) return styles.cyan;
    if (score >= 25) return styles.yellow;
    return styles.red;
  }

  return (
    <div className={styles.dimensionSection} style={{ '--accent': accentColor } as CSSProperties}>
      {/* Header */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionIcon}>{icon}</div>
        <div className={styles.sectionTitle}>{title}</div>
        {subtitle && <div className={styles.sectionSubtitle}>{subtitle}</div>}
      </div>

      {/* Score Display */}
      <div className={styles.scoreDisplay}>
        <div className={styles.scoreValue}>{dimension.score}</div>
        <div className={styles.scoreLabel}>out of 100</div>
        <span className={`${styles.scoreLevel} ${getLevelClass(dimension.level)}`}>
          {levelLabels[dimension.level] || dimension.level}
        </span>
      </div>

      {/* Interpretation */}
      <div className={styles.interpretation}>{dimension.interpretation}</div>

      {/* Breakdown Metrics */}
      {dimension.breakdown && Object.keys(dimension.breakdown).length > 0 && (
        <div className={styles.metricsContainer}>
          {Object.entries(dimension.breakdown).map(([key, data]) => {
            const label = breakdownLabels[key] || key;
            const score = typeof data === 'object' ? data.score : data;

            return (
              <div key={key} className={styles.metricRow}>
                <span className={styles.metricLabel}>{label}</span>
                <div className={styles.metricBar}>
                  <div
                    className={`${styles.metricFill} ${getMetricColor(score)}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <span className={styles.metricValue}>{score}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Custom Metrics (e.g., VCP metrics, file references) */}
      {renderCustomMetrics && renderCustomMetrics()}

      {/* Strengths */}
      {dimension.strengths && dimension.strengths.length > 0 && (
        <>
          <div className={styles.subsectionTitle}>✨ Your Strengths</div>
          <ul className={styles.strengthsList}>
            {dimension.strengths.map((strength, i) => (
              <li key={i}>{strength}</li>
            ))}
          </ul>
        </>
      )}

      {/* Signals (for AI Control) */}
      {dimension.signals && dimension.signals.length > 0 && (
        <>
          <div className={styles.subsectionTitle}>📡 Control Signals Detected</div>
          <ul className={styles.signalsList}>
            {dimension.signals.slice(0, 3).map((signal, i) => (
              <li key={i}>{signal}</li>
            ))}
          </ul>
        </>
      )}

      {/* Warnings (for Skill Resilience) */}
      {dimension.warnings && dimension.warnings.length > 0 && (
        <>
          <div className={`${styles.subsectionTitle} ${styles.warning}`}>⚠️ Warnings</div>
          <ul className={styles.warningsList}>
            {dimension.warnings.slice(0, 2).map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </>
      )}

      {/* Growth Areas (blurred if locked) */}
      {dimension.growthAreas && dimension.growthAreas.length > 0 && (
        <>
          <div className={`${styles.subsectionTitle} ${blurClass}`}>🌱 Growth Areas</div>
          <ul className={`${styles.growthList} ${blurClass}`}>
            {dimension.growthAreas.map((area, i) => (
              <li key={i}>{area}</li>
            ))}
          </ul>
        </>
      )}

      {/* Tips (blurred if locked) */}
      {dimension.tips && dimension.tips.length > 0 && (
        <>
          <div className={`${styles.subsectionTitle} ${blurClass}`}>💡 Tips</div>
          <ul className={`${styles.tipsList} ${blurClass}`}>
            {dimension.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </>
      )}

      {/* Recommendations (blurred if locked) */}
      {dimension.recommendations && dimension.recommendations.length > 0 && (
        <>
          <div className={`${styles.subsectionTitle} ${blurClass}`}>💡 Recommendations</div>
          <ul className={`${styles.recommendationsList} ${blurClass}`}>
            {dimension.recommendations.slice(0, 2).map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </>
      )}

      {/* Unlock Prompt */}
      {!isUnlocked && (
        <div className={styles.unlockPrompt}>
          <span className={styles.unlockPromptText}>
            🔓 Unlock detailed breakdown + personalized recommendations
          </span>
        </div>
      )}
    </div>
  );
}
