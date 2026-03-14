/**
 * Schema Nesting Depth Tests
 *
 * Ensures all Zod schemas used with Gemini API don't exceed the maximum nesting depth.
 * Gemini API has a limit of ~4 levels for responseJsonSchema.
 * We enforce a stricter limit of 3 to maintain headroom.
 *
 * @see https://ai.google.dev/api/generate-content
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Phase 1
import { BatchClassificationResultSchema } from '../../../src/lib/models/content-classification';
// Phase 1.5
import { SessionSummaryBatchLLMSchema } from '../../../src/lib/models/session-summary-data';
// Phase 2 Workers
import { ThinkingQualityLLMOutputSchema } from '../../../src/lib/models/thinking-quality-data';
import { CommunicationPatternsLLMOutputSchema } from '../../../src/lib/models/communication-patterns-data';
import { LearningBehaviorLLMOutputSchema } from '../../../src/lib/models/learning-behavior-data';
import { ContextEfficiencyLLMOutputSchema } from '../../../src/lib/models/agent-outputs';
import { SessionOutcomeLLMOutputSchema } from '../../../src/lib/models/session-outcome-data';
// Phase 2 Summarizers
import { ProjectSummaryBatchLLMSchema } from '../../../src/lib/analyzer/stages/project-summarizer';
import { WeeklyInsightsLLMSchema } from '../../../src/lib/models/weekly-insights';
// Phase 2.5
import { TypeClassifierLLMSchema } from '../../../src/lib/analyzer/workers/type-classifier-worker';
// Phase 2.8
import { EvidenceVerificationResponseSchema } from '../../../src/lib/models/evidence-verification-data';
// Phase 3
import { FlatNarrativeLLMResponseSchema } from '../../../src/lib/models/verbose-evaluation';
// Phase 4
import { TranslatorLLMOutputSchema } from '../../../src/lib/models/translator-output';

/**
 * Maximum allowed nesting depth for Gemini API schemas.
 *
 * Gemini's hard limit is 4 levels, but we enforce 3 to maintain headroom.
 * This prevents regressions where a small schema change could push us over the limit.
 */
const GEMINI_MAX_NESTING_DEPTH = 3;

/**
 * Recursively calculate the maximum nesting depth of a JSON Schema
 *
 * Per Gemini API rules, only `object` types count toward nesting depth.
 * `array` types do NOT count — they are transparent wrappers.
 *
 * See CLAUDE.md: "Only `object` (`{}`) counts toward nesting depth. `array` (`[]`) does NOT count."
 *
 * Counts depth through:
 * - object properties (increments depth)
 * - array items (does NOT increment depth — array is transparent)
 * - allOf/anyOf/oneOf combinations
 * - $ref (though we don't use recursive refs)
 */
function calculateMaxNestingDepth(schema: unknown, currentDepth = 0): number {
  if (typeof schema !== 'object' || schema === null) {
    return currentDepth;
  }

  const obj = schema as Record<string, unknown>;
  let maxDepth = currentDepth;

  // Handle object type with properties — COUNTS toward depth
  if (obj.type === 'object' && obj.properties) {
    const props = obj.properties as Record<string, unknown>;
    for (const propSchema of Object.values(props)) {
      const propDepth = calculateMaxNestingDepth(propSchema, currentDepth + 1);
      maxDepth = Math.max(maxDepth, propDepth);
    }
  }

  // Handle array type with items — does NOT count toward depth (Gemini rule)
  if (obj.type === 'array' && obj.items) {
    const itemsDepth = calculateMaxNestingDepth(obj.items, currentDepth);
    maxDepth = Math.max(maxDepth, itemsDepth);
  }

  // Handle allOf, anyOf, oneOf
  for (const combiner of ['allOf', 'anyOf', 'oneOf']) {
    if (Array.isArray(obj[combiner])) {
      for (const subSchema of obj[combiner] as unknown[]) {
        const subDepth = calculateMaxNestingDepth(subSchema, currentDepth);
        maxDepth = Math.max(maxDepth, subDepth);
      }
    }
  }

  // Handle additionalProperties if it's a schema
  if (typeof obj.additionalProperties === 'object' && obj.additionalProperties !== null) {
    const addPropDepth = calculateMaxNestingDepth(obj.additionalProperties, currentDepth + 1);
    maxDepth = Math.max(maxDepth, addPropDepth);
  }

  return maxDepth;
}

/**
 * Find the deepest path in the schema for debugging
 */
function findDeepestPath(schema: unknown, currentPath = 'root', currentDepth = 0): { path: string; depth: number } {
  if (typeof schema !== 'object' || schema === null) {
    return { path: currentPath, depth: currentDepth };
  }

  const obj = schema as Record<string, unknown>;
  let deepest = { path: currentPath, depth: currentDepth };

  // Handle object type with properties
  if (obj.type === 'object' && obj.properties) {
    const props = obj.properties as Record<string, unknown>;
    for (const [propName, propSchema] of Object.entries(props)) {
      const result = findDeepestPath(propSchema, `${currentPath}.${propName}`, currentDepth + 1);
      if (result.depth > deepest.depth) {
        deepest = result;
      }
    }
  }

  // Handle array type with items — does NOT count toward depth (Gemini rule)
  if (obj.type === 'array' && obj.items) {
    const result = findDeepestPath(obj.items, `${currentPath}[]`, currentDepth);
    if (result.depth > deepest.depth) {
      deepest = result;
    }
  }

  // Handle allOf, anyOf, oneOf
  for (const combiner of ['allOf', 'anyOf', 'oneOf']) {
    if (Array.isArray(obj[combiner])) {
      for (let i = 0; i < (obj[combiner] as unknown[]).length; i++) {
        const subSchema = (obj[combiner] as unknown[])[i];
        const result = findDeepestPath(subSchema, `${currentPath}[${combiner}][${i}]`, currentDepth);
        if (result.depth > deepest.depth) {
          deepest = result;
        }
      }
    }
  }

  return deepest;
}

