/**
 * Data Extractor - Deterministic Phase 1 extraction from parsed sessions
 *
 * Accepts canonical parsed sessions and produces the plugin Phase 1 artifact.
 * Full parsed sessions are preserved on the output so downstream stages keep
 * transcript access while the extracted utterance layer remains deterministic.
 *
 * @module plugin/lib/core/data-extractor
 */

import type {
  UserUtterance,
  AIInsightBlock,
  Phase1Output,
  Phase1SessionMetrics,
  FrictionSignals,
  SessionHints,
  ExpertSignals,
  ParsedSession,
} from './types.js';
import { CONTEXT_WINDOW_SIZE } from './types.js';
import { stripSystemTags } from '../scanner/strip-system-tags.js';

// ============================================================================
// Constants
// ============================================================================

const MAX_TEXT_LENGTH = 2000;
const SKILL_INJECTION_PREFIX = 'Base directory for this skill:';
/** Known slash commands (prevents false positives from file paths) */
const KNOWN_SLASH_COMMANDS = new Set([
  'plan', 'review', 'commit', 'compact', 'clear', 'help', 'init',
  'sisyphus', 'orchestrator', 'ultrawork', 'ralph-loop', 'deepsearch',
  'analyze', 'prometheus', 'cancel-ralph', 'update',
  'bug', 'config', 'cost', 'doctor', 'login', 'logout', 'memory',
  'model', 'permissions', 'project', 'status', 'terminal-setup',
  'vim', 'fast',
]);

/** Patterns for /clear command detection */
const CLEAR_COMMAND_PATTERNS = [
  /^\/clear\b/m,
  /<command-name>\/clear<\/command-name>/,
];

/** Insight block regex */
const INSIGHT_BLOCK_PATTERN = /`★\s*Insight\s*─+`\n([\s\S]*?)\n`─+`/g;

// ============================================================================
// Text Utilities
// ============================================================================

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '... [truncated]';
}

function countWords(text: string): number {
  const cleaned = text.replace(/```[\s\S]*?```/g, '').trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(w => w.length > 0).length;
}

function hasCodeBlock(text: string): boolean {
  return /```/.test(text);
}

function hasQuestion(text: string): boolean {
  return /\?/.test(text);
}

function isContinuation(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return /^(continue|go ahead|proceed|keep going|next|yes|ok|okay|sure|do it|let's go)/i.test(lower);
}

function isClearCommand(content: string): boolean {
  return CLEAR_COMMAND_PATTERNS.some(p => p.test(content));
}

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function hasTaggedSlashCommand(rawContent: string): boolean {
  return /<command-name>\/[\w:-]+<\/command-name>/.test(rawContent);
}

function looksLikeCommandExpansionBody(text: string): boolean {
  const trimmed = text.trim();

  if (/^\[[A-Z0-9 _-]+ ACTIVATED\]/.test(trimmed)) {
    return true;
  }

  const markdownHeadings = countMatches(trimmed, /^#{1,6}\s+/gm);
  const listItems = countMatches(trimmed, /^[-*+]\s+/gm) + countMatches(trimmed, /^\d+\.\s+/gm);
  const hasCodeFence = /```/.test(trimmed);
  const mentionsWorkflowInstructions = /(How Ralph Loop Works|Complete Shipping Workflow|Error Handling|Quick Reference|Begin working on the task|output <promise>DONE<\/promise>|output `<promise>DONE<\/promise>`)/i.test(trimmed);

  return trimmed.length >= 150
    && (mentionsWorkflowInstructions || markdownHeadings >= 2 || hasCodeFence)
    && (markdownHeadings + listItems >= 4 || hasCodeFence);
}

function isLikelyExpandedSkillDocument(
  message: RawSessionData['messages'][number],
  previousMessages: Array<RawSessionData['messages'][number]>,
): boolean {
  const trimmed = message.rawContent.trim();

  if (trimmed.startsWith(SKILL_INJECTION_PREFIX)) {
    return true;
  }

  if (previousMessages.length === 0) {
    return false;
  }

  const hasSameTimestampSlashCommand = previousMessages.some(previousMessage =>
    previousMessage.role === 'user'
    && previousMessage.timestamp.getTime() === message.timestamp.getTime()
    && hasTaggedSlashCommand(previousMessage.rawContent),
  );
  if (!hasSameTimestampSlashCommand) {
    return false;
  }

  return looksLikeCommandExpansionBody(trimmed);
}

