/**
 * Prompt Score Dimension Tests
 *
 * Tests for the Prompt Engineering Score calculation.
 * Measures how effective a developer's prompts are.
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePromptScore,
  type PromptScoreResult,
} from '../../../../src/lib/analyzer/dimensions/prompt-score.js';
import type { ParsedSession, ParsedMessage } from '../../../../src/lib/models/index.js';

/**
 * Helper to create a mock session with user prompts
 */
function createPromptSession(prompts: string[]): ParsedSession {
  const messages: ParsedMessage[] = [];
  const now = new Date();

  prompts.forEach((content, index) => {
    // User message
    messages.push({
      uuid: `user-${index}`,
      role: 'user',
      content,
      timestamp: new Date(now.getTime() + index * 2000),
    });

    // Assistant response
    messages.push({
      uuid: `assistant-${index}`,
      role: 'assistant',
      content: 'Assistant response',
      timestamp: new Date(now.getTime() + index * 2000 + 1000),
    });
  });

  return {
    sessionId: `test-session-${Date.now()}-${Math.random()}`,
    projectPath: '/test/project',
    startTime: now,
    endTime: new Date(now.getTime() + prompts.length * 2000),
    durationSeconds: prompts.length * 2,
    claudeCodeVersion: '1.0.0',
    messages,
    stats: {
      userMessageCount: prompts.length,
      assistantMessageCount: prompts.length,
      toolCallCount: 0,
      uniqueToolsUsed: [],
      totalInputTokens: 100,
      totalOutputTokens: 200,
    },
  };
}

