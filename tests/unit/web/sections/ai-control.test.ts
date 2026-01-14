/**
 * Tests for AI Control Section Component
 */

import { describe, it, expect } from 'vitest';
import { renderAIControlSection } from '../../../../src/web/sections/ai-control.js';
import type { AIControlResult } from '../../../../src/analyzer/dimensions/index.js';
import { containsText, hasClass, countElements } from '../../../utils/html-helpers.js';

describe('renderAIControlSection', () => {
  const createMockData = (overrides: Partial<AIControlResult> = {}): AIControlResult => ({
    score: 72,
    level: 'ai-master',
    interpretation: 'You maintain strategic control over AI assistance.',
    breakdown: {
      verificationRate: 75,
      constraintSpecification: 70,
      outputCritique: 68,
      contextControl: 74,
    },
    signals: ['Verifies AI output before accepting', 'Provides clear constraints'],
    strengths: ['Strong verification habits', 'Clear constraint specification'],
    growthAreas: ['Could provide more critical feedback on AI suggestions'],
    ...overrides,
  });

  describe('section header', () => {
    it('renders section icon', () => {
      const html = renderAIControlSection(createMockData(), true);
      expect(containsText(html, '🎮')).toBe(true);
    });

    it('renders section title', () => {
      const html = renderAIControlSection(createMockData(), true);
      expect(containsText(html, 'AI Control Index')).toBe(true);
    });

    it('renders section subtitle', () => {
      const html = renderAIControlSection(createMockData(), true);
      expect(containsText(html, 'Do you control AI or does AI control you?')).toBe(true);
    });
  });

  describe('score display', () => {
    it('displays the correct score', () => {
      const html = renderAIControlSection(createMockData({ score: 85 }), true);
      expect(containsText(html, '85')).toBe(true);
    });

    it('displays score label', () => {
      const html = renderAIControlSection(createMockData(), true);
      expect(containsText(html, 'out of 100')).toBe(true);
    });

    it('displays correct level label for ai-master', () => {
      const html = renderAIControlSection(createMockData({ level: 'ai-master' }), true);
      expect(containsText(html, 'AI Master')).toBe(true);
    });

    it('displays correct level label for developing', () => {
      const html = renderAIControlSection(createMockData({ level: 'developing' }), true);
      expect(containsText(html, 'Developing Control')).toBe(true);
    });

    it('displays correct level label for vibe-coder', () => {
      const html = renderAIControlSection(createMockData({ level: 'vibe-coder' }), true);
      expect(containsText(html, 'Vibe Coder')).toBe(true);
    });
  });

  describe('metrics breakdown', () => {
    it('renders all four metric rows', () => {
      const html = renderAIControlSection(createMockData(), true);
      expect(countElements(html, '.metric-row')).toBe(4);
    });

    it('renders Verification Rate metric', () => {
      const html = renderAIControlSection(createMockData(), true);
      expect(containsText(html, 'Verification Rate')).toBe(true);
    });

    it('renders Constraint Specification metric', () => {
      const html = renderAIControlSection(createMockData(), true);
      expect(containsText(html, 'Constraint Specification')).toBe(true);
    });

    it('renders Output Critique metric', () => {
      const html = renderAIControlSection(createMockData(), true);
      expect(containsText(html, 'Output Critique')).toBe(true);
    });

    it('renders Context Control metric', () => {
      const html = renderAIControlSection(createMockData(), true);
      expect(containsText(html, 'Context Control')).toBe(true);
    });

    it('shows correct metric values', () => {
      const data = createMockData({
        breakdown: {
          verificationRate: 80,
          constraintSpecification: 65,
          outputCritique: 72,
          contextControl: 78,
        },
      });
      const html = renderAIControlSection(data, true);
      expect(containsText(html, '80')).toBe(true);
      expect(containsText(html, '65')).toBe(true);
      expect(containsText(html, '72')).toBe(true);
      expect(containsText(html, '78')).toBe(true);
    });
  });

  describe('signals section', () => {
    it('renders signals when present', () => {
      const html = renderAIControlSection(createMockData(), true);
      expect(containsText(html, 'Control Signals Detected')).toBe(true);
    });

    it('does not render signals section when empty', () => {
      const data = createMockData({ signals: [] });
      const html = renderAIControlSection(data, true);
      expect(containsText(html, 'Control Signals Detected')).toBe(false);
    });
  });

  describe('strengths section', () => {
    it('renders strengths when present', () => {
      const html = renderAIControlSection(createMockData(), true);
      expect(containsText(html, 'Your Strengths')).toBe(true);
    });

    it('does not render strengths section when empty', () => {
      const data = createMockData({ strengths: [] });
      const html = renderAIControlSection(data, true);
      expect(containsText(html, 'Your Strengths')).toBe(false);
    });
  });

  describe('growth areas section', () => {
    it('renders growth areas when present', () => {
      const html = renderAIControlSection(createMockData(), true);
      expect(containsText(html, 'Growth Areas')).toBe(true);
    });

    it('applies blur class when locked', () => {
      const html = renderAIControlSection(createMockData(), false);
      expect(hasClass(html, 'blurred-content')).toBe(true);
    });

    it('does not render growth areas section when empty', () => {
      const data = createMockData({ growthAreas: [] });
      const html = renderAIControlSection(data, true);
      expect(containsText(html, 'Growth Areas')).toBe(false);
    });
  });

  describe('unlock prompt', () => {
    it('shows unlock prompt when locked', () => {
      const html = renderAIControlSection(createMockData(), false);
      expect(containsText(html, 'Unlock detailed control analysis')).toBe(true);
    });

    it('hides unlock prompt when unlocked', () => {
      const html = renderAIControlSection(createMockData(), true);
      expect(containsText(html, 'Unlock detailed control analysis')).toBe(false);
    });
  });
});
