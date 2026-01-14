import type { VerboseEvaluation } from '../../models/verbose-evaluation.js';

/**
 * Render verbose personality summary section
 */
export function renderVerbosePersonalitySummary(verboseEval: VerboseEvaluation, _isUnlocked: boolean): string {
  return `
    <div style="margin: 32px 0; padding: 24px; background: var(--bg-secondary); border-radius: 12px; border-left: 4px solid var(--neon-cyan);">
      <div class="subsection-title" style="margin-bottom: 16px;">🎭 Your AI Coding Personality</div>
      <p style="font-size: 14px; line-height: 1.8; color: var(--text-primary);">
        ${verboseEval.personalitySummary}
      </p>
    </div>
  `;
}
