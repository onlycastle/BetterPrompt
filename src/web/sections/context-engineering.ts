import type { ContextEngineeringResult } from '../../analyzer/dimensions/index.js';
import { getLevelClass } from '../types.js';

/**
 * Renders the Context Engineering section of the verbose report.
 *
 * This section displays how effectively the developer manages AI context through:
 * - WRITE (Preserve): Using file references and CLAUDE.md
 * - SELECT (Retrieve): Using /compact and context management
 * - COMPRESS (Reduce): Managing session length and complexity
 * - ISOLATE (Partition): Breaking down tasks effectively
 *
 * @param data - The context engineering analysis results including scores and metrics
 * @param isUnlocked - Whether the premium content should be visible or blurred
 * @returns HTML string for the context engineering section
 */
export function renderContextEngineeringSection(data: ContextEngineeringResult, isUnlocked: boolean): string {
  const blurClass = isUnlocked ? '' : 'blurred-content';
  const levelClass = getLevelClass(data.level, ['expert', 'proficient']);

  const levelLabels: Record<string, string> = {
    expert: 'Context Master',
    proficient: 'Proficient',
    developing: 'Developing',
    novice: 'Getting Started',
  };

  return `
    <div class="section-header">
      <div class="section-icon">🧠</div>
      <div class="section-title">Context Engineering</div>
      <div class="section-subtitle">How effectively do you manage AI context?</div>
    </div>

    <div class="score-display">
      <div class="score-value">${data.score}</div>
      <div class="score-label">out of 100</div>
      <span class="score-level ${levelClass}">${levelLabels[data.level]}</span>
    </div>

    <div class="interpretation">
      ${data.interpretation}
    </div>

    <div class="metrics-container">
      <div class="metric-row">
        <span class="metric-label">WRITE (Preserve)</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.write.score >= 60 ? 'green' : 'cyan'}"
               style="width: ${data.breakdown.write.score}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.write.score}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">SELECT (Retrieve)</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.select.score >= 60 ? 'cyan' : 'yellow'}"
               style="width: ${data.breakdown.select.score}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.select.score}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">COMPRESS (Reduce)</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.compress.score >= 60 ? 'magenta' : 'yellow'}"
               style="width: ${data.breakdown.compress.score}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.compress.score}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">ISOLATE (Partition)</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.isolate.score >= 60 ? 'green' : 'cyan'}"
               style="width: ${data.breakdown.isolate.score}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.isolate.score}</span>
      </div>
    </div>

    <div class="subsection-title" style="margin-top: 24px;">📊 Key Metrics</div>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 12px;">
      <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px; text-align: center;">
        <div style="font-size: 20px; color: var(--neon-green); font-weight: 700;">${data.breakdown.write.fileReferences}</div>
        <div style="font-size: 10px; color: var(--text-muted);">File References</div>
      </div>
      <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px; text-align: center;">
        <div style="font-size: 20px; color: var(--neon-cyan); font-weight: 700;">${data.breakdown.compress.compactUsageCount}</div>
        <div style="font-size: 10px; color: var(--text-muted);">/compact Uses</div>
      </div>
      <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px; text-align: center;">
        <div style="font-size: 20px; color: var(--neon-magenta); font-weight: 700;">${data.breakdown.isolate.taskToolUsage}</div>
        <div style="font-size: 10px; color: var(--text-muted);">Task Delegations</div>
      </div>
      <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px; text-align: center;">
        <div style="font-size: 20px; color: var(--neon-yellow); font-weight: 700;">${data.breakdown.compress.avgTurnsPerSession.toFixed(1)}</div>
        <div style="font-size: 10px; color: var(--text-muted);">Avg Turns/Session</div>
      </div>
    </div>

    ${data.tips.length > 0 ? `
    <div class="subsection-title ${blurClass}" style="margin-top: 16px;">💡 Tips</div>
    <ul class="${blurClass}" style="list-style: none; padding: 0; margin: 0;">
      ${data.tips.map(t => `<li style="padding: 4px 0; color: var(--text-muted); font-size: 13px;">→ ${t}</li>`).join('')}
    </ul>
    ` : ''}

    ${isUnlocked ? '' : `
    <div class="unlock-prompt">
      <span class="unlock-prompt-text">🔓 Unlock best/worst examples + advanced tips</span>
    </div>
    `}
  `;
}
