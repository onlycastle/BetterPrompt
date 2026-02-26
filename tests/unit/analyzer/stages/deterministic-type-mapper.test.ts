/**
 * Deterministic Type Mapper Tests
 *
 * Tests for `computeDeterministicType()` — the rule-based developer type classifier.
 *
 * Strategy: Characteristic Testing
 * - Tests behavioral direction (which type wins), not exact affinity numbers.
 * - Exception: boundary tests for controlLevel thresholds and structural
 *   invariants (distribution sum = 100) DO test exact values.
 */

import { describe, it, expect } from 'vitest';
import {
  computeDeterministicType,
  type DeterministicTypeResult,
} from '../../../../src/lib/analyzer/stages/deterministic-type-mapper.js';
import type { DeterministicScores } from '../../../../src/lib/analyzer/stages/deterministic-scorer.js';
import type {
  Phase1Output,
  Phase1SessionMetrics,
  UserUtterance,
} from '../../../../src/lib/models/phase1-output.js';
import {
  MATRIX_NAMES,
  MATRIX_METADATA,
  type CodingStyleType,
} from '../../../../src/lib/models/coding-style.js';

// ============================================================================
// Fixture Factories
// ============================================================================

function createScores(overrides?: Partial<DeterministicScores>): DeterministicScores {
  return {
    contextEfficiency: 50,
    sessionOutcome: 50,
    thinkingQuality: 50,
    learningBehavior: 50,
    communicationPatterns: 50,
    controlScore: 50,
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
    slashCommandCounts: {},
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
    sessionHints: {
      avgTurnsPerSession: 10,
      shortSessions: 3,
      mediumSessions: 5,
      longSessions: 2,
    },
  };

  return {
    developerUtterances: overrides?.utterances ?? [],
    sessionMetrics: { ...defaultMetrics, ...overrides?.metrics },
  };
}

function createUtterance(text: string, overrides?: Partial<UserUtterance>): UserUtterance {
  return {
    id: 'session1_0',
    text,
    displayText: text,
    timestamp: '2025-01-15T10:00:00Z',
    sessionId: 'session1',
    turnIndex: 0,
    characterCount: text.length,
    wordCount: text.split(/\s+/).length,
    hasCodeBlock: false,
    hasQuestion: false,
    ...overrides,
  };
}

// ============================================================================
// Valid CodingStyleType values for runtime checks
// ============================================================================

const VALID_TYPES: CodingStyleType[] = [
  'architect',
  'analyst',
  'conductor',
  'speedrunner',
  'trendsetter',
];

// ============================================================================
// computeDeterministicType — Main API (5 tests)
// ============================================================================

