/**
 * Personality Profile Schema Tests (Module B Output)
 *
 * Tests for internal personality analysis schema validation.
 * Module B extracts personality data using MBTI 4-axis + 사주-inspired techniques.
 *
 * IMPORTANT: This schema is for INTERNAL use only.
 * Users never see MBTI codes or psychological labels directly.
 */

import { describe, it, expect } from 'vitest';
import {
  PersonalityProfileSchema,
  DimensionAnalysisSchema,
  DimensionSignalSchema,
  createDefaultPersonalityProfile,
} from '../../../src/lib/models/personality.js';

describe('DimensionSignalSchema', () => {
  const validSignal = {
    type: 'message_brevity',
    evidence: 'Average 87 chars per message, direct command style',
    confidence: 0.8,
  };

  describe('valid signals', () => {
    it('should accept a valid signal', () => {
      const result = DimensionSignalSchema.safeParse(validSignal);
      expect(result.success).toBe(true);
    });

    it('should accept minimum confidence (0)', () => {
      const signal = { ...validSignal, confidence: 0 };
      const result = DimensionSignalSchema.safeParse(signal);
      expect(result.success).toBe(true);
    });

    it('should accept maximum confidence (1)', () => {
      const signal = { ...validSignal, confidence: 1 };
      const result = DimensionSignalSchema.safeParse(signal);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid signals', () => {
    it('should FAIL when confidence is below 0', () => {
      const signal = { ...validSignal, confidence: -0.1 };
      const result = DimensionSignalSchema.safeParse(signal);
      expect(result.success).toBe(false);
    });

    it('should FAIL when confidence is above 1', () => {
      const signal = { ...validSignal, confidence: 1.1 };
      const result = DimensionSignalSchema.safeParse(signal);
      expect(result.success).toBe(false);
    });

    it('should FAIL when type is missing', () => {
      const { type: _type, ...signalWithoutType } = validSignal;
      const result = DimensionSignalSchema.safeParse(signalWithoutType);
      expect(result.success).toBe(false);
    });

    it('should FAIL when evidence is missing', () => {
      const { evidence: _evidence, ...signalWithoutEvidence } = validSignal;
      const result = DimensionSignalSchema.safeParse(signalWithoutEvidence);
      expect(result.success).toBe(false);
    });
  });
});

describe('DimensionAnalysisSchema', () => {
  const validDimension = {
    score: 35,
    signals: [
      { type: 'message_brevity', evidence: 'Concise communication style', confidence: 0.8 },
      { type: 'direct_commands', evidence: 'Uses imperative sentences', confidence: 0.7 },
    ],
    insight: 'Prefers concise, direct communication over verbose explanations',
  };

  describe('valid dimensions', () => {
    it('should accept a valid dimension analysis', () => {
      const result = DimensionAnalysisSchema.safeParse(validDimension);
      expect(result.success).toBe(true);
    });

    it('should accept score at minimum (0)', () => {
      const dimension = { ...validDimension, score: 0 };
      const result = DimensionAnalysisSchema.safeParse(dimension);
      expect(result.success).toBe(true);
    });

    it('should accept score at maximum (100)', () => {
      const dimension = { ...validDimension, score: 100 };
      const result = DimensionAnalysisSchema.safeParse(dimension);
      expect(result.success).toBe(true);
    });

    it('should accept balanced score (50)', () => {
      const dimension = { ...validDimension, score: 50 };
      const result = DimensionAnalysisSchema.safeParse(dimension);
      expect(result.success).toBe(true);
    });

    it('should accept empty signals array', () => {
      const dimension = { ...validDimension, signals: [] };
      const result = DimensionAnalysisSchema.safeParse(dimension);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid dimensions', () => {
    it('should FAIL when score is below 0', () => {
      const dimension = { ...validDimension, score: -1 };
      const result = DimensionAnalysisSchema.safeParse(dimension);
      expect(result.success).toBe(false);
    });

    it('should FAIL when score is above 100', () => {
      const dimension = { ...validDimension, score: 101 };
      const result = DimensionAnalysisSchema.safeParse(dimension);
      expect(result.success).toBe(false);
    });

    it('should FAIL when score is missing', () => {
      const { score: _score, ...dimensionWithoutScore } = validDimension;
      const result = DimensionAnalysisSchema.safeParse(dimensionWithoutScore);
      expect(result.success).toBe(false);
    });

    it('should FAIL when signals is missing', () => {
      const { signals: _signals, ...dimensionWithoutSignals } = validDimension;
      const result = DimensionAnalysisSchema.safeParse(dimensionWithoutSignals);
      expect(result.success).toBe(false);
    });

    it('should FAIL when insight is missing', () => {
      const { insight: _insight, ...dimensionWithoutInsight } = validDimension;
      const result = DimensionAnalysisSchema.safeParse(dimensionWithoutInsight);
      expect(result.success).toBe(false);
    });
  });
});

describe('PersonalityProfileSchema', () => {
  const validDimension = {
    score: 50,
    signals: [{ type: 'test_signal', evidence: 'Test evidence', confidence: 0.7 }],
    insight: 'Test insight for this dimension',
  };

  const createValidProfile = () => ({
    dimensions: {
      ei: { ...validDimension, score: 35, insight: 'Prefers concise communication' },
      sn: { ...validDimension, score: 60, insight: 'Leans toward big-picture thinking' },
      tf: { ...validDimension, score: 30, insight: 'Prioritizes logical analysis' },
      jp: { ...validDimension, score: 78, insight: 'Strong preference for planning' },
    },
    yongsin: 'Verification habit - could benefit from more output validation',
    gisin: 'Planning time - sometimes over-plans before execution',
    gyeokguk: 'Architect with strategic mindset',
    sangsaeng: ['Planning feeds into quality execution', 'Verification improves learning'],
    sanggeuk: ['Speed sometimes bypasses validation', 'Perfectionism delays shipping'],
    overallConfidence: 0.75,
  });

  describe('valid profiles', () => {
    it('should accept a complete valid profile', () => {
      const profile = createValidProfile();
      const result = PersonalityProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });

    it('should accept minimum confidence (0)', () => {
      const profile = { ...createValidProfile(), overallConfidence: 0 };
      const result = PersonalityProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });

    it('should accept maximum confidence (1)', () => {
      const profile = { ...createValidProfile(), overallConfidence: 1 };
      const result = PersonalityProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });

    it('should accept empty sangsaeng array', () => {
      const profile = { ...createValidProfile(), sangsaeng: [] };
      const result = PersonalityProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });

    it('should accept empty sanggeuk array', () => {
      const profile = { ...createValidProfile(), sanggeuk: [] };
      const result = PersonalityProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });

    it('should accept empty yongsin/gisin strings', () => {
      const profile = { ...createValidProfile(), yongsin: '', gisin: '' };
      const result = PersonalityProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid profiles', () => {
    it('should FAIL when dimensions is missing', () => {
      const profile = createValidProfile();
      // @ts-expect-error - Testing runtime behavior
      delete profile.dimensions;
      const result = PersonalityProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });

    it('should FAIL when ei dimension is missing', () => {
      const profile = createValidProfile();
      // @ts-expect-error - Testing runtime behavior
      delete profile.dimensions.ei;
      const result = PersonalityProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });

    it('should FAIL when sn dimension is missing', () => {
      const profile = createValidProfile();
      // @ts-expect-error - Testing runtime behavior
      delete profile.dimensions.sn;
      const result = PersonalityProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });

    it('should FAIL when tf dimension is missing', () => {
      const profile = createValidProfile();
      // @ts-expect-error - Testing runtime behavior
      delete profile.dimensions.tf;
      const result = PersonalityProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });

    it('should FAIL when jp dimension is missing', () => {
      const profile = createValidProfile();
      // @ts-expect-error - Testing runtime behavior
      delete profile.dimensions.jp;
      const result = PersonalityProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });

    it('should FAIL when overallConfidence is missing', () => {
      const profile = createValidProfile();
      // @ts-expect-error - Testing runtime behavior
      delete profile.overallConfidence;
      const result = PersonalityProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });

    it('should FAIL when overallConfidence is below 0', () => {
      const profile = { ...createValidProfile(), overallConfidence: -0.1 };
      const result = PersonalityProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });

    it('should FAIL when overallConfidence is above 1', () => {
      const profile = { ...createValidProfile(), overallConfidence: 1.1 };
      const result = PersonalityProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });

    it('should FAIL when gyeokguk is missing', () => {
      const profile = createValidProfile();
      // @ts-expect-error - Testing runtime behavior
      delete profile.gyeokguk;
      const result = PersonalityProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });
  });
});

describe('createDefaultPersonalityProfile', () => {
  it('should return a valid PersonalityProfile', () => {
    const profile = createDefaultPersonalityProfile();
    const result = PersonalityProfileSchema.safeParse(profile);
    expect(result.success).toBe(true);
  });

  it('should have all dimensions set to balanced score (50)', () => {
    const profile = createDefaultPersonalityProfile();
    expect(profile.dimensions.ei.score).toBe(50);
    expect(profile.dimensions.sn.score).toBe(50);
    expect(profile.dimensions.tf.score).toBe(50);
    expect(profile.dimensions.jp.score).toBe(50);
  });

  it('should have empty signals for all dimensions', () => {
    const profile = createDefaultPersonalityProfile();
    expect(profile.dimensions.ei.signals).toEqual([]);
    expect(profile.dimensions.sn.signals).toEqual([]);
    expect(profile.dimensions.tf.signals).toEqual([]);
    expect(profile.dimensions.jp.signals).toEqual([]);
  });

  it('should have zero overall confidence', () => {
    const profile = createDefaultPersonalityProfile();
    expect(profile.overallConfidence).toBe(0);
  });

  it('should have default insight for insufficient data', () => {
    const profile = createDefaultPersonalityProfile();
    expect(profile.dimensions.ei.insight).toBe('Insufficient data for analysis');
    expect(profile.dimensions.sn.insight).toBe('Insufficient data for analysis');
    expect(profile.dimensions.tf.insight).toBe('Insufficient data for analysis');
    expect(profile.dimensions.jp.insight).toBe('Insufficient data for analysis');
  });

  it('should have empty yongsin and gisin', () => {
    const profile = createDefaultPersonalityProfile();
    expect(profile.yongsin).toBe('');
    expect(profile.gisin).toBe('');
  });

  it('should have "Balanced" as gyeokguk', () => {
    const profile = createDefaultPersonalityProfile();
    expect(profile.gyeokguk).toBe('Balanced');
  });

  it('should have empty sangsaeng and sanggeuk arrays', () => {
    const profile = createDefaultPersonalityProfile();
    expect(profile.sangsaeng).toEqual([]);
    expect(profile.sanggeuk).toEqual([]);
  });
});
