/**
 * Terminal-Aesthetic Web Report Template v3.0
 *
 * Scroll-based tab navigation UI with:
 * - macOS-style background gradient
 * - Terminal window frame with traffic light buttons
 * - Scroll-snap sections with blur/focus transitions
 * - tmux-style neon status bar
 * - Keyboard navigation (j/k, arrow keys, 1-6)
 *
 * @version 3.0.0 - Complete redesign with scroll-based navigation
 */

import { type TypeResult, type CodingStyleType, TYPE_METADATA } from '../models/index.js';
import {
  type FullAnalysisResult,
  type AICollaborationResult,
  type ContextEngineeringResult,
  type BurnoutRiskResult,
  type ToolMasteryResult,
  type AIControlResult,
  type SkillResilienceResult,
} from '../analyzer/dimensions/index.js';
import { type VerboseEvaluation } from '../models/verbose-evaluation.js';

/**
 * Extended analysis data for full report
 */
export interface ExtendedAnalysisData {
  typeResult: TypeResult;
  dimensions?: FullAnalysisResult;
}

/**
 * Report options for customization
 */
export interface ReportOptions {
  reportId?: string;
  baseUrl?: string;
  enableSharing?: boolean;
  /** Show all premium content without blur (for paid users or testing) */
  unlocked?: boolean;
}

/**
 * Generate the complete HTML report with scroll-based terminal UI
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
          ${verboseEvaluation ? renderVerboseStrengths(verboseEvaluation, isUnlocked) : ''}
          ${verboseEvaluation ? renderVerboseGrowthAreas(verboseEvaluation, isUnlocked) : ''}
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

/**
 * Enhanced CSS with macOS background, terminal frame, scroll-snap, and tmux styling
 */
