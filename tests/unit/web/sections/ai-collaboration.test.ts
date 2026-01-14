/**
 * Tests for AI Collaboration Section Component
 */

import { describe, it, expect } from 'vitest';
import { renderAICollaborationSection } from '../../../../src/web/sections/ai-collaboration.js';
import type { AICollaborationResult } from '../../../../src/analyzer/dimensions/index.js';
import { parseHTML, containsText, hasClass, countElements } from '../../../utils/html-helpers.js';

describe('renderAICollaborationSection', () => {
  const createMockData = (overrides: Partial<AICollaborationResult> = {}): AICollaborationResult => ({
    score: 75,
    level: 'proficient',
    interpretation: 'You demonstrate strong AI collaboration skills.',
    breakdown: {
      structuredPlanning: { score: 80, signals: ['Uses task breakdown'] },
      aiOrchestration: { score: 70, signals: ['Uses Task tool'] },
      criticalVerification: { score: 75, signals: ['Reviews output'] },
    },
    strengths: ['Excellent task breakdown', 'Strong context provision'],
    growthAreas: ['Could use more multi-agent patterns'],
    ...overrides,
  });

  describe('section header', () => {
    it('renders section icon', () => {
      const html = renderAICollaborationSection(createMockData(), true);
      expect(containsText(html, '🤝')).toBe(true);
    });

    it('renders section title', () => {
      const html = renderAICollaborationSection(createMockData(), true);
      expect(containsText(html, 'AI Collaboration Mastery')).toBe(true);
    });

    it('renders section subtitle', () => {
      const html = renderAICollaborationSection(createMockData(), true);
      expect(containsText(html, 'How effectively do you collaborate with AI?')).toBe(true);
    });
  });

  describe('score display', () => {
    it('displays the correct score', () => {
      const html = renderAICollaborationSection(createMockData({ score: 82 }), true);
      expect(containsText(html, '82')).toBe(true);
    });

    it('displays score label', () => {
      const html = renderAICollaborationSection(createMockData(), true);
      expect(containsText(html, 'out of 100')).toBe(true);
    });

    it('displays correct level label for expert', () => {
      const html = renderAICollaborationSection(createMockData({ level: 'expert' }), true);
      expect(containsText(html, 'Expert Collaborator')).toBe(true);
    });

    it('displays correct level label for proficient', () => {
      const html = renderAICollaborationSection(createMockData({ level: 'proficient' }), true);
      expect(containsText(html, 'Proficient User')).toBe(true);
    });

    it('displays correct level label for developing', () => {
      const html = renderAICollaborationSection(createMockData({ level: 'developing' }), true);
      expect(containsText(html, 'Developing Skills')).toBe(true);
    });

    it('displays correct level label for novice', () => {
      const html = renderAICollaborationSection(createMockData({ level: 'novice' }), true);
      expect(containsText(html, 'Getting Started')).toBe(true);
    });
  });

  describe('interpretation', () => {
    it('renders interpretation text', () => {
      const interpretation = 'You demonstrate exceptional collaboration patterns.';
      const html = renderAICollaborationSection(createMockData({ interpretation }), true);
      expect(containsText(html, interpretation)).toBe(true);
    });
  });

  describe('metrics breakdown', () => {
    it('renders all three metric rows', () => {
      const html = renderAICollaborationSection(createMockData(), true);
      expect(countElements(html, '.metric-row')).toBe(3);
    });

    it('renders Structured Planning metric', () => {
      const html = renderAICollaborationSection(createMockData(), true);
      expect(containsText(html, 'Structured Planning')).toBe(true);
    });

    it('renders AI Orchestration metric', () => {
      const html = renderAICollaborationSection(createMockData(), true);
      expect(containsText(html, 'AI Orchestration')).toBe(true);
    });

    it('renders Critical Verification metric', () => {
      const html = renderAICollaborationSection(createMockData(), true);
      expect(containsText(html, 'Critical Verification')).toBe(true);
    });

    it('shows correct metric values', () => {
      const data = createMockData({
        breakdown: {
          structuredPlanning: { score: 85, signals: [] },
          aiOrchestration: { score: 72, signals: [] },
          criticalVerification: { score: 68, signals: [] },
        },
      });
      const html = renderAICollaborationSection(data, true);
      expect(containsText(html, '85')).toBe(true);
      expect(containsText(html, '72')).toBe(true);
      expect(containsText(html, '68')).toBe(true);
    });

    it('applies correct bar width styles', () => {
      const data = createMockData({
        breakdown: {
          structuredPlanning: { score: 80, signals: [] },
          aiOrchestration: { score: 70, signals: [] },
          criticalVerification: { score: 60, signals: [] },
        },
      });
      const html = renderAICollaborationSection(data, true);
      expect(html).toContain('width: 80%');
      expect(html).toContain('width: 70%');
      expect(html).toContain('width: 60%');
    });
  });

  describe('strengths section', () => {
    it('renders strengths when present', () => {
      const html = renderAICollaborationSection(createMockData(), true);
      expect(containsText(html, 'Your Strengths')).toBe(true);
    });

    it('renders all strength items', () => {
      const data = createMockData({
        strengths: ['First strength', 'Second strength', 'Third strength'],
      });
      const html = renderAICollaborationSection(data, true);
      expect(containsText(html, 'First strength')).toBe(true);
      expect(containsText(html, 'Second strength')).toBe(true);
      expect(containsText(html, 'Third strength')).toBe(true);
    });

    it('does not render strengths section when empty', () => {
      const data = createMockData({ strengths: [] });
      const html = renderAICollaborationSection(data, true);
      expect(containsText(html, 'Your Strengths')).toBe(false);
    });
  });

  describe('growth areas section', () => {
    it('renders growth areas when present', () => {
      const html = renderAICollaborationSection(createMockData(), true);
      expect(containsText(html, 'Growth Areas')).toBe(true);
    });

    it('applies blur class when locked', () => {
      const html = renderAICollaborationSection(createMockData(), false);
      expect(hasClass(html, 'blurred-content')).toBe(true);
    });

    it('does not apply blur class when unlocked', () => {
      const html = renderAICollaborationSection(createMockData(), true);
      const doc = parseHTML(`<div>${html}</div>`);
      const growthTitle = doc.querySelector('.subsection-title:last-of-type');
      // When unlocked, the blur class should not be present
      expect(growthTitle?.classList.contains('blurred-content')).toBe(false);
    });

    it('does not render growth areas section when empty', () => {
      const data = createMockData({ growthAreas: [] });
      const html = renderAICollaborationSection(data, true);
      expect(containsText(html, 'Growth Areas')).toBe(false);
    });
  });

  describe('unlock prompt', () => {
    it('shows unlock prompt when locked', () => {
      const html = renderAICollaborationSection(createMockData(), false);
      expect(containsText(html, 'Unlock detailed breakdown')).toBe(true);
    });

    it('hides unlock prompt when unlocked', () => {
      const html = renderAICollaborationSection(createMockData(), true);
      expect(containsText(html, 'Unlock detailed breakdown')).toBe(false);
    });
  });

  describe('color coding', () => {
    it('applies green color for high structured planning score', () => {
      const data = createMockData({
        breakdown: {
          structuredPlanning: { score: 75, signals: [] },
          aiOrchestration: { score: 50, signals: [] },
          criticalVerification: { score: 50, signals: [] },
        },
      });
      const html = renderAICollaborationSection(data, true);
      // Score >= 60 should get green
      expect(html).toContain('metric-fill green');
    });

    it('applies cyan color for low structured planning score', () => {
      const data = createMockData({
        breakdown: {
          structuredPlanning: { score: 45, signals: [] },
          aiOrchestration: { score: 50, signals: [] },
          criticalVerification: { score: 50, signals: [] },
        },
      });
      const html = renderAICollaborationSection(data, true);
      // Score < 60 should get cyan
      expect(html).toContain('metric-fill cyan');
    });
  });
});
