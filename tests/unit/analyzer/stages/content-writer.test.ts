/**
 * Content Writer Stage Tests
 *
 * Tests for ContentWriterStage, focusing on the utility methods
 * that can be tested without LLM API calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { StructuredAnalysisData } from '../../../../src/lib/models/analysis-data.js';

// Mock the GeminiClient to avoid API key requirement
vi.mock('../../../../src/lib/analyzer/clients/gemini-client.js', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    generateStructured: vi.fn(),
  })),
}));

// Import after mocking
import { ContentWriterStage } from '../../../../src/lib/analyzer/stages/content-writer.js';

describe('ContentWriterStage', () => {
  let stage: ContentWriterStage;

  beforeEach(() => {
    // Create stage - GeminiClient is mocked so no API key needed
    stage = new ContentWriterStage();
  });

  describe('convertPrioritiesToFocusAreas', () => {
    // Access private method for testing via type casting
    const callConvertPriorities = (
      stg: ContentWriterStage,
      priorities: NonNullable<StructuredAnalysisData['personalizedPriorities']>
    ) => {
      // Use any to access private method for testing
      return (stg as any).convertPrioritiesToFocusAreas(priorities);
    };

    it('should convert full priority data to focus areas array', () => {
      const priorities: NonNullable<StructuredAnalysisData['personalizedPriorities']> = {
        priority1Dimension: 'aiCollaboration',
        priority1FocusArea: 'Improve structured planning',
        priority1Rationale: 'Your sessions show room for more planning',
        priority1ExpectedImpact: 'Better task organization',
        priority1Score: 85,
        priority2Dimension: 'contextEngineering',
        priority2FocusArea: 'Enhance context clarity',
        priority2Rationale: 'Clearer context leads to better results',
        priority2ExpectedImpact: 'More accurate AI responses',
        priority2Score: 72,
        priority3Dimension: 'toolMastery',
        priority3FocusArea: 'Explore advanced tools',
        priority3Rationale: 'You have untapped tool potential',
        priority3ExpectedImpact: 'Faster development cycles',
        priority3Score: 68,
        selectionRationale: 'Based on your session patterns',
      };

      const result = callConvertPriorities(stage, priorities);

      expect(result).toHaveLength(3);

      // Check first priority
      expect(result[0]).toEqual({
        rank: 1,
        dimension: 'aiCollaboration',
        title: 'Improve structured planning',
        narrative: 'Your sessions show room for more planning',
        expectedImpact: 'Better task organization',
        priorityScore: 85,
      });

      // Check second priority
      expect(result[1]).toEqual({
        rank: 2,
        dimension: 'contextEngineering',
        title: 'Enhance context clarity',
        narrative: 'Clearer context leads to better results',
        expectedImpact: 'More accurate AI responses',
        priorityScore: 72,
      });

      // Check third priority
      expect(result[2]).toEqual({
        rank: 3,
        dimension: 'toolMastery',
        title: 'Explore advanced tools',
        narrative: 'You have untapped tool potential',
        expectedImpact: 'Faster development cycles',
        priorityScore: 68,
      });
    });

    it('should handle missing optional fields gracefully', () => {
      const priorities: NonNullable<StructuredAnalysisData['personalizedPriorities']> = {
        priority1Dimension: 'burnoutRisk',
        priority1FocusArea: 'Monitor session patterns',
        priority1Rationale: undefined,
        priority1ExpectedImpact: undefined,
        priority1Score: undefined,
        priority2Dimension: 'aiControl',
        priority2FocusArea: 'Strengthen verification habits',
        priority2Rationale: 'Important for code quality',
        priority2ExpectedImpact: undefined,
        priority2Score: 50,
        priority3Dimension: undefined,
        priority3FocusArea: undefined,
        priority3Rationale: undefined,
        priority3ExpectedImpact: undefined,
        priority3Score: undefined,
        selectionRationale: 'Focused priorities',
      };

      const result = callConvertPriorities(stage, priorities);

      // Should only include 2 priorities (third has no dimension/focusArea)
      expect(result).toHaveLength(2);

      // First priority with defaults for missing fields
      expect(result[0]).toEqual({
        rank: 1,
        dimension: 'burnoutRisk',
        title: 'Monitor session patterns',
        narrative: '',
        expectedImpact: '',
        priorityScore: 0,
      });

      // Second priority with partial data
      expect(result[1]).toEqual({
        rank: 2,
        dimension: 'aiControl',
        title: 'Strengthen verification habits',
        narrative: 'Important for code quality',
        expectedImpact: '',
        priorityScore: 50,
      });
    });

    it('should return empty array when no valid priorities exist', () => {
      const priorities: NonNullable<StructuredAnalysisData['personalizedPriorities']> = {
        priority1Dimension: undefined,
        priority1FocusArea: undefined,
        priority1Rationale: undefined,
        priority1ExpectedImpact: undefined,
        priority1Score: undefined,
        priority2Dimension: undefined,
        priority2FocusArea: undefined,
        priority2Rationale: undefined,
        priority2ExpectedImpact: undefined,
        priority2Score: undefined,
        priority3Dimension: undefined,
        priority3FocusArea: undefined,
        priority3Rationale: undefined,
        priority3ExpectedImpact: undefined,
        priority3Score: undefined,
        selectionRationale: 'No priorities identified',
      };

      const result = callConvertPriorities(stage, priorities);

      expect(result).toHaveLength(0);
    });

    it('should skip priorities missing either dimension or focusArea', () => {
      const priorities: NonNullable<StructuredAnalysisData['personalizedPriorities']> = {
        // Has dimension but no focusArea
        priority1Dimension: 'aiCollaboration',
        priority1FocusArea: undefined,
        priority1Rationale: 'Some rationale',
        priority1ExpectedImpact: 'Some impact',
        priority1Score: 90,
        // Has focusArea but no dimension
        priority2Dimension: undefined,
        priority2FocusArea: 'Improve something',
        priority2Rationale: 'Another rationale',
        priority2ExpectedImpact: 'Another impact',
        priority2Score: 80,
        // Has both - should be included
        priority3Dimension: 'skillResilience',
        priority3FocusArea: 'Build core skills',
        priority3Rationale: 'Foundation matters',
        priority3ExpectedImpact: 'Long-term growth',
        priority3Score: 75,
        selectionRationale: 'Mixed priorities',
      };

      const result = callConvertPriorities(stage, priorities);

      // Only priority3 has both dimension and focusArea
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        rank: 3,
        dimension: 'skillResilience',
        title: 'Build core skills',
        narrative: 'Foundation matters',
        expectedImpact: 'Long-term growth',
        priorityScore: 75,
      });
    });

    it('should preserve dimension type values correctly', () => {
      const allDimensions = [
        'aiCollaboration',
        'contextEngineering',
        'toolMastery',
        'burnoutRisk',
        'aiControl',
        'skillResilience',
      ] as const;

      // Test first 3 dimensions
      const priorities: NonNullable<StructuredAnalysisData['personalizedPriorities']> = {
        priority1Dimension: allDimensions[0],
        priority1FocusArea: 'Area 1',
        priority1Rationale: undefined,
        priority1ExpectedImpact: undefined,
        priority1Score: undefined,
        priority2Dimension: allDimensions[1],
        priority2FocusArea: 'Area 2',
        priority2Rationale: undefined,
        priority2ExpectedImpact: undefined,
        priority2Score: undefined,
        priority3Dimension: allDimensions[2],
        priority3FocusArea: 'Area 3',
        priority3Rationale: undefined,
        priority3ExpectedImpact: undefined,
        priority3Score: undefined,
        selectionRationale: 'Testing dimensions',
      };

      const result = callConvertPriorities(stage, priorities);

      expect(result[0].dimension).toBe('aiCollaboration');
      expect(result[1].dimension).toBe('contextEngineering');
      expect(result[2].dimension).toBe('toolMastery');
    });

    it('should handle zero score correctly', () => {
      const priorities: NonNullable<StructuredAnalysisData['personalizedPriorities']> = {
        priority1Dimension: 'aiCollaboration',
        priority1FocusArea: 'Low priority area',
        priority1Rationale: 'Zero score test',
        priority1ExpectedImpact: 'Minimal impact',
        priority1Score: 0,
        priority2Dimension: undefined,
        priority2FocusArea: undefined,
        priority2Rationale: undefined,
        priority2ExpectedImpact: undefined,
        priority2Score: undefined,
        priority3Dimension: undefined,
        priority3FocusArea: undefined,
        priority3Rationale: undefined,
        priority3ExpectedImpact: undefined,
        priority3Score: undefined,
        selectionRationale: 'Zero score case',
      };

      const result = callConvertPriorities(stage, priorities);

      expect(result).toHaveLength(1);
      expect(result[0].priorityScore).toBe(0);
    });
  });

  describe('extractKeywords', () => {
    const callExtractKeywords = (stg: ContentWriterStage, text: string) => {
      return (stg as any).extractKeywords(text);
    };

    it('should extract meaningful keywords from English text', () => {
      const text = 'Strong planning and code organization skills';
      const keywords = callExtractKeywords(stage, text);

      expect(keywords.has('strong')).toBe(true);
      expect(keywords.has('planning')).toBe(true);
      expect(keywords.has('code')).toBe(true);
      expect(keywords.has('organization')).toBe(true);
      expect(keywords.has('skills')).toBe(true);
      // Stop words should be filtered
      expect(keywords.has('and')).toBe(false);
    });

    it('should filter common stop words', () => {
      const text = 'The user is able to do this in a good way';
      const keywords = callExtractKeywords(stage, text);

      expect(keywords.has('the')).toBe(false);
      expect(keywords.has('is')).toBe(false);
      expect(keywords.has('to')).toBe(false);
      expect(keywords.has('in')).toBe(false);
      expect(keywords.has('a')).toBe(false);
      // Meaningful words remain
      expect(keywords.has('user')).toBe(true);
      expect(keywords.has('able')).toBe(true);
      expect(keywords.has('good')).toBe(true);
    });

    it('should filter short words (2 chars or less)', () => {
      const text = 'AI is a new tool we use';
      const keywords = callExtractKeywords(stage, text);

      expect(keywords.has('ai')).toBe(false); // 2 chars
      expect(keywords.has('is')).toBe(false); // stop word
      expect(keywords.has('a')).toBe(false); // 1 char & stop word
      expect(keywords.has('we')).toBe(false); // 2 chars
      expect(keywords.has('new')).toBe(true);
      expect(keywords.has('tool')).toBe(true);
      expect(keywords.has('use')).toBe(true);
    });

    it('should handle long words correctly', () => {
      // Note: Words with 2 or fewer characters are filtered out
      const text = 'structural planning codebase configuration';
      const keywords = callExtractKeywords(stage, text);

      // 3+ character words should be included
      expect(keywords.has('structural')).toBe(true);
      expect(keywords.has('planning')).toBe(true);
      expect(keywords.has('codebase')).toBe(true);
      expect(keywords.has('configuration')).toBe(true);
    });
  });

  describe('calculateOverlapScore', () => {
    const callCalculateOverlapScore = (
      stg: ContentWriterStage,
      keywords: Set<string>,
      text: string
    ) => {
      return (stg as any).calculateOverlapScore(keywords, text);
    };

    it('should return 1.0 for perfect keyword match', () => {
      const keywords = new Set(['planning', 'code']);
      const text = 'planning and code review';
      const score = callCalculateOverlapScore(stage, keywords, text);

      expect(score).toBe(1.0);
    });

    it('should return 0 for no keyword overlap', () => {
      const keywords = new Set(['planning', 'code']);
      const text = 'debugging session analysis';
      const score = callCalculateOverlapScore(stage, keywords, text);

      expect(score).toBe(0);
    });

    it('should return partial score for partial overlap', () => {
      const keywords = new Set(['planning', 'code', 'review', 'testing']);
      const text = 'planning the code';
      const score = callCalculateOverlapScore(stage, keywords, text);

      // 2 out of 4 keywords match
      expect(score).toBe(0.5);
    });

    it('should handle empty keywords set', () => {
      const keywords = new Set<string>();
      const text = 'planning the code';
      const score = callCalculateOverlapScore(stage, keywords, text);

      expect(score).toBe(0);
    });

    it('should handle empty text', () => {
      const keywords = new Set(['planning', 'code']);
      const text = '';
      const score = callCalculateOverlapScore(stage, keywords, text);

      expect(score).toBe(0);
    });

    it('should give partial credit for substring matches', () => {
      const keywords = new Set(['plan']);
      const text = 'planning ahead';
      const score = callCalculateOverlapScore(stage, keywords, text);

      // 'plan' partially matches 'planning'
      expect(score).toBe(0.5);
    });
  });
});
