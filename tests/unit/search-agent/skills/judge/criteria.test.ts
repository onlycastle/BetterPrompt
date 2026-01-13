import { describe, it, expect } from 'vitest';
import {
  RELEVANCE_CRITERIA,
  formatCriteriaForPrompt,
  type RelevanceCriterion,
} from '../../../../../src/search-agent/skills/judge/criteria.js';

describe('Relevance Criteria', () => {
  describe('RELEVANCE_CRITERIA', () => {
    it('should have all required criteria', () => {
      const requiredNames = [
        'topicRelevance',
        'projectFit',
        'actionability',
        'novelty',
        'credibility',
      ];

      const criteriaNames = RELEVANCE_CRITERIA.map((c) => c.name);

      for (const name of requiredNames) {
        expect(criteriaNames).toContain(name);
      }
    });

    it('should have weights that sum to 1', () => {
      const totalWeight = RELEVANCE_CRITERIA.reduce((sum, c) => sum + c.weight, 0);
      expect(totalWeight).toBeCloseTo(1, 2);
    });

    it('should have valid weight values for each criterion', () => {
      for (const criterion of RELEVANCE_CRITERIA) {
        expect(criterion.weight).toBeGreaterThan(0);
        expect(criterion.weight).toBeLessThanOrEqual(1);
      }
    });

    it('should have non-empty arrays for signals', () => {
      for (const criterion of RELEVANCE_CRITERIA) {
        expect(criterion.positiveSignals.length).toBeGreaterThan(0);
        expect(criterion.negativeSignals.length).toBeGreaterThan(0);
      }
    });

    it('should have descriptions for all criteria', () => {
      for (const criterion of RELEVANCE_CRITERIA) {
        expect(criterion.description).toBeDefined();
        expect(criterion.description.length).toBeGreaterThan(10);
      }
    });

    describe('topicRelevance criterion', () => {
      it('should have highest weight (0.25)', () => {
        const topicRelevance = RELEVANCE_CRITERIA.find((c) => c.name === 'topicRelevance');
        expect(topicRelevance?.weight).toBe(0.25);
      });

      it('should include AI engineering signals', () => {
        const topicRelevance = RELEVANCE_CRITERIA.find((c) => c.name === 'topicRelevance');
        const signals = topicRelevance?.positiveSignals.join(' ').toLowerCase() || '';

        expect(signals).toContain('context engineering');
        expect(signals).toContain('claude');
        expect(signals).toContain('ai');
      });
    });

    describe('projectFit criterion', () => {
      it('should focus on NoMoreAISlop goals', () => {
        const projectFit = RELEVANCE_CRITERIA.find((c) => c.name === 'projectFit');
        const signals = projectFit?.positiveSignals.join(' ').toLowerCase() || '';

        expect(signals).toContain('planning');
        expect(signals).toContain('critical thinking');
      });

      it('should have negative signals for inappropriate content', () => {
        const projectFit = RELEVANCE_CRITERIA.find((c) => c.name === 'projectFit');
        const negativeSignals = projectFit?.negativeSignals || [];

        expect(negativeSignals.some((s) => s.toLowerCase().includes('theoretical'))).toBe(true);
      });
    });

    describe('actionability criterion', () => {
      it('should value practical guidance', () => {
        const actionability = RELEVANCE_CRITERIA.find((c) => c.name === 'actionability');
        const signals = actionability?.positiveSignals.join(' ').toLowerCase() || '';

        expect(signals).toContain('example');
        expect(signals).toContain('step-by-step');
      });

      it('should have lower weight than topicRelevance', () => {
        const actionability = RELEVANCE_CRITERIA.find((c) => c.name === 'actionability');
        const topicRelevance = RELEVANCE_CRITERIA.find((c) => c.name === 'topicRelevance');

        expect(actionability?.weight).toBeLessThan(topicRelevance?.weight || 1);
      });
    });

    describe('novelty criterion', () => {
      it('should have lower weight (0.15)', () => {
        const novelty = RELEVANCE_CRITERIA.find((c) => c.name === 'novelty');
        expect(novelty?.weight).toBe(0.15);
      });

      it('should penalize repetitive content', () => {
        const novelty = RELEVANCE_CRITERIA.find((c) => c.name === 'novelty');
        const negativeSignals = novelty?.negativeSignals.join(' ').toLowerCase() || '';

        expect(negativeSignals).toContain('repeat');
      });
    });

    describe('credibility criterion', () => {
      it('should value expert sources', () => {
        const credibility = RELEVANCE_CRITERIA.find((c) => c.name === 'credibility');
        const signals = credibility?.positiveSignals.join(' ').toLowerCase() || '';

        expect(signals).toContain('expert');
        expect(signals).toContain('anthropic');
      });

      it('should penalize unreliable sources', () => {
        const credibility = RELEVANCE_CRITERIA.find((c) => c.name === 'credibility');
        const negativeSignals = credibility?.negativeSignals.join(' ').toLowerCase() || '';

        expect(negativeSignals).toContain('anonymous');
        expect(negativeSignals).toContain('error');
      });
    });
  });

  describe('formatCriteriaForPrompt', () => {
    it('should return a non-empty string', () => {
      const result = formatCriteriaForPrompt();
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(100);
    });

    it('should include all criterion names', () => {
      const result = formatCriteriaForPrompt();

      for (const criterion of RELEVANCE_CRITERIA) {
        expect(result).toContain(criterion.name);
      }
    });

    it('should include weights in the output', () => {
      const result = formatCriteriaForPrompt();

      for (const criterion of RELEVANCE_CRITERIA) {
        expect(result).toContain(`weight: ${criterion.weight}`);
      }
    });

    it('should format positive and negative signals', () => {
      const result = formatCriteriaForPrompt();

      expect(result).toContain('**Positive signals:**');
      expect(result).toContain('**Negative signals:**');
    });

    it('should use markdown headers', () => {
      const result = formatCriteriaForPrompt();

      expect(result).toContain('###');
    });

    it('should include bullet points for signals', () => {
      const result = formatCriteriaForPrompt();

      // Check that signals are formatted as list items
      expect(result).toContain('- ');
    });

    it('should include descriptions', () => {
      const result = formatCriteriaForPrompt();

      for (const criterion of RELEVANCE_CRITERIA) {
        expect(result).toContain(criterion.description);
      }
    });
  });
});
