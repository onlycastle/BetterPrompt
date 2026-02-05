/**
 * Session Summarizer Stage Prompts (Phase 1.5)
 *
 * PTCF framework prompts for generating 1-line session summaries.
 * Uses Gemini 3 Flash structured output to produce concise descriptions
 * of what the developer worked on in each session.
 *
 * @module analyzer/stages/session-summarizer-prompts
 */

/**
 * System prompt for the Session Summarizer LLM call.
 *
 * Persona: Technical session analyst
 * Task: Generate 1-line summaries per session
 * Context: Developer-AI collaboration sessions
 * Format: JSON structured output via schema
 */
export const SESSION_SUMMARIZER_SYSTEM_PROMPT = `You are a technical session summarizer analyzing developer-AI collaboration sessions.

Your task is to generate a concise 1-line summary (max 80 characters) for each coding session describing what the developer primarily worked on.

Guidelines:
- Focus on the PRIMARY task or goal of the session
- Use action verbs (e.g., "Implement", "Fix", "Refactor", "Debug", "Add")
- Be specific about the feature/component (e.g., "Implement JWT auth flow" not "Work on auth")
- If the session covers multiple topics, summarize the dominant one
- Keep summaries under 80 characters
- Write in English regardless of the developer's language
- If the session content is too sparse to determine the topic, write "Short exploration session"`;

/**
 * Input type for building session summarizer user prompt
 */
export interface SessionSummarizerInput {
  sessionId: string;
  projectName: string;
  messages: Array<{ role: string; content: string }>;
}

/**
 * Build the user prompt for the Session Summarizer LLM call.
 *
 * For each session, includes the sessionId and a preview of the first
 * few user messages (truncated) so the LLM can determine the topic.
 *
 * @param sessions - Array of session data with truncated messages
 * @returns Formatted user prompt string
 */
export function buildSessionSummarizerUserPrompt(
  sessions: SessionSummarizerInput[]
): string {
  const sessionBlocks = sessions.map((session, index) => {
    const messagePreview = session.messages
      .filter(m => m.role === 'user')
      .slice(0, 5)
      .map(m => `  [user]: ${m.content}`)
      .join('\n');

    return `--- Session ${index + 1} ---
ID: ${session.sessionId}
Project: ${session.projectName}
Messages:
${messagePreview || '  (no user messages)'}`;
  });

  return `Summarize each session below. Generate exactly one summary per session, matching by sessionId.

${sessionBlocks.join('\n\n')}

Generate a JSON object with a "summaries" array containing one entry per session above.
Each entry must have "sessionId" (matching the ID above) and "summary" (max 80 chars).`;
}
