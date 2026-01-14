import type { BurnoutRiskResult } from '../../analyzer/dimensions/index.js';

/**
 * Renders the burnout risk analysis section of the web report.
 *
 * This section displays work-life balance insights based on coding patterns,
 * including after-hours work rate, weekend work frequency, and late-night session counts.
 *
 * @param data - The burnout risk analysis result containing score, level, breakdown, and recommendations
 * @param isUnlocked - Whether the detailed analysis is unlocked (affects visibility of specific metrics)
 * @returns HTML string for the burnout risk section
 */
export function renderBurnoutRiskSection(data: BurnoutRiskResult, isUnlocked: boolean): string {
  const blurClass = isUnlocked ? '' : 'blurred-locked';

  // Level labels for burnout risk (inverted - lower is better)
  const levelLabels: Record<string, string> = {
    low: 'Low Risk',
    moderate: 'Moderate Risk',
    elevated: 'Elevated Risk',
    high: 'High Risk',
  };

  // Calculate bar widths based on actual data
  const afterHoursWidth = Math.min(data.breakdown.afterHoursRate, 100);
  const weekendWidth = Math.min(data.breakdown.weekendRate, 100);
  const lateNightWidth = Math.min((data.breakdown.lateNightCount / 10) * 100, 100);

  // Build interpretation from recommendations
  const interpretationText = data.recommendations.length > 0
    ? data.recommendations[0]
    : 'Based on your session patterns, we\'ve analyzed your work habits including late-night sessions, weekend work frequency, and session intensity patterns.';

  return `
    <div class="section-header">
      <div class="section-icon">🔥</div>
      <div class="section-title">Burnout Risk Analysis</div>
      <div class="section-subtitle">Work-life balance insights from your coding patterns</div>
    </div>

    <div class="score-display">
      <div class="score-value ${blurClass}" style="${isUnlocked ? '' : 'color: var(--text-muted);'}">${isUnlocked ? data.score : '??'}</div>
      <div class="score-label">Work-Life Balance Score</div>
      <span class="score-level ${data.level} ${blurClass}">${isUnlocked ? levelLabels[data.level] || data.level : '???'}</span>
    </div>

    <div class="interpretation ${blurClass}">
      ${isUnlocked ? interpretationText : 'Based on your session patterns, we\'ve analyzed your work habits including late-night sessions, weekend work frequency, and session intensity patterns.'}
    </div>

    <div class="metrics-container">
      <div class="metric-row">
        <span class="metric-label">After-hours rate</span>
        <div class="metric-bar">
          <div class="metric-fill yellow" style="width: ${isUnlocked ? afterHoursWidth : 0}%"></div>
        </div>
        <span class="metric-value ${blurClass}">${isUnlocked ? Math.round(data.breakdown.afterHoursRate) + '%' : '??%'}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Weekend rate</span>
        <div class="metric-bar">
          <div class="metric-fill red" style="width: ${isUnlocked ? weekendWidth : 0}%"></div>
        </div>
        <span class="metric-value ${blurClass}">${isUnlocked ? Math.round(data.breakdown.weekendRate) + '%' : '??%'}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Late night count</span>
        <div class="metric-bar">
          <div class="metric-fill red" style="width: ${isUnlocked ? lateNightWidth : 0}%"></div>
        </div>
        <span class="metric-value ${blurClass}">${isUnlocked ? data.breakdown.lateNightCount : '??'}</span>
      </div>
    </div>

    <p style="font-size: 13px; color: var(--text-muted); margin-top: 24px; text-align: center;">
      We detected <span style="color: var(--neon-yellow);">${data.breakdown.lateNightCount}</span> late-night sessions...
    </p>

    ${isUnlocked ? '' : `
    <div class="unlock-prompt">
      <span class="unlock-prompt-text">🔓 Unlock full time analysis + wellness recommendations</span>
    </div>
    `}
  `;
}
