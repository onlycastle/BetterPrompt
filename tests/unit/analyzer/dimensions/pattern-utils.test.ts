import { describe, it, expect } from 'vitest';
import {
  countMatches,
  hasMatch,
  countIfAtLeast,
  filterPascalCaseMatches,
  PATTERNS,
  PASCAL_CASE_EXCLUSIONS,
} from '../../../../src/analyzer/dimensions/pattern-utils.js';

describe('Pattern Utils', () => {
  describe('countMatches', () => {
    it('should count all matches of a pattern', () => {
      const text = 'hello world hello universe';
      const pattern = /hello/gi;

      expect(countMatches(text, pattern)).toBe(2);
    });

    it('should return 0 for no matches', () => {
      const text = 'hello world';
      const pattern = /xyz/gi;

      expect(countMatches(text, pattern)).toBe(0);
    });

    it('should handle empty string', () => {
      expect(countMatches('', /test/gi)).toBe(0);
    });

    it('should be case insensitive with i flag', () => {
      const text = 'Hello HELLO hello';
      const pattern = /hello/gi;

      expect(countMatches(text, pattern)).toBe(3);
    });

    it('should handle multiple different matches', () => {
      const text = 'cat and dog and cat';
      const pattern = /cat|dog/gi;

      expect(countMatches(text, pattern)).toBe(3);
    });
  });

  describe('hasMatch', () => {
    it('should return true when match exists', () => {
      expect(hasMatch('hello world', /world/)).toBe(true);
    });

    it('should return false when no match exists', () => {
      expect(hasMatch('hello world', /xyz/)).toBe(false);
    });

    it('should handle empty string', () => {
      expect(hasMatch('', /test/)).toBe(false);
    });

    it('should work with complex patterns', () => {
      expect(hasMatch('function test() {}', /function\s+\w+/)).toBe(true);
    });
  });

  describe('countIfAtLeast', () => {
    it('should return count when above threshold', () => {
      const text = 'one two three four';
      const pattern = /\b\w+\b/gi;

      expect(countIfAtLeast(text, pattern, 3)).toBe(4);
    });

    it('should return 0 when below threshold', () => {
      const text = 'one two';
      const pattern = /\b\w+\b/gi;

      expect(countIfAtLeast(text, pattern, 5)).toBe(0);
    });

    it('should return count when exactly at threshold', () => {
      const text = 'one two three';
      const pattern = /\b\w+\b/gi;

      expect(countIfAtLeast(text, pattern, 3)).toBe(3);
    });

    it('should return 0 for no matches regardless of threshold', () => {
      expect(countIfAtLeast('hello', /xyz/gi, 0)).toBe(0);
    });
  });

  describe('filterPascalCaseMatches', () => {
    it('should remove common false positives', () => {
      const matches = ['UserComponent', 'The', 'This', 'ReactApp'];

      const filtered = filterPascalCaseMatches(matches);

      expect(filtered).toContain('UserComponent');
      expect(filtered).toContain('ReactApp');
      expect(filtered).not.toContain('The');
      expect(filtered).not.toContain('This');
    });

    it('should keep valid PascalCase names', () => {
      const matches = ['UserService', 'ApiClient', 'DataManager'];

      const filtered = filterPascalCaseMatches(matches);

      expect(filtered).toHaveLength(3);
      expect(filtered).toEqual(matches);
    });

    it('should handle empty array', () => {
      expect(filterPascalCaseMatches([])).toEqual([]);
    });

    it('should filter all exclusions', () => {
      const filtered = filterPascalCaseMatches([...PASCAL_CASE_EXCLUSIONS]);

      expect(filtered).toHaveLength(0);
    });
  });

  describe('PATTERNS', () => {
    describe('filePath pattern', () => {
      it('should match src/ paths', () => {
        expect(PATTERNS.filePath.test('src/components/Button.tsx')).toBe(true);
      });

      it('should match ./ relative paths', () => {
        expect(PATTERNS.filePath.test('./utils/helper.ts')).toBe(true);
      });

      it('should match common file extensions', () => {
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.md', '.json'];
        for (const ext of extensions) {
          const text = `file${ext}`;
          PATTERNS.filePath.lastIndex = 0;
          expect(hasMatch(text, PATTERNS.filePath)).toBe(true);
        }
      });
    });

    describe('fileLine pattern', () => {
      it('should match file:line patterns', () => {
        PATTERNS.fileLine.lastIndex = 0;
        expect(PATTERNS.fileLine.test('src/index.ts:42')).toBe(true);
      });

      it('should match various extensions with line numbers', () => {
        PATTERNS.fileLine.lastIndex = 0;
        expect(PATTERNS.fileLine.test('app.py:100')).toBe(true);
      });
    });

    describe('constraints pattern', () => {
      it('should match constraint keywords', () => {
        const constraintWords = ['must', 'should not', 'cannot', 'required', 'only', 'never', 'always'];

        for (const word of constraintWords) {
          PATTERNS.constraints.lastIndex = 0;
          expect(hasMatch(`This ${word} be done`, PATTERNS.constraints)).toBe(true);
        }
      });
    });

    describe('steps pattern', () => {
      it('should match numbered steps', () => {
        PATTERNS.steps.lastIndex = 0;
        expect(hasMatch('Step 1: Do this', PATTERNS.steps)).toBe(true);
      });

      it('should match ordinal markers', () => {
        const markers = ['first,', 'second,', 'then,', 'finally,'];

        for (const marker of markers) {
          PATTERNS.steps.lastIndex = 0;
          expect(hasMatch(marker, PATTERNS.steps)).toBe(true);
        }
      });

      it('should match numbered lists', () => {
        // The pattern matches "step 1", "1.", "2.", etc but requires specific format
        // Pattern: /\b(step\s*\d|first[,:]|second[,:]|then[,:]|next[,:]|finally[,:]|1\.|2\.|3\.|\d\)\s)/gi
        PATTERNS.steps.lastIndex = 0;
        expect(hasMatch('1.', PATTERNS.steps)).toBe(true);
        PATTERNS.steps.lastIndex = 0;
        // Note: the pattern specifically matches "1." with a dot, testing both formats
        expect(hasMatch('1) First item', PATTERNS.steps)).toBe(true);
      });
    });

    describe('review pattern', () => {
      it('should match review-related words', () => {
        const reviewWords = ['review', 'check', 'verify', 'double-check', 'examine', 'validate'];

        for (const word of reviewWords) {
          PATTERNS.review.lastIndex = 0;
          expect(hasMatch(`Please ${word} this code`, PATTERNS.review)).toBe(true);
        }
      });
    });

    describe('test pattern', () => {
      it('should match test commands', () => {
        const testCommands = ['npm test', 'yarn test', 'pytest', 'jest', 'vitest'];

        for (const cmd of testCommands) {
          PATTERNS.test.lastIndex = 0;
          expect(hasMatch(cmd, PATTERNS.test)).toBe(true);
        }
      });

      it('should match test-related keywords', () => {
        // Pattern: /\b(test|npm test|yarn test|pytest|jest|vitest|run tests|unit test|integration test)\b/gi
        // 'unit tests' won't match but 'unit test' (singular) should
        PATTERNS.test.lastIndex = 0;
        expect(hasMatch('run tests', PATTERNS.test)).toBe(true);
        PATTERNS.test.lastIndex = 0;
        expect(hasMatch('run a unit test', PATTERNS.test)).toBe(true);
      });
    });

    describe('modification pattern', () => {
      it('should match modification keywords', () => {
        const modWords = ['change', 'fix', 'update', 'modify', 'wrong', 'error'];

        for (const word of modWords) {
          PATTERNS.modification.lastIndex = 0;
          expect(hasMatch(`Please ${word} this`, PATTERNS.modification)).toBe(true);
        }
      });
    });

    describe('correction pattern', () => {
      it('should match correction indicators', () => {
        // Pattern: /\b(wrong|incorrect|error|mistake|not right|that's not|no,|actually,?|wait,?|but that|however)\b/gi
        // Note: some words like 'no,' require word boundaries, so standalone 'no,' may not match
        const corrections = ['wrong', 'incorrect', 'mistake', 'actually', 'wait'];

        for (const word of corrections) {
          PATTERNS.correction.lastIndex = 0;
          expect(hasMatch(`This is ${word}`, PATTERNS.correction)).toBe(true);
        }
      });

      it('should match correction patterns in context', () => {
        PATTERNS.correction.lastIndex = 0;
        expect(hasMatch("that's not correct", PATTERNS.correction)).toBe(true);
        PATTERNS.correction.lastIndex = 0;
        expect(hasMatch('however, I think', PATTERNS.correction)).toBe(true);
      });
    });

    describe('question pattern', () => {
      it('should match question marks', () => {
        PATTERNS.question.lastIndex = 0;
        expect(hasMatch('What is this?', PATTERNS.question)).toBe(true);
      });

      it('should match question starters', () => {
        const starters = ['what', 'why', 'how', 'when', 'where', 'which', 'can you', 'could you'];

        for (const starter of starters) {
          PATTERNS.question.lastIndex = 0;
          expect(hasMatch(`${starter} do this`, PATTERNS.question)).toBe(true);
        }
      });
    });

    describe('vagueStart pattern', () => {
      it('should match vague conversation starters', () => {
        expect(PATTERNS.vagueStart.test('help me with this')).toBe(true);
        expect(PATTERNS.vagueStart.test('hi can you')).toBe(true);
        expect(PATTERNS.vagueStart.test('hello')).toBe(true);
        expect(PATTERNS.vagueStart.test('please do something')).toBe(true);
      });

      it('should not match specific task requests', () => {
        expect(PATTERNS.vagueStart.test('implement the login feature')).toBe(false);
        expect(PATTERNS.vagueStart.test('refactor this function')).toBe(false);
      });
    });

    describe('detailedStart pattern', () => {
      it('should match specific task requests', () => {
        expect(PATTERNS.detailedStart.test('implement the auth module')).toBe(true);
        expect(PATTERNS.detailedStart.test('create a new component')).toBe(true);
        expect(PATTERNS.detailedStart.test('fix the bug in login')).toBe(true);
        expect(PATTERNS.detailedStart.test('refactor this function')).toBe(true);
      });
    });

    describe('codeBlock pattern', () => {
      it('should match fenced code blocks', () => {
        expect(PATTERNS.codeBlock.test('```javascript\ncode here\n```')).toBe(true);
      });

      it('should match inline code', () => {
        expect(PATTERNS.codeBlock.test('use `console.log()` for debugging')).toBe(true);
      });
    });

    describe('explanationRequest pattern', () => {
      it('should match explanation requests', () => {
        const requests = ['explain this', 'what does this do', 'how does this work', 'describe the process'];

        for (const req of requests) {
          PATTERNS.explanationRequest.lastIndex = 0;
          expect(hasMatch(req, PATTERNS.explanationRequest)).toBe(true);
        }
      });
    });
  });
});
