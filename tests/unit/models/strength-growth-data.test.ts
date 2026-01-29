/**
 * StrengthGrowth Data Parser Tests
 *
 * Tests for parseEvidenceData() with the C1 fix:
 * Uses utteranceId pattern as structural anchor to handle
 * colons and commas within developer quotes.
 */

import { describe, it, expect } from 'vitest';
import { parseEvidenceData, parseStrengthsLLMData, parseGrowthAreasLLMData } from '../../../src/lib/models/strength-growth-data.js';
import { isValidDimension, validateDimension } from '../../../src/lib/models/dimension-schema.js';

describe('parseEvidenceData (C1 fix: delimiter collision)', () => {
  it('should parse simple evidence without special characters', () => {
    const data = 'abc123_5:fix the bug:debugging';
    const result = parseEvidenceData(data);
    expect(result).toHaveLength(1);
    expect(result[0].utteranceId).toBe('abc123_5');
    expect(result[0].quote).toBe('fix the bug:debugging');
  });

  it('should handle colons within quotes', () => {
    const data = 'sess1_5:fix this: auth is broken:debug context';
    const result = parseEvidenceData(data);
    expect(result).toHaveLength(1);
    expect(result[0].utteranceId).toBe('sess1_5');
    expect(result[0].quote).toBe('fix this: auth is broken:debug context');
  });

  it('should handle commas within quotes by using utteranceId anchoring', () => {
    const data = 'sess1_5:first, let me check this:review,sess1_12:second entry:context';
    const result = parseEvidenceData(data);
    expect(result).toHaveLength(2);
    expect(result[0].utteranceId).toBe('sess1_5');
    expect(result[0].quote).toBe('first, let me check this:review');
    expect(result[1].utteranceId).toBe('sess1_12');
    expect(result[1].quote).toBe('second entry:context');
  });

  it('should handle both colons and commas in quotes', () => {
    const data = 'a1b2c3-d4e5_5:fix this: auth is broken, and needs work:debug,a1b2c3-d4e5_12:first, let me check:review';
    const result = parseEvidenceData(data);
    expect(result).toHaveLength(2);
    expect(result[0].utteranceId).toBe('a1b2c3-d4e5_5');
    expect(result[0].quote).toBe('fix this: auth is broken, and needs work:debug');
    expect(result[1].utteranceId).toBe('a1b2c3-d4e5_12');
    expect(result[1].quote).toBe('first, let me check:review');
  });

  it('should handle UUID-style session IDs', () => {
    const data = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890_42:complex quote: with colons, and commas:context info';
    const result = parseEvidenceData(data);
    expect(result).toHaveLength(1);
    expect(result[0].utteranceId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890_42');
    expect(result[0].quote).toBe('complex quote: with colons, and commas:context info');
  });

  it('should return empty array for undefined input', () => {
    expect(parseEvidenceData(undefined)).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    expect(parseEvidenceData('')).toEqual([]);
    expect(parseEvidenceData('   ')).toEqual([]);
  });

  it('should filter entries without a quote', () => {
    const data = 'sess1_5:';
    const result = parseEvidenceData(data);
    expect(result).toHaveLength(0);
  });

  it('should handle multiple entries with various special characters', () => {
    const data = 'abc_1:this has: many, special; chars:ctx,def_2:another "quoted" entry:ctx2';
    const result = parseEvidenceData(data);
    expect(result).toHaveLength(2);
    expect(result[0].utteranceId).toBe('abc_1');
    expect(result[0].quote).toContain('many, special; chars');
    expect(result[1].utteranceId).toBe('def_2');
    expect(result[1].quote).toContain('"quoted"');
  });
});

// ============================================================================
// Dimension Validation Utilities
// ============================================================================

describe('isValidDimension', () => {
  it('should return true for valid dimensions', () => {
    expect(isValidDimension('aiCollaboration')).toBe(true);
    expect(isValidDimension('burnoutRisk')).toBe(true);
    expect(isValidDimension('contextEngineering')).toBe(true);
    expect(isValidDimension('toolMastery')).toBe(true);
    expect(isValidDimension('aiControl')).toBe(true);
    expect(isValidDimension('skillResilience')).toBe(true);
  });

  it('should return false for invalid dimensions', () => {
    expect(isValidDimension('')).toBe(false);
    expect(isValidDimension('nonExistent')).toBe(false);
  });
});

describe('validateDimension', () => {
  it('should return valid dimensions as-is', () => {
    expect(validateDimension('aiControl')).toBe('aiControl');
    expect(validateDimension('burnoutRisk')).toBe('burnoutRisk');
    expect(validateDimension('contextEngineering')).toBe('contextEngineering');
  });

  it('should default unknown to aiCollaboration', () => {
    expect(validateDimension('fooBar')).toBe('aiCollaboration');
    expect(validateDimension('nonExistentDimension')).toBe('aiCollaboration');
  });

  it('should handle undefined and empty string', () => {
    expect(validateDimension(undefined)).toBe('aiCollaboration');
    expect(validateDimension('')).toBe('aiCollaboration');
    expect(validateDimension('  ')).toBe('aiCollaboration');
  });

  it('should trim whitespace before validation', () => {
    expect(validateDimension('  aiControl  ')).toBe('aiControl');
  });
});

// ============================================================================
// Dimension Validation in LLM Parsing
// ============================================================================

describe('dimension validation in parseStrengthsLLMData', () => {
  it('should accept valid dimensions', () => {
    const data = 'Test Strength|description|aiControl|tip|sess_1:quote:ctx';
    const result = parseStrengthsLLMData(data);
    expect(result[0].dimension).toBe('aiControl');
  });

  it('should default unknown dimensions to aiCollaboration', () => {
    const data = 'Test|desc|nonExistentDimension|tip|sess_1:quote:ctx';
    const result = parseStrengthsLLMData(data);
    expect(result[0].dimension).toBe('aiCollaboration');
  });

  it('should default empty dimension to aiCollaboration', () => {
    const data = 'Test|desc||tip|sess_1:quote:ctx';
    const result = parseStrengthsLLMData(data);
    expect(result[0].dimension).toBe('aiCollaboration');
  });
});

describe('dimension validation in parseGrowthAreasLLMData', () => {
  it('should accept valid dimensions', () => {
    const data = 'Test|desc|burnoutRisk|rec|50|high|75|sess_1:q:ctx';
    const result = parseGrowthAreasLLMData(data);
    expect(result[0].dimension).toBe('burnoutRisk');
  });

  it('should default unknown dimensions to aiCollaboration', () => {
    const data = 'Test|desc|unknownDim|rec|50|high|75|sess_1:q:ctx';
    const result = parseGrowthAreasLLMData(data);
    expect(result[0].dimension).toBe('aiCollaboration');
  });
});
