/**
 * VerboseEvaluation Schema Tests
 *
 * Tests for LLM response schema validation to catch edge cases
 * where the AI might return incomplete or malformed data.
 */

import { describe, it, expect } from 'vitest';
import {
  VerboseLLMResponseSchema,
  VerboseEvaluationSchema,
  PromptPatternSchema,
  PerDimensionInsightSchema,
} from '../../../src/models/verbose-evaluation.js';

describe('VerboseLLMResponseSchema', () => {
  const validPromptPattern = {
    patternName: 'Context First',
    description: 'Provides context before making requests',
    frequency: 'frequent' as const,
    examples: [{ quote: 'Here is the code...', analysis: 'Good context' }],
    effectiveness: 'highly_effective' as const,
  };

  const validEvidence = {
    quote: 'Let me plan this out first before we dive in',
    sessionDate: '2024-01-01',
    context: 'Starting a complex feature implementation',
  };

  const validDimensionInsight = {
    dimension: 'aiCollaboration' as const,
    dimensionDisplayName: 'AI Collaboration',
    strengths: [
      {
        title: 'Strong Planning',
        description: 'Uses structured approach to break down complex tasks',
        evidence: [validEvidence],
      },
    ],
    growthAreas: [
      {
        title: 'Tool Usage',
        description: 'Could leverage more advanced tools for parallel execution',
        evidence: [validEvidence], // Must have at least 1 evidence
        recommendation: 'Try using the Task tool for delegating to specialized agents',
      },
    ],
  };

  const createValidResponse = () => ({
    primaryType: 'architect' as const,
    controlLevel: 'ai-master' as const,
    distribution: {
      architect: 40,
      scientist: 25,
      collaborator: 20,
      speedrunner: 10,
      craftsman: 5,
    },
    personalitySummary:
      'You are a strategic thinker who approaches problems methodically. Your sessions reveal a strong preference for planning and understanding context before diving into implementation. You leverage AI as a collaborative partner, consistently providing clear constraints and verifying outputs before accepting them.',
    dimensionInsights: [
      { ...validDimensionInsight, dimension: 'aiCollaboration' as const, dimensionDisplayName: 'AI Collaboration' },
      { ...validDimensionInsight, dimension: 'contextEngineering' as const, dimensionDisplayName: 'Context Engineering' },
      { ...validDimensionInsight, dimension: 'toolMastery' as const, dimensionDisplayName: 'Tool Mastery' },
      { ...validDimensionInsight, dimension: 'burnoutRisk' as const, dimensionDisplayName: 'Burnout Risk' },
      { ...validDimensionInsight, dimension: 'aiControl' as const, dimensionDisplayName: 'AI Control' },
      { ...validDimensionInsight, dimension: 'skillResilience' as const, dimensionDisplayName: 'Skill Resilience' },
    ],
    promptPatterns: [
      validPromptPattern,
      { ...validPromptPattern, patternName: 'Iterative Refinement' },
      { ...validPromptPattern, patternName: 'Clear Constraints' },
    ],
  });

  describe('valid responses', () => {
    it('should accept a complete valid response', () => {
      const response = createValidResponse();
      const result = VerboseLLMResponseSchema.safeParse(response);

      expect(result.success).toBe(true);
    });

    it('should accept response with exactly 3 promptPatterns (minimum)', () => {
      const response = createValidResponse();
      response.promptPatterns = [
        validPromptPattern,
        { ...validPromptPattern, patternName: 'Pattern 2' },
        { ...validPromptPattern, patternName: 'Pattern 3' },
      ];

      const result = VerboseLLMResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should accept response with exactly 6 promptPatterns (maximum)', () => {
      const response = createValidResponse();
      response.promptPatterns = Array.from({ length: 6 }, (_, i) => ({
        ...validPromptPattern,
        patternName: `Pattern ${i + 1}`,
      }));

      const result = VerboseLLMResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('promptPatterns validation', () => {
    it('should FAIL when promptPatterns is undefined', () => {
      const response = createValidResponse();
      // @ts-expect-error - Testing runtime behavior
      delete response.promptPatterns;

      const result = VerboseLLMResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
      if (!result.success) {
        const promptPatternsError = result.error.issues.find(
          (issue) => issue.path.includes('promptPatterns')
        );
        expect(promptPatternsError).toBeDefined();
        expect(promptPatternsError?.message).toBe('Required');
      }
    });

    it('should FAIL when promptPatterns is null', () => {
      const response = {
        ...createValidResponse(),
        promptPatterns: null,
      };

      const result = VerboseLLMResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
    });

    it('should FAIL when promptPatterns is empty array', () => {
      const response = {
        ...createValidResponse(),
        promptPatterns: [],
      };

      const result = VerboseLLMResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find(
          (issue) => issue.path.includes('promptPatterns')
        );
        expect(error?.message).toMatch(/at least 3/i);
      }
    });

    it('should FAIL when promptPatterns has fewer than 3 items', () => {
      const response = {
        ...createValidResponse(),
        promptPatterns: [validPromptPattern, validPromptPattern],
      };

      const result = VerboseLLMResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
    });

    it('should FAIL when promptPatterns has more than 6 items', () => {
      const response = {
        ...createValidResponse(),
        promptPatterns: Array.from({ length: 7 }, (_, i) => ({
          ...validPromptPattern,
          patternName: `Pattern ${i + 1}`,
        })),
      };

      const result = VerboseLLMResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
    });

    it('should FAIL when promptPatterns has invalid frequency value', () => {
      const response = {
        ...createValidResponse(),
        promptPatterns: [
          { ...validPromptPattern, frequency: 'invalid' },
          validPromptPattern,
          validPromptPattern,
        ],
      };

      const result = VerboseLLMResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
    });

    it('should FAIL when promptPatterns has invalid effectiveness value', () => {
      const response = {
        ...createValidResponse(),
        promptPatterns: [
          { ...validPromptPattern, effectiveness: 'bad' },
          validPromptPattern,
          validPromptPattern,
        ],
      };

      const result = VerboseLLMResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
    });
  });

  describe('dimensionInsights validation', () => {
    it('should FAIL when dimensionInsights is undefined', () => {
      const response = createValidResponse();
      // @ts-expect-error - Testing runtime behavior
      delete response.dimensionInsights;

      const result = VerboseLLMResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
    });

    it('should FAIL when dimensionInsights has wrong number of items', () => {
      const response = {
        ...createValidResponse(),
        dimensionInsights: [validDimensionInsight], // Only 1 instead of 6
      };

      const result = VerboseLLMResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
    });

    it('should FAIL when dimensionInsights has invalid dimension name', () => {
      const response = createValidResponse();
      response.dimensionInsights[0] = {
        ...validDimensionInsight,
        dimension: 'invalidDimension' as any,
      };

      const result = VerboseLLMResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
    });
  });

  describe('distribution validation', () => {
    it('should FAIL when distribution is missing', () => {
      const response = createValidResponse();
      // @ts-expect-error - Testing runtime behavior
      delete response.distribution;

      const result = VerboseLLMResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
    });

    it('should FAIL when distribution has missing type', () => {
      const response = {
        ...createValidResponse(),
        distribution: {
          architect: 40,
          scientist: 25,
          collaborator: 20,
          speedrunner: 10,
          // missing craftsman
        },
      };

      const result = VerboseLLMResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
    });
  });

  describe('primaryType and controlLevel validation', () => {
    it('should FAIL when primaryType is invalid', () => {
      const response = {
        ...createValidResponse(),
        primaryType: 'invalid_type',
      };

      const result = VerboseLLMResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
    });

    it('should FAIL when controlLevel is invalid', () => {
      const response = {
        ...createValidResponse(),
        controlLevel: 'invalid_level',
      };

      const result = VerboseLLMResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
    });
  });

  describe('personalitySummary validation', () => {
    it('should FAIL when personalitySummary is too short', () => {
      const response = {
        ...createValidResponse(),
        personalitySummary: 'Too short', // Less than 200 characters
      };

      const result = VerboseLLMResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
    });

    it('should FAIL when personalitySummary is too long', () => {
      const response = {
        ...createValidResponse(),
        personalitySummary: 'a'.repeat(801), // Exceeds 800 character max
      };

      const result = VerboseLLMResponseSchema.safeParse(response);

      expect(result.success).toBe(false);
    });
  });
});

describe('PromptPatternSchema', () => {
  it('should accept valid frequency values', () => {
    const validFrequencies = ['frequent', 'occasional', 'rare'] as const;

    for (const frequency of validFrequencies) {
      const pattern = {
        patternName: 'Test Pattern',
        description: 'A test pattern',
        frequency,
        examples: [{ quote: 'test', analysis: 'test' }],
        effectiveness: 'effective' as const,
      };

      const result = PromptPatternSchema.safeParse(pattern);
      expect(result.success).toBe(true);
    }
  });

  it('should accept valid effectiveness values', () => {
    const validEffectiveness = ['highly_effective', 'effective', 'could_improve'] as const;

    for (const effectiveness of validEffectiveness) {
      const pattern = {
        patternName: 'Test Pattern',
        description: 'A test pattern',
        frequency: 'frequent' as const,
        examples: [{ quote: 'test', analysis: 'test' }],
        effectiveness,
      };

      const result = PromptPatternSchema.safeParse(pattern);
      expect(result.success).toBe(true);
    }
  });

  it('should accept optional tip field', () => {
    const patternWithTip = {
      patternName: 'Test Pattern',
      description: 'A test pattern',
      frequency: 'frequent' as const,
      examples: [{ quote: 'test', analysis: 'test' }],
      effectiveness: 'effective' as const,
      tip: 'A helpful tip',
    };

    const result = PromptPatternSchema.safeParse(patternWithTip);
    expect(result.success).toBe(true);
  });
});

describe('PerDimensionInsightSchema', () => {
  it('should accept all valid dimension names', () => {
    const validDimensions = [
      'aiCollaboration',
      'contextEngineering',
      'toolMastery',
      'burnoutRisk',
      'aiControl',
      'skillResilience',
    ] as const;

    for (const dimension of validDimensions) {
      const insight = {
        dimension,
        dimensionDisplayName: dimension,
        strengths: [],
        growthAreas: [],
      };

      const result = PerDimensionInsightSchema.safeParse(insight);
      expect(result.success).toBe(true);
    }
  });
});
