/**
 * Tool Mastery Section - Full screen
 *
 * Renders the tool mastery profile section showing:
 * - Overall mastery score
 * - Top tools used effectively
 * - Underutilized tools
 *
 * @module web/sections/tool-mastery
 */

import { type ToolMasteryResult } from '../../analyzer/dimensions/index.js';

/**
 * Renders the Tool Mastery Section for the web report.
 *
 * Displays a full-screen section with the user's tool mastery profile,
 * including their overall score, top tools they use effectively, and
 * underutilized tools that could improve their workflow.
 *
 * @param data - Tool mastery analysis results containing scores and tool usage
 * @param isUnlocked - Whether premium features are unlocked (affects blur/visibility)
 * @returns HTML string for the tool mastery section
 */
export function renderToolMasterySection(data: ToolMasteryResult, isUnlocked: boolean): string {
  const blurClass = isUnlocked ? '' : 'blurred-content';

  const topToolsHtml = data.topTools.slice(0, 4).map(tool => {
    const toolData = data.toolUsage[tool];
    if (!toolData) return '';
    return `
      <div class="tool-item">
        <span class="tool-level ${toolData.level}"></span>
        <span>${tool}</span>
        <span style="margin-left: auto; color: var(--text-muted);">${toolData.percentage}%</span>
      </div>
    `;
  }).join('');

  const underutilizedHtml = data.underutilizedTools.slice(0, 2).map(tool => {
    return `
      <div class="tool-item" style="opacity: 0.6;">
        <span class="tool-level novice"></span>
        <span>${tool}</span>
        <span style="margin-left: auto; color: var(--text-muted);">Underused</span>
      </div>
    `;
  }).join('');

  return `
    <div class="section-header">
      <div class="section-icon">🛠️</div>
      <div class="section-title">Tool Mastery Profile</div>
      <div class="section-subtitle">How effectively do you leverage Claude Code's capabilities?</div>
    </div>

    <div class="score-display">
      <div class="score-value">${data.overallScore}</div>
      <div class="score-label">Overall Mastery Score</div>
    </div>

    <div class="subsection-title">Top Tools</div>
    <div class="tool-grid">
      ${topToolsHtml}
    </div>

    <div class="subsection-title" style="color: var(--text-muted);">${isUnlocked ? 'Underutilized Tools' : 'Underutilized (Unlock for tips)'}</div>
    <div class="tool-grid ${blurClass}">
      ${underutilizedHtml}
    </div>

    ${isUnlocked ? '' : `
    <div class="unlock-prompt">
      <span class="unlock-prompt-text">🔓 Unlock full tool analysis + optimization strategies</span>
    </div>
    `}
  `;
}
