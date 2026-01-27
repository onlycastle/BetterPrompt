/**
 * Phase 3 Summarizer Tests
 *
 * Tests for summarizeAgentOutputsForPhase3, which converts Phase 2 agent
 * outputs into structured text for Phase 3 (Content Writer).
 */

import { describe, it, expect } from 'vitest';
import { summarizeAgentOutputsForPhase3 } from '../../../../src/lib/analyzer/stages/phase3-summarizer.js';
import type { AgentOutputs } from '../../../../src/lib/models/agent-outputs.js';
import type { StrengthGrowthOutput } from '../../../../src/lib/models/strength-growth-data.js';
import type { TrustVerificationOutput } from '../../../../src/lib/models/trust-verification-data.js';
import type { WorkflowHabitOutput } from '../../../../src/lib/models/workflow-habit-data.js';
import type { TypeClassifierOutput, KnowledgeGapOutput, ContextEfficiencyOutput } from '../../../../src/lib/models/agent-outputs.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

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
    collaborationMaturity: {
      level: 'ai_assisted_engineer',
      description: 'Consistently verifies AI output before accepting.',
      indicators: ['Asks follow-up questions', 'Runs tests after changes'],
    },
    ...overrides,
  };
}

function makeStrengthGrowth(overrides?: Partial<StrengthGrowthOutput>): StrengthGrowthOutput {
  return {
    strengths: [
      {
        title: 'Systematic Problem Decomposition',
        description: 'Developer consistently breaks down complex tasks into manageable parts.',
        evidence: [
          { utteranceId: 'sess1_5', quote: 'let me plan this out first', context: 'Starting a new feature' },
          { utteranceId: 'sess1_12', quote: 'start with the data model', context: 'Planning architecture' },
        ],
        dimension: 'aiCollaboration',
        developmentTip: 'Try using /plan command for larger tasks',
      },
    ],
    growthAreas: [
      {
        title: 'Tool Exploration',
        description: 'Limited tool variety — developer relies primarily on Bash and Edit.',
        evidence: [
          { utteranceId: 'sess2_3', quote: 'just use grep', context: 'Searching codebase' },
        ],
        recommendation: 'Explore Task and Glob tools for faster codebase search',
        dimension: 'toolMastery',
        frequency: 45,
        severity: 'medium',
        priorityScore: 62,
      },
    ],
    confidenceScore: 0.85,
    personalizedPrioritiesData: 'toolMastery|Tool Exploration|Broaden tool usage|high|85',
    absenceBasedSignalsData: 'no_testing|Developer never asks to run tests|Add test verification step',
    ...overrides,
  };
}

function makeTrustVerification(overrides?: Partial<TrustVerificationOutput>): TrustVerificationOutput {
  return {
    antiPatterns: [
      {
        type: 'passive_acceptance',
        frequency: 8,
        severity: 'high',
        sessionPercentage: 45,
        improvement: 'Review AI output before accepting.',
        examples: [
          { utteranceId: 'sess1_4', quote: 'ok ship it', context: 'After AI generated code' },
        ],
      },
    ],
    verificationBehavior: {
      level: 'occasional_review',
      recommendation: 'Increase verification frequency for generated code.',
      examples: ['sometimes checks output', 'rarely runs tests'],
    },
    overallTrustHealthScore: 72,
    confidenceScore: 0.8,
    summary: 'Developer shows moderate trust patterns.',
    detectedPatternsData: 'passive_acceptance|often|high',
    actionablePatternMatchesData: 'pa_001|0.85|Review before accepting',
    ...overrides,
  };
}

function makeWorkflowHabit(overrides?: Partial<WorkflowHabitOutput>): WorkflowHabitOutput {
  return {
    planningHabits: [
      {
        type: 'task_decomposition',
        frequency: 'often',
        effectiveness: 'high',
        examples: ['first let me outline', 'break this into steps'],
      },
    ],
    criticalThinkingMoments: [
      {
        type: 'verification_request',
        quote: 'are you sure that\'s correct?',
        result: 'caught bug in generated code',
        utteranceId: 'sess3_7',
      },
    ],
    multitaskingPattern: {
      mixesTopicsInSessions: false,
      contextPollutionInstances: [],
      focusScore: 72,
    },
    overallWorkflowScore: 68,
    confidenceScore: 0.75,
    summary: 'Well-structured workflow with room for improvement.',
    ...overrides,
  };
}

function makeKnowledgeGap(overrides?: Partial<KnowledgeGapOutput>): KnowledgeGapOutput {
  return {
    knowledgeGapsData: 'TypeScript generics:7:shallow:constraint syntax unclear',
    learningProgressData: 'React hooks:shallow:moderate:useEffect cleanup questions decreased',
    recommendedResourcesData: 'TypeScript generics:docs:typescriptlang.org',
    topInsights: [
      'TypeScript generics questions appeared 7 times across 5 sessions',
      'React hooks understanding improved over time',
    ],
    overallKnowledgeScore: 65,
    avgContextFillPercent: 84, // extra field from schema but not used
    confidenceScore: 0.8,
  } as KnowledgeGapOutput;
}

