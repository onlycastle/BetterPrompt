/**
 * Deterministic Scorer Tests
 *
 * Tests computeDeterministicScores() using characteristic testing:
 * verify directional behavior and ranges, NOT exact score values.
 * This prevents brittleness when rubric weights are tuned.
 *
 * @module tests/analyzer/stages/deterministic-scorer
 */

import { describe, it, expect } from 'vitest';
import { computeDeterministicScores } from '../../../../src/lib/analyzer/stages/deterministic-scorer.js';
import type { DeterministicScores } from '../../../../src/lib/analyzer/stages/deterministic-scorer.js';
import type { Phase1Output, Phase1SessionMetrics, UserUtterance } from '../../../../src/lib/models/phase1-output.js';

// ============================================================================
// Fixture Factories
// ============================================================================

function createUtterance(overrides?: Partial<UserUtterance>): UserUtterance {
  return {
    id: 'session1_0',
    text: 'Fix the authentication bug',
    timestamp: '2025-01-15T10:00:00Z',
    sessionId: 'session1',
    turnIndex: 0,
    characterCount: 26,
    wordCount: 5,
    hasCodeBlock: false,
    hasQuestion: false,
    ...overrides,
  };
}

function createPhase1Output(overrides?: {
  metrics?: Partial<Phase1SessionMetrics>;
  utterances?: UserUtterance[];
}): Phase1Output {
  const defaultMetrics: Phase1SessionMetrics = {
    totalSessions: 10,
    totalMessages: 200,
    totalDeveloperUtterances: 100,
    totalAIResponses: 100,
    avgMessagesPerSession: 20,
    avgDeveloperMessageLength: 350,
    questionRatio: 0.25,
    codeBlockRatio: 0.15,
    dateRange: { earliest: '2025-01-01', latest: '2025-01-31' },
    slashCommandCounts: { plan: 2, commit: 3 },
    avgContextFillPercent: 40,
    contextFillExceeded90Count: 1,
    frictionSignals: {
      toolFailureCount: 3,
      userRejectionSignals: 2,
      excessiveIterationSessions: 1,
      contextOverflowSessions: 0,
      frustrationExpressionCount: 1,
      repeatedToolErrorPatterns: 0,
      bareRetryAfterErrorCount: 0,
      errorChainMaxLength: 1,
    },
    sessionHints: {
      avgTurnsPerSession: 10,
      shortSessions: 3,
      mediumSessions: 5,
      longSessions: 2,
    },
    aiInsightBlockCount: 5,
  };

  return {
    developerUtterances: overrides?.utterances ?? [
      createUtterance({ wordCount: 50 }),
      createUtterance({ wordCount: 60 }),
      createUtterance({ wordCount: 45 }),
    ],
    sessionMetrics: { ...defaultMetrics, ...overrides?.metrics },
  };
}

// ============================================================================
// computeDeterministicScores (main API) — 3 tests
// ============================================================================

