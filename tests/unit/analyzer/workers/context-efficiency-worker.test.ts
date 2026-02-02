/**
 * ContextEfficiencyWorker Tests
 *
 * Phase 2 ContextEfficiencyWorker (Wow Agent 4).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkerContext } from '../../../../src/lib/analyzer/workers/base-worker.js';
import type { ContextEfficiencyOutput } from '../../../../src/lib/models/agent-outputs.js';
import type { Phase1Output } from '../../../../src/lib/models/phase1-output.js';

vi.mock('../../../../src/lib/analyzer/clients/gemini-client.js', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    generateStructured: vi.fn(),
  })),
}));

import {
  ContextEfficiencyWorker,
  createContextEfficiencyWorker,
} from '../../../../src/lib/analyzer/workers/context-efficiency-worker.js';
import type { OrchestratorConfig } from '../../../../src/lib/analyzer/orchestrator/types.js';
import { GeminiClient } from '../../../../src/lib/analyzer/clients/gemini-client.js';

function createUtterance(
  id: string,
  text: string,
  overrides: Partial<Phase1Output['developerUtterances'][0]> = {}
): Phase1Output['developerUtterances'][0] {
  return {
    id,
    text,
    timestamp: '2024-01-01T10:00:00Z',
    sessionId: 'session-1',
    turnIndex: 0,
    characterCount: text.length,
    wordCount: text.split(' ').length,
    hasCodeBlock: false,
    hasQuestion: text.includes('?'),
    isSessionStart: id.endsWith('_0'),
    isContinuation: false,
    ...overrides,
  };
}

function createMockContext(tier: 'free' | 'premium' = 'premium'): WorkerContext {
  const phase1Output: Phase1Output = {
    developerUtterances: [
      createUtterance('session-1_0', 'Here is the project structure again...'),
      createUtterance('session-1_2', 'Can you review this code?', { turnIndex: 2, timestamp: '2024-01-01T10:05:00Z' }),
    ],
    sessionMetrics: {
      totalSessions: 1,
      totalMessages: 3,
      totalDeveloperUtterances: 2,
      totalAIResponses: 1,
      avgMessagesPerSession: 3,
      avgDeveloperMessageLength: 33,
      questionRatio: 0.5,
      codeBlockRatio: 0,
      dateRange: { earliest: '2024-01-01T10:00:00Z', latest: '2024-01-01T10:05:00Z' },
    },
  };

  return {
    sessions: [{
      sessionId: 'session-1',
      startedAt: new Date('2024-01-01T10:00:00Z'),
      turns: [{ role: 'user', content: [{ type: 'text', text: 'Here is the project structure again...' }] }],
    }],
    metrics: { totalSessions: 1, totalTurns: 10, averageTurnsPerSession: 10, sessionDurations: [3600000], averageSessionDuration: 3600000 },
    tier,
    phase1Output,
  };
}

function createMockOutput(): ContextEfficiencyOutput {
  return {
    contextUsagePatterns: [
      { sessionId: 'session1', avgFillPercent: 85, compactTriggerPercent: 92 },
      { sessionId: 'session2', avgFillPercent: 78, compactTriggerPercent: 88 },
      { sessionId: 'session3', avgFillPercent: 91, compactTriggerPercent: 95 },
    ],
    inefficiencyPatterns: [
      { pattern: 'late_compact', frequency: 15, impact: 'high', description: 'always compacts at 90%+' },
      { pattern: 'context_bloat', frequency: 8, impact: 'medium', description: 'never uses /clear' },
    ],
    promptLengthTrends: [{ phase: 'early', avgLength: 150 }, { phase: 'mid', avgLength: 280 }, { phase: 'late', avgLength: 450 }],
    redundantInfo: [{ infoType: 'project_structure', repeatCount: 5 }, { infoType: 'tech_stack', repeatCount: 3 }, { infoType: 'file_paths', repeatCount: 7 }],
    contextUsagePatternData: 'session1:85:92;session2:78:88;session3:91:95',
    inefficiencyPatternsData: 'late_compact:15:high:always compacts at 90%+;context_bloat:8:medium:never uses /clear',
    promptLengthTrendData: 'early:150;mid:280;late:450',
    redundantInfoData: 'project_structure:5;tech_stack:3;file_paths:7',
    topInsights: ['Average 85% context fill before compact - consider earlier compaction', 'Prompt length increases 2.3x in late session', 'Project structure explained 5 times - set in context once'],
    overallEfficiencyScore: 65,
    avgContextFillPercent: 84,
    confidenceScore: 0.79,
    strengths: [],
    growthAreas: [],
  };
}

describe('ContextEfficiencyWorker', () => {
  let worker: ContextEfficiencyWorker;
  let context: WorkerContext;
  let mockGenerateStructured: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    context = createMockContext('premium');
    mockGenerateStructured = vi.fn();
    vi.mocked(GeminiClient).mockImplementation(() => ({ generateStructured: mockGenerateStructured }) as unknown as GeminiClient);
    worker = new ContextEfficiencyWorker({ geminiApiKey: 'test-key', verbose: false });
  });

  describe('worker properties', () => {
    it('should have correct name and phase', () => {
      expect(worker.name).toBe('ContextEfficiency');
      expect(worker.phase).toBe(2);
    });
  });

  describe('constructor', () => {
    it('should create worker with config', () => {
      const newWorker = new ContextEfficiencyWorker({ geminiApiKey: 'test-key', model: 'gemini-3-flash-preview', temperature: 1.0, verbose: true });
      expect(newWorker.name).toBe('ContextEfficiency');
    });
  });

  describe('canRun()', () => {
    it('should return true when phase1Output present', () => {
      expect(worker.canRun(context)).toBe(true);
    });

    it('should return true for any tier (tier filtering at ContentGateway)', () => {
      expect(worker.canRun(createMockContext('free'))).toBe(true);
    });

    it('should return false when phase1Output missing', () => {
      expect(worker.canRun({ ...context, phase1Output: undefined })).toBe(false);
    });

    it('should return false when developerUtterances empty', () => {
      const contextWithEmptyUtterances = { ...context, phase1Output: { ...context.phase1Output!, developerUtterances: [] } };
      expect(worker.canRun(contextWithEmptyUtterances)).toBe(false);
    });
  });

  describe('execute()', () => {
    function setupMockResponse(output = createMockOutput(), usage = { promptTokens: 650, completionTokens: 325, totalTokens: 975 }) {
      mockGenerateStructured.mockResolvedValue({ data: output, usage });
    }

    it('should throw when phase1Output missing', async () => {
      await expect(worker.execute({ ...context, phase1Output: undefined })).rejects.toThrow('Phase 1 output required for ContextEfficiencyWorker');
    });

    it('should execute analysis and return result', async () => {
      setupMockResponse();

      const result = await worker.execute(context);

      expect(mockGenerateStructured).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 8192 }));
      expect(result.data).toEqual(createMockOutput());
      expect(result.usage).toEqual({ promptTokens: 650, completionTokens: 325, totalTokens: 975 });
      expect(result.error).toBeUndefined();
    });

    it('should log progress when verbose enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseWorker = new ContextEfficiencyWorker({ geminiApiKey: 'test-key', verbose: true });
      setupMockResponse(createMockOutput(), { promptTokens: 100, completionTokens: 50, totalTokens: 150 });

      await verboseWorker.execute(context);

      expect(consoleSpy).toHaveBeenCalledWith('[ContextEfficiency] Analyzing context efficiency and productivity...');
      expect(consoleSpy).toHaveBeenCalledWith('[ContextEfficiency] Utterances: 2');
      expect(consoleSpy).toHaveBeenCalledWith('[ContextEfficiency] Efficiency score: 65');
      expect(consoleSpy).toHaveBeenCalledWith('[ContextEfficiency] Avg context fill: 84%');
      consoleSpy.mockRestore();
    });

    it('should throw on analysis failure (NO FALLBACK policy)', async () => {
      mockGenerateStructured.mockRejectedValue(new Error('Analysis failed'));
      await expect(worker.execute(context)).rejects.toThrow('Analysis failed');
    });
  });

  describe('factory function', () => {
    it('should create worker with config', () => {
      const factoryWorker = createContextEfficiencyWorker({ geminiApiKey: 'test-key' });
      expect(factoryWorker).toBeInstanceOf(ContextEfficiencyWorker);
      expect(factoryWorker.name).toBe('ContextEfficiency');
    });
  });
});
