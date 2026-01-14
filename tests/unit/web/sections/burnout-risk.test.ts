/**
 * Tests for Burnout Risk Section Component
 */

import { describe, it, expect } from 'vitest';
import { renderBurnoutRiskSection } from '../../../../src/web/sections/burnout-risk.js';
import type { BurnoutRiskResult } from '../../../../src/analyzer/dimensions/index.js';
import { parseHTML, containsText, hasClass } from '../../../utils/html-helpers.js';

describe('renderBurnoutRiskSection', () => {
  const createMockData = (overrides: Partial<BurnoutRiskResult> = {}): BurnoutRiskResult => ({
    score: 35,
    level: 'low',
    recommendations: ['Keep up the healthy work patterns!'],
    breakdown: {
      afterHoursRate: 15,
      weekendRate: 8,
      lateNightCount: 2,
    },
    ...overrides,
  });

  describe('section header', () => {
    it('renders section icon', () => {
      const html = renderBurnoutRiskSection(createMockData(), true);
      expect(containsText(html, '🔥')).toBe(true);
    });

    it('renders section title', () => {
      const html = renderBurnoutRiskSection(createMockData(), true);
      expect(containsText(html, 'Burnout Risk Analysis')).toBe(true);
    });

    it('renders section subtitle', () => {
      const html = renderBurnoutRiskSection(createMockData(), true);
      expect(containsText(html, 'Work-life balance insights')).toBe(true);
    });
  });

  describe('score display when unlocked', () => {
    it('displays the correct score when unlocked', () => {
      const html = renderBurnoutRiskSection(createMockData({ score: 42 }), true);
      expect(containsText(html, '42')).toBe(true);
    });

    it('displays correct level label for low risk', () => {
      const html = renderBurnoutRiskSection(createMockData({ level: 'low' }), true);
      expect(containsText(html, 'Low Risk')).toBe(true);
    });

    it('displays correct level label for moderate risk', () => {
      const html = renderBurnoutRiskSection(createMockData({ level: 'moderate' }), true);
      expect(containsText(html, 'Moderate Risk')).toBe(true);
    });

    it('displays correct level label for elevated risk', () => {
      const html = renderBurnoutRiskSection(createMockData({ level: 'elevated' }), true);
      expect(containsText(html, 'Elevated Risk')).toBe(true);
    });

    it('displays correct level label for high risk', () => {
      const html = renderBurnoutRiskSection(createMockData({ level: 'high' }), true);
      expect(containsText(html, 'High Risk')).toBe(true);
    });
  });

  describe('score display when locked', () => {
    it('shows ?? instead of score when locked', () => {
      const html = renderBurnoutRiskSection(createMockData({ score: 65 }), false);
      // Should NOT contain the actual score
      expect(html).toContain('??');
      expect(containsText(html, '65')).toBe(false);
    });

    it('shows ??? instead of level when locked', () => {
      const html = renderBurnoutRiskSection(createMockData(), false);
      expect(html).toContain('???');
    });

    it('applies blur class when locked', () => {
      const html = renderBurnoutRiskSection(createMockData(), false);
      expect(hasClass(html, 'blurred-locked')).toBe(true);
    });
  });

  describe('metrics breakdown', () => {
    it('renders after-hours rate metric', () => {
      const html = renderBurnoutRiskSection(createMockData(), true);
      expect(containsText(html, 'After-hours rate')).toBe(true);
    });

    it('renders weekend rate metric', () => {
      const html = renderBurnoutRiskSection(createMockData(), true);
      expect(containsText(html, 'Weekend rate')).toBe(true);
    });

    it('renders late night count metric', () => {
      const html = renderBurnoutRiskSection(createMockData(), true);
      expect(containsText(html, 'Late night count')).toBe(true);
    });

    it('shows correct metric values when unlocked', () => {
      const data = createMockData({
        breakdown: {
          afterHoursRate: 25,
          weekendRate: 12,
          lateNightCount: 5,
        },
      });
      const html = renderBurnoutRiskSection(data, true);
      expect(containsText(html, '25%')).toBe(true);
      expect(containsText(html, '12%')).toBe(true);
      expect(containsText(html, '5')).toBe(true);
    });

    it('shows ?? values when locked', () => {
      const html = renderBurnoutRiskSection(createMockData(), false);
      expect(html).toContain('??%');
    });
  });

  describe('bar widths', () => {
    it('sets correct width for after-hours rate', () => {
      const data = createMockData({
        breakdown: { afterHoursRate: 45, weekendRate: 20, lateNightCount: 3 },
      });
      const html = renderBurnoutRiskSection(data, true);
      expect(html).toContain('width: 45%');
    });

    it('caps width at 100% for high rates', () => {
      const data = createMockData({
        breakdown: { afterHoursRate: 150, weekendRate: 20, lateNightCount: 3 },
      });
      const html = renderBurnoutRiskSection(data, true);
      expect(html).toContain('width: 100%');
    });

    it('sets width to 0 when locked', () => {
      const html = renderBurnoutRiskSection(createMockData(), false);
      expect(html).toContain('width: 0%');
    });
  });

  describe('late night message', () => {
    it('displays late night session count', () => {
      const data = createMockData({
        breakdown: { afterHoursRate: 10, weekendRate: 5, lateNightCount: 7 },
      });
      const html = renderBurnoutRiskSection(data, true);
      expect(containsText(html, '7')).toBe(true);
      expect(containsText(html, 'late-night sessions')).toBe(true);
    });
  });

  describe('interpretation', () => {
    it('shows first recommendation as interpretation when unlocked', () => {
      const data = createMockData({
        recommendations: ['Take more breaks during work sessions'],
      });
      const html = renderBurnoutRiskSection(data, true);
      expect(containsText(html, 'Take more breaks during work sessions')).toBe(true);
    });

    it('shows generic message when no recommendations', () => {
      const data = createMockData({ recommendations: [] });
      const html = renderBurnoutRiskSection(data, true);
      expect(containsText(html, 'Based on your session patterns')).toBe(true);
    });
  });

  describe('unlock prompt', () => {
    it('shows unlock prompt when locked', () => {
      const html = renderBurnoutRiskSection(createMockData(), false);
      expect(containsText(html, 'Unlock full time analysis')).toBe(true);
    });

    it('hides unlock prompt when unlocked', () => {
      const html = renderBurnoutRiskSection(createMockData(), true);
      expect(containsText(html, 'Unlock full time analysis')).toBe(false);
    });
  });

  describe('color coding', () => {
    it('uses yellow color for after-hours metric', () => {
      const html = renderBurnoutRiskSection(createMockData(), true);
      expect(html).toContain('metric-fill yellow');
    });

    it('uses red color for weekend metric', () => {
      const html = renderBurnoutRiskSection(createMockData(), true);
      expect(html).toContain('metric-fill red');
    });
  });
});
