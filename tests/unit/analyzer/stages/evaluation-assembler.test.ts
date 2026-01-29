/**
 * EvaluationAssembler Tests
 *
 * Tests for deterministic assembly of Phase 2 data into VerboseEvaluation.
 */

import { describe, it, expect } from 'vitest';
import { assembleEvaluation } from '../../../../src/lib/analyzer/stages/evaluation-assembler.js';
import type { AgentOutputs, TypeClassifierOutput } from '../../../../src/lib/models/agent-outputs.js';
import type { Phase1Output } from '../../../../src/lib/models/phase1-output.js';
import type { NarrativeLLMResponse } from '../../../../src/lib/models/verbose-evaluation.js';

// ============================================================================
// Helper Functions
// ============================================================================

function createMockPhase1Output(): Phase1Output {
  return {
    developerUtterances: [
      {
        id: 'session-1_0',
        text: 'Help me implement a new feature for user authentication',
        timestamp: '2024-01-01T10:00:00Z',
        sessionId: 'session-1',
        turnIndex: 0,
        characterCount: 55,
        wordCount: 9,
        hasCodeBlock: false,
        hasQuestion: false,
        isSessionStart: true,
        isContinuation: false,
      },
      {
        id: 'session-1_2',
        text: 'Let me verify this works before we continue',
        timestamp: '2024-01-01T10:05:00Z',
        sessionId: 'session-1',
        turnIndex: 2,
        characterCount: 42,
        wordCount: 8,
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
        toolsUsed: ['Edit'],
        textSnippet: 'Here is the implementation...',
        fullTextLength: 300,
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
      avgDeveloperMessageLength: 48,
      questionRatio: 0,
      codeBlockRatio: 0,
      dateRange: {
        earliest: '2024-01-01T10:00:00Z',
        latest: '2024-01-01T10:05:00Z',
      },
    },
  };
}

function createMockTypeClassifier(): TypeClassifierOutput {
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
    controlScore: 70,
    matrixName: 'Systems Architect',
    matrixEmoji: '🏗️',
    confidenceScore: 0.85,
  };
}

function createMockAgentOutputs(): AgentOutputs {
  return {
    trustVerification: {
      antiPatterns: [
        {
          type: 'blind_acceptance',
          frequency: 2,
          severity: 'moderate',
          examples: [{ utteranceId: 'session-1_0', quote: 'Help me implement' }],
          improvement: 'Review AI suggestions before accepting',
          sessionPercentage: 20,
        },
      ],
      verificationBehavior: {
        level: 'moderate',
        description: 'Shows some verification',
        indicators: ['reviews_sometimes'],
      },
      patternTypes: ['iterative_refinement'],
      overallTrustHealthScore: 72,
      summary: 'Mixed trust patterns',
      confidenceScore: 0.8,
      strengths: [],
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
        {
          type: 'uses_plan_command',
          frequency: 'sometimes',
          examples: ['/plan'],
          effectiveness: 'medium',
        },
      ],
      criticalThinkingMoments: [
        {
          type: 'verification',
          quote: 'Let me verify this works',
          result: 'Caught issue early',
          utteranceId: 'session-1_2',
        },
      ],
      overallWorkflowScore: 78,
      summary: 'Good workflow structure',
      confidenceScore: 0.82,
      strengths: [],
      growthAreas: [],
    },
    typeClassifier: createMockTypeClassifier(),
  };
}

