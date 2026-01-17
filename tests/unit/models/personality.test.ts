/**
 * Personality Profile Schema Tests (Module B Output)
 *
 * Tests for internal personality analysis schema validation.
 * Module B extracts personality data using MBTI 4-axis + 사주-inspired techniques.
 *
 * IMPORTANT: This schema is for INTERNAL use only.
 * Users never see MBTI codes or psychological labels directly.
 *
 * NOTE: DimensionSignalSchema was FLATTENED in Jan 2026 to avoid Gemini API nesting depth limits.
 * The `signals` array was replaced with `signalsData` string (format: "type:evidence:confidence;...")
 */

import { describe, it, expect } from 'vitest';
import {
  PersonalityProfileSchema,
  DimensionAnalysisSchema,
  createDefaultPersonalityProfile,
  parseSignalsData,
  type DimensionSignal,
} from '../../../src/lib/models/personality.js';

describe('DimensionSignal type (legacy)', () => {
  // DimensionSignal is now a TypeScript type, not a Zod schema
  // These tests verify the parseSignalsData helper function

  describe('parseSignalsData', () => {
    it('should parse valid signalsData string', () => {
      const signalsData = 'message_brevity:Concise communication:0.8;direct_commands:Uses imperative sentences:0.7';
      const result = parseSignalsData(signalsData);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: 'message_brevity',
        evidence: 'Concise communication',
        confidence: 0.8,
      });
      expect(result[1]).toEqual({
        type: 'direct_commands',
        evidence: 'Uses imperative sentences',
        confidence: 0.7,
      });
    });

    it('should return empty array for undefined signalsData', () => {
      const result = parseSignalsData(undefined);
      expect(result).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      const result = parseSignalsData('');
      expect(result).toEqual([]);
    });

    it('should handle single signal', () => {
      const signalsData = 'test_type:test_evidence:0.5';
      const result = parseSignalsData(signalsData);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'test_type',
        evidence: 'test_evidence',
        confidence: 0.5,
      });
    });

    it('should handle missing parts gracefully', () => {
      const signalsData = 'type_only';
      const result = parseSignalsData(signalsData);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'type_only',
        evidence: '',
        confidence: 0,
      });
    });
  });
});

describe('DimensionAnalysisSchema', () => {
  // FLATTENED: signalsData is now a string, not an array
  const validDimension = {
    score: 35,
    signalsData: 'message_brevity:Concise communication style:0.8;direct_commands:Uses imperative sentences:0.7',
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

    it('should accept empty signalsData string', () => {
      const dimension = { ...validDimension, signalsData: '' };
      const result = DimensionAnalysisSchema.safeParse(dimension);
      expect(result.success).toBe(true);
    });

    it('should accept missing signalsData (optional)', () => {
      const { signalsData: _, ...dimensionWithoutSignals } = validDimension;
      const result = DimensionAnalysisSchema.safeParse(dimensionWithoutSignals);
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

    it('should FAIL when insight is missing', () => {
      const { insight: _insight, ...dimensionWithoutInsight } = validDimension;
      const result = DimensionAnalysisSchema.safeParse(dimensionWithoutInsight);
      expect(result.success).toBe(false);
    });
  });
});

describe('PersonalityProfileSchema', () => {
  // FLATTENED: signalsData is now a string, not an array
  const validDimension = {
    score: 50,
    signalsData: 'test_signal:Test evidence:0.7',
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

  it('should have empty signalsData for all dimensions', () => {
    const profile = createDefaultPersonalityProfile();
    expect(profile.dimensions.ei.signalsData).toBe('');
    expect(profile.dimensions.sn.signalsData).toBe('');
    expect(profile.dimensions.tf.signalsData).toBe('');
    expect(profile.dimensions.jp.signalsData).toBe('');
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
