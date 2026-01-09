# NoMoreAISlop - LLM Prompts Specification

> Version: 1.0.0
> Last Updated: 2026-01-09
> Status: Draft

---

## 1. Overview

This document specifies the prompts used to evaluate developer-AI collaboration quality. The prompts are designed to:

1. Provide clear evaluation criteria
2. Request structured JSON output
3. Ensure consistent, evidence-based ratings
4. Focus on growth rather than criticism

---

## 2. System Prompt

```
You are an expert evaluator of developer-AI collaboration quality. Your task is to analyze conversations between developers and Claude Code to assess how effectively the developer collaborates with AI.

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
4. **Be constructive**: Frame weaknesses as opportunities for growth
```

---

## 3. Evaluation Criteria

### 3.1 Planning

```
## Planning

**Definition**: The ability to clarify ambiguous requirements and provide specific, structured instructions to the AI.

### Strong Indicators (Positive Signals)

- Breaking complex tasks into smaller, manageable steps
- Specifying expected input/output formats clearly
- Mentioning edge cases or constraints before implementation
- Providing existing codebase context proactively
- Asking clarifying questions before jumping into implementation
- Setting clear acceptance criteria for the task
- Describing the "why" behind requirements, not just the "what"

### Growth Opportunities (Negative Signals)

- Vague prompts like "make it work", "fix this", or "do the thing"
- Missing context that the AI clearly needs to proceed
- Starting implementation without understanding requirements
- Not specifying error handling or edge case behavior
- Assuming AI knows project-specific conventions without explanation

### Rating Guidelines

- **Strong**: Consistently demonstrates 3+ positive signals, minimal negative signals
- **Developing**: Shows some positive signals, has clear opportunities for improvement
- **Needs Work**: Primarily vague prompts, minimal planning evidence
```

### 3.2 Critical Thinking

```
## Critical Thinking

**Definition**: The ability to recognize when AI suggestions are wrong, suboptimal, or inefficient, and to correct them.

### Strong Indicators (Positive Signals)

- Questioning the AI's approach or suggesting alternatives
- Identifying bugs or logic errors in AI-generated code
- Requesting improvements to initial suggestions
- Pointing out inefficiencies or better patterns
- Verifying AI output before accepting it
- Asking "what could go wrong?" or similar validation questions
- Catching security, performance, or maintainability issues

### Growth Opportunities (Negative Signals)

- Blindly accepting all AI suggestions without review
- Copy-pasting generated code without understanding it
- Not questioning approaches that seem overly complex
- Missing obvious bugs or issues in generated code
- Accepting first solution without considering alternatives

### Rating Guidelines

- **Strong**: Actively questions and improves AI suggestions, catches issues
- **Developing**: Sometimes questions AI, but misses some opportunities
- **Needs Work**: Rarely questions AI output, accepts most suggestions uncritically
```

### 3.3 Code Understanding

```
## Code Understanding

**Definition**: The ability to understand existing code and direct AI to leverage existing functions, patterns, and conventions.

### Strong Indicators (Positive Signals)

- Referencing existing functions or classes in prompts
- Asking AI to follow existing patterns in the codebase
- Providing relevant code context from other files
- Ensuring AI-generated code integrates with existing architecture
- Specifying file locations, module names, or import paths
- Pointing AI to existing utilities instead of reinventing
- Explaining project-specific naming conventions

### Growth Opportunities (Negative Signals)

- Creating duplicate functionality that already exists
- Ignoring established patterns in the codebase
- Not providing context about existing code structure
- Allowing AI to use inconsistent naming or styling
- Not connecting new code to existing modules appropriately

### Rating Guidelines

- **Strong**: Consistently references existing code, maintains patterns
- **Developing**: Sometimes provides context, occasionally misses opportunities
- **Needs Work**: Rarely references existing code, allows inconsistencies
```

---

## 4. User Prompt Template

```
Analyze the following conversation between a developer and Claude Code.

<conversation>
{conversation_content}
</conversation>

<session_metadata>
Duration: {duration_minutes} minutes
User Messages: {user_message_count}
Assistant Messages: {assistant_message_count}
Tool Calls: {tool_call_count}
Tools Used: {unique_tools_list}
</session_metadata>

## Your Task

Evaluate the developer's AI collaboration skills in three categories:

1. **Planning** - How well do they structure and communicate requirements?
2. **Critical Thinking** - How effectively do they evaluate and improve AI suggestions?
3. **Code Understanding** - How well do they leverage existing code and patterns?

## Output Requirements

For each category, provide:
1. A rating: `Strong`, `Developing`, or `Needs Work`
2. A summary (2-3 sentences explaining the rating)
3. 1-5 specific evidence items (quotes from the conversation with explanations)

Also provide:
4. An overall summary of the developer's collaboration style (3-5 sentences)
5. 1-5 specific, actionable recommendations for improvement

## Response Format

Respond with a valid JSON object matching this schema:

```json
{
  "planning": {
    "rating": "Strong" | "Developing" | "Needs Work",
    "summary": "2-3 sentence summary",
    "clues": [
      {
        "type": "positive" | "negative",
        "quote": "Exact quote from conversation",
        "explanation": "Why this is evidence for the rating"
      }
    ]
  },
  "criticalThinking": {
    "rating": "Strong" | "Developing" | "Needs Work",
    "summary": "2-3 sentence summary",
    "clues": [...]
  },
  "codeUnderstanding": {
    "rating": "Strong" | "Developing" | "Needs Work",
    "summary": "2-3 sentence summary",
    "clues": [...]
  },
  "overallSummary": "3-5 sentence overall assessment",
  "recommendations": [
    "Specific, actionable recommendation 1",
    "Specific, actionable recommendation 2"
  ]
}
```

## Important Notes

- Only use actual quotes from the conversation
- Be constructive and growth-focused
- Consider the session length and context
- A short session may have limited evidence - that's okay
- If a category has no clear evidence, default to "Developing" with a note
```

