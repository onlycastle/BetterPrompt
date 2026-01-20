/**
 * ProductivitySection Component
 *
 * Displays Module C (Productivity Analyst) output:
 * - Iteration efficiency metrics
 * - Learning velocity assessment
 * - Collaboration effectiveness
 * - Key productivity indicators
 */

import type { ProductivityAnalysis } from '../../types/report';
import styles from './ProductivitySection.module.css';

interface ProductivitySectionProps {
  productivity: ProductivityAnalysis;
}

/**
 * Get score level class based on score value
 */
function getScoreLevel(score: number): string {
  if (score >= 80) return styles.excellent;
  if (score >= 60) return styles.good;
  if (score >= 40) return styles.average;
  return styles.needsImprovement;
}

/**
 * Get score level label
 */
function getScoreLevelLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Average';
  return 'Needs Improvement';
}

/**
 * Get metric fill color class based on value (0-1 scale)
 */
function getMetricColor(value: number): string {
  if (value >= 0.75) return styles.green;
  if (value >= 0.5) return styles.cyan;
  if (value >= 0.25) return styles.yellow;
  return styles.red;
}

/**
 * Format learning style for display
 */
function formatLearningStyle(style: string): { icon: string; label: string } {
  const styles: Record<string, { icon: string; label: string }> = {
    explorer: { icon: '🧭', label: 'Explorer' },
    deep_diver: { icon: '🔍', label: 'Deep Diver' },
    balanced: { icon: '⚖️', label: 'Balanced Learner' },
    reactive: { icon: '⚡', label: 'Reactive Learner' },
  };
  return styles[style] || { icon: '📚', label: style };
}

/**
 * Format iteration trigger for display
 */
function formatTrigger(trigger: string): string {
  const labels: Record<string, string> = {
    error_fix: 'Error Fixing',
    feature_refinement: 'Feature Refinement',
    clarification: 'Clarification',
    exploration: 'Exploration',
    optimization: 'Optimization',
  };
  return labels[trigger] || trigger;
}

