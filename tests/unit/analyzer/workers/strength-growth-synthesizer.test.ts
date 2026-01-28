/**
 * StrengthGrowth Synthesizer Helper Tests
 *
 * Tests for the helper functions used by the Synthesizer:
 * - buildWorkerSummaries: Serializes Phase 2 worker outputs
 * - preparePhase1Reference: Truncates utterances for token efficiency
 */

import { describe, it, expect } from 'vitest';
import { buildWorkerSummaries, preparePhase1Reference } from '../../../../src/lib/analyzer/workers/strength-growth-worker.js';
import type { AgentOutputs } from '../../../../src/lib/models/agent-outputs.js';
import type { Phase1Output } from '../../../../src/lib/models/phase1-output.js';

describe('buildWorkerSummaries', () => {
  it('should return empty message when no worker outputs', () => {
    const result = buildWorkerSummaries({});
    expect(result).toBe('(No Phase 2 worker outputs available)');
  });

  it('should serialize TrustVerification output', () => {
    const agentOutputs: AgentOutputs = {
      trustVerification: {
        antiPatterns: [
          {
            type: 'blind_retry',
            description: 'Retries without understanding error',
            severity: 'high',
            sessionPercentage: 40,
            improvement: 'Read error messages first',
            evidence: [],
          },
        ],
        verificationBehavior: {
          level: 'low',
          description: 'Rarely verifies',
          evidence: [],
        },
        overallTrustHealthScore: 45,
        confidenceScore: 0.85,
        summary: 'Trust issues detected',
        detectedPatternTypes: ['blind_retry'],
      },
    };

    const result = buildWorkerSummaries(agentOutputs);
    expect(result).toContain('### TrustVerification');
    expect(result).toContain('Trust health score: 45/100');
    expect(result).toContain('blind_retry');
    expect(result).toContain('severity=high');
    expect(result).toContain('sessions=40%');
    expect(result).toContain('Confidence: 0.85');
  });

  it('should serialize WorkflowHabit output', () => {
    const agentOutputs: AgentOutputs = {
      workflowHabit: {
        planningHabits: [
          {
            type: 'task_decomposition',
            frequency: 'frequent',
            description: 'Decomposes tasks',
            evidence: [],
            effectiveness: 'high',
          },
        ],
        criticalThinkingMoments: [
          {
            type: 'output_validation',
            quote: 'Wait, that does not look right',
            context: 'Reviewing generated code',
            evidence: [],
          },
        ],
        multitaskingPatterns: [],
        overallWorkflowScore: 72,
        confidenceScore: 0.9,
        summary: 'Good workflow habits',
      },
    };

    const result = buildWorkerSummaries(agentOutputs);
    expect(result).toContain('### WorkflowHabit');
    expect(result).toContain('Workflow score: 72/100');
    expect(result).toContain('task_decomposition');
    expect(result).toContain('frequency=frequent');
    expect(result).toContain('output_validation');
    expect(result).toContain('Confidence: 0.9');
  });

  it('should serialize KnowledgeGap output with strengthsData', () => {
    const agentOutputs: AgentOutputs = {
      knowledgeGap: {
        overallKnowledgeScore: 60,
        confidenceScore: 0.8,
        knowledgeGapsData: 'react-hooks:5:deep:useEffect example;typescript:3:medium:generics',
        learningProgressData: 'react:beginner:intermediate:improved patterns',
        strengthsData: 'Strong TypeScript knowledge',
        growthAreasData: 'Needs React hooks practice',
        topInsights: ['Active learner'],
      },
    };

    const result = buildWorkerSummaries(agentOutputs);
    expect(result).toContain('### KnowledgeGap');
    expect(result).toContain('Knowledge score: 60/100');
    expect(result).toContain('react-hooks');
    expect(result).toContain('Worker-reported strengths: Strong TypeScript knowledge');
    expect(result).toContain('Worker-reported growth areas: Needs React hooks practice');
  });

  it('should serialize ContextEfficiency output', () => {
    const agentOutputs: AgentOutputs = {
      contextEfficiency: {
        overallEfficiencyScore: 75,
        avgContextFillPercent: 45,
        confidenceScore: 0.82,
        inefficiencyPatternsData: 'context_bloat:30:medium;redundant_info:15:low',
        overallProductivityScore: 80,
      },
    };

    const result = buildWorkerSummaries(agentOutputs);
    expect(result).toContain('### ContextEfficiency');
    expect(result).toContain('Efficiency score: 75/100');
    expect(result).toContain('Average context fill: 45%');
    expect(result).toContain('context_bloat');
    expect(result).toContain('Productivity score: 80');
  });

  it('should combine multiple worker summaries', () => {
    const agentOutputs: AgentOutputs = {
      trustVerification: {
        antiPatterns: [],
        verificationBehavior: { level: 'high', description: 'Good', evidence: [] },
        overallTrustHealthScore: 80,
        confidenceScore: 0.9,
        detectedPatternTypes: [],
      },
      workflowHabit: {
        planningHabits: [],
        criticalThinkingMoments: [],
        multitaskingPatterns: [],
        overallWorkflowScore: 70,
        confidenceScore: 0.85,
      },
    };

    const result = buildWorkerSummaries(agentOutputs);
    expect(result).toContain('### TrustVerification');
    expect(result).toContain('### WorkflowHabit');
  });
});

