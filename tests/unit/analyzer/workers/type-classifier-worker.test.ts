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

/** Helper to create a long paragraph string of specified minimum length */
function makeParagraph(base: string, minLength: number): string {
  let result = base;
  while (result.length < minLength) {
    result += ' ' + base;
  }
  return result;
}

const LONG_PARAGRAPH_1 = makeParagraph('**Systems Architects** are the master planners of the developer world. They approach AI collaboration as a **hypothesis-testing partnership** — always probing, always structuring, always verifying before committing.', 300);
const LONG_PARAGRAPH_2 = makeParagraph('Your sessions reveal a distinctive pattern: you consistently verify AI suggestions against your own mental model before committing. Your **repeated mistake rate is remarkably low**, a hallmark of the architect mindset.', 300);
const LONG_PARAGRAPH_3 = makeParagraph('Your next evolution is **systematic test-driven workflows**. Your investigative instincts are already strong — channeling them into structured verification routines will compound your quality advantage.', 300);

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
    reasoning: [LONG_PARAGRAPH_1, LONG_PARAGRAPH_2, LONG_PARAGRAPH_3],
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
      expect(Array.isArray(result.data.reasoning)).toBe(true);
      expect((result.data.reasoning as string[]).length).toBe(3);
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
      expect(consoleSpy).toHaveBeenCalledWith('[TypeClassifier] Type (LLM): architect');
      expect(consoleSpy).toHaveBeenCalledWith('[TypeClassifier] Control (LLM): navigator (65)');
      expect(consoleSpy).toHaveBeenCalledWith('[TypeClassifier] Matrix (LLM): Systems Architect 🏗️');
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

    it('should retry when first attempt returns too few reasoning elements', async () => {
      const shortOutput = {
        ...createMockLLMOutput(),
        reasoning: ['Short paragraph one.', 'Short paragraph two.'],
      };
      const goodOutput = createMockLLMOutput();

      mockGenerateStructured
        .mockResolvedValueOnce({ data: shortOutput, usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } })
        .mockResolvedValueOnce({ data: goodOutput, usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } });

      const result = await worker.execute(context);

      // Should have retried (2 calls total)
      expect(mockGenerateStructured).toHaveBeenCalledTimes(2);
      // Should use the good result with 3 elements
      expect((result.data.reasoning as string[]).length).toBe(3);
    });

    it('should use best result when all retries fail quality checks', async () => {
      const shortOutput = {
        ...createMockLLMOutput(),
        reasoning: ['A'.repeat(200), 'B'.repeat(200)],
      };
      const slightlyBetterOutput = {
        ...createMockLLMOutput(),
        reasoning: ['C'.repeat(250), 'D'.repeat(250), 'E'.repeat(250)],
      };
      const worstOutput = {
        ...createMockLLMOutput(),
        reasoning: ['F'.repeat(100)],
      };

      mockGenerateStructured
        .mockResolvedValueOnce({ data: shortOutput, usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } })
        .mockResolvedValueOnce({ data: slightlyBetterOutput, usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } })
        .mockResolvedValueOnce({ data: worstOutput, usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } });

      const result = await worker.execute(context);

      // Should have attempted all 3 times
      expect(mockGenerateStructured).toHaveBeenCalledTimes(3);
      // Should pick the longest result (slightlyBetterOutput = 750 chars, still under 800 minimum)
      expect((result.data.reasoning as string[]).length).toBe(3);
    });

    it('should pass preserveArrayConstraints: true to generateStructured', async () => {
      setupMockResponse();

      await worker.execute(context);

      expect(mockGenerateStructured).toHaveBeenCalledWith(
        expect.objectContaining({ preserveArrayConstraints: true })
      );
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