describe('computeDeterministicType', () => {
  describe('main API contract', () => {
    it('returns a valid DeterministicTypeResult with all required fields', () => {
      const result = computeDeterministicType(createScores(), createPhase1Output());

      expect(result).toHaveProperty('primaryType');
      expect(result).toHaveProperty('distribution');
      expect(result).toHaveProperty('controlLevel');
      expect(result).toHaveProperty('controlScore');
      expect(result).toHaveProperty('matrixName');
      expect(result).toHaveProperty('matrixEmoji');

      // distribution has all 5 keys
      expect(result.distribution).toHaveProperty('architect');
      expect(result.distribution).toHaveProperty('analyst');
      expect(result.distribution).toHaveProperty('conductor');
      expect(result.distribution).toHaveProperty('speedrunner');
      expect(result.distribution).toHaveProperty('trendsetter');
    });

    it('distribution values sum to exactly 100', () => {
      const result = computeDeterministicType(createScores(), createPhase1Output());
      const sum =
        result.distribution.architect +
        result.distribution.analyst +
        result.distribution.conductor +
        result.distribution.speedrunner +
        result.distribution.trendsetter;

      expect(sum).toBe(100);
    });

    it('each distribution value is >= 5 (minimum floor)', () => {
      const result = computeDeterministicType(createScores(), createPhase1Output());

      expect(result.distribution.architect).toBeGreaterThanOrEqual(5);
      expect(result.distribution.analyst).toBeGreaterThanOrEqual(5);
      expect(result.distribution.conductor).toBeGreaterThanOrEqual(5);
      expect(result.distribution.speedrunner).toBeGreaterThanOrEqual(5);
      expect(result.distribution.trendsetter).toBeGreaterThanOrEqual(5);
    });

    it('primaryType is a valid CodingStyleType', () => {
      const result = computeDeterministicType(createScores(), createPhase1Output());

      expect(VALID_TYPES).toContain(result.primaryType);
    });

    it('matrixName and matrixEmoji match lookup tables for returned primaryType + controlLevel', () => {
      const result = computeDeterministicType(createScores(), createPhase1Output());

      const expectedName = MATRIX_NAMES[result.primaryType][result.controlLevel];
      const expectedEmoji = MATRIX_METADATA[result.primaryType][result.controlLevel].emoji;

      expect(result.matrixName).toBe(expectedName);
      expect(result.matrixEmoji).toBe(expectedEmoji);
    });
  });

  // ==========================================================================
  // Control Level Boundaries (6 tests)
  // ==========================================================================

  describe('control level boundaries', () => {
    it('controlScore 0 maps to explorer', () => {
      const result = computeDeterministicType(
        createScores({ controlScore: 0 }),
        createPhase1Output()
      );
      expect(result.controlLevel).toBe('explorer');
    });

    it('controlScore 34 maps to explorer (boundary)', () => {
      const result = computeDeterministicType(
        createScores({ controlScore: 34 }),
        createPhase1Output()
      );
      expect(result.controlLevel).toBe('explorer');
    });

    it('controlScore 35 maps to navigator (boundary)', () => {
      const result = computeDeterministicType(
        createScores({ controlScore: 35 }),
        createPhase1Output()
      );
      expect(result.controlLevel).toBe('navigator');
    });

    it('controlScore 64 maps to navigator (boundary)', () => {
      const result = computeDeterministicType(
        createScores({ controlScore: 64 }),
        createPhase1Output()
      );
      expect(result.controlLevel).toBe('navigator');
    });

    it('controlScore 65 maps to cartographer (boundary)', () => {
      const result = computeDeterministicType(
        createScores({ controlScore: 65 }),
        createPhase1Output()
      );
      expect(result.controlLevel).toBe('cartographer');
    });

    it('controlScore 100 maps to cartographer', () => {
      const result = computeDeterministicType(
        createScores({ controlScore: 100 }),
        createPhase1Output()
      );
      expect(result.controlLevel).toBe('cartographer');
    });
  });

  // ==========================================================================
  // Type Affinity Signals (5 tests)
  // ==========================================================================

  describe('type affinity signals', () => {
    it('high thinkingQuality + /plan usage + high controlScore favors architect', () => {
      const scores = createScores({
        thinkingQuality: 95,
        controlScore: 90,
        // Suppress competing signals
        contextEfficiency: 10,
        learningBehavior: 10,
        sessionOutcome: 10,
        communicationPatterns: 10,
      });
      const phase1 = createPhase1Output({
        metrics: {
          slashCommandCounts: { plan: 5, review: 3 },
          questionRatio: 0.05,
          avgDeveloperMessageLength: 350,
        },
      });

      const result = computeDeterministicType(scores, phase1);
      expect(result.primaryType).toBe('architect');
    });

    it('high learningBehavior + high questionRatio favors analyst', () => {
      const scores = createScores({
        thinkingQuality: 40,
        learningBehavior: 95,
        sessionOutcome: 80,
        // Suppress competing signals
        contextEfficiency: 10,
        controlScore: 20,
        communicationPatterns: 10,
      });
      const phase1 = createPhase1Output({
        metrics: {
          questionRatio: 0.45,
          slashCommandCounts: {},
          avgDeveloperMessageLength: 350,
        },
      });

      const result = computeDeterministicType(scores, phase1);
      expect(result.primaryType).toBe('analyst');
    });

    it('many unique slash commands + orchestration commands favors conductor', () => {
      const scores = createScores({
        // Suppress competing signals
        thinkingQuality: 20,
        contextEfficiency: 20,
        learningBehavior: 20,
        sessionOutcome: 20,
        controlScore: 30,
        communicationPatterns: 20,
      });
      const phase1 = createPhase1Output({
        metrics: {
          slashCommandCounts: {
            sisyphus: 5,
            orchestrator: 3,
            ultrawork: 2,
            plan: 1,
            commit: 1,
            review: 1,
            deepsearch: 1,
            analyze: 1,
          },
          questionRatio: 0.05,
          avgDeveloperMessageLength: 350,
        },
      });

      const result = computeDeterministicType(scores, phase1);
      expect(result.primaryType).toBe('conductor');
    });

    it('high contextEfficiency + short prompts favors speedrunner', () => {
      const scores = createScores({
        contextEfficiency: 95,
        sessionOutcome: 80,
        // Suppress competing signals
        thinkingQuality: 20,
        learningBehavior: 20,
        controlScore: 20,
        communicationPatterns: 20,
      });
      const phase1 = createPhase1Output({
        metrics: {
          avgDeveloperMessageLength: 100,
          slashCommandCounts: {},
          questionRatio: 0.05,
        },
      });

      const result = computeDeterministicType(scores, phase1);
      expect(result.primaryType).toBe('speedrunner');
    });

    it('high trend keyword density + high learningBehavior favors trendsetter', () => {
      const scores = createScores({
        learningBehavior: 85,
        // Suppress competing signals
        thinkingQuality: 15,
        contextEfficiency: 15,
        sessionOutcome: 15,
        controlScore: 15,
        communicationPatterns: 15,
      });

      // Create utterances that produce >3% trend density
      // Each utterance with trend keywords contributes matches/totalUtterances * 100
      // 10 utterances, each with 2+ trend keywords → density = 20+ / 10 * 100 = 200%+
      const trendUtterances: UserUtterance[] = [];
      for (let i = 0; i < 10; i++) {
        trendUtterances.push(
          createUtterance(
            'Show me the latest framework and the modern best practice for trending tools',
            { id: `session1_${i}`, turnIndex: i }
          )
        );
      }

      const phase1 = createPhase1Output({
        metrics: {
          slashCommandCounts: {},
          questionRatio: 0.05,
          avgDeveloperMessageLength: 350,
        },
        utterances: trendUtterances,
      });

      const result = computeDeterministicType(scores, phase1);
      expect(result.primaryType).toBe('trendsetter');
    });
  });

  // ==========================================================================
  // Trend Density (4 tests)
  // ==========================================================================

  describe('trend density', () => {
    it('empty utterances produce density 0 and still return a valid result', () => {
      const result = computeDeterministicType(
        createScores(),
        createPhase1Output({ utterances: [] })
      );

      expect(VALID_TYPES).toContain(result.primaryType);
      const sum =
        result.distribution.architect +
        result.distribution.analyst +
        result.distribution.conductor +
        result.distribution.speedrunner +
        result.distribution.trendsetter;
      expect(sum).toBe(100);
    });

    it('Korean keywords are counted in trend density', () => {
      const koreanUtterances = [
        createUtterance('최신 트렌드를 알려줘', { id: 's1_0', turnIndex: 0 }),
        createUtterance('요즘 유행하는 프레임워크', { id: 's1_1', turnIndex: 1 }),
        createUtterance('새로운 업데이트된 버전 확인', { id: 's1_2', turnIndex: 2 }),
      ];

      // With Korean trend keywords, trendsetter affinity should be non-trivial
      const scores = createScores({
        learningBehavior: 80,
        thinkingQuality: 10,
        contextEfficiency: 10,
        controlScore: 10,
        sessionOutcome: 10,
      });
      const phase1 = createPhase1Output({
        utterances: koreanUtterances,
        metrics: {
          slashCommandCounts: {},
          questionRatio: 0.05,
          avgDeveloperMessageLength: 350,
        },
      });

      const result = computeDeterministicType(scores, phase1);
      // Trendsetter should have above-minimum distribution (>5%) due to keyword density
      expect(result.distribution.trendsetter).toBeGreaterThan(5);
    });

    it('English keywords are counted in trend density', () => {
      const englishUtterances = [
        createUtterance('What is the latest trending approach?', { id: 's1_0', turnIndex: 0 }),
        createUtterance('Use the newest modern patterns', { id: 's1_1', turnIndex: 1 }),
        createUtterance('Check current version and best practice', { id: 's1_2', turnIndex: 2 }),
      ];

      const scores = createScores({
        learningBehavior: 80,
        thinkingQuality: 10,
        contextEfficiency: 10,
        controlScore: 10,
        sessionOutcome: 10,
      });
      const phase1 = createPhase1Output({
        utterances: englishUtterances,
        metrics: {
          slashCommandCounts: {},
          questionRatio: 0.05,
          avgDeveloperMessageLength: 350,
        },
      });

      const result = computeDeterministicType(scores, phase1);
      expect(result.distribution.trendsetter).toBeGreaterThan(5);
    });

    it('case-insensitive matching: LATEST, Latest, latest all count', () => {
      // Three utterances each using different cases of the same keyword
      const mixedCaseUtterances = [
        createUtterance('LATEST framework check', { id: 's1_0', turnIndex: 0 }),
        createUtterance('Latest tools available', { id: 's1_1', turnIndex: 1 }),
        createUtterance('latest version please', { id: 's1_2', turnIndex: 2 }),
      ];

      // Baseline: no utterances
      const baselineScores = createScores({
        learningBehavior: 80,
        thinkingQuality: 10,
        contextEfficiency: 10,
        controlScore: 10,
        sessionOutcome: 10,
      });
      const baseline = computeDeterministicType(
        baselineScores,
        createPhase1Output({
          utterances: [],
          metrics: { slashCommandCounts: {}, questionRatio: 0.05, avgDeveloperMessageLength: 350 },
        })
      );

      // With mixed-case keywords
      const withKeywords = computeDeterministicType(
        baselineScores,
        createPhase1Output({
          utterances: mixedCaseUtterances,
          metrics: { slashCommandCounts: {}, questionRatio: 0.05, avgDeveloperMessageLength: 350 },
        })
      );

      // trendsetter distribution should be higher with keywords than without
      expect(withKeywords.distribution.trendsetter).toBeGreaterThan(
        baseline.distribution.trendsetter
      );
    });
  });

  // ==========================================================================
  // Distribution Normalization (3 tests)
  // ==========================================================================

  describe('distribution normalization', () => {
    it('all equal inputs produce roughly balanced distribution (no type >40%)', () => {
      // All scores at 50, no special signals, no slash commands, no utterances
      const result = computeDeterministicType(
        createScores(),
        createPhase1Output({
          metrics: {
            slashCommandCounts: {},
            questionRatio: 0.25,
            avgDeveloperMessageLength: 350,
          },
        })
      );

      expect(result.distribution.architect).toBeLessThanOrEqual(40);
      expect(result.distribution.analyst).toBeLessThanOrEqual(40);
      expect(result.distribution.conductor).toBeLessThanOrEqual(40);
      expect(result.distribution.speedrunner).toBeLessThanOrEqual(40);
      expect(result.distribution.trendsetter).toBeLessThanOrEqual(40);
    });

    it('one strongly dominant type gets the highest distribution percentage', () => {
      // Create extreme architect signal
      const scores = createScores({
        thinkingQuality: 100,
        controlScore: 100,
        contextEfficiency: 0,
        learningBehavior: 0,
        sessionOutcome: 0,
      });
      const phase1 = createPhase1Output({
        metrics: {
          slashCommandCounts: { plan: 10, review: 10 },
          questionRatio: 0.0,
          avgDeveloperMessageLength: 350,
        },
      });

      const result = computeDeterministicType(scores, phase1);

      // architect distribution should be the highest
      expect(result.distribution.architect).toBeGreaterThan(result.distribution.analyst);
      expect(result.distribution.architect).toBeGreaterThan(result.distribution.conductor);
      expect(result.distribution.architect).toBeGreaterThan(result.distribution.speedrunner);
      expect(result.distribution.architect).toBeGreaterThan(result.distribution.trendsetter);
    });

    it('all scores 0 with no signals produces valid distribution summing to 100', () => {
      // Even with all 0 scores, some affinity formulas have baseline constants
      // (e.g., concisenessScore for speedrunner). So total affinity may not be 0.
      // We verify structural invariants: sum = 100, all >= 5, primaryType is valid.
      const scores = createScores({
        contextEfficiency: 0,
        sessionOutcome: 0,
        thinkingQuality: 0,
        learningBehavior: 0,
        communicationPatterns: 0,
        controlScore: 0,
      });
      const phase1 = createPhase1Output({
        metrics: {
          slashCommandCounts: {},
          questionRatio: 0,
          avgDeveloperMessageLength: 350,
          totalSessions: 0,
          totalMessages: 0,
          totalDeveloperUtterances: 0,
          totalAIResponses: 0,
        },
        utterances: [],
      });

      const result = computeDeterministicType(scores, phase1);
      const sum =
        result.distribution.architect +
        result.distribution.analyst +
        result.distribution.conductor +
        result.distribution.speedrunner +
        result.distribution.trendsetter;

      expect(sum).toBe(100);
      expect(VALID_TYPES).toContain(result.primaryType);
      expect(result.distribution.architect).toBeGreaterThanOrEqual(5);
      expect(result.distribution.analyst).toBeGreaterThanOrEqual(5);
      expect(result.distribution.conductor).toBeGreaterThanOrEqual(5);
      expect(result.distribution.speedrunner).toBeGreaterThanOrEqual(5);
      expect(result.distribution.trendsetter).toBeGreaterThanOrEqual(5);
    });
  });

  // ==========================================================================
  // Edge Cases (3 tests)
  // ==========================================================================

  describe('edge cases', () => {
    it('all scores 50 (neutral) produces a valid result with all fields', () => {
      const result = computeDeterministicType(createScores(), createPhase1Output());

      expect(VALID_TYPES).toContain(result.primaryType);
      expect(['explorer', 'navigator', 'cartographer']).toContain(result.controlLevel);
      expect(result.controlScore).toBe(50);
      expect(typeof result.matrixName).toBe('string');
      expect(result.matrixName.length).toBeGreaterThan(0);
      expect(typeof result.matrixEmoji).toBe('string');
      expect(result.matrixEmoji.length).toBeGreaterThan(0);

      const sum =
        result.distribution.architect +
        result.distribution.analyst +
        result.distribution.conductor +
        result.distribution.speedrunner +
        result.distribution.trendsetter;
      expect(sum).toBe(100);
    });

    it('all scores 0 still produces a valid result with distribution sum = 100', () => {
      const scores = createScores({
        contextEfficiency: 0,
        sessionOutcome: 0,
        thinkingQuality: 0,
        learningBehavior: 0,
        communicationPatterns: 0,
        controlScore: 0,
      });

      const result = computeDeterministicType(scores, createPhase1Output());

      expect(VALID_TYPES).toContain(result.primaryType);
      expect(result.controlLevel).toBe('explorer');
      expect(result.controlScore).toBe(0);

      const sum =
        result.distribution.architect +
        result.distribution.analyst +
        result.distribution.conductor +
        result.distribution.speedrunner +
        result.distribution.trendsetter;
      expect(sum).toBe(100);
    });

    it('all scores 100 still produces a valid result with distribution sum = 100', () => {
      const scores = createScores({
        contextEfficiency: 100,
        sessionOutcome: 100,
        thinkingQuality: 100,
        learningBehavior: 100,
        communicationPatterns: 100,
        controlScore: 100,
      });

      const result = computeDeterministicType(scores, createPhase1Output());

      expect(VALID_TYPES).toContain(result.primaryType);
      expect(result.controlLevel).toBe('cartographer');
      expect(result.controlScore).toBe(100);

      const sum =
        result.distribution.architect +
        result.distribution.analyst +
        result.distribution.conductor +
        result.distribution.speedrunner +
        result.distribution.trendsetter;
      expect(sum).toBe(100);
    });
  });
});
