import { z } from 'zod';

/**
 * Rating schema - qualitative assessment of collaboration skills
 * Using growth-focused language
 */
export const RatingSchema = z.enum(['Strong', 'Developing', 'Needs Work']);
export type Rating = z.infer<typeof RatingSchema>;

/**
 * Clue (evidence) schema - specific quotes from the conversation
 * that support the rating
 */
export const ClueSchema = z.object({
  type: z.enum(['positive', 'negative']),
  quote: z
    .string()
    .min(10)
    .max(500)
    .describe('Direct quote from the conversation'),
  explanation: z
    .string()
    .min(10)
    .max(300)
    .describe('Why this quote is evidence for the rating'),
});
export type Clue = z.infer<typeof ClueSchema>;

/**
 * Category evaluation schema - assessment for a single category
 * (Planning, Critical Thinking, or Code Understanding)
 */
export const CategoryEvaluationSchema = z.object({
  rating: RatingSchema,
  summary: z
    .string()
    .min(50)
    .max(500)
    .describe('2-3 sentence summary of performance in this category'),
  clues: z
    .array(ClueSchema)
    .min(1)
    .max(5)
    .describe('1-5 specific evidence items'),
});
export type CategoryEvaluation = z.infer<typeof CategoryEvaluationSchema>;

/**
 * Full evaluation schema - complete assessment of a session
 * This is the primary output from the LLM analyzer
 */
export const EvaluationSchema = z.object({
  sessionId: z.string().uuid(),
  analyzedAt: z.string().datetime(),

  planning: CategoryEvaluationSchema,
  criticalThinking: CategoryEvaluationSchema,
  codeUnderstanding: CategoryEvaluationSchema,

  overallSummary: z
    .string()
    .min(100)
    .max(1000)
    .describe("Overall assessment of the developer's AI collaboration style"),

  recommendations: z
    .array(z.string().min(20).max(200))
    .min(1)
    .max(5)
    .describe('Specific, actionable recommendations for improvement'),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

/**
 * Schema for LLM response parsing - excludes metadata fields
 * that are added after the LLM call
 */
export const LLMResponseSchema = z.object({
  planning: CategoryEvaluationSchema,
  criticalThinking: CategoryEvaluationSchema,
  codeUnderstanding: CategoryEvaluationSchema,
  overallSummary: z.string().min(100).max(1000),
  recommendations: z.array(z.string().min(20).max(200)).min(1).max(5),
});
export type LLMResponse = z.infer<typeof LLMResponseSchema>;
