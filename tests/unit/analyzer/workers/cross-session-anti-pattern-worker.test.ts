/**
 * CrossSessionAntiPatternWorker Tests
 *
 * Tests for Phase 2 CrossSessionAntiPatternWorker.
 * Verifies cross-session pattern detection logic including:
 * - Minimum 2-session threshold
 * - Severity classification
 * - Session traceability
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkerContext } from '../../../../src/lib/analyzer/workers/base-worker.js';
import type { CrossSessionAntiPatternOutput } from '../../../../src/lib/models/agent-outputs.js';
import {
  parseCrossSessionPatternsData,
  parseIsolatedIncidentsData,
  getAllCrossSessionPatterns,
  getAntiPatternSeverity,
  ANTI_PATTERN_HIERARCHY,
} from '../../../../src/lib/models/agent-outputs.js';

// Mock the GeminiClient
vi.mock('../../../../src/lib/analyzer/clients/gemini-client.js', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    generateStructured: vi.fn(),
  })),
}));

// Mock the session formatter
vi.mock('../../../../src/lib/analyzer/shared/session-formatter.js', () => ({
  formatSessionsForAnalysis: vi.fn().mockReturnValue('formatted sessions'),
}));

// Import after mocking
import {
  CrossSessionAntiPatternWorker,
  createCrossSessionAntiPatternWorker,
  type CrossSessionAntiPatternWorkerConfig,
} from '../../../../src/lib/analyzer/workers/cross-session-anti-pattern-worker.js';
import { GeminiClient } from '../../../../src/lib/analyzer/clients/gemini-client.js';

// ============================================================================
// Helper Functions
// ============================================================================

function createMockContext(
  tier: 'free' | 'premium' | 'enterprise' = 'premium',
  sessionCount: number = 5
): WorkerContext {
  const sessions = Array.from({ length: sessionCount }, (_, i) => ({
    sessionId: `session-${i + 1}`,
    startedAt: new Date(`2024-01-0${i + 1}T10:00:00Z`),
    turns: [
      {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: 'Fix this error' }],
      },
      {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: 'Sure, try this approach' }],
      },
    ],
  }));

  return {
    sessions,
    metrics: {
      totalSessions: sessionCount,
      totalTurns: sessionCount * 10,
      averageTurnsPerSession: 10,
      sessionDurations: Array(sessionCount).fill(3600000),
      averageSessionDuration: 3600000,
    },
    tier,
    moduleAOutput: {
      typeAnalysis: {
        primaryType: 'architect',
        controlLevel: 'cartographer',
        distribution: {
          architect: 40,
          scientist: 20,
          collaborator: 20,
          speedrunner: 10,
          craftsman: 10,
        },
        reasoning: 'Test',
      },
      extractedQuotes: [],
      detectedPatterns: [],
      dimensionSignals: [
        { dimension: 'aiCollaboration', strengthSignals: [], growthSignals: [] },
        { dimension: 'contextEngineering', strengthSignals: [], growthSignals: [] },
        { dimension: 'toolMastery', strengthSignals: [], growthSignals: [] },
        { dimension: 'burnoutRisk', strengthSignals: [], growthSignals: [] },
        { dimension: 'aiControl', strengthSignals: [], growthSignals: [] },
        { dimension: 'skillResilience', strengthSignals: [], growthSignals: [] },
      ],
      analysisMetadata: {
        totalQuotesAnalyzed: 0,
        coverageScores: [],
        confidenceScore: 0.8,
      },
    },
  };
}

function createMockOutput(): CrossSessionAntiPatternOutput {
  return {
    criticalAntiPatterns:
      "blind_approval|CRITICAL|4|session_1,session_3,session_5,session_7|High|'looks good, ship it'",
    warningAntiPatterns:
      "passive_acceptance|WARNING|3|session_2,session_4,session_6|Moderate|accepting without evaluation",
    infoAntiPatterns:
      "delegation_without_review|INFO|2|session_3,session_8|Moderate|shipped without testing",
    isolatedIncidents: 'blind_retry|session_5|single occurrence',
    topInsights: [
      "CRITICAL: blind_approval pattern in 4 sessions - 'looks good, ship it' risks technical debt",
      "Try: Before approving, ask 'What could go wrong?' to break blind approval habit",
      'KEEP: Systematic error analysis in Sessions 2, 5, 9',
    ],
    patternDensity: 45,
    crossSessionConsistency: 0.72,
    recommendedInterventions: [
      'Before approving, verify you understand the implications',
      'Ask follow-up questions instead of accepting first suggestion',
    ],
    sessionCrossReferences:
      "blind_approval|'looks good'|'go ahead'|'ship it'|'sounds right'",
    strengthsAcrossSessions:
      "Systematic error analysis|Sessions 2,5,9|'read carefully','stack trace first'",
  };
}

// ============================================================================
// Test Suite: CrossSessionAntiPatternWorker
// ============================================================================

describe('CrossSessionAntiPatternWorker', () => {
  let worker: CrossSessionAntiPatternWorker;
  let context: WorkerContext;
  let mockGenerateStructured: any;

  beforeEach(() => {
    vi.clearAllMocks();
    context = createMockContext('premium', 5);

    // Set up mock for generateStructured method
    mockGenerateStructured = vi.fn();
    vi.mocked(GeminiClient).mockImplementation(
      () =>
        ({
          generateStructured: mockGenerateStructured,
        }) as any
    );

    const config: CrossSessionAntiPatternWorkerConfig = {
      geminiApiKey: 'test-key',
      verbose: false,
    };

    worker = new CrossSessionAntiPatternWorker(config);
  });

  describe('worker properties', () => {
    it('should have correct name', () => {
      expect(worker.name).toBe('CrossSessionAntiPattern');
    });

    it('should be phase 2 worker', () => {
      expect(worker.phase).toBe(2);
    });

    it('should require premium tier', () => {
      expect(worker.minTier).toBe('premium');
    });
  });

  describe('canRun()', () => {
    it('should return true for premium tier with 2+ sessions and moduleAOutput', () => {
      expect(worker.canRun(context)).toBe(true);
    });

    it('should return true for enterprise tier', () => {
      const enterpriseContext = createMockContext('enterprise', 5);
      expect(worker.canRun(enterpriseContext)).toBe(true);
    });

    it('should return false for free tier', () => {
      const freeContext = createMockContext('free', 5);
      expect(worker.canRun(freeContext)).toBe(false);
    });

    it('should return false when moduleAOutput missing', () => {
      const contextWithoutModuleA = {
        ...context,
        moduleAOutput: undefined,
      };
      expect(worker.canRun(contextWithoutModuleA)).toBe(false);
    });

    it('should return false when only 1 session (minimum 2 required)', () => {
      const singleSessionContext = createMockContext('premium', 1);
      expect(worker.canRun(singleSessionContext)).toBe(false);
    });

    it('should return true with exactly 2 sessions (minimum threshold)', () => {
      const twoSessionContext = createMockContext('premium', 2);
      expect(worker.canRun(twoSessionContext)).toBe(true);
    });
  });

  describe('execute()', () => {
    it('should throw when moduleAOutput missing', async () => {
      const contextWithoutModuleA = {
        ...context,
        moduleAOutput: undefined,
      };

      await expect(worker.execute(contextWithoutModuleA)).rejects.toThrow(
        'Module A output required for CrossSessionAntiPattern'
      );
    });

    it('should execute cross-session analysis and return result', async () => {
      const mockOutput = createMockOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: {
          promptTokens: 1200,
          completionTokens: 600,
          totalTokens: 1800,
        },
      });

      const result = await worker.execute(context);

      expect(mockGenerateStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          maxOutputTokens: 12288,
        })
      );
      expect(result.data).toEqual(mockOutput);
      expect(result.usage).toEqual({
        promptTokens: 1200,
        completionTokens: 600,
        totalTokens: 1800,
      });
      expect(result.error).toBeUndefined();
    });

    it('should throw on analysis failure (NO FALLBACK policy)', async () => {
      const error = new Error('Analysis failed');
      mockGenerateStructured.mockRejectedValue(error);

      await expect(worker.execute(context)).rejects.toThrow('Analysis failed');
    });
  });

  describe('factory function', () => {
    it('should create worker with config', () => {
      const config: CrossSessionAntiPatternWorkerConfig = {
        geminiApiKey: 'test-key',
      };
      const createdWorker = createCrossSessionAntiPatternWorker(config);
      expect(createdWorker).toBeInstanceOf(CrossSessionAntiPatternWorker);
      expect(createdWorker.name).toBe('CrossSessionAntiPattern');
    });
  });
});

// ============================================================================
// Test Suite: Schema Parsing Functions
// ============================================================================

describe('Cross-Session Anti-Pattern Schema Parsing', () => {
  describe('parseCrossSessionPatternsData()', () => {
    it('should parse valid pattern data', () => {
      const data =
        "blind_approval|CRITICAL|4|session_1,session_3,session_5,session_7|High|'looks good, ship it'";
      const result = parseCrossSessionPatternsData(data);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        patternType: 'blind_approval',
        severity: 'critical',
        sessionCount: 4,
        sessionIds: ['session_1', 'session_3', 'session_5', 'session_7'],
        frequency: 'High',
        evidence: "'looks good, ship it'",
      });
    });

    it('should parse multiple patterns separated by semicolons', () => {
      const data =
        "blind_approval|CRITICAL|4|session_1,session_3|High|'looks good';sunk_cost_loop|CRITICAL|3|session_2,session_4,session_6|Moderate|npm install repeated";
      const result = parseCrossSessionPatternsData(data);

      expect(result).toHaveLength(2);
      expect(result[0].patternType).toBe('blind_approval');
      expect(result[1].patternType).toBe('sunk_cost_loop');
    });

    it('should filter out patterns with less than 2 sessions', () => {
      const data =
        "blind_approval|CRITICAL|4|session_1,session_3|High|'looks good';isolated|WARNING|1|session_5|Low|single occurrence";
      const result = parseCrossSessionPatternsData(data);

      expect(result).toHaveLength(1);
      expect(result[0].patternType).toBe('blind_approval');
    });

    it('should handle empty or undefined data', () => {
      expect(parseCrossSessionPatternsData('')).toEqual([]);
      expect(parseCrossSessionPatternsData(undefined)).toEqual([]);
    });

    it('should normalize severity to lowercase', () => {
      const data = 'blind_approval|CRITICAL|2|session_1,session_2|High|evidence';
      const result = parseCrossSessionPatternsData(data);
      expect(result[0].severity).toBe('critical');

      const warningData = 'passive_acceptance|WARNING|2|session_1,session_2|High|evidence';
      const warningResult = parseCrossSessionPatternsData(warningData);
      expect(warningResult[0].severity).toBe('warning');
    });

    it('should default frequency to Moderate when not High', () => {
      const data = 'blind_approval|CRITICAL|2|session_1,session_2|Low|evidence';
      const result = parseCrossSessionPatternsData(data);
      expect(result[0].frequency).toBe('Moderate');
    });
  });

  describe('parseIsolatedIncidentsData()', () => {
    it('should parse isolated incidents', () => {
      const data = 'blind_retry|session_5|single occurrence';
      const result = parseIsolatedIncidentsData(data);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        incidentType: 'blind_retry',
        sessionId: 'session_5',
        description: 'single occurrence',
      });
    });

    it('should parse multiple isolated incidents', () => {
      const data =
        'blind_retry|session_5|single occurrence;delegation|session_8|one-off incident';
      const result = parseIsolatedIncidentsData(data);

      expect(result).toHaveLength(2);
    });

    it('should handle empty data', () => {
      expect(parseIsolatedIncidentsData('')).toEqual([]);
      expect(parseIsolatedIncidentsData(undefined)).toEqual([]);
    });
  });

  describe('getAllCrossSessionPatterns()', () => {
    it('should aggregate patterns from all severity levels', () => {
      const output: CrossSessionAntiPatternOutput = {
        criticalAntiPatterns:
          'blind_approval|CRITICAL|4|session_1,session_3,session_5,session_7|High|evidence',
        warningAntiPatterns:
          'passive_acceptance|WARNING|3|session_2,session_4,session_6|Moderate|evidence',
        infoAntiPatterns:
          'delegation_without_review|INFO|2|session_3,session_8|Moderate|evidence',
        isolatedIncidents: '',
        topInsights: [],
        patternDensity: 45,
        crossSessionConsistency: 0.72,
        recommendedInterventions: [],
      };

      const result = getAllCrossSessionPatterns(output);

      expect(result).toHaveLength(3);
      expect(result[0].severity).toBe('critical');
      expect(result[1].severity).toBe('warning');
      expect(result[2].severity).toBe('info');
    });

    it('should handle empty severity levels', () => {
      const output: CrossSessionAntiPatternOutput = {
        criticalAntiPatterns: '',
        warningAntiPatterns:
          'passive_acceptance|WARNING|2|session_1,session_2|Moderate|evidence',
        infoAntiPatterns: '',
        isolatedIncidents: '',
        topInsights: [],
        patternDensity: 15,
        crossSessionConsistency: 0.5,
        recommendedInterventions: [],
      };

      const result = getAllCrossSessionPatterns(output);
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('warning');
    });
  });

  describe('getAntiPatternSeverity()', () => {
    it('should return critical for critical patterns', () => {
      expect(getAntiPatternSeverity('blind_approval')).toBe('critical');
      expect(getAntiPatternSeverity('sunk_cost_loop')).toBe('critical');
    });

    it('should return warning for warning patterns', () => {
      expect(getAntiPatternSeverity('passive_acceptance')).toBe('warning');
      expect(getAntiPatternSeverity('blind_retry')).toBe('warning');
    });

    it('should return info for info patterns and unknown patterns', () => {
      expect(getAntiPatternSeverity('delegation_without_review')).toBe('info');
      expect(getAntiPatternSeverity('unknown_pattern')).toBe('info');
    });
  });

  describe('ANTI_PATTERN_HIERARCHY', () => {
    it('should contain correct critical patterns', () => {
      expect(ANTI_PATTERN_HIERARCHY.critical).toContain('blind_approval');
      expect(ANTI_PATTERN_HIERARCHY.critical).toContain('sunk_cost_loop');
    });

    it('should contain correct warning patterns', () => {
      expect(ANTI_PATTERN_HIERARCHY.warning).toContain('passive_acceptance');
      expect(ANTI_PATTERN_HIERARCHY.warning).toContain('blind_retry');
    });

    it('should contain correct info patterns', () => {
      expect(ANTI_PATTERN_HIERARCHY.info).toContain('delegation_without_review');
    });
  });
});

// ============================================================================
// Test Suite: Cross-Session Detection Logic
// ============================================================================

describe('Cross-Session Detection Logic', () => {
  describe('minimum 2-session threshold', () => {
    it('should require patterns to appear in at least 2 sessions', () => {
      // Patterns with 1 session should be filtered out
      const singleSession = 'pattern|CRITICAL|1|session_1|Low|evidence';
      expect(parseCrossSessionPatternsData(singleSession)).toHaveLength(0);

      // Patterns with 2 sessions should be included
      const twoSessions = 'pattern|CRITICAL|2|session_1,session_2|Moderate|evidence';
      expect(parseCrossSessionPatternsData(twoSessions)).toHaveLength(1);

      // Patterns with 3+ sessions should be included
      const threeSessions =
        'pattern|CRITICAL|3|session_1,session_2,session_3|High|evidence';
      expect(parseCrossSessionPatternsData(threeSessions)).toHaveLength(1);
    });
  });

  describe('frequency classification', () => {
    it('should classify 2 sessions as Moderate frequency', () => {
      const data = 'pattern|CRITICAL|2|session_1,session_2|Moderate|evidence';
      const result = parseCrossSessionPatternsData(data);
      expect(result[0].frequency).toBe('Moderate');
    });

    it('should classify 3+ sessions as High frequency when marked High', () => {
      const data = 'pattern|CRITICAL|3|session_1,session_2,session_3|High|evidence';
      const result = parseCrossSessionPatternsData(data);
      expect(result[0].frequency).toBe('High');
    });
  });

  describe('session ID tracking', () => {
    it('should correctly parse comma-separated session IDs', () => {
      const data = 'pattern|CRITICAL|4|session_1,session_3,session_5,session_7|High|evidence';
      const result = parseCrossSessionPatternsData(data);

      expect(result[0].sessionIds).toEqual([
        'session_1',
        'session_3',
        'session_5',
        'session_7',
      ]);
      expect(result[0].sessionCount).toBe(4);
    });

    it('should handle various session ID formats', () => {
      const data =
        'pattern|CRITICAL|3|abc123,def456,ghi789|High|evidence';
      const result = parseCrossSessionPatternsData(data);

      expect(result[0].sessionIds).toHaveLength(3);
    });
  });
});
