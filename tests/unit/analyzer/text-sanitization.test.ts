import { describe, it, expect } from 'vitest';

/**
 * Test utilities for text sanitization functions.
 *
 * IMPLEMENTATION LOCATIONS:
 * - DataExtractorWorker.sanitizeDisplayText() - src/lib/analyzer/workers/data-extractor-worker.ts
 * - smartTruncate() - src/lib/analyzer/stages/evaluation-assembler.ts
 *
 * NOTE: These tests use reimplemented versions of the functions because
 * the actual implementations are private (sanitizeDisplayText) or module-scoped
 * (smartTruncate). When modifying the actual implementations, ensure these
 * test implementations are kept in sync.
 *
 * SYNC CHECK: If tests pass but production code behaves differently,
 * compare the logic below with the actual implementations.
 */

// Reimplementation of sanitizeDisplayText for testing
// SYNC WITH: DataExtractorWorker.sanitizeDisplayText() in data-extractor-worker.ts
function sanitizeDisplayText(text: string): string {
  // Fix vertical text with iterative replacement (handles any length)
  let result = text;
  let prev = '';
  while (result !== prev) {
    prev = result;
    result = result.replace(/(.)\n(.)/g, '$1$2');
  }

  return result
    // Strip markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Strip markdown bold
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
    // Strip markdown inline code
    .replace(/`([^`]+)`/g, '$1')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// Reimplementation of smartTruncate for testing
// SYNC WITH: smartTruncate() in evaluation-assembler.ts
function smartTruncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;

  const sentenceEndPatterns = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
  let bestSentenceEnd = -1;
  const minSentencePos = maxLen * 0.7;

  for (const pattern of sentenceEndPatterns) {
    const pos = text.lastIndexOf(pattern, maxLen - 3);
    if (pos > minSentencePos && pos > bestSentenceEnd) {
      bestSentenceEnd = pos;
    }
  }

  if (bestSentenceEnd > 0) {
    return text.slice(0, bestSentenceEnd + 1);
  }

  const minWordPos = maxLen * 0.8;
  const lastSpace = text.lastIndexOf(' ', maxLen - 4);

  if (lastSpace > minWordPos) {
    return text.slice(0, lastSpace) + '...';
  }

  return text.slice(0, maxLen - 3) + '...';
}

describe('sanitizeDisplayText', () => {
  describe('vertical text fix', () => {
    it('removes newlines between individual characters', () => {
      expect(sanitizeDisplayText('S\nu\np\na')).toBe('Supa');
    });

    it('removes newlines in longer vertical text', () => {
      expect(sanitizeDisplayText('S\nu\np\na\nb\na\ns\ne')).toBe('Supabase');
    });

    it('preserves normal text with words', () => {
      expect(sanitizeDisplayText('Hello world')).toBe('Hello world');
    });

    it('handles mixed vertical and normal text', () => {
      expect(sanitizeDisplayText('Using S\nu\np\na for auth')).toBe('Using Supa for auth');
    });
  });

  describe('markdown stripping', () => {
    it('strips h1 headers', () => {
      expect(sanitizeDisplayText('# Ship-It')).toBe('Ship-It');
    });

    it('strips h2 headers', () => {
      expect(sanitizeDisplayText('## Section Title')).toBe('Section Title');
    });

    it('strips h3-h6 headers', () => {
      expect(sanitizeDisplayText('### Level 3')).toBe('Level 3');
      expect(sanitizeDisplayText('###### Level 6')).toBe('Level 6');
    });

    it('strips bold with double asterisks', () => {
      expect(sanitizeDisplayText('This is **important** text')).toBe('This is important text');
    });

    it('strips italic with single asterisks', () => {
      expect(sanitizeDisplayText('This is *emphasized* text')).toBe('This is emphasized text');
    });

    it('strips bold with underscores', () => {
      expect(sanitizeDisplayText('This is __bold__ text')).toBe('This is bold text');
    });

    it('strips inline code', () => {
      expect(sanitizeDisplayText('Run `npm install` to start')).toBe('Run npm install to start');
    });

    it('handles multiple markdown elements', () => {
      expect(sanitizeDisplayText('# Title with **bold** and `code`')).toBe('Title with bold and code');
    });
  });

  describe('whitespace normalization', () => {
    it('collapses multiple spaces', () => {
      expect(sanitizeDisplayText('hello    world')).toBe('hello world');
    });

    it('normalizes tabs', () => {
      expect(sanitizeDisplayText('hello\tworld')).toBe('hello world');
    });

    it('trims leading and trailing whitespace', () => {
      expect(sanitizeDisplayText('  hello world  ')).toBe('hello world');
    });

    it('handles complex whitespace', () => {
      expect(sanitizeDisplayText('  hello   \n  world  \t  ')).toBe('hello world');
    });
  });

  describe('combined scenarios', () => {
    it('handles real-world vertical text with markdown', () => {
      const input = '# S\nu\np\na\nb\na\ns\ne SSR 패턴';
      expect(sanitizeDisplayText(input)).toBe('Supabase SSR 패턴');
    });

    it('preserves Korean text correctly', () => {
      expect(sanitizeDisplayText('이것은 **중요한** 텍스트입니다')).toBe('이것은 중요한 텍스트입니다');
    });
  });
});

describe('smartTruncate', () => {
  describe('no truncation needed', () => {
    it('returns original text when under maxLen', () => {
      expect(smartTruncate('short text', 100)).toBe('short text');
    });

    it('returns original text when exactly at maxLen', () => {
      expect(smartTruncate('12345', 5)).toBe('12345');
    });
  });

  describe('sentence boundary truncation', () => {
    it('truncates at sentence boundary with period when within 70% threshold', () => {
      // Sentence ends at position 40, which is 80% of 50 (>70%)
      const text = 'This is a complete sentence ending here. And more text follows after that.';
      expect(smartTruncate(text, 50)).toBe('This is a complete sentence ending here.');
    });

    it('truncates at sentence boundary with exclamation', () => {
      // "! " pattern is at position 20, need 70% threshold
      // For position 20 to be >= 70%, maxLen should be at most 28.5
      const text = 'This is really great! And then more text continues here.';
      // 20 >= 70% of 28 (19.6), so maxLen=28 should work
      expect(smartTruncate(text, 28)).toBe('This is really great!');
    });

    it('truncates at sentence boundary with question mark', () => {
      // "Is this working?" ends at 16, 80% of 20
      const text = 'Is this working? Yes it is and more.';
      expect(smartTruncate(text, 20)).toBe('Is this working?');
    });

    it('ignores sentence boundary if too early (under 70%)', () => {
      const text = 'A. Very long sentence that continues for a while and goes on.';
      // "A." is at position 1, which is under 70% of 50 (35)
      const result = smartTruncate(text, 50);
      expect(result).not.toBe('A.');
      // Should fall back to word boundary
      expect(result).toContain('...');
    });
  });

  describe('word boundary truncation', () => {
    it('truncates at word boundary with ellipsis', () => {
      const text = 'Hello world test example';
      expect(smartTruncate(text, 14)).toBe('Hello world...');
    });

    it('truncates at word boundary for longer text', () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const result = smartTruncate(text, 25);
      expect(result).toMatch(/\.\.\.$/);
      expect(result.length).toBeLessThanOrEqual(25);
    });
  });

  describe('hard cut fallback', () => {
    it('falls back to hard cut when no good boundary', () => {
      const text = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // No spaces or sentences
      expect(smartTruncate(text, 10)).toBe('aaaaaaa...');
    });
  });

  describe('real-world scenarios', () => {
    it('truncates at word boundary before parenthesis when possible', () => {
      // This tests that we prefer natural boundaries
      const text = 'Check the file for more details about configuration.';
      const result = smartTruncate(text, 40);
      // Should truncate at a word boundary, not mid-word
      expect(result).toMatch(/\.\.\.$/);
      expect(result.length).toBeLessThanOrEqual(40);
    });

    it('truncates Korean text at sentence boundary', () => {
      // "짧은 문장입니다." is 8 chars (including period)
      // 8 chars needs to be >= 70% of maxLen, so maxLen <= 11
      const text = '짧은 문장입니다. 두 번째 문장은 더 길어요.';
      const result = smartTruncate(text, 11);
      expect(result).toBe('짧은 문장입니다.');
    });

    it('handles mixed English and Korean at sentence boundary', () => {
      // "Hello 세상아." is 9 chars, which is 75% of 12 (>70%)
      const text = 'Hello 세상아. How are you today?';
      const result = smartTruncate(text, 12);
      expect(result).toBe('Hello 세상아.');
    });

    it('uses ellipsis for word boundary when no sentence fits', () => {
      const text = 'This is a very long text without any sentence boundaries just words';
      const result = smartTruncate(text, 30);
      expect(result).toMatch(/\.\.\.$/);
      expect(result.length).toBeLessThanOrEqual(30);
    });
  });
});