---

## 5. Conversation Formatting

### 5.1 Format Function

```typescript
function formatConversation(session: ParsedSession): string {
  const lines: string[] = [];

  for (const message of session.messages) {
    const role = message.role === 'user' ? 'DEVELOPER' : 'CLAUDE';
    const timestamp = message.timestamp.toISOString().slice(11, 19); // HH:MM:SS

    lines.push(`[${timestamp}] ${role}:`);

    if (message.content) {
      // Truncate very long messages
      const content = message.content.length > 2000
        ? message.content.slice(0, 2000) + '...[truncated]'
        : message.content;
      lines.push(content);
    }

    if (message.toolCalls?.length) {
      for (const tool of message.toolCalls) {
        lines.push(`  [Tool: ${tool.name}]`);
        if (tool.result) {
          const result = tool.result.length > 500
            ? tool.result.slice(0, 500) + '...[truncated]'
            : tool.result;
          lines.push(`  [Result: ${result}]`);
        }
      }
    }

    lines.push(''); // Blank line between messages
  }

  return lines.join('\n');
}
```

### 5.2 Example Formatted Conversation

```
[10:35:56] DEVELOPER:
I need to add a new endpoint for user profile updates. It should accept PATCH requests with partial user data.

[10:36:15] CLAUDE:
I'll help you create that endpoint. Let me first check the existing user routes to understand the pattern.
  [Tool: Read]
  [Result: // src/routes/users.ts ...]

Based on the existing pattern, I'll create a PATCH endpoint that validates partial updates.
  [Tool: Write]
  [Result: File written successfully]

[10:37:02] DEVELOPER:
Wait, we need to make sure the email field can't be updated through this endpoint - that should go through a separate verification flow.

[10:37:30] CLAUDE:
Good catch! I'll add validation to exclude the email field from partial updates.
  [Tool: Edit]
  [Result: File updated]
```

---

## 6. Response Parsing

### 6.1 Parsing Strategy

```typescript
async function parseEvaluationResponse(
  response: string,
  sessionId: string
): Promise<Evaluation> {
  // 1. Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new ParseError('No JSON object found in response');
  }

  // 2. Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new ParseError(`Invalid JSON: ${e.message}`);
  }

  // 3. Validate with Zod schema
  const result = EvaluationSchema.omit({
    sessionId: true,
    analyzedAt: true,
  }).safeParse(parsed);

  if (!result.success) {
    throw new ValidationError(
      `Schema validation failed: ${result.error.message}`
    );
  }

  // 4. Add metadata
  return {
    sessionId,
    analyzedAt: new Date().toISOString(),
    ...result.data,
  };
}
```

### 6.2 Error Recovery

```typescript
async function analyzeWithRetry(
  session: ParsedSession,
  maxRetries: number = 1
): Promise<Evaluation> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await callLLM(session);
      return await parseEvaluationResponse(response, session.sessionId);
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        console.warn(`Parse attempt ${attempt + 1} failed, retrying...`);
      }
    }
  }

  throw new AnalysisError(
    `Failed to parse evaluation after ${maxRetries + 1} attempts: ${lastError.message}`
  );
}
```

---

## 7. Token Management

### 7.1 Context Limits

| Component | Target Tokens | Max Tokens |
|-----------|---------------|------------|
| System Prompt | ~500 | 1,000 |
| Evaluation Criteria | ~800 | 1,500 |
| User Prompt Template | ~400 | 800 |
| Conversation Content | ~3,000 | 6,000 |
| **Total Input** | ~4,700 | 9,300 |
| Expected Output | ~1,000 | 2,000 |

### 7.2 Conversation Truncation

For sessions exceeding token limits:

```typescript
function truncateConversation(
  messages: ParsedMessage[],
  maxTokens: number = 6000
): ParsedMessage[] {
  // Estimate: 4 characters ≈ 1 token
  const estimateTokens = (text: string) => Math.ceil(text.length / 4);

  let totalTokens = 0;
  const selected: ParsedMessage[] = [];

  // Always include first and last few messages
  const firstN = 3;
  const lastN = 5;

  const first = messages.slice(0, firstN);
  const last = messages.slice(-lastN);
  const middle = messages.slice(firstN, -lastN);

  // Add first messages
  for (const msg of first) {
    totalTokens += estimateTokens(msg.content);
    selected.push(msg);
  }

  // Add last messages
  for (const msg of last) {
    totalTokens += estimateTokens(msg.content);
  }

  // Fill middle until limit
  for (const msg of middle) {
    const tokens = estimateTokens(msg.content);
    if (totalTokens + tokens > maxTokens) {
      selected.push({
        ...msg,
        content: '[... middle of conversation truncated for length ...]',
      });
      break;
    }
    totalTokens += tokens;
    selected.push(msg);
  }

  // Add last messages at end
  selected.push(...last);

  return selected;
}
```

