/**
 * Tests for Footer Component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderFooter } from '../../../../src/web/sections/footer.js';
import { parseHTML, containsText, hasClass } from '../../../utils/html-helpers.js';

describe('renderFooter', () => {
  describe('structure', () => {
    it('renders footer element with correct class', () => {
      const html = renderFooter();
      expect(hasClass(html, 'footer')).toBe(true);
    });

    it('renders footer tag', () => {
      const html = renderFooter();
      expect(html).toContain('<footer');
      expect(html).toContain('</footer>');
    });
  });

  describe('date display', () => {
    it('includes "Analysis generated on" text', () => {
      const html = renderFooter();
      expect(containsText(html, 'Analysis generated on')).toBe(true);
    });

    it('includes year in date', () => {
      const html = renderFooter();
      const currentYear = new Date().getFullYear().toString();
      expect(containsText(html, currentYear)).toBe(true);
    });

    it('formats date in US locale', () => {
      // Mock a specific date to test formatting
      const mockDate = new Date('2024-06-15');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const html = renderFooter();
      expect(containsText(html, 'June')).toBe(true);
      expect(containsText(html, '15')).toBe(true);
      expect(containsText(html, '2024')).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('branding', () => {
    it('includes NoMoreAISlop link', () => {
      const html = renderFooter();
      expect(html).toContain('href="https://nomoreaislop.dev"');
    });

    it('includes branding text', () => {
      const html = renderFooter();
      expect(containsText(html, 'NoMoreAISlop')).toBe(true);
    });

    it('includes heart emoji', () => {
      const html = renderFooter();
      expect(containsText(html, '💜')).toBe(true);
    });

    it('includes "Built with" text', () => {
      const html = renderFooter();
      expect(containsText(html, 'Built with')).toBe(true);
    });
  });

  describe('HTML structure', () => {
    it('renders two paragraphs', () => {
      const html = renderFooter();
      const doc = parseHTML(`<div>${html}</div>`);
      const paragraphs = doc.querySelectorAll('footer p');
      expect(paragraphs.length).toBe(2);
    });

    it('has link in second paragraph', () => {
      const html = renderFooter();
      const doc = parseHTML(`<div>${html}</div>`);
      const link = doc.querySelector('footer a');
      expect(link).toBeTruthy();
      expect(link?.getAttribute('href')).toBe('https://nomoreaislop.dev');
    });
  });
});
