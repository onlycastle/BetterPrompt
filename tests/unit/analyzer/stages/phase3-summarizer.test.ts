/**
 * Phase 3 Summarizer Tests
 *
 * Converts Phase 2 agent outputs into structured text for Phase 3 (Content Writer).
 */

import { describe, it, expect } from 'vitest';
import { summarizeAgentOutputsForPhase3 } from '../../../../src/lib/analyzer/stages/phase3-summarizer.js';
import type { AgentOutputs, TypeClassifierOutput, KnowledgeGapOutput, ContextEfficiencyOutput } from '../../../../src/lib/models/agent-outputs.js';
import type { ThinkingQualityOutput } from '../../../../src/lib/models/thinking-quality-data.js';
import type { LearningBehaviorOutput } from '../../../../src/lib/models/learning-behavior-data.js';

function makeTypeClassifier(overrides?: Partial<TypeClassifierOutput>): TypeClassifierOutput {
  return {
    primaryType: 'architect',
    controlLevel: 'navigator',
    controlScore: 72,
    matrixName: 'Systems Architect',
    matrixEmoji: '🏗️',
    distribution: { architect: 40, scientist: 25, collaborator: 20, speedrunner: 10, craftsman: 5 },
    confidenceScore: 0.85,
    reasoning: 'Developer shows systematic approach with structured planning.',
    collaborationMaturity: { level: 'ai_assisted_engineer', description: 'Consistently verifies AI output before accepting.', indicators: ['Asks follow-up questions', 'Runs tests after changes'] },
    ...overrides,
  };
}

function makeThinkingQuality(overrides?: Partial<ThinkingQualityOutput>): ThinkingQualityOutput {
  return {
    planningHabits: [{ type: 'task_decomposition', frequency: 'often', effectiveness: 'high', examples: ['first let me outline', 'break this into steps'] }],
    planQualityScore: 75,
    verificationBehavior: { level: 'systematic_verification', examples: ['reviewed code', 'ran tests'], recommendation: 'Continue this excellent practice' },
    criticalThinkingMoments: [{ type: 'verification_request', quote: 'are you sure that\'s correct?', result: 'caught bug in generated code', utteranceId: 'sess3_7' }],
    verificationAntiPatterns: [{ type: 'passive_acceptance', frequency: 8, severity: 'significant', examples: [{ utteranceId: 'sess1_4', quote: 'ok ship it', context: 'After AI generated code' }], improvement: 'Review AI output before accepting.' }],
    communicationPatterns: [{ patternName: 'Iterative Refinement', description: 'Refining prompts based on AI response', frequency: 'frequent', examples: [{ utteranceId: 'sess1_5', analysis: 'Good refinement' }], effectiveness: 'highly_effective' }],
    overallThinkingQualityScore: 72,
    confidenceScore: 0.8,
    ...overrides,
  };
}

function makeLearningBehavior(overrides?: Partial<LearningBehaviorOutput>): LearningBehaviorOutput {
  return {
    knowledgeGaps: [{ topic: 'TypeScript generics', questionCount: 7, depth: 'shallow', example: 'How do I use generic constraints?' }],
    learningProgress: [{ topic: 'React hooks', startLevel: 'novice', currentLevel: 'moderate', evidence: 'useEffect cleanup questions decreased' }],
    recommendedResources: [{ topic: 'TypeScript generics', resourceType: 'docs', url: 'https://typescriptlang.org/docs/handbook/2/generics.html' }],
    repeatedMistakePatterns: [{ category: 'syntax', mistakeType: 'syntax_error', occurrenceCount: 5, exampleUtteranceIds: ['sess1_5'], recommendation: 'Review TypeScript syntax documentation' }],
    topInsights: ['TypeScript generics questions appeared 7 times across 5 sessions'],
    overallLearningScore: 70,
    confidenceScore: 0.75,
    ...overrides,
  };
}

function makeKnowledgeGap(overrides?: Partial<KnowledgeGapOutput>): KnowledgeGapOutput {
  return {
    knowledgeGapsData: 'TypeScript generics:7:shallow:constraint syntax unclear',
    learningProgressData: 'React hooks:shallow:moderate:useEffect cleanup questions decreased',
    recommendedResourcesData: 'TypeScript generics:docs:typescriptlang.org',
    topInsights: ['TypeScript generics questions appeared 7 times across 5 sessions', 'React hooks understanding improved over time'],
    overallKnowledgeScore: 65,
    avgContextFillPercent: 84,
    confidenceScore: 0.8,
  } as KnowledgeGapOutput;
}

function makeContextEfficiency(overrides?: Partial<ContextEfficiencyOutput>): ContextEfficiencyOutput {
  return {
    contextUsagePatternData: 'session1:85:92;session2:78:88',
    inefficiencyPatternsData: 'late_compact:15:high:always compacts at 90%+',
    promptLengthTrendData: 'early:150;mid:280;late:450',
    redundantInfoData: 'project_structure:5;tech_stack:3',
    topInsights: ['Average 85% context fill before compact', 'Prompt length increases 2.3x in late session'],
    overallEfficiencyScore: 71,
    avgContextFillPercent: 84,
    confidenceScore: 0.77,
    productivitySummary: 'Moderate productivity with room for context optimization.',
    ...overrides,
  };
}

