/**
 * Agent Outputs Schema Tests
 *
 * Tests for Phase 2 worker output schemas and helper functions.
 *
 * All schemas use flattened semicolon-separated strings to comply with
 * Gemini's 4-5 level nesting limit.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  KnowledgeGapOutputSchema,
  ContextEfficiencyOutputSchema,
  AgentOutputsSchema,
  createEmptyAgentOutputs,
  hasAnyAgentOutput,
  getAllTopInsights,
  getAllGrowthAreasHybrid,
  type KnowledgeGapOutput,
  type ContextEfficiencyOutput,
  type AgentOutputs,
} from '../../../src/lib/models/agent-outputs.js';

// ============================================================================
// Knowledge Gap Output Tests
// ============================================================================

describe('KnowledgeGapOutputSchema', () => {
  const createValidKnowledgeGapOutput = (): KnowledgeGapOutput => ({
    // v3: Required structured arrays
    knowledgeGaps: [
      { topic: 'async/await', questionCount: 7, depth: 'shallow', example: 'Promise chaining not understood' },
      { topic: 'TypeScript generics', questionCount: 4, depth: 'moderate', example: 'constraint syntax unclear' },
    ],
    learningProgress: [
      { topic: 'React hooks', startLevel: 'shallow', currentLevel: 'moderate', evidence: 'useEffect cleanup questions decreased' },
      { topic: 'CSS Grid', startLevel: 'novice', currentLevel: 'moderate', evidence: 'fewer layout questions' },
    ],
    recommendedResources: [
      { topic: 'TypeScript generics', resourceType: 'docs', url: 'https://typescriptlang.org' },
      { topic: 'async/await', resourceType: 'tutorial', url: 'https://javascript.info' },
    ],
    // Legacy string fields (optional, for backward compatibility)
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
      // @ts-expect-error - Testing runtime behavior: knowledgeGaps array is required
      delete output.knowledgeGaps;

      const result = KnowledgeGapOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should truncate topInsights to 3 items when more are provided', () => {
      // Due to Gemini API's maxItems constraint being removed, we use transform
      // to slice arrays instead of failing validation
      const output = createValidKnowledgeGapOutput();
      output.topInsights = ['insight 1', 'insight 2', 'insight 3', 'insight 4'];

      const result = KnowledgeGapOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.topInsights).toEqual(['insight 1', 'insight 2', 'insight 3']);
      }
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
    // v3: Required structured arrays
    contextUsagePatterns: [
      { sessionId: 'session1', avgFillPercent: 85, compactTriggerPercent: 92 },
      { sessionId: 'session2', avgFillPercent: 78, compactTriggerPercent: 88 },
      { sessionId: 'session3', avgFillPercent: 91, compactTriggerPercent: 95 },
    ],
    inefficiencyPatterns: [
      { pattern: 'late_compact', frequency: 15, impact: 'high', description: 'always compacts at 90%+' },
      { pattern: 'context_bloat', frequency: 8, impact: 'medium', description: 'never uses /clear' },
    ],
    promptLengthTrends: [
      { phase: 'early', avgLength: 150 },
      { phase: 'mid', avgLength: 280 },
      { phase: 'late', avgLength: 450 },
    ],
    redundantInfo: [
      { infoType: 'project_structure', repeatCount: 5 },
      { infoType: 'tech_stack', repeatCount: 3 },
      { infoType: 'file_paths', repeatCount: 7 },
    ],
    // Legacy string fields (optional, for backward compatibility)
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
      // @ts-expect-error - Testing runtime behavior: contextUsagePatterns array is required
      delete output.contextUsagePatterns;

      const result = ContextEfficiencyOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should truncate topInsights to 3 items when more are provided', () => {
      // Due to Gemini API's maxItems constraint being removed, we use transform
      // to slice arrays instead of failing validation
      const output = createValidContextEfficiencyOutput();
      output.topInsights = ['insight 1', 'insight 2', 'insight 3', 'insight 4'];

      const result = ContextEfficiencyOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.topInsights).toEqual(['insight 1', 'insight 2', 'insight 3']);
      }
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
    knowledgeGap: {
      // v3: Required structured arrays
      knowledgeGaps: [{ topic: 'async/await', questionCount: 7, depth: 'shallow', example: 'example' }],
      learningProgress: [{ topic: 'React', startLevel: 'shallow', currentLevel: 'moderate', evidence: 'progress' }],
      recommendedResources: [{ topic: 'TypeScript', resourceType: 'docs', url: 'https://example.com' }],
      // Legacy string fields (optional)
      knowledgeGapsData: 'async/await:7:shallow:example',
      learningProgressData: 'React:shallow:moderate:progress',
      recommendedResourcesData: 'TypeScript:docs:url',
      topInsights: ['Insight 1'],
      overallKnowledgeScore: 68,
      confidenceScore: 0.82,
    },
    contextEfficiency: {
      // v3: Required structured arrays
      contextUsagePatterns: [{ sessionId: 'session1', avgFillPercent: 85, compactTriggerPercent: 92 }],
      inefficiencyPatterns: [{ pattern: 'late_compact', frequency: 15, impact: 'high', description: 'example' }],
      promptLengthTrends: [{ phase: 'early', avgLength: 150 }, { phase: 'mid', avgLength: 280 }],
      redundantInfo: [{ infoType: 'structure', repeatCount: 5 }],
      // Legacy string fields (optional)
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
        knowledgeGap: {
          // v3: Required structured arrays (can be empty)
          knowledgeGaps: [],
          learningProgress: [],
          recommendedResources: [],
          // Legacy string fields (optional)
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
      knowledgeGap: {
        knowledgeGapsData: '',
        learningProgressData: '',
        recommendedResourcesData: '',
        topInsights: [],
        overallKnowledgeScore: 50,
        confidenceScore: 0.5,
      },
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
});

describe('getAllTopInsights', () => {
  it('should return empty array for empty outputs', () => {
    const empty = createEmptyAgentOutputs();
    const insights = getAllTopInsights(empty);

    expect(insights).toEqual([]);
  });

  it('should collect insights from knowledgeGap only', () => {
    const outputs: AgentOutputs = {
      knowledgeGap: {
        knowledgeGapsData: '',
        learningProgressData: '',
        recommendedResourcesData: '',
        topInsights: ['Knowledge insight 1', 'Knowledge insight 2'],
        overallKnowledgeScore: 50,
        confidenceScore: 0.5,
      },
    };

    const insights = getAllTopInsights(outputs);
    expect(insights).toEqual(['Knowledge insight 1', 'Knowledge insight 2']);
  });

  it('should collect insights from multiple agents', () => {
    const outputs: AgentOutputs = {
      knowledgeGap: {
        knowledgeGapsData: '',
        learningProgressData: '',
        recommendedResourcesData: '',
        topInsights: ['Knowledge insight'],
        overallKnowledgeScore: 50,
        confidenceScore: 0.5,
      },
      contextEfficiency: {
        contextUsagePatternData: '',
        inefficiencyPatternsData: '',
        promptLengthTrendData: '',
        redundantInfoData: '',
        topInsights: ['Context insight 1', 'Context insight 2'],
        overallEfficiencyScore: 50,
        avgContextFillPercent: 50,
        confidenceScore: 0.5,
      },
    };

    const insights = getAllTopInsights(outputs);
    expect(insights).toEqual([
      'Knowledge insight',
      'Context insight 1',
      'Context insight 2',
    ]);
  });

  it('should handle agents with empty topInsights', () => {
    const outputs: AgentOutputs = {
      knowledgeGap: {
        knowledgeGapsData: '',
        learningProgressData: '',
        recommendedResourcesData: '',
        topInsights: [],
        overallKnowledgeScore: 50,
        confidenceScore: 0.5,
      },
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
    };

    const insights = getAllTopInsights(outputs);
    expect(insights).toEqual(['Context insight']);
  });
});

// ============================================================================
// JSON Schema Conversion Tests
// ============================================================================

describe('JSON Schema Conversion', () => {
  it('should convert KnowledgeGapOutputSchema to JSON Schema', () => {
    const jsonSchema = z.toJSONSchema(KnowledgeGapOutputSchema, { io: 'input' });

    expect(jsonSchema).toBeDefined();
    expect(jsonSchema.type).toBe('object');
  });

  it('should convert ContextEfficiencyOutputSchema to JSON Schema', () => {
    const jsonSchema = z.toJSONSchema(ContextEfficiencyOutputSchema, { io: 'input' });

    expect(jsonSchema).toBeDefined();
    expect(jsonSchema.type).toBe('object');
  });

  it('should convert AgentOutputsSchema to JSON Schema', () => {
    const jsonSchema = z.toJSONSchema(AgentOutputsSchema, { io: 'input' });

    expect(jsonSchema).toBeDefined();
    expect(jsonSchema.type).toBe('object');
  });
});

// ============================================================================
// Growth Area Deduplication Tests
// ============================================================================

describe('getAllGrowthAreasHybrid', () => {
  describe('deduplication', () => {
    it('should merge similar growth areas with different titles', () => {
      const outputs: AgentOutputs = {
        knowledgeGap: {
          knowledgeGapsData: '',
          learningProgressData: '',
          recommendedResourcesData: '',
          topInsights: [],
          overallKnowledgeScore: 50,
          confidenceScore: 0.8,
          growthAreasData: 'Blind Approval Pattern|Accepts AI suggestions without verification|quote1,quote2|Always verify|70|high|85',
        },
        contextEfficiency: {
          contextUsagePatternData: '',
          inefficiencyPatternsData: '',
          promptLengthTrendData: '',
          redundantInfoData: '',
          topInsights: [],
          overallEfficiencyScore: 50,
          avgContextFillPercent: 50,
          confidenceScore: 0.8,
          growthAreasData: 'Blind Approval Habit|A habit of approving without checking|quote3|Check before approving|65|medium|75',
        },
      };

      const result = getAllGrowthAreasHybrid(outputs);

      // Should merge 2 similar items into 1
      expect(result.length).toBe(1);

      // Should use shortest title
      expect(result[0].title).toBe('Blind Approval Habit');

      // Should merge all evidence (3 unique quotes)
      expect(result[0].evidence.length).toBe(3);
      expect(result[0].evidence).toContain('quote1');
      expect(result[0].evidence).toContain('quote3');

      // Should use highest severity (high)
      expect(result[0].severity).toBe('high');

      // Should use maximum frequency (70)
      expect(result[0].frequency).toBe(70);

      // Should use maximum priority score (85)
      expect(result[0].priorityScore).toBe(85);
    });

    it('should NOT merge unrelated growth areas', () => {
      const outputs: AgentOutputs = {
        knowledgeGap: {
          knowledgeGapsData: '',
          learningProgressData: '',
          recommendedResourcesData: '',
          topInsights: [],
          overallKnowledgeScore: 50,
          confidenceScore: 0.8,
          growthAreasData: 'Context Provision|Tends to skip context|quote1|Provide more context',
        },
        contextEfficiency: {
          contextUsagePatternData: '',
          inefficiencyPatternsData: '',
          promptLengthTrendData: '',
          redundantInfoData: '',
          topInsights: [],
          overallEfficiencyScore: 50,
          avgContextFillPercent: 50,
          confidenceScore: 0.8,
          growthAreasData: 'Error Handling|Does not handle errors properly|quote2|Add error handling',
        },
      };

      const result = getAllGrowthAreasHybrid(outputs);

      // Should keep both items (not similar)
      expect(result.length).toBe(2);
    });

    it('should handle empty outputs gracefully', () => {
      const outputs: AgentOutputs = {};

      const result = getAllGrowthAreasHybrid(outputs);

      expect(result.length).toBe(0);
    });

    it('should handle single growth area without modification', () => {
      const outputs: AgentOutputs = {
        knowledgeGap: {
          knowledgeGapsData: '',
          learningProgressData: '',
          recommendedResourcesData: '',
          topInsights: [],
          overallKnowledgeScore: 50,
          confidenceScore: 0.8,
          growthAreasData: 'Single Area|Description|quote1|Recommendation|50|medium|60',
        },
      };

      const result = getAllGrowthAreasHybrid(outputs);

      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Single Area');
      expect(result[0].frequency).toBe(50);
      expect(result[0].severity).toBe('medium');
    });

    it('should deduplicate evidence when merging', () => {
      const outputs: AgentOutputs = {
        knowledgeGap: {
          knowledgeGapsData: '',
          learningProgressData: '',
          recommendedResourcesData: '',
          topInsights: [],
          overallKnowledgeScore: 50,
          confidenceScore: 0.8,
          // Same quote appears in both agents
          growthAreasData: 'Test Pattern|Description|shared_quote,unique1|Rec1',
        },
        contextEfficiency: {
          contextUsagePatternData: '',
          inefficiencyPatternsData: '',
          promptLengthTrendData: '',
          redundantInfoData: '',
          topInsights: [],
          overallEfficiencyScore: 50,
          avgContextFillPercent: 50,
          confidenceScore: 0.8,
          growthAreasData: 'Test Pattern Habit|Description2|shared_quote,unique2|Rec2',
        },
      };

      const result = getAllGrowthAreasHybrid(outputs);

      expect(result.length).toBe(1);
      // Should have 3 unique quotes (shared_quote deduplicated)
      expect(result[0].evidence.length).toBe(3);
      expect(result[0].evidence).toContain('shared_quote');
      expect(result[0].evidence).toContain('unique1');
      expect(result[0].evidence).toContain('unique2');
    });

    it('should use longest recommendation when merging', () => {
      const outputs: AgentOutputs = {
        knowledgeGap: {
          knowledgeGapsData: '',
          learningProgressData: '',
          recommendedResourcesData: '',
          topInsights: [],
          overallKnowledgeScore: 50,
          confidenceScore: 0.8,
          growthAreasData: 'Test Pattern|Desc|q1|Short rec',
        },
        contextEfficiency: {
          contextUsagePatternData: '',
          inefficiencyPatternsData: '',
          promptLengthTrendData: '',
          redundantInfoData: '',
          topInsights: [],
          overallEfficiencyScore: 50,
          avgContextFillPercent: 50,
          confidenceScore: 0.8,
          growthAreasData: 'Test Pattern Issue|Desc|q2|This is a much longer and more detailed recommendation',
        },
      };

      const result = getAllGrowthAreasHybrid(outputs);

      expect(result.length).toBe(1);
      expect(result[0].recommendation).toBe('This is a much longer and more detailed recommendation');
    });
  });
});
