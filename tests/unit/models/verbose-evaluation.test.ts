/**
 * VerboseEvaluation Schema Tests
 *
 * Tests for LLM response schema validation to catch edge cases
 * where the AI might return incomplete or malformed data.
 *
 * NOTE: Array min/max constraints were removed from most arrays due to
 * Gemini API limitation (only ONE array with size constraints per schema).
 * Evidence is now string[] instead of object[] to reduce nesting depth.
 */

import { describe, it, expect } from 'vitest';
import {
  VerboseLLMResponseSchema,
  PromptPatternSchema,
  PerDimensionInsightSchema,
  DimensionStrengthSchema,
  DimensionGrowthAreaSchema,
} from '../../../src/lib/models/verbose-evaluation.js';

describe('VerboseLLMResponseSchema', () => {
  const validPromptPattern = {
    patternName: 'Context First',
    description: 'Provides context before making requests',
    frequency: 'frequent' as const,
    examples: [{ quote: 'Here is the code...', analysis: 'Good context' }],
    effectiveness: 'highly_effective' as const,
  };

  // Evidence is now just a string (quote), not an object
  const validEvidence = 'Let me plan this out first before we dive in';

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
        evidence: [validEvidence],
        recommendation: 'Try using the Task tool for delegating to specialized agents',
      },
    ],
  };

  const createValidResponse = () => ({
    primaryType: 'architect' as const,
    controlLevel: 'cartographer' as const,
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

    it('should accept response with 3 promptPatterns', () => {
      const response = createValidResponse();
      response.promptPatterns = [
        validPromptPattern,
        { ...validPromptPattern, patternName: 'Pattern 2' },
        { ...validPromptPattern, patternName: 'Pattern 3' },
      ];

      const result = VerboseLLMResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should accept response with more than 6 promptPatterns (no max constraint)', () => {
      const response = createValidResponse();
      response.promptPatterns = Array.from({ length: 10 }, (_, i) => ({
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

    it('should accept empty promptPatterns array (no min constraint for Gemini)', () => {
      const response = {
        ...createValidResponse(),
        promptPatterns: [],
      };

      const result = VerboseLLMResponseSchema.safeParse(response);
      // No min constraint - passes validation
      expect(result.success).toBe(true);
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

    it('should FAIL when dimensionInsights has wrong number of items (must be exactly 6)', () => {
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

});


describe('PromptPatternSchema', () => {
  const validPattern = {
    patternName: 'Test Pattern',
    description: 'A test pattern description',
    frequency: 'frequent' as const,
    examples: [{ quote: 'test quote', analysis: 'test analysis' }],
    effectiveness: 'effective' as const,
  };

  it('should accept valid frequency values', () => {
    const validFrequencies = ['frequent', 'occasional', 'rare'] as const;

    for (const frequency of validFrequencies) {
      const pattern = { ...validPattern, frequency };
      const result = PromptPatternSchema.safeParse(pattern);
      expect(result.success).toBe(true);
    }
  });

  it('should accept valid effectiveness values', () => {
    const validEffectiveness = ['highly_effective', 'effective', 'could_improve'] as const;

    for (const effectiveness of validEffectiveness) {
      const pattern = { ...validPattern, effectiveness };
      const result = PromptPatternSchema.safeParse(pattern);
      expect(result.success).toBe(true);
    }
  });

  it('should accept optional tip field', () => {
    const patternWithTip = { ...validPattern, tip: 'A helpful tip' };
    const result = PromptPatternSchema.safeParse(patternWithTip);
    expect(result.success).toBe(true);
  });

  // NOTE: String length constraints are flexible for LLM output variability
  // NOTE: examples array min/max constraints removed for Gemini API compatibility
  describe('examples array', () => {
    it('should accept empty examples array (no min constraint for Gemini)', () => {
      const pattern = { ...validPattern, examples: [] };
      const result = PromptPatternSchema.safeParse(pattern);
      expect(result.success).toBe(true);
    });

    it('should accept examples array with many items (no max constraint for Gemini)', () => {
      const pattern = {
        ...validPattern,
        examples: [
          { quote: 'quote 1', analysis: 'analysis 1' },
          { quote: 'quote 2', analysis: 'analysis 2' },
          { quote: 'quote 3', analysis: 'analysis 3' },
          { quote: 'quote 4', analysis: 'analysis 4' },
          { quote: 'quote 5', analysis: 'analysis 5' },
        ],
      };
      const result = PromptPatternSchema.safeParse(pattern);
      expect(result.success).toBe(true);
    });
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

  // NOTE: strengths/growthAreas array constraints removed for Gemini API compatibility
  it('should accept strengths array with many items (no max constraint for Gemini)', () => {
    const validStrength = { title: 'Test', description: 'Test description', evidence: ['quote'] };

    const insight = {
      dimension: 'aiCollaboration' as const,
      dimensionDisplayName: 'AI Collaboration',
      strengths: Array(10).fill(validStrength),
      growthAreas: [],
    };

    const result = PerDimensionInsightSchema.safeParse(insight);
    expect(result.success).toBe(true);
  });

  it('should accept growthAreas array with many items (no max constraint for Gemini)', () => {
    const validGrowthArea = {
      title: 'Test',
      description: 'Test description',
      evidence: ['quote'],
      recommendation: 'Do this',
    };

    const insight = {
      dimension: 'aiCollaboration' as const,
      dimensionDisplayName: 'AI Collaboration',
      strengths: [],
      growthAreas: Array(10).fill(validGrowthArea),
    };

    const result = PerDimensionInsightSchema.safeParse(insight);
    expect(result.success).toBe(true);
  });
});

describe('DimensionStrengthSchema', () => {
  // Evidence is now string[] (just quotes), not object[]
  const validEvidence = 'test quote demonstrating this strength';
  const validStrength = {
    title: 'Strong Planning',
    description: 'Uses structured approach to break down complex tasks',
    evidence: [validEvidence],
  };

  it('should accept valid strength with string evidence', () => {
    const result = DimensionStrengthSchema.safeParse(validStrength);
    expect(result.success).toBe(true);
  });

  // NOTE: String length constraints are flexible for LLM output variability
  describe('evidence array (string[])', () => {
    it('should accept empty evidence array (no min constraint for Gemini)', () => {
      const strength = { ...validStrength, evidence: [] };
      const result = DimensionStrengthSchema.safeParse(strength);
      expect(result.success).toBe(true);
    });

    it('should accept multiple evidence strings', () => {
      const strength = {
        ...validStrength,
        evidence: ['quote 1', 'quote 2', 'quote 3', 'quote 4', 'quote 5'],
      };
      const result = DimensionStrengthSchema.safeParse(strength);
      expect(result.success).toBe(true);
    });
  });
});

describe('DimensionGrowthAreaSchema', () => {
  // Evidence is now string[] (just quotes), not object[]
  const validEvidence = 'test quote showing this growth opportunity';
  const validGrowthArea = {
    title: 'Tool Usage',
    description: 'Could leverage more advanced tools for parallel execution',
    evidence: [validEvidence],
    recommendation: 'Try using the Task tool for delegating',
  };

  it('should accept valid growth area with string evidence', () => {
    const result = DimensionGrowthAreaSchema.safeParse(validGrowthArea);
    expect(result.success).toBe(true);
  });

  // NOTE: String length constraints are flexible for LLM output variability
  describe('evidence array (string[])', () => {
    it('should accept empty evidence array (no min constraint for Gemini)', () => {
      const area = { ...validGrowthArea, evidence: [] };
      const result = DimensionGrowthAreaSchema.safeParse(area);
      expect(result.success).toBe(true);
    });

    it('should accept multiple evidence strings', () => {
      const area = {
        ...validGrowthArea,
        evidence: ['quote 1', 'quote 2', 'quote 3', 'quote 4'],
      };
      const result = DimensionGrowthAreaSchema.safeParse(area);
      expect(result.success).toBe(true);
    });
  });
});
