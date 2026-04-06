/**
 * Session Evidence Extractor
 *
 * Extracts rich evidence context per user utterance from ParsedSession data.
 * Provides the concrete metrics, tool call sequences, and timestamps needed
 * to populate Evidence field moments in PEA growth areas.
 *
 * ## What this layer produces
 *
 * For each user utterance across all sessions, it builds an
 * `UtteranceEvidenceContext` containing:
 *
 * - `precedingToolSequence` — the AI's tool calls immediately before this utterance,
 *   with concrete parameters (file paths for Read/Edit, commands for Bash, patterns
 *   for Grep/Glob, URLs for WebFetch). Used to construct context anchors like
 *   "after reading src/auth.ts then running npm test".
 *
 * - `contextFillPercent` — how full the context window was at this point.
 *   Enables evidence like "sent this message when context was 87% full".
 *
 * - `cumulativeErrorCount` — total tool call errors accumulated in the session
 *   up to this utterance. Enables evidence like "the 4th tool failure in this session".
 *
 * - `sessionTurnNumber` — 1-indexed user turn within the session. Enables
 *   distinguishing "first message vs. 15th message in the session".
 *
 * - `sessionDurationAtTurnSec` — seconds elapsed since session start at this
 *   utterance. Enables temporal context: "after 45 minutes in the session".
 *
 * ## Usage
 *
 * ```typescript
 * const contexts = buildEvidenceContexts(sessions);
 * // Look up by utteranceId:
 * const ctx = contexts.find(c => c.utteranceId === 'sessId_12');
 * // ctx.precedingToolSequence => [{name: 'Read', detail: 'src/auth.ts'}, ...]
 * ```
 *
 * @module plugin/lib/core/evidence-extractor
 */

import type { ParsedSession, UtteranceEvidenceContext, ToolCallEvidence } from './types.js';
import { CONTEXT_WINDOW_SIZE } from './types.js';

// ============================================================================
// Constants
// ============================================================================

/** Skill injection prefix — same as in data-extractor to keep filters aligned */
const SKILL_INJECTION_PREFIX = 'Base directory for this skill:';

/** Max characters for Bash command in tool call detail */
const MAX_BASH_DETAIL_CHARS = 120;

/** Max characters for Task/Agent description/prompt detail */
const MAX_TASK_DETAIL_CHARS = 80;

/** Max characters for truncated error message */
const MAX_ERROR_TEXT_CHARS = 200;

/** Max characters for URL detail */
const MAX_URL_DETAIL_CHARS = 120;

// ============================================================================
// Tool Call Detail Extraction
// ============================================================================

/**
 * Extract a human-readable, concrete detail string from a tool call's input.
 *
 * Returns the most diagnostic piece of information for each tool type:
 * - Read/Edit/Write: the file path being operated on
 * - Grep: the search pattern (+ optional path)
 * - Glob: the glob pattern (+ optional path)
 * - Bash: the shell command (truncated)
 * - Task/Agent: the description/prompt (truncated)
 * - WebFetch: the URL being fetched (truncated)
 *
 * Returns undefined for unknown tool types or missing inputs.
 */
export function extractToolCallDetail(
  name: string,
  input: Record<string, unknown>,
): string | undefined {
  switch (name) {
    case 'Read':
    case 'Edit':
    case 'Write': {
      const fp = input['file_path'];
      return typeof fp === 'string' ? fp : undefined;
    }
    case 'Grep': {
      const pattern = input['pattern'];
      const path = input['path'];
      if (typeof pattern !== 'string') return undefined;
      const pathSuffix = typeof path === 'string' ? ` in ${path}` : '';
      return `${pattern}${pathSuffix}`;
    }
    case 'Glob': {
      const pattern = input['pattern'];
      const path = input['path'];
      if (typeof pattern !== 'string') return undefined;
      const pathSuffix = typeof path === 'string' ? ` in ${path}` : '';
      return `${pattern}${pathSuffix}`;
    }
    case 'Bash': {
      const command = input['command'];
      return typeof command === 'string'
        ? command.slice(0, MAX_BASH_DETAIL_CHARS)
        : undefined;
    }
    case 'Task':
    case 'Agent': {
      const desc = input['description'] ?? input['prompt'];
      return typeof desc === 'string' ? desc.slice(0, MAX_TASK_DETAIL_CHARS) : undefined;
    }
    case 'WebFetch': {
      const url = input['url'];
      return typeof url === 'string' ? url.slice(0, MAX_URL_DETAIL_CHARS) : undefined;
    }
    default:
      return undefined;
  }
}

