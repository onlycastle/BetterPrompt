/**
 * Gatherer Prompts
 *
 * LLM prompts for extracting metadata from gathered content.
 */

/**
 * System prompt for content extraction
 */
export const EXTRACTION_SYSTEM_PROMPT = `You are an AI engineering knowledge extractor. Your task is to analyze content about AI development and extract structured metadata.

Focus on identifying:
1. The main topic (context engineering, Claude Code skills, subagents, memory management, etc.)
2. Key insights that would help developers improve their AI collaboration
3. Any code snippets or configuration examples
4. Tools, frameworks, or techniques mentioned

Be concise and factual. Extract only what is explicitly stated or clearly implied.`;

/**
 * Build extraction prompt for content analysis
 */
export function buildExtractionPrompt(title: string, content: string): string {
  // Truncate very long content
  const maxContentLength = 6000;
  const truncatedContent =
    content.length > maxContentLength
      ? content.slice(0, maxContentLength) + '\n...[content truncated]'
      : content;

  return `Analyze this content and extract structured metadata.

## Title
${title}

## Content
${truncatedContent}

## Instructions
Extract the following information as JSON:

{
  "mainTopic": "primary topic category (context-engineering, claude-code-skills, subagents, memory-management, prompt-engineering, tool-use, workflow-automation, best-practices, or other)",
  "keyInsights": ["insight 1", "insight 2", ...],  // 1-5 main takeaways
  "codeSnippets": ["snippet 1", ...],  // code blocks if any (max 3)
  "referencedTools": ["tool1", "tool2", ...]  // tools/frameworks mentioned
}

Respond with only the JSON object, no additional text.`;
}

/**
 * Tool definition for structured extraction output
 */
export const EXTRACTION_TOOL = {
  name: 'extract_metadata',
  description: 'Extract structured metadata from AI engineering content',
  input_schema: {
    type: 'object' as const,
    properties: {
      mainTopic: {
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
        description: 'Primary topic category',
      },
      keyInsights: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 5,
        description: 'Key takeaways from the content',
      },
      codeSnippets: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 3,
        description: 'Code examples if present',
      },
      referencedTools: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tools, frameworks, or techniques mentioned',
      },
    },
    required: ['mainTopic', 'keyInsights', 'codeSnippets', 'referencedTools'],
  },
};
