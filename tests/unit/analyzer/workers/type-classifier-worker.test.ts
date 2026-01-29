/**
 * TypeClassifierWorker Tests
 *
 * Tests for Phase 2.5 TypeClassifierWorker.
 * Classifies developers into the AI Collaboration Matrix.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkerContext } from '../../../../src/lib/analyzer/workers/base-worker.js';
import type { TypeClassifierOutput, AgentOutputs } from '../../../../src/lib/models/agent-outputs.js';

// Mock the GeminiClient
vi.mock('../../../../src/lib/analyzer/clients/gemini-client.js', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    generateStructured: vi.fn(),
  })),
}));

// Import after mocking
import {
  TypeClassifierWorker,
  createTypeClassifierWorker,
} from '../../../../src/lib/analyzer/workers/type-classifier-worker.js';
import type { OrchestratorConfig } from '../../../../src/lib/analyzer/orchestrator/types.js';
import { GeminiClient } from '../../../../src/lib/analyzer/clients/gemini-client.js';

// ============================================================================
// Helper Functions
// ============================================================================

function createMockAgentOutputs(): AgentOutputs {
  return {
    trustVerification: {
      antiPatterns: [],
      verificationBehavior: {
        level: 'moderate',
        description: 'Shows verification habits',
        indicators: ['reviews_output', 'questions_results'],
      },
      patternTypes: ['iterative_refinement'],
      overallTrustHealthScore: 75,
      summary: 'Good verification patterns',
      confidenceScore: 0.8,
      strengths: [],
      growthAreas: [],
    },
    workflowHabit: {
      planningHabits: [
        {
          type: 'task_decomposition',
          frequency: 'often',
          examples: ['Break this into steps'],
          effectiveness: 'high',
        },
      ],
      criticalThinkingMoments: [
        {
          type: 'verification',
          quote: 'Let me verify this works',
          result: 'Caught a bug before deployment',
        },
      ],
      overallWorkflowScore: 78,
      summary: 'Well-structured workflow',
      confidenceScore: 0.82,
      strengths: [],
      growthAreas: [],
    },
    knowledgeGap: {
      knowledgeGapsData: 'TypeScript:3:shallow:generics unclear',
      learningProgressData: 'React:novice:intermediate:improved understanding',
      recommendedResourcesData: 'TypeScript:docs:typescriptlang.org',
      topInsights: ['TypeScript generics need attention'],
      overallKnowledgeScore: 70,
      confidenceScore: 0.75,
      strengths: [],
      growthAreas: [],
    },
    contextEfficiency: {
      contextUsagePatternData: 'session1:80:90',
      inefficiencyPatternsData: 'late_compact:5:medium:compacts late',
      promptLengthTrendData: 'early:100;late:300',
      redundantInfoData: 'project_structure:2',
      topInsights: ['Consider earlier compaction'],
      overallEfficiencyScore: 72,
      avgContextFillPercent: 80,
      confidenceScore: 0.78,
      strengths: [],
      growthAreas: [],
    },
  };
}

function createMockContext(
  tier: 'free' | 'premium' = 'premium',
  agentOutputs?: AgentOutputs
): WorkerContext & { agentOutputs?: AgentOutputs } {
  return {
    sessions: [],
    metrics: {
      totalSessions: 5,
      totalTurns: 50,
      averageTurnsPerSession: 10,
      sessionDurations: [3600000],
      averageSessionDuration: 3600000,
    },
    tier,
    agentOutputs: agentOutputs ?? createMockAgentOutputs(),
  };
}

function createMockLLMOutput(): TypeClassifierOutput {
  return {
    primaryType: 'architect',
    distribution: {
      architect: 45,
      scientist: 20,
      collaborator: 15,
      speedrunner: 10,
      craftsman: 10,
    },
    controlLevel: 'navigator',
    controlScore: 65,
    matrixName: 'Systems Architect',
    matrixEmoji: '🏗️',
    collaborationMaturity: {
      level: 'ai_assisted_engineer',
      description: 'Uses AI as a capable tool while maintaining control',
      indicators: ['verifies_output', 'guides_direction', 'maintains_ownership'],
    },
    confidenceScore: 0.85,
    reasoning: 'Based on planning habits and verification patterns',
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('TypeClassifierWorker', () => {
  let worker: TypeClassifierWorker;
  let context: WorkerContext & { agentOutputs?: AgentOutputs };
  let mockGenerateStructured: any;

  beforeEach(() => {
    vi.clearAllMocks();
    context = createMockContext('premium');

    mockGenerateStructured = vi.fn();
    vi.mocked(GeminiClient).mockImplementation(
      () =>
        ({
          generateStructured: mockGenerateStructured,
        }) as any
    );

    const config: OrchestratorConfig = {
      geminiApiKey: 'test-key',
      verbose: false,
    };

    worker = new TypeClassifierWorker(config);
  });

  describe('worker properties', () => {
    it('should have correct name', () => {
      expect(worker.name).toBe('TypeClassifier');
    });

    it('should be phase 2 worker (registered as 2.5)', () => {
      expect(worker.phase).toBe(2);
    });
  });

  describe('constructor', () => {
    it('should create worker with config', () => {
      const config: OrchestratorConfig = {
        geminiApiKey: 'test-key',
        model: 'gemini-3-flash-preview',
        temperature: 1.0,
        verbose: true,
      };
      const worker = new TypeClassifierWorker(config);
      expect(worker).toBeDefined();
      expect(worker.name).toBe('TypeClassifier');
    });
  });

  describe('canRun()', () => {
    it('should return true when agentOutputs present with data', () => {
      expect(worker.canRun(context)).toBe(true);
    });

    it('should return false when agentOutputs missing', () => {
      const contextWithoutOutputs = {
        ...context,
        agentOutputs: undefined,
      };
      expect(worker.canRun(contextWithoutOutputs)).toBe(false);
    });

    it('should return false when agentOutputs is empty object', () => {
      const contextWithEmptyOutputs = {
        ...context,
        agentOutputs: {},
      };
      expect(worker.canRun(contextWithEmptyOutputs)).toBe(false);
    });

    it('should return true with only one Phase 2 output', () => {
      const contextWithOneOutput = {
        ...context,
        agentOutputs: {
          trustVerification: createMockAgentOutputs().trustVerification,
        },
      };
      expect(worker.canRun(contextWithOneOutput)).toBe(true);
    });
  });

  describe('execute()', () => {
    it('should execute classification and return result', async () => {
      const mockOutput = createMockLLMOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: {
          promptTokens: 800,
          completionTokens: 400,
          totalTokens: 1200,
        },
      });

      const result = await worker.execute(context);

      expect(mockGenerateStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          maxOutputTokens: 8192,
        })
      );
      expect(result.data).toBeDefined();
      expect(result.data.primaryType).toBe('architect');
      expect(result.data.controlLevel).toBe('navigator');
      expect(result.usage).toEqual({
        promptTokens: 800,
        completionTokens: 400,
        totalTokens: 1200,
      });
      expect(result.error).toBeUndefined();
    });

    it('should normalize distribution to sum to 100', async () => {
      const mockOutput = {
        ...createMockLLMOutput(),
        distribution: {
          architect: 40,
          scientist: 20,
          collaborator: 15,
          speedrunner: 10,
          craftsman: 10, // Sum = 95, needs normalization
        },
      };
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await worker.execute(context);

      const dist = result.data.distribution;
      const sum = dist.architect + dist.scientist + dist.collaborator + dist.speedrunner + dist.craftsman;
      // Distribution should be normalized close to 100
      expect(Math.abs(sum - 100)).toBeLessThanOrEqual(1);
    });

    it('should include matrix classification fields', async () => {
      const mockOutput = createMockLLMOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await worker.execute(context);

      expect(result.data.matrixName).toBe('Systems Architect');
      expect(result.data.matrixEmoji).toBe('🏗️');
      expect(result.data.collaborationMaturity).toBeDefined();
      expect(result.data.collaborationMaturity?.level).toBe('ai_assisted_engineer');
    });

    it('should log progress when verbose enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseConfig: OrchestratorConfig = {
        geminiApiKey: 'test-key',
        verbose: true,
      };
      const verboseWorker = new TypeClassifierWorker(verboseConfig);

      const mockOutput = createMockLLMOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await verboseWorker.execute(context);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[TypeClassifier] Classifying developer into AI Collaboration Matrix (Phase 2.5)...'
      );
      expect(consoleSpy).toHaveBeenCalledWith('[TypeClassifier] Type: architect');
      expect(consoleSpy).toHaveBeenCalledWith('[TypeClassifier] Control: navigator (65)');
      expect(consoleSpy).toHaveBeenCalledWith('[TypeClassifier] Matrix: Systems Architect 🏗️');

      consoleSpy.mockRestore();
    });

    it('should throw on analysis failure (NO FALLBACK policy)', async () => {
      const error = new Error('LLM API error');
      mockGenerateStructured.mockRejectedValue(error);

      await expect(worker.execute(context)).rejects.toThrow('LLM API error');
    });

    it('should handle missing strengthGrowth gracefully', async () => {
      const contextNoStrengthGrowth = {
        ...context,
        agentOutputs: {
          trustVerification: createMockAgentOutputs().trustVerification,
          // No strengthGrowth
        },
      };

      const mockOutput = createMockLLMOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await worker.execute(contextNoStrengthGrowth);

      expect(result.data).toBeDefined();
      expect(result.data.primaryType).toBe('architect');
    });
  });

  describe('factory function', () => {
    it('should create worker with config', () => {
      const config: OrchestratorConfig = {
        geminiApiKey: 'test-key',
      };
      const worker = createTypeClassifierWorker(config);
      expect(worker).toBeInstanceOf(TypeClassifierWorker);
      expect(worker.name).toBe('TypeClassifier');
    });
  });
});
