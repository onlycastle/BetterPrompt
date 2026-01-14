/**
 * Tests for Skill Resilience Section Component
 */

import { describe, it, expect } from 'vitest';
import { renderSkillResilienceSection } from '../../../../src/web/sections/skill-resilience.js';
import type { SkillResilienceResult } from '../../../../src/analyzer/dimensions/index.js';
import { containsText, hasClass, countElements } from '../../../utils/html-helpers.js';

describe('renderSkillResilienceSection', () => {
  const createMockData = (overrides: Partial<SkillResilienceResult> = {}): SkillResilienceResult => ({
    score: 65,
    level: 'developing',
    interpretation: 'Developing independent coding skills alongside AI assistance.',
    breakdown: {
      coldStartCapability: 70,
      hallucinationDetection: 60,
      explainabilityGap: 65,
    },
    warnings: [],
    recommendations: ['Practice reviewing AI code before accepting'],
    vpcMetrics: {
      m_csr: 0.70,
      m_ht: 0.60,
      e_gap: 0.35,
    },
    ...overrides,
  });

  describe('section header', () => {
    it('renders section icon', () => {
      const html = renderSkillResilienceSection(createMockData(), true);
      expect(containsText(html, '💪')).toBe(true);
    });

    it('renders section title', () => {
      const html = renderSkillResilienceSection(createMockData(), true);
      expect(containsText(html, 'Skill Resilience')).toBe(true);
    });

    it('renders section subtitle', () => {
      const html = renderSkillResilienceSection(createMockData(), true);
      expect(containsText(html, 'Can you code without AI assistance?')).toBe(true);
    });
  });

  describe('score display', () => {
    it('displays the correct score', () => {
      const html = renderSkillResilienceSection(createMockData({ score: 78 }), true);
      expect(containsText(html, '78')).toBe(true);
    });

    it('displays score label', () => {
      const html = renderSkillResilienceSection(createMockData(), true);
      expect(containsText(html, 'out of 100')).toBe(true);
    });

    it('displays correct level label for resilient', () => {
      const html = renderSkillResilienceSection(createMockData({ level: 'resilient' }), true);
      expect(containsText(html, 'Resilient Skills')).toBe(true);
    });

    it('displays correct level label for developing', () => {
      const html = renderSkillResilienceSection(createMockData({ level: 'developing' }), true);
      expect(containsText(html, 'Developing Resilience')).toBe(true);
    });

    it('displays correct level label for at-risk', () => {
      const html = renderSkillResilienceSection(createMockData({ level: 'at-risk' }), true);
      expect(containsText(html, 'At Risk')).toBe(true);
    });
  });

  describe('level descriptions', () => {
    it('shows resilient description', () => {
      const html = renderSkillResilienceSection(createMockData({ level: 'resilient' }), true);
      expect(containsText(html, 'You can code independently')).toBe(true);
    });

    it('shows developing description', () => {
      const html = renderSkillResilienceSection(createMockData({ level: 'developing' }), true);
      expect(containsText(html, 'Building independent coding skills')).toBe(true);
    });

    it('shows at-risk description', () => {
      const html = renderSkillResilienceSection(createMockData({ level: 'at-risk' }), true);
      expect(containsText(html, 'Skill atrophy risk detected')).toBe(true);
    });
  });

  describe('metrics breakdown', () => {
    it('renders all three metric rows', () => {
      const html = renderSkillResilienceSection(createMockData(), true);
      expect(countElements(html, '.metric-row')).toBe(3);
    });

    it('renders Cold Start Capability metric', () => {
      const html = renderSkillResilienceSection(createMockData(), true);
      expect(containsText(html, 'Cold Start Capability')).toBe(true);
    });

    it('renders Hallucination Detection metric', () => {
      const html = renderSkillResilienceSection(createMockData(), true);
      expect(containsText(html, 'Hallucination Detection')).toBe(true);
    });

    it('renders Code Understanding metric', () => {
      const html = renderSkillResilienceSection(createMockData(), true);
      expect(containsText(html, 'Code Understanding')).toBe(true);
    });

    it('shows correct metric values', () => {
      const data = createMockData({
        breakdown: {
          coldStartCapability: 75,
          hallucinationDetection: 55,
          explainabilityGap: 80,
        },
      });
      const html = renderSkillResilienceSection(data, true);
      expect(containsText(html, '75')).toBe(true);
      expect(containsText(html, '55')).toBe(true);
      expect(containsText(html, '80')).toBe(true);
    });
  });

  describe('VPC research metrics', () => {
    it('renders VPC metrics header', () => {
      const html = renderSkillResilienceSection(createMockData(), true);
      expect(containsText(html, 'VCP Research Metrics')).toBe(true);
    });

    it('displays M_CSR metric', () => {
      const html = renderSkillResilienceSection(createMockData(), true);
      expect(containsText(html, 'M_CSR')).toBe(true);
      expect(containsText(html, '0.70')).toBe(true);
    });

    it('displays M_HT metric', () => {
      const html = renderSkillResilienceSection(createMockData(), true);
      expect(containsText(html, 'M_HT')).toBe(true);
      expect(containsText(html, '0.60')).toBe(true);
    });

    it('displays E_gap metric', () => {
      const html = renderSkillResilienceSection(createMockData(), true);
      expect(containsText(html, 'E_gap')).toBe(true);
      expect(containsText(html, '0.35')).toBe(true);
    });

    it('includes VCP paper reference', () => {
      const html = renderSkillResilienceSection(createMockData(), true);
      expect(containsText(html, 'arXiv:2601.02410')).toBe(true);
    });
  });

  describe('warnings section', () => {
    it('renders warnings when present', () => {
      const data = createMockData({
        warnings: ['High AI dependency detected', 'Consider practicing without AI'],
      });
      const html = renderSkillResilienceSection(data, true);
      expect(containsText(html, 'Warnings')).toBe(true);
    });

    it('does not render warnings section when empty', () => {
      const data = createMockData({ warnings: [] });
      const html = renderSkillResilienceSection(data, true);
      expect(containsText(html, '⚠️ Warnings')).toBe(false);
    });
  });

  describe('recommendations section', () => {
    it('renders recommendations when present', () => {
      const html = renderSkillResilienceSection(createMockData(), true);
      expect(containsText(html, 'Recommendations')).toBe(true);
    });

    it('applies blur class when locked', () => {
      const html = renderSkillResilienceSection(createMockData(), false);
      expect(hasClass(html, 'blurred-content')).toBe(true);
    });

    it('does not render recommendations section when empty', () => {
      const data = createMockData({ recommendations: [] });
      const html = renderSkillResilienceSection(data, true);
      expect(containsText(html, '💡 Recommendations')).toBe(false);
    });
  });

  describe('unlock prompt', () => {
    it('shows unlock prompt when locked', () => {
      const html = renderSkillResilienceSection(createMockData(), false);
      expect(containsText(html, 'Unlock full skill analysis')).toBe(true);
    });

    it('hides unlock prompt when unlocked', () => {
      const html = renderSkillResilienceSection(createMockData(), true);
      expect(containsText(html, 'Unlock full skill analysis')).toBe(false);
    });
  });
});
