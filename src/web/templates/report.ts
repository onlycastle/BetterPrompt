/**
 * Terminal-Aesthetic Web Report Template v3.0
 *
 * Main report generator using modularized components.
 * Generates complete HTML report with scroll-based terminal UI.
 *
 * @module web/templates/report
 */

import { type TypeResult, TYPE_METADATA } from '../types.js';
import { type FullAnalysisResult } from '../../analyzer/dimensions/index.js';
import { type VerboseEvaluation } from '../../models/verbose-evaluation.js';
import { type ReportOptions } from '../types.js';

// Import styles and scripts
import { getEnhancedStyles } from '../styles/terminal-theme.js';
import { getScrollScript } from '../scripts/scroll-navigation.js';

// Import section renderers
import {
  renderMainResultSection,
  renderAICollaborationSection,
  renderContextEngineeringSection,
  renderBurnoutRiskSection,
  renderToolMasterySection,
  renderAIControlSection,
  renderSkillResilienceSection,
  renderShareSection,
  renderLockedSection,
  renderFooter,
} from '../sections/index.js';

// Import verbose renderers
import {
  renderVerbosePersonalitySummary,
  renderVerbosePromptPatterns,
  renderVerboseLockedTeasers,
  renderVerboseDimensionInsights,
} from '../verbose/index.js';

/**
 * Generate the complete HTML report with scroll-based terminal UI
 *
 * @param result - Type analysis result containing primary type and distribution
 * @param dimensions - Optional full dimension analysis results
 * @param options - Report customization options (reportId, baseUrl, sharing, unlocked)
 * @param verboseEvaluation - Optional verbose evaluation with personality insights
 * @returns Complete HTML document as a string
 */
