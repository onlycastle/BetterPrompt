import type { AIControlResult } from '../../analyzer/dimensions/index.js';
import { getLevelClass } from '../types.js';

/**
 * Renders the AI Control Index section
 *
 * This section shows how well the developer controls AI output vs being dependent on it.
 * Includes metrics for verification, constraint specification, output critique, and context control.
 *
 * @param data - AI Control analysis result with score, level, breakdown, and signals
 * @param isUnlocked - Whether the full analysis is unlocked (controls blur effect on growth areas)
 * @returns HTML string for the AI Control section
 */
export function renderAIControlSection(data: AIControlResult, isUnlocked: boolean): string {
  const blurClass = isUnlocked ? '' : 'blurred-content';
  const levelClass = getLevelClass(data.level, 'ai-master', true);

  const levelLabels: Record<string, string> = {
    'ai-master': 'AI Master',
    developing: 'Developing Control',
    'vibe-coder': 'Vibe Coder',
  };

  const levelDescriptions: Record<string, string> = {
    'ai-master': 'You effectively control AI output',
    developing: 'Building control habits',
    'vibe-coder': 'High AI dependency detected',
  };

  return `
    <div class="section-header">
      <div class="section-icon">🎮</div>
      <div class="section-title">AI Control Index</div>
      <div class="section-subtitle">Do you control AI or does AI control you?</div>
    </div>

    <div class="score-display">
      <div class="score-value">${data.score}</div>
      <div class="score-label">out of 100 (higher = more control)</div>
      <span class="score-level ${levelClass}">${levelLabels[data.level]}</span>
    </div>

    <p style="text-align: center; font-size: 13px; color: var(--text-secondary); margin: 16px 0;">
      ${levelDescriptions[data.level]}
    </p>

    <div class="interpretation">
      ${data.interpretation}
    </div>

    <div class="metrics-container">
      <div class="metric-row">
        <span class="metric-label">Verification Rate</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.verificationRate >= 60 ? 'green' : 'yellow'}"
               style="width: ${data.breakdown.verificationRate}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.verificationRate}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Constraint Specification</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.constraintSpecification >= 60 ? 'cyan' : 'yellow'}"
               style="width: ${data.breakdown.constraintSpecification}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.constraintSpecification}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Output Critique</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.outputCritique >= 60 ? 'magenta' : 'yellow'}"
               style="width: ${data.breakdown.outputCritique}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.outputCritique}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Context Control</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.contextControl >= 60 ? 'green' : 'cyan'}"
               style="width: ${data.breakdown.contextControl}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.contextControl}</span>
      </div>
    </div>

    ${data.signals.length > 0 ? `
    <div class="subsection-title" style="margin-top: 24px;">📡 Control Signals Detected</div>
    <ul style="list-style: none; padding: 0; margin: 0;">
      ${data.signals.slice(0, 3).map(s => `<li style="padding: 4px 0; color: var(--neon-purple); font-size: 13px;">→ ${s}</li>`).join('')}
    </ul>
    ` : ''}

    ${data.strengths.length > 0 ? `
    <div class="subsection-title" style="margin-top: 16px;">✨ Your Strengths</div>
    <ul style="list-style: none; padding: 0; margin: 0;">
      ${data.strengths.slice(0, 2).map(s => `<li style="padding: 4px 0; color: var(--neon-green); font-size: 13px;">✓ ${s}</li>`).join('')}
    </ul>
    ` : ''}

    ${data.growthAreas.length > 0 ? `
    <div class="subsection-title ${blurClass}" style="margin-top: 16px;">🌱 Growth Areas</div>
    <ul class="${blurClass}" style="list-style: none; padding: 0; margin: 0;">
      ${data.growthAreas.slice(0, 2).map(g => `<li style="padding: 4px 0; color: var(--text-muted); font-size: 13px;">→ ${g}</li>`).join('')}
    </ul>
    ` : ''}

    ${isUnlocked ? '' : `
    <div class="unlock-prompt">
      <span class="unlock-prompt-text">🔓 Unlock detailed control analysis + professional tips</span>
    </div>
    `}
  `;
}
