/**
 * ContentGateway Tests
 *
 * Tests for tier-based content filtering of VerboseEvaluation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContentGateway, createContentGateway, type Tier } from '../../../src/lib/analyzer/content-gateway.js';
import type { VerboseEvaluation } from '../../../src/lib/models/verbose-evaluation.js';

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
      controlLevel: 'cartographer',
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

      // Module C - Productivity Analysis
      productivityAnalysis: {
        iterationEfficiency: {
          signalsData: 'rapid_iteration:session1:85;context_switching:session2:60',
          patterns: [
            {
              patternName: 'Rapid Iteration',
              frequency: 12,
              effectiveness: 'high',
              insight: 'Quick feedback loops lead to better outcomes',
            },
          ],
          overallScore: 78,
          narrative: 'You iterate quickly and effectively',
        },
        learningVelocity: {
          signalsData: 'self_learning:session3:90;doc_exploration:session4:75',
          patterns: [
            {
              patternName: 'Self-Directed Learning',
              frequency: 8,
              effectiveness: 'high',
              insight: 'You proactively explore new concepts',
            },
          ],
          overallScore: 82,
          narrative: 'You learn at an impressive pace',
        },
        collaborationEffectiveness: {
          signalsData: 'clear_requests:session5:88;feedback_incorporation:session6:92',
          patterns: [
            {
              patternName: 'Clear Communication',
              frequency: 15,
              effectiveness: 'high',
              insight: 'You communicate requirements clearly',
            },
          ],
          overallScore: 85,
          narrative: 'You collaborate effectively with AI',
        },
        overallProductivityScore: 82,
        topProductivityStrengths: [
          {
            title: 'Fast Iteration',
            description: 'You iterate quickly on solutions',
            evidence: ['Made 3 refinements in 10 minutes'],
          },
        ],
        topProductivityGrowthAreas: [
          {
            title: 'Context Switching',
            description: 'Reduce context switching overhead',
            evidence: ['Switched between 5 tasks in one session'],
            recommendation: 'Focus on one task at a time',
          },
        ],
      },

      // Phase 2 - Agent Outputs (Wow Agents)
      agentOutputs: {
        patternDetective: {
          repeatedQuestionsData: 'React hooks:5:useEffect cleanup;TypeScript:3:generics',
          conversationStyleData: 'vague_request:23:just do it;proactive_context:15:provides context',
          requestStartPatternsData: 'Can you:45;fix this:12;help me:8',
          topInsights: [
            'TypeScript generics questions appeared 12 times',
            '67% of requests lack specific context',
            'Just do it pattern detected 23 times',
          ],
          overallStyleSummary: 'Direct communicator who tends to skip context',
          confidenceScore: 0.85,
        },
        antiPatternSpotter: {
          errorLoopsData: 'TypeScript error:8:4.2:same error in 3 sessions',
          learningAvoidanceData: 'copy_paste_no_read:copied without understanding:high',
          repeatedMistakesData: 'ESLint ignore:12:session1,session3,session7',
          topInsights: [
            'ESLint errors repeated 8 times with 4.2 turns to resolve',
            '34% of code copied without understanding',
            'Same approach persisted 3+ times in 8 cases',
          ],
          overallHealthScore: 72,
          confidenceScore: 0.78,
        },
        knowledgeGap: {
          knowledgeGapsData: 'async/await:7:shallow:Promise chaining unclear',
          learningProgressData: 'React hooks:shallow:moderate:useEffect questions decreased',
          recommendedResourcesData: 'TypeScript:docs:typescriptlang.org',
          topInsights: [
            'async/await questions appeared 7 times',
            'React hooks understanding: shallow to moderate',
            'Recommended: TypeScript generics documentation',
          ],
          overallKnowledgeScore: 68,
          confidenceScore: 0.82,
        },
        contextEfficiency: {
          contextUsagePatternData: 'session1:85:92;session2:78:88',
          inefficiencyPatternsData: 'late_compact:15:high:compacts at 90%+',
          promptLengthTrendData: 'early:150;mid:280;late:450',
          redundantInfoData: 'project_structure:5;tech_stack:3',
          topInsights: [
            'Average 85% context fill before compact',
            'Prompt length increases 2.3x in late session',
            'Project structure explained 5 times',
          ],
          overallEfficiencyScore: 65,
          avgContextFillPercent: 84,
          confidenceScore: 0.79,
        },
      },
    };
  });

  describe('filter()', () => {
    describe('free tier', () => {
      it('should keep type result and personality summary', () => {
        const filtered = gateway.filter(fullEvaluation, 'free');

        expect(filtered.primaryType).toBe('architect');
        expect(filtered.controlLevel).toBe('cartographer');
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

      it('should have productivityAnalysis undefined', () => {
        const filtered = gateway.filter(fullEvaluation, 'free');

        expect(filtered.productivityAnalysis).toBeUndefined();
      });

      it('should have agentOutputs with teaser data (typeSynthesis preserved)', () => {
        const filtered = gateway.filter(fullEvaluation, 'free');

        // Free tier gets teaser version of agentOutputs
        expect(filtered.agentOutputs).toBeDefined();
        // patternDetective is a free agent - full data
        expect(filtered.agentOutputs?.patternDetective).toEqual(fullEvaluation.agentOutputs?.patternDetective);
        // Premium agents get teaser (1 insight + scores only)
        expect(filtered.agentOutputs?.antiPatternSpotter?.topInsights).toHaveLength(1);
        expect(filtered.agentOutputs?.antiPatternSpotter?.errorLoopsData).toBe('');
        expect(filtered.agentOutputs?.knowledgeGap?.topInsights).toHaveLength(1);
        expect(filtered.agentOutputs?.knowledgeGap?.knowledgeGapsData).toBe('');
        expect(filtered.agentOutputs?.contextEfficiency?.topInsights).toHaveLength(1);
        expect(filtered.agentOutputs?.contextEfficiency?.contextUsagePatternData).toBe('');
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

      it('should have enterprise analytics fields undefined (reserved for enterprise)', () => {
        const filtered = gateway.filter(fullEvaluation, 'premium');

        expect(filtered.toolUsageDeepDive).toBeUndefined();
        expect(filtered.tokenEfficiency).toBeUndefined();
        expect(filtered.growthRoadmap).toBeUndefined();
        expect(filtered.comparativeInsights).toBeUndefined();
        expect(filtered.sessionTrends).toBeUndefined();
      });

      it('should include productivityAnalysis', () => {
        const filtered = gateway.filter(fullEvaluation, 'premium');

        expect(filtered.productivityAnalysis).toBeDefined();
        expect(filtered.productivityAnalysis?.overallProductivityScore).toBe(82);
        expect(filtered.productivityAnalysis?.iterationEfficiency.overallScore).toBe(78);
      });

      it('should include agentOutputs', () => {
        const filtered = gateway.filter(fullEvaluation, 'premium');

        expect(filtered.agentOutputs).toBeDefined();
        expect(filtered.agentOutputs?.patternDetective?.confidenceScore).toBe(0.85);
        expect(filtered.agentOutputs?.antiPatternSpotter?.overallHealthScore).toBe(72);
        expect(filtered.agentOutputs?.knowledgeGap?.overallKnowledgeScore).toBe(68);
        expect(filtered.agentOutputs?.contextEfficiency?.overallEfficiencyScore).toBe(65);
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

      it('should include all enterprise analytics fields', () => {
        const filtered = gateway.filter(fullEvaluation, 'enterprise');

        expect(filtered.toolUsageDeepDive).toBeDefined();
        expect(filtered.toolUsageDeepDive?.length).toBe(2);
        expect(filtered.tokenEfficiency).toBeDefined();
        expect(filtered.growthRoadmap).toBeDefined();
        expect(filtered.comparativeInsights).toBeDefined();
        expect(filtered.sessionTrends).toBeDefined();
      });

      it('should include productivityAnalysis', () => {
        const filtered = gateway.filter(fullEvaluation, 'enterprise');

        expect(filtered.productivityAnalysis).toBeDefined();
        expect(filtered.productivityAnalysis).toEqual(fullEvaluation.productivityAnalysis);
      });

      it('should include agentOutputs', () => {
        const filtered = gateway.filter(fullEvaluation, 'enterprise');

        expect(filtered.agentOutputs).toBeDefined();
        expect(filtered.agentOutputs).toEqual(fullEvaluation.agentOutputs);
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

      // Free tier: 2 full dimensions, no prompt patterns, teaser agentOutputs
      expect(freeTier.dimensionInsights[2].strengths).toEqual([]);
      expect(freeTier.promptPatterns).toEqual([]);
      expect(freeTier.toolUsageDeepDive).toBeUndefined();
      expect(freeTier.productivityAnalysis).toBeUndefined();
      // Free tier gets teaser agentOutputs (patternDetective full, premium agents limited)
      expect(freeTier.agentOutputs).toBeDefined();
      expect(freeTier.agentOutputs?.patternDetective).toBeDefined();
      expect(freeTier.agentOutputs?.antiPatternSpotter?.topInsights).toHaveLength(1);

      // Premium tier: all dimensions, prompt patterns, productivity & agents, no analytics
      expect(premiumTier.dimensionInsights[2].strengths).toBeTruthy();
      expect(premiumTier.promptPatterns.length).toBeGreaterThan(0);
      expect(premiumTier.toolUsageDeepDive).toBeUndefined();
      expect(premiumTier.productivityAnalysis).toBeDefined();
      expect(premiumTier.agentOutputs).toBeDefined();

      // Enterprise tier: everything
      expect(enterpriseTier.dimensionInsights[2].strengths).toBeTruthy();
      expect(enterpriseTier.promptPatterns.length).toBeGreaterThan(0);
      expect(enterpriseTier.toolUsageDeepDive).toBeDefined();
      expect(enterpriseTier.productivityAnalysis).toBeDefined();
      expect(enterpriseTier.agentOutputs).toBeDefined();
    });
  });

  describe('edge cases - null and undefined agent outputs', () => {
    it('should handle evaluation with undefined productivityAnalysis', () => {
      const evalWithoutProductivity: VerboseEvaluation = {
        ...fullEvaluation,
        productivityAnalysis: undefined,
      };

      const freeTier = gateway.filter(evalWithoutProductivity, 'free');
      const premiumTier = gateway.filter(evalWithoutProductivity, 'premium');
      const enterpriseTier = gateway.filter(evalWithoutProductivity, 'enterprise');

      expect(freeTier.productivityAnalysis).toBeUndefined();
      expect(premiumTier.productivityAnalysis).toBeUndefined();
      expect(enterpriseTier.productivityAnalysis).toBeUndefined();
    });

    it('should handle evaluation with undefined agentOutputs', () => {
      const evalWithoutAgents: VerboseEvaluation = {
        ...fullEvaluation,
        agentOutputs: undefined,
      };

      const freeTier = gateway.filter(evalWithoutAgents, 'free');
      const premiumTier = gateway.filter(evalWithoutAgents, 'premium');
      const enterpriseTier = gateway.filter(evalWithoutAgents, 'enterprise');

      expect(freeTier.agentOutputs).toBeUndefined();
      expect(premiumTier.agentOutputs).toBeUndefined();
      expect(enterpriseTier.agentOutputs).toBeUndefined();
    });

    it('should handle evaluation with partial agentOutputs', () => {
      const evalWithPartialAgents: VerboseEvaluation = {
        ...fullEvaluation,
        agentOutputs: {
          patternDetective: fullEvaluation.agentOutputs?.patternDetective,
          antiPatternSpotter: undefined,
          knowledgeGap: undefined,
          contextEfficiency: undefined,
        },
      };

      const premiumTier = gateway.filter(evalWithPartialAgents, 'premium');

      expect(premiumTier.agentOutputs).toBeDefined();
      expect(premiumTier.agentOutputs?.patternDetective).toBeDefined();
      expect(premiumTier.agentOutputs?.antiPatternSpotter).toBeUndefined();
      expect(premiumTier.agentOutputs?.knowledgeGap).toBeUndefined();
      expect(premiumTier.agentOutputs?.contextEfficiency).toBeUndefined();
    });

    it('should handle evaluation with empty agentOutputs object', () => {
      const evalWithEmptyAgents: VerboseEvaluation = {
        ...fullEvaluation,
        agentOutputs: {},
      };

      const premiumTier = gateway.filter(evalWithEmptyAgents, 'premium');

      expect(premiumTier.agentOutputs).toBeDefined();
      expect(premiumTier.agentOutputs).toEqual({});
    });

    it('should correctly filter productivityAnalysis for free tier even when present', () => {
      const filtered = gateway.filter(fullEvaluation, 'free');

      // Ensure productivityAnalysis is removed for free tier
      expect(filtered.productivityAnalysis).toBeUndefined();
      // But ensure it was present in original
      expect(fullEvaluation.productivityAnalysis).toBeDefined();
    });

    it('should correctly filter agentOutputs to teaser for free tier', () => {
      const filtered = gateway.filter(fullEvaluation, 'free');

      // Free tier gets teaser version (not undefined, not full)
      expect(filtered.agentOutputs).toBeDefined();
      // Premium agents have limited data
      expect(filtered.agentOutputs?.antiPatternSpotter?.errorLoopsData).toBe('');
      expect(filtered.agentOutputs?.antiPatternSpotter?.topInsights).toHaveLength(1);
      // But ensure full version was present in original
      expect(fullEvaluation.agentOutputs).toBeDefined();
      expect(fullEvaluation.agentOutputs?.antiPatternSpotter?.topInsights?.length).toBeGreaterThan(1);
    });
  });

  describe('new fields in tier progression', () => {
    it('should not leak productivityAnalysis to free tier', () => {
      const freeTier = gateway.filter(fullEvaluation, 'free');

      // Free tier should have productivityAnalysis as undefined (not accessible)
      expect(freeTier.productivityAnalysis).toBeUndefined();
      // Verify the field exists in original
      expect(fullEvaluation.productivityAnalysis).toBeDefined();
    });

    it('should provide teaser agentOutputs to free tier (not full access)', () => {
      const freeTier = gateway.filter(fullEvaluation, 'free');

      // Free tier gets teaser agentOutputs (limited data for premium agents)
      expect(freeTier.agentOutputs).toBeDefined();
      // Free agents (patternDetective) get full data
      expect(freeTier.agentOutputs?.patternDetective).toEqual(fullEvaluation.agentOutputs?.patternDetective);
      // Premium agents get teaser (limited insights, empty data fields)
      expect(freeTier.agentOutputs?.antiPatternSpotter?.topInsights).toHaveLength(1);
      expect(freeTier.agentOutputs?.antiPatternSpotter?.errorLoopsData).toBe('');
      // Verify the full version exists in original
      expect(fullEvaluation.agentOutputs?.antiPatternSpotter?.topInsights?.length).toBeGreaterThan(1);
    });

    it('should preserve all agent output fields in premium tier', () => {
      const premiumTier = gateway.filter(fullEvaluation, 'premium');

      expect(premiumTier.agentOutputs?.patternDetective?.repeatedQuestionsData).toBe(
        'React hooks:5:useEffect cleanup;TypeScript:3:generics'
      );
      expect(premiumTier.agentOutputs?.antiPatternSpotter?.errorLoopsData).toBe(
        'TypeScript error:8:4.2:same error in 3 sessions'
      );
      expect(premiumTier.agentOutputs?.knowledgeGap?.knowledgeGapsData).toBe(
        'async/await:7:shallow:Promise chaining unclear'
      );
      expect(premiumTier.agentOutputs?.contextEfficiency?.contextUsagePatternData).toBe(
        'session1:85:92;session2:78:88'
      );
    });

    it('should preserve all productivity analysis fields in premium tier', () => {
      const premiumTier = gateway.filter(fullEvaluation, 'premium');

      expect(premiumTier.productivityAnalysis?.iterationEfficiency.signalsData).toBe(
        'rapid_iteration:session1:85;context_switching:session2:60'
      );
      expect(premiumTier.productivityAnalysis?.learningVelocity.overallScore).toBe(82);
      expect(premiumTier.productivityAnalysis?.collaborationEffectiveness.narrative).toBe(
        'You collaborate effectively with AI'
      );
    });
  });
});
