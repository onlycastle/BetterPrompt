import type { ParsedSession, ParsedMessage } from '../models/index.js';

/**
 * System prompt for the evaluation LLM
 */
export const SYSTEM_PROMPT = `You are an expert evaluator of developer-AI collaboration quality. Your task is to analyze conversations between developers and Claude Code to assess how effectively the developer collaborates with AI.

## Your Role

You are a supportive coach, not a harsh judge. Your goal is to help developers improve their AI collaboration skills by:
- Identifying what they do well
- Highlighting specific areas for growth
- Providing actionable, concrete recommendations

## Evaluation Philosophy

- **Evidence-based**: Every rating must be supported by specific quotes from the conversation
- **Growth-focused**: Use language that encourages improvement ("Developing" not "Weak")
- **Balanced**: Acknowledge both strengths and opportunities for growth
- **Specific**: Avoid vague feedback; reference actual conversation moments

## Important Guidelines

1. **Be fair**: A short session with few opportunities to demonstrate skills should not be penalized
2. **Consider context**: Some tasks naturally require less planning or critical thinking
3. **Quote accurately**: Only use actual text from the conversation as evidence
4. **Be constructive**: Frame weaknesses as opportunities for growth`;

/**
 * Evaluation criteria included in the prompt
 *
 * Updated based on verified research:
 * - VCP Paper (arXiv:2601.02410): Skill atrophy metrics
 * - Anthropic: Context engineering best practices
 * - MIT Technology Review: Vibe coding → context engineering shift
 * - Karpathy: New skill layer requirements
 */
export const EVALUATION_CRITERIA = `## Evaluation Categories

### Planning
**Definition**: The ability to clarify ambiguous requirements and provide specific, structured instructions to the AI.

**Strong Indicators (Positive Signals):**
- Breaking complex tasks into smaller, manageable steps
- Specifying expected input/output formats clearly
- Mentioning edge cases or constraints before implementation
- Providing existing codebase context proactively
- Asking clarifying questions before jumping into implementation
- Setting clear acceptance criteria for the task
- Describing the "why" behind requirements, not just the "what"
- **Using structured planning documents (spec.md, plan.md) before implementation**
- **"80% planning, 20% execution" approach - thorough upfront design**
- **Multi-phase plans with clear milestones and checkpoints**

**Growth Opportunities (Negative Signals):**
- Vague prompts like "make it work", "fix this", or "do the thing"
- Missing context that the AI clearly needs to proceed
- Starting implementation without understanding requirements
- Not specifying error handling or edge case behavior
- Assuming AI knows project-specific conventions without explanation
- **Diving into code without any plan or structure**
- **Letting AI drive the planning instead of directing it**

**Rating Guidelines:**
- **Strong**: Consistently demonstrates 3+ positive signals, minimal negative signals
- **Developing**: Shows some positive signals, has clear opportunities for improvement
- **Needs Work**: Primarily vague prompts, minimal planning evidence

### Critical Thinking
**Definition**: The ability to recognize when AI suggestions are wrong, suboptimal, or inefficient, and to correct them.

**Strong Indicators (Positive Signals):**
- Questioning the AI's approach or suggesting alternatives
- Identifying bugs or logic errors in AI-generated code
- Requesting improvements to initial suggestions
- Pointing out inefficiencies or better patterns
- Verifying AI output before accepting it
- Asking "what could go wrong?" or similar validation questions
- Catching security, performance, or maintainability issues
- **"Inverted TDD" approach: Writing tests first, then asking AI to implement**
- **Requesting alternative approaches before accepting the first solution**
- **Catching hallucinations and factual errors in AI output**
- **Challenging AI claims with "are you sure?" or verification requests**

**Growth Opportunities (Negative Signals):**
- Blindly accepting all AI suggestions without review
- Copy-pasting generated code without understanding it
- Not questioning approaches that seem overly complex
- Missing obvious bugs or issues in generated code
- Accepting first solution without considering alternatives
- **Never modifying or correcting AI output (professional developers modify ~50%)**
- **Not testing or validating AI-generated code before using it**

**Rating Guidelines:**
- **Strong**: Actively questions and improves AI suggestions, catches issues
- **Developing**: Sometimes questions AI, but misses some opportunities
- **Needs Work**: Rarely questions AI output, accepts most suggestions uncritically

### Code Understanding
**Definition**: The ability to understand existing code and direct AI to leverage existing functions, patterns, and conventions.

**Strong Indicators (Positive Signals):**
- Referencing existing functions or classes in prompts
- Asking AI to follow existing patterns in the codebase
- Providing relevant code context from other files
- Ensuring AI-generated code integrates with existing architecture
- Specifying file locations, module names, or import paths
- **Specifying exact file locations with line numbers (e.g., src/parser/index.ts:123)**
- **Mentioning specific class names, function names, or component names (e.g., "modify the SessionParser class")**
- **Using /compact command to efficiently manage context window**
- **Starting fresh sessions when context becomes polluted**
- **Using Task tool to delegate to specialized subagents**
- Pointing AI to existing utilities instead of reinventing
- Explaining project-specific naming conventions

**Growth Opportunities (Negative Signals):**
- Creating duplicate functionality that already exists
- Ignoring established patterns in the codebase
- Not providing context about existing code structure
- Allowing AI to use inconsistent naming or styling
- Not connecting new code to existing modules appropriately
- **Never referencing specific code locations or identifiers**
- **Not managing context window, leading to degraded AI performance**
- **Asking AI to explain code you should understand yourself (skill atrophy risk)**

**Rating Guidelines:**
- **Strong**: Consistently references existing code, maintains patterns
- **Developing**: Sometimes provides context, occasionally misses opportunities
- **Needs Work**: Rarely references existing code, allows inconsistencies`;