// ============================================================================
// Slash Command Extraction
// ============================================================================

function extractSlashCommands(rawContent: string): string[] {
  const commands: string[] = [];

  // XML-tagged commands (always trusted)
  const xmlPattern = /<command-name>\/([\w-]+)<\/command-name>/g;
  let match;
  while ((match = xmlPattern.exec(rawContent)) !== null) {
    commands.push(match[1]!);
  }

  // Plain-text `/xxx` at line start (whitelist-matched only)
  const plainPattern = /^\/(\w[\w-]*)/gm;
  while ((match = plainPattern.exec(rawContent)) !== null) {
    const cmd = match[1]!;
    if (KNOWN_SLASH_COMMANDS.has(cmd)) {
      commands.push(cmd);
    }
  }

  return commands;
}

// ============================================================================
// Content Extraction Helpers
// ============================================================================

/** Extract text content from JSONL message content field */
function extractTextFromContent(content: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === 'string') return content;
  return content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map(block => block.text)
    .join('\n');
}

/** Check if assistant response had errors (tool_result with is_error) */
function assistantHadError(
  assistantContent: Array<{ type: string; is_error?: boolean }>,
): boolean {
  return assistantContent.some(block => block.type === 'tool_result' && block.is_error);
}

/** Get tool call names from assistant response */
function extractToolCallNames(
  assistantContent: Array<{ type: string; name?: string }>,
): string[] {
  return assistantContent
    .filter((block): block is { type: 'tool_use'; name: string } => block.type === 'tool_use')
    .map(block => block.name);
}

// ============================================================================
// Friction Signal Detection
// ============================================================================

const REJECTION_PATTERNS = [
  /\bno\b/i, /\bwrong\b/i, /\bincorrect\b/i, /\btry again\b/i,
  /\bthat's not right\b/i, /\bnot what i/i, /\bdon't\b.*\bthat\b/i,
  /\bundo\b/i, /\brevert\b/i,
];

const FRUSTRATION_PATTERNS = [
  /\bagain\b/i, /\bstill not working\b/i, /\bsame error\b/i,
  /\bfrustrat/i, /\bugh\b/i, /\bwhy (won't|doesn't|isn't)/i,
];

function isRejection(text: string): boolean {
  const lower = text.toLowerCase();
  if (lower.length > 200) return false;
  return REJECTION_PATTERNS.some(p => p.test(lower));
}

function isFrustration(text: string): boolean {
  return FRUSTRATION_PATTERNS.some(p => p.test(text));
}

// ============================================================================
// Session Processing
// ============================================================================

interface RawSessionData {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    rawContent: string;
    content: Array<{ type: string; text?: string; name?: string; is_error?: boolean; id?: string; tool_use_id?: string; content?: string | unknown[] }>;
    timestamp: Date;
    isMeta?: boolean;
    sourceToolUseID?: string;
    toolUseResult?: unknown;
    tokenUsage?: { input: number; output: number };
  }>;
}

function isAnalyzableUserMessage(
  message: RawSessionData['messages'][number],
): boolean {
  const isSkillInjectedPrompt = message.rawContent.trim().startsWith(SKILL_INJECTION_PREFIX);

  return message.role === 'user'
    && !message.isMeta
    && typeof message.sourceToolUseID !== 'string'
    && message.toolUseResult === undefined
    && !isSkillInjectedPrompt;
}

