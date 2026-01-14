import type { AICollaborationResult } from '../../analyzer/dimensions/index.js';
import { getLevelClass } from '../types.js';

/**
 * Renders the AI Collaboration Mastery section of the report.
 *
 * Displays the overall collaboration score, level classification, and breakdown
 * of three key metrics: Structured Planning, AI Orchestration, and Critical Verification.
 * Shows strengths and growth areas, with optional blur effect for locked content.
 *
 * @param data - The AI collaboration analysis results
 * @param isUnlocked - Whether the detailed content should be visible or blurred
 * @returns HTML string for the AI Collaboration section
 */
export function renderAICollaborationSection(data: AICollaborationResult, isUnlocked: boolean): string {
  const blurClass = isUnlocked ? '' : 'blurred-content';
  const levelClass = getLevelClass(data.level, ['expert', 'proficient']);

  const levelLabels: Record<string, string> = {
    expert: 'Expert Collaborator',
    proficient: 'Proficient User',
    developing: 'Developing Skills',
    novice: 'Getting Started',
  };

  return `
    <div class="section-header">
      <div class="section-icon">🤝</div>
      <div class="section-title">AI Collaboration Mastery</div>
      <div class="section-subtitle">How effectively do you collaborate with AI?</div>
    </div>

    <div class="score-display">
      <div class="score-value">${data.score}</div>
      <div class="score-label">out of 100 (higher is better)</div>
      <span class="score-level ${levelClass}">${levelLabels[data.level]}</span>
    </div>

    <div class="interpretation">
      ${data.interpretation}
    </div>

    <div class="metrics-container">
      <div class="metric-row">
        <span class="metric-label">Structured Planning</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.structuredPlanning.score >= 60 ? 'green' : 'cyan'}"
               style="width: ${data.breakdown.structuredPlanning.score}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.structuredPlanning.score}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">AI Orchestration</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.aiOrchestration.score >= 60 ? 'magenta' : 'cyan'}"
               style="width: ${data.breakdown.aiOrchestration.score}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.aiOrchestration.score}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Critical Verification</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.criticalVerification.score >= 60 ? 'green' : 'yellow'}"
               style="width: ${data.breakdown.criticalVerification.score}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.criticalVerification.score}</span>
      </div>
    </div>

    ${data.strengths.length > 0 ? `
    <div class="subsection-title" style="margin-top: 24px;">✨ Your Strengths</div>
    <ul style="list-style: none; padding: 0; margin: 0;">
      ${data.strengths.map(s => `<li style="padding: 4px 0; color: var(--neon-green); font-size: 13px;">✓ ${s}</li>`).join('')}
    </ul>
    ` : ''}

    ${data.growthAreas.length > 0 ? `
    <div class="subsection-title ${blurClass}" style="margin-top: 16px;">🌱 Growth Areas</div>
    <ul class="${blurClass}" style="list-style: none; padding: 0; margin: 0;">
      ${data.growthAreas.map(g => `<li style="padding: 4px 0; color: var(--text-muted); font-size: 13px;">→ ${g}</li>`).join('')}
    </ul>
    ` : ''}

    ${isUnlocked ? '' : `
    <div class="unlock-prompt">
      <span class="unlock-prompt-text">🔓 Unlock detailed breakdown + personalized recommendations</span>
    </div>
    `}
  `;
}
