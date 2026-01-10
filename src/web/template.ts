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
  type PromptScoreResult,
  type BurnoutRiskResult,
  type ToolMasteryResult,
} from '../analyzer/dimensions/index.js';

/**
 * Extended analysis data for full report
 */
export interface ExtendedAnalysisData {
  typeResult: TypeResult;
  dimensions?: FullAnalysisResult;
}

/**
 * Generate the complete HTML report with scroll-based terminal UI
 */
export function generateReportHTML(result: TypeResult, dimensions?: FullAnalysisResult): string {
  const meta = TYPE_METADATA[result.primaryType];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your AI Coding Style | NoMoreAISlop</title>
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
        <div class="terminal-tab" data-section="prompt-score">
          <span class="tab-index">2:</span><span class="tab-text">prompt</span>
        </div>
        <div class="terminal-tab" data-section="burnout-risk">
          <span class="tab-index">3:</span><span class="tab-text">burnout</span>
        </div>
        <div class="terminal-tab" data-section="tool-mastery">
          <span class="tab-index">4:</span><span class="tab-text">tools</span>
        </div>
        <div class="terminal-tab" data-section="unlock">
          <span class="tab-index">5:</span><span class="tab-text">unlock</span>
        </div>
        ` : `
        <div class="terminal-tab" data-section="unlock">
          <span class="tab-index">1:</span><span class="tab-text">unlock</span>
        </div>
        `}
        <span class="tabs-hint">↑↓/jk navigate • 1-${dimensions ? '6' : '2'} jump</span>
      </div>
    </div>

    <!-- Scroll-snap container -->
    <div class="scroll-container" id="scroll-container">

      <!-- Section 0: Main Result -->
      <section class="snap-section in-view" data-section="result" data-index="0">
        <div class="section-inner">
          ${renderMainResultSection(result, meta)}
        </div>
      </section>

      ${dimensions ? `
      <!-- Section 1: AI Collaboration Mastery -->
      <section class="snap-section section-ai-collaboration" data-section="ai-collaboration" data-index="1">
        <div class="section-inner">
          ${renderAICollaborationSection(dimensions.aiCollaboration)}
        </div>
      </section>

      <!-- Section 2: Prompt Engineering -->
      <section class="snap-section section-prompt-score" data-section="prompt-score" data-index="2">
        <div class="section-inner">
          ${renderPromptScoreSection(dimensions.promptScore)}
        </div>
      </section>

      <!-- Section 3: Burnout Risk -->
      <section class="snap-section section-burnout-risk" data-section="burnout-risk" data-index="3">
        <div class="section-inner">
          ${renderBurnoutRiskSection(dimensions.burnoutRisk)}
        </div>
      </section>

      <!-- Section 4: Tool Mastery -->
      <section class="snap-section section-tool-mastery" data-section="tool-mastery" data-index="4">
        <div class="section-inner">
          ${renderToolMasterySection(dimensions.toolMastery)}
        </div>
      </section>
      ` : ''}

      <!-- Section 5: Unlock & Footer -->
      <section class="snap-section" data-section="unlock" data-index="${dimensions ? '5' : '1'}">
        <div class="section-inner">
          ${renderLockedSection()}
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
       Scroll-Snap Container
       ============================================ */
    .scroll-container {
      flex: 1;
      overflow-y: scroll;
      overflow-x: hidden;
      scroll-snap-type: y mandatory;
      scroll-behavior: smooth;

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
       Snap Sections - Performance Optimized
       ============================================ */
    .snap-section {
      min-height: 100%;
      scroll-snap-align: start;
      scroll-snap-stop: always;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      position: relative;

      /* Performance: opacity + transform only (no expensive filter) */
      opacity: 0.4;
      transform: scale(0.97) translateZ(0);
      transition: opacity 0.4s ease-out, transform 0.4s ease-out;
      will-change: opacity, transform;
      contain: content;
    }

    .snap-section.in-view {
      opacity: 1;
      transform: scale(1) translateZ(0);
    }

    .section-inner {
      width: 100%;
      max-width: 700px;
    }

    /* Section-specific accent colors */
    .section-ai-collaboration { --section-accent: var(--neon-cyan); }
    .section-prompt-score { --section-accent: var(--neon-green); }
    .section-burnout-risk { --section-accent: var(--neon-yellow); }
    .section-tool-mastery { --section-accent: var(--neon-magenta); }

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

      // Performance: Reduced thresholds from 5 to 2
      const observerOptions = {
        root: container,
        rootMargin: '-30% 0px -30% 0px',
        threshold: [0, 0.5]
      };

      const sectionObserver = new IntersectionObserver((entries) => {
        let mostVisible = null;
        let maxRatio = 0;

        entries.forEach(entry => {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            mostVisible = entry.target;
          }
        });

        if (mostVisible && maxRatio > 0.4) {
          requestActivation(mostVisible);
        }
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
 */
function renderAICollaborationSection(data: AICollaborationResult): string {
  const levelClass = data.level === 'expert' || data.level === 'proficient'
    ? 'healthy'
    : data.level === 'developing' ? 'balanced' : 'moderate';

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
        <span class="metric-label">Context Engineering</span>
        <div class="metric-bar">
          <div class="metric-fill ${data.breakdown.contextEngineering.score >= 60 ? 'green' : 'yellow'}"
               style="width: ${data.breakdown.contextEngineering.score}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.contextEngineering.score}</span>
      </div>
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
    <div class="subsection-title blurred-content" style="margin-top: 16px;">🌱 Growth Areas</div>
    <ul class="blurred-content" style="list-style: none; padding: 0; margin: 0;">
      ${data.growthAreas.map(g => `<li style="padding: 4px 0; color: var(--text-muted); font-size: 13px;">→ ${g}</li>`).join('')}
    </ul>
    ` : ''}

    <div class="unlock-prompt">
      <span class="unlock-prompt-text">🔓 Unlock detailed breakdown + personalized recommendations</span>
    </div>
  `;
}

/**
 * Prompt Engineering Section - Full screen
 */
function renderPromptScoreSection(data: PromptScoreResult): string {
  const scoreClass = data.score >= 70 ? 'healthy' : data.score >= 50 ? 'balanced' : 'moderate';
  const levelLabel = data.score >= 70 ? 'Above Average' : data.score >= 50 ? 'Average' : 'Needs Work';

  return `
    <div class="section-header">
      <div class="section-icon">🎯</div>
      <div class="section-title">Prompt Engineering Score</div>
      <div class="section-subtitle">How effectively do you communicate with AI?</div>
    </div>

    <div class="score-display">
      <div class="score-value">${data.score}</div>
      <div class="score-label">out of 100</div>
      <span class="score-level ${scoreClass}">${levelLabel}</span>
    </div>

    <div class="metrics-container">
      <div class="metric-row">
        <span class="metric-label">Context provision</span>
        <div class="metric-bar">
          <div class="metric-fill cyan" style="width: ${data.breakdown.contextProvision}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.contextProvision}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Specificity</span>
        <div class="metric-bar">
          <div class="metric-fill green" style="width: ${data.breakdown.specificity}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.specificity}</span>
      </div>
      <div class="metric-row blurred-content">
        <span class="metric-label">First-try success</span>
        <div class="metric-bar">
          <div class="metric-fill magenta" style="width: ${data.breakdown.firstTrySuccess}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.firstTrySuccess}</span>
      </div>
      <div class="metric-row blurred-content">
        <span class="metric-label">Constraint clarity</span>
        <div class="metric-bar">
          <div class="metric-fill cyan" style="width: ${data.breakdown.constraintClarity}%"></div>
        </div>
        <span class="metric-value">${data.breakdown.constraintClarity}</span>
      </div>
    </div>

    <div class="unlock-prompt">
      <span class="unlock-prompt-text">🔓 Unlock best/worst prompt analysis + improvement tips</span>
    </div>
  `;
}

/**
 * Burnout Risk Section - Full screen (LOCKED)
 */
function renderBurnoutRiskSection(data: BurnoutRiskResult): string {
  return `
    <div class="section-header">
      <div class="section-icon">🔥</div>
      <div class="section-title">Burnout Risk Analysis</div>
      <div class="section-subtitle">Work-life balance insights from your coding patterns</div>
    </div>

    <div class="score-display">
      <div class="score-value blurred-locked" style="color: var(--text-muted);">??</div>
      <div class="score-label">Work-Life Balance Score</div>
      <span class="score-level moderate" class="blurred-locked">???</span>
    </div>

    <div class="interpretation" class="blurred-locked">
      Based on your session patterns, we've analyzed your work habits including late-night sessions,
      weekend work frequency, and session intensity patterns.
    </div>

    <div class="metrics-container">
      <div class="metric-row">
        <span class="metric-label">After-hours rate</span>
        <div class="metric-bar">
          <div class="metric-fill yellow" style="width: 0%"></div>
        </div>
        <span class="metric-value" class="blurred-locked">??%</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Weekend sessions</span>
        <div class="metric-bar">
          <div class="metric-fill red" style="width: 0%"></div>
        </div>
        <span class="metric-value" class="blurred-locked">??</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Late night count</span>
        <div class="metric-bar">
          <div class="metric-fill red" style="width: 0%"></div>
        </div>
        <span class="metric-value" class="blurred-locked">??</span>
      </div>
    </div>

    <p style="font-size: 13px; color: var(--text-muted); margin-top: 24px; text-align: center;">
      We detected <span style="color: var(--neon-yellow);">${data.breakdown.lateNightCount}</span> late-night sessions...
    </p>

    <div class="unlock-prompt">
      <span class="unlock-prompt-text">🔓 Unlock full time analysis + wellness recommendations</span>
    </div>
  `;
}

/**
 * Tool Mastery Section - Full screen
 */
function renderToolMasterySection(data: ToolMasteryResult): string {
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

    <div class="subsection-title" style="color: var(--text-muted);">Underutilized (Unlock for tips)</div>
    <div class="tool-grid blurred-content">
      ${underutilizedHtml}
    </div>

    <div class="unlock-prompt">
      <span class="unlock-prompt-text">🔓 Unlock full tool analysis + optimization strategies</span>
    </div>
  `;
}

/**
 * Locked/CTA Section
 */
function renderLockedSection(): string {
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
