/**
 * Render locked premium teasers
 */
export function renderVerboseLockedTeasers(isUnlocked: boolean): string {
  if (isUnlocked) {
    return ''; // No teasers if already unlocked
  }

  return `
    <div style="margin: 32px 0; padding: 32px 24px; background: var(--bg-tertiary); border-radius: 12px; border: 2px dashed var(--text-muted);">
      <div class="subsection-title" style="text-align: center; margin-bottom: 24px;">🔒 Premium Content</div>
      <div style="display: grid; gap: 16px;">
        <div class="blurred-content" style="padding: 16px; background: var(--bg-primary); border-radius: 8px; border-left: 3px solid var(--neon-magenta);">
          <div style="font-size: 14px; font-weight: 600; color: var(--neon-magenta); margin-bottom: 8px;">🛠️ Tool Usage Deep Dive</div>
          <div style="font-size: 12px; color: var(--text-muted);">Detailed analysis of how you use each tool, with comparisons to expert users and optimization strategies...</div>
        </div>
        <div class="blurred-content" style="padding: 16px; background: var(--bg-primary); border-radius: 8px; border-left: 3px solid var(--neon-green);">
          <div style="font-size: 14px; font-weight: 600; color: var(--neon-green); margin-bottom: 8px;">💰 Token Efficiency Analysis</div>
          <div style="font-size: 12px; color: var(--text-muted);">Your token usage patterns, efficiency score, and estimated monthly savings with optimization tips...</div>
        </div>
        <div class="blurred-content" style="padding: 16px; background: var(--bg-primary); border-radius: 8px; border-left: 3px solid var(--neon-cyan);">
          <div style="font-size: 14px; font-weight: 600; color: var(--neon-cyan); margin-bottom: 8px;">🗺️ Personalized Growth Roadmap</div>
          <div style="font-size: 12px; color: var(--text-muted);">Step-by-step plan to reach the next level, with time estimates and measurable milestones...</div>
        </div>
        <div class="blurred-content" style="padding: 16px; background: var(--bg-primary); border-radius: 8px; border-left: 3px solid var(--neon-yellow);">
          <div style="font-size: 14px; font-weight: 600; color: var(--neon-yellow); margin-bottom: 8px;">📊 Comparative Insights</div>
          <div style="font-size: 12px; color: var(--text-muted);">How you compare to 10,000+ developers across key metrics, with percentile rankings...</div>
        </div>
        <div class="blurred-content" style="padding: 16px; background: var(--bg-primary); border-radius: 8px; border-left: 3px solid var(--neon-pink);">
          <div style="font-size: 14px; font-weight: 600; color: var(--neon-pink); margin-bottom: 8px;">📈 Session Trends</div>
          <div style="font-size: 12px; color: var(--text-muted);">Track your improvement over time across all dimensions with trend analysis...</div>
        </div>
      </div>
      <div style="text-align: center; margin-top: 24px;">
        <div style="font-size: 13px; color: var(--neon-yellow); font-weight: 600;">🔓 Unlock all premium features for $6.99</div>
      </div>
    </div>
  `;
}
