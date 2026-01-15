/**
 * ContentGateway Tests
 *
 * Tests for tier-based content filtering of VerboseEvaluation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContentGateway, createContentGateway, type Tier } from '../../../src/analyzer/content-gateway.js';
import type { VerboseEvaluation } from '../../../src/models/verbose-evaluation.js';

describe('ContentGateway', () => {
  let gateway: ContentGateway;
  let fullEvaluation: VerboseEvaluation;

  beforeEach(() => {
    gateway = createContentGateway();

    // Create a complete evaluation with all fields
    fullEvaluation = {
      // Metadata
      sessionId: 'test-session-123',
      analyzedAt: '2024-01-15T10:00:00Z',
      sessionsAnalyzed: 5,

      // Type result
      primaryType: 'architect',
      controlLevel: 'ai-master',
      distribution: {
        architect: 40,
        scientist: 25,
        collaborator: 20,
        speedrunner: 10,
        craftsman: 5,
      },

      // Personality summary
      personalitySummary:
        'You are a strategic thinker who approaches problems methodically. Your sessions reveal a strong preference for planning.',

      // Dimension insights (6 dimensions)
      dimensionInsights: [
        {
          dimension: 'aiCollaboration',
          dimensionDisplayName: 'AI Collaboration',
          strengths: [
            {
              title: 'Strong Planning',
              description: 'Uses structured approach',
              evidence: [
                {
                  quote: 'Let me plan this out first',
                  sessionDate: '2024-01-01',
                  context: 'Starting feature implementation',
                },
              ],
            },
          ],
          growthAreas: [
            {
              title: 'Tool Usage',
              description: 'Could leverage more tools',
              evidence: [
                {
                  quote: 'I will do this manually',
                  sessionDate: '2024-01-02',
                  context: 'Missed opportunity for automation',
                },
              ],
              recommendation: 'Try using automation tools',
            },
          ],
        },
        {
          dimension: 'contextEngineering',
          dimensionDisplayName: 'Context Engineering',
          strengths: [
            {
              title: 'Context Clarity',
              description: 'Provides clear context',
              evidence: [
                {
                  quote: 'Here is the background',
                  sessionDate: '2024-01-01',
                  context: 'Explaining requirements',
                },
              ],
            },
          ],
          growthAreas: [],
        },
        {
          dimension: 'toolMastery',
          dimensionDisplayName: 'Tool Mastery',
          strengths: [],
          growthAreas: [
            {
              title: 'Learn Advanced Tools',
              description: 'Expand tool knowledge',
              evidence: [
                {
                  quote: 'I did not know about that tool',
                  sessionDate: '2024-01-03',
                  context: 'Discovering new capabilities',
                },
              ],
              recommendation: 'Explore documentation',
            },
          ],
        },
        {
          dimension: 'burnoutRisk',
          dimensionDisplayName: 'Burnout Risk',
          strengths: [
            {
              title: 'Balanced Approach',
              description: 'Takes breaks appropriately',
              evidence: [
                {
                  quote: 'Let me take a step back',
                  sessionDate: '2024-01-04',
                  context: 'Avoiding overwhelm',
                },
              ],
            },
          ],
          growthAreas: [],
        },
        {
          dimension: 'aiControl',
          dimensionDisplayName: 'AI Control',
          strengths: [
            {
              title: 'Maintains Control',
              description: 'Always verifies AI output',
              evidence: [
                {
                  quote: 'Let me review that code',
                  sessionDate: '2024-01-05',
                  context: 'Code review',
                },
              ],
            },
          ],
          growthAreas: [],
        },
        {
          dimension: 'skillResilience',
          dimensionDisplayName: 'Skill Resilience',
          strengths: [],
          growthAreas: [
            {
              title: 'Deepen Understanding',
              description: 'Strengthen core skills',
              evidence: [
                {
                  quote: 'How does this work internally',
                  sessionDate: '2024-01-06',
                  context: 'Learning opportunity',
                },
              ],
              recommendation: 'Study fundamentals',
            },
          ],
        },
      ],

      // Prompt patterns
      promptPatterns: [
        {
          patternName: 'Context First',
          description: 'Provides context before requests',
          frequency: 'frequent',
          examples: [
            {
              quote: 'Here is the background...',
              analysis: 'Good context setting',
            },
          ],
          effectiveness: 'highly_effective',
          tip: 'Keep doing this',
        },
        {
          patternName: 'Iterative Refinement',
          description: 'Refines through conversation',
          frequency: 'occasional',
          examples: [
            {
              quote: 'Can we adjust that?',
              analysis: 'Collaborative approach',
            },
          ],
          effectiveness: 'effective',
        },
        {
          patternName: 'Clear Constraints',
          description: 'Specifies requirements clearly',
          frequency: 'frequent',
          examples: [
            {
              quote: 'Must handle edge case X',
              analysis: 'Prevents issues',
            },
          ],
          effectiveness: 'highly_effective',
        },
      ],

      // Premium fields
      toolUsageDeepDive: [
        {
          toolName: 'Read',
          usageCount: 150,
          usagePercentage: 45,
          insightTitle: 'Heavy Reader',
          insight: 'You read files frequently',
          comparison: 'Above average',
          recommendation: 'Consider using grep',
        },
        {
          toolName: 'Write',
          usageCount: 80,
          usagePercentage: 24,
          insightTitle: 'Careful Writer',
          insight: 'You write thoughtfully',
          comparison: 'Average',
        },
      ],

      tokenEfficiency: {
        averageTokensPerSession: 15000,
        tokenEfficiencyScore: 75,
        efficiencyLevel: 'efficient',
        insights: [
          {
            title: 'Good Context Management',
            description: 'You provide enough context without excess',
            impact: 'medium',
          },
        ],
        savingsEstimate: '$15/month',
      },

      growthRoadmap: {
        currentLevel: 'proficient',
        nextMilestone: 'Expert Level',
        steps: [
          {
            order: 1,
            title: 'Master Advanced Tools',
            description: 'Learn Task and Agent tools',
            timeEstimate: '2 weeks',
            metrics: 'Use tools in 80% of sessions',
          },
          {
            order: 2,
            title: 'Optimize Token Usage',
            description: 'Reduce redundant context',
            timeEstimate: '1 week',
            metrics: 'Reduce tokens by 20%',
          },
          {
            order: 3,
            title: 'Improve Verification',
            description: 'Always verify AI output',
            timeEstimate: '2 weeks',
            metrics: 'Zero unverified code',
          },
        ],
        estimatedTimeToNextLevel: '5 weeks',
      },

      comparativeInsights: [
        {
          metric: 'Planning Score',
          yourValue: 85,
          averageValue: 65,
          percentile: 80,
          interpretation: 'You plan more than most',
        },
        {
          metric: 'Tool Usage',
          yourValue: 12,
          averageValue: 15,
          percentile: 45,
          interpretation: 'Below average tool usage',
        },
      ],

      sessionTrends: [
        {
          metricName: 'Planning Quality',
          direction: 'improving',
          description: 'Your planning is getting better',
          dataPoints: [
            { sessionDate: '2024-01-01', value: 70 },
            { sessionDate: '2024-01-05', value: 85 },
          ],
        },
      ],
    };
  });

  describe('filter()', () => {
    describe('free tier', () => {
      it('should keep type result and personality summary', () => {
        const filtered = gateway.filter(fullEvaluation, 'free');

        expect(filtered.primaryType).toBe('architect');
        expect(filtered.controlLevel).toBe('ai-master');
        expect(filtered.distribution).toEqual(fullEvaluation.distribution);
        expect(filtered.personalitySummary).toBe(fullEvaluation.personalitySummary);
      });

      it('should keep first 2 dimension insights fully detailed', () => {
        const filtered = gateway.filter(fullEvaluation, 'free');

        // First 2 dimensions should have full details
        expect(filtered.dimensionInsights[0]).toEqual(fullEvaluation.dimensionInsights[0]);
        expect(filtered.dimensionInsights[1]).toEqual(fullEvaluation.dimensionInsights[1]);
      });

      it('should empty strengths/growthAreas for dimensions 3-6', () => {
        const filtered = gateway.filter(fullEvaluation, 'free');

        // Dimensions 3-6 should have empty arrays
        for (let i = 2; i < 6; i++) {
          expect(filtered.dimensionInsights[i].strengths).toEqual([]);
          expect(filtered.dimensionInsights[i].growthAreas).toEqual([]);
          // But should keep dimension metadata
          expect(filtered.dimensionInsights[i].dimension).toBe(
            fullEvaluation.dimensionInsights[i].dimension
          );
          expect(filtered.dimensionInsights[i].dimensionDisplayName).toBe(
            fullEvaluation.dimensionInsights[i].dimensionDisplayName
          );
        }
      });

      it('should have empty prompt patterns', () => {
        const filtered = gateway.filter(fullEvaluation, 'free');

        expect(filtered.promptPatterns).toEqual([]);
      });

      it('should have all premium fields undefined', () => {
        const filtered = gateway.filter(fullEvaluation, 'free');

        expect(filtered.toolUsageDeepDive).toBeUndefined();
        expect(filtered.tokenEfficiency).toBeUndefined();
        expect(filtered.growthRoadmap).toBeUndefined();
        expect(filtered.comparativeInsights).toBeUndefined();
        expect(filtered.sessionTrends).toBeUndefined();
      });

      it('should preserve metadata fields', () => {
        const filtered = gateway.filter(fullEvaluation, 'free');

        expect(filtered.sessionId).toBe('test-session-123');
        expect(filtered.analyzedAt).toBe('2024-01-15T10:00:00Z');
        expect(filtered.sessionsAnalyzed).toBe(5);
      });
    });

    describe('premium tier', () => {
      it('should keep all 6 dimension insights fully detailed', () => {
        const filtered = gateway.filter(fullEvaluation, 'premium');

        expect(filtered.dimensionInsights).toEqual(fullEvaluation.dimensionInsights);
      });

      it('should keep all prompt patterns', () => {
        const filtered = gateway.filter(fullEvaluation, 'premium');

        expect(filtered.promptPatterns).toEqual(fullEvaluation.promptPatterns);
        expect(filtered.promptPatterns.length).toBe(3);
      });

      it('should have premium fields undefined (reserved for enterprise)', () => {
        const filtered = gateway.filter(fullEvaluation, 'premium');

        expect(filtered.toolUsageDeepDive).toBeUndefined();
        expect(filtered.tokenEfficiency).toBeUndefined();
        expect(filtered.growthRoadmap).toBeUndefined();
        expect(filtered.comparativeInsights).toBeUndefined();
        expect(filtered.sessionTrends).toBeUndefined();
      });

      it('should keep type result and personality summary', () => {
        const filtered = gateway.filter(fullEvaluation, 'premium');

        expect(filtered.primaryType).toBe('architect');
        expect(filtered.personalitySummary).toBe(fullEvaluation.personalitySummary);
      });
    });

    describe('enterprise tier', () => {
      it('should return unmodified evaluation', () => {
        const filtered = gateway.filter(fullEvaluation, 'enterprise');

        expect(filtered).toEqual(fullEvaluation);
      });

      it('should include all premium fields', () => {
        const filtered = gateway.filter(fullEvaluation, 'enterprise');

        expect(filtered.toolUsageDeepDive).toBeDefined();
        expect(filtered.toolUsageDeepDive?.length).toBe(2);
        expect(filtered.tokenEfficiency).toBeDefined();
        expect(filtered.growthRoadmap).toBeDefined();
        expect(filtered.comparativeInsights).toBeDefined();
        expect(filtered.sessionTrends).toBeDefined();
      });
    });
  });

  describe('createPremiumPreview()', () => {
    it('should extract tool names from toolUsageDeepDive', () => {
      const preview = gateway.createPremiumPreview(fullEvaluation);

      expect(preview.toolUsageDeepDivePreview).toEqual(['Read', 'Write']);
    });

    it('should show efficiency level from tokenEfficiency', () => {
      const preview = gateway.createPremiumPreview(fullEvaluation);

      expect(preview.tokenEfficiencyPreview).toBe('Token Efficiency: efficient');
    });

    it('should show current level and next milestone from growthRoadmap', () => {
      const preview = gateway.createPremiumPreview(fullEvaluation);

      expect(preview.growthRoadmapPreview).toBe('proficient → Expert Level');
    });

    it('should extract metric names from comparativeInsights', () => {
      const preview = gateway.createPremiumPreview(fullEvaluation);

      expect(preview.comparativeInsightsPreview).toEqual(['Planning Score', 'Tool Usage']);
    });

    it('should extract metric names from sessionTrends', () => {
      const preview = gateway.createPremiumPreview(fullEvaluation);

      expect(preview.sessionTrendsPreview).toEqual(['Planning Quality']);
    });

    it('should return empty preview when premium fields are undefined', () => {
      const minimalEvaluation: VerboseEvaluation = {
        ...fullEvaluation,
        toolUsageDeepDive: undefined,
        tokenEfficiency: undefined,
        growthRoadmap: undefined,
        comparativeInsights: undefined,
        sessionTrends: undefined,
      };

      const preview = gateway.createPremiumPreview(minimalEvaluation);

      expect(preview).toEqual({});
    });

    it('should handle empty arrays in premium fields', () => {
      const emptyEvaluation: VerboseEvaluation = {
        ...fullEvaluation,
        toolUsageDeepDive: [],
        comparativeInsights: [],
        sessionTrends: [],
      };

      const preview = gateway.createPremiumPreview(emptyEvaluation);

      // Should not include empty arrays in preview
      expect(preview.toolUsageDeepDivePreview).toBeUndefined();
      expect(preview.comparativeInsightsPreview).toBeUndefined();
      expect(preview.sessionTrendsPreview).toBeUndefined();
    });
  });

  describe('factory function', () => {
    it('should create a new ContentGateway instance', () => {
      const gateway = createContentGateway();

      expect(gateway).toBeInstanceOf(ContentGateway);
    });
  });

  describe('tier access progression', () => {
    it('should show increasing access from free → premium → enterprise', () => {
      const freeTier = gateway.filter(fullEvaluation, 'free');
      const premiumTier = gateway.filter(fullEvaluation, 'premium');
      const enterpriseTier = gateway.filter(fullEvaluation, 'enterprise');

      // Free tier: 2 full dimensions, no prompt patterns
      expect(freeTier.dimensionInsights[2].strengths).toEqual([]);
      expect(freeTier.promptPatterns).toEqual([]);
      expect(freeTier.toolUsageDeepDive).toBeUndefined();

      // Premium tier: all dimensions, prompt patterns, no analytics
      expect(premiumTier.dimensionInsights[2].strengths).toBeTruthy();
      expect(premiumTier.promptPatterns.length).toBeGreaterThan(0);
      expect(premiumTier.toolUsageDeepDive).toBeUndefined();

      // Enterprise tier: everything
      expect(enterpriseTier.dimensionInsights[2].strengths).toBeTruthy();
      expect(enterpriseTier.promptPatterns.length).toBeGreaterThan(0);
      expect(enterpriseTier.toolUsageDeepDive).toBeDefined();
    });
  });
});
