/**
 * Unified Report Schema Tests
 *
 * Tests for the unified report schema and schema bridge functions.
 */

import { describe, it, expect } from 'vitest';
import {
  UnifiedReportSchema,
  ProfileSchema,
  DimensionResultSchema,
  DIMENSION_DISPLAY_NAMES,
  STRENGTH_THRESHOLD,
  MATRIX_NAMES,
} from '../src/models/unified-report.js';
import {
  verboseToProfile,
  dimensionsToDimensionResults,
  generateSummary,
  toUnifiedReport,
  isDimensionStrength,
  getMatrixInfo,
} from '../src/models/schema-bridge.js';
import type { VerboseEvaluation } from '../src/models/verbose-evaluation.js';
import type { FullAnalysisResult } from '../src/analyzer/dimensions/index.js';

// ============================================
// Test Fixtures
// ============================================

const mockVerboseEvaluation: VerboseEvaluation = {
  sessionId: '123e4567-e89b-12d3-a456-426614174000',
  analyzedAt: '2024-01-15T10:30:00Z',
  sessionsAnalyzed: 5,
  primaryType: 'architect',
  controlLevel: 'ai-master',
  distribution: {
    architect: 45,
    scientist: 25,
    collaborator: 15,
    speedrunner: 10,
    craftsman: 5,
  },
  personalitySummary:
    'You are a strategic planner who excels at breaking down complex problems into manageable steps. Your approach to AI collaboration is methodical and well-structured.',
  strengths: [
    {
      title: 'Strategic Planning',
      description: 'Excellent at defining clear requirements before coding.',
      evidence: [
        {
          quote: 'Let me first outline the requirements...',
          sessionDate: '2024-01-15',
          context: 'Start of session',
          significance: 'Shows proactive planning approach',
          sentiment: 'positive',
        },
        {
          quote: 'Before we implement, let me break this down...',
          sessionDate: '2024-01-14',
          context: 'Feature planning',
          significance: 'Demonstrates structured thinking',
          sentiment: 'positive',
        },
      ],
    },
  ],
  growthAreas: [
    {
      title: 'Faster Iteration',
      description: 'Sometimes over-plans before seeing results.',
      evidence: [
        {
          quote: 'Let me think about all the edge cases first...',
          sessionDate: '2024-01-15',
          context: 'Mid-session',
          significance: 'Could iterate faster',
          sentiment: 'growth_opportunity',
        },
      ],
      recommendation: 'Try quick prototypes before comprehensive planning.',
    },
  ],
  promptPatterns: [
    {
      patternName: 'Context Setting',
      description: 'Provides comprehensive context before requests.',
      frequency: 'frequent',
      examples: [
        {
          quote: 'Given the existing architecture, I need...',
          analysis: 'Good use of existing context',
        },
      ],
      effectiveness: 'highly_effective',
      tip: 'Keep doing this - it helps AI understand better.',
    },
  ],
};

