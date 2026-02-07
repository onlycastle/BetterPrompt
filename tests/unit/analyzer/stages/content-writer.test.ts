/**
 * ContentWriterStage Tests
 *
 * Phase 3 ContentWriterStage generates narrative content from Phase 2 analysis.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AgentOutputs } from '../../../../src/lib/models/agent-outputs.js';
import type { Phase1Output } from '../../../../src/lib/models/phase1-output.js';

vi.mock('../../../../src/lib/analyzer/clients/gemini-client.js', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    generateStructured: vi.fn(),
  })),
}));

import { ContentWriterStage, type ContentWriterConfig } from '../../../../src/lib/analyzer/stages/content-writer.js';
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
    hasQuestion: false,
    isSessionStart: id.endsWith('_0'),
    isContinuation: false,
    ...overrides,
  };
}

function createMockPhase1Output(): Phase1Output {
  return {
    developerUtterances: [
      createUtterance('session-1_0', 'Help me implement a new feature for user authentication with OAuth integration'),
      createUtterance('session-1_2', 'Actually, let me verify that the token refresh logic handles edge cases correctly before we continue', {
        turnIndex: 2,
        timestamp: '2024-01-01T10:05:00Z',
      }),
    ],
    sessionMetrics: {
      totalSessions: 1,
      totalMessages: 3,
      totalDeveloperUtterances: 2,
      totalAIResponses: 1,
      avgMessagesPerSession: 3,
      avgDeveloperMessageLength: 85,
      questionRatio: 0,
      codeBlockRatio: 0,
      dateRange: {
        earliest: '2024-01-01T10:00:00Z',
        latest: '2024-01-01T10:05:00Z',
      },
    },
  };
}

function createMockAgentOutputs(): AgentOutputs {
  return {
    thinkingQuality: {
      planningHabits: [{ type: 'task_decomposition', frequency: 'often', effectiveness: 'high', examples: ['Break this down'] }],
      planQualityScore: 75,
      verificationBehavior: { level: 'systematic_verification', examples: ['reviews_code', 'tests_changes'], recommendation: 'Continue this excellent practice' },
      criticalThinkingMoments: [{ type: 'verification_request', quote: 'verify that the token refresh logic handles edge cases', result: 'Caught potential edge case', utteranceId: 'session-1_2' }],
      verificationAntiPatterns: [{ type: 'passive_acceptance', frequency: 3, severity: 'low', examples: [{ utteranceId: 'session-1_0', quote: 'ok ship it', context: 'After AI generated code' }], improvement: 'Review AI output before accepting' }],
      communicationPatterns: [],
      overallThinkingQualityScore: 80,
      confidenceScore: 0.85,
    },
    learningBehavior: {
      knowledgeGaps: [],
      learningProgress: [],
      recommendedResources: [],
      repeatedMistakePatterns: [],
      topInsights: [],
      overallLearningScore: 70,
      confidenceScore: 0.8,
    },
    typeClassifier: {
      primaryType: 'architect',
      distribution: { architect: 50, analyst: 20, conductor: 15, speedrunner: 10, trendsetter: 5 },
      controlLevel: 'navigator',
      controlScore: 70,
      matrixName: 'Systems Architect',
      matrixEmoji: '🏗️',
      confidenceScore: 0.88,
    },
  };
}

function createMockNarrativeResponse() {
  return {
    promptPatterns: [
      { patternName: 'Verification Before Progress', description: 'You pause to verify results before moving forward', frequency: 'often', examples: [{ utteranceId: 'session-1_2', analysis: 'Strong verification mindset shown' }], effectiveness: 'very_effective', tip: 'Continue this pattern - it prevents compounding errors' },
      { patternName: 'Clear Task Specification', description: 'You provide detailed context when requesting changes', frequency: 'sometimes', examples: [{ utteranceId: 'session-1_0', analysis: 'Clear OAuth implementation request' }], effectiveness: 'effective', tip: 'Consider including expected behavior in requests' },
      { patternName: 'Iterative Refinement', description: 'You refine requests based on AI output', frequency: 'often', examples: [], effectiveness: 'effective', tip: 'This iterative approach helps converge on quality solutions' },
    ],
    topFocusAreas: {
      areas: [{ rank: 1, dimension: 'aiCollaboration', title: 'Expand Test Coverage', narrative: 'Your verification habits are strong - extend them to automated testing', expectedImpact: 'Catch more edge cases automatically', priorityScore: 85, actions: { start: 'Add unit tests for OAuth flow', stop: '', continue: 'Implement integration tests' } }],
      summary: 'Focus on systematizing your verification approach',
    },
  };
}

describe('ContentWriterStage', () => {
  let stage: ContentWriterStage;
  let mockGenerateStructured: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateStructured = vi.fn();
    vi.mocked(GeminiClient).mockImplementation(() => ({ generateStructured: mockGenerateStructured }) as unknown as GeminiClient);
    stage = new ContentWriterStage();
  });

  describe('constructor', () => {
    it('should create stage with default config', () => {
      const stage = new ContentWriterStage();
      expect(stage).toBeDefined();
    });

    it('should create stage with custom config', () => {
      const config: ContentWriterConfig = {
        apiKey: 'test-key',
        model: 'gemini-3-flash-preview',
        temperature: 1.0,
        maxOutputTokens: 32768,
        maxRetries: 3,
        verbose: true,
      };
      const stage = new ContentWriterStage(config);
      expect(stage).toBeDefined();
    });
  });

  describe('transformV3()', () => {
    it('should generate narrative content from Phase 2 outputs', async () => {
      const mockResponse = createMockNarrativeResponse();
      mockGenerateStructured.mockResolvedValue({
        data: mockResponse,
        usage: {
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500,
        },
      });

      const result = await stage.transformV3(
        5, // sessionCount
        createMockAgentOutputs(),
        createMockPhase1Output()
      );

      expect(result.data).toBeDefined();
      expect(result.data.promptPatterns).toBeDefined();
      expect(result.usage).toEqual({
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      });
    });

    it('should call generateStructured with correct parameters', async () => {
      const mockResponse = createMockNarrativeResponse();
      mockGenerateStructured.mockResolvedValue({
        data: mockResponse,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await stage.transformV3(5, createMockAgentOutputs(), createMockPhase1Output());

      expect(mockGenerateStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.any(String),
          userPrompt: expect.any(String),
          responseSchema: expect.any(Object),
          maxOutputTokens: 65536,
        })
      );
    });

    it('should work without phase1Output', async () => {
      const mockResponse = createMockNarrativeResponse();
      mockGenerateStructured.mockResolvedValue({
        data: mockResponse,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await stage.transformV3(
        5,
        createMockAgentOutputs(),
        undefined // No phase1Output
      );

      expect(result.data).toBeDefined();
    });

    it('should include knowledge resources when provided', async () => {
      const mockResponse = createMockNarrativeResponse();
      mockGenerateStructured.mockResolvedValue({
        data: mockResponse,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      // DimensionResourceMatch requires the exact schema shape
      const knowledgeResources = [
        {
          dimension: 'aiCollaboration' as const,
          dimensionDisplayName: 'AI Collaboration',
          professionalInsights: [
            {
              id: 'insight-1',
              title: 'Effective AI Pair Programming',
              keyTakeaway: 'Use AI as a pair programming partner',
              actionableAdvice: ['Review AI suggestions', 'Verify output'],
              sourceAuthor: 'Expert Dev',
              sourceUrl: 'https://example.com',
              category: 'collaboration',
              priority: 1,
              matchScore: 8.5,
            },
          ],
          knowledgeItems: [
            {
              id: 'kb-1',
              title: 'Best Practices',
              summary: 'Learn to collaborate effectively with AI',
              category: 'collaboration',
              matchScore: 7.5,
            },
          ],
        },
      ];

      const result = await stage.transformV3(
        5,
        createMockAgentOutputs(),
        createMockPhase1Output(),
        knowledgeResources
      );

      expect(result.data).toBeDefined();
    });

    it('should throw on LLM error (NO FALLBACK policy)', async () => {
      const error = new Error('LLM API error');
      mockGenerateStructured.mockRejectedValue(error);

      await expect(
        stage.transformV3(5, createMockAgentOutputs(), createMockPhase1Output())
      ).rejects.toThrow('LLM API error');
    });
  });

  describe('verifyPhase2WorkerExamples()', () => {
    it('should verify and filter anti-pattern examples', () => {
      const agentOutputs: AgentOutputs = {
        thinkingQuality: {
          planningHabits: [],
          planQualityScore: 70,
          verificationBehavior: { level: 'minimal_verification', examples: [], recommendation: '' },
          criticalThinkingMoments: [],
          verificationAntiPatterns: [{
            type: 'blind_acceptance',
            frequency: 1,
            severity: 'moderate',
            examples: [
              { utteranceId: 'session-1_0', quote: 'Help me implement a new feature', context: 'Initial request' },
              { utteranceId: 'invalid_id', quote: 'This should be filtered', context: 'Invalid' },
            ],
            improvement: 'Review before accepting',
          }],
          communicationPatterns: [],
          overallThinkingQualityScore: 70,
          confidenceScore: 0.8,
        },
      };

      stage.verifyPhase2WorkerExamples(agentOutputs, createMockPhase1Output());

      const examples = agentOutputs.thinkingQuality?.verificationAntiPatterns[0].examples;
      expect(examples?.length).toBe(1);
      expect(examples?.[0].utteranceId).toBe('session-1_0');
    });

    it('should handle missing agentOutputs gracefully', () => {
      expect(() => stage.verifyPhase2WorkerExamples({}, createMockPhase1Output())).not.toThrow();
    });

    it('should handle empty utterances', () => {
      const phase1Output: Phase1Output = {
        developerUtterances: [],
        sessionMetrics: createMockPhase1Output().sessionMetrics,
      };
      expect(() => stage.verifyPhase2WorkerExamples(createMockAgentOutputs(), phase1Output)).not.toThrow();
    });
  });

  describe('Evidence-Based Utterance Selection', () => {
    it('should use Phase 2 evidence utterances when available', async () => {
      const phase1Output: Phase1Output = {
        developerUtterances: [
          createUtterance('evidence-utterance-1', 'Help me with OAuth implementation with proper error handling'),
          createUtterance('non-evidence-utterance', 'ok', { turnIndex: 2, timestamp: '2024-01-01T10:01:00Z' }),
          createUtterance('evidence-utterance-2', 'Let me verify the token refresh handles all edge cases correctly', { turnIndex: 4, timestamp: '2024-01-01T10:05:00Z' }),
        ],
        sessionMetrics: createMockPhase1Output().sessionMetrics,
      };

      const agentOutputs: AgentOutputs = {
        thinkingQuality: {
          planningHabits: [],
          planQualityScore: 75,
          verificationBehavior: { level: 'systematic_verification', examples: ['reviews'], recommendation: '' },
          criticalThinkingMoments: [{ type: 'verification_request', quote: 'verify token refresh', result: 'positive', utteranceId: 'evidence-utterance-2' }],
          verificationAntiPatterns: [{ type: 'blind_acceptance', frequency: 1, severity: 'moderate', examples: [{ utteranceId: 'evidence-utterance-1', quote: 'OAuth implementation request', context: 'Initial request' }], improvement: 'Review before accepting' }],
          communicationPatterns: [],
          overallThinkingQualityScore: 85,
          confidenceScore: 0.9,
        },
        learningBehavior: { knowledgeGaps: [], learningProgress: [], recommendedResources: [], repeatedMistakePatterns: [], topInsights: [], overallLearningScore: 70, confidenceScore: 0.8 },
        typeClassifier: { primaryType: 'architect', distribution: { architect: 50, analyst: 20, conductor: 15, speedrunner: 10, trendsetter: 5 }, controlLevel: 'navigator', controlScore: 70, matrixName: 'Systems Architect', matrixEmoji: '🏗️', confidenceScore: 0.88 },
      };

      mockGenerateStructured.mockResolvedValue({
        data: createMockNarrativeResponse(),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await stage.transformV3(5, agentOutputs, phase1Output);

      expect(mockGenerateStructured).toHaveBeenCalled();
      const userPrompt = mockGenerateStructured.mock.calls[0][0].userPrompt as string;
      // Evidence utterance IDs appear in the phase3-summarizer output (e.g., anti-pattern evidence)
      // Note: Developer utterances table is no longer included in ContentWriter prompt
      // (utterances are now passed to TypeClassifier instead)
      expect(userPrompt).toContain('evidence-utterance-1');
    });

    it('should throw error when no Phase 2 evidence (No Fallback Policy)', async () => {
      const agentOutputs: AgentOutputs = {
        thinkingQuality: {
          planningHabits: [],
          planQualityScore: 75,
          verificationBehavior: { level: 'systematic_verification', examples: [], recommendation: '' },
          criticalThinkingMoments: [],
          verificationAntiPatterns: [],
          communicationPatterns: [],
          overallThinkingQualityScore: 85,
          confidenceScore: 0.9,
        },
        learningBehavior: { knowledgeGaps: [], learningProgress: [], recommendedResources: [], repeatedMistakePatterns: [], topInsights: [], overallLearningScore: 70, confidenceScore: 0.8 },
        typeClassifier: { primaryType: 'architect', distribution: { architect: 50, analyst: 20, conductor: 15, speedrunner: 10, trendsetter: 5 }, controlLevel: 'navigator', controlScore: 70, matrixName: 'Systems Architect', matrixEmoji: '🏗️', confidenceScore: 0.88 },
      };

      await expect(stage.transformV3(5, agentOutputs, createMockPhase1Output()))
        .rejects.toThrow('Phase 2 evidence extraction produced no utteranceIds');
    });
  });
});