// ============================================================================
// Message Analysis Helpers
// ============================================================================

/**
 * Determine whether a message is an analyzable user utterance.
 *
 * Mirrors the filter in data-extractor.ts to ensure consistent
 * utterance identification — the same messages that produce
 * UserUtterance records also produce UtteranceEvidenceContext records.
 */
function isAnalyzableUserMessage(
  message: ParsedSession['messages'][number],
): boolean {
  return (
    message.role === 'user' &&
    !message.isMeta &&
    typeof message.sourceToolUseID !== 'string' &&
    message.toolUseResult === undefined &&
    !message.content.trim().startsWith(SKILL_INJECTION_PREFIX)
  );
}

// ============================================================================
// Evidence Context Builder
// ============================================================================

/**
 * Build rich evidence contexts for all user utterances across all provided sessions.
 *
 * Processes sessions in order. For each session:
 * 1. Tracks cumulative tool errors and the most recent assistant message
 * 2. For each analyzable user utterance, creates an UtteranceEvidenceContext
 *    with the preceding AI response's tool call sequence, context fill, and metrics
 *
 * The returned array is ordered by session order and then by message index
 * within each session, matching the ordering of UserUtterance in Phase 1 output.
 *
 * @param sessions - Fully parsed sessions from the plugin scanner
 * @returns Ordered array of utterance evidence contexts
 */
export function buildEvidenceContexts(
  sessions: ParsedSession[],
): UtteranceEvidenceContext[] {
  const contexts: UtteranceEvidenceContext[] = [];

  for (const session of sessions) {
    // Parse session start time once for duration calculations
    const sessionStartMs = new Date(session.startTime).getTime();

    // State tracked across messages in this session
    let cumulativeErrors = 0;
    let userTurnNumber = 0;
    let precedingAssistantMessageIdx = -1; // index of last seen assistant message

    for (let messageIdx = 0; messageIdx < session.messages.length; messageIdx++) {
      const message = session.messages[messageIdx]!;

      if (message.role === 'assistant') {
        // Accumulate errors from this assistant's tool calls
        for (const toolCall of message.toolCalls ?? []) {
          if (toolCall.isError) {
            cumulativeErrors++;
          }
        }
        // Remember this assistant message as the most recent one
        precedingAssistantMessageIdx = messageIdx;

      } else if (isAnalyzableUserMessage(message)) {
        userTurnNumber++;

        // Utterance ID matches UserUtterance.id format from data-extractor.ts
        const utteranceId = `${session.sessionId}_${messageIdx}`;

        // ── Build preceding tool sequence ─────────────────────────────────
        const precedingToolSequence: ToolCallEvidence[] = [];

        if (precedingAssistantMessageIdx >= 0) {
          const assistantMsg = session.messages[precedingAssistantMessageIdx]!;

          for (const toolCall of assistantMsg.toolCalls ?? []) {
            const evidence: ToolCallEvidence = {
              name: toolCall.name,
            };

            const detail = extractToolCallDetail(toolCall.name, toolCall.input);
            if (detail !== undefined) {
              evidence.detail = detail;
            }

            if (toolCall.isError !== undefined) {
              evidence.isError = toolCall.isError;
            }

            // Include error text for failed tool calls (for specific error citations)
            if (toolCall.isError && typeof toolCall.result === 'string' && toolCall.result.length > 0) {
              evidence.errorText = toolCall.result.slice(0, MAX_ERROR_TEXT_CHARS);
            }

            precedingToolSequence.push(evidence);
          }
        }

        // ── Context fill percentage ───────────────────────────────────────
        let contextFillPercent: number | undefined;

        if (precedingAssistantMessageIdx >= 0) {
          const assistantMsg = session.messages[precedingAssistantMessageIdx]!;
          if (assistantMsg.tokenUsage?.input) {
            const rawPercent = (assistantMsg.tokenUsage.input / CONTEXT_WINDOW_SIZE) * 100;
            // Round to one decimal place, cap at 100%
            contextFillPercent = Math.min(100, Math.round(rawPercent * 10) / 10);
          }
        }

        // ── Session duration at this utterance ────────────────────────────
        let sessionDurationAtTurnSec: number | undefined;

        const messageMs = new Date(message.timestamp).getTime();
        if (Number.isFinite(messageMs) && Number.isFinite(sessionStartMs)) {
          sessionDurationAtTurnSec = Math.max(0, Math.round((messageMs - sessionStartMs) / 1000));
        }

        // ── Build context record ──────────────────────────────────────────
        const evidenceContext: UtteranceEvidenceContext = {
          utteranceId,
          sessionId: session.sessionId,
          timestamp: message.timestamp,
          precedingToolSequence,
          cumulativeErrorCount: cumulativeErrors,
          sessionTurnNumber: userTurnNumber,
        };

        if (contextFillPercent !== undefined) {
          evidenceContext.contextFillPercent = contextFillPercent;
        }
        if (sessionDurationAtTurnSec !== undefined) {
          evidenceContext.sessionDurationAtTurnSec = sessionDurationAtTurnSec;
        }

        contexts.push(evidenceContext);

        // Reset preceding assistant pointer so the NEXT user turn uses the NEXT
        // assistant response. This ensures each user turn gets exactly the
        // assistant response that immediately preceded it, not an earlier one.
        precedingAssistantMessageIdx = -1;
      }
    }
  }

  return contexts;
}