function makeContextEfficiency(overrides?: Partial<ContextEfficiencyOutput>): ContextEfficiencyOutput {
  return {
    contextUsagePatternData: 'session1:85:92;session2:78:88',
    inefficiencyPatternsData: 'late_compact:15:high:always compacts at 90%+',
    promptLengthTrendData: 'early:150;mid:280;late:450',
    redundantInfoData: 'project_structure:5;tech_stack:3',
    topInsights: [
      'Average 85% context fill before compact',
      'Prompt length increases 2.3x in late session',
    ],
    overallEfficiencyScore: 71,
    avgContextFillPercent: 84,
    confidenceScore: 0.77,
    productivitySummary: 'Moderate productivity with room for context optimization.',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

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
    expect(result).not.toContain('## StrengthGrowth');
    expect(result).not.toContain('## TrustVerification');
  });

  it('should produce all 6 sections with correct headers for full agentOutputs', () => {
    const outputs: AgentOutputs = {
      typeClassifier: makeTypeClassifier(),
      strengthGrowth: makeStrengthGrowth(),
      trustVerification: makeTrustVerification(),
      workflowHabit: makeWorkflowHabit(),
      knowledgeGap: makeKnowledgeGap(),
      contextEfficiency: makeContextEfficiency(),
    };

    const result = summarizeAgentOutputsForPhase3(outputs);

    expect(result).toContain('## TypeClassifier');
    expect(result).toContain('## StrengthGrowth');
    expect(result).toContain('## TrustVerification');
    expect(result).toContain('## WorkflowHabit');
    expect(result).toContain('## KnowledgeGap');
    expect(result).toContain('## ContextEfficiency');
  });

  it('should format StrengthGrowth evidence items correctly', () => {
    const outputs: AgentOutputs = {
      strengthGrowth: makeStrengthGrowth(),
    };

    const result = summarizeAgentOutputsForPhase3(outputs);

    expect(result).toContain('### Strengths (1)');
    expect(result).toContain('[aiCollaboration] Systematic Problem Decomposition');
    expect(result).toContain('sess1_5: "let me plan this out first"');
    expect(result).toContain('Tip: Try using /plan command');

    expect(result).toContain('### Growth Areas (1)');
    expect(result).toContain('[toolMastery] Tool Exploration');
    expect(result).toContain('freq: 45%');
    expect(result).toContain('severity: medium');
    expect(result).toContain('priority: 62');
    expect(result).toContain('Recommendation: Explore Task and Glob');
  });

  it('should format TrustVerification anti-patterns correctly', () => {
    const outputs: AgentOutputs = {
      trustVerification: makeTrustVerification(),
    };

    const result = summarizeAgentOutputsForPhase3(outputs);

    expect(result).toContain('trustHealth: 72/100');
    expect(result).toContain('### Anti-Patterns (1)');
    expect(result).toContain('[passive_acceptance]');
    expect(result).toContain('freq: 8');
    expect(result).toContain('severity: high');
    expect(result).toContain('sessionPct: 45%');
    expect(result).toContain('sess1_4: "ok ship it"');
    expect(result).toContain('### Verification Behavior');
    expect(result).toContain('level: occasional_review');
  });

  it('should pass through data strings as-is', () => {
    const outputs: AgentOutputs = {
      strengthGrowth: makeStrengthGrowth(),
      trustVerification: makeTrustVerification(),
    };

    const result = summarizeAgentOutputsForPhase3(outputs);

    // StrengthGrowth pass-through
    expect(result).toContain('### PersonalizedPriorities');
    expect(result).toContain('toolMastery|Tool Exploration|Broaden tool usage|high|85');
    expect(result).toContain('### AbsenceBasedSignals');
    expect(result).toContain('no_testing|Developer never asks to run tests|Add test verification step');

    // TrustVerification pass-through
    expect(result).toContain('### DetectedPatterns');
    expect(result).toContain('passive_acceptance|often|high');
    expect(result).toContain('### ActionablePatternMatches');
    expect(result).toContain('pa_001|0.85|Review before accepting');
  });

  it('should gracefully handle undefined/null optional fields', () => {
    const outputs: AgentOutputs = {
      typeClassifier: makeTypeClassifier({
        reasoning: undefined,
        collaborationMaturity: undefined,
        adjustmentReasons: undefined,
        synthesisEvidence: undefined,
      }),
      strengthGrowth: makeStrengthGrowth({
        personalizedPrioritiesData: undefined,
        absenceBasedSignalsData: undefined,
      }),
    };

    const result = summarizeAgentOutputsForPhase3(outputs);

    // Should still produce valid sections
    expect(result).toContain('## TypeClassifier');
    expect(result).toContain('## StrengthGrowth');

    // Should NOT contain the optional sections
    expect(result).not.toContain('reasoning:');
    expect(result).not.toContain('collaborationMaturity:');
    expect(result).not.toContain('### PersonalizedPriorities');
    expect(result).not.toContain('### AbsenceBasedSignals');
  });

  it('should produce output significantly smaller than JSON.stringify', () => {
    const outputs: AgentOutputs = {
      typeClassifier: makeTypeClassifier(),
      strengthGrowth: makeStrengthGrowth(),
      trustVerification: makeTrustVerification(),
      workflowHabit: makeWorkflowHabit(),
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

  it('should format WorkflowHabit planning habits and critical thinking', () => {
    const outputs: AgentOutputs = {
      workflowHabit: makeWorkflowHabit(),
    };

    const result = summarizeAgentOutputsForPhase3(outputs);

    expect(result).toContain('workflowScore: 68/100');
    expect(result).toContain('### Planning Habits (1)');
    expect(result).toContain('[task_decomposition]');
    expect(result).toContain('freq: often');
    expect(result).toContain('effectiveness: high');
    expect(result).toContain('### Critical Thinking Moments (1)');
    expect(result).toContain('[verification_request]');
    expect(result).toContain('are you sure');
    expect(result).toContain('caught bug');
    expect(result).toContain('### Multitasking');
    expect(result).toContain('focusScore: 72');
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