function getEnhancedStyles(): string {
  return `
    /* ============================================
       CSS Variables - Neon Terminal Theme
       ============================================ */
    :root {
      --bg-primary: #0a0a0a;
      --bg-secondary: #111111;
      --bg-tertiary: #1a1a1a;
      --text-primary: #e0e0e0;
      --text-secondary: #888888;
      --text-muted: #555555;

      /* tmux-style neon colors */
      --neon-green: #00ff88;
      --neon-cyan: #00d4ff;
      --neon-magenta: #ff00ff;
      --neon-yellow: #ffcc00;
      --neon-red: #ff4444;
      --neon-purple: #8b5cf6;
      --neon-pink: #ec4899;

      /* Aliases for compatibility */
      --accent-cyan: var(--neon-cyan);
      --accent-green: var(--neon-green);
      --accent-magenta: var(--neon-magenta);
      --accent-yellow: var(--neon-yellow);
      --accent-red: var(--neon-red);

      --border: #333333;
      --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    }

    /* ============================================
       Reset & Base
       ============================================ */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      height: 100%;
      overflow: hidden;
    }

    body {
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 14px;
      line-height: 1.6;
    }

    /* ============================================
       macOS Big Sur Solar Background
       ============================================ */
    .macos-background {
      position: fixed;
      inset: 0;
      z-index: -1;
      /* Performance optimized: reduced from 9 to 5 gradient layers */
      background:
        /* Top blue sky */
        radial-gradient(ellipse 100% 50% at 80% 10%, #4FA4E5 0%, transparent 50%),
        /* Center white/warm streak */
        radial-gradient(ellipse 80% 30% at 70% 45%, rgba(255, 255, 255, 0.7) 0%, rgba(255, 200, 150, 0.4) 40%, transparent 60%),
        /* Main coral/red wave */
        radial-gradient(ellipse 130% 70% at 50% 70%, #FF6B6B 0%, #D64545 35%, transparent 65%),
        /* Left purple-magenta blend */
        radial-gradient(ellipse 80% 90% at 8% 75%, #8B5CF6 0%, #EC4899 50%, transparent 70%),
        /* Base gradient */
        linear-gradient(160deg, #1E3A5F 0%, #1A1A2E 50%, #0F0F1A 100%);
    }

    /* ============================================
       Terminal Window Frame
       ============================================ */
    .terminal-window {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 40px);
      max-width: 900px;
      height: calc(100vh - 80px);
      background: rgba(10, 10, 10, 0.92);
      border-radius: 12px;
      box-shadow:
        0 25px 50px -12px rgba(0, 0, 0, 0.8),
        0 0 0 1px rgba(255, 255, 255, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(8px);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* macOS Titlebar */
    .terminal-titlebar {
      height: 40px;
      min-height: 40px;
      background: linear-gradient(180deg, #3d3d3d 0%, #2d2d2d 100%);
      border-bottom: 1px solid #1a1a1a;
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 12px;
    }

    .terminal-buttons {
      display: flex;
      gap: 8px;
    }

    .terminal-btn {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: none;
      cursor: default;
    }

    .terminal-btn.close { background: #ff5f56; }
    .terminal-btn.minimize { background: #ffbd2e; }
    .terminal-btn.maximize { background: #27c93f; }

    .terminal-title {
      flex: 1;
      text-align: center;
      font-size: 13px;
      color: #888;
      font-family: var(--font-mono);
      user-select: none;
    }

    .terminal-spacer {
      width: 52px; /* Balance the buttons on left */
    }

    /* ============================================
       Scroll Container (Natural Flow Layout)
       ============================================ */
    .scroll-container {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      scroll-behavior: smooth;
      padding-bottom: 40px;

      /* Custom scrollbar - neon style */
      scrollbar-width: thin;
      scrollbar-color: var(--neon-green) rgba(0, 0, 0, 0.3);
    }

    .scroll-container::-webkit-scrollbar {
      width: 8px;
    }

    .scroll-container::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.3);
    }

    .scroll-container::-webkit-scrollbar-thumb {
      background: var(--neon-green);
      border-radius: 4px;
      box-shadow: 0 0 10px var(--neon-green);
    }

    .scroll-container::-webkit-scrollbar-thumb:hover {
      background: var(--neon-cyan);
      box-shadow: 0 0 15px var(--neon-cyan);
    }

    /* ============================================
       Content Sections - Natural Flow Layout
       ============================================ */
    .snap-section {
      display: block;
      padding: 40px;
      position: relative;
      border-bottom: 1px solid var(--border);

      /* Always visible - no blur/fade effects */
      opacity: 1;
      transform: none;
    }

    .snap-section:last-child {
      border-bottom: none;
    }

    /* First section has more top padding */
    .snap-section:first-child {
      padding-top: 48px;
    }

    .snap-section.in-view {
      /* Kept for JavaScript compatibility */
      opacity: 1;
      transform: none;
    }

    .section-inner {
      width: 100%;
      max-width: 700px;
      margin: 0 auto;
    }

    /* Section-specific accent colors */
    .section-ai-collaboration { --section-accent: var(--neon-cyan); }
    .section-context-engineering { --section-accent: var(--neon-green); }
    .section-burnout-risk { --section-accent: var(--neon-yellow); }
    .section-tool-mastery { --section-accent: var(--neon-magenta); }
    .section-ai-control { --section-accent: var(--neon-purple); }
    .section-skill-resilience { --section-accent: var(--neon-pink); }

    /* ============================================
       Terminal Tabs (iTerm2/macOS Style) - PRIMARY NAV
       ============================================ */
    .terminal-tabs {
      display: flex;
      align-items: center;
      background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
      border-bottom: 1px solid #0a0a0a;
      padding: 0 12px;
      height: 36px;
      gap: 2px;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .terminal-tabs::-webkit-scrollbar {
      display: none;
    }

    .terminal-tab {
      display: flex;
      align-items: center;
      padding: 6px 14px;
      background: transparent;
      border: none;
      border-radius: 6px 6px 0 0;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: var(--font-mono);
      font-size: 12px;
      color: #777;
      position: relative;
      white-space: nowrap;
      margin-bottom: -1px;
    }

    .terminal-tab:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #aaa;
    }

    .terminal-tab.active {
      background: linear-gradient(180deg, #333 0%, #252525 100%);
      color: var(--neon-green);
      border: 1px solid #444;
      border-bottom: 1px solid #252525;
      text-shadow: 0 0 8px var(--neon-green);
    }

    .terminal-tab.active::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 60%;
      height: 2px;
      background: var(--neon-green);
      box-shadow: 0 0 10px var(--neon-green), 0 0 20px var(--neon-green);
      border-radius: 2px 2px 0 0;
    }

    .tab-index {
      color: var(--neon-cyan);
      margin-right: 2px;
      font-weight: 500;
    }

    .terminal-tab.active .tab-index {
      color: var(--neon-green);
      text-shadow: 0 0 8px var(--neon-green);
    }

    .tab-text {
      font-weight: 500;
    }

    .tabs-hint {
      margin-left: auto;
      font-size: 10px;
      color: #555;
      padding: 4px 8px;
      white-space: nowrap;
    }

    /* ============================================
       Scanline CRT Effect
       ============================================ */
    .scanline {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: repeating-linear-gradient(
        0deg,
        rgba(0, 0, 0, 0.03),
        rgba(0, 0, 0, 0.03) 1px,
        transparent 1px,
        transparent 2px
      );
      pointer-events: none;
      z-index: 1000;
    }

    /* ============================================
       Section Content Styles
       ============================================ */
    .section-header {
      text-align: center;
      margin-bottom: 32px;
    }

    .section-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .section-title {
      font-size: 24px;
      font-weight: 700;
      color: var(--section-accent, var(--neon-cyan));
      margin-bottom: 8px;
      text-shadow: 0 0 20px var(--section-accent, var(--neon-cyan));
    }

    .section-subtitle {
      font-size: 14px;
      color: var(--text-secondary);
    }

    /* Result Box (Main section) */
    .result-box {
      border: 2px solid var(--neon-cyan);
      border-radius: 12px;
      padding: 48px 32px;
      text-align: center;
      background: linear-gradient(180deg, rgba(0, 212, 255, 0.08) 0%, transparent 100%);
      box-shadow: 0 0 40px rgba(0, 212, 255, 0.2);
    }

    .result-emoji {
      font-size: 72px;
      margin-bottom: 20px;
    }

    .result-title {
      font-size: 32px;
      font-weight: 700;
      color: var(--neon-cyan);
      margin-bottom: 12px;
      text-shadow: 0 0 30px var(--neon-cyan);
    }

    .result-tagline {
      font-size: 16px;
      color: var(--text-secondary);
      font-style: italic;
    }

    /* Distribution Chart */
    .distribution {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 24px;
      margin-top: 32px;
    }

    .distribution-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .distribution-row:last-child {
      margin-bottom: 0;
    }

    .distribution-row.primary {
      color: var(--neon-cyan);
    }

    .distribution-emoji {
      font-size: 18px;
      width: 28px;
    }

    .distribution-name {
      width: 110px;
      font-size: 13px;
    }

    .distribution-bar {
      flex: 1;
      height: 20px;
      background: var(--bg-tertiary);
      border-radius: 4px;
      overflow: hidden;
    }

    .distribution-fill {
      height: 100%;
      background: var(--text-muted);
      transition: width 0.8s ease;
    }

    .distribution-row.primary .distribution-fill {
      background: var(--neon-cyan);
      box-shadow: 0 0 10px var(--neon-cyan);
    }

    .distribution-pct {
      width: 45px;
      text-align: right;
      font-size: 14px;
      font-weight: 500;
    }

    .distribution-marker {
      width: 24px;
      color: var(--neon-cyan);
      font-weight: bold;
    }

    /* Score Display */
    .score-display {
      text-align: center;
      padding: 32px 0;
    }

    .score-value {
      font-size: 72px;
      font-weight: 700;
      color: var(--section-accent, var(--neon-cyan));
      text-shadow: 0 0 40px var(--section-accent, var(--neon-cyan));
      line-height: 1;
    }

    .score-label {
      font-size: 14px;
      color: var(--text-secondary);
      margin-top: 8px;
    }

    .score-level {
      font-size: 14px;
      padding: 6px 16px;
      border-radius: 20px;
      display: inline-block;
      margin-top: 12px;
      font-weight: 500;
    }

    .score-level.healthy { background: rgba(0, 255, 136, 0.2); color: var(--neon-green); border: 1px solid var(--neon-green); }
    .score-level.balanced { background: rgba(0, 212, 255, 0.2); color: var(--neon-cyan); border: 1px solid var(--neon-cyan); }
    .score-level.moderate { background: rgba(255, 204, 0, 0.2); color: var(--neon-yellow); border: 1px solid var(--neon-yellow); }
    .score-level.warning { background: rgba(255, 68, 68, 0.2); color: var(--neon-red); border: 1px solid var(--neon-red); }

    /* Metric Bars */
    .metrics-container {
      margin-top: 32px;
    }

    .metric-row {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
      font-size: 13px;
    }

    .metric-label {
      width: 160px;
      color: var(--text-secondary);
    }

    .metric-bar {
      flex: 1;
      height: 10px;
      background: var(--bg-tertiary);
      border-radius: 5px;
      overflow: hidden;
    }

    .metric-fill {
      height: 100%;
      border-radius: 5px;
      transition: width 0.8s ease;
    }

    .metric-fill.cyan { background: var(--neon-cyan); box-shadow: 0 0 8px var(--neon-cyan); }
    .metric-fill.green { background: var(--neon-green); box-shadow: 0 0 8px var(--neon-green); }
    .metric-fill.yellow { background: var(--neon-yellow); box-shadow: 0 0 8px var(--neon-yellow); }
    .metric-fill.red { background: var(--neon-red); box-shadow: 0 0 8px var(--neon-red); }
    .metric-fill.magenta { background: var(--neon-magenta); box-shadow: 0 0 8px var(--neon-magenta); }

    .metric-value {
      width: 55px;
      text-align: right;
      color: var(--text-primary);
      font-weight: 500;
    }

    /* Blurred content */
    .blurred-content {
      filter: blur(6px);
      user-select: none;
      pointer-events: none;
    }

    /* Interpretation text */
    .interpretation {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.7;
      margin: 24px 0;
      padding: 16px;
      background: var(--bg-secondary);
      border-radius: 8px;
      border-left: 3px solid var(--section-accent, var(--neon-cyan));
    }

    /* Unlock prompt */
    .unlock-prompt {
      text-align: center;
      padding: 20px;
      margin-top: 24px;
      background: rgba(255, 204, 0, 0.08);
      border: 1px dashed var(--neon-yellow);
      border-radius: 8px;
    }

    .unlock-prompt-text {
      font-size: 13px;
      color: var(--neon-yellow);
    }

    /* Tool grid */
    .tool-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 16px;
    }

    .tool-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      font-size: 13px;
    }

    .tool-level {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .tool-level.expert { background: var(--neon-green); box-shadow: 0 0 8px var(--neon-green); }
    .tool-level.adept { background: var(--neon-cyan); box-shadow: 0 0 8px var(--neon-cyan); }
    .tool-level.basic { background: var(--neon-yellow); box-shadow: 0 0 8px var(--neon-yellow); }
    .tool-level.novice { background: var(--neon-red); box-shadow: 0 0 8px var(--neon-red); }

    /* Locked section */
    .locked-section {
      border: 2px dashed var(--text-muted);
      border-radius: 12px;
      padding: 48px 32px;
      text-align: center;
    }

    .locked-title {
      font-size: 24px;
      margin-bottom: 20px;
      color: var(--text-secondary);
    }

    .locked-items {
      list-style: none;
      margin: 32px 0;
      text-align: left;
      max-width: 400px;
      margin-left: auto;
      margin-right: auto;
    }

    .locked-item {
      padding: 8px 0;
      color: var(--text-muted);
      font-size: 13px;
    }

    .cta-box {
      background: var(--bg-tertiary);
      border: 2px solid var(--neon-yellow);
      border-radius: 8px;
      padding: 24px 32px;
      display: inline-block;
      box-shadow: 0 0 30px rgba(255, 204, 0, 0.2);
    }

    .cta-price {
      font-size: 24px;
      font-weight: 700;
      color: var(--neon-yellow);
      text-shadow: 0 0 20px var(--neon-yellow);
    }

    .cta-subtitle {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 8px;
    }

    /* Footer */
    .footer {
      text-align: center;
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 12px;
    }

    .footer a {
      color: var(--neon-cyan);
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
      text-shadow: 0 0 10px var(--neon-cyan);
    }

    /* Subsection title */
    .subsection-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 24px 0 12px;
    }

    /* ============================================
       Responsive Design
       ============================================ */
    @media (max-width: 768px) {
      .terminal-window {
        top: 10px;
        width: calc(100% - 20px);
        height: calc(100vh - 20px);
        border-radius: 8px;
      }

      .terminal-tabs {
        padding: 0 8px;
        height: 32px;
      }

      .terminal-tab {
        padding: 4px 10px;
        font-size: 11px;
      }

      .tabs-hint {
        display: none;
      }

      .snap-section {
        padding: 24px 16px;
      }

      .score-value {
        font-size: 56px;
      }

      .result-title {
        font-size: 24px;
      }

      .result-emoji {
        font-size: 56px;
      }

      .tool-grid {
        grid-template-columns: 1fr;
      }
    }

    /* ============================================
       Animations - Performance Optimized
       ============================================ */
    /* Removed infinite animations for better scroll performance */
    /* Static glow effects instead */
    .result-box {
      box-shadow: 0 0 30px rgba(0, 212, 255, 0.3);
    }

    .snap-section.in-view .score-display {
      box-shadow: 0 0 25px var(--section-accent, var(--neon-cyan));
    }

    /* Locked content blur class */
    .blurred-locked {
      filter: blur(6px);
      user-select: none;
      pointer-events: none;
    }

    /* ============================================
       Share Section Styles
       ============================================ */
    .share-section {
      text-align: center;
      padding: 32px 24px;
      margin-bottom: 32px;
      background: linear-gradient(135deg, rgba(0, 212, 255, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 16px;
    }

    .share-title {
      font-size: 24px;
      font-weight: 700;
      color: var(--neon-cyan);
      margin: 0 0 8px 0;
    }

    .share-subtitle {
      font-size: 14px;
      color: var(--text-secondary);
      margin: 0 0 24px 0;
    }

    .share-buttons {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }

    .share-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid transparent;
    }

    .share-btn svg {
      flex-shrink: 0;
    }

    .share-btn.twitter {
      background: #000;
      color: #fff;
      border-color: #333;
    }

    .share-btn.twitter:hover {
      background: #1a1a1a;
      border-color: #fff;
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
    }

    .share-btn.linkedin {
      background: #0077b5;
      color: #fff;
      border-color: #0077b5;
    }

    .share-btn.linkedin:hover {
      background: #006097;
      box-shadow: 0 0 20px rgba(0, 119, 181, 0.4);
    }

    .share-btn.copy {
      background: var(--bg-tertiary);
      color: var(--neon-cyan);
      border-color: var(--neon-cyan);
    }

    .share-btn.copy:hover {
      background: rgba(0, 212, 255, 0.1);
      box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
    }

    .share-url-container {
      max-width: 400px;
      margin: 0 auto;
    }

    .share-url-input {
      width: 100%;
      padding: 12px 16px;
      background: var(--bg-primary);
      border: 1px solid var(--bg-tertiary);
      border-radius: 8px;
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-size: 13px;
      text-align: center;
      cursor: pointer;
    }

    .share-url-input:focus {
      outline: none;
      border-color: var(--neon-cyan);
    }

    /* Toast notification */
    .toast {
      position: fixed;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: var(--neon-green);
      color: #000;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      opacity: 0;
      transition: all 0.3s ease;
      z-index: 1000;
    }

    .toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }

    .toast-icon {
      font-size: 16px;
    }

    /* Responsive adjustments for share section */
    @media (max-width: 600px) {
      .share-buttons {
        flex-direction: column;
        align-items: center;
      }

      .share-btn {
        width: 100%;
        max-width: 280px;
        justify-content: center;
      }
    }

    /* ============================================
       Insight Components (for UnifiedReport)
       ============================================ */
    .insights-section {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px dashed var(--border);
    }

    .insight-card {
      margin: 12px 0;
      padding: 16px;
      background: var(--bg-tertiary);
      border-radius: 8px;
      border-left: 3px solid var(--neon-cyan);
    }

    .insight-card.insight-praise {
      border-left-color: var(--neon-green);
    }

    .insight-card.insight-encouragement {
      border-left-color: var(--neon-yellow);
    }

    .insight-card.insight-research {
      border-left-color: var(--neon-magenta);
    }

    .insight-card.insight-resource {
      border-left-color: var(--neon-purple);
    }

    .insight-type {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .insight-quote {
      font-style: italic;
      color: var(--text-secondary);
      padding: 8px 12px;
      margin: 8px 0;
      border-left: 2px solid var(--border);
      font-size: 13px;
    }

    .insight-advice {
      color: var(--text-primary);
      font-size: 13px;
      line-height: 1.5;
    }

    .insight-text {
      color: var(--text-primary);
      font-size: 13px;
      line-height: 1.5;
    }

    .insight-source {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 8px;
    }

    .insight-source a {
      color: var(--neon-cyan);
      text-decoration: none;
    }

    .insight-source a:hover {
      text-decoration: underline;
    }

    .resource-link {
      display: block;
      color: var(--neon-cyan);
      font-size: 14px;
      text-decoration: none;
      margin-bottom: 8px;
    }

    .resource-link:hover {
      color: var(--neon-green);
      text-decoration: underline;
    }

    .resource-meta {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .resource-platform {
      font-size: 11px;
      color: var(--text-muted);
    }

    .resource-level {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .resource-level.level-beginner {
      background: rgba(0, 212, 255, 0.2);
      color: var(--neon-cyan);
    }

    .resource-level.level-intermediate {
      background: rgba(255, 204, 0, 0.2);
      color: var(--neon-yellow);
    }

    .resource-level.level-advanced {
      background: rgba(255, 0, 255, 0.2);
      color: var(--neon-magenta);
    }

    /* Evidence Section */
    .evidence-section {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px dashed var(--border);
    }

    .evidence-card {
      margin: 12px 0;
      padding: 12px 16px;
      background: var(--bg-secondary);
      border-radius: 6px;
      border-left: 3px solid var(--border);
    }

    .evidence-card.evidence-strength {
      border-left-color: var(--neon-green);
    }

    .evidence-card.evidence-growth {
      border-left-color: var(--neon-yellow);
    }

    .evidence-card.evidence-pattern {
      border-left-color: var(--neon-cyan);
    }

    .evidence-card blockquote {
      font-style: italic;
      color: var(--text-secondary);
      font-size: 13px;
      margin-bottom: 8px;
    }

    .evidence-analysis {
      font-size: 12px;
      color: var(--text-muted);
    }

    .evidence-dimension {
      display: inline-block;
      margin-top: 8px;
      font-size: 10px;
      padding: 2px 8px;
      background: var(--bg-tertiary);
      border-radius: 4px;
      color: var(--text-muted);
    }

    /* Highlight List (unified styling) */
    .highlight-list {
      list-style: none;
      padding: 0;
      margin: 8px 0;
    }

    .highlight-list li {
      padding: 4px 0;
      font-size: 13px;
    }
  `;
}