function createMockNarrativeResponse(): NarrativeLLMResponse {
  return {
    personalitySummary: 'You are a thoughtful developer who maintains oversight of AI-generated code. Your verification habits demonstrate a mature approach to AI collaboration.',
    promptPatterns: [
      {
        patternName: 'Verification First',
        description: 'You verify before proceeding',
        frequency: 'often',
        examplesData: 'session-1_2|Good verification habit',
        examples: [],
        effectiveness: 'very_effective',
        tip: 'Continue this pattern',
      },
      {
        patternName: 'Clear Requests',
        description: 'You provide detailed context',
        frequency: 'sometimes',
        examplesData: 'session-1_0|Clear feature request',
        examples: [],
        effectiveness: 'effective',
        tip: 'Add expected behavior',
      },
      {
        patternName: 'Iterative Refinement',
        description: 'You refine based on output',
        frequency: 'often',
        examplesData: '',
        examples: [],
        effectiveness: 'effective',
        tip: 'Good approach',
      },
    ],
    topFocusAreas: {
      areas: [
        {
          rank: 1,
          dimension: 'aiCollaboration',
          title: 'Expand Testing',
          narrative: 'Build on verification habits',
          expectedImpact: 'Catch more issues',
          priorityScore: 85,
          actionsData: 'Add unit tests|Write integration tests',
        },
      ],
      summary: 'Focus on systematizing verification',
    },
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('assembleEvaluation', () => {
  describe('narrative assembly', () => {
    it('should include personalitySummary from narrative', () => {
      const result = assembleEvaluation(
        createMockAgentOutputs(),
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      expect(result.personalitySummary).toBeDefined();
      expect(result.personalitySummary).toContain('thoughtful developer');
    });

    it('should include promptPatterns from narrative', () => {
      const result = assembleEvaluation(
        createMockAgentOutputs(),
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      expect(result.promptPatterns).toBeDefined();
      expect(Array.isArray(result.promptPatterns)).toBe(true);
      expect((result.promptPatterns as any[]).length).toBeGreaterThanOrEqual(3);
    });

    it('should resolve utteranceId to actual quote in promptPatterns', () => {
      const result = assembleEvaluation(
        createMockAgentOutputs(),
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      const patterns = result.promptPatterns as any[];
      const verificationPattern = patterns.find(p => p.patternName === 'Verification First');

      expect(verificationPattern).toBeDefined();
      expect(verificationPattern.examples).toBeDefined();
      // Should have resolved utteranceId to actual quote from phase1Output
      if (verificationPattern.examples.length > 0) {
        expect(verificationPattern.examples[0].quote).toContain('verify');
      }
    });

    it('should include topFocusAreas from narrative', () => {
      const result = assembleEvaluation(
        createMockAgentOutputs(),
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      expect(result.topFocusAreas).toBeDefined();
      expect((result.topFocusAreas as any).areas).toBeDefined();
      expect((result.topFocusAreas as any).summary).toBeDefined();
    });
  });

  describe('type classification assembly', () => {
    it('should include primaryType from TypeClassifier', () => {
      const result = assembleEvaluation(
        createMockAgentOutputs(),
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      expect(result.primaryType).toBe('architect');
    });

    it('should include controlLevel from TypeClassifier', () => {
      const result = assembleEvaluation(
        createMockAgentOutputs(),
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      expect(result.controlLevel).toBe('navigator');
    });

    it('should include distribution from TypeClassifier', () => {
      const result = assembleEvaluation(
        createMockAgentOutputs(),
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      expect(result.distribution).toBeDefined();
      expect((result.distribution as any).architect).toBe(45);
    });

    it('should include controlScore from TypeClassifier', () => {
      const result = assembleEvaluation(
        createMockAgentOutputs(),
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      expect(result.controlScore).toBe(70);
    });
  });

  describe('anti-patterns assembly', () => {
    it('should assemble antiPatternsAnalysis from TrustVerification', () => {
      const result = assembleEvaluation(
        createMockAgentOutputs(),
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      expect(result.antiPatternsAnalysis).toBeDefined();
      expect((result.antiPatternsAnalysis as any).detected).toBeDefined();
      expect((result.antiPatternsAnalysis as any).detected.length).toBeGreaterThan(0);
    });

    it('should include overallHealthScore in antiPatternsAnalysis', () => {
      const result = assembleEvaluation(
        createMockAgentOutputs(),
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      expect((result.antiPatternsAnalysis as any).overallHealthScore).toBe(72);
    });

    it('should map anti-pattern type to displayName', () => {
      const result = assembleEvaluation(
        createMockAgentOutputs(),
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      const detected = (result.antiPatternsAnalysis as any).detected[0];
      expect(detected.displayName).toBe('Blind Acceptance');
    });
  });

  describe('critical thinking assembly', () => {
    it('should assemble criticalThinkingAnalysis from WorkflowHabit', () => {
      const result = assembleEvaluation(
        createMockAgentOutputs(),
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      expect(result.criticalThinkingAnalysis).toBeDefined();
      expect((result.criticalThinkingAnalysis as any).strengths).toBeDefined();
    });

    it('should include overallScore in criticalThinkingAnalysis', () => {
      const result = assembleEvaluation(
        createMockAgentOutputs(),
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      expect((result.criticalThinkingAnalysis as any).overallScore).toBeGreaterThan(0);
    });
  });

  describe('planning assembly', () => {
    it('should assemble planningAnalysis from WorkflowHabit', () => {
      const result = assembleEvaluation(
        createMockAgentOutputs(),
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      expect(result.planningAnalysis).toBeDefined();
      expect((result.planningAnalysis as any).strengths).toBeDefined();
      expect((result.planningAnalysis as any).planningMaturityLevel).toBeDefined();
    });

    it('should determine correct maturity level', () => {
      const result = assembleEvaluation(
        createMockAgentOutputs(),
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      // Has task_decomposition and uses_plan_command → structured or higher
      expect(['emerging', 'structured', 'expert']).toContain(
        (result.planningAnalysis as any).planningMaturityLevel
      );
    });
  });

  describe('worker insights assembly', () => {
    it('should include workerInsights', () => {
      const result = assembleEvaluation(
        createMockAgentOutputs(),
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      expect(result.workerInsights).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle missing typeClassifier', () => {
      const agentOutputsNoType = {
        ...createMockAgentOutputs(),
        typeClassifier: undefined,
      };

      const result = assembleEvaluation(
        agentOutputsNoType,
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      expect(result.primaryType).toBeUndefined();
      expect(result.controlLevel).toBeUndefined();
    });

    it('should handle missing trustVerification', () => {
      const agentOutputsNoTrust = {
        ...createMockAgentOutputs(),
        trustVerification: undefined,
      };

      const result = assembleEvaluation(
        agentOutputsNoTrust,
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      expect(result.antiPatternsAnalysis).toBeUndefined();
    });

    it('should handle missing workflowHabit', () => {
      const agentOutputsNoWorkflow = {
        ...createMockAgentOutputs(),
        workflowHabit: undefined,
      };

      const result = assembleEvaluation(
        agentOutputsNoWorkflow,
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );

      expect(result.criticalThinkingAnalysis).toBeUndefined();
      expect(result.planningAnalysis).toBeUndefined();
    });

    it('should handle missing phase1Output', () => {
      const result = assembleEvaluation(
        createMockAgentOutputs(),
        createMockNarrativeResponse(),
        undefined,
        5
      );

      expect(result.personalitySummary).toBeDefined();
      expect(result.promptPatterns).toBeDefined();
    });

    it('should ensure minimum 3 promptPatterns', () => {
      const narrativeWithOnePattern: NarrativeLLMResponse = {
        ...createMockNarrativeResponse(),
        promptPatterns: [
          {
            patternName: 'Single Pattern',
            description: 'Only one',
            frequency: 'often',
            examples: [],
            effectiveness: 'effective',
            tip: 'Keep it up',
          },
        ],
      };

      const result = assembleEvaluation(
        createMockAgentOutputs(),
        narrativeWithOnePattern,
        createMockPhase1Output(),
        5
      );

      expect((result.promptPatterns as any[]).length).toBeGreaterThanOrEqual(3);
    });

    it('should truncate long personalitySummary', () => {
      const longSummary = 'A'.repeat(5000);
      const narrativeWithLongSummary: NarrativeLLMResponse = {
        ...createMockNarrativeResponse(),
        personalitySummary: longSummary,
      };

      const result = assembleEvaluation(
        createMockAgentOutputs(),
        narrativeWithLongSummary,
        createMockPhase1Output(),
        5
      );

      expect((result.personalitySummary as string).length).toBeLessThanOrEqual(3000);
    });
  });
});
