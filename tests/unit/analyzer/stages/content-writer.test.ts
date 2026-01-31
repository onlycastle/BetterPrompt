/**
 * ContentWriterStage Tests
 *
 * Tests for Phase 3 ContentWriterStage.
 * Generates narrative content from Phase 2 analysis.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AgentOutputs } from '../../../../src/lib/models/agent-outputs.js';
import type { Phase1Output } from '../../../../src/lib/models/phase1-output.js';

// Mock the GeminiClient
vi.mock('../../../../src/lib/analyzer/clients/gemini-client.js', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    generateStructured: vi.fn(),
  })),
}));

// Import after mocking
import { ContentWriterStage, type ContentWriterConfig } from '../../../../src/lib/analyzer/stages/content-writer.js';
import { GeminiClient } from '../../../../src/lib/analyzer/clients/gemini-client.js';

// ============================================================================
// Helper Functions
// ============================================================================

function createMockPhase1Output(): Phase1Output {
  return {
    developerUtterances: [
      {
        id: 'session-1_0',
        text: 'Help me implement a new feature for user authentication with OAuth integration',
        timestamp: '2024-01-01T10:00:00Z',
        sessionId: 'session-1',
        turnIndex: 0,
        characterCount: 75,
        wordCount: 12,
        hasCodeBlock: false,
        hasQuestion: false,
        isSessionStart: true,
        isContinuation: false,
      },
      {
        id: 'session-1_2',
        text: 'Actually, let me verify that the token refresh logic handles edge cases correctly before we continue',
        timestamp: '2024-01-01T10:05:00Z',
        sessionId: 'session-1',
        turnIndex: 2,
        characterCount: 95,
        wordCount: 16,
        hasCodeBlock: false,
        hasQuestion: false,
        isSessionStart: false,
        isContinuation: false,
      },
    ],
    aiResponses: [
      {
        id: 'session-1_1',
        sessionId: 'session-1',
        turnIndex: 1,
        responseType: 'code_change',
        toolsUsed: ['Edit', 'Write'],
        textSnippet: 'I will help you implement OAuth authentication...',
        fullTextLength: 500,
        hadError: false,
        wasSuccessful: true,
      },
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
    trustVerification: {
      antiPatterns: [],
      verificationBehavior: {
        level: 'high',
        description: 'Consistently verifies AI output',
        indicators: ['reviews_code', 'tests_changes'],
      },
      patternTypes: ['verification_first'],
      overallTrustHealthScore: 85,
      summary: 'Strong verification habits',
      confidenceScore: 0.9,
      strengths: [
        {
          title: 'Verification mindset',
          description: 'Consistently verifies before proceeding',
          evidence: [{ utteranceId: 'session-1_2', quote: 'verify that the token refresh logic handles edge cases' }],
          frequency: 'consistent',
        },
      ],
      growthAreas: [],
    },
    workflowHabit: {
      planningHabits: [
        {
          type: 'task_decomposition',
          frequency: 'often',
          examples: ['Break this down'],
          effectiveness: 'high',
        },
      ],
      criticalThinkingMoments: [
        {
          type: 'verification',
          quote: 'verify that the token refresh logic handles edge cases',
          result: 'Caught potential edge case',
          utteranceId: 'session-1_2',
        },
      ],
      overallWorkflowScore: 80,
      summary: 'Good workflow structure',
      confidenceScore: 0.85,
      strengths: [],
      growthAreas: [],
    },
    typeClassifier: {
      primaryType: 'architect',
      distribution: {
        architect: 50,
        scientist: 20,
        collaborator: 15,
        speedrunner: 10,
        craftsman: 5,
      },
      controlLevel: 'navigator',
      controlScore: 70,
      matrixName: 'Systems Architect',
      matrixEmoji: '🏗️',
      confidenceScore: 0.88,
    },
  };
}

function createMockNarrativeResponse(): any {
  return {
    personalitySummary: 'You are a thoughtful developer who maintains strong oversight of AI-generated code. Your verification-first approach ensures quality while your planning habits demonstrate strategic thinking. This combination makes you an effective AI collaborator who leverages automation while maintaining ownership of the codebase.',
    promptPatterns: [
      {
        patternName: 'Verification Before Progress',
        description: 'You pause to verify results before moving forward',
        frequency: 'often',
        examplesData: 'session-1_2|Strong verification mindset shown',
        effectiveness: 'very_effective',
        tip: 'Continue this pattern - it prevents compounding errors',
      },
      {
        patternName: 'Clear Task Specification',
        description: 'You provide detailed context when requesting changes',
        frequency: 'sometimes',
        examplesData: 'session-1_0|Clear OAuth implementation request',
        effectiveness: 'effective',
        tip: 'Consider including expected behavior in requests',
      },
      {
        patternName: 'Iterative Refinement',
        description: 'You refine requests based on AI output',
        frequency: 'often',
        examplesData: '',
        effectiveness: 'effective',
        tip: 'This iterative approach helps converge on quality solutions',
      },
    ],
    topFocusAreas: {
      areas: [
        {
          rank: 1,
          dimension: 'aiCollaboration',
          title: 'Expand Test Coverage',
          narrative: 'Your verification habits are strong - extend them to automated testing',
          expectedImpact: 'Catch more edge cases automatically',
          priorityScore: 85,
          actionsData: 'Add unit tests for OAuth flow|Implement integration tests',
        },
      ],
      summary: 'Focus on systematizing your verification approach',
    },
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('ContentWriterStage', () => {
  let stage: ContentWriterStage;
  let mockGenerateStructured: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGenerateStructured = vi.fn();
    vi.mocked(GeminiClient).mockImplementation(
      () =>
        ({
          generateStructured: mockGenerateStructured,
        }) as any
    );

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
      expect(result.data.personalitySummary).toBeDefined();
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
      expect(result.data.personalitySummary).toBeDefined();
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
        trustVerification: {
          antiPatterns: [
            {
              type: 'blind_acceptance',
              frequency: 1,
              severity: 'moderate',
              examples: [
                { utteranceId: 'session-1_0', quote: 'Help me implement a new feature' },
                { utteranceId: 'invalid_id', quote: 'This should be filtered' },
              ],
            },
          ],
          verificationBehavior: { level: 'moderate', description: '', indicators: [] },
          patternTypes: [],
          overallTrustHealthScore: 70,
          summary: '',
          confidenceScore: 0.8,
          strengths: [],
          growthAreas: [],
        },
      };

      const phase1Output = createMockPhase1Output();

      stage.verifyPhase2WorkerExamples(agentOutputs, phase1Output);

      // Invalid utteranceId should be filtered out
      const examples = agentOutputs.trustVerification?.antiPatterns[0].examples;
      expect(examples?.length).toBe(1);
      expect(examples?.[0].utteranceId).toBe('session-1_0');
    });

    it('should handle missing agentOutputs gracefully', () => {
      const agentOutputs: AgentOutputs = {};
      const phase1Output = createMockPhase1Output();

      // Should not throw
      expect(() => {
        stage.verifyPhase2WorkerExamples(agentOutputs, phase1Output);
      }).not.toThrow();
    });

    it('should handle empty utterances', () => {
      const agentOutputs = createMockAgentOutputs();
      const phase1Output: Phase1Output = {
        developerUtterances: [],
        aiResponses: [],
        sessionMetrics: createMockPhase1Output().sessionMetrics,
      };

      // Should not throw
      expect(() => {
        stage.verifyPhase2WorkerExamples(agentOutputs, phase1Output);
      }).not.toThrow();
    });
  });

  describe('Evidence-Based Utterance Selection', () => {
    it('should use Phase 2 evidence utterances when available', async () => {
      // Create Phase 1 with multiple utterances
      const phase1Output: Phase1Output = {
        developerUtterances: [
          {
            id: 'evidence-utterance-1',
            text: 'Help me with OAuth implementation with proper error handling',
            timestamp: '2024-01-01T10:00:00Z',
            sessionId: 'session-1',
            turnIndex: 0,
            characterCount: 60,
            wordCount: 10,
            hasCodeBlock: false,
            hasQuestion: false,
            isSessionStart: true,
            isContinuation: false,
          },
          {
            id: 'non-evidence-utterance',
            text: 'ok',
            timestamp: '2024-01-01T10:01:00Z',
            sessionId: 'session-1',
            turnIndex: 2,
            characterCount: 2,
            wordCount: 1,
            hasCodeBlock: false,
            hasQuestion: false,
            isSessionStart: false,
            isContinuation: false,
          },
          {
            id: 'evidence-utterance-2',
            text: 'Let me verify the token refresh handles all edge cases correctly',
            timestamp: '2024-01-01T10:05:00Z',
            sessionId: 'session-1',
            turnIndex: 4,
            characterCount: 65,
            wordCount: 11,
            hasCodeBlock: false,
            hasQuestion: false,
            isSessionStart: false,
            isContinuation: false,
          },
        ],
        aiResponses: [],
        sessionMetrics: createMockPhase1Output().sessionMetrics,
      };

      // Create agent outputs with evidence referencing specific utterances
      const agentOutputs: AgentOutputs = {
        trustVerification: {
          antiPatterns: [
            {
              type: 'blind_acceptance',
              frequency: 1,
              severity: 'moderate',
              examples: [
                { utteranceId: 'evidence-utterance-1', quote: 'OAuth implementation request' },
              ],
            },
          ],
          verificationBehavior: { level: 'high', description: 'Good', indicators: ['reviews'] },
          patternTypes: ['verification_first'],
          overallTrustHealthScore: 85,
          summary: 'Strong verification',
          confidenceScore: 0.9,
          strengths: [],
          growthAreas: [],
        },
        workflowHabit: {
          planningHabits: [],
          criticalThinkingMoments: [
            {
              type: 'verification',
              quote: 'verify token refresh',
              result: 'positive',
              utteranceId: 'evidence-utterance-2',
            },
          ],
          overallWorkflowScore: 80,
          confidenceScore: 0.85,
          strengths: [],
          growthAreas: [],
        },
        typeClassifier: {
          primaryType: 'architect',
          distribution: { architect: 50, scientist: 20, collaborator: 15, speedrunner: 10, craftsman: 5 },
          controlLevel: 'navigator',
          controlScore: 70,
          matrixName: 'Systems Architect',
          matrixEmoji: '🏗️',
          confidenceScore: 0.88,
        },
      };

      const mockResponse = createMockNarrativeResponse();
      mockGenerateStructured.mockResolvedValue({
        data: mockResponse,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await stage.transformV3(5, agentOutputs, phase1Output);

      // Verify that generateStructured was called
      expect(mockGenerateStructured).toHaveBeenCalled();

      // Get the userPrompt that was passed to generateStructured
      const call = mockGenerateStructured.mock.calls[0][0];
      const userPrompt = call.userPrompt as string;

      // The userPrompt should contain evidence-based utterances
      // It should include 'evidence-utterance-1' and 'evidence-utterance-2'
      expect(userPrompt).toContain('evidence-utterance-1');
      expect(userPrompt).toContain('evidence-utterance-2');

      // The short, non-evidence utterance 'ok' should NOT be included
      // (unless fallback is triggered, which shouldn't happen here)
      // Since we have evidence, the 'non-evidence-utterance' shouldn't appear
      // Note: We can't directly verify this without checking the utterances list format
    });

    it('should throw error when no Phase 2 evidence (No Fallback Policy)', async () => {
      const phase1Output = createMockPhase1Output();

      // Agent outputs without any evidence (no utteranceIds)
      const agentOutputs: AgentOutputs = {
        trustVerification: {
          antiPatterns: [],  // No evidence
          verificationBehavior: { level: 'high', description: 'Good', indicators: [] },
          patternTypes: [],
          overallTrustHealthScore: 85,
          summary: 'No anti-patterns detected',
          confidenceScore: 0.9,
          strengths: [],
          growthAreas: [],
        },
        workflowHabit: {
          planningHabits: [],
          criticalThinkingMoments: [],  // No evidence
          overallWorkflowScore: 80,
          confidenceScore: 0.85,
          strengths: [],
          growthAreas: [],
        },
        typeClassifier: {
          primaryType: 'architect',
          distribution: { architect: 50, scientist: 20, collaborator: 15, speedrunner: 10, craftsman: 5 },
          controlLevel: 'navigator',
          controlScore: 70,
          matrixName: 'Systems Architect',
          matrixEmoji: '🏗️',
          confidenceScore: 0.88,
        },
      };

      // Should throw error instead of silently falling back (No Fallback Policy)
      await expect(stage.transformV3(5, agentOutputs, phase1Output))
        .rejects.toThrow('Phase 2 evidence extraction produced no utteranceIds');
    });
  });
});
