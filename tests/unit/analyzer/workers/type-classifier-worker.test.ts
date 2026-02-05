/**
 * TypeClassifierWorker Tests
 *
 * Phase 2.5 TypeClassifierWorker classifies developers into the AI Collaboration Matrix.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkerContext } from '../../../../src/lib/analyzer/workers/base-worker.js';
import type { TypeClassifierOutput, AgentOutputs } from '../../../../src/lib/models/agent-outputs.js';

vi.mock('../../../../src/lib/analyzer/clients/gemini-client.js', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    generateStructured: vi.fn(),
  })),
}));

import {
  TypeClassifierWorker,
  createTypeClassifierWorker,
} from '../../../../src/lib/analyzer/workers/type-classifier-worker.js';
import type { OrchestratorConfig } from '../../../../src/lib/analyzer/orchestrator/types.js';
import { GeminiClient } from '../../../../src/lib/analyzer/clients/gemini-client.js';

function createMockAgentOutputs(): AgentOutputs {
  return {
    thinkingQuality: {
      verificationAntiPatterns: [],
      planningHabits: [{ habitType: 'task_decomposition', displayName: 'Task Decomposition', description: 'Breaking tasks into steps', frequency: 'often', effectiveness: 'high', examples: ['Break this into steps'] }],
      criticalThinkingMoments: [{ momentType: 'verification', displayName: 'Verification', description: 'Verifies before proceeding', quote: 'Let me verify this works', result: 'Caught a bug before deployment', utteranceId: 'sess1_5' }],
      communicationPatterns: [],
      confidenceScore: 0.82,
    },
    learningBehavior: {
      repeatedMistakePatterns: [],
      knowledgeGaps: [{ topic: 'TypeScript generics', displayName: 'TypeScript Generics', depthLevel: 'shallow', frequencyOfQuestions: 3, examples: ['generics unclear'], suggestedResource: 'TypeScript docs' }],
      learningProgressIndicators: [{ area: 'React', displayName: 'React', startingLevel: 'novice', currentLevel: 'intermediate', evidenceOfProgress: 'improved understanding' }],
      confidenceScore: 0.75,
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
    metrics: { totalSessions: 5, totalTurns: 50, averageTurnsPerSession: 10, sessionDurations: [3600000], averageSessionDuration: 3600000 },
    tier,
    agentOutputs: agentOutputs ?? createMockAgentOutputs(),
  };
}

function createMockLLMOutput(): TypeClassifierOutput {
  return {
    primaryType: 'architect',
    distribution: { architect: 45, analyst: 20, conductor: 15, speedrunner: 10, trendsetter: 10 },
    controlLevel: 'navigator',
    controlScore: 65,
    matrixName: 'Systems Architect',
    matrixEmoji: '🏗️',
    collaborationMaturity: { level: 'ai_assisted_engineer', description: 'Uses AI as a capable tool while maintaining control', indicators: ['verifies_output', 'guides_direction', 'maintains_ownership'] },
    confidenceScore: 0.85,
    reasoning: 'Your **methodical approach** to development reveals a deeply structured thinker who naturally gravitates toward systematic problem-solving. When you said 「Let me verify this works before we continue」, it showed a natural instinct for **quality validation** that sets you apart from developers who accept AI output uncritically.\nThis verification-first mindset, combined with your consistent habit of breaking tasks into smaller components before diving into implementation, places you firmly in the architect category. You don\'t just plan — you create structured frameworks that guide both your own thinking and the AI\'s output.\nYour **navigator-level control** means you maintain a balanced relationship with AI tools. You guide the direction while remaining open to suggestions, creating a productive collaboration dynamic that maximizes both human insight and AI capability.',
  };
}

describe('TypeClassifierWorker', () => {
  let worker: TypeClassifierWorker;
  let context: WorkerContext & { agentOutputs?: AgentOutputs };
  let mockGenerateStructured: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    context = createMockContext('premium');
    mockGenerateStructured = vi.fn();
    vi.mocked(GeminiClient).mockImplementation(() => ({ generateStructured: mockGenerateStructured }) as unknown as GeminiClient);
    worker = new TypeClassifierWorker({ geminiApiKey: 'test-key', verbose: false });
  });

  describe('worker properties', () => {
    it('should have correct name and phase', () => {
      expect(worker.name).toBe('TypeClassifier');
      expect(worker.phase).toBe(2);
    });
  });

  describe('constructor', () => {
    it('should create worker with config', () => {
      const newWorker = new TypeClassifierWorker({ geminiApiKey: 'test-key', model: 'gemini-3-flash-preview', temperature: 1.0, verbose: true });
      expect(newWorker.name).toBe('TypeClassifier');
    });
  });

  describe('canRun()', () => {
    it('should return true when agentOutputs present with data', () => {
      expect(worker.canRun(context)).toBe(true);
    });

    it('should return false when agentOutputs missing', () => {
      expect(worker.canRun({ ...context, agentOutputs: undefined })).toBe(false);
    });

    it('should return false when agentOutputs is empty object', () => {
      expect(worker.canRun({ ...context, agentOutputs: {} })).toBe(false);
    });

    it('should return true with only one Phase 2 output', () => {
      expect(worker.canRun({ ...context, agentOutputs: { thinkingQuality: createMockAgentOutputs().thinkingQuality } })).toBe(true);
    });
  });

  describe('execute()', () => {
    function setupMockResponse(output = createMockLLMOutput(), usage = { promptTokens: 800, completionTokens: 400, totalTokens: 1200 }) {
      mockGenerateStructured.mockResolvedValue({ data: output, usage });
    }

    it('should execute classification and return result', async () => {
      setupMockResponse();

      const result = await worker.execute(context);

      expect(mockGenerateStructured).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 65536 }));
      expect(result.data.primaryType).toBe('architect');
      expect(result.data.controlLevel).toBe('navigator');
      expect(result.usage).toEqual({ promptTokens: 800, completionTokens: 400, totalTokens: 1200 });
      expect(result.error).toBeUndefined();
    });

    it('should include personalized reasoning in result', async () => {
      setupMockResponse();

      const result = await worker.execute(context);

      expect(result.data.reasoning).toBeDefined();
      expect(typeof result.data.reasoning).toBe('string');
      expect(result.data.reasoning.length).toBeGreaterThan(100);
    });

    it('should normalize distribution to sum to 100', async () => {
      const mockOutput = { ...createMockLLMOutput(), distribution: { architect: 40, analyst: 20, conductor: 15, speedrunner: 10, trendsetter: 10 } };
      setupMockResponse(mockOutput, { promptTokens: 100, completionTokens: 50, totalTokens: 150 });

      const result = await worker.execute(context);

      const dist = result.data.distribution;
      const sum = dist.architect + dist.analyst + dist.conductor + dist.speedrunner + dist.trendsetter;
      expect(Math.abs(sum - 100)).toBeLessThanOrEqual(1);
    });

    it('should include matrix classification fields', async () => {
      setupMockResponse(createMockLLMOutput(), { promptTokens: 100, completionTokens: 50, totalTokens: 150 });

      const result = await worker.execute(context);

      expect(result.data.matrixName).toBe('Systems Architect');
      expect(result.data.matrixEmoji).toBe('🏗️');
      expect(result.data.collaborationMaturity?.level).toBe('ai_assisted_engineer');
    });

    it('should log progress when verbose enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseWorker = new TypeClassifierWorker({ geminiApiKey: 'test-key', verbose: true });
      setupMockResponse(createMockLLMOutput(), { promptTokens: 100, completionTokens: 50, totalTokens: 150 });

      await verboseWorker.execute(context);

      expect(consoleSpy).toHaveBeenCalledWith('[TypeClassifier] Classifying developer into AI Collaboration Matrix (Phase 2.5)...');
      expect(consoleSpy).toHaveBeenCalledWith('[TypeClassifier] Type: architect');
      expect(consoleSpy).toHaveBeenCalledWith('[TypeClassifier] Control: navigator (65)');
      expect(consoleSpy).toHaveBeenCalledWith('[TypeClassifier] Matrix: Systems Architect 🏗️');
      consoleSpy.mockRestore();
    });

    it('should throw on analysis failure (NO FALLBACK policy)', async () => {
      mockGenerateStructured.mockRejectedValue(new Error('LLM API error'));
      await expect(worker.execute(context)).rejects.toThrow('LLM API error');
    });

    it('should handle missing learningBehavior gracefully', async () => {
      setupMockResponse(createMockLLMOutput(), { promptTokens: 100, completionTokens: 50, totalTokens: 150 });

      const result = await worker.execute({ ...context, agentOutputs: { thinkingQuality: createMockAgentOutputs().thinkingQuality } });

      expect(result.data.primaryType).toBe('architect');
    });
  });

  describe('factory function', () => {
    it('should create worker with config', () => {
      const factoryWorker = createTypeClassifierWorker({ geminiApiKey: 'test-key' });
      expect(factoryWorker).toBeInstanceOf(TypeClassifierWorker);
      expect(factoryWorker.name).toBe('TypeClassifier');
    });
  });
});