const mockFullAnalysis: FullAnalysisResult = {
  aiCollaboration: {
    score: 78,
    level: 'proficient',
    breakdown: {
      structuredPlanning: { score: 85, todoWriteUsage: 5, stepByStepPlans: 10, specFileReferences: 3 },
      aiOrchestration: { score: 70, taskToolUsage: 8, multiAgentSessions: 2, parallelWorkflows: 1 },
      criticalVerification: { score: 80, codeReviewRequests: 4, testRequests: 6, outputModifications: 12 },
    },
    strengths: ['Good planning habits', 'Uses Task tool effectively'],
    growthAreas: ['Could verify outputs more'],
    interpretation: 'Strong collaboration with room for more verification.',
  },
  contextEngineering: {
    score: 82,
    level: 'proficient',
    breakdown: {
      write: { score: 90, fileReferences: 15, codeElementReferences: 8, constraintsMentioned: 5, patternReferences: 3 },
      select: { score: 75, specificity: 70, codebaseNavigation: 80, existingPatternUsage: 75 },
      compress: { score: 80, compactUsageCount: 3, iterationEfficiency: 85, avgTurnsPerSession: 6 },
      isolate: { score: 85, taskToolUsage: 8, multiAgentDelegation: 2, focusedPrompts: 12 },
    },
    bestExample: { content: 'Great prompt with file refs', score: 95, reasons: ['Clear', 'Specific'] },
    worstExample: { content: 'Vague request', score: 30, reasons: ['No context'] },
    tips: ['Great file references!', 'Good isolation', 'Could compress more'],
    interpretation: 'Excellent context engineering skills.',
  },
  burnoutRisk: {
    score: 25,
    level: 'low',
    breakdown: {
      afterHoursRate: 10,
      weekendRate: 5,
      lateNightCount: 1,
      avgSessionDuration: 45,
      sessionTrend: 'stable',
      longestSession: 90,
    },
    timeDistribution: { businessHours: 80, evening: 15, lateNight: 5, weekend: 5 },
    qualityCorrelation: {
      shortSessions: { avgDuration: 30, qualityIndicator: 'High quality' },
      longSessions: { avgDuration: 60, qualityIndicator: 'Good quality' },
    },
    recommendations: ['Keep up the healthy work patterns!'],
  },
  toolMastery: {
    overallScore: 72,
    toolUsage: {
      Read: { count: 50, percentage: 25, level: 'expert', assessment: 'Great usage' },
      Edit: { count: 40, percentage: 20, level: 'adept', assessment: 'Good usage' },
      Bash: { count: 30, percentage: 15, level: 'adept', assessment: 'Good usage' },
      Grep: { count: 20, percentage: 10, level: 'basic', assessment: 'Could use more' },
      Task: { count: 10, percentage: 5, level: 'basic', assessment: 'Try using more' },
    },
    topTools: ['Read', 'Edit'],
    underutilizedTools: ['Task', 'Grep'],
    tips: ['Try Task tool for complex tasks'],
  },
  aiControl: {
    score: 75,
    level: 'developing',
    breakdown: {
      verificationRate: 60,
      constraintSpecification: 70,
      outputCritique: 55,
      contextControl: 65,
    },
    signals: ['Verifies output', 'Sets constraints'],
    strengths: ['Good verification habits'],
    growthAreas: ['Could critique outputs more'],
    interpretation: 'Developing good control over AI outputs.',
  },
  skillResilience: {
    score: 68,
    level: 'developing',
    breakdown: {
      coldStartCapability: 70,
      hallucinationDetection: 65,
      explainabilityGap: 70,
    },
    warnings: ['Some reliance on AI for starts'],
    recommendations: ['Practice starting without AI help'],
    interpretation: 'Building good independent skills.',
    vpcMetrics: { m_csr: 0.7, m_ht: 0.65, e_gap: 0.3 },
  },
};

// ============================================
// Schema Validation Tests
// ============================================