/**
 * JavaScript for scroll-based navigation with Intersection Observer
 */
function getScrollScript(): string {
  return `
    (function() {
      const container = document.getElementById('scroll-container');
      const sections = document.querySelectorAll('.snap-section');
      const terminalTabs = document.querySelectorAll('.terminal-tab');

      let currentSection = null;
      let isScrolling = false;
      let activationTimeout = null;
      let keyDebounce = false;

      // Natural scroll detection - activate when section top is near viewport top
      const observerOptions = {
        root: container,
        rootMargin: '-10% 0px -80% 0px',
        threshold: [0, 0.1, 0.2]
      };

      const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.05) {
            requestActivation(entry.target);
          }
        });
      }, observerOptions);

      // Observe all sections
      sections.forEach(section => {
        sectionObserver.observe(section);
      });

      // Debounced activation request
      function requestActivation(section) {
        if (activationTimeout) clearTimeout(activationTimeout);
        activationTimeout = setTimeout(() => activateSection(section), 50);
      }

      // Activate a section
      function activateSection(section) {
        if (currentSection === section) return;

        // Update section classes
        sections.forEach(s => s.classList.remove('in-view'));
        section.classList.add('in-view');
        currentSection = section;

        const sectionId = section.dataset.section;

        // Update terminal tabs (primary navigation)
        terminalTabs.forEach(tab => {
          const isActive = tab.dataset.section === sectionId;
          tab.classList.toggle('active', isActive);
        });
      }

      // Scroll to section
      function scrollToSection(sectionId) {
        const target = document.querySelector('.snap-section[data-section="' + sectionId + '"]');
        if (target) {
          isScrolling = true;
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(() => { isScrolling = false; }, 500);
        }
      }

      // Navigate by index
      function navigateByIndex(delta) {
        const currentIndex = currentSection ? parseInt(currentSection.dataset.index) : 0;
        const newIndex = Math.max(0, Math.min(sections.length - 1, currentIndex + delta));
        const targetSection = document.querySelector('[data-index="' + newIndex + '"]');
        if (targetSection) {
          scrollToSection(targetSection.dataset.section);
        }
      }

      // Terminal tab click handlers (primary navigation)
      terminalTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          scrollToSection(tab.dataset.section);
        });
      });

      // Keyboard navigation with debounce
      document.addEventListener('keydown', (e) => {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Debounce rapid key presses
        if (keyDebounce) return;
        keyDebounce = true;
        setTimeout(() => { keyDebounce = false; }, 100);

        switch(e.key) {
          case 'ArrowDown':
          case 'j':
            e.preventDefault();
            navigateByIndex(1);
            break;
          case 'ArrowUp':
          case 'k':
            e.preventDefault();
            navigateByIndex(-1);
            break;
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
          case '7':
          case '8':
            e.preventDefault();
            const index = parseInt(e.key) - 1;
            if (index < sections.length) {
              const targetSection = document.querySelector('[data-index="' + index + '"]');
              if (targetSection) {
                scrollToSection(targetSection.dataset.section);
              }
            }
            break;
          case 'Home':
            e.preventDefault();
            navigateByIndex(-100);
            break;
          case 'End':
            e.preventDefault();
            navigateByIndex(100);
            break;
        }
      });

      // Initialize first section
      if (sections.length > 0) {
        activateSection(sections[0]);
      }
    })();
  `;
}

