/**
 * Tests for Main Result Section Component
 */

import { describe, it, expect } from 'vitest';
import { renderMainResultSection } from '../../../../src/web/sections/main-result.js';
import { TYPE_METADATA, type CodingStyleType } from '../../../../src/web/types.js';
import { createMockTypeResult } from '../../../utils/helpers.js';
import { parseHTML, containsText, hasClass, countElements } from '../../../utils/html-helpers.js';

describe('renderMainResultSection', () => {
  const mockResult = createMockTypeResult();
  const meta = TYPE_METADATA.architect;

  describe('result box rendering', () => {
    it('renders the result box container', () => {
      const html = renderMainResultSection(mockResult, meta);
      expect(hasClass(html, 'result-box')).toBe(true);
    });

    it('displays the correct emoji', () => {
      const html = renderMainResultSection(mockResult, meta);
      expect(containsText(html, meta.emoji)).toBe(true);
    });

    it('displays the type name in uppercase', () => {
      const html = renderMainResultSection(mockResult, meta);
      expect(containsText(html, meta.name.toUpperCase())).toBe(true);
    });

    it('displays the tagline', () => {
      const html = renderMainResultSection(mockResult, meta);
      expect(containsText(html, meta.tagline)).toBe(true);
    });
  });

  describe('distribution chart', () => {
    it('renders distribution container', () => {
      const html = renderMainResultSection(mockResult, meta);
      expect(hasClass(html, 'distribution')).toBe(true);
    });

    it('renders 5 distribution rows for all types', () => {
      const html = renderMainResultSection(mockResult, meta);
      expect(countElements(html, '.distribution-row')).toBe(5);
    });

    it('marks primary type row correctly', () => {
      const html = renderMainResultSection(mockResult, meta);
      expect(hasClass(html, 'primary')).toBe(true);
    });

    it('shows correct percentage for each type', () => {
      const html = renderMainResultSection(mockResult, meta);

      // Check that architect (primary) shows 45%
      expect(containsText(html, '45%')).toBe(true);
      expect(containsText(html, '25%')).toBe(true);
      expect(containsText(html, '15%')).toBe(true);
      expect(containsText(html, '10%')).toBe(true);
      expect(containsText(html, '5%')).toBe(true);
    });

    it('shows primary indicator on primary type', () => {
      const html = renderMainResultSection(mockResult, meta);
      // The primary type row should have the ◀ marker
      expect(containsText(html, '◀')).toBe(true);
    });
  });

  describe('different primary types', () => {
    const types: CodingStyleType[] = ['architect', 'scientist', 'collaborator', 'speedrunner', 'craftsman'];

    types.forEach((type) => {
      it(`renders correctly for ${type} type`, () => {
        const result = createMockTypeResult({
          primaryType: type,
          distribution: {
            architect: type === 'architect' ? 50 : 12,
            scientist: type === 'scientist' ? 50 : 12,
            collaborator: type === 'collaborator' ? 50 : 12,
            speedrunner: type === 'speedrunner' ? 50 : 13,
            craftsman: type === 'craftsman' ? 50 : 13,
          },
        });
        const typeMeta = TYPE_METADATA[type];
        const html = renderMainResultSection(result, typeMeta);

        expect(containsText(html, typeMeta.emoji)).toBe(true);
        expect(containsText(html, typeMeta.name.toUpperCase())).toBe(true);
        expect(hasClass(html, 'result-box')).toBe(true);
      });
    });
  });

  describe('HTML structure', () => {
    it('has correct class hierarchy', () => {
      const html = renderMainResultSection(mockResult, meta);
      const doc = parseHTML(`<div>${html}</div>`);

      expect(doc.querySelector('.result-box .result-emoji')).toBeTruthy();
      expect(doc.querySelector('.result-box .result-title')).toBeTruthy();
      expect(doc.querySelector('.result-box .result-tagline')).toBeTruthy();
    });

    it('distribution bar has proper width styling', () => {
      const html = renderMainResultSection(mockResult, meta);
      // Check that width percentages are set in style
      expect(html).toContain('width: 45%');
      expect(html).toContain('width: 25%');
    });
  });
});