---

## 8. Model Configuration

### 8.1 Recommended Settings

```typescript
const modelConfig = {
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 2000,
  temperature: 0.3,  // Lower for more consistent ratings
};
```

### 8.2 Model Selection Rationale

| Model | Pros | Cons |
|-------|------|------|
| Claude 3.5 Sonnet | Balanced cost/quality, good JSON output | - |
| Claude 3 Opus | Highest quality | Higher cost, slower |
| Claude 3 Haiku | Fast, cheap | May miss nuances |

**Recommendation**: Claude 3.5 Sonnet for best balance.

---

## 9. Edge Cases

### 9.1 Short Sessions

For sessions with < 5 messages:

```
Add to prompt:

Note: This is a short session with limited interactions.
Focus on the evidence available and avoid penalizing for
lack of opportunities to demonstrate skills.
```

### 9.2 Tool-Heavy Sessions

For sessions with mostly tool calls and little conversation:

```
Add to prompt:

Note: This session contains many tool operations but
limited conversational interaction. Base your evaluation
on the prompts that initiated the tool operations and
any feedback provided.
```

### 9.3 Error Recovery Sessions

For sessions focused on debugging AI mistakes:

```
Add to prompt:

Note: This session appears to involve correcting or
recovering from errors. Consider this context when
evaluating - error correction demonstrates critical
thinking even if the initial approach had issues.
```

---

## 10. Example Evaluations

### 10.1 Strong Example

**Session Summary**: Developer working on implementing authentication

**Conversation Highlights**:
- "Let me break this down: first we need the JWT utilities, then the middleware, finally the route protection."
- "Wait, this doesn't handle token expiration correctly. What happens when the token is expired?"
- "Use the same error format as our existing ApiError class in src/errors.ts"

**Expected Evaluation**:
```json
{
  "planning": {
    "rating": "Strong",
    "summary": "Excellent systematic breakdown of the authentication implementation into logical steps. Clear understanding of the sequence required.",
    "clues": [
      {
        "type": "positive",
        "quote": "Let me break this down: first we need the JWT utilities, then the middleware, finally the route protection.",
        "explanation": "Clear task decomposition with logical ordering"
      }
    ]
  },
  "criticalThinking": {
    "rating": "Strong",
    "summary": "Proactively identified edge cases and potential bugs before they became issues.",
    "clues": [
      {
        "type": "positive",
        "quote": "Wait, this doesn't handle token expiration correctly. What happens when the token is expired?",
        "explanation": "Caught a critical security edge case in token handling"
      }
    ]
  },
  "codeUnderstanding": {
    "rating": "Strong",
    "summary": "Consistently referenced existing code patterns and utilities.",
    "clues": [
      {
        "type": "positive",
        "quote": "Use the same error format as our existing ApiError class in src/errors.ts",
        "explanation": "Direct reference to existing error handling pattern"
      }
    ]
  }
}
```

### 10.2 Developing Example

**Session Summary**: Developer adding a new feature

**Conversation Highlights**:
- "Add a button that does the thing"
- "Actually, good point about the loading state"
- (No references to existing code patterns)

**Expected Evaluation**:
```json
{
  "planning": {
    "rating": "Needs Work",
    "summary": "Initial request was vague without specifying expected behavior or requirements.",
    "clues": [
      {
        "type": "negative",
        "quote": "Add a button that does the thing",
        "explanation": "Vague request lacking specifics about appearance, behavior, or location"
      }
    ]
  },
  "criticalThinking": {
    "rating": "Developing",
    "summary": "Showed some critical thinking when prompted, but didn't proactively identify issues.",
    "clues": [
      {
        "type": "positive",
        "quote": "Actually, good point about the loading state",
        "explanation": "Acknowledged and incorporated feedback about UX consideration"
      }
    ]
  },
  "codeUnderstanding": {
    "rating": "Developing",
    "summary": "Limited references to existing code patterns or utilities.",
    "clues": [
      {
        "type": "negative",
        "quote": "[No references to existing components or patterns]",
        "explanation": "Missed opportunity to reference existing button components or styling patterns"
      }
    ]
  }
}
```

---

## 11. Prompt Versioning

### 11.1 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-09 | Initial release |

### 11.2 A/B Testing

For future prompt improvements:

```typescript
interface PromptVersion {
  id: string;
  systemPrompt: string;
  userPromptTemplate: string;
  criteria: EvaluationCriteria;
}

// Track which version was used for each analysis
interface StoredAnalysis {
  // ...
  promptVersion: string;
}
```