export function generateReportHTML(
  result: TypeResult,
  dimensions?: FullAnalysisResult,
  options?: ReportOptions,
  verboseEvaluation?: VerboseEvaluation
): string {
  const meta = TYPE_METADATA[result.primaryType];
  const { reportId, baseUrl = 'https://nomoreaislop.xyz', enableSharing = true, unlocked } = options || {};
  const shareUrl = reportId ? `${baseUrl}/r/${reportId}` : '';
  const ogImageUrl = reportId ? `${baseUrl}/api/reports/${reportId}/og-image` : '';

  // Determine if premium content should be unlocked
  // Supports: explicit unlocked option, or NOSLOP_TEST_TIER env var in non-production
  const testTier = process.env.NOSLOP_TEST_TIER;
  const isProduction = process.env.NODE_ENV === 'production';
  const isUnlocked = unlocked || (!isProduction && ['pro', 'premium', 'enterprise'].includes(testTier || ''));

  const ogTitle = `I'm a ${meta.name} ${meta.emoji} - What's Your AI Coding Style?`;
  const ogDescription = meta.tagline;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your AI Coding Style: ${meta.name} ${meta.emoji} | NoMoreAISlop</title>

  <!-- Open Graph / Facebook -->
  ${reportId ? `
  <meta property="og:type" content="website">
  <meta property="og:url" content="${shareUrl}">
  <meta property="og:title" content="${ogTitle}">
  <meta property="og:description" content="${ogDescription}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${shareUrl}">
  <meta name="twitter:title" content="${ogTitle}">
  <meta name="twitter:description" content="${ogDescription}">
  <meta name="twitter:image" content="${ogImageUrl}">

  <!-- Additional meta -->
  <meta name="description" content="${ogDescription}">
  <link rel="canonical" href="${shareUrl}">
  ` : ''}

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
${getEnhancedStyles()}
  </style>
</head>
<body>
  <!-- macOS-style gradient background -->
  <div class="macos-background"></div>

  <!-- Terminal window frame -->
  <div class="terminal-window">
    <!-- Terminal header: titlebar + tabs -->
    <div class="terminal-header">
      <!-- macOS titlebar with traffic lights -->
      <div class="terminal-titlebar">
        <div class="terminal-buttons">
          <span class="terminal-btn close"></span>
          <span class="terminal-btn minimize"></span>
          <span class="terminal-btn maximize"></span>
        </div>
        <span class="terminal-title">NoMoreAISlop — analysis-report.html</span>
        <div class="terminal-spacer"></div>
      </div>

      <!-- Terminal tabs (iTerm2 style) -->
      <div class="terminal-tabs" id="terminal-tabs">
        <div class="terminal-tab active" data-section="result">
          <span class="tab-index">0:</span><span class="tab-text">result</span>
        </div>
        ${dimensions ? `
        <div class="terminal-tab" data-section="ai-collaboration">
          <span class="tab-index">1:</span><span class="tab-text">ai-dep</span>
        </div>
        <div class="terminal-tab" data-section="context-engineering">
          <span class="tab-index">2:</span><span class="tab-text">context</span>
        </div>
        <div class="terminal-tab" data-section="burnout-risk">
          <span class="tab-index">3:</span><span class="tab-text">burnout</span>
        </div>
        <div class="terminal-tab" data-section="tool-mastery">
          <span class="tab-index">4:</span><span class="tab-text">tools</span>
        </div>
        <div class="terminal-tab" data-section="ai-control">
          <span class="tab-index">5:</span><span class="tab-text">control</span>
        </div>
        <div class="terminal-tab" data-section="skill-resilience">
          <span class="tab-index">6:</span><span class="tab-text">skills</span>
        </div>
        <div class="terminal-tab" data-section="unlock">
          <span class="tab-index">7:</span><span class="tab-text">unlock</span>
        </div>
        ` : `
        <div class="terminal-tab" data-section="unlock">
          <span class="tab-index">1:</span><span class="tab-text">unlock</span>
        </div>
        `}
        <span class="tabs-hint">↑↓/jk navigate • 1-${dimensions ? '8' : '2'} jump</span>
      </div>
    </div>

    <!-- Scroll-snap container -->
    <div class="scroll-container" id="scroll-container">

      <!-- Section 0: Main Result -->
      <section class="snap-section in-view" data-section="result" data-index="0">
        <div class="section-inner">
          ${renderMainResultSection(result, meta)}
          ${verboseEvaluation ? renderVerbosePersonalitySummary(verboseEvaluation, isUnlocked) : ''}
          ${verboseEvaluation ? renderVerboseDimensionInsights(verboseEvaluation, isUnlocked) : ''}
          ${verboseEvaluation ? renderVerbosePromptPatterns(verboseEvaluation, isUnlocked) : ''}
          ${verboseEvaluation ? renderVerboseLockedTeasers(isUnlocked) : ''}
        </div>
      </section>

      ${dimensions ? `
      <!-- Section 1: AI Collaboration Mastery -->
      <section class="snap-section section-ai-collaboration" data-section="ai-collaboration" data-index="1">
        <div class="section-inner">
          ${renderAICollaborationSection(dimensions.aiCollaboration, isUnlocked)}
        </div>
      </section>

      <!-- Section 2: Context Engineering -->
      <section class="snap-section section-context-engineering" data-section="context-engineering" data-index="2">
        <div class="section-inner">
          ${renderContextEngineeringSection(dimensions.contextEngineering, isUnlocked)}
        </div>
      </section>

      <!-- Section 3: Burnout Risk -->
      <section class="snap-section section-burnout-risk" data-section="burnout-risk" data-index="3">
        <div class="section-inner">
          ${renderBurnoutRiskSection(dimensions.burnoutRisk, isUnlocked)}
        </div>
      </section>

      <!-- Section 4: Tool Mastery -->
      <section class="snap-section section-tool-mastery" data-section="tool-mastery" data-index="4">
        <div class="section-inner">
          ${renderToolMasterySection(dimensions.toolMastery, isUnlocked)}
        </div>
      </section>

      <!-- Section 5: AI Control Index -->
      <section class="snap-section section-ai-control" data-section="ai-control" data-index="5">
        <div class="section-inner">
          ${renderAIControlSection(dimensions.aiControl, isUnlocked)}
        </div>
      </section>

      <!-- Section 6: Skill Resilience -->
      <section class="snap-section section-skill-resilience" data-section="skill-resilience" data-index="6">
        <div class="section-inner">
          ${renderSkillResilienceSection(dimensions.skillResilience, isUnlocked)}
        </div>
      </section>
      ` : ''}

      <!-- Section 7: Unlock & Footer -->
      <section class="snap-section" data-section="unlock" data-index="${dimensions ? '7' : '1'}">
        <div class="section-inner">
          ${enableSharing ? renderShareSection(result, meta, reportId, baseUrl) : ''}
          ${renderLockedSection(isUnlocked)}
          ${renderFooter()}
        </div>
      </section>

    </div>
  </div>

  <!-- Scanline CRT effect -->
  <div class="scanline"></div>

  <script>
${getScrollScript()}
  </script>
</body>
</html>`;
}
