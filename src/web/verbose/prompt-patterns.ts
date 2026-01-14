import type { VerboseEvaluation } from '../../models/verbose-evaluation.js';

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Render verbose prompt patterns section
 */
export function renderVerbosePromptPatterns(verboseEval: VerboseEvaluation, _isUnlocked: boolean): string {
  const getFrequencyColor = (freq: string) => {
    switch (freq) {
      case 'frequent':
        return 'var(--neon-green)';
      case 'occasional':
        return 'var(--neon-cyan)';
      case 'rare':
        return 'var(--text-muted)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const getEffectivenessColor = (eff: string) => {
    switch (eff) {
      case 'highly_effective':
        return 'var(--neon-green)';
      case 'effective':
        return 'var(--neon-cyan)';
      case 'could_improve':
        return 'var(--neon-yellow)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const patternsHtml = verboseEval.promptPatterns
    .map(
      pattern => `
    <div style="margin-bottom: 24px; padding: 20px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.2);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <h4 style="color: var(--neon-purple); font-size: 16px; margin: 0;">📝 ${pattern.patternName}</h4>
        <div style="display: flex; gap: 12px;">
          <span style="font-size: 11px; padding: 4px 8px; background: rgba(139, 92, 246, 0.2); border-radius: 4px; color: ${getFrequencyColor(pattern.frequency)};">
            ${pattern.frequency}
          </span>
          <span style="font-size: 11px; padding: 4px 8px; background: rgba(0, 212, 255, 0.2); border-radius: 4px; color: ${getEffectivenessColor(pattern.effectiveness)};">
            ${pattern.effectiveness.replace('_', ' ')}
          </span>
        </div>
      </div>
      <p style="font-size: 13px; color: var(--text-primary); margin-bottom: 16px;">
        ${pattern.description}
      </p>
      <div style="margin-top: 12px;">
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">Examples:</div>
        ${pattern.examples
          .map(
            ex => `
          <div style="padding: 8px 12px; background: var(--bg-primary); border-radius: 4px; margin-bottom: 6px; border-left: 2px solid var(--neon-purple);">
            <div style="font-size: 12px; font-style: italic; color: var(--text-muted); margin-bottom: 4px;">"${escapeHtml(ex.quote)}"</div>
            <div style="font-size: 11px; color: var(--text-primary);">→ ${escapeHtml(ex.analysis)}</div>
          </div>
        `
          )
          .join('')}
      </div>
      ${
        pattern.tip
          ? `
      <div style="margin-top: 12px; padding: 10px; background: rgba(255, 204, 0, 0.08); border-radius: 6px; border: 1px solid rgba(255, 204, 0, 0.2);">
        <div style="font-size: 11px; color: var(--neon-yellow); font-weight: 600;">💡 Tip:</div>
        <div style="font-size: 12px; color: var(--text-primary); margin-top: 4px;">${pattern.tip}</div>
      </div>
      `
          : ''
      }
    </div>
  `
    )
    .join('');

  return `
    <div style="margin: 32px 0;">
      <div class="subsection-title" style="margin-bottom: 20px;">🔍 Your Prompt Patterns</div>
      ${patternsHtml}
    </div>
  `;
}
