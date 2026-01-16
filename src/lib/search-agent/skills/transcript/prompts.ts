/**
 * Transcript Analysis Prompts
 *
 * LLM prompts and tool definitions for analyzing YouTube transcripts.
 */

import Anthropic from '@anthropic-ai/sdk';
import { YouTubeVideo } from './types';

/**
 * System prompt for transcript analysis
 */
export const TRANSCRIPT_ANALYSIS_SYSTEM_PROMPT = `You are an expert at analyzing video transcripts to extract insights about AI engineering, coding with AI assistants, and developer productivity.

Your role is to:
1. Identify key insights and techniques mentioned in the transcript
2. Extract practical advice that developers can apply
3. Note any code examples, tools, or frameworks discussed
4. Assess how relevant the content is to AI-assisted coding and development

Focus areas:
- Context engineering and prompt design
- Working with AI coding assistants (Claude, GPT, Copilot)
- Workflow automation and tool integration
- Best practices for AI-human collaboration
- Memory management and context optimization
- Multi-agent systems and orchestration

Be concise but comprehensive. Extract actionable insights that can help developers work more effectively with AI tools.`;

/**
 * Build user prompt for transcript analysis
 */
export function buildTranscriptAnalysisPrompt(
  video: YouTubeVideo,
  transcriptText: string
): string {
  return `Analyze this YouTube video transcript for AI engineering and coding insights.

VIDEO INFORMATION:
- Title: ${video.title}
- Channel: ${video.channelName}
- URL: ${video.url}

TRANSCRIPT:
${transcriptText.slice(0, 6000)}${transcriptText.length > 6000 ? '\n\n[... transcript truncated for analysis ...]' : ''}

Please analyze this transcript and extract:
1. A concise summary (2-4 sentences)
2. Key insights (practical takeaways)
3. Main topics covered
4. Any code examples or tools mentioned
5. Relevance score for AI coding (0-1)
6. Notable timestamps with specific insights (if identifiable from context)

Use the analyze_transcript tool to provide your structured analysis.`;
}

/**
 * Tool definition for transcript analysis
 */
export const TRANSCRIPT_ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'analyze_transcript',
  description: 'Analyze a YouTube transcript for AI engineering insights',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: {
        type: 'string',
        description: 'Concise summary of the video content (50-200 words)',
      },
      keyInsights: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key practical insights from the video (1-10 items)',
      },
      topics: {
        type: 'array',
        items: { type: 'string' },
        description: 'Main topics covered (e.g., "prompt-engineering", "context-management")',
      },
      codeExamples: {
        type: 'array',
        items: { type: 'string' },
        description: 'Code snippets or tool commands mentioned (if any)',
      },
      relevanceToAICoding: {
        type: 'number',
        description: 'How relevant is this to AI-assisted coding? (0.0 = not relevant, 1.0 = highly relevant)',
        minimum: 0,
        maximum: 1,
      },
      timestamps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            time: {
              type: 'number',
              description: 'Approximate time in seconds',
            },
            timeFormatted: {
              type: 'string',
              description: 'Time in MM:SS or HH:MM:SS format',
            },
            topic: {
              type: 'string',
              description: 'Topic discussed at this timestamp',
            },
            insight: {
              type: 'string',
              description: 'Key insight from this section',
            },
          },
          required: ['time', 'timeFormatted', 'topic', 'insight'],
        },
        description: 'Notable timestamps with specific insights (optional)',
      },
      recommendedFor: {
        type: 'array',
        items: { type: 'string' },
        description: 'Who would benefit most from this video (e.g., "beginners", "prompt-engineers", "architects")',
      },
    },
    required: ['summary', 'keyInsights', 'topics', 'codeExamples', 'relevanceToAICoding'],
  },
};

/**
 * System prompt for chunked transcript analysis (for long videos)
 */
export const CHUNKED_ANALYSIS_SYSTEM_PROMPT = `You are analyzing a section of a YouTube video transcript. Focus on extracting key insights from this specific portion.

Note: This is part of a longer transcript that will be analyzed in multiple sections.

Focus on:
- Any techniques, tools, or approaches mentioned
- Practical advice for developers
- Notable quotes or key points
- Code examples or configurations discussed`;

/**
 * Build prompt for analyzing a transcript chunk
 */
export function buildChunkAnalysisPrompt(
  video: YouTubeVideo,
  chunk: string,
  chunkIndex: number,
  totalChunks: number
): string {
  return `Analyze this section (${chunkIndex + 1}/${totalChunks}) of the transcript for "${video.title}".

TRANSCRIPT SECTION:
${chunk}

Extract key insights from this section. Focus on practical, actionable information related to AI engineering and coding.`;
}

/**
 * System prompt for combining chunk analyses
 */
export const COMBINE_ANALYSIS_SYSTEM_PROMPT = `You are combining multiple analyses of a YouTube video transcript into a single comprehensive summary.

Synthesize the insights from each section into a cohesive analysis, removing duplicates and highlighting the most important points.`;

/**
 * Build prompt for combining chunk analyses
 */
export function buildCombineAnalysisPrompt(
  video: YouTubeVideo,
  chunkAnalyses: string[]
): string {
  return `Combine these section analyses for "${video.title}" into a single comprehensive analysis.

SECTION ANALYSES:
${chunkAnalyses.map((a, i) => `--- Section ${i + 1} ---\n${a}`).join('\n\n')}

Synthesize these into a unified analysis using the analyze_transcript tool. Combine similar insights, remove duplicates, and create a comprehensive summary.`;
}