export function ProductivitySection({ productivity }: ProductivitySectionProps) {
  const {
    iterationSummary,
    learningVelocity,
    keyIndicators,
    collaborationEfficiency,
    overallProductivityScore,
    summary,
  } = productivity;

  const learningStyle = formatLearningStyle(learningVelocity.learningStyle);

  return (
    <div className={styles.productivitySection}>
      {/* Header */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionIcon}>📊</div>
        <div className={styles.sectionTitle}>Productivity Analysis</div>
        <div className={styles.sectionSubtitle}>
          AI Collaboration Efficiency & Learning Patterns
        </div>
      </div>

      {/* Overall Score */}
      <div className={styles.scoreDisplay}>
        <div className={styles.scoreValue}>{Math.round(overallProductivityScore)}</div>
        <div className={styles.scoreLabel}>Productivity Score</div>
        <span className={`${styles.scoreLevel} ${getScoreLevel(overallProductivityScore)}`}>
          {getScoreLevelLabel(overallProductivityScore)}
        </span>
      </div>

      {/* Summary */}
      {summary && <div className={styles.summary}>{summary}</div>}

      {/* Metrics Grid */}
      <div className={styles.metricsGrid}>
        {/* Iteration Efficiency Card */}
        <div className={styles.metricCard}>
          <div className={styles.metricCardTitle}>
            <span className={styles.metricCardIcon}>🔄</span>
            Iteration Efficiency
          </div>

          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Efficient Cycle Rate</span>
            <div className={styles.metricBar}>
              <div
                className={`${styles.metricFill} ${getMetricColor(iterationSummary.efficientCycleRate)}`}
                style={{ width: `${iterationSummary.efficientCycleRate * 100}%` }}
              />
            </div>
            <span className={styles.metricValue}>
              {Math.round(iterationSummary.efficientCycleRate * 100)}%
            </span>
          </div>

          <div className={styles.keyStats}>
            <div className={styles.keyStat}>
              <div className={styles.keyStatValue}>{iterationSummary.totalCycles}</div>
              <div className={styles.keyStatLabel}>Total Cycles</div>
            </div>
            <div className={styles.keyStat}>
              <div className={styles.keyStatValue}>
                {iterationSummary.avgTurnsPerCycle.toFixed(1)}
              </div>
              <div className={styles.keyStatLabel}>Avg Turns/Cycle</div>
            </div>
            <div className={styles.keyStat}>
              <div className={styles.keyStatValue}>
                {formatTrigger(iterationSummary.mostCommonTrigger)}
              </div>
              <div className={styles.keyStatLabel}>Main Trigger</div>
            </div>
          </div>
        </div>

        {/* Learning Velocity Card */}
        <div className={styles.metricCard}>
          <div className={styles.metricCardTitle}>
            <span className={styles.metricCardIcon}>🧠</span>
            Learning Velocity
          </div>

          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Transferability</span>
            <div className={styles.metricBar}>
              <div
                className={`${styles.metricFill} ${styles.purple}`}
                style={{ width: `${learningVelocity.overallTransferability * 100}%` }}
              />
            </div>
            <span className={styles.metricValue}>
              {Math.round(learningVelocity.overallTransferability * 100)}%
            </span>
          </div>

          <div className={styles.keyStats}>
            <div className={styles.keyStat}>
              <div className={styles.keyStatValue}>
                {learningVelocity.signalsPerSession.toFixed(1)}
              </div>
              <div className={styles.keyStatLabel}>Signals/Session</div>
            </div>
            <div className={styles.keyStat}>
              <div className={styles.keyStatValue} style={{ textTransform: 'capitalize' }}>
                {learningVelocity.avgDepth}
              </div>
              <div className={styles.keyStatLabel}>Avg Depth</div>
            </div>
          </div>

          <div className={styles.learningStyleBadge}>
            <span className={styles.learningStyleIcon}>{learningStyle.icon}</span>
            <span className={styles.learningStyleText}>{learningStyle.label}</span>
          </div>
        </div>

        {/* Key Indicators Card */}
        <div className={styles.metricCard}>
          <div className={styles.metricCardTitle}>
            <span className={styles.metricCardIcon}>🎯</span>
            Key Indicators
          </div>

          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>First Try Success</span>
            <div className={styles.metricBar}>
              <div
                className={`${styles.metricFill} ${getMetricColor(keyIndicators.firstTrySuccessRate)}`}
                style={{ width: `${keyIndicators.firstTrySuccessRate * 100}%` }}
              />
            </div>
            <span className={styles.metricValue}>
              {Math.round(keyIndicators.firstTrySuccessRate * 100)}%
            </span>
          </div>

          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Productive Turn Ratio</span>
            <div className={styles.metricBar}>
              <div
                className={`${styles.metricFill} ${getMetricColor(keyIndicators.productiveTurnRatio)}`}
                style={{ width: `${keyIndicators.productiveTurnRatio * 100}%` }}
              />
            </div>
            <span className={styles.metricValue}>
              {Math.round(keyIndicators.productiveTurnRatio * 100)}%
            </span>
          </div>

          <div className={styles.keyStats}>
            <div className={styles.keyStat}>
              <div className={styles.keyStatValue}>
                {keyIndicators.avgTurnsToFirstSolution.toFixed(1)}
              </div>
              <div className={styles.keyStatLabel}>Turns to Solution</div>
            </div>
            <div className={styles.keyStat}>
              <div className={styles.keyStatValue}>
                {keyIndicators.contextSwitchFrequency.toFixed(1)}
              </div>
              <div className={styles.keyStatLabel}>Context Switches</div>
            </div>
          </div>
        </div>

        {/* Collaboration Efficiency Card */}
        <div className={styles.metricCard}>
          <div className={styles.metricCardTitle}>
            <span className={styles.metricCardIcon}>🤝</span>
            Collaboration Efficiency
          </div>

          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Request Clarity</span>
            <div className={styles.metricBar}>
              <div
                className={`${styles.metricFill} ${getMetricColor(collaborationEfficiency.requestClarity)}`}
                style={{ width: `${collaborationEfficiency.requestClarity * 100}%` }}
              />
            </div>
            <span className={styles.metricValue}>
              {Math.round(collaborationEfficiency.requestClarity * 100)}%
            </span>
          </div>

          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Spec Completeness</span>
            <div className={styles.metricBar}>
              <div
                className={`${styles.metricFill} ${getMetricColor(collaborationEfficiency.specificationCompleteness)}`}
                style={{ width: `${collaborationEfficiency.specificationCompleteness * 100}%` }}
              />
            </div>
            <span className={styles.metricValue}>
              {Math.round(collaborationEfficiency.specificationCompleteness * 100)}%
            </span>
          </div>

          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Context Provision</span>
            <div className={styles.metricBar}>
              <div
                className={`${styles.metricFill} ${getMetricColor(collaborationEfficiency.contextProvisionFrequency)}`}
                style={{ width: `${collaborationEfficiency.contextProvisionFrequency * 100}%` }}
              />
            </div>
            <span className={styles.metricValue}>
              {Math.round(collaborationEfficiency.contextProvisionFrequency * 100)}%
            </span>
          </div>

          <div className={styles.keyStats}>
            <div className={styles.keyStat}>
              <div className={styles.keyStatValue}>
                {collaborationEfficiency.proactiveVsReactiveRatio.toFixed(1)}x
              </div>
              <div className={styles.keyStatLabel}>Proactive Ratio</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