describe('UnifiedReportSchema', () => {
  describe('ProfileSchema', () => {
    it('should validate a valid profile', () => {
      const profile = {
        primaryType: 'architect',
        controlLevel: 'ai-master',
        matrixName: 'Systems Architect',
        matrixEmoji: '🏛️',
        distribution: {
          architect: 45,
          scientist: 25,
          collaborator: 15,
          speedrunner: 10,
          craftsman: 5,
        },
        personalitySummary:
          'You are a strategic planner who excels at breaking down complex problems. ' +
          'Your methodical approach ensures thorough coverage of requirements.',
      };

      const result = ProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });

    it('should reject invalid coding style type', () => {
      const profile = {
        primaryType: 'invalid',
        controlLevel: 'ai-master',
        matrixName: 'Test',
        matrixEmoji: '🏛️',
        distribution: { architect: 100, scientist: 0, collaborator: 0, speedrunner: 0, craftsman: 0 },
        personalitySummary: 'x'.repeat(100),
      };

      const result = ProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });
  });

  describe('DimensionResultSchema', () => {
    it('should validate a valid dimension result', () => {
      const dimension = {
        name: 'contextEngineering',
        displayName: 'Context Engineering',
        score: 85,
        level: 'proficient',
        isStrength: true,
        breakdown: { write: 90, select: 80, compress: 85, isolate: 85 },
        highlights: {
          strengths: ['Great file references'],
          growthAreas: ['Could compress more'],
        },
        insights: [],
        interpretation: 'Excellent context engineering skills.',
      };

      const result = DimensionResultSchema.safeParse(dimension);
      expect(result.success).toBe(true);
    });

    it('should reject invalid dimension name', () => {
      const dimension = {
        name: 'invalidDimension',
        displayName: 'Invalid',
        score: 50,
        level: 'developing',
        isStrength: false,
        breakdown: {},
        highlights: { strengths: [], growthAreas: [] },
        insights: [],
        interpretation: 'Test',
      };

      const result = DimensionResultSchema.safeParse(dimension);
      expect(result.success).toBe(false);
    });

    it('should reject score out of range', () => {
      const dimension = {
        name: 'contextEngineering',
        displayName: 'Context Engineering',
        score: 150, // Invalid: > 100
        level: 'expert',
        isStrength: true,
        breakdown: {},
        highlights: { strengths: [], growthAreas: [] },
        insights: [],
        interpretation: 'Test',
      };

      const result = DimensionResultSchema.safeParse(dimension);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================
// Schema Bridge Tests
// ============================================

describe('Schema Bridge', () => {
  describe('verboseToProfile', () => {
    it('should convert VerboseEvaluation to Profile', () => {
      const profile = verboseToProfile(mockVerboseEvaluation);

      expect(profile.primaryType).toBe('architect');
      expect(profile.controlLevel).toBe('ai-master');
      expect(profile.matrixName).toBe('Systems Architect');
      expect(profile.matrixEmoji).toBe('🏛️');
      expect(profile.distribution.architect).toBe(45);
      expect(profile.personalitySummary).toContain('strategic planner');
    });
  });

  describe('dimensionsToDimensionResults', () => {
    it('should convert FullAnalysisResult to DimensionResult array', () => {
      const results = dimensionsToDimensionResults(mockFullAnalysis);

      expect(results).toHaveLength(6);

      // Check AI Collaboration
      const aiCollab = results.find((r) => r.name === 'aiCollaboration');
      expect(aiCollab).toBeDefined();
      expect(aiCollab!.score).toBe(78);
      expect(aiCollab!.isStrength).toBe(true); // 78 >= 70

      // Check Context Engineering
      const context = results.find((r) => r.name === 'contextEngineering');
      expect(context).toBeDefined();
      expect(context!.score).toBe(82);
      expect(context!.isStrength).toBe(true);

      // Check Burnout Risk (inverted scoring)
      const burnout = results.find((r) => r.name === 'burnoutRisk');
      expect(burnout).toBeDefined();
      expect(burnout!.score).toBe(75); // 100 - 25
      expect(burnout!.isStrength).toBe(true); // Low risk = strength

      // Check Skill Resilience
      const resilience = results.find((r) => r.name === 'skillResilience');
      expect(resilience).toBeDefined();
      expect(resilience!.score).toBe(68);
      expect(resilience!.isStrength).toBe(false); // 68 < 70
    });

    it('should set correct display names', () => {
      const results = dimensionsToDimensionResults(mockFullAnalysis);

      for (const result of results) {
        expect(result.displayName).toBe(DIMENSION_DISPLAY_NAMES[result.name]);
      }
    });
  });

  describe('generateSummary', () => {
    it('should generate summary with strengths and growth areas', () => {
      const dimensions = dimensionsToDimensionResults(mockFullAnalysis);
      const summary = generateSummary(dimensions);

      expect(summary.topStrengths.length).toBeGreaterThanOrEqual(1);
      expect(summary.topStrengths.length).toBeLessThanOrEqual(3);
      expect(summary.topGrowthAreas.length).toBeGreaterThanOrEqual(1);
      expect(summary.topGrowthAreas.length).toBeLessThanOrEqual(3);
      expect(summary.overallMessage.length).toBeGreaterThan(0);
    });

    it('should sort strengths by score (highest first)', () => {
      const dimensions = dimensionsToDimensionResults(mockFullAnalysis);
      const summary = generateSummary(dimensions);

      for (let i = 1; i < summary.topStrengths.length; i++) {
        expect(summary.topStrengths[i - 1].score).toBeGreaterThanOrEqual(
          summary.topStrengths[i].score
        );
      }
    });
  });

  describe('toUnifiedReport', () => {
    it('should create a valid UnifiedReport from verbose evaluation', () => {
      const report = toUnifiedReport({
        verbose: mockVerboseEvaluation,
        dimensions: mockFullAnalysis,
        tier: 'free',
      });

      // Validate with schema
      const validation = UnifiedReportSchema.safeParse(report);
      if (!validation.success) {
        console.log('Validation errors:', JSON.stringify(validation.error.errors, null, 2));
      }
      expect(validation.success).toBe(true);

      // Check structure
      expect(report.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(report.dimensions).toHaveLength(6);
      expect(report.tier).toBe('free');
      expect(report.profile.primaryType).toBe('architect');
    });

    it('should include premium content for premium tier', () => {
      const report = toUnifiedReport({
        verbose: mockVerboseEvaluation,
        dimensions: mockFullAnalysis,
        tier: 'premium',
      });

      expect(report.premium).toBeDefined();
      expect(report.premium!.toolUsageDeepDive).toBeDefined();
      expect(report.premium!.comparativeInsights).toBeDefined();
    });

    it('should not include premium content for free tier', () => {
      const report = toUnifiedReport({
        verbose: mockVerboseEvaluation,
        dimensions: mockFullAnalysis,
        tier: 'free',
      });

      expect(report.premium).toBeUndefined();
    });
  });

  describe('isDimensionStrength', () => {
    it('should return true for scores >= threshold', () => {
      expect(isDimensionStrength(70)).toBe(true);
      expect(isDimensionStrength(85)).toBe(true);
      expect(isDimensionStrength(100)).toBe(true);
    });

    it('should return false for scores < threshold', () => {
      expect(isDimensionStrength(69)).toBe(false);
      expect(isDimensionStrength(50)).toBe(false);
      expect(isDimensionStrength(0)).toBe(false);
    });
  });

  describe('getMatrixInfo', () => {
    it('should return correct matrix info for all combinations', () => {
      expect(getMatrixInfo('architect', 'ai-master')).toEqual({
        name: 'Systems Architect',
        emoji: '🏛️',
      });
      expect(getMatrixInfo('speedrunner', 'vibe-coder')).toEqual({
        name: 'Yolo Coder',
        emoji: '🎲',
      });
      expect(getMatrixInfo('craftsman', 'developing')).toEqual({
        name: 'Artisan',
        emoji: '🔧',
      });
    });
  });
});

// ============================================
// Constants Tests
// ============================================

describe('Constants', () => {
  describe('DIMENSION_DISPLAY_NAMES', () => {
    it('should have all 6 dimensions', () => {
      expect(Object.keys(DIMENSION_DISPLAY_NAMES)).toHaveLength(6);
      expect(DIMENSION_DISPLAY_NAMES.aiCollaboration).toBe('AI Collaboration Mastery');
      expect(DIMENSION_DISPLAY_NAMES.contextEngineering).toBe('Context Engineering');
      expect(DIMENSION_DISPLAY_NAMES.toolMastery).toBe('Tool Mastery');
      expect(DIMENSION_DISPLAY_NAMES.burnoutRisk).toBe('Burnout Risk');
      expect(DIMENSION_DISPLAY_NAMES.aiControl).toBe('AI Control Index');
      expect(DIMENSION_DISPLAY_NAMES.skillResilience).toBe('Skill Resilience');
    });
  });

  describe('STRENGTH_THRESHOLD', () => {
    it('should be 70', () => {
      expect(STRENGTH_THRESHOLD).toBe(70);
    });
  });

  describe('MATRIX_NAMES', () => {
    it('should have all 15 combinations (5 styles × 3 levels)', () => {
      const styles = ['architect', 'scientist', 'collaborator', 'speedrunner', 'craftsman'] as const;
      const levels = ['vibe-coder', 'developing', 'ai-master'] as const;

      for (const style of styles) {
        for (const level of levels) {
          expect(MATRIX_NAMES[style][level]).toBeDefined();
          expect(MATRIX_NAMES[style][level].name).toBeTruthy();
          expect(MATRIX_NAMES[style][level].emoji).toBeTruthy();
        }
      }
    });
  });
});
