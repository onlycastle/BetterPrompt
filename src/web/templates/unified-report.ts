/**
 * Unified Report HTML Template
 *
 * Generates comprehensive HTML report integrating:
 * - Profile (coding style + control level)
 * - 6 Analysis Dimensions with personalized insights
 * - Evidence quotes from actual conversations
 * - Actionable recommendations with resources
 */

import type { UnifiedReport, DimensionResult } from '../../models/unified-report.js';
import type { ReportOptions } from '../types.js';
import { getLevelClass } from '../types.js';
import { getEnhancedStyles } from '../styles/terminal-theme.js';
import { getScrollScript } from '../scripts/scroll-navigation.js';
import {
  DIMENSION_CONFIG,
  renderSectionHeader,
  renderScoreDisplay,
  renderInterpretation,
  renderMetricsFromBreakdown,
  renderStrengths,
  renderGrowthAreas,
  renderDimensionInsights,
  renderUnlockPrompt,
  renderEvidenceQuotes,
} from '../components.js';

// ============================================
// Main Template
// ============================================

/**
 * Generate complete HTML report for unified analysis
 *
 * @param report - UnifiedReport with all analysis data
 * @param options - Report customization options
 * @returns Complete HTML document as string
 */
export function generateUnifiedReportHTML(
  report: UnifiedReport,
  options?: ReportOptions
): string {
  const { reportId, baseUrl = 'https://nomoreaislop.xyz', enableSharing = true, unlocked } = options || {};
  const shareUrl = reportId ? `${baseUrl}/r/${reportId}` : '';

  // Determine if premium content should be unlocked
  const testTier = process.env.NOSLOP_TEST_TIER;
  const isProduction = process.env.NODE_ENV === 'production';
  const isUnlocked = unlocked ||
    report.tier === 'pro' ||
    report.tier === 'premium' ||
    report.tier === 'enterprise' ||
    (!isProduction && ['pro', 'premium', 'enterprise'].includes(testTier || ''));

  const { profile, dimensions, summary, evidence, recommendations } = report;
  const matrixName = `${profile.matrixName} ${profile.matrixEmoji}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your AI Coding Style: ${matrixName} | NoMoreAISlop</title>

  ${reportId ? `
  <meta property="og:type" content="website">
  <meta property="og:url" content="${shareUrl}">
  <meta property="og:title" content="I'm a ${matrixName} - What's Your AI Coding Style?">
  <meta property="og:description" content="${profile.personalitySummary.slice(0, 150)}...">
  ` : ''}

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
${getEnhancedStyles()}
  </style>
</head>
<body>
  <div class="macos-background"></div>

  <div class="terminal-window">
    <div class="terminal-header">
      <div class="terminal-titlebar">
        <div class="terminal-buttons">
          <span class="terminal-btn close"></span>
          <span class="terminal-btn minimize"></span>
          <span class="terminal-btn maximize"></span>
        </div>
        <span class="terminal-title">NoMoreAISlop — unified-report.html</span>
        <div class="terminal-spacer"></div>
      </div>

      <div class="terminal-tabs" id="terminal-tabs">
        <div class="terminal-tab active" data-section="result">
          <span class="tab-index">0:</span><span class="tab-text">profile</span>
        </div>
        ${dimensions.map((dim, i) => `
        <div class="terminal-tab" data-section="${dim.name}">
          <span class="tab-index">${i + 1}:</span><span class="tab-text">${getDimensionTabName(dim.name)}</span>
        </div>
        `).join('')}
        <div class="terminal-tab" data-section="summary">
          <span class="tab-index">7:</span><span class="tab-text">summary</span>
        </div>
      </div>
    </div>

    <div class="scroll-container" id="scroll-container">
      <!-- Profile Section -->
      <section class="snap-section" id="result">
        ${renderProfileSection(profile, matrixName)}
      </section>

      <!-- Dimension Sections -->
      ${dimensions.map((dim) => `
      <section class="snap-section" id="${dim.name}">
        ${renderUnifiedDimensionSection(dim, isUnlocked)}
      </section>
      `).join('')}

      <!-- Summary Section -->
      <section class="snap-section" id="summary">
        ${renderSummarySection(summary, evidence, recommendations, isUnlocked)}
      </section>

      ${enableSharing && reportId ? `
      <section class="snap-section" id="share">
        ${renderUnifiedShareSection(shareUrl, reportId, baseUrl)}
      </section>
      ` : ''}
    </div>

    <div class="status-bar">
      <span>sessions: ${report.sessionsAnalyzed}</span>
      <span>tier: ${report.tier}</span>
      <span>${new Date(report.createdAt).toLocaleDateString()}</span>
    </div>
  </div>

  <script>
${getScrollScript()}
  </script>
</body>
</html>`;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get short tab name for dimension
 *
 * @param name - Dimension name
 * @returns Short display name for terminal tab
 */
function getDimensionTabName(name: string): string {
  const tabNames: Record<string, string> = {
    aiCollaboration: 'collab',
    contextEngineering: 'context',
    toolMastery: 'tools',
    burnoutRisk: 'burnout',
    aiControl: 'control',
    skillResilience: 'skills',
  };
  return tabNames[name] || name.slice(0, 6);
}

/**
 * Render profile section for UnifiedReport
 *
 * @param profile - User's coding style profile
 * @param matrixName - Formatted matrix name with emoji
 * @returns HTML string for profile section
 */
function renderProfileSection(
  profile: UnifiedReport['profile'],
  matrixName: string
): string {
  return `
    <div class="section-header">
      <div class="section-icon">${profile.matrixEmoji}</div>
      <div class="section-title">${matrixName}</div>
      <div class="section-subtitle">Your AI Coding Style Profile</div>
    </div>

    <div class="type-description">
      ${profile.personalitySummary}
    </div>

    <div class="distribution-chart">
      <div class="distribution-title">Style Distribution</div>
      ${Object.entries(profile.distribution).map(([type, value]) => `
      <div class="distribution-row">
        <span class="distribution-label">${type}</span>
        <div class="distribution-bar">
          <div class="distribution-fill" style="width: ${value}%"></div>
        </div>
        <span class="distribution-value">${value}%</span>
      </div>
      `).join('')}
    </div>

    <div class="control-level-badge ${profile.controlLevel}">
      AI Control: ${profile.controlLevel.replace(/-/g, ' ')}
    </div>
  `;
}

/**
 * Render dimension section using UnifiedReport DimensionResult
 *
 * @param dim - Dimension result data
 * @param isUnlocked - Whether premium content should be shown
 * @returns HTML string for dimension section
 */
function renderUnifiedDimensionSection(
  dim: DimensionResult,
  isUnlocked: boolean
): string {
  const config = DIMENSION_CONFIG[dim.name];
  if (!config) {
    return `<div class="error">Unknown dimension: ${dim.name}</div>`;
  }

  const levelLabel = config.levelLabels[dim.level] || dim.level;
  const levelClass = getLevelClass(dim.level, config.goodLevels);

  return `
    ${renderSectionHeader({
      icon: config.icon,
      title: config.title,
      subtitle: config.subtitle,
    })}

    ${renderScoreDisplay({
      score: dim.score,
      level: dim.level,
      levelLabel,
      levelClass,
    })}

    ${renderInterpretation(dim.interpretation)}

    <div class="metrics-container">
      ${renderMetricsFromBreakdown(dim.breakdown)}
    </div>

    ${renderStrengths(dim.highlights.strengths)}
    ${renderGrowthAreas(dim.highlights.growthAreas, !isUnlocked)}

    ${dim.insights && dim.insights.length > 0 ? renderDimensionInsights(dim.insights, isUnlocked) : ''}

    ${renderUnlockPrompt('Unlock personalized recommendations', isUnlocked)}
  `;
}

/**
 * Render summary section with top strengths, growth areas, evidence, and recommendations
 *
 * @param summary - Report summary with top strengths and growth areas
 * @param evidence - Evidence quotes from conversations
 * @param recommendations - Actionable recommendations
 * @param isUnlocked - Whether premium content should be shown
 * @returns HTML string for summary section
 */
function renderSummarySection(
  summary: UnifiedReport['summary'],
  evidence: UnifiedReport['evidence'],
  recommendations: UnifiedReport['recommendations'],
  isUnlocked: boolean
): string {
  const blurClass = isUnlocked ? '' : 'blurred-content';

  return `
    <div class="section-header">
      <div class="section-icon">📊</div>
      <div class="section-title">Analysis Summary</div>
      <div class="section-subtitle">${summary.overallMessage}</div>
    </div>

    <div class="summary-grid">
      <div class="summary-card strengths">
        <h3>🌟 Top Strengths</h3>
        ${summary.topStrengths.map((s) => `
          <div class="summary-item">
            <span class="summary-dimension">${s.displayName}</span>
            <span class="summary-score">${s.score}</span>
            <p class="summary-highlight">${s.highlight}</p>
          </div>
        `).join('')}
      </div>

      <div class="summary-card growth ${blurClass}">
        <h3>🎯 Growth Opportunities</h3>
        ${summary.topGrowthAreas.map((g) => `
          <div class="summary-item">
            <span class="summary-dimension">${g.displayName}</span>
            <span class="summary-score">${g.score}</span>
            <p class="summary-highlight">${g.highlight}</p>
          </div>
        `).join('')}
      </div>
    </div>

    ${renderEvidenceQuotes(evidence, 5, isUnlocked)}

    ${recommendations.length > 0 ? `
    <div class="recommendations-section ${blurClass}">
      <h3>📋 Recommendations</h3>
      ${recommendations.slice(0, 3).map((rec) => `
        <div class="recommendation-card ${rec.type}">
          <div class="rec-header">
            <span class="rec-type">${rec.type === 'reinforce' ? '⭐' : '🎯'} ${rec.title}</span>
            <span class="rec-priority">P${rec.priority}</span>
          </div>
          <p class="rec-description">${rec.description}</p>
          <div class="rec-actions">
            ${rec.actionItems.slice(0, 3).map((action) => `<span class="rec-action">→ ${action}</span>`).join('')}
          </div>
          ${rec.resources.length > 0 ? `
          <div class="rec-resources">
            ${rec.resources.slice(0, 2).map((r) => `
              <a href="${r.url}" target="_blank" class="rec-resource">${r.title}</a>
            `).join('')}
          </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${renderUnlockPrompt('Unlock full recommendations and growth roadmap', isUnlocked)}
  `;
}

/**
 * Render simple share section for UnifiedReport
 *
 * @param shareUrl - Full URL for sharing the report
 * @param reportId - Report ID
 * @param _baseUrl - Base URL (unused but kept for signature compatibility)
 * @returns HTML string for share section
 */
function renderUnifiedShareSection(
  shareUrl: string,
  reportId: string,
  _baseUrl: string
): string {
  if (!reportId) {
    return '';
  }

  const tweetText = encodeURIComponent(`Check out my AI Developer Report!

See how I collaborate with AI tools:
${shareUrl}

#NoMoreAISlop #AICollaboration #DeveloperTools`);

  const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  return `
    <div class="share-section">
      <h3 class="share-title">📤 Share Your Results</h3>
      <p class="share-subtitle">Show off your AI collaboration skills!</p>

      <div class="share-buttons">
        <button class="share-btn twitter" onclick="window.open('${twitterUrl}', '_blank', 'width=600,height=400')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          <span>Share on X</span>
        </button>

        <button class="share-btn linkedin" onclick="window.open('${linkedInUrl}', '_blank', 'width=600,height=600')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          <span>LinkedIn</span>
        </button>
      </div>

      <div class="share-link-container">
        <input type="text" readonly value="${shareUrl}" class="share-link-input" id="share-url-unified" />
        <button class="copy-btn" onclick="navigator.clipboard.writeText('${shareUrl}').then(() => { this.textContent = '✓ Copied!'; setTimeout(() => { this.textContent = 'Copy'; }, 2000); })">
          Copy
        </button>
      </div>
    </div>
  `;
}
