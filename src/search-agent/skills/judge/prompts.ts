/**
 * Judge Prompts
 *
 * LLM prompts for evaluating content relevance.
 */

import { EnhancedSearchResult } from '../../models/index.js';
import { formatCriteriaForPrompt } from './criteria.js';

/**
 * System prompt for relevance evaluation
 */
export const JUDGE_SYSTEM_PROMPT = `You are an expert evaluator for the NoMoreAISlop project, which helps developers improve their AI collaboration skills.

Your task is to evaluate content and determine if it would be valuable for helping developers:
1. **Plan** better when working with AI (clear requirements, task breakdown)
2. **Think critically** about AI suggestions (questioning, validating)
3. **Understand code** better (leveraging existing patterns, maintaining consistency)

You must evaluate content across five dimensions and make a recommendation.

## Evaluation Philosophy
- Be selective: only "accept" content that is clearly valuable
- Consider the source and evidence
- Prioritize actionable insights over theoretical discussion
- Value novelty but don't reject solid fundamentals`;

/**
 * Build evaluation prompt
 */
export function buildJudgePrompt(
  result: EnhancedSearchResult,
  existingKnowledge: string[]
): string {
  // Truncate content for prompt
  const maxContentLength = 4000;
  const truncatedContent =
    result.content.length > maxContentLength
      ? result.content.slice(0, maxContentLength) + '\n...[truncated]'
      : result.content;

  const existingContext =
    existingKnowledge.length > 0
      ? `\n## Existing Knowledge (for novelty check)\n${existingKnowledge.slice(0, 10).map((k) => `- ${k}`).join('\n')}`
      : '';

  return `Evaluate this content for inclusion in the NoMoreAISlop knowledge base.

## Content to Evaluate

**Title:** ${result.title}
**URL:** ${result.url}
**Platform:** ${result.platform}

**Content:**
${truncatedContent}

**Extracted Insights:**
${result.extracted.keyInsights.map((i) => `- ${i}`).join('\n') || 'None extracted'}

**Referenced Tools:**
${result.extracted.referencedTools.join(', ') || 'None'}
${existingContext}

## Evaluation Criteria

${formatCriteriaForPrompt()}

## Instructions

Score each dimension from 0.0 to 1.0 and provide brief reasoning.
Calculate an overall score (weighted average).
Make a recommendation: "accept" (score >= 0.7), "review" (0.4-0.7), or "reject" (< 0.4).

Use the evaluate_relevance tool to provide your assessment.`;
}

/**
 * Tool definition for structured evaluation output
 */
export const JUDGE_TOOL = {
  name: 'evaluate_relevance',
  description: 'Evaluate content relevance for the NoMoreAISlop knowledge base',
  input_schema: {
    type: 'object' as const,
    properties: {
      topicRelevance: {
        type: 'object',
        properties: {
          score: { type: 'number', minimum: 0, maximum: 1 },
          weight: { type: 'number' },
          reasoning: { type: 'string', maxLength: 300 },
        },
        required: ['score', 'weight', 'reasoning'],
      },
      projectFit: {
        type: 'object',
        properties: {
          score: { type: 'number', minimum: 0, maximum: 1 },
          weight: { type: 'number' },
          reasoning: { type: 'string', maxLength: 300 },
        },
        required: ['score', 'weight', 'reasoning'],
      },
      actionability: {
        type: 'object',
        properties: {
          score: { type: 'number', minimum: 0, maximum: 1 },
          weight: { type: 'number' },
          reasoning: { type: 'string', maxLength: 300 },
        },
        required: ['score', 'weight', 'reasoning'],
      },
      novelty: {
        type: 'object',
        properties: {
          score: { type: 'number', minimum: 0, maximum: 1 },
          weight: { type: 'number' },
          reasoning: { type: 'string', maxLength: 300 },
        },
        required: ['score', 'weight', 'reasoning'],
      },
      credibility: {
        type: 'object',
        properties: {
          score: { type: 'number', minimum: 0, maximum: 1 },
          weight: { type: 'number' },
          reasoning: { type: 'string', maxLength: 300 },
        },
        required: ['score', 'weight', 'reasoning'],
      },
      overallScore: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Weighted average of dimension scores',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence in this evaluation',
      },
      recommendation: {
        type: 'string',
        enum: ['accept', 'review', 'reject'],
      },
      reasoning: {
        type: 'string',
        minLength: 50,
        maxLength: 500,
        description: 'Overall reasoning for the recommendation',
      },
    },
    required: [
      'topicRelevance',
      'projectFit',
      'actionability',
      'novelty',
      'credibility',
      'overallScore',
      'confidence',
      'recommendation',
      'reasoning',
    ],
  },
};
