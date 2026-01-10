import { zodToJsonSchema } from 'zod-to-json-schema';
import { LLMResponseSchema } from '../models/index.js';

/**
 * Convert the LLM response schema to JSON Schema format
 * for use with Anthropic's structured outputs
 *
 * Anthropic requires the schema to have `type: "object"` at the root,
 * not using $ref or definitions.
 */
export function getEvaluationJsonSchema(): Record<string, unknown> {
  const fullSchema = zodToJsonSchema(LLMResponseSchema, {
    $refStrategy: 'none', // Inline all refs
  });

  // Remove $schema as Anthropic doesn't need it
  const { $schema, ...schema } = fullSchema as Record<string, unknown>;

  return schema;
}

/**
 * Get the tool definition for structured output
 */
export function getEvaluationTool(): {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
} {
  const schema = getEvaluationJsonSchema();

  return {
    name: 'evaluate_session',
    description:
      'Evaluate a developer-AI collaboration session and provide structured feedback',
    input_schema: schema,
  };
}