// ============================================================================
// Section Rendering Helpers
// ============================================================================

type CssLevelClass = 'healthy' | 'balanced' | 'moderate' | 'warning';

/**
 * Maps a dimension level to its CSS class for score-level styling
 *
 * @param level - The dimension level string
 * @param positiveLevel - Level(s) that map to 'healthy' class
 * @param useWarning - If true, uses 'warning' instead of 'moderate' for lowest level
 */
function getLevelClass(
  level: string,
  positiveLevel: string | string[],
  useWarning = false
): CssLevelClass {
  const positiveLevels = Array.isArray(positiveLevel) ? positiveLevel : [positiveLevel];

  if (positiveLevels.includes(level)) {
    return 'healthy';
  }
  if (level === 'developing') {
    return 'balanced';
  }
  return useWarning ? 'warning' : 'moderate';
}

// ============================================================================
// Section Rendering Functions (Full-screen versions)
// ============================================================================

/**
 * Main Result Section - Type + Distribution
 */
function renderMainResultSection(result: TypeResult, meta: typeof TYPE_METADATA[CodingStyleType]): string {
  const types: CodingStyleType[] = ['architect', 'scientist', 'collaborator', 'speedrunner', 'craftsman'];

  const distributionRows = types.map(type => {
    const typeMeta = TYPE_METADATA[type];
    const pct = result.distribution[type];
    const isPrimary = type === result.primaryType;

    return `
      <div class="distribution-row${isPrimary ? ' primary' : ''}">
        <span class="distribution-emoji">${typeMeta.emoji}</span>
        <span class="distribution-name">${typeMeta.name}</span>
        <div class="distribution-bar">
          <div class="distribution-fill" style="width: ${pct}%"></div>
        </div>
        <span class="distribution-pct">${pct}%</span>
        <span class="distribution-marker">${isPrimary ? '◀' : ''}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="result-box">
      <div class="result-emoji">${meta.emoji}</div>
      <div class="result-title">YOU ARE ${meta.name.toUpperCase()}</div>
      <div class="result-tagline">"${meta.tagline}"</div>
    </div>

    <div class="distribution">
      <div class="subsection-title">📊 Style Distribution</div>
      ${distributionRows}
    </div>
  `;
}

/**
 * AI Collaboration Mastery Section - Full screen
 * Now with 3 categories: Planning, Orchestration, Verification
 * (Context Engineering is now a separate dimension)
 */
function renderAICollaborationSection(data: AICollaborationResult, isUnlocked: boolean): string {
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

/**
 * Context Engineering Section - Full screen
 * Based on 4 core strategies: WRITE, SELECT, COMPRESS, ISOLATE
 */
function renderContextEngineeringSection(data: ContextEngineeringResult, isUnlocked: boolean): string {
  const blurClass = isUnlocked ? '' : 'blurred-content';
  const levelClass = getLevelClass(data.level, ['expert', 'proficient']);

  const levelLabels: Record<string, string> = {
    expert: 'Context Master',
    proficient: 'Proficient',
    developing: 'Developing',
    novice: 'Getting Started',
  };

  return `
    <div class="section-header">
      <div class="section-icon">🧠</div>
      <div class="section-title">Context Engineering</div>
      <div class="section-subtitle">How effectively do you manage AI context?</div>
    </div>

    <div class="score-display">
      <div class="score-value">${data.score}</div>
      <div class="score-label">out of 100</div>
      <span class="score-level ${levelClass}">${levelLabels[data.level]}</span>
    </div>

    <div class="interpretation">
      ${data.interpretation}
    </div>

    <div class="metrics-container">
      <div class="metric-row">
        <span class="metric-label">WRITE (Preserve)</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.write.score >= 60 ? 'green' : 'cyan'}"
               style="width: ${data.breakdown.write.score}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.write.score}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">SELECT (Retrieve)</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.select.score >= 60 ? 'cyan' : 'yellow'}"
               style="width: ${data.breakdown.select.score}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.select.score}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">COMPRESS (Reduce)</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.compress.score >= 60 ? 'magenta' : 'yellow'}"
               style="width: ${data.breakdown.compress.score}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.compress.score}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">ISOLATE (Partition)</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.isolate.score >= 60 ? 'green' : 'cyan'}"
               style="width: ${data.breakdown.isolate.score}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.isolate.score}</span>
      </div>
    </div>

    <div class="subsection-title" style="margin-top: 24px;">📊 Key Metrics</div>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 12px;">
      <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px; text-align: center;">
        <div style="font-size: 20px; color: var(--neon-green); font-weight: 700;">${data.breakdown.write.fileReferences}</div>
        <div style="font-size: 10px; color: var(--text-muted);">File References</div>
      </div>
      <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px; text-align: center;">
        <div style="font-size: 20px; color: var(--neon-cyan); font-weight: 700;">${data.breakdown.compress.compactUsageCount}</div>
        <div style="font-size: 10px; color: var(--text-muted);">/compact Uses</div>
      </div>
      <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px; text-align: center;">
        <div style="font-size: 20px; color: var(--neon-magenta); font-weight: 700;">${data.breakdown.isolate.taskToolUsage}</div>
        <div style="font-size: 10px; color: var(--text-muted);">Task Delegations</div>
      </div>
      <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px; text-align: center;">
        <div style="font-size: 20px; color: var(--neon-yellow); font-weight: 700;">${data.breakdown.compress.avgTurnsPerSession.toFixed(1)}</div>
        <div style="font-size: 10px; color: var(--text-muted);">Avg Turns/Session</div>
      </div>
    </div>

    ${data.tips.length > 0 ? `
    <div class="subsection-title ${blurClass}" style="margin-top: 16px;">💡 Tips</div>
    <ul class="${blurClass}" style="list-style: none; padding: 0; margin: 0;">
      ${data.tips.map(t => `<li style="padding: 4px 0; color: var(--text-muted); font-size: 13px;">→ ${t}</li>`).join('')}
    </ul>
    ` : ''}

    ${isUnlocked ? '' : `
    <div class="unlock-prompt">
      <span class="unlock-prompt-text">🔓 Unlock best/worst examples + advanced tips</span>
    </div>
    `}
  `;
}

/**
 * Burnout Risk Section - Full screen (LOCKED by default, unlocked for premium)
 */
function renderBurnoutRiskSection(data: BurnoutRiskResult, isUnlocked: boolean): string {
  const blurClass = isUnlocked ? '' : 'blurred-locked';

  // Level labels for burnout risk (inverted - lower is better)
  const levelLabels: Record<string, string> = {
    low: 'Low Risk',
    moderate: 'Moderate Risk',
    elevated: 'Elevated Risk',
    high: 'High Risk',
  };

  // Calculate bar widths based on actual data
  const afterHoursWidth = Math.min(data.breakdown.afterHoursRate, 100);
  const weekendWidth = Math.min(data.breakdown.weekendRate, 100);
  const lateNightWidth = Math.min((data.breakdown.lateNightCount / 10) * 100, 100);

  // Build interpretation from recommendations
  const interpretationText = data.recommendations.length > 0
    ? data.recommendations[0]
    : 'Based on your session patterns, we\'ve analyzed your work habits including late-night sessions, weekend work frequency, and session intensity patterns.';

  return `
    <div class="section-header">
      <div class="section-icon">🔥</div>
      <div class="section-title">Burnout Risk Analysis</div>
      <div class="section-subtitle">Work-life balance insights from your coding patterns</div>
    </div>

    <div class="score-display">
      <div class="score-value ${blurClass}" style="${isUnlocked ? '' : 'color: var(--text-muted);'}">${isUnlocked ? data.score : '??'}</div>
      <div class="score-label">Work-Life Balance Score</div>
      <span class="score-level ${data.level} ${blurClass}">${isUnlocked ? levelLabels[data.level] || data.level : '???'}</span>
    </div>

    <div class="interpretation ${blurClass}">
      ${isUnlocked ? interpretationText : 'Based on your session patterns, we\'ve analyzed your work habits including late-night sessions, weekend work frequency, and session intensity patterns.'}
    </div>

    <div class="metrics-container">
      <div class="metric-row">
        <span class="metric-label">After-hours rate</span>
        <div class="metric-bar">
          <div class="metric-fill yellow" style="width: ${isUnlocked ? afterHoursWidth : 0}%"></div>
        </div>
        <span class="metric-value ${blurClass}">${isUnlocked ? Math.round(data.breakdown.afterHoursRate) + '%' : '??%'}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Weekend rate</span>
        <div class="metric-bar">
          <div class="metric-fill red" style="width: ${isUnlocked ? weekendWidth : 0}%"></div>
        </div>
        <span class="metric-value ${blurClass}">${isUnlocked ? Math.round(data.breakdown.weekendRate) + '%' : '??%'}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Late night count</span>
        <div class="metric-bar">
          <div class="metric-fill red" style="width: ${isUnlocked ? lateNightWidth : 0}%"></div>
        </div>
        <span class="metric-value ${blurClass}">${isUnlocked ? data.breakdown.lateNightCount : '??'}</span>
      </div>
    </div>

    <p style="font-size: 13px; color: var(--text-muted); margin-top: 24px; text-align: center;">
      We detected <span style="color: var(--neon-yellow);">${data.breakdown.lateNightCount}</span> late-night sessions...
    </p>

    ${isUnlocked ? '' : `
    <div class="unlock-prompt">
      <span class="unlock-prompt-text">🔓 Unlock full time analysis + wellness recommendations</span>
    </div>
    `}
  `;
}

/**
 * Tool Mastery Section - Full screen
 */
function renderToolMasterySection(data: ToolMasteryResult, isUnlocked: boolean): string {
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

/**
 * AI Control Index Section - Full screen
 * Based on elvis: "Professional developers don't vibe, they control"
 */
function renderAIControlSection(data: AIControlResult, isUnlocked: boolean): string {
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

/**
 * Skill Resilience Section - Full screen
 * Based on VCP Paper (arXiv:2601.02410) metrics
 */
function renderSkillResilienceSection(data: SkillResilienceResult, isUnlocked: boolean): string {
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

/**
 * Share Section - Social sharing buttons and copy-to-clipboard
 */
function renderShareSection(
  _result: TypeResult,
  meta: typeof TYPE_METADATA[CodingStyleType],
  reportId?: string,
  baseUrl: string = 'https://nomoreaislop.xyz'
): string {
  if (!reportId) {
    return ''; // No share section if no reportId
  }

  const shareUrl = `${baseUrl}/r/${reportId}`;

  // Pre-filled tweet text
  const tweetText = encodeURIComponent(`I'm a ${meta.name} ${meta.emoji} developer!

My AI Coding Style:
"${meta.tagline}"

Top Strength: ${meta.strengths[0]}

What's YOUR style? Find out:
${shareUrl}

#NoMoreAISlop #AICollaboration #DeveloperTools`);

  const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  return `
    <div class="share-section">
      <h3 class="share-title">📤 Share Your Results</h3>
      <p class="share-subtitle">Show off your AI coding style!</p>

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
          <span>Share on LinkedIn</span>
        </button>

        <button class="share-btn copy" onclick="copyShareUrl()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span id="copy-btn-text">Copy Link</span>
        </button>
      </div>

      <div class="share-url-container">
        <input type="text" class="share-url-input" id="share-url" value="${shareUrl}" readonly onclick="this.select()">
      </div>

      <!-- Toast notification -->
      <div class="toast" id="toast">
        <span class="toast-icon">✓</span>
        <span class="toast-text">Link copied to clipboard!</span>
      </div>
    </div>

    <script>
      function copyShareUrl() {
        const urlInput = document.getElementById('share-url');
        const copyBtnText = document.getElementById('copy-btn-text');
        const toast = document.getElementById('toast');

        navigator.clipboard.writeText(urlInput.value).then(() => {
          // Show toast
          toast.classList.add('show');
          copyBtnText.textContent = 'Copied!';

          // Track share action
          fetch('${baseUrl}/api/reports/${reportId}/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: 'clipboard' })
          }).catch(() => {});

          // Reset after 2 seconds
          setTimeout(() => {
            toast.classList.remove('show');
            copyBtnText.textContent = 'Copy Link';
          }, 2000);
        }).catch((err) => {
          console.error('Failed to copy:', err);
          // Fallback: select the text
          urlInput.select();
          document.execCommand('copy');
        });
      }

      // Track Twitter/LinkedIn shares
      document.querySelectorAll('.share-btn.twitter, .share-btn.linkedin').forEach(btn => {
        btn.addEventListener('click', () => {
          const platform = btn.classList.contains('twitter') ? 'twitter' : 'linkedin';
          fetch('${baseUrl}/api/reports/${reportId}/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform })
          }).catch(() => {});
        });
      });
    </script>
  `;
}

/**
 * Locked/CTA Section - shows unlock badge when premium, paywall when free
 */
/**
 * Dashboard Buttons - shows both My Dashboard and Enterprise buttons
 */
function renderDashboardButtons(): string {
  const baseUrl = process.env.NOSLOP_DASHBOARD_URL || 'http://localhost:5173';

  return `
    <div class="dashboard-buttons" style="
      display: flex;
      gap: 16px;
      justify-content: center;
      margin: 32px 0;
      flex-wrap: wrap;
    ">
      <a
        href="${baseUrl}/personal"
        class="dashboard-btn personal"
        style="
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          background: linear-gradient(135deg, #00d4ff, #ff00ff);
          color: #0a0a0a;
          font-weight: 600;
          font-size: 14px;
          border-radius: 8px;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 20px rgba(0, 212, 255, 0.4);
        "
        onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 25px rgba(0, 212, 255, 0.6)';"
        onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 20px rgba(0, 212, 255, 0.4)';"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        My Dashboard
      </a>
      <a
        href="${baseUrl}/enterprise"
        class="dashboard-btn enterprise"
        style="
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          background: linear-gradient(135deg, #00ff88, #00d4ff);
          color: #0a0a0a;
          font-weight: 600;
          font-size: 14px;
          border-radius: 8px;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 20px rgba(0, 255, 136, 0.4);
        "
        onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 25px rgba(0, 255, 136, 0.6)';"
        onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 20px rgba(0, 255, 136, 0.4)';"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 21h18"></path>
          <path d="M5 21V7l8-4v18"></path>
          <path d="M19 21V11l-6-4"></path>
          <path d="M9 9v.01"></path>
          <path d="M9 12v.01"></path>
          <path d="M9 15v.01"></path>
          <path d="M9 18v.01"></path>
        </svg>
        Enterprise
      </a>
    </div>
  `;
}

/**
 * Locked/CTA Section - shows unlock badge when premium, paywall when free
 */
function renderLockedSection(isUnlocked: boolean): string {
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

/**
 * Footer
 */
function renderFooter(): string {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
    <footer class="footer">
      <p>Analysis generated on ${date}</p>
      <p>Built with 💜 by <a href="https://nomoreaislop.dev">NoMoreAISlop</a></p>
    </footer>
  `;
}

// ============================================================================
// Verbose Evaluation Rendering Functions
// ============================================================================

/**
 * Render verbose personality summary section
 */
function renderVerbosePersonalitySummary(verboseEval: VerboseEvaluation, _isUnlocked: boolean): string {
  return `
    <div style="margin: 32px 0; padding: 24px; background: var(--bg-secondary); border-radius: 12px; border-left: 4px solid var(--neon-cyan);">
      <div class="subsection-title" style="margin-bottom: 16px;">🎭 Your AI Coding Personality</div>
      <p style="font-size: 14px; line-height: 1.8; color: var(--text-primary);">
        ${verboseEval.personalitySummary}
      </p>
    </div>
  `;
}

/**
 * Render verbose strengths section with evidence
 */
function renderVerboseStrengths(verboseEval: VerboseEvaluation, _isUnlocked: boolean): string {
  const strengthsHtml = verboseEval.strengths
    .map(
      strength => `
    <div style="margin-bottom: 24px; padding: 20px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid rgba(0, 255, 136, 0.2);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <h4 style="color: var(--neon-green); font-size: 16px; margin: 0;">✨ ${strength.title}</h4>
        ${strength.percentile ? `<span style="font-size: 12px; color: var(--text-muted);">Top ${100 - strength.percentile}%</span>` : ''}
      </div>
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
        ${strength.description}
      </p>
      <div style="margin-top: 12px;">
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">Evidence from your sessions:</div>
        ${strength.evidence
          .map(
            ev => `
          <div style="padding: 8px 12px; background: var(--bg-primary); border-radius: 4px; margin-bottom: 6px; border-left: 2px solid var(--neon-green);">
            <div style="font-size: 12px; font-style: italic; color: var(--text-primary); margin-bottom: 4px;">"${escapeHtml(ev.quote)}"</div>
            <div style="font-size: 10px; color: var(--text-muted);">${ev.context} • ${new Date(ev.sessionDate).toLocaleDateString()}</div>
            <div style="font-size: 11px; color: var(--neon-green); margin-top: 4px;">→ ${escapeHtml(ev.significance)}</div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `
    )
    .join('');

  return `
    <div style="margin: 32px 0;">
      <div class="subsection-title" style="margin-bottom: 20px;">💪 Your Strengths (with Evidence)</div>
      ${strengthsHtml}
    </div>
  `;
}

/**
 * Render verbose growth areas section
 */
function renderVerboseGrowthAreas(verboseEval: VerboseEvaluation, isUnlocked: boolean): string {
  const blurClass = isUnlocked ? '' : 'blurred-content';

  const growthAreasHtml = verboseEval.growthAreas
    .map(
      area => `
    <div class="${blurClass}" style="margin-bottom: 24px; padding: 20px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid rgba(255, 204, 0, 0.2);">
      <h4 style="color: var(--neon-yellow); font-size: 16px; margin: 0 0 12px 0;">🌱 ${area.title}</h4>
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
        ${area.description}
      </p>
      <div style="margin-top: 12px;">
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">Examples from your sessions:</div>
        ${area.evidence
          .map(
            ev => `
          <div style="padding: 8px 12px; background: var(--bg-primary); border-radius: 4px; margin-bottom: 6px; border-left: 2px solid var(--neon-yellow);">
            <div style="font-size: 12px; font-style: italic; color: var(--text-primary); margin-bottom: 4px;">"${escapeHtml(ev.quote)}"</div>
            <div style="font-size: 10px; color: var(--text-muted);">${ev.context} • ${new Date(ev.sessionDate).toLocaleDateString()}</div>
          </div>
        `
          )
          .join('')}
      </div>
      <div style="margin-top: 16px; padding: 12px; background: rgba(0, 212, 255, 0.08); border-radius: 6px; border: 1px solid rgba(0, 212, 255, 0.2);">
        <div style="font-size: 11px; color: var(--neon-cyan); font-weight: 600; margin-bottom: 4px;">💡 Recommendation:</div>
        <div style="font-size: 12px; color: var(--text-primary);">${area.recommendation}</div>
        ${
          area.resources && area.resources.length > 0
            ? `
        <div style="margin-top: 8px; font-size: 11px; color: var(--text-muted);">
          Resources: ${area.resources.map(r => `<a href="${r}" style="color: var(--neon-cyan);">${r}</a>`).join(', ')}
        </div>
        `
            : ''
        }
      </div>
    </div>
  `
    )
    .join('');

  return `
    <div style="margin: 32px 0;">
      <div class="subsection-title" style="margin-bottom: 20px;">🎯 Growth Opportunities</div>
      ${growthAreasHtml}
      ${
        isUnlocked
          ? ''
          : `
      <div class="unlock-prompt">
        <span class="unlock-prompt-text">🔓 Unlock detailed recommendations and resources</span>
      </div>
      `
      }
    </div>
  `;
}

/**
 * Render verbose prompt patterns section
 */
function renderVerbosePromptPatterns(verboseEval: VerboseEvaluation, _isUnlocked: boolean): string {
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
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
        ${pattern.description}
      </p>
      <div style="margin-top: 12px;">
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">Examples:</div>
        ${pattern.examples
          .map(
            ex => `
          <div style="padding: 8px 12px; background: var(--bg-primary); border-radius: 4px; margin-bottom: 6px; border-left: 2px solid var(--neon-purple);">
            <div style="font-size: 12px; font-style: italic; color: var(--text-primary); margin-bottom: 4px;">"${escapeHtml(ex.quote)}"</div>
            <div style="font-size: 11px; color: var(--text-muted);">→ ${escapeHtml(ex.analysis)}</div>
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

/**
 * Render locked premium teasers
 */
function renderVerboseLockedTeasers(isUnlocked: boolean): string {
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

/**
 * Escape HTML entities
 * @internal Used for future evidence rendering
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================
// UnifiedReport Renderer
// ============================================

import type { UnifiedReport, DimensionResult } from '../models/unified-report.js';
import {
  renderSectionHeader,
  renderScoreDisplay,
  renderMetricsFromBreakdown,
  renderInterpretation,
  renderStrengths,
  renderGrowthAreas,
  renderUnlockPrompt,
  renderDimensionInsights,
  renderEvidenceQuotes,
  DIMENSION_CONFIG,
} from './components.js';

/**
 * Generate HTML report from UnifiedReport
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

/**
 * Get short tab name for dimension
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
 * Render summary section
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
