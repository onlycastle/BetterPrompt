/**
 * Language Detection Tests
 *
 * Tests for detectPrimaryLanguage(), which determines the primary language
 * from developer utterances to decide if Phase 4 (Translation) should run.
 */

import { describe, it, expect } from 'vitest';
import { detectPrimaryLanguage } from '../../../../src/lib/analyzer/stages/content-writer-prompts.js';

describe('detectPrimaryLanguage', () => {
  it('should detect pure Korean text as Korean', () => {
    const result = detectPrimaryLanguage(['안녕하세요 이것은 한국어 텍스트입니다']);
    expect(result.primary).toBe('ko');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.hasNonEnglish).toBe(true);
  });

  it('should detect pure English text as English', () => {
    const result = detectPrimaryLanguage(['Hello this is a test message in English']);
    expect(result.primary).toBe('en');
    expect(result.hasNonEnglish).toBe(false);
  });

  it('should detect mixed Korean/English developer session as Korean', () => {
    // Realistic developer session: Korean instructions mixed with English technical terms
    const texts = [
      '이 함수 수정해줘',
      'src/components/Header.tsx 파일에서 에러나',
      'npm run build 해봐',
      '타입 에러 고쳐줘',
      'git commit 하고 push 해줘',
    ];
    const result = detectPrimaryLanguage(texts);
    expect(result.primary).toBe('ko');
    expect(result.hasNonEnglish).toBe(true);
  });

  it('should detect Korean even when surrounded by lots of English code context', () => {
    // Short Korean phrases mixed with heavy English technical content
    const texts = [
      '응',
      'npm 이 1.0.2면 curl/Source도 1.0.2로 맞춰져야하는거아니야?',
      'fix the TypeScript error in src/lib/analyzer/stages/content-writer-prompts.ts',
      'run the test suite and check for failures',
      '좋아 그렇게 해',
    ];
    const result = detectPrimaryLanguage(texts);
    expect(result.primary).toBe('ko');
    expect(result.hasNonEnglish).toBe(true);
    expect(result.charCounts.korean).toBeGreaterThan(0);
  });

  it('should handle single-char Korean like "응"', () => {
    // Single Korean char among English - likely below even 5% threshold,
    // but we verify the charCounts reflect the Korean presence
    const result = detectPrimaryLanguage(['응']);
    expect(result.primary).toBe('ko');
    expect(result.charCounts.korean).toBe(1);
    expect(result.hasNonEnglish).toBe(true);
  });

  it('should return English for empty input', () => {
    const result = detectPrimaryLanguage([]);
    expect(result.primary).toBe('en');
    expect(result.confidence).toBe(1.0);
    expect(result.hasNonEnglish).toBe(false);
    expect(result.charCounts.total).toBe(0);
  });

  it('should return English for empty strings', () => {
    const result = detectPrimaryLanguage(['', '   ']);
    expect(result.primary).toBe('en');
    expect(result.charCounts.total).toBe(0);
  });

  it('should detect Japanese text (Hiragana/Katakana)', () => {
    const result = detectPrimaryLanguage(['これはテストです']);
    expect(result.primary).toBe('ja');
    expect(result.hasNonEnglish).toBe(true);
    expect(result.charCounts.japanese).toBeGreaterThan(0);
  });

  it('should detect Chinese text (CJK ideographs without Japanese kana)', () => {
    const result = detectPrimaryLanguage(['这是一个测试消息']);
    expect(result.primary).toBe('zh');
    expect(result.hasNonEnglish).toBe(true);
    expect(result.charCounts.chinese).toBeGreaterThan(0);
  });

  it('should use 5% threshold for Korean detection in mixed content', () => {
    // Create text where Korean is ~8% of meaningful characters
    // 8 Korean chars + 92 English chars = 8% Korean
    const koreanPart = '수정해줘 확인';  // 6 Hangul characters
    const englishPart = 'a'.repeat(94);   // 94 English characters → 6/100 = 6%
    const result = detectPrimaryLanguage([koreanPart, englishPart]);
    expect(result.primary).toBe('ko');
    expect(result.confidence).toBeGreaterThanOrEqual(0.05);
  });

  it('should NOT detect Korean when ratio is below 5% threshold', () => {
    // 2 Korean chars + 100 English chars ≈ 2% Korean
    const koreanPart = '응';  // 1 Hangul character
    const englishPart = 'a'.repeat(100);  // 100 English characters → 1/101 ≈ 1%
    const result = detectPrimaryLanguage([koreanPart, englishPart]);
    expect(result.primary).toBe('en');
    expect(result.hasNonEnglish).toBe(true); // Korean chars exist, just below threshold
  });

  it('should prioritize Korean over Japanese when both present', () => {
    // Korean and Japanese text mixed - Korean should take priority
    const result = detectPrimaryLanguage(['한국어 テスト']);
    expect(result.charCounts.korean).toBeGreaterThan(0);
    expect(result.charCounts.japanese).toBeGreaterThan(0);
    // Korean takes priority per the function's documented behavior
    if (result.charCounts.korean >= result.charCounts.japanese) {
      expect(result.primary).toBe('ko');
    }
  });

  it('should correctly count character types', () => {
    const result = detectPrimaryLanguage(['한글abc漢字ひらがな']);
    expect(result.charCounts.korean).toBe(2);      // 한, 글
    expect(result.charCounts.chinese).toBe(2);      // 漢, 字
    expect(result.charCounts.japanese).toBe(4);     // ひ, ら, が, な
    expect(result.charCounts.total).toBe(11);       // 2 + 3 + 2 + 4
  });
});
