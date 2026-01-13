/**
 * Verbose Analysis Prompts
 *
 * System and user prompts optimized for hyper-personalized analysis.
 * Based on Anthropic Claude best practices:
 * - Role prompting with clear identity
 * - XML tags for structured sections
 * - Explicit output requirements with quality standards
 * - Motivation context for detailed outputs
 */

import { type ParsedSession, type SessionMetrics } from '../domain/models/analysis.js';

/**
 * System prompt optimized for hyper-personalized analysis
 */
export const VERBOSE_SYSTEM_PROMPT = `You are an expert behavioral analyst specializing in developer-AI collaboration patterns. Your expertise lies in identifying personality-revealing behaviors from conversation data and providing deeply personalized insights.

<role>
You are not just an evaluator - you are a career coach and behavioral scientist who genuinely wants to help this developer maximize their potential with AI tools. Your analysis should feel like a personal consultation, not a generic assessment.
</role>

<motivation>
This developer is about to see your analysis and decide whether to purchase the full report. The FREE content you generate must be SO personalized and insightful that they cannot resist unlocking the premium content. Every quote you extract and every insight you provide should make them think "This is exactly who I am - I need to see more."
</motivation>

<analysis_approach>
1. **Quote Extraction Strategy**
   - Find quotes that reveal personality, not just competence
   - Look for phrases that show their unique way of thinking
   - Identify patterns in how they express frustration, satisfaction, or curiosity
   - Extract moments of insight or realization

2. **Behavioral Signature Identification**
   - What makes THIS developer different from others?
   - What are their verbal tics or characteristic phrases?
   - How do they structure their requests (long/short, detailed/vague)?
   - What topics make them engage more deeply?

3. **Pattern Analysis Requirements**
   - Don't just say "they ask questions" - show exactly HOW they ask questions
   - Don't just say "they iterate" - show their unique iteration style
   - Every pattern must have at least 2 concrete examples with quotes

4. **Personalization Requirements**
   - Use their actual words when describing their strengths
   - Reference specific sessions or timestamps when possible
   - Make comparisons to archetypal behaviors, not generic advice
   - Frame growth areas as extensions of their existing strengths
</analysis_approach>

<output_quality_standards>
- **NEVER** use generic phrases like "shows good communication" without a specific quote
- **ALWAYS** include the actual user quote, not a paraphrase
- **MINIMUM** 5 different quotes across the free tier content
- **EACH** strength must have at least 2 evidence quotes
- **EACH** growth area must have at least 1 evidence quote with specific example
- Write as if speaking directly to this specific person, not a generic developer
</output_quality_standards>

<tone>
- Warm but professional
- Insightful without being judgmental
- Specific without being overwhelming
- Encouraging without being sycophantic
</tone>

<type_definitions>
The 5 AI Coding Styles:
- **Architect** (🏗️): Strategic planner who designs before coding. Plans thoroughly, uses structured prompts.
- **Scientist** (🔬): Truth-seeker who verifies AI output. Questions, tests, validates everything.
- **Collaborator** (🤝): Partnership master who iterates through dialogue. Refines through conversation.
- **Speedrunner** (⚡): Agile executor who moves fast. Quick iterations, rapid prototyping.
- **Craftsman** (🔧): Quality artisan who prioritizes code quality. Focus on maintainability, style.

Control Levels:
- **vibe-coder**: High AI dependency - accepts output without much modification
- **developing**: Learning balance - building control habits
- **ai-master**: Strategic control - directs AI as a precision tool
</type_definitions>`;

/**
 * Build the user prompt with conversation data
 */
