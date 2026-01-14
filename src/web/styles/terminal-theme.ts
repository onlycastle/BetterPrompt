/**
 * Terminal Theme CSS Styles
 *
 * This module provides enhanced CSS styles for the web report viewer with a
 * neon terminal aesthetic inspired by tmux and iTerm2. Features include:
 *
 * - macOS Big Sur solar background gradient
 * - Terminal window frame with titlebar and tabs
 * - Neon color scheme with glow effects
 * - Smooth scrolling with custom scrollbars
 * - CRT scanline effects
 * - Responsive design for mobile devices
 * - Performance-optimized animations
 *
 * @module web/styles/terminal-theme
 */

/**
 * Returns the complete CSS stylesheet for the terminal-themed report viewer.
 *
 * The styles include:
 * - CSS variables for theming
 * - macOS-style window chrome
 * - Terminal tabs navigation
 * - Section layouts and transitions
 * - Component styles (cards, metrics, charts)
 * - Responsive breakpoints
 * - Insight and evidence components
 *
 * @returns {string} Complete CSS stylesheet as a string
 */
export function getEnhancedStyles(): string {
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
      color: var(--text-primary);
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
       Quote Card Hover Effects
       ============================================ */
    .quote-card:hover {
      transform: translateX(4px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    }

    .quote-card--hero:hover {
      transform: translateX(6px) scale(1.01);
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
    }

    .quote-card--strength:hover {
      border-left-width: 6px;
    }

    .quote-card--growth:hover {
      border-left-width: 6px;
      background: rgba(251, 191, 36, 0.06);
    }

    /* Dimension Card Animations */
    .dimension-card {
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .dimension-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }

    .strength-cluster, .growth-cluster {
      transition: background 0.2s ease;
    }

    .strength-cluster:hover, .growth-cluster:hover {
      background: rgba(255, 255, 255, 0.01);
    }

    /* Show More Button Hover */
    .quote-wall + button:hover {
      background: rgba(255, 255, 255, 0.03);
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-1px);
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
      color: var(--text-muted);
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
      color: var(--text-muted);
      font-size: 13px;
      margin-bottom: 8px;
    }

    .evidence-analysis {
      font-size: 12px;
      color: var(--text-primary);
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
