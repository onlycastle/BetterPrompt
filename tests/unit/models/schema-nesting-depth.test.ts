/**
 * Schema Nesting Depth Tests
 *
 * Ensures all Zod schemas used with Gemini API don't exceed the maximum nesting depth.
 * Gemini API has a limit of ~4 levels for responseJsonSchema (NOT 5 as documentation suggests).
 *
 * @see https://ai.google.dev/api/generate-content
 */

import { describe, it, expect } from 'vitest';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { VerboseLLMResponseSchema } from '../../../src/lib/models/verbose-evaluation';

/**
 * Maximum allowed nesting depth for Gemini API schemas
 * Gemini returns error: "A schema in GenerationConfig in the request exceeds the maximum allowed nesting depth"
 * when this limit is exceeded.
 *
 * NOTE: Despite documentation suggesting ~5 levels, practical testing shows the limit is ~4 levels.
 * All schemas should stay at or below 4 levels of nesting.
 */
const GEMINI_MAX_NESTING_DEPTH = 4;

/**
 * Recursively calculate the maximum nesting depth of a JSON Schema
 *
 * Counts depth through:
 * - object properties
 * - array items
 * - allOf/anyOf/oneOf combinations
 * - $ref (though we don't use recursive refs)
 */
function calculateMaxNestingDepth(schema: unknown, currentDepth = 0): number {
  if (typeof schema !== 'object' || schema === null) {
    return currentDepth;
  }

  const obj = schema as Record<string, unknown>;
  let maxDepth = currentDepth;

  // Handle object type with properties
  if (obj.type === 'object' && obj.properties) {
    const props = obj.properties as Record<string, unknown>;
    for (const propSchema of Object.values(props)) {
      const propDepth = calculateMaxNestingDepth(propSchema, currentDepth + 1);
      maxDepth = Math.max(maxDepth, propDepth);
    }
  }

  // Handle array type with items
  if (obj.type === 'array' && obj.items) {
    const itemsDepth = calculateMaxNestingDepth(obj.items, currentDepth + 1);
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

  // Handle array type with items
  if (obj.type === 'array' && obj.items) {
    const result = findDeepestPath(obj.items, `${currentPath}[]`, currentDepth + 1);
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

describe('Gemini Schema Nesting Depth', () => {
  describe('VerboseLLMResponseSchema (Stage 2)', () => {
    it(`should not exceed ${GEMINI_MAX_NESTING_DEPTH} levels of nesting`, () => {
      const jsonSchema = zodToJsonSchema(VerboseLLMResponseSchema);
      const maxDepth = calculateMaxNestingDepth(jsonSchema);
      const deepestPath = findDeepestPath(jsonSchema);

      expect(
        maxDepth,
        `Schema exceeds Gemini's max nesting depth.\nDeepest path: ${deepestPath.path}\nDepth: ${deepestPath.depth}\nMax allowed: ${GEMINI_MAX_NESTING_DEPTH}`
      ).toBeLessThanOrEqual(GEMINI_MAX_NESTING_DEPTH);
    });
  });

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

    it('should correctly calculate depth for array of objects', () => {
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
      expect(calculateMaxNestingDepth(arraySchema)).toBe(3);
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
      // root -> level1 -> item -> level2 -> item -> level3 -> value = 6 levels
      expect(calculateMaxNestingDepth(deepSchema)).toBe(6);
    });
  });
});
