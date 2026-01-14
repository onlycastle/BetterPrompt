/**
 * Tests for Context Engineering Section Component
 */

import { describe, it, expect } from 'vitest';
import { renderContextEngineeringSection } from '../../../../src/web/sections/context-engineering.js';
import type { ContextEngineeringResult } from '../../../../src/analyzer/dimensions/index.js';
import { containsText, hasClass, countElements } from '../../../utils/html-helpers.js';

describe('renderContextEngineeringSection', () => {
  const createMockData = (overrides: Partial<ContextEngineeringResult> = {}): ContextEngineeringResult => ({
    score: 68,
    level: 'developing',
    interpretation: 'Developing context engineering skills. Good file references, room to improve compression.',
    breakdown: {
      write: {
        score: 70,
        fileReferences: 15,
        codeElementReferences: 8,
        constraintsMentioned: 3,
        patternReferences: 2,
      },
      select: {
        score: 65,
        specificity: 60,
        codebaseNavigation: 5,
        existingPatternUsage: 4,
      },
      compress: {
        score: 60,
        compactUsageCount: 2,
        iterationEfficiency: 70,
        avgTurnsPerSession: 8.5,
      },
      isolate: {
        score: 75,
        taskToolUsage: 4,
        multiAgentDelegation: 2,
        focusedPrompts: 6,
      },
    },
    bestExample: {
      content: 'Please check src/utils/parser.ts:45-60 for the existing validation logic...',
      score: 85,
      reasons: ['Specific file reference', 'Line number precision'],
    },
    worstExample: null,
    tips: ['Try providing line numbers with file references'],
    ...overrides,
  });

  describe('section header', () => {
    it('renders section icon', () => {
      const html = renderContextEngineeringSection(createMockData(), true);
      expect(containsText(html, '🧠')).toBe(true);
    });

    it('renders section title', () => {
      const html = renderContextEngineeringSection(createMockData(), true);
      expect(containsText(html, 'Context Engineering')).toBe(true);
    });

    it('renders section subtitle', () => {
      const html = renderContextEngineeringSection(createMockData(), true);
      expect(containsText(html, 'How effectively do you manage AI context?')).toBe(true);
    });
  });

  describe('score display', () => {
    it('displays the correct score', () => {
      const html = renderContextEngineeringSection(createMockData({ score: 75 }), true);
      expect(containsText(html, '75')).toBe(true);
    });

    it('displays score label', () => {
      const html = renderContextEngineeringSection(createMockData(), true);
      expect(containsText(html, 'out of 100')).toBe(true);
    });

    it('displays correct level label for expert', () => {
      const html = renderContextEngineeringSection(createMockData({ level: 'expert' }), true);
      expect(containsText(html, 'Context Master')).toBe(true);
    });

    it('displays correct level label for proficient', () => {
      const html = renderContextEngineeringSection(createMockData({ level: 'proficient' }), true);
      expect(containsText(html, 'Proficient')).toBe(true);
    });

    it('displays correct level label for developing', () => {
      const html = renderContextEngineeringSection(createMockData({ level: 'developing' }), true);
      expect(containsText(html, 'Developing')).toBe(true);
    });

    it('displays correct level label for novice', () => {
      const html = renderContextEngineeringSection(createMockData({ level: 'novice' }), true);
      expect(containsText(html, 'Getting Started')).toBe(true);
    });
  });

  describe('metrics breakdown', () => {
    it('renders all four metric rows', () => {
      const html = renderContextEngineeringSection(createMockData(), true);
      expect(countElements(html, '.metric-row')).toBe(4);
    });

    it('renders WRITE metric', () => {
      const html = renderContextEngineeringSection(createMockData(), true);
      expect(containsText(html, 'WRITE (Preserve)')).toBe(true);
    });

    it('renders SELECT metric', () => {
      const html = renderContextEngineeringSection(createMockData(), true);
      expect(containsText(html, 'SELECT (Retrieve)')).toBe(true);
    });

    it('renders COMPRESS metric', () => {
      const html = renderContextEngineeringSection(createMockData(), true);
      expect(containsText(html, 'COMPRESS (Reduce)')).toBe(true);
    });

    it('renders ISOLATE metric', () => {
      const html = renderContextEngineeringSection(createMockData(), true);
      expect(containsText(html, 'ISOLATE (Partition)')).toBe(true);
    });
  });

  describe('key metrics section', () => {
    it('renders key metrics header', () => {
      const html = renderContextEngineeringSection(createMockData(), true);
      expect(containsText(html, 'Key Metrics')).toBe(true);
    });

    it('displays file references count', () => {
      const html = renderContextEngineeringSection(createMockData(), true);
      expect(containsText(html, '15')).toBe(true);
      expect(containsText(html, 'File References')).toBe(true);
    });

    it('displays compact uses count', () => {
      const html = renderContextEngineeringSection(createMockData(), true);
      expect(containsText(html, '/compact Uses')).toBe(true);
    });

    it('displays task delegations count', () => {
      const html = renderContextEngineeringSection(createMockData(), true);
      expect(containsText(html, 'Task Delegations')).toBe(true);
    });

    it('displays avg turns per session', () => {
      const html = renderContextEngineeringSection(createMockData(), true);
      expect(containsText(html, 'Avg Turns/Session')).toBe(true);
      expect(containsText(html, '8.5')).toBe(true);
    });
  });

  describe('tips section', () => {
    it('renders tips when present', () => {
      const html = renderContextEngineeringSection(createMockData(), true);
      expect(containsText(html, 'Tips')).toBe(true);
    });

    it('applies blur class when locked', () => {
      const html = renderContextEngineeringSection(createMockData(), false);
      expect(hasClass(html, 'blurred-content')).toBe(true);
    });

    it('does not render tips section when empty', () => {
      const data = createMockData({ tips: [] });
      const html = renderContextEngineeringSection(data, true);
      expect(containsText(html, '💡 Tips')).toBe(false);
    });
  });

  describe('unlock prompt', () => {
    it('shows unlock prompt when locked', () => {
      const html = renderContextEngineeringSection(createMockData(), false);
      expect(containsText(html, 'Unlock best/worst examples')).toBe(true);
    });

    it('hides unlock prompt when unlocked', () => {
      const html = renderContextEngineeringSection(createMockData(), true);
      expect(containsText(html, 'Unlock best/worst examples')).toBe(false);
    });
  });
});