// ============================================================================
// Index Helpers
// ============================================================================

/**
 * Build a Map from utteranceId → UtteranceEvidenceContext for O(1) lookup.
 *
 * Use this when you need to look up evidence contexts by utteranceId repeatedly,
 * such as when enriching interaction snapshots with tool call details.
 *
 * @param contexts - Array from buildEvidenceContexts()
 * @returns Map keyed by utteranceId
 */
export function buildEvidenceContextIndex(
  contexts: UtteranceEvidenceContext[],
): Map<string, UtteranceEvidenceContext> {
  const index = new Map<string, UtteranceEvidenceContext>();
  for (const ctx of contexts) {
    index.set(ctx.utteranceId, ctx);
  }
  return index;
}

/**
 * Format a preceding tool sequence as a human-readable string for evidence context.
 *
 * Produces strings like:
 * - "after Read(src/auth.ts) then Bash(npm test)"
 * - "after Grep(isAuthenticated in src/)"
 * - "after Edit(middleware/auth.ts) [with 2 errors]"
 *
 * Returns an empty string when the sequence is empty.
 *
 * @param toolSequence - From UtteranceEvidenceContext.precedingToolSequence
 * @param maxTools - Maximum tools to include in the string (default 4)
 */
export function formatToolSequence(
  toolSequence: ToolCallEvidence[],
  maxTools = 4,
): string {
  if (toolSequence.length === 0) return '';

  const parts = toolSequence.slice(0, maxTools).map((tc) => {
    const detail = tc.detail ? `(${tc.detail})` : '';
    const errorFlag = tc.isError ? '✗' : '';
    return `${tc.name}${detail}${errorFlag}`;
  });

  const errorCount = toolSequence.filter((tc) => tc.isError).length;
  const errorSuffix = errorCount > 0 ? ` [${errorCount} error${errorCount > 1 ? 's' : ''}]` : '';
  const moreSuffix = toolSequence.length > maxTools
    ? ` +${toolSequence.length - maxTools} more`
    : '';

  return `after ${parts.join(' then ')}${errorSuffix}${moreSuffix}`;
}
