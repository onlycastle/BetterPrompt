import { describe, it, expect } from 'vitest';
import {
  RatingSchema,
  ClueSchema,
  CategoryEvaluationSchema,
  EvaluationSchema,
  LLMResponseSchema,
} from '../../../src/models/evaluation.js';

describe('Evaluation Models', () => {
  describe('RatingSchema', () => {
    it('should accept valid ratings', () => {
      expect(RatingSchema.parse('Strong')).toBe('Strong');
      expect(RatingSchema.parse('Developing')).toBe('Developing');
      expect(RatingSchema.parse('Needs Work')).toBe('Needs Work');
    });

    it('should reject invalid ratings', () => {
      expect(() => RatingSchema.parse('Excellent')).toThrow();
      expect(() => RatingSchema.parse('Bad')).toThrow();
      expect(() => RatingSchema.parse('')).toThrow();
    });
  });

  describe('ClueSchema', () => {
    it('should validate valid positive clue', () => {
      const clue = {
        type: 'positive',
        quote: 'The developer provided clear requirements upfront',
        explanation: 'This shows good planning before starting the task',
      };
      const result = ClueSchema.safeParse(clue);
      expect(result.success).toBe(true);
    });

    it('should validate valid negative clue', () => {
      const clue = {
        type: 'negative',
        quote: 'Just make it work somehow',
        explanation: 'Vague instructions lead to suboptimal AI collaboration',
      };
      const result = ClueSchema.safeParse(clue);
      expect(result.success).toBe(true);
    });

    it('should reject quote that is too short', () => {
      const clue = {
        type: 'positive',
        quote: 'Short',  // < 10 chars
        explanation: 'This is a valid explanation',
      };
      const result = ClueSchema.safeParse(clue);
      expect(result.success).toBe(false);
    });

    it('should reject explanation that is too short', () => {
      const clue = {
        type: 'positive',
        quote: 'A sufficiently long quote from the conversation',
        explanation: 'Short',  // < 10 chars
      };
      const result = ClueSchema.safeParse(clue);
      expect(result.success).toBe(false);
    });

    it('should reject quote that is too long', () => {
      const clue = {
        type: 'positive',
        quote: 'A'.repeat(501),  // > 500 chars
        explanation: 'This is a valid explanation',
      };
      const result = ClueSchema.safeParse(clue);
      expect(result.success).toBe(false);
    });

    it('should reject invalid type', () => {
      const clue = {
        type: 'neutral',
        quote: 'A valid quote from the conversation',
        explanation: 'A valid explanation for this clue',
      };
      const result = ClueSchema.safeParse(clue);
      expect(result.success).toBe(false);
    });
  });

  describe('CategoryEvaluationSchema', () => {
    const validClue = {
      type: 'positive',
      quote: 'The developer clearly outlined the requirements',
      explanation: 'This shows good communication skills',
    };

    it('should validate valid category evaluation', () => {
      const evaluation = {
        rating: 'Strong',
        summary: 'The developer demonstrated excellent planning skills by outlining clear requirements before asking Claude to implement features.',
        clues: [validClue],
      };
      const result = CategoryEvaluationSchema.safeParse(evaluation);
      expect(result.success).toBe(true);
    });

    it('should accept multiple clues', () => {
      const evaluation = {
        rating: 'Developing',
        summary: 'The developer is improving their planning skills. There is room for growth in providing more context upfront.',
        clues: [validClue, validClue, validClue],
      };
      const result = CategoryEvaluationSchema.safeParse(evaluation);
      expect(result.success).toBe(true);
    });

    it('should reject empty clues array', () => {
      const evaluation = {
        rating: 'Strong',
        summary: 'A valid summary that is at least 50 characters long for testing.',
        clues: [],
      };
      const result = CategoryEvaluationSchema.safeParse(evaluation);
      expect(result.success).toBe(false);
    });

    it('should reject too many clues', () => {
      const evaluation = {
        rating: 'Strong',
        summary: 'A valid summary that is at least 50 characters long for testing.',
        clues: Array(6).fill(validClue),  // > 5 clues
      };
      const result = CategoryEvaluationSchema.safeParse(evaluation);
      expect(result.success).toBe(false);
    });

    it('should reject summary that is too short', () => {
      const evaluation = {
        rating: 'Strong',
        summary: 'Too short summary',  // < 50 chars
        clues: [validClue],
      };
      const result = CategoryEvaluationSchema.safeParse(evaluation);
      expect(result.success).toBe(false);
    });

    it('should reject summary that is too long', () => {
      const evaluation = {
        rating: 'Strong',
        summary: 'A'.repeat(501),  // > 500 chars
        clues: [validClue],
      };
      const result = CategoryEvaluationSchema.safeParse(evaluation);
      expect(result.success).toBe(false);
    });
  });

  describe('EvaluationSchema', () => {
    const validCategoryEvaluation = {
      rating: 'Strong',
      summary: 'The developer demonstrated strong skills in this category by consistently providing clear context.',
      clues: [{
        type: 'positive',
        quote: 'The developer clearly outlined the requirements',
        explanation: 'This shows good communication skills',
      }],
    };

    it('should validate complete evaluation', () => {
      const evaluation = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        analyzedAt: '2024-01-01T00:00:00.000Z',
        planning: validCategoryEvaluation,
        criticalThinking: validCategoryEvaluation,
        codeUnderstanding: validCategoryEvaluation,
        overallSummary: 'A'.repeat(100),  // Min 100 chars
        recommendations: ['Recommendation 1 that is at least 20 characters long'],
      };
      const result = EvaluationSchema.safeParse(evaluation);
      expect(result.success).toBe(true);
    });

    it('should reject invalid session ID format', () => {
      const evaluation = {
        sessionId: 'not-a-uuid',
        analyzedAt: '2024-01-01T00:00:00.000Z',
        planning: validCategoryEvaluation,
        criticalThinking: validCategoryEvaluation,
        codeUnderstanding: validCategoryEvaluation,
        overallSummary: 'A'.repeat(100),
        recommendations: ['Recommendation 1 that is at least 20 characters long'],
      };
      const result = EvaluationSchema.safeParse(evaluation);
      expect(result.success).toBe(false);
    });

    it('should reject invalid datetime format', () => {
      const evaluation = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        analyzedAt: 'invalid-date',
        planning: validCategoryEvaluation,
        criticalThinking: validCategoryEvaluation,
        codeUnderstanding: validCategoryEvaluation,
        overallSummary: 'A'.repeat(100),
        recommendations: ['Recommendation 1 that is at least 20 characters long'],
      };
      const result = EvaluationSchema.safeParse(evaluation);
      expect(result.success).toBe(false);
    });

    it('should reject empty recommendations', () => {
      const evaluation = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        analyzedAt: '2024-01-01T00:00:00.000Z',
        planning: validCategoryEvaluation,
        criticalThinking: validCategoryEvaluation,
        codeUnderstanding: validCategoryEvaluation,
        overallSummary: 'A'.repeat(100),
        recommendations: [],
      };
      const result = EvaluationSchema.safeParse(evaluation);
      expect(result.success).toBe(false);
    });

    it('should reject too many recommendations', () => {
      const evaluation = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        analyzedAt: '2024-01-01T00:00:00.000Z',
        planning: validCategoryEvaluation,
        criticalThinking: validCategoryEvaluation,
        codeUnderstanding: validCategoryEvaluation,
        overallSummary: 'A'.repeat(100),
        recommendations: Array(6).fill('Recommendation that is at least 20 characters long'),
      };
      const result = EvaluationSchema.safeParse(evaluation);
      expect(result.success).toBe(false);
    });

    it('should reject recommendation that is too short', () => {
      const evaluation = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        analyzedAt: '2024-01-01T00:00:00.000Z',
        planning: validCategoryEvaluation,
        criticalThinking: validCategoryEvaluation,
        codeUnderstanding: validCategoryEvaluation,
        overallSummary: 'A'.repeat(100),
        recommendations: ['Short'],  // < 20 chars
      };
      const result = EvaluationSchema.safeParse(evaluation);
      expect(result.success).toBe(false);
    });
  });

  describe('LLMResponseSchema', () => {
    const validCategoryEvaluation = {
      rating: 'Developing',
      summary: 'The developer is making progress in this area. More practice will help solidify these skills.',
      clues: [{
        type: 'negative',
        quote: 'The developer could have provided more context',
        explanation: 'Additional context would have improved the output',
      }],
    };

    it('should validate LLM response without metadata fields', () => {
      const response = {
        planning: validCategoryEvaluation,
        criticalThinking: validCategoryEvaluation,
        codeUnderstanding: validCategoryEvaluation,
        overallSummary: 'A'.repeat(100),
        recommendations: ['Work on providing more context when asking for help from AI assistants'],
      };
      const result = LLMResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should not require sessionId or analyzedAt', () => {
      const response = {
        planning: validCategoryEvaluation,
        criticalThinking: validCategoryEvaluation,
        codeUnderstanding: validCategoryEvaluation,
        overallSummary: 'A'.repeat(100),
        recommendations: ['First recommendation that is at least 20 characters'],
      };

      // LLMResponseSchema should not include sessionId or analyzedAt
      const result = LLMResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});
