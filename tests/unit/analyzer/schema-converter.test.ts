import { describe, it, expect } from 'vitest';
import {
  getEvaluationJsonSchema,
  getEvaluationTool,
} from '../../../src/lib/analyzer/schema-converter.js';

describe('Schema Converter', () => {
  describe('getEvaluationJsonSchema', () => {
    it('should return a valid JSON Schema object', () => {
      const schema = getEvaluationJsonSchema();

      expect(schema).toBeDefined();
      expect(typeof schema).toBe('object');
    });

    it('should have type "object" at root level', () => {
      const schema = getEvaluationJsonSchema();

      expect(schema.type).toBe('object');
    });

    it('should not include $schema property', () => {
      const schema = getEvaluationJsonSchema();

      expect(schema.$schema).toBeUndefined();
    });

    it('should have properties defined', () => {
      const schema = getEvaluationJsonSchema();

      expect(schema.properties).toBeDefined();
      expect(typeof schema.properties).toBe('object');
    });

    it('should not use $ref (inline all refs)', () => {
      const schema = getEvaluationJsonSchema();
      const schemaStr = JSON.stringify(schema);

      // Should not contain any $ref since we use $refStrategy: 'none'
      expect(schemaStr).not.toContain('"$ref"');
    });

    it('should have required fields array', () => {
      const schema = getEvaluationJsonSchema();

      // Required may or may not exist depending on schema definition
      // If it exists, it should be an array
      if (schema.required !== undefined) {
        expect(Array.isArray(schema.required)).toBe(true);
      }
    });

    it('should produce consistent output on multiple calls', () => {
      const schema1 = getEvaluationJsonSchema();
      const schema2 = getEvaluationJsonSchema();

      expect(JSON.stringify(schema1)).toBe(JSON.stringify(schema2));
    });
  });

  describe('getEvaluationTool', () => {
    it('should return a valid tool definition object', () => {
      const tool = getEvaluationTool();

      expect(tool).toBeDefined();
      expect(typeof tool).toBe('object');
    });

    it('should have name property set to "evaluate_session"', () => {
      const tool = getEvaluationTool();

      expect(tool.name).toBe('evaluate_session');
    });

    it('should have a description property', () => {
      const tool = getEvaluationTool();

      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
    });

    it('should have input_schema property', () => {
      const tool = getEvaluationTool();

      expect(tool.input_schema).toBeDefined();
      expect(typeof tool.input_schema).toBe('object');
    });

    it('should have input_schema with type "object"', () => {
      const tool = getEvaluationTool();

      expect(tool.input_schema.type).toBe('object');
    });

    it('should match the standalone schema', () => {
      const tool = getEvaluationTool();
      const schema = getEvaluationJsonSchema();

      expect(tool.input_schema).toEqual(schema);
    });

    it('should have all required tool definition fields', () => {
      const tool = getEvaluationTool();

      // These are the required fields for Anthropic tool definitions
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('input_schema');

      // Verify types
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(typeof tool.input_schema).toBe('object');
    });
  });
});
