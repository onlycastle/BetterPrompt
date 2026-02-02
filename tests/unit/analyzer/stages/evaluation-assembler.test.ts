/**
 * EvaluationAssembler Tests
 *
 * Deterministic assembly of Phase 2 data into VerboseEvaluation.
 */

import { describe, it, expect } from 'vitest';
import { assembleEvaluation } from '../../../../src/lib/analyzer/stages/evaluation-assembler.js';
import type { AgentOutputs, TypeClassifierOutput } from '../../../../src/lib/models/agent-outputs.js';
import type { Phase1Output } from '../../../../src/lib/models/phase1-output.js';
import type { NarrativeLLMResponse } from '../../../../src/lib/models/verbose-evaluation.js';

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
      createUtterance('session-1_0', 'Help me implement a new feature for user authentication'),
      createUtterance('session-1_2', 'Let me verify this works before we continue', { turnIndex: 2, timestamp: '2024-01-01T10:05:00Z' }),
    ],
    aiResponses: [{
      id: 'session-1_1',
      sessionId: 'session-1',
      turnIndex: 1,
      responseType: 'code_change',
      toolsUsed: ['Edit'],
      textSnippet: 'Here is the implementation...',
      fullTextLength: 300,
      hadError: false,
      wasSuccessful: true,
    }],
    sessionMetrics: {
      totalSessions: 1,
      totalMessages: 3,
      totalDeveloperUtterances: 2,
      totalAIResponses: 1,
      avgMessagesPerSession: 3,
      avgDeveloperMessageLength: 48,
      questionRatio: 0,
      codeBlockRatio: 0,
      dateRange: { earliest: '2024-01-01T10:00:00Z', latest: '2024-01-01T10:05:00Z' },
    },
  };
}

function createMockTypeClassifier(): TypeClassifierOutput {
  return {
    primaryType: 'architect',
    distribution: { architect: 45, scientist: 20, collaborator: 15, speedrunner: 10, craftsman: 10 },
    controlLevel: 'navigator',
    controlScore: 70,
    matrixName: 'Systems Architect',
    matrixEmoji: '🏗️',
    confidenceScore: 0.85,
  };
}

function createMockAgentOutputs(): AgentOutputs {
  return {
    thinkingQuality: {
      planningHabits: [
        { type: 'task_decomposition', frequency: 'often', effectiveness: 'high', examples: ['Break this down'] },
        { type: 'uses_plan_command', frequency: 'sometimes', effectiveness: 'medium', examples: ['/plan'] },
      ],
      planQualityScore: 75,
      verificationBehavior: { level: 'systematic_verification', examples: ['reviews_sometimes'], recommendation: 'Continue verification practices' },
      criticalThinkingMoments: [{ type: 'verification_request', quote: 'Let me verify this works', result: 'Caught issue early', utteranceId: 'session-1_2' }],
      verificationAntiPatterns: [{ type: 'blind_acceptance', frequency: 2, severity: 'moderate', examples: [{ utteranceId: 'session-1_0', quote: 'Help me implement', context: 'Initial request' }], improvement: 'Review AI suggestions before accepting' }],
      communicationPatterns: [],
      overallThinkingQualityScore: 75,
      confidenceScore: 0.8,
    },
    learningBehavior: { knowledgeGaps: [], learningProgress: [], recommendedResources: [], repeatedMistakePatterns: [], topInsights: [], overallLearningScore: 70, confidenceScore: 0.8 },
    typeClassifier: createMockTypeClassifier(),
  };
}

function createMockNarrativeResponse(): NarrativeLLMResponse {
  return {
    personalitySummary: 'You are a thoughtful developer who maintains oversight of AI-generated code.',
    promptPatterns: [
      { patternName: 'Verification First', description: 'You verify before proceeding', frequency: 'often', examplesData: 'session-1_2|Good verification habit', examples: [], effectiveness: 'very_effective', tip: 'Continue this pattern' },
      { patternName: 'Clear Requests', description: 'You provide detailed context', frequency: 'sometimes', examplesData: 'session-1_0|Clear feature request', examples: [], effectiveness: 'effective', tip: 'Add expected behavior' },
      { patternName: 'Iterative Refinement', description: 'You refine based on output', frequency: 'often', examplesData: '', examples: [], effectiveness: 'effective', tip: 'Good approach' },
    ],
    topFocusAreas: {
      areas: [{ rank: 1, dimension: 'aiCollaboration', title: 'Expand Testing', narrative: 'Build on verification habits', expectedImpact: 'Catch more issues', priorityScore: 85, actionsData: 'Add unit tests|Write integration tests' }],
      summary: 'Focus on systematizing verification',
    },
  };
}

function assembleWithDefaults() {
  return assembleEvaluation(createMockAgentOutputs(), createMockNarrativeResponse(), createMockPhase1Output(), 5);
}

