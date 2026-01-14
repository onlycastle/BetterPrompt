/**
 * Locked Section Component
 *
 * Displays either an unlock badge for premium users or a paywall
 * with pricing information for free users.
 */

import { renderDashboardButtons } from './share.js';

/**
 * Locked/CTA Section - shows unlock badge when premium, paywall when free
 *
 * Renders different content based on whether the user has unlocked premium features.
 * Premium users see a success message, while free users see a detailed paywall
 * with pricing and feature list.
 *
 * @param isUnlocked - Whether the user has premium access
 * @returns HTML string with either unlock badge or paywall content
 */
export function renderLockedSection(isUnlocked: boolean): string {
  if (isUnlocked) {
    return `
      <div class="locked-section" style="text-align: center; padding: 40px 20px;">
        <div style="font-size: 48px; margin-bottom: 16px;">✨</div>
        <h3 style="color: var(--neon-green); font-size: 24px; margin-bottom: 8px;">Full Analysis Unlocked</h3>
        <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 24px;">
          You have access to all premium features and detailed breakdowns.
        </p>
        ${renderDashboardButtons()}
      </div>
    `;
  }

  return `
    <div class="locked-section">
      <h3 class="locked-title">🔒 Unlock Full Analysis</h3>
      <p style="color: var(--text-secondary); margin-bottom: 24px; max-width: 500px; margin-left: auto; margin-right: auto;">
        Get the complete picture of your AI collaboration patterns with detailed breakdowns,
        personalized recommendations, and professional insights.
      </p>
      <ul class="locked-items">
        <li class="locked-item">🤝 Full AI Collaboration breakdown + improvement strategies</li>
        <li class="locked-item">🎯 Best & worst prompt examples with improvement tips</li>
        <li class="locked-item">🔥 Complete burnout risk analysis + time patterns</li>
        <li class="locked-item">🛠️ All tool mastery data + optimization strategies</li>
        <li class="locked-item">🎮 AI Control Index deep-dive + professional tips</li>
        <li class="locked-item">💪 Skill Resilience analysis + practice exercises</li>
        <li class="locked-item">📊 Peer comparison percentiles (vs 10,000+ users)</li>
        <li class="locked-item">📈 Learning velocity tracking</li>
        <li class="locked-item">💬 All conversation evidence examples</li>
        <li class="locked-item">🎯 Personalized growth roadmap</li>
        <li class="locked-item">📄 Downloadable PDF report</li>
        <li class="locked-item">🏷️ Shareable badge for your profile</li>
      </ul>
      <div class="cta-box">
        <div class="cta-price">☕ ONE-TIME: $6.99</div>
        <div class="cta-subtitle">Less than a coffee • Unlock this analysis forever</div>
      </div>
      <p style="color: var(--text-muted); margin-top: 16px; font-size: 11px;">
        Want unlimited analyses + trend tracking?
        <span style="color: var(--neon-cyan);">PRO: $9/month</span>
      </p>

      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--border-subtle);">
        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">
          Track your growth or manage your team
        </p>
        ${renderDashboardButtons()}
      </div>
    </div>
  `;
}