function toRawSessionData(session: ParsedSession): RawSessionData {
  return {
    sessionId: session.sessionId,
    messages: session.messages.map(message => {
      if (message.role === 'user') {
        return {
          role: 'user',
          rawContent: message.content,
          content: [{ type: 'text', text: message.content }],
          timestamp: new Date(message.timestamp),
          ...(message.isMeta ? { isMeta: true } : {}),
          ...(typeof message.sourceToolUseID === 'string'
            ? { sourceToolUseID: message.sourceToolUseID }
            : {}),
          ...(message.toolUseResult !== undefined ? { toolUseResult: message.toolUseResult } : {}),
        };
      }

      const content: RawSessionData['messages'][0]['content'] = [];
      if (message.content) {
        content.push({ type: 'text', text: message.content });
      }
      for (const toolCall of message.toolCalls ?? []) {
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.name,
        });
        if (toolCall.result !== undefined) {
          content.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: toolCall.result,
            is_error: toolCall.isError,
          });
        }
      }

      return {
        role: 'assistant',
        rawContent: message.content,
        content,
        timestamp: new Date(message.timestamp),
        tokenUsage: message.tokenUsage,
      };
    }),
  };
}

/** Extract utterances from a single session */
function extractFromSession(session: RawSessionData): {
  utterances: UserUtterance[];
  slashCommands: string[];
  insightBlocks: AIInsightBlock[];
} {
  const utterances: UserUtterance[] = [];
  const slashCommands: string[] = [];
  const insightBlocks: AIInsightBlock[] = [];
  const seenKeys = new Set<string>();

  let precedingAssistantContent: RawSessionData['messages'][0]['content'] | null = null;

  for (let i = 0; i < session.messages.length; i++) {
    const message = session.messages[i]!;
    const previousMessages = session.messages.slice(0, i);

    if (message.role === 'user') {
      if (!isAnalyzableUserMessage(message)) {
        precedingAssistantContent = null;
        continue;
      }

      // Extract slash commands from raw content BEFORE stripping
      const rawText = extractTextFromContent(
        message.content as unknown as string | Array<{ type: string; text?: string }>,
      );
      slashCommands.push(...extractSlashCommands(message.rawContent || rawText));

      // Skip /clear commands
      if (isClearCommand(rawText)) {
        precedingAssistantContent = null;
        continue;
      }

      if (isLikelyExpandedSkillDocument(message, previousMessages)) {
        precedingAssistantContent = null;
        continue;
      }

      // Strip system tags
      const cleanText = stripSystemTags(rawText);
      if (!cleanText.trim()) continue;

      // Deduplication
      const dedupeKey = `${message.timestamp.toISOString()}|${cleanText.slice(0, 200)}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      const text = truncateText(cleanText, MAX_TEXT_LENGTH);
      const id = `${session.sessionId}_${i}`;

      utterances.push({
        id,
        text,
        timestamp: message.timestamp.toISOString(),
        sessionId: session.sessionId,
        turnIndex: i,
        characterCount: cleanText.length,
        wordCount: countWords(cleanText),
        hasCodeBlock: hasCodeBlock(cleanText),
        hasQuestion: hasQuestion(cleanText),
        isSessionStart: utterances.length === 0,
        isContinuation: isContinuation(cleanText),
        precedingAIToolCalls: precedingAssistantContent
          ? extractToolCallNames(precedingAssistantContent)
          : undefined,
        precedingAIHadError: precedingAssistantContent
          ? assistantHadError(precedingAssistantContent)
          : undefined,
      });

      precedingAssistantContent = null;
    } else if (message.role === 'assistant') {
      precedingAssistantContent = message.content;

      // Extract insight blocks from assistant text
      const assistantText = message.content
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map(b => b.text)
        .join('\n');

      let match;
      const pattern = new RegExp(INSIGHT_BLOCK_PATTERN.source, 'g');
      while ((match = pattern.exec(assistantText)) !== null) {
        const content = match[1]!.trim().slice(0, 500);
        if (content) {
          insightBlocks.push({
            sessionId: session.sessionId,
            turnIndex: i,
            content,
            triggeringUtteranceId: utterances.length > 0
              ? utterances[utterances.length - 1]!.id
              : undefined,
          });
        }
      }
    }
  }

  return { utterances, slashCommands, insightBlocks };
}

// ============================================================================
// Metrics Computation
// ============================================================================

function computeFrictionSignals(
  sessions: RawSessionData[],
  utterances: UserUtterance[],
): FrictionSignals {
  let toolFailureCount = 0;
  let userRejectionSignals = 0;
  let excessiveIterationSessions = 0;
  let contextOverflowSessions = 0;
  let frustrationExpressionCount = 0;
  let bareRetryAfterErrorCount = 0;
  let errorChainMaxLength = 0;

  // Count tool failures and context overflows per session
  for (const session of sessions) {
    let sessionUserMessages = 0;
    let sessionHadOverflow = false;
    let currentErrorChain = 0;

    for (const message of session.messages) {
      if (isAnalyzableUserMessage(message)) {
        sessionUserMessages++;
      } else if (message.role === 'assistant') {
        // Count tool failures
        for (const block of message.content) {
          if (block.type === 'tool_result' && block.is_error) {
            toolFailureCount++;
            currentErrorChain++;
            errorChainMaxLength = Math.max(errorChainMaxLength, currentErrorChain);
          }
        }
        // Check context overflow
        if (message.tokenUsage && message.tokenUsage.input / CONTEXT_WINDOW_SIZE >= 0.9) {
          sessionHadOverflow = true;
        }
      }
      // Reset error chain on non-error
      if (message.role === 'assistant') {
        const hasError = message.content.some(b => b.type === 'tool_result' && b.is_error);
        if (!hasError) currentErrorChain = 0;
      }
    }

    if (sessionUserMessages >= 10) excessiveIterationSessions++;
    if (sessionHadOverflow) contextOverflowSessions++;
  }

  // Count rejection/frustration from utterances
  for (const u of utterances) {
    if (isRejection(u.text)) userRejectionSignals++;
    if (isFrustration(u.text)) frustrationExpressionCount++;
    // Bare retry: short message after error
    if (u.precedingAIHadError && u.wordCount < 10) {
      bareRetryAfterErrorCount++;
    }
  }

  // Count repeated tool error patterns (simplified fingerprinting)
  const errorPatterns = new Map<string, number>();
  for (const session of sessions) {
    for (const message of session.messages) {
      if (message.role === 'assistant') {
        for (const block of message.content) {
          if (block.type === 'tool_result' && block.is_error) {
            const errText = typeof block.content === 'string' ? block.content : '';
            // Fingerprint: remove paths and timestamps
            const fingerprint = errText
              .replace(/\/[\w/.-]+/g, '<path>')
              .replace(/\d{4}-\d{2}-\d{2}/g, '<date>')
              .slice(0, 100);
            errorPatterns.set(fingerprint, (errorPatterns.get(fingerprint) ?? 0) + 1);
          }
        }
      }
    }
  }
  const repeatedToolErrorPatterns = [...errorPatterns.values()].filter(c => c >= 2).length;

  return {
    toolFailureCount,
    userRejectionSignals,
    excessiveIterationSessions,
    contextOverflowSessions,
    frustrationExpressionCount,
    repeatedToolErrorPatterns,
    bareRetryAfterErrorCount,
    errorChainMaxLength,
  };
}

function computeSessionHints(sessions: RawSessionData[]): SessionHints {
  let totalUserTurns = 0;
  let shortSessions = 0;
  let mediumSessions = 0;
  let longSessions = 0;

  for (const session of sessions) {
    const userTurns = session.messages.filter(isAnalyzableUserMessage).length;
    totalUserTurns += userTurns;

    if (userTurns <= 3) shortSessions++;
    else if (userTurns <= 10) mediumSessions++;
    else longSessions++;
  }

  return {
    avgTurnsPerSession: sessions.length > 0 ? totalUserTurns / sessions.length : 0,
    shortSessions,
    mediumSessions,
    longSessions,
  };
}

function computeContextFillMetrics(
  sessions: RawSessionData[],
): {
  avgContextFillPercent?: number;
  maxContextFillPercent?: number;
  contextFillExceeded90Count?: number;
} {
  const fillPercentages: number[] = [];

  for (const session of sessions) {
    for (const message of session.messages) {
      if (message.role === 'assistant' && message.tokenUsage?.input) {
        fillPercentages.push((message.tokenUsage.input / CONTEXT_WINDOW_SIZE) * 100);
      }
    }
  }

  if (fillPercentages.length === 0) return {};

  const avgFill = fillPercentages.reduce((sum, p) => sum + p, 0) / fillPercentages.length;
  const maxFill = Math.max(...fillPercentages);

  return {
    avgContextFillPercent: Math.round(avgFill * 10) / 10,
    maxContextFillPercent: Math.round(maxFill * 10) / 10,
    contextFillExceeded90Count: fillPercentages.filter(p => p >= 90).length,
  };
}

// ============================================================================
// Expert Signal Detection (Claude Code internal patterns)
// ============================================================================

/** Patterns indicating CLAUDE.md usage or authoring */
const CLAUDE_MD_PATTERNS = [
  /CLAUDE\.md/i,
  /claude\.md/,
  /\.claude\/CLAUDE\.md/,
  /CLAUDE\.local\.md/i,
];

/** Patterns indicating scoped rule usage */
const SCOPED_RULE_PATTERNS = [
  /\.claude\/rules\//,
  /scoped rule/i,
  /path-scoped/i,
];

/** Patterns indicating hook awareness */
const HOOK_PATTERNS = [
  /\bhook/i,
  /PreToolUse/,
  /PostToolUse/,
  /SessionStart/,
  /SessionEnd/,
  /settings\.json.*hook/i,
  /hook.*settings/i,
];

/** Patterns indicating verification behavior */
const VERIFICATION_PATTERNS = [
  /are you sure/i,
  /did you (check|verify|test)/i,
  /run the tests/i,
  /write tests? (for|first)/i,
  /let me (check|verify|review)/i,
  /can you (verify|confirm|check)/i,
  /does (this|that|it) (work|pass|compile)/i,
];

/** Patterns indicating structured cold start */
const STRUCTURED_START_PATTERNS = [
  /here'?s (the|my) (task|goal|requirement)/i,
  /context:/i,
  /constraint/i,
  /requirements?:/i,
  /objective:/i,
  /background:/i,
  /the goal is/i,
  /i need (you to|to)/i,
];

/** Bash commands that should use dedicated tools */
const BASH_MISUSE_PATTERNS = [
  /\bcat\s+[^\s|;]+/,
  /\bhead\s+/,
  /\btail\s+/,
  /\bgrep\s+/,
  /\brg\s+/,
  /\bfind\s+\./,
  /\bls\s+/,
  /\bsed\s+/,
  /\bawk\s+/,
];

function computeExpertSignals(
  sessions: RawSessionData[],
  utterances: UserUtterance[],
): ExpertSignals {
  let claudeMdReferences = 0;
  let scopedRuleReferences = 0;
  let hookReferences = 0;
  let skillInvocations = 0;
  let bashMisuseCount = 0;
  let taskDelegationCount = 0;
  let structuredColdStartCount = 0;
  let freshSessionAfterFailureCount = 0;
  let errorChainBreakCount = 0;
  let verificationRequestCount = 0;

  let totalToolCalls = 0;
  let properToolCalls = 0;

  // Track sessions that ended with errors for fresh-start detection
  const sessionsEndedWithError = new Set<number>();

  for (let sIdx = 0; sIdx < sessions.length; sIdx++) {
    const session = sessions[sIdx]!;
    let sessionHadError = false;
    let consecutiveErrors = 0;
    let isFirstUserMessage = true;

    for (const message of session.messages) {
      if (message.role === 'user' && isAnalyzableUserMessage(message)) {
        const text = message.rawContent;

        // CLAUDE.md reference detection
        if (CLAUDE_MD_PATTERNS.some(p => p.test(text))) claudeMdReferences++;

        // Scoped rule detection
        if (SCOPED_RULE_PATTERNS.some(p => p.test(text))) scopedRuleReferences++;

        // Hook awareness detection
        if (HOOK_PATTERNS.some(p => p.test(text))) hookReferences++;

        // Verification request detection
        if (VERIFICATION_PATTERNS.some(p => p.test(text))) verificationRequestCount++;

        // Structured cold start detection
        if (isFirstUserMessage) {
          const matchCount = STRUCTURED_START_PATTERNS.filter(p => p.test(text)).length;
          if (matchCount >= 2 || text.length >= 200) {
            structuredColdStartCount++;
          }
          isFirstUserMessage = false;
        }

        // Error chain break detection (strategy change after errors)
        if (consecutiveErrors >= 2 && text.length > 50) {
          errorChainBreakCount++;
          consecutiveErrors = 0;
        }
      } else if (message.role === 'assistant') {
        // Track tool usage for proper selection scoring
        for (const block of message.content) {
          if (block.type === 'tool_use' && block.name) {
            totalToolCalls++;

            // Check if proper tool was used
            if (['Read', 'Edit', 'Write', 'Grep', 'Glob'].includes(block.name)) {
              properToolCalls++;
            } else if (block.name === 'Bash') {
              // Check for bash misuse in the preceding user message
              const precedingUser = [...session.messages]
                .slice(0, session.messages.indexOf(message))
                .reverse()
                .find(m => m.role === 'user');
              if (precedingUser && BASH_MISUSE_PATTERNS.some(p => p.test(precedingUser.rawContent))) {
                bashMisuseCount++;
              }
            } else if (block.name === 'Task' || block.name === 'Agent') {
              taskDelegationCount++;
            }
          }

          // Track errors for chain detection
          if (block.type === 'tool_result' && block.is_error) {
            consecutiveErrors++;
            sessionHadError = true;
          } else if (block.type === 'tool_result' && !block.is_error) {
            consecutiveErrors = 0;
          }
        }
      }
    }

    if (sessionHadError) sessionsEndedWithError.add(sIdx);
  }

  // Detect fresh sessions after failures
  for (let i = 1; i < sessions.length; i++) {
    if (sessionsEndedWithError.has(i - 1)) {
      const firstMsg = sessions[i]!.messages.find(isAnalyzableUserMessage);
      if (firstMsg && firstMsg.rawContent.length >= 100) {
        freshSessionAfterFailureCount++;
      }
    }
  }

  // Count skill invocations from slash commands beyond built-in ones
  for (const utterance of utterances) {
    const skillPatterns = /\/(bp|ouroboros|ralph|spc|codex|ship-it|debug|simplify)/i;
    if (skillPatterns.test(utterance.text)) {
      skillInvocations++;
    }
  }

  // Compute compaction rate
  const slashCmds: Record<string, number> = {};
  for (const utterance of utterances) {
    const commands = extractSlashCommands(utterance.text);
    for (const cmd of commands) {
      slashCmds[cmd] = (slashCmds[cmd] ?? 0) + 1;
    }
  }
  const compactCount = (slashCmds['compact'] ?? 0) + (slashCmds['clear'] ?? 0);
  const compactionRate = sessions.length > 0 ? compactCount / sessions.length : 0;

  return {
    claudeMdReferences,
    scopedRuleReferences,
    hookReferences,
    skillInvocations,
    properToolSelectionRatio: totalToolCalls > 0 ? properToolCalls / totalToolCalls : 1,
    bashMisuseCount,
    taskDelegationCount,
    compactionRate,
    structuredColdStartCount,
    freshSessionAfterFailureCount,
    errorChainBreakCount,
    verificationRequestCount,
  };
}

/**
 * Extract Phase 1 output from parsed sessions.
 */
export async function extractPhase1DataFromParsedSessions(
  sessions: ParsedSession[],
): Promise<Phase1Output> {
  const allUtterances: UserUtterance[] = [];
  const allSlashCommands: string[] = [];
  const allInsightBlocks: AIInsightBlock[] = [];
  const allSessions: RawSessionData[] = [];
  const utterancesBySession = new Map<string, UserUtterance[]>();
  if (sessions.length === 0) {
    throw new Error('No parsed sessions available for Phase 1 extraction.');
  }

  for (const parsedSession of sessions) {
    const session = toRawSessionData(parsedSession);
    allSessions.push(session);

    const { utterances, slashCommands, insightBlocks } = extractFromSession(session);
    utterancesBySession.set(session.sessionId, utterances);
    allUtterances.push(...utterances);
    allSlashCommands.push(...slashCommands);
    allInsightBlocks.push(...insightBlocks);
  }

  // Compute metrics
  const totalMessages = allSessions.reduce((sum, s) => sum + s.messages.length, 0);
  const totalUserMessages = allSessions.reduce(
    (sum, s) => sum + s.messages.filter(isAnalyzableUserMessage).length, 0,
  );
  const questionCount = allUtterances.filter(u => u.hasQuestion).length;
  const codeBlockCount = allUtterances.filter(u => u.hasCodeBlock).length;

  const slashCommandCounts: Record<string, number> = {};
  for (const cmd of allSlashCommands) {
    slashCommandCounts[cmd] = (slashCommandCounts[cmd] ?? 0) + 1;
  }

  const timestamps = allUtterances.map(u => u.timestamp).sort();
  const contextFillMetrics = computeContextFillMetrics(allSessions);
  const frictionSignals = computeFrictionSignals(allSessions, allUtterances);
  const sessionHints = computeSessionHints(allSessions);
  const expertSignals = computeExpertSignals(allSessions, allUtterances);

  const sessionMetrics: Phase1SessionMetrics = {
    totalSessions: allSessions.length,
    totalMessages,
    totalDeveloperUtterances: allUtterances.length,
    totalAIResponses: totalMessages - totalUserMessages,
    avgMessagesPerSession: allSessions.length > 0 ? totalMessages / allSessions.length : 0,
    avgDeveloperMessageLength: allUtterances.length > 0
      ? allUtterances.reduce((sum, u) => sum + u.characterCount, 0) / allUtterances.length
      : 0,
    questionRatio: allUtterances.length > 0 ? questionCount / allUtterances.length : 0,
    codeBlockRatio: allUtterances.length > 0 ? codeBlockCount / allUtterances.length : 0,
    dateRange: {
      earliest: timestamps[0] ?? new Date().toISOString(),
      latest: timestamps[timestamps.length - 1] ?? new Date().toISOString(),
    },
    ...(Object.keys(slashCommandCounts).length > 0 ? { slashCommandCounts } : {}),
    ...contextFillMetrics,
    frictionSignals,
    sessionHints,
    ...(allInsightBlocks.length > 0 ? { aiInsightBlockCount: allInsightBlocks.length } : {}),
    expertSignals,
  };

  // Build per-session activity metadata for Phase 1.5/2 stages
  const activitySessions = allSessions.map((session, idx) => {
    const parsedSession = sessions[idx]!;
    const userUtterances = utterancesBySession.get(session.sessionId) ?? [];
    const assistantMessages = session.messages.filter(m => m.role === 'assistant');
    const sessionTimestamps = session.messages.map(m => m.timestamp.getTime()).sort();
    const startTime = sessionTimestamps.length > 0
      ? new Date(sessionTimestamps[0]).toISOString()
      : new Date().toISOString();
    const endTime = sessionTimestamps.length > 0
      ? sessionTimestamps[sessionTimestamps.length - 1]
      : Date.now();
    const durationSeconds = sessionTimestamps.length > 1
      ? (endTime - sessionTimestamps[0]) / 1000
      : parsedSession.durationSeconds;

    const totalInputTokens = session.messages.reduce((sum, m) => sum + (m.tokenUsage?.input ?? 0), 0);
    const totalOutputTokens = session.messages.reduce((sum, m) => sum + (m.tokenUsage?.output ?? 0), 0);

    const firstUserMsg = userUtterances[0]?.displayText ?? userUtterances[0]?.text ?? '';

    return {
      sessionId: session.sessionId,
      projectName: parsedSession.projectName ?? 'unknown',
      ...(parsedSession.projectPath ? { projectPath: parsedSession.projectPath } : {}),
      startTime,
      durationSeconds: Math.round(durationSeconds),
      messageCount: session.messages.length,
      userMessageCount: userUtterances.length,
      assistantMessageCount: assistantMessages.length,
      totalInputTokens,
      totalOutputTokens,
      ...(firstUserMsg ? { firstUserMessage: firstUserMsg } : {}),
    };
  });

  return {
    developerUtterances: allUtterances,
    sessionMetrics,
    ...(allInsightBlocks.length > 0 ? { aiInsightBlocks: allInsightBlocks } : {}),
    activitySessions,
    sessions,
  };
}
