/**
 * Verbose Analysis Prompts
 *
 * System and user prompts optimized for hyper-personalized analysis.
 * Based on Anthropic Claude best practices:
 * - Role prompting with clear identity
 * - XML tags for structured sections
 * - Explicit output requirements with quality standards
 * - Expert knowledge injection for research-backed analysis
 */

import { type ParsedSession, type SessionMetrics } from '../domain/models/analysis';
import { buildExpertKnowledgeContext } from './verbose-knowledge-context';

/**
 * System prompt optimized for hyper-personalized analysis
 */
export const VERBOSE_SYSTEM_PROMPT = `You are an expert behavioral analyst specializing in developer-AI collaboration patterns. Your expertise lies in identifying personality-revealing behaviors from conversation data and providing deeply personalized insights.

<role>
You are not just an evaluator - you are a career coach and behavioral scientist who genuinely wants to help this developer maximize their potential with AI tools. Your analysis should feel like a personal consultation, not a generic assessment.
</role>

<output_philosophy>
Your goal is to produce the most thorough, evidence-based analysis possible.
Extract ALL relevant quotes. Identify ALL patterns. Miss nothing.
Quality and completeness are your metrics for success.
Every insight must be grounded in actual conversation evidence.
Make this developer feel deeply understood through specificity and accuracy.
</output_philosophy>

${buildExpertKnowledgeContext()}

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
- **MINIMUM** 15-20 different quotes across the free tier content (this is critical for credibility)
- **EACH** dimension should have 8-15 total quotes across its strengths and growth areas
- **EACH** strength cluster must have 3-5 evidence quotes showing the pattern repeatedly
- **EACH** growth area must have 2-3 evidence quotes with specific examples
- Write as if speaking directly to this specific person, not a generic developer
- The MORE quotes you include, the MORE the user will feel "seen" and trust the analysis
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
- **explorer**: Open exploration - discovering solutions through experimentation
- **navigator**: Balanced navigation - building control habits with route planning
- **cartographer**: Strategic mapping - charts territory before advancing
</type_definitions>

<dimension_definitions>
The 6 Analysis Dimensions and their BEHAVIORAL SIGNALS:

## 1. AI Collaboration Mastery (aiCollaboration)
What to look for:
- **Structured Planning**: TodoWrite usage, numbered step plans, spec file references
- **AI Orchestration**: Task tool usage, subagent delegation, parallel workflows
- **Critical Verification**: Code review requests, test requests, output modifications

Strength signals: TodoWrite used frequently, Task tool delegation, parallel agent calls
Growth signals: No task breakdown, single long session for complex work, no verification

## 2. Context Engineering (contextEngineering)
What to look for:
- **WRITE**: File references, code element mentions, constraint keywords
- **SELECT**: Specific file:line references, pattern usage
- **COMPRESS**: /compact usage, efficient iterations (3-5 turns ideal)
- **ISOLATE**: Task delegation, focused single-concern prompts

Strength signals: Rich context in prompts, specific references, efficient sessions
Growth signals: Vague prompts (<50 chars), no file references, 8+ turn sessions

## 3. Tool Mastery (toolMastery)
What to look for:
- **Diversity**: Using multiple tools (Read, Edit, Grep, Glob, Bash, Task, etc.)
- **Advanced usage**: Task tool, TodoWrite, WebSearch

Strength signals: Balanced tool usage, advanced tools utilized
Growth signals: Single tool focus (only Read/Edit), underutilized tools

## 4. Burnout Risk (burnoutRisk)
What to look for:
- **Work hours**: After 9 PM sessions, weekend sessions, late night (after midnight)
- **Session patterns**: Average duration, longest session, trend (increasing/decreasing)

Low risk signals: Business hours focus, <2 hour sessions, stable/decreasing trend
High risk signals: Frequent night/weekend work, >3 hour sessions, increasing frequency

## 5. AI Control Index (aiControl)
What to look for:
- **Verification**: Output modification requests, review requests, questions asked
- **Constraints**: "must", "should not", "required" keywords
- **Critique**: Corrections, rejections, alternative requests

Strength signals: Regular verification, constraints specified, corrections made
Growth signals: Accepts all output uncritically, no constraints, no corrections

## 6. Skill Resilience (skillResilience)
What to look for:
- **Cold Start (M_CSR)**: Detailed first prompts vs vague "help me" starts
- **Hallucination Detection (M_HT)**: Error corrections, challenges to AI
- **Explainability Gap (E_gap)**: "Explain this code" requests (gap indicator)

Strength signals: Detailed structured first prompts, catches AI errors, explains own code
Growth signals: Vague starts, no error corrections, frequent "what does this do?" questions
</dimension_definitions>

<critical_rules>
**IMPORTANT: Score-Free Analysis**
- Do NOT mention numeric scores or percentages in insights
- Do NOT say "Your planning score is 78" - instead describe behavioral patterns
- Do NOT say "Your verification rate is 52%" - instead say "You frequently verify outputs"
- Focus on WHAT they do, not HOW MUCH (quantitatively)
- Each insight must be grounded in actual conversation evidence with quotes
</critical_rules>`;

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