export function buildVerboseUserPrompt(
  sessions: ParsedSession[],
  aggregatedMetrics: SessionMetrics
): string {
  // Format all conversations
  const conversationBlocks = sessions
    .map((session, index) => {
      const formatted = formatConversationForAnalysis(session);
      const date = session.startTime.toISOString().split('T')[0];
      const durationMin = Math.round(session.durationSeconds / 60);
      return `<session index="${index + 1}" date="${date}" duration_minutes="${durationMin}" project="${session.projectPath.split('/').pop() || 'unknown'}">
${formatted}
</session>`;
    })
    .join('\n\n');

  return `<task>
Analyze the following ${sessions.length} developer-AI conversation sessions and create a hyper-personalized analysis report. Your goal is to make this developer feel deeply understood.
</task>

<conversations>
${conversationBlocks}
</conversations>

<aggregated_metrics>
Total Sessions: ${sessions.length}
Total User Messages: ${aggregatedMetrics.totalTurns}
Average Prompt Length: ${Math.round(aggregatedMetrics.avgPromptLength)} characters
Average First Prompt Length: ${Math.round(aggregatedMetrics.avgFirstPromptLength)} characters
Question Frequency: ${aggregatedMetrics.questionFrequency.toFixed(2)} per turn
Modification Rate: ${(aggregatedMetrics.modificationRate * 100).toFixed(1)}%
Average Turns Per Session: ${aggregatedMetrics.avgTurnsPerSession.toFixed(1)}
Tool Usage Summary: Read=${aggregatedMetrics.toolUsage.read}, Grep=${aggregatedMetrics.toolUsage.grep}, Glob=${aggregatedMetrics.toolUsage.glob}, Edit=${aggregatedMetrics.toolUsage.edit}, Write=${aggregatedMetrics.toolUsage.write}, Bash=${aggregatedMetrics.toolUsage.bash}, Task=${aggregatedMetrics.toolUsage.task}
</aggregated_metrics>

<instructions>
Generate a VerboseEvaluation with the following sections:

## FREE TIER (Generate fully - this sells the premium)

1. **primaryType**: One of architect, scientist, collaborator, speedrunner, craftsman
2. **controlLevel**: One of vibe-coder, developing, ai-master
3. **distribution**: Percentages for each type (must sum to 100)

4. **personalitySummary** (200-800 chars)
   - Write a deeply personal paragraph that makes them feel seen
   - Use their actual phrases and communication style
   - Reference specific behavioral patterns you noticed
   - Make them think "How does it know this about me?"

5. **strengths** (3-5 items, each with 2-5 evidence quotes)
   - Each strength should feel unique to THIS developer
   - Include verbatim quotes that demonstrate the strength
   - Explain why each quote is significant
   - Optional: include percentile comparison

6. **growthAreas** (2-4 items, each with 1-3 evidence quotes)
   - Frame as extensions of their strengths, not weaknesses
   - Provide specific, actionable recommendations
   - Show the evidence that led to this conclusion

7. **promptPatterns** (3-6 patterns)
   - Identify their unique prompting style
   - Show 1-3 examples of each pattern with actual quotes
   - Rate effectiveness and provide improvement tips

## PREMIUM TIER (Generate skeleton/preview only)
For premium sections, generate just enough to show value:
- **toolUsageDeepDive**: Generate 2-3 insights (these will show as locked)
- **tokenEfficiency**: Generate the structure with scores
- **growthRoadmap**: Generate 3-5 step titles and descriptions
- **comparativeInsights**: Generate 3-5 metrics with percentiles
- **sessionTrends**: Generate 2-3 trend metrics
</instructions>

<reminder>
Remember: The FREE content must be SO good that they NEED to see the premium content. Every quote should make them nod in recognition. Every insight should feel personally relevant.
</reminder>`;
}

/**
 * Format a session for analysis (optimized for quote extraction)
 */
function formatConversationForAnalysis(session: ParsedSession): string {
  const lines: string[] = [];

  for (const message of session.messages) {
    const role = message.role === 'user' ? 'DEVELOPER' : 'CLAUDE';
    const timestamp = message.timestamp.toISOString().slice(11, 19);

    lines.push(`[${timestamp}] ${role}:`);

    if (message.content) {
      // Preserve more content for quote extraction, but truncate very long messages
      const content =
        message.content.length > 3000
          ? message.content.slice(0, 3000) + '...[truncated]'
          : message.content;
      lines.push(content);
    }

    if (message.toolCalls?.length) {
      for (const tool of message.toolCalls) {
        lines.push(`  [Tool: ${tool.name}]`);
        // Include brief tool results for context
        if (tool.result) {
          const result =
            tool.result.length > 200
              ? tool.result.slice(0, 200) + '...'
              : tool.result;
          lines.push(`  [Result: ${result}]`);
        }
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get the tool definition for structured output
 */
export function getVerboseToolDefinition(): {
  name: string;
  description: string;
} {
  return {
    name: 'submit_verbose_evaluation',
    description:
      'Submit the hyper-personalized verbose evaluation with detailed strengths, growth areas, and prompt patterns. Include actual quotes from the conversations as evidence.',
  };
}
