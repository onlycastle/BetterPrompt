/**
 * Tests for Tool Mastery Section Component
 */

import { describe, it, expect } from 'vitest';
import { renderToolMasterySection } from '../../../../src/web/sections/tool-mastery.js';
import type { ToolMasteryResult } from '../../../../src/analyzer/dimensions/index.js';
import { containsText, hasClass } from '../../../utils/html-helpers.js';

describe('renderToolMasterySection', () => {
  const createMockData = (overrides: Partial<ToolMasteryResult> = {}): ToolMasteryResult => ({
    overallScore: 82,
    toolUsage: {
      Read: { count: 45, percentage: 35, level: 'expert', assessment: 'Excellent exploration patterns' },
      Edit: { count: 25, percentage: 20, level: 'adept', assessment: 'Good targeted modifications' },
      Bash: { count: 20, percentage: 15, level: 'adept', assessment: 'Comfortable with shell commands' },
      Grep: { count: 15, percentage: 12, level: 'basic', assessment: 'Room to improve search patterns' },
      Task: { count: 10, percentage: 8, level: 'basic', assessment: 'Starting to use delegation' },
    },
    topTools: ['Read', 'Edit', 'Bash', 'Grep'],
    underutilizedTools: ['Task', 'TodoWrite'],
    tips: ['Try using Task tool for parallel work'],
    ...overrides,
  });

  describe('section header', () => {
    it('renders section icon', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(containsText(html, '🛠️')).toBe(true);
    });

    it('renders section title', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(containsText(html, 'Tool Mastery Profile')).toBe(true);
    });

    it('renders section subtitle', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(containsText(html, 'How effectively do you leverage')).toBe(true);
    });
  });

  describe('score display', () => {
    it('displays the correct overall score', () => {
      const html = renderToolMasterySection(createMockData({ overallScore: 90 }), true);
      expect(containsText(html, '90')).toBe(true);
    });

    it('displays score label', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(containsText(html, 'Overall Mastery Score')).toBe(true);
    });
  });

  describe('top tools section', () => {
    it('renders top tools header', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(containsText(html, 'Top Tools')).toBe(true);
    });

    it('displays Read tool', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(containsText(html, 'Read')).toBe(true);
    });

    it('displays Edit tool', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(containsText(html, 'Edit')).toBe(true);
    });

    it('displays Bash tool', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(containsText(html, 'Bash')).toBe(true);
    });

    it('shows tool percentages', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(containsText(html, '35%')).toBe(true);
      expect(containsText(html, '20%')).toBe(true);
    });

    it('has tool-grid class', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(hasClass(html, 'tool-grid')).toBe(true);
    });

    it('has tool-item class', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(hasClass(html, 'tool-item')).toBe(true);
    });
  });

  describe('underutilized tools section', () => {
    it('renders underutilized header when unlocked', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(containsText(html, 'Underutilized Tools')).toBe(true);
    });

    it('shows lock message when locked', () => {
      const html = renderToolMasterySection(createMockData(), false);
      expect(containsText(html, 'Unlock for tips')).toBe(true);
    });

    it('displays underutilized tools', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(containsText(html, 'Task')).toBe(true);
      expect(containsText(html, 'TodoWrite')).toBe(true);
    });

    it('shows "Underused" label', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(containsText(html, 'Underused')).toBe(true);
    });

    it('applies blur class when locked', () => {
      const html = renderToolMasterySection(createMockData(), false);
      expect(hasClass(html, 'blurred-content')).toBe(true);
    });
  });

  describe('unlock prompt', () => {
    it('shows unlock prompt when locked', () => {
      const html = renderToolMasterySection(createMockData(), false);
      expect(containsText(html, 'Unlock full tool analysis')).toBe(true);
    });

    it('hides unlock prompt when unlocked', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(containsText(html, 'Unlock full tool analysis')).toBe(false);
    });
  });

  describe('tool level display', () => {
    it('includes tool-level class for styling', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(hasClass(html, 'tool-level')).toBe(true);
    });

    it('applies expert level class', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(html).toContain('tool-level expert');
    });

    it('applies adept level class', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(html).toContain('tool-level adept');
    });

    it('applies basic level class', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(html).toContain('tool-level basic');
    });

    it('applies novice level class for underutilized tools', () => {
      const html = renderToolMasterySection(createMockData(), true);
      expect(html).toContain('tool-level novice');
    });
  });

  describe('edge cases', () => {
    it('handles empty top tools gracefully', () => {
      const data = createMockData({ topTools: [] });
      const html = renderToolMasterySection(data, true);
      expect(html).toBeDefined();
      expect(containsText(html, 'Top Tools')).toBe(true);
    });

    it('handles empty underutilized tools gracefully', () => {
      const data = createMockData({ underutilizedTools: [] });
      const html = renderToolMasterySection(data, true);
      expect(html).toBeDefined();
    });

    it('handles missing tool data gracefully', () => {
      const data = createMockData({
        topTools: ['Read', 'NonexistentTool'],
        toolUsage: {
          Read: { count: 10, percentage: 50, level: 'expert', assessment: 'Good' },
        },
      });
      const html = renderToolMasterySection(data, true);
      expect(html).toBeDefined();
      expect(containsText(html, 'Read')).toBe(true);
    });
  });
});