describe('preparePhase1Reference', () => {
  it('should truncate utterance text to 500 chars', () => {
    const longText = 'x'.repeat(1000);
    const phase1: Phase1Output = {
      developerUtterances: [
        {
          id: 'session1_0',
          text: longText,
          sessionId: 'session1',
          turnIndex: 0,
          characterCount: 1000,
          wordCount: 100,
          hasCodeBlock: false,
          hasQuestion: false,
          isSessionStart: true,
          precedingAIHadError: false,
          timestamp: '2024-01-01T10:00:00Z',
        },
      ],
      aiResponses: [],
      sessionMetrics: {
        totalSessions: 1,
        totalMessages: 2,
        totalDeveloperUtterances: 1,
        totalAIResponses: 1,
        avgMessagesPerSession: 2,
        avgDeveloperMessageLength: 1000,
        questionRatio: 0,
        codeBlockRatio: 0,
        dateRange: {
          earliest: '2024-01-01T10:00:00Z',
          latest: '2024-01-01T10:00:00Z',
        },
      },
    };

    const result = preparePhase1Reference(phase1);
    const utterances = (result as any).developerUtterances;

    expect(utterances).toHaveLength(1);
    expect(utterances[0].text).toHaveLength(500);
    expect(utterances[0].id).toBe('session1_0');
    expect(utterances[0].sessionId).toBe('session1');
  });

  it('should preserve short utterance text unchanged', () => {
    const shortText = 'Hello, fix this bug';
    const phase1: Phase1Output = {
      developerUtterances: [
        {
          id: 'session1_0',
          text: shortText,
          sessionId: 'session1',
          turnIndex: 0,
          characterCount: shortText.length,
          wordCount: 4,
          hasCodeBlock: false,
          hasQuestion: false,
          isSessionStart: true,
          precedingAIHadError: false,
          timestamp: '2024-01-01T10:00:00Z',
        },
      ],
      aiResponses: [],
      sessionMetrics: {
        totalSessions: 1,
        totalMessages: 2,
        totalDeveloperUtterances: 1,
        totalAIResponses: 1,
        avgMessagesPerSession: 2,
        avgDeveloperMessageLength: shortText.length,
        questionRatio: 0,
        codeBlockRatio: 0,
        dateRange: {
          earliest: '2024-01-01T10:00:00Z',
          latest: '2024-01-01T10:00:00Z',
        },
      },
    };

    const result = preparePhase1Reference(phase1);
    const utterances = (result as any).developerUtterances;

    expect(utterances[0].text).toBe(shortText);
  });

  it('should include sessionMetrics', () => {
    const phase1: Phase1Output = {
      developerUtterances: [],
      aiResponses: [],
      sessionMetrics: {
        totalSessions: 5,
        totalMessages: 50,
        totalDeveloperUtterances: 25,
        totalAIResponses: 25,
        avgMessagesPerSession: 10,
        avgDeveloperMessageLength: 100,
        questionRatio: 0.3,
        codeBlockRatio: 0.2,
        dateRange: {
          earliest: '2024-01-01T10:00:00Z',
          latest: '2024-01-15T10:00:00Z',
        },
      },
    };

    const result = preparePhase1Reference(phase1);
    expect((result as any).sessionMetrics.totalSessions).toBe(5);
    expect((result as any).sessionMetrics.totalMessages).toBe(50);
  });

  it('should preserve structural metadata fields', () => {
    const phase1: Phase1Output = {
      developerUtterances: [
        {
          id: 'abc123_5',
          text: 'Can you help me debug this?',
          sessionId: 'abc123',
          turnIndex: 5,
          characterCount: 27,
          wordCount: 6,
          hasCodeBlock: false,
          hasQuestion: true,
          isSessionStart: false,
          precedingAIHadError: true,
          timestamp: '2024-01-01T10:30:00Z',
        },
      ],
      aiResponses: [],
      sessionMetrics: {
        totalSessions: 1,
        totalMessages: 2,
        totalDeveloperUtterances: 1,
        totalAIResponses: 1,
        avgMessagesPerSession: 2,
        avgDeveloperMessageLength: 27,
        questionRatio: 1.0,
        codeBlockRatio: 0,
        dateRange: {
          earliest: '2024-01-01T10:00:00Z',
          latest: '2024-01-01T10:30:00Z',
        },
      },
    };

    const result = preparePhase1Reference(phase1);
    const u = (result as any).developerUtterances[0];

    expect(u.hasCodeBlock).toBe(false);
    expect(u.hasQuestion).toBe(true);
    expect(u.isSessionStart).toBe(false);
    expect(u.precedingAIHadError).toBe(true);
    expect(u.timestamp).toBe('2024-01-01T10:30:00Z');
  });
});