describe('summarizeAgentOutputsForPhase3', () => {
  it('should return empty string for empty agentOutputs', () => {
    const result = summarizeAgentOutputsForPhase3({});
    expect(result).toBe('');
  });

  it('should produce a single section when only TypeClassifier is present', () => {
    const outputs: AgentOutputs = {
      typeClassifier: makeTypeClassifier(),
    };

    const result = summarizeAgentOutputsForPhase3(outputs);

    expect(result).toContain('## TypeClassifier');
    expect(result).toContain('primaryType: architect');
    expect(result).toContain('controlLevel: navigator');
    expect(result).toContain('matrixName: Systems Architect');
    expect(result).toContain('distribution: architect=40');
    expect(result).toContain('collaborationMaturity: ai_assisted_engineer');
    // Should NOT contain other sections
    expect(result).not.toContain('## ThinkingQuality');
    expect(result).not.toContain('## LearningBehavior');
  });

  it('should produce all sections with correct headers for full agentOutputs', () => {
    const outputs: AgentOutputs = {
      typeClassifier: makeTypeClassifier(),
      thinkingQuality: makeThinkingQuality(),
      learningBehavior: makeLearningBehavior(),
      knowledgeGap: makeKnowledgeGap(),
      contextEfficiency: makeContextEfficiency(),
    };

    const result = summarizeAgentOutputsForPhase3(outputs);

    expect(result).toContain('## TypeClassifier');
    expect(result).toContain('## ThinkingQuality');
    expect(result).toContain('## LearningBehavior');
    expect(result).toContain('## KnowledgeGap');
    expect(result).toContain('## ContextEfficiency');
  });

  it('should format ThinkingQuality anti-patterns correctly', () => {
    const outputs: AgentOutputs = {
      thinkingQuality: makeThinkingQuality(),
    };

    const result = summarizeAgentOutputsForPhase3(outputs);

    expect(result).toContain('### Verification Anti-Patterns');
    expect(result).toContain('passive_acceptance');
    expect(result).toContain('severity: significant');
    expect(result).toContain('### Planning Habits');
    expect(result).toContain('task_decomposition');
    expect(result).toContain('### Critical Thinking Moments');
    expect(result).toContain('verification_request');
  });

  it('should format LearningBehavior patterns correctly', () => {
    const outputs: AgentOutputs = {
      learningBehavior: makeLearningBehavior(),
    };

    const result = summarizeAgentOutputsForPhase3(outputs);

    expect(result).toContain('### Repeated Mistake Patterns');
    expect(result).toContain('syntax_error');
    expect(result).toContain('### Knowledge Gaps');
    expect(result).toContain('TypeScript generics');
    expect(result).toContain('### Learning Progress');
    expect(result).toContain('React hooks');
  });

  it('should gracefully handle undefined/null optional fields', () => {
    const outputs: AgentOutputs = {
      typeClassifier: makeTypeClassifier({
        reasoning: undefined,
        collaborationMaturity: undefined,
        adjustmentReasons: undefined,
        synthesisEvidence: undefined,
      }),
      thinkingQuality: makeThinkingQuality({
        communicationPatterns: undefined,
      }),
    };

    const result = summarizeAgentOutputsForPhase3(outputs);

    // Should still produce valid sections
    expect(result).toContain('## TypeClassifier');
    expect(result).toContain('## ThinkingQuality');

    // Should NOT contain the optional sections
    expect(result).not.toContain('reasoning:');
    expect(result).not.toContain('collaborationMaturity:');
  });

  it('should produce output significantly smaller than JSON.stringify', () => {
    const outputs: AgentOutputs = {
      typeClassifier: makeTypeClassifier(),
      thinkingQuality: makeThinkingQuality(),
      learningBehavior: makeLearningBehavior(),
      knowledgeGap: makeKnowledgeGap(),
      contextEfficiency: makeContextEfficiency(),
    };

    const summary = summarizeAgentOutputsForPhase3(outputs);
    const jsonDump = JSON.stringify(outputs, null, 2);

    // Summary should be significantly smaller than raw JSON
    expect(summary.length).toBeLessThan(jsonDump.length);
    // For test fixtures the summary is compact, but let's check it's reasonable
    expect(summary.length).toBeGreaterThan(0);
    expect(summary.length).toBeLessThan(25000);
  });

  it('should format KnowledgeGap and ContextEfficiency insights', () => {
    const outputs: AgentOutputs = {
      knowledgeGap: makeKnowledgeGap(),
      contextEfficiency: makeContextEfficiency(),
    };

    const result = summarizeAgentOutputsForPhase3(outputs);

    expect(result).toContain('knowledgeScore: 65/100');
    expect(result).toContain('### Top Insights');
    expect(result).toContain('TypeScript generics questions appeared 7 times');
    expect(result).toContain('### KnowledgeGaps');
    expect(result).toContain('### LearningProgress');

    expect(result).toContain('efficiencyScore: 71/100');
    expect(result).toContain('avgFill: 84%');
    expect(result).toContain('### ProductivitySummary');
    expect(result).toContain('Moderate productivity');
  });
});
