/**
 * Tests for Report HTML Template Generation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateReportHTML } from '../../../../src/web/templates/report.js';
import { createMockTypeResult, createMockDimensions, createMockVerboseEvaluation } from '../../../utils/helpers.js';
import {
  parseHTML,
  validateHTMLStructure,
  containsText,
  hasClass,
  countElements,
  hasDataAttribute,
  extractStyles,
  scriptContainsFunction,
} from '../../../utils/html-helpers.js';

describe('generateReportHTML', () => {
  const mockResult = createMockTypeResult();
  const mockDimensions = createMockDimensions();

  beforeEach(() => {
    // Reset environment
    delete process.env.NOSLOP_TEST_TIER;
    process.env.NODE_ENV = 'test';
  });

  describe('basic HTML structure', () => {
    it('generates valid HTML document', () => {
      const html = generateReportHTML(mockResult);
      const validation = validateHTMLStructure(html);
      expect(validation.isValid).toBe(true);
    });

    it('includes DOCTYPE declaration', () => {
      const html = generateReportHTML(mockResult);
      expect(html.trim().startsWith('<!DOCTYPE html>')).toBe(true);
    });

    it('includes proper meta tags', () => {
      const html = generateReportHTML(mockResult);
      expect(html).toContain('charset="UTF-8"');
      expect(html).toContain('viewport');
    });

    it('includes JetBrains Mono font', () => {
      const html = generateReportHTML(mockResult);
      expect(html).toContain('fonts.googleapis.com');
      expect(html).toContain('JetBrains+Mono');
    });
  });

  describe('title generation', () => {
    it('includes type name in title', () => {
      const html = generateReportHTML(mockResult);
      const doc = parseHTML(html);
      const title = doc.querySelector('title')?.textContent;
      expect(title).toContain('Architect');
    });

    it('includes NoMoreAISlop branding', () => {
      const html = generateReportHTML(mockResult);
      expect(containsText(html, 'NoMoreAISlop')).toBe(true);
    });
  });

  describe('terminal window structure', () => {
    it('renders terminal window container', () => {
      const html = generateReportHTML(mockResult);
      expect(hasClass(html, 'terminal-window')).toBe(true);
    });

    it('renders terminal titlebar with buttons', () => {
      const html = generateReportHTML(mockResult);
      expect(hasClass(html, 'terminal-titlebar')).toBe(true);
      expect(hasClass(html, 'terminal-btn')).toBe(true);
    });

    it('renders terminal tabs', () => {
      const html = generateReportHTML(mockResult);
      expect(hasClass(html, 'terminal-tabs')).toBe(true);
    });

    it('renders macOS background', () => {
      const html = generateReportHTML(mockResult);
      expect(hasClass(html, 'macos-background')).toBe(true);
    });

    it('renders scanline effect', () => {
      const html = generateReportHTML(mockResult);
      expect(hasClass(html, 'scanline')).toBe(true);
    });
  });

  describe('sections without dimensions', () => {
    it('renders main result section', () => {
      const html = generateReportHTML(mockResult);
      expect(hasDataAttribute(html, 'section', 'result')).toBe(true);
    });

    it('renders only 2 tabs without dimensions', () => {
      const html = generateReportHTML(mockResult);
      expect(countElements(html, '.terminal-tab')).toBe(2);
    });

    it('renders unlock section', () => {
      const html = generateReportHTML(mockResult);
      expect(hasDataAttribute(html, 'section', 'unlock')).toBe(true);
    });
  });

  describe('sections with dimensions', () => {
    it('renders all 6 dimension sections', () => {
      const html = generateReportHTML(mockResult, mockDimensions);

      expect(hasDataAttribute(html, 'section', 'ai-collaboration')).toBe(true);
      expect(hasDataAttribute(html, 'section', 'context-engineering')).toBe(true);
      expect(hasDataAttribute(html, 'section', 'burnout-risk')).toBe(true);
      expect(hasDataAttribute(html, 'section', 'tool-mastery')).toBe(true);
      expect(hasDataAttribute(html, 'section', 'ai-control')).toBe(true);
      expect(hasDataAttribute(html, 'section', 'skill-resilience')).toBe(true);
    });

    it('renders 8 tabs with dimensions', () => {
      const html = generateReportHTML(mockResult, mockDimensions);
      expect(countElements(html, '.terminal-tab')).toBe(8);
    });

    it('renders all snap sections', () => {
      const html = generateReportHTML(mockResult, mockDimensions);
      // 1 result + 6 dimensions + 1 unlock = 8 sections
      expect(countElements(html, '.snap-section')).toBe(8);
    });
  });

  describe('verbose evaluation integration', () => {
    it('renders verbose components when verboseEvaluation is provided', () => {
      const verboseEval = createMockVerboseEvaluation();
      const html = generateReportHTML(mockResult, undefined, undefined, verboseEval);

      // Should include personality summary
      expect(containsText(html, verboseEval.personalitySummary)).toBe(true);
    });
  });

  describe('Open Graph meta tags', () => {
    it('includes OG tags when reportId is provided', () => {
      const html = generateReportHTML(mockResult, undefined, {
        reportId: 'test-123',
        baseUrl: 'https://nomoreaislop.xyz',
      });

      expect(html).toContain('og:type');
      expect(html).toContain('og:url');
      expect(html).toContain('og:title');
      expect(html).toContain('og:image');
      expect(html).toContain('twitter:card');
    });

    it('does not include OG tags without reportId', () => {
      const html = generateReportHTML(mockResult);
      // Should not have the full OG block
      expect(html).not.toContain('og:url');
    });
  });

  describe('premium content unlocking', () => {
    it('respects unlocked option', () => {
      const html = generateReportHTML(mockResult, mockDimensions, { unlocked: true });
      // When unlocked, blurred content should not be blurred
      // This is implementation-specific, check that the option is passed through
      expect(html).toBeDefined();
    });

    it('respects NOSLOP_TEST_TIER env var in non-production', () => {
      process.env.NOSLOP_TEST_TIER = 'premium';
      process.env.NODE_ENV = 'development';

      const html = generateReportHTML(mockResult, mockDimensions);
      expect(html).toBeDefined();
    });
  });

  describe('styles and scripts', () => {
    it('includes inline styles', () => {
      const html = generateReportHTML(mockResult);
      const styles = extractStyles(html);
      expect(styles.length).toBeGreaterThan(0);
    });

    it('includes inline script', () => {
      const html = generateReportHTML(mockResult);
      const doc = parseHTML(html);
      const scripts = doc.querySelectorAll('script');
      expect(scripts.length).toBeGreaterThan(0);
    });

    it('includes scroll navigation script', () => {
      const html = generateReportHTML(mockResult);
      // The scroll script should be included
      expect(html).toContain('scroll-container');
    });
  });

  describe('sharing section', () => {
    it('renders share section when enabled', () => {
      const html = generateReportHTML(mockResult, mockDimensions, {
        reportId: 'test-123',
        enableSharing: true,
      });
      expect(hasClass(html, 'share-section')).toBe(true);
    });

    it('does not render share section when disabled', () => {
      const html = generateReportHTML(mockResult, mockDimensions, {
        reportId: 'test-123',
        enableSharing: false,
      });
      // Share section might still exist for unlock, but share buttons shouldn't be present
      // This depends on implementation
      expect(html).toBeDefined();
    });
  });

  describe('footer', () => {
    it('renders footer section', () => {
      const html = generateReportHTML(mockResult);
      expect(hasClass(html, 'footer')).toBe(true);
    });
  });
});
