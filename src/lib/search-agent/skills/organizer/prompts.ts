/**
 * Organizer Prompts
 *
 * LLM prompts for organizing and structuring knowledge items.
 */

import { JudgmentResult } from '../../models/index';
import { formatTaxonomyForPrompt } from './taxonomy';

/**
 * System prompt for knowledge organization
 */
export const ORGANIZER_SYSTEM_PROMPT = `You are a knowledge organization specialist for the NoMoreAISlop project. Your task is to transform evaluated content into well-structured knowledge items.

NoMoreAISlop helps developers improve their AI collaboration skills by evaluating:
1. **Planning** - How well they structure and communicate requirements
2. **Critical Thinking** - How effectively they evaluate AI suggestions
3. **Code Understanding** - How well they leverage existing code patterns

When organizing knowledge, focus on:
- Creating clear, actionable titles
- Writing summaries that capture the key value
- Preserving important details in the content
- Choosing accurate categories and tags
- Identifying the content type (technique, pattern, tool, etc.)`;

/**
 * Build organization prompt
 */
export function buildOrganizePrompt(
  title: string,
  content: string,
  judgment: JudgmentResult
): string {
  // Truncate very long content
  const maxContentLength = 5000;
  const truncatedContent =
    content.length > maxContentLength
      ? content.slice(0, maxContentLength) + '\n...[truncated]'
      : content;

  return `Transform this evaluated content into a structured knowledge item.

## Original Content

**Title:** ${title}
**URL:** ${judgment.sourceUrl}

**Content:**
${truncatedContent}

## Evaluation Summary

**Overall Score:** ${judgment.assessment.overallScore.toFixed(2)}
**Recommendation:** ${judgment.assessment.recommendation}
**Reasoning:** ${judgment.assessment.reasoning}

**Extracted Insights:**
${judgment.extractedInsights.map((i) => `- ${i}`).join('\n') || 'None'}

**Suggested Category:** ${judgment.suggestedCategory}
**Suggested Tags:** ${judgment.suggestedTags.join(', ')}

## Knowledge Taxonomy

${formatTaxonomyForPrompt()}

## Instructions

Create a knowledge item with:
1. **title** - Clear, descriptive title (10-200 chars)
2. **summary** - Concise summary of key value (50-1000 chars)
3. **content** - Detailed content preserving important information (100-10000 chars)
4. **category** - Best matching category from taxonomy
5. **contentType** - Type of content (technique, pattern, tool, configuration, insight, example, reference)
6. **tags** - 1-10 relevant tags

Use the organize_knowledge tool to provide the structured output.`;
}

/**
 * Tool definition for structured organization output
 */
export const ORGANIZE_TOOL = {
  name: 'organize_knowledge',
  description: 'Organize content into a structured knowledge item',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        minLength: 10,
        maxLength: 200,
        description: 'Clear, descriptive title for the knowledge item',
      },
      summary: {
        type: 'string',
        minLength: 50,
        maxLength: 1000,
        description: 'Concise summary capturing the key value',
      },
      content: {
        type: 'string',
        minLength: 100,
        maxLength: 10000,
        description: 'Detailed content preserving important information',
      },
      category: {
        type: 'string',
        enum: [
          'context-engineering',
          'claude-code-skills',
          'subagents',
          'memory-management',
          'prompt-engineering',
          'tool-use',
          'workflow-automation',
          'best-practices',
          'other',
        ],
        description: 'Best matching category from the taxonomy',
      },
      contentType: {
        type: 'string',
        enum: [
          'technique',
          'pattern',
          'tool',
          'configuration',
          'insight',
          'example',
          'reference',
        ],
        description: 'Type of content',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 10,
        description: 'Relevant tags for searchability',
      },
    },
    required: ['title', 'summary', 'content', 'category', 'contentType', 'tags'],
  },
};
