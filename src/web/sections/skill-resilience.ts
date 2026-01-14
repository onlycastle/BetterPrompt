import type { SkillResilienceResult } from '../../analyzer/dimensions/index.js';
import { getLevelClass } from '../types.js';

/**
 * Renders the skill resilience section of the web report.
 *
 * This section displays analysis based on VCP Paper (arXiv:2601.02410) metrics,
 * showing whether the developer can code independently without AI assistance.
 * Includes metrics for cold start capability, hallucination detection, and code understanding.
 *
 * @param data - The skill resilience analysis result containing score, level, breakdown, VCP metrics, and recommendations
 * @param isUnlocked - Whether the detailed analysis is unlocked (affects visibility of recommendations)
 * @returns HTML string for the skill resilience section
 */
export function renderSkillResilienceSection(data: SkillResilienceResult, isUnlocked: boolean): string {
  const blurClass = isUnlocked ? '' : 'blurred-content';
  const levelClass = getLevelClass(data.level, 'resilient', true);

  const levelLabels: Record<string, string> = {
    resilient: 'Resilient Skills',
    developing: 'Developing Resilience',
    'at-risk': 'At Risk',
  };

  const levelDescriptions: Record<string, string> = {
    resilient: 'You can code independently without AI',
    developing: 'Building independent coding skills',
    'at-risk': 'Skill atrophy risk detected',
  };

  return `
    <div class="section-header">
      <div class="section-icon">💪</div>
      <div class="section-title">Skill Resilience</div>
      <div class="section-subtitle">Can you code without AI assistance?</div>
    </div>

    <div class="score-display">
      <div class="score-value">${data.score}</div>
      <div class="score-label">out of 100 (higher = more resilient)</div>
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
        <span class="metric-label">Cold Start Capability</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.coldStartCapability >= 60 ? 'green' : 'yellow'}"
               style="width: ${data.breakdown.coldStartCapability}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.coldStartCapability}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Hallucination Detection</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.hallucinationDetection >= 60 ? 'cyan' : 'yellow'}"
               style="width: ${data.breakdown.hallucinationDetection}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.hallucinationDetection}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Code Understanding</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.explainabilityGap >= 60 ? 'magenta' : 'yellow'}"
               style="width: ${data.breakdown.explainabilityGap}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.explainabilityGap}</span>
      </div>
    </div>

    <div class="subsection-title" style="margin-top: 24px;">📊 VCP Research Metrics</div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px;">
      <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px; text-align: center;">
        <div style="font-size: 20px; color: var(--neon-pink); font-weight: 700;">${data.vpcMetrics.m_csr.toFixed(2)}</div>
        <div style="font-size: 10px; color: var(--text-muted);">M_CSR</div>
      </div>
      <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px; text-align: center;">
        <div style="font-size: 20px; color: var(--neon-cyan); font-weight: 700;">${data.vpcMetrics.m_ht.toFixed(2)}</div>
        <div style="font-size: 10px; color: var(--text-muted);">M_HT</div>
      </div>
      <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px; text-align: center;">
        <div style="font-size: 20px; color: var(--neon-green); font-weight: 700;">${data.vpcMetrics.e_gap.toFixed(2)}</div>
        <div style="font-size: 10px; color: var(--text-muted);">E_gap</div>
      </div>
    </div>
    <p style="font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 8px;">
      Based on VCP Paper (arXiv:2601.02410) cognitive offloading metrics
    </p>

    ${data.warnings.length > 0 ? `
    <div class="subsection-title" style="margin-top: 24px; color: var(--neon-yellow);">⚠️ Warnings</div>
    <ul style="list-style: none; padding: 0; margin: 0;">
      ${data.warnings.slice(0, 2).map(w => `<li style="padding: 4px 0; color: var(--neon-yellow); font-size: 13px;">! ${w}</li>`).join('')}
    </ul>
    ` : ''}

    ${data.recommendations.length > 0 ? `
    <div class="subsection-title ${blurClass}" style="margin-top: 16px;">💡 Recommendations</div>
    <ul class="${blurClass}" style="list-style: none; padding: 0; margin: 0;">
      ${data.recommendations.slice(0, 2).map(r => `<li style="padding: 4px 0; color: var(--text-muted); font-size: 13px;">→ ${r}</li>`).join('')}
    </ul>
    ` : ''}

    ${isUnlocked ? '' : `
    <div class="unlock-prompt">
      <span class="unlock-prompt-text">🔓 Unlock full skill analysis + practice exercises</span>
    </div>
    `}
  `;
}