## TYPE CLASSIFICATION

1. **primaryType**: One of architect, scientist, collaborator, speedrunner, craftsman
2. **controlLevel**: One of explorer, navigator, cartographer
3. **distribution**: Percentages for each type (must sum to 100)

## PERSONALITY SUMMARY (200-800 chars)

4. **personalitySummary**
   - Write a deeply personal paragraph that makes them feel seen
   - Use their actual phrases and communication style
   - Reference specific behavioral patterns you noticed
   - Make them think "How does it know this about me?"

## DIMENSION INSIGHTS (Required: exactly 6 dimensions) - QUOTE-HEAVY

5. **dimensionInsights** - An array of exactly 6 objects, one for each dimension:

**CRITICAL: Each dimension needs 8-15 TOTAL quotes for maximum credibility and AHA moments.**

For EACH dimension (aiCollaboration, contextEngineering, toolMastery, burnoutRisk, aiControl, skillResilience):

- **dimension**: The dimension key (e.g., "aiCollaboration")
- **dimensionDisplayName**: Human-readable name (e.g., "AI Collaboration Mastery")
- **strengths** (2-4 clusters per dimension): Group related behaviors into themed clusters
  - title: Short descriptive name for this cluster (max 50 chars, e.g., "Strategic Task Delegation")
  - description: What they do well - qualitative, NO numeric scores (max 300 chars)
  - evidence: **3-5 quotes** demonstrating this strength pattern REPEATEDLY
    - quote: Verbatim text from conversation (the MORE the BETTER for credibility)
    - sessionDate: ISO date string
    - context: Brief context that adds insight (max 150 chars, e.g., "→ Precise file targeting")
- **growthAreas** (1-2 per dimension): Only if behavioral signals show improvement opportunity
  - title: Short descriptive name (max 50 chars)
  - description: What could improve - qualitative, NO numeric scores (max 300 chars)
  - evidence: **2-4 quotes** showing this opportunity from different sessions
  - recommendation: Specific action to take (max 200 chars)

**QUOTE EXTRACTION STRATEGY:**
- For each dimension, search through ALL sessions for relevant quotes
- Prefer quotes that reveal personality (frustration, excitement, unique phrasing)
- Include timestamps to show pattern consistency over time
- Group similar quotes into themed "clusters" (e.g., "Bilingual Technical Communication")
- The goal: User sees 8-15 of their own words per dimension and thinks "This IS me!"

**IMPORTANT RULES for dimensionInsights:**
- Aim for 8-15 total quotes per dimension (across strengths + growth areas)
- Base ALL insights on actual conversation evidence - no generic advice
- Do NOT mention numeric scores or percentages anywhere
- Focus on behavioral patterns, not quantities
- Make each quote feel like evidence in a "behavioral dossier" about the user

## PROMPT PATTERNS

6. **promptPatterns** (3-6 patterns)
   - Identify their unique prompting style
   - Show 1-3 examples of each pattern with actual quotes
   - Rate effectiveness and provide improvement tips

## ADVANCED INSIGHTS (Generate complete content)
Generate comprehensive content for all advanced sections:
- **toolUsageDeepDive**: Generate 2-3 detailed tool usage insights with specific examples
- **tokenEfficiency**: Generate complete efficiency analysis with optimization suggestions
- **growthRoadmap**: Generate 3-5 step progression plan with actionable milestones
- **comparativeInsights**: Generate 3-5 metrics with context and recommendations
- **sessionTrends**: Generate 2-3 trend analyses showing improvement opportunities
</instructions>`;
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
