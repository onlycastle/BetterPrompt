/**
 * StrengthGrowth Data Parser Tests
 *
 * Tests for parseEvidenceData() with the C1 fix:
 * Uses utteranceId pattern as structural anchor to handle
 * colons and commas within developer quotes.
 */

import { describe, it, expect } from 'vitest';
import { parseEvidenceData } from '../../../src/lib/models/strength-growth-data.js';

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