/** Helper to create a nesting depth test for a given schema */
function testSchemaDepth(schemaName: string, schema: unknown) {
  it(`should not exceed ${GEMINI_MAX_NESTING_DEPTH} levels of nesting`, () => {
    const jsonSchema = z.toJSONSchema(schema as z.ZodType, { io: 'input' });
    const maxDepth = calculateMaxNestingDepth(jsonSchema);
    const deepestPath = findDeepestPath(jsonSchema);

    expect(
      maxDepth,
      `${schemaName} exceeds Gemini's max nesting depth.\nDeepest path: ${deepestPath.path}\nDepth: ${deepestPath.depth}\nMax allowed: ${GEMINI_MAX_NESTING_DEPTH}`
    ).toBeLessThanOrEqual(GEMINI_MAX_NESTING_DEPTH);
  });
}

describe('Gemini Schema Nesting Depth', () => {
  // ─── Phase 1 ───────────────────────────────────────
  describe('BatchClassificationResultSchema (Phase 1)', () => {
    testSchemaDepth('BatchClassificationResultSchema', BatchClassificationResultSchema);
  });

  // ─── Phase 1.5 ─────────────────────────────────────
  describe('SessionSummaryBatchLLMSchema (Phase 1.5)', () => {
    testSchemaDepth('SessionSummaryBatchLLMSchema', SessionSummaryBatchLLMSchema);
  });

  // ─── Phase 2 Workers ───────────────────────────────
  describe('ThinkingQualityLLMOutputSchema (Phase 2)', () => {
    testSchemaDepth('ThinkingQualityLLMOutputSchema', ThinkingQualityLLMOutputSchema);
  });

  describe('CommunicationPatternsLLMOutputSchema (Phase 2)', () => {
    testSchemaDepth('CommunicationPatternsLLMOutputSchema', CommunicationPatternsLLMOutputSchema);
  });

  describe('LearningBehaviorLLMOutputSchema (Phase 2)', () => {
    testSchemaDepth('LearningBehaviorLLMOutputSchema', LearningBehaviorLLMOutputSchema);
  });

  describe('ContextEfficiencyLLMOutputSchema (Phase 2)', () => {
    testSchemaDepth('ContextEfficiencyLLMOutputSchema', ContextEfficiencyLLMOutputSchema);
  });

  describe('SessionOutcomeLLMOutputSchema (Phase 2)', () => {
    testSchemaDepth('SessionOutcomeLLMOutputSchema', SessionOutcomeLLMOutputSchema);
  });

  // ─── Phase 2 Summarizers ───────────────────────────
  describe('ProjectSummaryBatchLLMSchema (Phase 2)', () => {
    testSchemaDepth('ProjectSummaryBatchLLMSchema', ProjectSummaryBatchLLMSchema);
  });

  describe('WeeklyInsightsLLMSchema (Phase 2)', () => {
    testSchemaDepth('WeeklyInsightsLLMSchema', WeeklyInsightsLLMSchema);
  });

  // ─── Phase 2.5 ─────────────────────────────────────
  describe('TypeClassifierLLMSchema (Phase 2.5)', () => {
    testSchemaDepth('TypeClassifierLLMSchema', TypeClassifierLLMSchema);
  });

  // ─── Phase 2.8 ─────────────────────────────────────
  describe('EvidenceVerificationResponseSchema (Phase 2.8)', () => {
    testSchemaDepth('EvidenceVerificationResponseSchema', EvidenceVerificationResponseSchema);
  });

  // ─── Phase 3 ───────────────────────────────────────
  describe('FlatNarrativeLLMResponseSchema (Phase 3)', () => {
    testSchemaDepth('FlatNarrativeLLMResponseSchema', FlatNarrativeLLMResponseSchema);
  });

  // ─── Phase 4 ───────────────────────────────────────
  describe('TranslatorLLMOutputSchema (Phase 4)', () => {
    testSchemaDepth('TranslatorLLMOutputSchema', TranslatorLLMOutputSchema);
  });

  // ─── Utility function tests ────────────────────────
  describe('calculateMaxNestingDepth utility', () => {
    it('should correctly calculate depth for flat object', () => {
      const flatSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };
      expect(calculateMaxNestingDepth(flatSchema)).toBe(1);
    });

    it('should correctly calculate depth for nested object', () => {
      const nestedSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              profile: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
              },
            },
          },
        },
      };
      expect(calculateMaxNestingDepth(nestedSchema)).toBe(3);
    });

    it('should correctly calculate depth for array of objects (arrays dont count)', () => {
      const arraySchema = {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
      };
      // root{L1} → users[] (no count) → user{L2} → name = 2 levels
      expect(calculateMaxNestingDepth(arraySchema)).toBe(2);
    });

    it('should correctly calculate depth for deeply nested array of objects', () => {
      // This is the problematic pattern we want to catch
      const deepSchema = {
        type: 'object',
        properties: {
          level1: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                level2: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      level3: {
                        type: 'object',
                        properties: {
                          value: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };
      // root{L1} → level1[] (no count) → item{L2} → level2[] (no count) → item{L3} → level3{L4} = 4 levels
      expect(calculateMaxNestingDepth(deepSchema)).toBe(4);
    });
  });
});