describe('assembleEvaluation', () => {
  describe('narrative assembly', () => {
    it('should include personalitySummary from narrative', () => {
      const result = assembleWithDefaults();
      expect(result.personalitySummary).toContain('thoughtful developer');
    });

    it('should include promptPatterns from narrative', () => {
      const result = assembleWithDefaults();
      expect(Array.isArray(result.promptPatterns)).toBe(true);
      expect((result.promptPatterns as unknown[]).length).toBeGreaterThanOrEqual(3);
    });

    it('should resolve utteranceId to actual quote in promptPatterns', () => {
      const result = assembleWithDefaults();
      const patterns = result.promptPatterns as Array<{ patternName: string; examples: Array<{ quote: string }> }>;
      const verificationPattern = patterns.find(p => p.patternName === 'Verification First');

      expect(verificationPattern).toBeDefined();
      if (verificationPattern && verificationPattern.examples.length > 0) {
        expect(verificationPattern.examples[0].quote).toContain('verify');
      }
    });

    it('should include topFocusAreas from narrative', () => {
      const result = assembleWithDefaults();
      const focusAreas = result.topFocusAreas as { areas: unknown[]; summary: string };
      expect(focusAreas.areas).toBeDefined();
      expect(focusAreas.summary).toBeDefined();
    });
  });

  describe('type classification assembly', () => {
    it('should include primaryType from TypeClassifier', () => {
      expect(assembleWithDefaults().primaryType).toBe('architect');
    });

    it('should include controlLevel from TypeClassifier', () => {
      expect(assembleWithDefaults().controlLevel).toBe('navigator');
    });

    it('should include distribution from TypeClassifier', () => {
      const result = assembleWithDefaults();
      const distribution = result.distribution as { architect: number };
      expect(distribution.architect).toBe(45);
    });

    it('should include controlScore from TypeClassifier', () => {
      expect(assembleWithDefaults().controlScore).toBe(70);
    });
  });

  describe('anti-patterns assembly', () => {
    it('should assemble antiPatternsAnalysis from TrustVerification', () => {
      const result = assembleWithDefaults();
      const analysis = result.antiPatternsAnalysis as { detected: unknown[] };
      expect(analysis.detected.length).toBeGreaterThan(0);
    });

    it('should include overallHealthScore in antiPatternsAnalysis', () => {
      const result = assembleWithDefaults();
      const analysis = result.antiPatternsAnalysis as { overallHealthScore: number };
      expect(analysis.overallHealthScore).toBe(75);
    });

    it('should map anti-pattern type to displayName', () => {
      const result = assembleWithDefaults();
      const analysis = result.antiPatternsAnalysis as { detected: Array<{ displayName: string }> };
      expect(analysis.detected[0].displayName).toBe('Blind Acceptance');
    });
  });

  describe('critical thinking assembly', () => {
    it('should assemble criticalThinkingAnalysis from WorkflowHabit', () => {
      const result = assembleWithDefaults();
      const analysis = result.criticalThinkingAnalysis as { strengths: unknown[] };
      expect(analysis.strengths).toBeDefined();
    });

    it('should include overallScore in criticalThinkingAnalysis', () => {
      const result = assembleWithDefaults();
      const analysis = result.criticalThinkingAnalysis as { overallScore: number };
      expect(analysis.overallScore).toBeGreaterThan(0);
    });
  });

  describe('planning assembly', () => {
    it('should assemble planningAnalysis from WorkflowHabit', () => {
      const result = assembleWithDefaults();
      const analysis = result.planningAnalysis as { strengths: unknown[]; planningMaturityLevel: string };
      expect(analysis.strengths).toBeDefined();
      expect(analysis.planningMaturityLevel).toBeDefined();
    });

    it('should determine correct maturity level', () => {
      const result = assembleWithDefaults();
      const analysis = result.planningAnalysis as { planningMaturityLevel: string };
      expect(['emerging', 'structured', 'expert']).toContain(analysis.planningMaturityLevel);
    });
  });

  describe('worker insights assembly', () => {
    it('should include workerInsights', () => {
      expect(assembleWithDefaults().workerInsights).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle missing typeClassifier', () => {
      const result = assembleEvaluation(
        { ...createMockAgentOutputs(), typeClassifier: undefined },
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );
      expect(result.primaryType).toBeUndefined();
      expect(result.controlLevel).toBeUndefined();
    });

    it('should handle missing thinkingQuality', () => {
      const result = assembleEvaluation(
        { ...createMockAgentOutputs(), thinkingQuality: undefined },
        createMockNarrativeResponse(),
        createMockPhase1Output(),
        5
      );
      expect(result.antiPatternsAnalysis).toBeUndefined();
      expect(result.criticalThinkingAnalysis).toBeUndefined();
      expect(result.planningAnalysis).toBeUndefined();
    });

    it('should handle missing phase1Output', () => {
      const result = assembleEvaluation(createMockAgentOutputs(), createMockNarrativeResponse(), undefined, 5);
      expect(result.personalitySummary).toBeDefined();
      expect(result.promptPatterns).toBeDefined();
    });

    it('should ensure minimum 3 promptPatterns', () => {
      const narrativeWithOnePattern: NarrativeLLMResponse = {
        ...createMockNarrativeResponse(),
        promptPatterns: [{ patternName: 'Single Pattern', description: 'Only one', frequency: 'often', examples: [], effectiveness: 'effective', tip: 'Keep it up' }],
      };

      const result = assembleEvaluation(createMockAgentOutputs(), narrativeWithOnePattern, createMockPhase1Output(), 5);
      expect((result.promptPatterns as unknown[]).length).toBeGreaterThanOrEqual(3);
    });
  });
});
