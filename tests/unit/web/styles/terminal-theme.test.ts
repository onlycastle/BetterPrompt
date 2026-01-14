/**
 * Tests for Terminal Theme CSS Styles
 */

import { describe, it, expect } from 'vitest';
import { getEnhancedStyles } from '../../../../src/web/styles/terminal-theme.js';
import { cssContainsRule } from '../../../utils/html-helpers.js';

describe('getEnhancedStyles', () => {
  let css: string;

  beforeEach(() => {
    css = getEnhancedStyles();
  });

  describe('CSS variables', () => {
    it('defines neon color palette', () => {
      expect(css).toContain('--neon-green: #00ff88');
      expect(css).toContain('--neon-cyan: #00d4ff');
      expect(css).toContain('--neon-magenta: #ff00ff');
      expect(css).toContain('--neon-yellow: #ffcc00');
      expect(css).toContain('--neon-red: #ff4444');
      expect(css).toContain('--neon-purple: #8b5cf6');
      expect(css).toContain('--neon-pink: #ec4899');
    });

    it('defines background colors', () => {
      expect(css).toContain('--bg-primary: #0a0a0a');
      expect(css).toContain('--bg-secondary: #111111');
      expect(css).toContain('--bg-tertiary: #1a1a1a');
    });

    it('defines text colors', () => {
      expect(css).toContain('--text-primary: #e0e0e0');
      expect(css).toContain('--text-secondary: #888888');
      expect(css).toContain('--text-muted: #555555');
    });

    it('defines font family', () => {
      expect(css).toContain("--font-mono: 'JetBrains Mono'");
    });
  });

  describe('terminal window styles', () => {
    it('includes terminal window class', () => {
      expect(cssContainsRule(css, '.terminal-window')).toBe(true);
    });

    it('includes terminal titlebar', () => {
      expect(cssContainsRule(css, '.terminal-titlebar')).toBe(true);
    });

    it('includes terminal buttons (close, minimize, maximize)', () => {
      expect(cssContainsRule(css, '.terminal-btn.close')).toBe(true);
      expect(cssContainsRule(css, '.terminal-btn.minimize')).toBe(true);
      expect(cssContainsRule(css, '.terminal-btn.maximize')).toBe(true);
    });

    it('includes terminal tabs', () => {
      expect(cssContainsRule(css, '.terminal-tabs')).toBe(true);
      expect(cssContainsRule(css, '.terminal-tab')).toBe(true);
      expect(cssContainsRule(css, '.terminal-tab.active')).toBe(true);
    });
  });

  describe('section styles', () => {
    it('includes snap section styles', () => {
      expect(cssContainsRule(css, '.snap-section')).toBe(true);
    });

    it('includes section header styles', () => {
      expect(cssContainsRule(css, '.section-header')).toBe(true);
      expect(cssContainsRule(css, '.section-title')).toBe(true);
      expect(cssContainsRule(css, '.section-icon')).toBe(true);
    });

    it('includes section-specific accent colors', () => {
      expect(css).toContain('.section-ai-collaboration { --section-accent: var(--neon-cyan)');
      expect(css).toContain('.section-context-engineering { --section-accent: var(--neon-green)');
      expect(css).toContain('.section-burnout-risk { --section-accent: var(--neon-yellow)');
    });
  });

  describe('component styles', () => {
    it('includes result box styles', () => {
      expect(cssContainsRule(css, '.result-box')).toBe(true);
      expect(cssContainsRule(css, '.result-emoji')).toBe(true);
      expect(cssContainsRule(css, '.result-title')).toBe(true);
    });

    it('includes distribution chart styles', () => {
      expect(cssContainsRule(css, '.distribution')).toBe(true);
      expect(cssContainsRule(css, '.distribution-row')).toBe(true);
      expect(cssContainsRule(css, '.distribution-bar')).toBe(true);
      expect(cssContainsRule(css, '.distribution-fill')).toBe(true);
    });

    it('includes score display styles', () => {
      expect(cssContainsRule(css, '.score-display')).toBe(true);
      expect(cssContainsRule(css, '.score-value')).toBe(true);
      expect(cssContainsRule(css, '.score-level')).toBe(true);
    });

    it('includes metric bar styles', () => {
      expect(cssContainsRule(css, '.metric-row')).toBe(true);
      expect(cssContainsRule(css, '.metric-bar')).toBe(true);
      expect(cssContainsRule(css, '.metric-fill')).toBe(true);
    });

    it('includes tool grid styles', () => {
      expect(cssContainsRule(css, '.tool-grid')).toBe(true);
      expect(cssContainsRule(css, '.tool-item')).toBe(true);
      expect(cssContainsRule(css, '.tool-level')).toBe(true);
    });
  });

  describe('score level variants', () => {
    it('includes all score level classes', () => {
      expect(cssContainsRule(css, '.score-level.healthy')).toBe(true);
      expect(cssContainsRule(css, '.score-level.balanced')).toBe(true);
      expect(cssContainsRule(css, '.score-level.moderate')).toBe(true);
      expect(cssContainsRule(css, '.score-level.warning')).toBe(true);
    });

    it('includes metric fill color variants', () => {
      expect(cssContainsRule(css, '.metric-fill.cyan')).toBe(true);
      expect(cssContainsRule(css, '.metric-fill.green')).toBe(true);
      expect(cssContainsRule(css, '.metric-fill.yellow')).toBe(true);
      expect(cssContainsRule(css, '.metric-fill.red')).toBe(true);
    });

    it('includes tool level variants', () => {
      expect(cssContainsRule(css, '.tool-level.expert')).toBe(true);
      expect(cssContainsRule(css, '.tool-level.adept')).toBe(true);
      expect(cssContainsRule(css, '.tool-level.basic')).toBe(true);
      expect(cssContainsRule(css, '.tool-level.novice')).toBe(true);
    });
  });

  describe('special effects', () => {
    it('includes macOS background gradient', () => {
      expect(cssContainsRule(css, '.macos-background')).toBe(true);
    });

    it('includes scanline CRT effect', () => {
      expect(cssContainsRule(css, '.scanline')).toBe(true);
    });

    it('includes blurred content class', () => {
      expect(cssContainsRule(css, '.blurred-content')).toBe(true);
    });
  });

  describe('share section', () => {
    it('includes share section styles', () => {
      expect(cssContainsRule(css, '.share-section')).toBe(true);
      expect(cssContainsRule(css, '.share-btn')).toBe(true);
      expect(cssContainsRule(css, '.share-btn.twitter')).toBe(true);
      expect(cssContainsRule(css, '.share-btn.linkedin')).toBe(true);
    });
  });

  describe('insight components', () => {
    it('includes insight card styles', () => {
      expect(cssContainsRule(css, '.insight-card')).toBe(true);
      expect(cssContainsRule(css, '.insight-type')).toBe(true);
      expect(cssContainsRule(css, '.insight-text')).toBe(true);
    });

    it('includes insight type variants', () => {
      expect(cssContainsRule(css, '.insight-card.insight-praise')).toBe(true);
      expect(cssContainsRule(css, '.insight-card.insight-encouragement')).toBe(true);
      expect(cssContainsRule(css, '.insight-card.insight-research')).toBe(true);
      expect(cssContainsRule(css, '.insight-card.insight-resource')).toBe(true);
    });

    it('includes evidence card styles', () => {
      expect(cssContainsRule(css, '.evidence-card')).toBe(true);
      expect(cssContainsRule(css, '.evidence-card.evidence-strength')).toBe(true);
      expect(cssContainsRule(css, '.evidence-card.evidence-growth')).toBe(true);
    });
  });

  describe('responsive design', () => {
    it('includes mobile breakpoint', () => {
      expect(css).toContain('@media (max-width: 768px)');
    });

    it('includes share section mobile breakpoint', () => {
      expect(css).toContain('@media (max-width: 600px)');
    });
  });

  describe('scrollbar styling', () => {
    it('includes custom scrollbar styles', () => {
      expect(css).toContain('scrollbar-width: thin');
      expect(css).toContain('::-webkit-scrollbar');
    });
  });
});