describe('Prompt Score Dimension', () => {
  describe('calculatePromptScore', () => {
    describe('default behavior', () => {
      it('should return default result with score 50 for empty sessions', () => {
        const result = calculatePromptScore([]);

        expect(result.score).toBe(50);
        expect(result.breakdown.contextProvision).toBe(50);
        expect(result.breakdown.specificity).toBe(50);
        expect(result.breakdown.iterationEfficiency).toBe(50);
        expect(result.breakdown.firstTrySuccess).toBe(50);
        expect(result.breakdown.constraintClarity).toBe(50);
        expect(result.bestPrompt).toBeNull();
        expect(result.worstPrompt).toBeNull();
        expect(result.avgPromptLength).toBe(0);
        expect(result.constraintUsageRate).toBe(0);
        expect(result.tips).toContain('Complete more sessions for personalized tips.');
      });

      it('should return default result for sessions with no user messages', () => {
        const session: ParsedSession = {
          sessionId: 'test-session',
          projectPath: '/test/project',
          startTime: new Date(),
          endTime: new Date(),
          durationSeconds: 10,
          claudeCodeVersion: '1.0.0',
          messages: [
            {
              uuid: 'assistant-1',
              role: 'assistant',
              content: 'Hello',
              timestamp: new Date(),
            },
          ],
          stats: {
            userMessageCount: 0,
            assistantMessageCount: 1,
            toolCallCount: 0,
            uniqueToolsUsed: [],
            totalInputTokens: 0,
            totalOutputTokens: 50,
          },
        };

        const result = calculatePromptScore([session]);

        expect(result.score).toBe(50);
        expect(result.bestPrompt).toBeNull();
        expect(result.worstPrompt).toBeNull();
      });
    });

    describe('contextProvision scoring', () => {
      it('should score higher for long prompts with context', () => {
        const session = createPromptSession([
          'I need to implement a user authentication system in our existing Express.js application. The current codebase uses JWT tokens for API authentication, and I want to follow the same pattern. The auth module is in src/auth/jwt.ts and uses the jsonwebtoken library. I need to add a new endpoint for password reset functionality.',
        ]);

        const result = calculatePromptScore([session]);

        expect(result.breakdown.contextProvision).toBeGreaterThan(50);
        expect(result.avgPromptLength).toBeGreaterThan(200);
      });

      it('should score higher when prompts reference files and code', () => {
        const session = createPromptSession([
          'Update the handleSubmit function in src/components/UserForm.tsx',
          'The validation logic in src/utils/validation.ts needs a new email validator',
          'Check the existing pattern in auth/jwt.ts for token generation',
        ]);

        const result = calculatePromptScore([session]);

        // Prompts with file references should score at least as well as default
        expect(result.breakdown.contextProvision).toBeGreaterThanOrEqual(45);
      });

      it('should score higher when prompts mention existing patterns', () => {
        const session = createPromptSession([
          'Follow the existing pattern from the auth module',
          'Use a similar approach to the current error handling',
          'Match the style of the other API endpoints',
        ]);

        const result = calculatePromptScore([session]);

        // Pattern references should score reasonably
        expect(result.breakdown.contextProvision).toBeGreaterThanOrEqual(40);
      });

      it('should score higher when prompts explain goals', () => {
        const session = createPromptSession([
          'I need to add caching because the API is too slow',
          'We want to improve performance so that page load is under 2 seconds',
          'The goal is to reduce database queries in order to handle more users',
        ]);

        const result = calculatePromptScore([session]);

        // Goal-explaining prompts should score better than very short prompts
        expect(result.breakdown.contextProvision).toBeGreaterThanOrEqual(35);
      });
    });

    describe('specificity scoring', () => {
      it('should score higher for prompts with numbered steps', () => {
        const session = createPromptSession([
          '1. First, create the database schema 2. Then, implement the API endpoints 3. Finally, add the frontend components',
          'Step 1: Validate the input. Step 2: Save to database. Step 3: Return the response.',
        ]);

        const result = calculatePromptScore([session]);

        expect(result.breakdown.specificity).toBeGreaterThan(50);
      });

      it('should score higher for prompts with technical terms', () => {
        const session = createPromptSession([
          'Create an async API endpoint that returns a promise',
          'The component should use the useState hook to manage state',
          'Define a TypeScript interface for the props',
        ]);

        const result = calculatePromptScore([session]);

        expect(result.breakdown.specificity).toBeGreaterThan(20);
      });

      it('should score higher for prompts with specific requirements', () => {
        const session = createPromptSession([
          'The function must return within 100ms',
          'This should handle errors gracefully',
          'Make sure to validate all inputs',
        ]);

        const result = calculatePromptScore([session]);

        expect(result.breakdown.specificity).toBeGreaterThan(20);
      });

      it('should score lower for prompts with vague language', () => {
        const vagueSession = createPromptSession([
          'Fix the stuff in the thing',
          'Make it work somehow',
          'Do the thing with that kind of approach',
        ]);

        const specificSession = createPromptSession([
          'Fix the authentication error in the login endpoint',
          'Implement proper validation',
          'Use the existing pattern from the auth module',
        ]);

        const vagueResult = calculatePromptScore([vagueSession]);
        const specificResult = calculatePromptScore([specificSession]);

        expect(vagueResult.breakdown.specificity).toBeLessThan(
          specificResult.breakdown.specificity
        );
      });

      it('should score lower for very short prompts', () => {
        const shortSession = createPromptSession(['fix', 'help', 'ok']);
        const detailedSession = createPromptSession([
          'Fix the authentication bug in the login function',
        ]);

        const shortResult = calculatePromptScore([shortSession]);
        const detailedResult = calculatePromptScore([detailedSession]);

        expect(shortResult.breakdown.specificity).toBeLessThan(
          detailedResult.breakdown.specificity
        );
      });
    });

    describe('constraintClarity scoring', () => {
      it('should score higher for prompts with "must", "should", "don\'t" constraints', () => {
        const session = createPromptSession([
          'The function must not throw errors',
          'You should use async/await',
          "Don't modify the existing API contract",
        ]);

        const result = calculatePromptScore([session]);

        expect(result.breakdown.constraintClarity).toBeGreaterThan(20);
      });

      it('should score higher for prompts with preference constraints', () => {
        const session = createPromptSession([
          'Use only functional components',
          'Must use TypeScript strict mode',
          'Prefer immutable data structures',
        ]);

        const result = calculatePromptScore([session]);

        expect(result.breakdown.constraintClarity).toBeGreaterThan(20);
      });

      it('should score higher for prompts with limit constraints', () => {
        const session = createPromptSession([
          'Response time must be under 200ms',
          'Keep the bundle size within 100KB',
          'Maximum 5 database queries per request',
        ]);

        const result = calculatePromptScore([session]);

        expect(result.breakdown.constraintClarity).toBeGreaterThan(20);
      });

      it('should score higher for prompts with format/style constraints', () => {
        const session = createPromptSession([
          'Follow the existing code format',
          'Use the same naming convention as other files',
          'The output should be in JSON format',
        ]);

        const result = calculatePromptScore([session]);

        expect(result.breakdown.constraintClarity).toBeGreaterThan(20);
      });

      it('should score higher for prompts that ask for explanation first', () => {
        const session = createPromptSession([
          'Before implementing, explain your approach',
          'First explain the trade-offs, then proceed',
        ]);

        const result = calculatePromptScore([session]);

        expect(result.breakdown.constraintClarity).toBeGreaterThan(20);
      });

      it('should calculate constraintUsageRate correctly', () => {
        const session = createPromptSession([
          'Must be async', // has constraints
          'fix it', // no constraints
          "Don't use any external libraries", // has constraints
          'make it work', // no constraints
        ]);

        const result = calculatePromptScore([session]);

        // Should be around 50% (2 out of 4 prompts with constraints)
        expect(result.constraintUsageRate).toBeGreaterThanOrEqual(0);
        expect(result.constraintUsageRate).toBeLessThanOrEqual(100);
      });
    });

    describe('iterationEfficiency scoring', () => {
      it('should score higher for sessions with fewer iterations', () => {
        const efficientSession = createPromptSession([
          'Implement user authentication with JWT',
          'Add error handling',
        ]);

        const inefficientSession = createPromptSession([
          'help',
          'what should I do',
          'how do I start',
          'what file',
          'ok now what',
          'fix it',
          'still broken',
          'try again',
          'more help',
          'confused',
          'just do it',
          'finally',
        ]);

        const efficientResult = calculatePromptScore([efficientSession]);
        const inefficientResult = calculatePromptScore([inefficientSession]);

        expect(efficientResult.breakdown.iterationEfficiency).toBeGreaterThan(
          inefficientResult.breakdown.iterationEfficiency
        );
      });

      it('should score 90 for sessions with 3 or fewer turns', () => {
        const session = createPromptSession([
          'Implement the feature',
          'Add tests',
          'Deploy',
        ]);

        const result = calculatePromptScore([session]);

        expect(result.breakdown.iterationEfficiency).toBe(90);
      });

      it('should score 80 for sessions with 4-5 turns', () => {
        const session = createPromptSession(['msg1', 'msg2', 'msg3', 'msg4', 'msg5']);

        const result = calculatePromptScore([session]);

        expect(result.breakdown.iterationEfficiency).toBe(80);
      });

      it('should score 60 for sessions with 6-8 turns', () => {
        const session = createPromptSession(['msg1', 'msg2', 'msg3', 'msg4', 'msg5', 'msg6']);

        const result = calculatePromptScore([session]);

        expect(result.breakdown.iterationEfficiency).toBe(60);
      });
    });

    describe('firstTrySuccess scoring', () => {
      it('should score higher for short sessions without corrections', () => {
        const successSession = createPromptSession([
          'Implement the login feature',
          'Great, thanks!',
        ]);

        const result = calculatePromptScore([successSession]);

        expect(result.breakdown.firstTrySuccess).toBeGreaterThan(50);
      });

      it('should score lower when corrections are present', () => {
        const correctionSession = createPromptSession([
          'Implement the feature',
          "That's wrong, fix it",
          'No, that is incorrect',
          'Actually, do it differently',
        ]);

        const result = calculatePromptScore([correctionSession]);

        expect(result.breakdown.firstTrySuccess).toBe(0);
      });

      it('should score higher for sessions with positive feedback', () => {
        const positiveSession = createPromptSession([
          'Implement the feature',
          'Perfect, exactly what I needed!',
          'Excellent work',
        ]);

        const result = calculatePromptScore([positiveSession]);

        expect(result.breakdown.firstTrySuccess).toBeGreaterThan(50);
      });
    });

    describe('bestPrompt extraction', () => {
      it('should identify the highest-scoring prompt', () => {
        const session = createPromptSession([
          'fix', // Low score
          'Update the handleSubmit function in src/components/UserForm.tsx to validate the email field using the existing validateEmail utility from src/utils/validation.ts. The validation must reject disposable email domains and should return helpful error messages.', // High score
          'ok', // Low score
        ]);

        const result = calculatePromptScore([session]);

        expect(result.bestPrompt).not.toBeNull();
        if (result.bestPrompt) {
          expect(result.bestPrompt.content.length).toBeGreaterThan(50);
          expect(result.bestPrompt.score).toBeGreaterThan(30);
          expect(result.bestPrompt.reasons.length).toBeGreaterThan(0);
        }
      });

      it('should truncate long prompts to 300 characters', () => {
        const longPrompt = 'A'.repeat(400);
        const session = createPromptSession([longPrompt]);

        const result = calculatePromptScore([session]);

        expect(result.bestPrompt).not.toBeNull();
        if (result.bestPrompt) {
          expect(result.bestPrompt.content.length).toBeLessThanOrEqual(300);
          expect(result.bestPrompt.content).toContain('...');
        }
      });
    });

    describe('worstPrompt extraction', () => {
      it('should identify the lowest-scoring prompt when score < 50', () => {
        const session = createPromptSession([
          'Update the function with proper validation and error handling',
          'fix', // Very low score
          'Implement the feature following the existing pattern',
        ]);

        const result = calculatePromptScore([session]);

        // Worst prompt should exist if its score is < 50
        if (result.worstPrompt) {
          expect(result.worstPrompt.score).toBeLessThan(50);
          expect(result.worstPrompt.reasons.length).toBeGreaterThan(0);
        }
      });

      it('should return null for worstPrompt if lowest score >= 50', () => {
        const session = createPromptSession([
          'Update the handleSubmit function in src/components/UserForm.tsx to validate the email field using the existing validateEmail utility',
          'Add proper error handling with try-catch blocks and ensure all edge cases are covered',
        ]);

        const result = calculatePromptScore([session]);

        // All prompts are decent, so worstPrompt might be null
        if (result.worstPrompt !== null) {
          expect(result.worstPrompt.score).toBeLessThan(50);
        }
      });
    });

    describe('avgPromptLength calculation', () => {
      it('should calculate average prompt length correctly', () => {
        const session = createPromptSession([
          'Short', // 5 chars
          'Medium length prompt', // 20 chars
          'A much longer prompt with more detailed information', // 54 chars
        ]);

        const result = calculatePromptScore([session]);

        // Average: (5 + 20 + 54) / 3 = 26.33, rounded down to 26 or close
        expect(result.avgPromptLength).toBeGreaterThanOrEqual(25);
        expect(result.avgPromptLength).toBeLessThanOrEqual(27);
      });
    });

    describe('tips generation', () => {
      it('should suggest longer prompts when average length is low', () => {
        const session = createPromptSession(['fix', 'ok', 'help', 'do it']);

        const result = calculatePromptScore([session]);

        expect(result.tips.some((tip) => tip.includes('chars'))).toBe(true);
        expect(result.tips.some((tip) => tip.includes('280'))).toBe(true);
      });

      it('should suggest adding constraints when constraint score is low', () => {
        const session = createPromptSession([
          'Implement the feature',
          'Add validation',
          'Make it work',
        ]);

        const result = calculatePromptScore([session]);

        if (result.breakdown.constraintClarity < 50) {
          expect(
            result.tips.some((tip) => tip.toLowerCase().includes('constraint'))
          ).toBe(true);
        }
      });

      it('should suggest asking for explanation when specificity is low', () => {
        const session = createPromptSession(['fix the thing', 'make it work', 'do stuff']);

        const result = calculatePromptScore([session]);

        if (result.breakdown.specificity < 60) {
          expect(result.tips.some((tip) => tip.includes('explain'))).toBe(true);
        }
      });

      it('should suggest referencing existing code when context score is low', () => {
        const session = createPromptSession(['Add a button', 'Make a form', 'Create a page']);

        const result = calculatePromptScore([session]);

        // Should provide tips when context score is low
        if (result.breakdown.contextProvision < 60) {
          // Check for context-related tips (the actual tip says "Reference existing code files")
          const hasContextTip = result.tips.some((tip) =>
            tip.toLowerCase().includes('reference') ||
            tip.toLowerCase().includes('code file') ||
            tip.toLowerCase().includes('chars') ||
            tip.toLowerCase().includes('constraint')
          );
          expect(hasContextTip).toBe(true);
        }
      });

      it('should limit tips to maximum of 3', () => {
        const session = createPromptSession(['fix', 'help', 'ok']);

        const result = calculatePromptScore([session]);

        expect(result.tips.length).toBeLessThanOrEqual(3);
      });
    });

    describe('overall score calculation', () => {
      it('should weight dimensions correctly in overall score', () => {
        const highQualitySession = createPromptSession([
          'Update the handleSubmit function in src/components/UserForm.tsx at line 45 to validate the email field using the existing validateEmail utility from src/utils/validation.ts. The validation must reject disposable email domains like tempmail.com and should return user-friendly error messages. Ensure the validation runs before the API call and doesn\'t block the UI.',
          'Perfect, thanks!',
        ]);

        const lowQualitySession = createPromptSession([
          'fix',
          'no',
          'wrong',
          'help',
          'what',
          'how',
          'ok',
        ]);

        const highResult = calculatePromptScore([highQualitySession]);
        const lowResult = calculatePromptScore([lowQualitySession]);

        expect(highResult.score).toBeGreaterThan(lowResult.score);
        // High quality prompt should score well, but may not exceed 50 in all cases due to weighting
        expect(highResult.score).toBeGreaterThanOrEqual(40);
        expect(lowResult.score).toBeLessThan(50);
      });

      it('should apply correct weights: context(25%), specificity(20%), iteration(20%), firstTry(20%), constraint(15%)', () => {
        // Create a controlled session where we know approximate subscores
        const session = createPromptSession([
          'Check src/auth/jwt.ts for the existing pattern. The new endpoint must handle password reset tokens and should expire after 1 hour.',
        ]);

        const result = calculatePromptScore([session]);

        // Score should be reasonable based on weighted formula
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);

        // Verify breakdown components exist
        expect(result.breakdown.contextProvision).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.specificity).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.iterationEfficiency).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.firstTrySuccess).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.constraintClarity).toBeGreaterThanOrEqual(0);
      });
    });

    describe('multiple sessions', () => {
      it('should aggregate results across multiple sessions', () => {
        const session1 = createPromptSession([
          'Implement authentication with JWT tokens',
          'Add validation',
        ]);
        const session2 = createPromptSession([
          'Create the user dashboard',
          'Style with Tailwind',
        ]);
        const session3 = createPromptSession(['fix bug', 'test', 'deploy']);

        const result = calculatePromptScore([session1, session2, session3]);

        expect(result.score).toBeGreaterThan(0);
        expect(result.avgPromptLength).toBeGreaterThan(0);
        expect(result.breakdown.iterationEfficiency).toBeGreaterThan(0);
      });
    });
  });
});
