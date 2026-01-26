/**
 * Agent Outputs Schema Tests
 *
 * Tests for the 4 Wow-Focused Agent output schemas:
 * - Pattern Detective: Conversation style discovery
 * - Anti-Pattern Spotter: Bad habit detection
 * - Knowledge Gap Analyzer: Learning gaps and recommendations
 * - Context Efficiency Analyzer: Token inefficiency patterns
 *
 * All schemas use flattened semicolon-separated strings to comply with
 * Gemini's 4-5 level nesting limit.
 */

import { describe, it, expect } from 'vitest';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  PatternDetectiveOutputSchema,
  AntiPatternSpotterOutputSchema,
  KnowledgeGapOutputSchema,
  ContextEfficiencyOutputSchema,
  AgentOutputsSchema,
  createEmptyAgentOutputs,
  hasAnyAgentOutput,
  getAllTopInsights,
  getAllAgentGrowthAreas,
  type PatternDetectiveOutput,
  type AntiPatternSpotterOutput,
  type KnowledgeGapOutput,
  type ContextEfficiencyOutput,
  type AgentOutputs,
} from '../../../src/lib/models/agent-outputs.js';

// ============================================================================
// Pattern Detective Output Tests
// ============================================================================

describe('PatternDetectiveOutputSchema', () => {
  const createValidPatternDetectiveOutput = (): PatternDetectiveOutput => ({
    repeatedQuestionsData: 'React hooks:5:useEffect cleanup;TypeScript generics:3:generic constraints',
    conversationStyleData: "vague_request:23:'just do it' pattern;proactive_context:15:provides context upfront",
    requestStartPatternsData: 'Can you...:45;fix this:12;help me:8',
    topInsights: [
      'TypeScript generics questions appeared 12 times across 5 sessions',
      '67% of requests start without specific context',
      "'Just do it' pattern detected 23 times",
    ],
    overallStyleSummary: 'Direct communicator who tends to skip context',
    confidenceScore: 0.85,
  });

  describe('valid data', () => {
    it('should accept a complete valid output', () => {
      const output = createValidPatternDetectiveOutput();
      const result = PatternDetectiveOutputSchema.safeParse(output);

      expect(result.success).toBe(true);
    });

    it('should accept empty string for data fields', () => {
      const output = createValidPatternDetectiveOutput();
      output.repeatedQuestionsData = '';
      output.conversationStyleData = '';
      output.requestStartPatternsData = '';

      const result = PatternDetectiveOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should accept empty topInsights array', () => {
      const output = createValidPatternDetectiveOutput();
      output.topInsights = [];

      const result = PatternDetectiveOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should accept confidence score at boundary values', () => {
      const outputMin = createValidPatternDetectiveOutput();
      outputMin.confidenceScore = 0;
      expect(PatternDetectiveOutputSchema.safeParse(outputMin).success).toBe(true);

      const outputMax = createValidPatternDetectiveOutput();
      outputMax.confidenceScore = 1;
      expect(PatternDetectiveOutputSchema.safeParse(outputMax).success).toBe(true);
    });
  });

  describe('invalid data', () => {
    it('should FAIL when required fields are missing', () => {
      const output = createValidPatternDetectiveOutput();
      // @ts-expect-error - Testing runtime behavior
      delete output.repeatedQuestionsData;

      const result = PatternDetectiveOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when repeatedQuestionsData exceeds max length', () => {
      const output = createValidPatternDetectiveOutput();
      output.repeatedQuestionsData = 'a'.repeat(2001);

      const result = PatternDetectiveOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when conversationStyleData exceeds max length', () => {
      const output = createValidPatternDetectiveOutput();
      output.conversationStyleData = 'a'.repeat(2001);

      const result = PatternDetectiveOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when requestStartPatternsData exceeds max length', () => {
      const output = createValidPatternDetectiveOutput();
      output.requestStartPatternsData = 'a'.repeat(1001);

      const result = PatternDetectiveOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when topInsights has more than 3 items', () => {
      const output = createValidPatternDetectiveOutput();
      output.topInsights = ['insight 1', 'insight 2', 'insight 3', 'insight 4'];

      const result = PatternDetectiveOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when topInsights item exceeds max length', () => {
      const output = createValidPatternDetectiveOutput();
      output.topInsights = ['a'.repeat(3001)];

      const result = PatternDetectiveOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when overallStyleSummary exceeds max length', () => {
      const output = createValidPatternDetectiveOutput();
      output.overallStyleSummary = 'a'.repeat(3001);

      const result = PatternDetectiveOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when confidenceScore is below 0', () => {
      const output = createValidPatternDetectiveOutput();
      output.confidenceScore = -0.1;

      const result = PatternDetectiveOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when confidenceScore is above 1', () => {
      const output = createValidPatternDetectiveOutput();
      output.confidenceScore = 1.1;

      const result = PatternDetectiveOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Anti-Pattern Spotter Output Tests
// ============================================================================

describe('AntiPatternSpotterOutputSchema', () => {
  const createValidAntiPatternSpotterOutput = (): AntiPatternSpotterOutput => ({
    errorLoopsData: 'TypeScript type error:8:4.2:same error in 3 sessions;ESLint warning:5:2.1:ignored warnings',
    learningAvoidanceData:
      'copy_paste_no_read:code copied without understanding:high;skip_explanation:skips AI explanations:medium',
    repeatedMistakesData: 'ESLint ignore abuse:12:session1,session3,session7;missing type annotations:8:session2,session5',
    topInsights: [
      'ESLint errors repeated 8 times with avg 4.2 turns to resolve',
      '34% of code was copied without understanding verification',
      'Same approach persisted 3+ times in 8 cases',
    ],
    overallHealthScore: 72,
    confidenceScore: 0.78,
  });

  describe('valid data', () => {
    it('should accept a complete valid output', () => {
      const output = createValidAntiPatternSpotterOutput();
      const result = AntiPatternSpotterOutputSchema.safeParse(output);

      expect(result.success).toBe(true);
    });

    it('should accept empty string for data fields', () => {
      const output = createValidAntiPatternSpotterOutput();
      output.errorLoopsData = '';
      output.learningAvoidanceData = '';
      output.repeatedMistakesData = '';

      const result = AntiPatternSpotterOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should accept overallHealthScore at boundary values', () => {
      const outputMin = createValidAntiPatternSpotterOutput();
      outputMin.overallHealthScore = 0;
      expect(AntiPatternSpotterOutputSchema.safeParse(outputMin).success).toBe(true);

      const outputMax = createValidAntiPatternSpotterOutput();
      outputMax.overallHealthScore = 100;
      expect(AntiPatternSpotterOutputSchema.safeParse(outputMax).success).toBe(true);
    });
  });

  describe('invalid data', () => {
    it('should FAIL when required fields are missing', () => {
      const output = createValidAntiPatternSpotterOutput();
      // @ts-expect-error - Testing runtime behavior
      delete output.errorLoopsData;

      const result = AntiPatternSpotterOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when errorLoopsData exceeds max length', () => {
      const output = createValidAntiPatternSpotterOutput();
      output.errorLoopsData = 'a'.repeat(2001);

      const result = AntiPatternSpotterOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when learningAvoidanceData exceeds max length', () => {
      const output = createValidAntiPatternSpotterOutput();
      output.learningAvoidanceData = 'a'.repeat(1501);

      const result = AntiPatternSpotterOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when repeatedMistakesData exceeds max length', () => {
      const output = createValidAntiPatternSpotterOutput();
      output.repeatedMistakesData = 'a'.repeat(1501);

      const result = AntiPatternSpotterOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when topInsights has more than 3 items', () => {
      const output = createValidAntiPatternSpotterOutput();
      output.topInsights = ['insight 1', 'insight 2', 'insight 3', 'insight 4'];

      const result = AntiPatternSpotterOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when overallHealthScore is below 0', () => {
      const output = createValidAntiPatternSpotterOutput();
      output.overallHealthScore = -1;

      const result = AntiPatternSpotterOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when overallHealthScore is above 100', () => {
      const output = createValidAntiPatternSpotterOutput();
      output.overallHealthScore = 101;

      const result = AntiPatternSpotterOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when confidenceScore is out of range', () => {
      const output = createValidAntiPatternSpotterOutput();
      output.confidenceScore = 1.5;

      const result = AntiPatternSpotterOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Knowledge Gap Output Tests
// ============================================================================

describe('KnowledgeGapOutputSchema', () => {
  const createValidKnowledgeGapOutput = (): KnowledgeGapOutput => ({
    knowledgeGapsData:
      'async/await:7:shallow:Promise chaining not understood;TypeScript generics:4:moderate:constraint syntax unclear',
    learningProgressData:
      'React hooks:shallow:moderate:useEffect cleanup questions decreased;CSS Grid:novice:intermediate:fewer layout questions',
    recommendedResourcesData: 'TypeScript generics:docs:typescriptlang.org;async/await:tutorial:javascript.info',
    topInsights: [
      'async/await questions appeared 7 times - fundamental concept learning needed',
      'React hooks understanding: shallow -> moderate (progress over 5 sessions)',
      'Recommended: TypeScript generics official documentation',
    ],
    overallKnowledgeScore: 68,
    confidenceScore: 0.82,
  });

  describe('valid data', () => {
    it('should accept a complete valid output', () => {
      const output = createValidKnowledgeGapOutput();
      const result = KnowledgeGapOutputSchema.safeParse(output);

      expect(result.success).toBe(true);
    });

    it('should accept empty string for data fields', () => {
      const output = createValidKnowledgeGapOutput();
      output.knowledgeGapsData = '';
      output.learningProgressData = '';
      output.recommendedResourcesData = '';

      const result = KnowledgeGapOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should accept overallKnowledgeScore at boundary values', () => {
      const outputMin = createValidKnowledgeGapOutput();
      outputMin.overallKnowledgeScore = 0;
      expect(KnowledgeGapOutputSchema.safeParse(outputMin).success).toBe(true);

      const outputMax = createValidKnowledgeGapOutput();
      outputMax.overallKnowledgeScore = 100;
      expect(KnowledgeGapOutputSchema.safeParse(outputMax).success).toBe(true);
    });
  });

  describe('invalid data', () => {
    it('should FAIL when required fields are missing', () => {
      const output = createValidKnowledgeGapOutput();
      // @ts-expect-error - Testing runtime behavior
      delete output.knowledgeGapsData;

      const result = KnowledgeGapOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when knowledgeGapsData exceeds max length', () => {
      const output = createValidKnowledgeGapOutput();
      output.knowledgeGapsData = 'a'.repeat(2001);

      const result = KnowledgeGapOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when learningProgressData exceeds max length', () => {
      const output = createValidKnowledgeGapOutput();
      output.learningProgressData = 'a'.repeat(1501);

      const result = KnowledgeGapOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when recommendedResourcesData exceeds max length', () => {
      const output = createValidKnowledgeGapOutput();
      output.recommendedResourcesData = 'a'.repeat(1001);

      const result = KnowledgeGapOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when topInsights has more than 3 items', () => {
      const output = createValidKnowledgeGapOutput();
      output.topInsights = ['insight 1', 'insight 2', 'insight 3', 'insight 4'];

      const result = KnowledgeGapOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when overallKnowledgeScore is below 0', () => {
      const output = createValidKnowledgeGapOutput();
      output.overallKnowledgeScore = -1;

      const result = KnowledgeGapOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when overallKnowledgeScore is above 100', () => {
      const output = createValidKnowledgeGapOutput();
      output.overallKnowledgeScore = 101;

      const result = KnowledgeGapOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Context Efficiency Output Tests
// ============================================================================

describe('ContextEfficiencyOutputSchema', () => {
  const createValidContextEfficiencyOutput = (): ContextEfficiencyOutput => ({
    contextUsagePatternData: 'session1:85:92;session2:78:88;session3:91:95',
    inefficiencyPatternsData:
      'late_compact:15:high:always compacts at 90%+;context_bloat:8:medium:never uses /clear',
    promptLengthTrendData: 'early:150;mid:280;late:450',
    redundantInfoData: 'project_structure:5;tech_stack:3;file_paths:7',
    topInsights: [
      'Average 85% context fill before compact - consider earlier compaction',
      'Prompt length increases 2.3x in late session',
      'Project structure explained 5 times - set in context once',
    ],
    overallEfficiencyScore: 65,
    avgContextFillPercent: 84,
    confidenceScore: 0.79,
  });

  describe('valid data', () => {
    it('should accept a complete valid output', () => {
      const output = createValidContextEfficiencyOutput();
      const result = ContextEfficiencyOutputSchema.safeParse(output);

      expect(result.success).toBe(true);
    });

    it('should accept empty string for data fields', () => {
      const output = createValidContextEfficiencyOutput();
      output.contextUsagePatternData = '';
      output.inefficiencyPatternsData = '';
      output.promptLengthTrendData = '';
      output.redundantInfoData = '';

      const result = ContextEfficiencyOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should accept score fields at boundary values', () => {
      const output = createValidContextEfficiencyOutput();
      output.overallEfficiencyScore = 0;
      output.avgContextFillPercent = 0;
      expect(ContextEfficiencyOutputSchema.safeParse(output).success).toBe(true);

      output.overallEfficiencyScore = 100;
      output.avgContextFillPercent = 100;
      expect(ContextEfficiencyOutputSchema.safeParse(output).success).toBe(true);
    });
  });

  describe('invalid data', () => {
    it('should FAIL when required fields are missing', () => {
      const output = createValidContextEfficiencyOutput();
      // @ts-expect-error - Testing runtime behavior
      delete output.contextUsagePatternData;

      const result = ContextEfficiencyOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when contextUsagePatternData exceeds max length', () => {
      const output = createValidContextEfficiencyOutput();
      output.contextUsagePatternData = 'a'.repeat(1501);

      const result = ContextEfficiencyOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when inefficiencyPatternsData exceeds max length', () => {
      const output = createValidContextEfficiencyOutput();
      output.inefficiencyPatternsData = 'a'.repeat(2001);

      const result = ContextEfficiencyOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when promptLengthTrendData exceeds max length', () => {
      const output = createValidContextEfficiencyOutput();
      output.promptLengthTrendData = 'a'.repeat(501);

      const result = ContextEfficiencyOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when redundantInfoData exceeds max length', () => {
      const output = createValidContextEfficiencyOutput();
      output.redundantInfoData = 'a'.repeat(1001);

      const result = ContextEfficiencyOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when topInsights has more than 3 items', () => {
      const output = createValidContextEfficiencyOutput();
      output.topInsights = ['insight 1', 'insight 2', 'insight 3', 'insight 4'];

      const result = ContextEfficiencyOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should FAIL when overallEfficiencyScore is out of range', () => {
      const output = createValidContextEfficiencyOutput();
      output.overallEfficiencyScore = -1;
      expect(ContextEfficiencyOutputSchema.safeParse(output).success).toBe(false);

      output.overallEfficiencyScore = 101;
      expect(ContextEfficiencyOutputSchema.safeParse(output).success).toBe(false);
    });

    it('should FAIL when avgContextFillPercent is out of range', () => {
      const output = createValidContextEfficiencyOutput();
      output.avgContextFillPercent = -1;
      expect(ContextEfficiencyOutputSchema.safeParse(output).success).toBe(false);

      output.avgContextFillPercent = 101;
      expect(ContextEfficiencyOutputSchema.safeParse(output).success).toBe(false);
    });
  });
});

// ============================================================================
// Combined Agent Outputs Tests
// ============================================================================

describe('AgentOutputsSchema', () => {
  const createValidAgentOutputs = (): AgentOutputs => ({
    patternDetective: {
      repeatedQuestionsData: 'React hooks:5:useEffect cleanup',
      conversationStyleData: 'vague_request:23:pattern',
      requestStartPatternsData: 'Can you...:45',
      topInsights: ['Insight 1', 'Insight 2', 'Insight 3'],
      overallStyleSummary: 'Direct communicator',
      confidenceScore: 0.85,
    },
    antiPatternSpotter: {
      errorLoopsData: 'TypeScript error:8:4.2:example',
      learningAvoidanceData: 'copy_paste:high',
      repeatedMistakesData: 'ESLint:12:sessions',
      topInsights: ['Insight 1', 'Insight 2'],
      overallHealthScore: 72,
      confidenceScore: 0.78,
    },
    knowledgeGap: {
      knowledgeGapsData: 'async/await:7:shallow:example',
      learningProgressData: 'React:shallow:moderate:progress',
      recommendedResourcesData: 'TypeScript:docs:url',
      topInsights: ['Insight 1'],
      overallKnowledgeScore: 68,
      confidenceScore: 0.82,
    },
    contextEfficiency: {
      contextUsagePatternData: 'session1:85:92',
      inefficiencyPatternsData: 'late_compact:15:high:example',
      promptLengthTrendData: 'early:150;mid:280',
      redundantInfoData: 'structure:5',
      topInsights: ['Insight 1', 'Insight 2', 'Insight 3'],
      overallEfficiencyScore: 65,
      avgContextFillPercent: 84,
      confidenceScore: 0.79,
    },
  });

  describe('valid data', () => {
    it('should accept complete outputs with all agents', () => {
      const outputs = createValidAgentOutputs();
      const result = AgentOutputsSchema.safeParse(outputs);

      expect(result.success).toBe(true);
    });

    it('should accept empty object (all fields optional)', () => {
      const outputs = {};
      const result = AgentOutputsSchema.safeParse(outputs);

      expect(result.success).toBe(true);
    });

    it('should accept partial outputs (some agents)', () => {
      const outputs = {
        patternDetective: {
          repeatedQuestionsData: '',
          conversationStyleData: '',
          requestStartPatternsData: '',
          topInsights: [],
          overallStyleSummary: 'test',
          confidenceScore: 0.5,
        },
        knowledgeGap: {
          knowledgeGapsData: '',
          learningProgressData: '',
          recommendedResourcesData: '',
          topInsights: [],
          overallKnowledgeScore: 50,
          confidenceScore: 0.6,
        },
      };

      const result = AgentOutputsSchema.safeParse(outputs);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid data', () => {
    it('should FAIL when patternDetective has invalid data', () => {
      const outputs = createValidAgentOutputs();
      if (outputs.patternDetective) {
        outputs.patternDetective.confidenceScore = 1.5; // Invalid
      }

      const result = AgentOutputsSchema.safeParse(outputs);
      expect(result.success).toBe(false);
    });

    it('should FAIL when antiPatternSpotter has invalid data', () => {
      const outputs = createValidAgentOutputs();
      if (outputs.antiPatternSpotter) {
        outputs.antiPatternSpotter.overallHealthScore = 101; // Invalid
      }

      const result = AgentOutputsSchema.safeParse(outputs);
      expect(result.success).toBe(false);
    });

    it('should FAIL when knowledgeGap has invalid data', () => {
      const outputs = createValidAgentOutputs();
      if (outputs.knowledgeGap) {
        outputs.knowledgeGap.overallKnowledgeScore = -1; // Invalid
      }

      const result = AgentOutputsSchema.safeParse(outputs);
      expect(result.success).toBe(false);
    });

    it('should FAIL when contextEfficiency has invalid data', () => {
      const outputs = createValidAgentOutputs();
      if (outputs.contextEfficiency) {
        outputs.contextEfficiency.avgContextFillPercent = 101; // Invalid
      }

      const result = AgentOutputsSchema.safeParse(outputs);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Helper Functions Tests
// ============================================================================

describe('createEmptyAgentOutputs', () => {
  it('should create an empty object', () => {
    const empty = createEmptyAgentOutputs();

    expect(empty).toEqual({});
    expect(empty.patternDetective).toBeUndefined();
    expect(empty.antiPatternSpotter).toBeUndefined();
    expect(empty.knowledgeGap).toBeUndefined();
    expect(empty.contextEfficiency).toBeUndefined();
  });

  it('should return a valid AgentOutputs object', () => {
    const empty = createEmptyAgentOutputs();
    const result = AgentOutputsSchema.safeParse(empty);

    expect(result.success).toBe(true);
  });
});

describe('hasAnyAgentOutput', () => {
  it('should return false for empty outputs', () => {
    const empty = createEmptyAgentOutputs();
    expect(hasAnyAgentOutput(empty)).toBe(false);
  });

  it('should return true when patternDetective exists', () => {
    const outputs: AgentOutputs = {
      patternDetective: {
        repeatedQuestionsData: '',
        conversationStyleData: '',
        requestStartPatternsData: '',
        topInsights: [],
        overallStyleSummary: 'test',
        confidenceScore: 0.5,
      },
    };

    expect(hasAnyAgentOutput(outputs)).toBe(true);
  });

  it('should return true when antiPatternSpotter exists', () => {
    const outputs: AgentOutputs = {
      antiPatternSpotter: {
        errorLoopsData: '',
        learningAvoidanceData: '',
        repeatedMistakesData: '',
        topInsights: [],
        overallHealthScore: 50,
        confidenceScore: 0.5,
      },
    };

    expect(hasAnyAgentOutput(outputs)).toBe(true);
  });

  it('should return true when knowledgeGap exists', () => {
    const outputs: AgentOutputs = {
      knowledgeGap: {
        knowledgeGapsData: '',
        learningProgressData: '',
        recommendedResourcesData: '',
        topInsights: [],
        overallKnowledgeScore: 50,
        confidenceScore: 0.5,
      },
    };

    expect(hasAnyAgentOutput(outputs)).toBe(true);
  });

  it('should return true when contextEfficiency exists', () => {
    const outputs: AgentOutputs = {
      contextEfficiency: {
        contextUsagePatternData: '',
        inefficiencyPatternsData: '',
        promptLengthTrendData: '',
        redundantInfoData: '',
        topInsights: [],
        overallEfficiencyScore: 50,
        avgContextFillPercent: 50,
        confidenceScore: 0.5,
      },
    };

    expect(hasAnyAgentOutput(outputs)).toBe(true);
  });

  it('should return true when multiple agents exist', () => {
    const outputs: AgentOutputs = {
      patternDetective: {
        repeatedQuestionsData: '',
        conversationStyleData: '',
        requestStartPatternsData: '',
        topInsights: [],
        overallStyleSummary: 'test',
        confidenceScore: 0.5,
      },
      knowledgeGap: {
        knowledgeGapsData: '',
        learningProgressData: '',
        recommendedResourcesData: '',
        topInsights: [],
        overallKnowledgeScore: 50,
        confidenceScore: 0.5,
      },
    };

    expect(hasAnyAgentOutput(outputs)).toBe(true);
  });
});

describe('getAllTopInsights', () => {
  it('should return empty array for empty outputs', () => {
    const empty = createEmptyAgentOutputs();
    const insights = getAllTopInsights(empty);

    expect(insights).toEqual([]);
  });

  it('should collect insights from patternDetective only', () => {
    const outputs: AgentOutputs = {
      patternDetective: {
        repeatedQuestionsData: '',
        conversationStyleData: '',
        requestStartPatternsData: '',
        topInsights: ['Pattern insight 1', 'Pattern insight 2'],
        overallStyleSummary: 'test',
        confidenceScore: 0.5,
      },
    };

    const insights = getAllTopInsights(outputs);
    expect(insights).toEqual(['Pattern insight 1', 'Pattern insight 2']);
  });

  it('should collect insights from multiple agents', () => {
    const outputs: AgentOutputs = {
      patternDetective: {
        repeatedQuestionsData: '',
        conversationStyleData: '',
        requestStartPatternsData: '',
        topInsights: ['Pattern insight'],
        overallStyleSummary: 'test',
        confidenceScore: 0.5,
      },
      antiPatternSpotter: {
        errorLoopsData: '',
        learningAvoidanceData: '',
        repeatedMistakesData: '',
        topInsights: ['Anti-pattern insight 1', 'Anti-pattern insight 2'],
        overallHealthScore: 50,
        confidenceScore: 0.5,
      },
      knowledgeGap: {
        knowledgeGapsData: '',
        learningProgressData: '',
        recommendedResourcesData: '',
        topInsights: ['Knowledge insight'],
        overallKnowledgeScore: 50,
        confidenceScore: 0.5,
      },
    };

    const insights = getAllTopInsights(outputs);
    expect(insights).toEqual([
      'Pattern insight',
      'Anti-pattern insight 1',
      'Anti-pattern insight 2',
      'Knowledge insight',
    ]);
  });

  it('should collect insights from all 4 agents', () => {
    const outputs: AgentOutputs = {
      patternDetective: {
        repeatedQuestionsData: '',
        conversationStyleData: '',
        requestStartPatternsData: '',
        topInsights: ['Pattern 1', 'Pattern 2'],
        overallStyleSummary: 'test',
        confidenceScore: 0.5,
      },
      antiPatternSpotter: {
        errorLoopsData: '',
        learningAvoidanceData: '',
        repeatedMistakesData: '',
        topInsights: ['AntiPattern 1'],
        overallHealthScore: 50,
        confidenceScore: 0.5,
      },
      knowledgeGap: {
        knowledgeGapsData: '',
        learningProgressData: '',
        recommendedResourcesData: '',
        topInsights: ['Knowledge 1', 'Knowledge 2', 'Knowledge 3'],
        overallKnowledgeScore: 50,
        confidenceScore: 0.5,
      },
      contextEfficiency: {
        contextUsagePatternData: '',
        inefficiencyPatternsData: '',
        promptLengthTrendData: '',
        redundantInfoData: '',
        topInsights: ['Context 1'],
        overallEfficiencyScore: 50,
        avgContextFillPercent: 50,
        confidenceScore: 0.5,
      },
    };

    const insights = getAllTopInsights(outputs);
    expect(insights).toEqual([
      'Pattern 1',
      'Pattern 2',
      'AntiPattern 1',
      'Knowledge 1',
      'Knowledge 2',
      'Knowledge 3',
      'Context 1',
    ]);
  });

  it('should handle agents with empty topInsights', () => {
    const outputs: AgentOutputs = {
      patternDetective: {
        repeatedQuestionsData: '',
        conversationStyleData: '',
        requestStartPatternsData: '',
        topInsights: [],
        overallStyleSummary: 'test',
        confidenceScore: 0.5,
      },
      knowledgeGap: {
        knowledgeGapsData: '',
        learningProgressData: '',
        recommendedResourcesData: '',
        topInsights: ['Knowledge insight'],
        overallKnowledgeScore: 50,
        confidenceScore: 0.5,
      },
    };

    const insights = getAllTopInsights(outputs);
    expect(insights).toEqual(['Knowledge insight']);
  });

  it('should preserve insight order (detective → anti-pattern → knowledge → context)', () => {
    const outputs: AgentOutputs = {
      contextEfficiency: {
        contextUsagePatternData: '',
        inefficiencyPatternsData: '',
        promptLengthTrendData: '',
        redundantInfoData: '',
        topInsights: ['Context insight'],
        overallEfficiencyScore: 50,
        avgContextFillPercent: 50,
        confidenceScore: 0.5,
      },
      patternDetective: {
        repeatedQuestionsData: '',
        conversationStyleData: '',
        requestStartPatternsData: '',
        topInsights: ['Pattern insight'],
        overallStyleSummary: 'test',
        confidenceScore: 0.5,
      },
    };

    const insights = getAllTopInsights(outputs);
    // Pattern detective should come before context efficiency
    expect(insights).toEqual(['Pattern insight', 'Context insight']);
  });
});

// ============================================================================
// JSON Schema Conversion Tests
// ============================================================================

describe('JSON Schema Conversion', () => {
  it('should convert PatternDetectiveOutputSchema to JSON Schema', () => {
    const jsonSchema = zodToJsonSchema(PatternDetectiveOutputSchema);

    expect(jsonSchema).toBeDefined();
    expect(jsonSchema.type).toBe('object');
  });

  it('should convert AntiPatternSpotterOutputSchema to JSON Schema', () => {
    const jsonSchema = zodToJsonSchema(AntiPatternSpotterOutputSchema);

    expect(jsonSchema).toBeDefined();
    expect(jsonSchema.type).toBe('object');
  });

  it('should convert KnowledgeGapOutputSchema to JSON Schema', () => {
    const jsonSchema = zodToJsonSchema(KnowledgeGapOutputSchema);

    expect(jsonSchema).toBeDefined();
    expect(jsonSchema.type).toBe('object');
  });

  it('should convert ContextEfficiencyOutputSchema to JSON Schema', () => {
    const jsonSchema = zodToJsonSchema(ContextEfficiencyOutputSchema);

    expect(jsonSchema).toBeDefined();
    expect(jsonSchema.type).toBe('object');
  });

  it('should convert AgentOutputsSchema to JSON Schema', () => {
    const jsonSchema = zodToJsonSchema(AgentOutputsSchema);

    expect(jsonSchema).toBeDefined();
    expect(jsonSchema.type).toBe('object');
  });
});

// ============================================================================
// Growth Area Deduplication Tests
// ============================================================================

describe('getAllAgentGrowthAreas', () => {
  describe('deduplication', () => {
    it('should merge similar growth areas with different titles', () => {
      const outputs: AgentOutputs = {
        patternDetective: {
          repeatedQuestionsData: '',
          conversationStyleData: '',
          requestStartPatternsData: '',
          topInsights: [],
          overallStyleSummary: '',
          confidenceScore: 0.8,
          growthAreasData: 'Blind Approval Pattern|Accepts AI suggestions without verification|quote1,quote2|Always verify|70|high|85',
        },
        metacognition: {
          overallAwarenessScore: 50,
          awarenessLevel: 'developing',
          growthMindsetIndicator: 'moderate',
          blindSpotsData: '',
          selfAwarenessIndicatorsData: '',
          metaStrategiesData: '',
          topInsights: [],
          confidenceScore: 0.8,
          growthAreasData: 'Blind Approval Habit|A habit of approving without checking|quote3|Check before approving|65|medium|75',
        },
        antiPatternSpotter: {
          errorLoopsData: '',
          learningAvoidanceData: '',
          repeatedMistakesData: '',
          topInsights: [],
          overallHealthScore: 70,
          confidenceScore: 0.8,
          growthAreasData: 'Blind Approval & Verification|Verification is often skipped|quote4,quote5|Implement checklist|80|critical|90',
        },
      };

      const result = getAllAgentGrowthAreas(outputs);

      // Should merge 3 similar items into 1
      expect(result.length).toBe(1);

      // Should use shortest title
      expect(result[0].title).toBe('Blind Approval Habit');

      // Should merge all evidence (5 unique quotes)
      expect(result[0].evidence.length).toBe(5);
      expect(result[0].evidence).toContain('quote1');
      expect(result[0].evidence).toContain('quote5');

      // Should use highest severity (critical)
      expect(result[0].severity).toBe('critical');

      // Should use maximum frequency (80)
      expect(result[0].frequency).toBe(80);

      // Should use maximum priority score (90)
      expect(result[0].priorityScore).toBe(90);
    });

    it('should NOT merge unrelated growth areas', () => {
      const outputs: AgentOutputs = {
        patternDetective: {
          repeatedQuestionsData: '',
          conversationStyleData: '',
          requestStartPatternsData: '',
          topInsights: [],
          overallStyleSummary: '',
          confidenceScore: 0.8,
          growthAreasData: 'Context Provision|Tends to skip context|quote1|Provide more context',
        },
        metacognition: {
          overallAwarenessScore: 50,
          awarenessLevel: 'developing',
          growthMindsetIndicator: 'moderate',
          blindSpotsData: '',
          selfAwarenessIndicatorsData: '',
          metaStrategiesData: '',
          topInsights: [],
          confidenceScore: 0.8,
          growthAreasData: 'Error Handling|Does not handle errors properly|quote2|Add error handling',
        },
      };

      const result = getAllAgentGrowthAreas(outputs);

      // Should keep both items (not similar)
      expect(result.length).toBe(2);
    });

    it('should handle empty outputs gracefully', () => {
      const outputs: AgentOutputs = {};

      const result = getAllAgentGrowthAreas(outputs);

      expect(result.length).toBe(0);
    });

    it('should handle single growth area without modification', () => {
      const outputs: AgentOutputs = {
        patternDetective: {
          repeatedQuestionsData: '',
          conversationStyleData: '',
          requestStartPatternsData: '',
          topInsights: [],
          overallStyleSummary: '',
          confidenceScore: 0.8,
          growthAreasData: 'Single Area|Description|quote1|Recommendation|50|medium|60',
        },
      };

      const result = getAllAgentGrowthAreas(outputs);

      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Single Area');
      expect(result[0].frequency).toBe(50);
      expect(result[0].severity).toBe('medium');
    });

    it('should deduplicate evidence when merging', () => {
      const outputs: AgentOutputs = {
        patternDetective: {
          repeatedQuestionsData: '',
          conversationStyleData: '',
          requestStartPatternsData: '',
          topInsights: [],
          overallStyleSummary: '',
          confidenceScore: 0.8,
          // Same quote appears in both agents
          growthAreasData: 'Test Pattern|Description|shared_quote,unique1|Rec1',
        },
        metacognition: {
          overallAwarenessScore: 50,
          awarenessLevel: 'developing',
          growthMindsetIndicator: 'moderate',
          blindSpotsData: '',
          selfAwarenessIndicatorsData: '',
          metaStrategiesData: '',
          topInsights: [],
          confidenceScore: 0.8,
          growthAreasData: 'Test Pattern Habit|Description2|shared_quote,unique2|Rec2',
        },
      };

      const result = getAllAgentGrowthAreas(outputs);

      expect(result.length).toBe(1);
      // Should have 3 unique quotes (shared_quote deduplicated)
      expect(result[0].evidence.length).toBe(3);
      expect(result[0].evidence).toContain('shared_quote');
      expect(result[0].evidence).toContain('unique1');
      expect(result[0].evidence).toContain('unique2');
    });

    it('should use longest recommendation when merging', () => {
      const outputs: AgentOutputs = {
        patternDetective: {
          repeatedQuestionsData: '',
          conversationStyleData: '',
          requestStartPatternsData: '',
          topInsights: [],
          overallStyleSummary: '',
          confidenceScore: 0.8,
          growthAreasData: 'Test Pattern|Desc|q1|Short rec',
        },
        metacognition: {
          overallAwarenessScore: 50,
          awarenessLevel: 'developing',
          growthMindsetIndicator: 'moderate',
          blindSpotsData: '',
          selfAwarenessIndicatorsData: '',
          metaStrategiesData: '',
          topInsights: [],
          confidenceScore: 0.8,
          growthAreasData: 'Test Pattern Issue|Desc|q2|This is a much longer and more detailed recommendation',
        },
      };

      const result = getAllAgentGrowthAreas(outputs);

      expect(result.length).toBe(1);
      expect(result[0].recommendation).toBe('This is a much longer and more detailed recommendation');
    });
  });
});