describe('computeDeterministicScores', () => {
  describe('main API', () => {
    it('returns object with all 6 score fields', () => {
      const input = createPhase1Output();
      const scores = computeDeterministicScores(input);

      expect(scores).toHaveProperty('contextEfficiency');
      expect(scores).toHaveProperty('sessionOutcome');
      expect(scores).toHaveProperty('thinkingQuality');
      expect(scores).toHaveProperty('learningBehavior');
      expect(scores).toHaveProperty('communicationPatterns');
      expect(scores).toHaveProperty('controlScore');
      expect(Object.keys(scores)).toHaveLength(6);
    });

    it('all scores are integers in [0, 100]', () => {
      const input = createPhase1Output();
      const scores = computeDeterministicScores(input);

      for (const [key, value] of Object.entries(scores)) {
        expect(value, `${key} should be >= 0`).toBeGreaterThanOrEqual(0);
        expect(value, `${key} should be <= 100`).toBeLessThanOrEqual(100);
        expect(value, `${key} should be an integer`).toBe(Math.round(value));
      }
    });

    it('same input produces same output (deterministic)', () => {
      const input = createPhase1Output();
      const scores1 = computeDeterministicScores(input);
      const scores2 = computeDeterministicScores(input);

      expect(scores1).toEqual(scores2);
    });
  });

  // ============================================================================
  // Context Efficiency rubric — 4 tests
  // ============================================================================

  describe('contextEfficiency rubric', () => {
    it('lower avgContextFillPercent produces higher score (inverted scale)', () => {
      const lowFill = computeDeterministicScores(
        createPhase1Output({ metrics: { avgContextFillPercent: 20 } })
      );
      const highFill = computeDeterministicScores(
        createPhase1Output({ metrics: { avgContextFillPercent: 80 } })
      );

      expect(lowFill.contextEfficiency).toBeGreaterThan(highFill.contextEfficiency);
    });

    it('higher contextFillExceeded90Count produces lower score (overflow penalty)', () => {
      const lowOverflow = computeDeterministicScores(
        createPhase1Output({ metrics: { contextFillExceeded90Count: 0 } })
      );
      const highOverflow = computeDeterministicScores(
        createPhase1Output({ metrics: { contextFillExceeded90Count: 8 } })
      );

      expect(lowOverflow.contextEfficiency).toBeGreaterThan(highOverflow.contextEfficiency);
    });

    it('/compact and /clear usage adds bonus (up to +15)', () => {
      const noCompaction = computeDeterministicScores(
        createPhase1Output({ metrics: { slashCommandCounts: {} } })
      );
      const withCompaction = computeDeterministicScores(
        createPhase1Output({ metrics: { slashCommandCounts: { compact: 3, clear: 2 } } })
      );

      expect(withCompaction.contextEfficiency).toBeGreaterThan(noCompaction.contextEfficiency);
    });

    it('higher longSessions ratio produces lower score (long session penalty)', () => {
      const fewLong = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            sessionHints: { avgTurnsPerSession: 10, shortSessions: 7, mediumSessions: 2, longSessions: 1 },
          },
        })
      );
      const manyLong = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            sessionHints: { avgTurnsPerSession: 10, shortSessions: 1, mediumSessions: 2, longSessions: 7 },
          },
        })
      );

      expect(fewLong.contextEfficiency).toBeGreaterThan(manyLong.contextEfficiency);
    });
  });

  // ============================================================================
  // Session Outcome rubric — 4 tests
  // ============================================================================

  describe('sessionOutcome rubric', () => {
    it('zero friction produces high score (near baseline ~85)', () => {
      const scores = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 0,
              userRejectionSignals: 0,
              excessiveIterationSessions: 0,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 0,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 0,
              errorChainMaxLength: 0,
            },
          },
        })
      );

      // Zero friction baseline is 85, plus potential bonuses
      expect(scores.sessionOutcome).toBeGreaterThanOrEqual(70);
    });

    it('high friction density produces low score', () => {
      const lowFriction = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 0,
              userRejectionSignals: 0,
              excessiveIterationSessions: 0,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 0,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 0,
              errorChainMaxLength: 0,
            },
          },
        })
      );
      const highFriction = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 20,
              userRejectionSignals: 15,
              excessiveIterationSessions: 5,
              contextOverflowSessions: 5,
              frustrationExpressionCount: 10,
              repeatedToolErrorPatterns: 5,
              bareRetryAfterErrorCount: 8,
              errorChainMaxLength: 6,
            },
          },
        })
      );

      expect(lowFriction.sessionOutcome).toBeGreaterThan(highFriction.sessionOutcome);
    });

    it('higher mediumSessions ratio produces higher score (balance bonus)', () => {
      const fewMedium = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            sessionHints: { avgTurnsPerSession: 10, shortSessions: 8, mediumSessions: 1, longSessions: 1 },
          },
        })
      );
      const manyMedium = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            sessionHints: { avgTurnsPerSession: 10, shortSessions: 1, mediumSessions: 8, longSessions: 1 },
          },
        })
      );

      expect(manyMedium.sessionOutcome).toBeGreaterThan(fewMedium.sessionOutcome);
    });

    it('high excessiveIterationSessions produces additional penalty', () => {
      const lowExcessive = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 3,
              userRejectionSignals: 2,
              excessiveIterationSessions: 0,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 0,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 0,
              errorChainMaxLength: 0,
            },
          },
        })
      );
      const highExcessive = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 3,
              userRejectionSignals: 2,
              excessiveIterationSessions: 8,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 0,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 0,
              errorChainMaxLength: 0,
            },
          },
        })
      );

      expect(lowExcessive.sessionOutcome).toBeGreaterThan(highExcessive.sessionOutcome);
    });
  });

  // ============================================================================
  // Thinking Quality rubric — 4 tests
  // ============================================================================

  describe('thinkingQuality rubric', () => {
    it('/plan and /review usage produces higher score', () => {
      const noPlan = computeDeterministicScores(
        createPhase1Output({ metrics: { slashCommandCounts: {} } })
      );
      const withPlan = computeDeterministicScores(
        createPhase1Output({ metrics: { slashCommandCounts: { plan: 5, review: 3 } } })
      );

      expect(withPlan.thinkingQuality).toBeGreaterThan(noPlan.thinkingQuality);
    });

    it('questionRatio in optimal range (0.15-0.40) produces higher score', () => {
      const optimalRatio = computeDeterministicScores(
        createPhase1Output({ metrics: { questionRatio: 0.25 } })
      );
      const lowRatio = computeDeterministicScores(
        createPhase1Output({ metrics: { questionRatio: 0.0 } })
      );

      expect(optimalRatio.thinkingQuality).toBeGreaterThan(lowRatio.thinkingQuality);
    });

    it('questionRatio shows bell curve: 0.25 > 0.0, 0.25 > 0.80', () => {
      const zero = computeDeterministicScores(
        createPhase1Output({ metrics: { questionRatio: 0.0 } })
      );
      const optimal = computeDeterministicScores(
        createPhase1Output({ metrics: { questionRatio: 0.25 } })
      );
      const excessive = computeDeterministicScores(
        createPhase1Output({ metrics: { questionRatio: 0.80 } })
      );

      expect(optimal.thinkingQuality).toBeGreaterThan(zero.thinkingQuality);
      expect(optimal.thinkingQuality).toBeGreaterThan(excessive.thinkingQuality);
    });

    it('high toolFailureCount produces lower score', () => {
      const lowFailure = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 0,
              userRejectionSignals: 2,
              excessiveIterationSessions: 1,
              contextOverflowSessions: 0,
            },
          },
        })
      );
      const highFailure = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 30,
              userRejectionSignals: 2,
              excessiveIterationSessions: 1,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 0,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 0,
              errorChainMaxLength: 0,
            },
          },
        })
      );

      expect(lowFailure.thinkingQuality).toBeGreaterThan(highFailure.thinkingQuality);
    });
  });

  // ============================================================================
  // Learning Behavior rubric — 5 tests
  // ============================================================================

  describe('learningBehavior rubric', () => {
    it('higher questionRatio produces higher score', () => {
      const lowQuestions = computeDeterministicScores(
        createPhase1Output({ metrics: { questionRatio: 0.05 } })
      );
      const highQuestions = computeDeterministicScores(
        createPhase1Output({ metrics: { questionRatio: 0.40 } })
      );

      expect(highQuestions.learningBehavior).toBeGreaterThan(lowQuestions.learningBehavior);
    });

    it('higher aiInsightBlockCount produces higher score', () => {
      const noInsights = computeDeterministicScores(
        createPhase1Output({ metrics: { aiInsightBlockCount: 0 } })
      );
      const manyInsights = computeDeterministicScores(
        createPhase1Output({ metrics: { aiInsightBlockCount: 20 } })
      );

      expect(manyInsights.learningBehavior).toBeGreaterThan(noInsights.learningBehavior);
    });

    it('higher excessiveIterationSessions produces lower score (repeated mistakes)', () => {
      const lowIteration = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 3,
              userRejectionSignals: 2,
              excessiveIterationSessions: 0,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 0,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 0,
              errorChainMaxLength: 0,
            },
          },
        })
      );
      const highIteration = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 3,
              userRejectionSignals: 2,
              excessiveIterationSessions: 8,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 0,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 0,
              errorChainMaxLength: 0,
            },
          },
        })
      );

      expect(lowIteration.learningBehavior).toBeGreaterThan(highIteration.learningBehavior);
    });

    it('higher codeBlockRatio produces higher score (experimentation)', () => {
      const lowCode = computeDeterministicScores(
        createPhase1Output({ metrics: { codeBlockRatio: 0.0 } })
      );
      const highCode = computeDeterministicScores(
        createPhase1Output({ metrics: { codeBlockRatio: 0.40 } })
      );

      expect(highCode.learningBehavior).toBeGreaterThan(lowCode.learningBehavior);
    });

    it('more diverse slashCommandCounts produces higher score', () => {
      const fewCommands = computeDeterministicScores(
        createPhase1Output({ metrics: { slashCommandCounts: { plan: 1 } } })
      );
      const diverseCommands = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            slashCommandCounts: { plan: 2, review: 1, commit: 3, test: 1, clear: 1 },
          },
        })
      );

      expect(diverseCommands.learningBehavior).toBeGreaterThan(fewCommands.learningBehavior);
    });
  });

  // ============================================================================
  // Communication Patterns rubric — 3 tests
  // ============================================================================

  describe('communicationPatterns rubric', () => {
    it('avgDeveloperMessageLength 350 scores higher than both 50 and 1000', () => {
      const tooShort = computeDeterministicScores(
        createPhase1Output({ metrics: { avgDeveloperMessageLength: 50 } })
      );
      const optimal = computeDeterministicScores(
        createPhase1Output({ metrics: { avgDeveloperMessageLength: 350 } })
      );
      const tooLong = computeDeterministicScores(
        createPhase1Output({ metrics: { avgDeveloperMessageLength: 1000 } })
      );

      expect(optimal.communicationPatterns).toBeGreaterThan(tooShort.communicationPatterns);
      expect(optimal.communicationPatterns).toBeGreaterThan(tooLong.communicationPatterns);
    });

    it('higher codeBlockRatio and questionRatio produce higher structure score', () => {
      const lowStructure = computeDeterministicScores(
        createPhase1Output({ metrics: { codeBlockRatio: 0.0, questionRatio: 0.0 } })
      );
      const highStructure = computeDeterministicScores(
        createPhase1Output({ metrics: { codeBlockRatio: 0.30, questionRatio: 0.30 } })
      );

      expect(highStructure.communicationPatterns).toBeGreaterThan(lowStructure.communicationPatterns);
    });

    it('low word count CV produces higher consistency score', () => {
      // Consistent word counts (low CV)
      const consistentUtterances = [
        createUtterance({ wordCount: 48, id: 'session1_0' }),
        createUtterance({ wordCount: 52, id: 'session1_1' }),
        createUtterance({ wordCount: 50, id: 'session1_2' }),
        createUtterance({ wordCount: 49, id: 'session1_3' }),
        createUtterance({ wordCount: 51, id: 'session1_4' }),
      ];

      // Highly varied word counts (high CV)
      const variedUtterances = [
        createUtterance({ wordCount: 5, id: 'session1_0' }),
        createUtterance({ wordCount: 200, id: 'session1_1' }),
        createUtterance({ wordCount: 10, id: 'session1_2' }),
        createUtterance({ wordCount: 300, id: 'session1_3' }),
        createUtterance({ wordCount: 15, id: 'session1_4' }),
      ];

      const consistent = computeDeterministicScores(
        createPhase1Output({ utterances: consistentUtterances })
      );
      const varied = computeDeterministicScores(
        createPhase1Output({ utterances: variedUtterances })
      );

      expect(consistent.communicationPatterns).toBeGreaterThan(varied.communicationPatterns);
    });
  });

  // ============================================================================
  // Control Score rubric — 3 tests
  // ============================================================================

  describe('controlScore rubric', () => {
    it('higher rejection rate produces higher score', () => {
      const lowRejection = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 3,
              userRejectionSignals: 0,
              excessiveIterationSessions: 1,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 0,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 0,
              errorChainMaxLength: 0,
            },
          },
        })
      );
      const highRejection = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 3,
              userRejectionSignals: 20,
              excessiveIterationSessions: 1,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 0,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 0,
              errorChainMaxLength: 0,
            },
          },
        })
      );

      expect(highRejection.controlScore).toBeGreaterThan(lowRejection.controlScore);
    });

    it('longer prompts produce higher score', () => {
      const shortPrompts = computeDeterministicScores(
        createPhase1Output({ metrics: { avgDeveloperMessageLength: 30 } })
      );
      const longPrompts = computeDeterministicScores(
        createPhase1Output({ metrics: { avgDeveloperMessageLength: 500 } })
      );

      expect(longPrompts.controlScore).toBeGreaterThan(shortPrompts.controlScore);
    });

    it('more slash command diversity produces higher score', () => {
      const noCommands = computeDeterministicScores(
        createPhase1Output({ metrics: { slashCommandCounts: {} } })
      );
      const diverseCommands = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            slashCommandCounts: { plan: 3, review: 2, commit: 5, test: 1, clear: 2 },
          },
        })
      );

      expect(diverseCommands.controlScore).toBeGreaterThan(noCommands.controlScore);
    });
  });

  // ============================================================================
  // New friction signals impact — 4 tests
  // ============================================================================

  describe('new friction signals impact', () => {
    it('higher frustrationExpressionCount produces lower sessionOutcome', () => {
      const lowFrustration = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 3,
              userRejectionSignals: 2,
              excessiveIterationSessions: 1,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 0,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 0,
              errorChainMaxLength: 0,
            },
          },
        })
      );
      const highFrustration = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 3,
              userRejectionSignals: 2,
              excessiveIterationSessions: 1,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 15,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 0,
              errorChainMaxLength: 0,
            },
          },
        })
      );

      expect(lowFrustration.sessionOutcome).toBeGreaterThan(highFrustration.sessionOutcome);
    });

    it('higher bareRetryAfterErrorCount produces lower learningBehavior', () => {
      const noBareRetry = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 3,
              userRejectionSignals: 2,
              excessiveIterationSessions: 0,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 0,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 0,
              errorChainMaxLength: 0,
            },
          },
        })
      );
      const manyBareRetries = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 3,
              userRejectionSignals: 2,
              excessiveIterationSessions: 0,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 0,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 30,
              errorChainMaxLength: 0,
            },
          },
        })
      );

      expect(noBareRetry.learningBehavior).toBeGreaterThan(manyBareRetries.learningBehavior);
    });

    it('errorChainMaxLength >= 3 produces lower thinkingQuality', () => {
      const shortChain = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 3,
              userRejectionSignals: 2,
              excessiveIterationSessions: 0,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 0,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 0,
              errorChainMaxLength: 1,
            },
          },
        })
      );
      const longChain = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 3,
              userRejectionSignals: 2,
              excessiveIterationSessions: 0,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 0,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 0,
              errorChainMaxLength: 8,
            },
          },
        })
      );

      expect(shortChain.thinkingQuality).toBeGreaterThan(longChain.thinkingQuality);
    });

    it('errorChainMaxLength < 3 does not penalize thinkingQuality', () => {
      const chain0 = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 3,
              userRejectionSignals: 2,
              excessiveIterationSessions: 0,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 0,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 0,
              errorChainMaxLength: 0,
            },
          },
        })
      );
      const chain2 = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 3,
              userRejectionSignals: 2,
              excessiveIterationSessions: 0,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 0,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 0,
              errorChainMaxLength: 2,
            },
          },
        })
      );

      // Chain of 0 and chain of 2 should have identical thinkingQuality (no penalty below 3)
      expect(chain0.thinkingQuality).toBe(chain2.thinkingQuality);
    });
  });

  // ============================================================================
  // Edge cases — 4 tests
  // ============================================================================

  describe('edge cases', () => {
    it('totalSessions: 0 does not cause division-by-zero crash', () => {
      const input = createPhase1Output({
        metrics: {
          totalSessions: 0,
          totalMessages: 0,
          totalDeveloperUtterances: 0,
          totalAIResponses: 0,
          avgMessagesPerSession: 0,
        },
      });

      expect(() => computeDeterministicScores(input)).not.toThrow();

      const scores = computeDeterministicScores(input);
      for (const [key, value] of Object.entries(scores)) {
        expect(Number.isFinite(value), `${key} should be finite`).toBe(true);
        expect(value, `${key} should be >= 0`).toBeGreaterThanOrEqual(0);
        expect(value, `${key} should be <= 100`).toBeLessThanOrEqual(100);
      }
    });

    it('all optional fields undefined produces reasonable defaults', () => {
      const input = createPhase1Output({
        metrics: {
          avgContextFillPercent: undefined,
          contextFillExceeded90Count: undefined,
          slashCommandCounts: undefined,
          frictionSignals: undefined,
          sessionHints: undefined,
          aiInsightBlockCount: undefined,
        },
      });

      const scores = computeDeterministicScores(input);

      for (const [key, value] of Object.entries(scores)) {
        expect(Number.isFinite(value), `${key} should be finite`).toBe(true);
        expect(value, `${key} should be >= 0`).toBeGreaterThanOrEqual(0);
        expect(value, `${key} should be <= 100`).toBeLessThanOrEqual(100);
      }
    });

    it('frictionSignals undefined is treated as zero friction', () => {
      const noFrictionField = computeDeterministicScores(
        createPhase1Output({ metrics: { frictionSignals: undefined } })
      );
      const explicitZeroFriction = computeDeterministicScores(
        createPhase1Output({
          metrics: {
            frictionSignals: {
              toolFailureCount: 0,
              userRejectionSignals: 0,
              excessiveIterationSessions: 0,
              contextOverflowSessions: 0,
              frustrationExpressionCount: 0,
              repeatedToolErrorPatterns: 0,
              bareRetryAfterErrorCount: 0,
              errorChainMaxLength: 0,
            },
          },
        })
      );

      // Both should produce equivalent scores (friction-related rubrics treat undefined as 0)
      expect(noFrictionField.sessionOutcome).toBe(explicitZeroFriction.sessionOutcome);
      expect(noFrictionField.thinkingQuality).toBe(explicitZeroFriction.thinkingQuality);
      expect(noFrictionField.learningBehavior).toBe(explicitZeroFriction.learningBehavior);
    });

    it('empty slashCommandCounts produces no bonus or penalty', () => {
      const emptyCommands = computeDeterministicScores(
        createPhase1Output({ metrics: { slashCommandCounts: {} } })
      );
      const undefinedCommands = computeDeterministicScores(
        createPhase1Output({ metrics: { slashCommandCounts: undefined } })
      );

      // Empty object and undefined should behave identically
      expect(emptyCommands.contextEfficiency).toBe(undefinedCommands.contextEfficiency);
      expect(emptyCommands.thinkingQuality).toBe(undefinedCommands.thinkingQuality);
      expect(emptyCommands.learningBehavior).toBe(undefinedCommands.learningBehavior);
      expect(emptyCommands.controlScore).toBe(undefinedCommands.controlScore);
    });
  });
});