/**
 * Truncate text to a maximum length with suffix
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...[truncated]';
}

/**
 * Format a conversation for the LLM prompt
 */
export function formatConversation(session: ParsedSession): string {
  const lines: string[] = [];

  for (const message of session.messages) {
    const role = message.role === 'user' ? 'DEVELOPER' : 'CLAUDE';
    const timestamp = message.timestamp.toISOString().slice(11, 19); // HH:MM:SS

    lines.push(`[${timestamp}] ${role}:`);

    if (message.content) {
      lines.push(truncate(message.content, 2000));
    }

    if (message.toolCalls?.length) {
      for (const tool of message.toolCalls) {
        lines.push(`  [Tool: ${tool.name}]`);
        if (tool.result) {
          lines.push(`  [Result: ${truncate(tool.result, 500)}]`);
        }
      }
    }

    lines.push(''); // Blank line between messages
  }

  return lines.join('\n');
}

/**
 * Build the user prompt with conversation and metadata
 */
export function buildUserPrompt(session: ParsedSession): string {
  const conversation = formatConversation(session);
  const durationMinutes = Math.round(session.durationSeconds / 60);

  let contextNote = '';

  // Add context notes for edge cases
  if (session.stats.userMessageCount < 5) {
    contextNote = `
Note: This is a short session with limited interactions.
Focus on the evidence available and avoid penalizing for lack of opportunities to demonstrate skills.
`;
  } else if (
    session.stats.toolCallCount > session.stats.userMessageCount * 3
  ) {
    contextNote = `
Note: This session contains many tool operations but limited conversational interaction.
Base your evaluation on the prompts that initiated the tool operations and any feedback provided.
`;
  }

  return `Analyze the following conversation between a developer and Claude Code.

<conversation>
${conversation}
</conversation>

<session_metadata>
Duration: ${durationMinutes} minutes
User Messages: ${session.stats.userMessageCount}
Assistant Messages: ${session.stats.assistantMessageCount}
Tool Calls: ${session.stats.toolCallCount}
Tools Used: ${session.stats.uniqueToolsUsed.join(', ') || 'None'}
</session_metadata>
${contextNote}
${EVALUATION_CRITERIA}

## Your Task

Evaluate the developer's AI collaboration skills in three categories:

1. **Planning** - How well do they structure and communicate requirements?
2. **Critical Thinking** - How effectively do they evaluate and improve AI suggestions?
3. **Code Understanding** - How well do they leverage existing code and patterns?

## Output Requirements

For each category, provide:
1. A rating: \`Strong\`, \`Developing\`, or \`Needs Work\`
2. A summary (2-3 sentences explaining the rating)
3. 1-5 specific evidence items (quotes from the conversation with explanations)

Also provide:
4. An overall summary of the developer's collaboration style (3-5 sentences)
5. 1-5 specific, actionable recommendations for improvement

## Important Notes

- Only use actual quotes from the conversation
- Be constructive and growth-focused
- Consider the session length and context
- A short session may have limited evidence - that's okay
- If a category has no clear evidence, default to "Developing" with a note`;
}

/**
 * Estimate token count for a string (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: 4 characters ≈ 1 token
  return Math.ceil(text.length / 4);
}

/**
 * Truncate conversation to fit within token limits
 */
export function truncateConversation(
  messages: ParsedMessage[],
  maxTokens: number = 6000
): ParsedMessage[] {
  let totalTokens = 0;
  const selected: ParsedMessage[] = [];

  // Always include first and last few messages
  const firstN = 3;
  const lastN = 5;

  if (messages.length <= firstN + lastN) {
    return messages;
  }

  const first = messages.slice(0, firstN);
  const last = messages.slice(-lastN);
  const middle = messages.slice(firstN, -lastN);

  // Add first messages
  for (const msg of first) {
    totalTokens += estimateTokens(msg.content);
    selected.push(msg);
  }

  // Reserve tokens for last messages
  let lastTokens = 0;
  for (const msg of last) {
    lastTokens += estimateTokens(msg.content);
  }

  // Fill middle until limit
  const remainingTokens = maxTokens - lastTokens;
  let middleAdded = 0;

  for (const msg of middle) {
    const tokens = estimateTokens(msg.content);
    if (totalTokens + tokens > remainingTokens) {
      // Add truncation marker
      selected.push({
        ...msg,
        content: '[... middle of conversation truncated for length ...]',
      });
      break;
    }
    totalTokens += tokens;
    selected.push(msg);
    middleAdded++;
  }

  // Add last messages
  selected.push(...last);

  return selected;
}
