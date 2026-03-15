/**
 * Data Extractor - Deterministic Phase 1 extraction from JSONL sessions
 *
 * Simplified version of DataExtractorWorker for plugin use.
 * Works directly with JSONL files (no ParsedSession abstraction).
 * Skips LLM-based content classification (host LLM handles raw data).
 *
 * @module plugin/lib/core/data-extractor
 */
import { readFile } from 'node:fs/promises';
import { parseJSONLLine } from './session-scanner.js';
// ============================================================================
// Constants
// ============================================================================
const MAX_TEXT_LENGTH = 2000;
const MAX_INSIGHT_BLOCKS = 50;
const MAX_UTTERANCES = 200;
const CONTEXT_WINDOW_SIZE = 200_000;
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
// System Tag Stripping
// ============================================================================
/**
 * Strip system-injected tags from user message content.
 * These tags are added by Claude Code, not the developer.
 */
function stripSystemTags(content) {
    return content
        // Remove system-reminder tags
        .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
        // Remove command-name tags but keep the text
        .replace(/<command-name>([\s\S]*?)<\/command-name>/g, '$1')
        // Remove EXTREMELY_IMPORTANT tags
        .replace(/<EXTREMELY_IMPORTANT>[\s\S]*?<\/EXTREMELY_IMPORTANT>/g, '')
        // Remove tool result formatting
        .replace(/<tool_result>[\s\S]*?<\/tool_result>/g, '')
        // Collapse excessive whitespace
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
// ============================================================================
// Text Utilities
// ============================================================================
function truncateText(text, maxLen) {
    if (text.length <= maxLen)
        return text;
    return text.slice(0, maxLen) + '... [truncated]';
}
function countWords(text) {
    const cleaned = text.replace(/```[\s\S]*?```/g, '').trim();
    if (!cleaned)
        return 0;
    return cleaned.split(/\s+/).filter(w => w.length > 0).length;
}
function hasCodeBlock(text) {
    return /```/.test(text);
}
function hasQuestion(text) {
    return /\?/.test(text);
}
function isContinuation(text) {
    const lower = text.toLowerCase().trim();
    return /^(continue|go ahead|proceed|keep going|next|yes|ok|okay|sure|do it|let's go)/i.test(lower);
}
function isClearCommand(content) {
    return CLEAR_COMMAND_PATTERNS.some(p => p.test(content));
}
// ============================================================================
// Slash Command Extraction
// ============================================================================
function extractSlashCommands(rawContent) {
    const commands = [];
    // XML-tagged commands (always trusted)
    const xmlPattern = /<command-name>\/([\w-]+)<\/command-name>/g;
    let match;
    while ((match = xmlPattern.exec(rawContent)) !== null) {
        commands.push(match[1]);
    }
    // Plain-text `/xxx` at line start (whitelist-matched only)
    const plainPattern = /^\/(\w[\w-]*)/gm;
    while ((match = plainPattern.exec(rawContent)) !== null) {
        const cmd = match[1];
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
function extractTextFromContent(content) {
    if (typeof content === 'string')
        return content;
    return content
        .filter((block) => block.type === 'text')
        .map(block => block.text)
        .join('\n');
}
/** Check if assistant response had errors (tool_result with is_error) */
function assistantHadError(assistantContent) {
    return assistantContent.some(block => block.type === 'tool_result' && block.is_error);
}
/** Get tool call names from assistant response */
function extractToolCallNames(assistantContent) {
    return assistantContent
        .filter((block) => block.type === 'tool_use')
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
function isRejection(text) {
    const lower = text.toLowerCase();
    if (lower.length > 200)
        return false;
    return REJECTION_PATTERNS.some(p => p.test(lower));
}
function isFrustration(text) {
    return FRUSTRATION_PATTERNS.some(p => p.test(text));
}
/** Parse a JSONL file into raw session data */
function parseSessionFile(lines, sessionId) {
    const messages = [];
    for (const line of lines) {
        if (line.type === 'user') {
            const rawContent = typeof line.message.content === 'string'
                ? line.message.content
                : JSON.stringify(line.message.content);
            const content = typeof line.message.content === 'string'
                ? [{ type: 'text', text: line.message.content }]
                : line.message.content;
            messages.push({
                role: 'user',
                rawContent,
                content,
                timestamp: new Date(line.timestamp),
            });
        }
        else if (line.type === 'assistant') {
            const content = line.message.content;
            messages.push({
                role: 'assistant',
                rawContent: '',
                content,
                timestamp: new Date(line.timestamp),
                tokenUsage: line.message.usage ? {
                    input: line.message.usage.input_tokens,
                    output: line.message.usage.output_tokens,
                } : undefined,
            });
        }
    }
    return { sessionId, messages };
}
/** Extract utterances from a single session */
function extractFromSession(session) {
    const utterances = [];
    const slashCommands = [];
    const insightBlocks = [];
    const seenKeys = new Set();
    let precedingAssistantContent = null;
    for (let i = 0; i < session.messages.length; i++) {
        const message = session.messages[i];
        if (message.role === 'user') {
            // Extract slash commands from raw content BEFORE stripping
            const rawText = extractTextFromContent(message.content);
            slashCommands.push(...extractSlashCommands(message.rawContent || rawText));
            // Skip /clear commands
            if (isClearCommand(rawText)) {
                precedingAssistantContent = null;
                continue;
            }
            // Strip system tags
            const cleanText = stripSystemTags(rawText);
            if (!cleanText.trim())
                continue;
            // Deduplication
            const dedupeKey = `${message.timestamp.toISOString()}|${cleanText.slice(0, 200)}`;
            if (seenKeys.has(dedupeKey))
                continue;
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
        }
        else if (message.role === 'assistant') {
            precedingAssistantContent = message.content;
            // Extract insight blocks from assistant text
            const assistantText = message.content
                .filter((b) => b.type === 'text')
                .map(b => b.text)
                .join('\n');
            let match;
            const pattern = new RegExp(INSIGHT_BLOCK_PATTERN.source, 'g');
            while ((match = pattern.exec(assistantText)) !== null) {
                const content = match[1].trim().slice(0, 500);
                if (content) {
                    insightBlocks.push({
                        sessionId: session.sessionId,
                        turnIndex: i,
                        content,
                        triggeringUtteranceId: utterances.length > 0
                            ? utterances[utterances.length - 1].id
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
function computeFrictionSignals(sessions, utterances) {
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
            if (message.role === 'user') {
                sessionUserMessages++;
            }
            else if (message.role === 'assistant') {
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
                if (!hasError)
                    currentErrorChain = 0;
            }
        }
        if (sessionUserMessages >= 10)
            excessiveIterationSessions++;
        if (sessionHadOverflow)
            contextOverflowSessions++;
    }
    // Count rejection/frustration from utterances
    for (const u of utterances) {
        if (isRejection(u.text))
            userRejectionSignals++;
        if (isFrustration(u.text))
            frustrationExpressionCount++;
        // Bare retry: short message after error
        if (u.precedingAIHadError && u.wordCount < 10) {
            bareRetryAfterErrorCount++;
        }
    }
    // Count repeated tool error patterns (simplified fingerprinting)
    const errorPatterns = new Map();
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
function computeSessionHints(sessions) {
    let totalUserTurns = 0;
    let shortSessions = 0;
    let mediumSessions = 0;
    let longSessions = 0;
    for (const session of sessions) {
        const userTurns = session.messages.filter(m => m.role === 'user').length;
        totalUserTurns += userTurns;
        if (userTurns <= 3)
            shortSessions++;
        else if (userTurns <= 10)
            mediumSessions++;
        else
            longSessions++;
    }
    return {
        avgTurnsPerSession: sessions.length > 0 ? totalUserTurns / sessions.length : 0,
        shortSessions,
        mediumSessions,
        longSessions,
    };
}
function computeContextFillMetrics(sessions) {
    const fillPercentages = [];
    for (const session of sessions) {
        for (const message of session.messages) {
            if (message.role === 'assistant' && message.tokenUsage?.input) {
                fillPercentages.push((message.tokenUsage.input / CONTEXT_WINDOW_SIZE) * 100);
            }
        }
    }
    if (fillPercentages.length === 0)
        return {};
    const avgFill = fillPercentages.reduce((sum, p) => sum + p, 0) / fillPercentages.length;
    const maxFill = Math.max(...fillPercentages);
    return {
        avgContextFillPercent: Math.round(avgFill * 10) / 10,
        maxContextFillPercent: Math.round(maxFill * 10) / 10,
        contextFillExceeded90Count: fillPercentages.filter(p => p >= 90).length,
    };
}
/** Strategic sampling to limit downstream token usage */
function strategicSample(utterances, maxCount) {
    if (utterances.length <= maxCount)
        return utterances;
    // Keep first, last, and evenly distributed middle samples
    const result = [utterances[0]];
    const step = (utterances.length - 1) / (maxCount - 1);
    for (let i = 1; i < maxCount - 1; i++) {
        const index = Math.round(i * step);
        result.push(utterances[index]);
    }
    result.push(utterances[utterances.length - 1]);
    return result;
}
// ============================================================================
// Main Entry Point
// ============================================================================
/**
 * Extract Phase 1 output from session files.
 *
 * Deterministic extraction (no LLM calls):
 * 1. Parses JSONL files
 * 2. Extracts developer utterances with structural metadata
 * 3. Computes session metrics (friction signals, context fill, etc.)
 * 4. Extracts AI insight blocks
 *
 * @param sessionFiles - Array of session file paths or {sessionId, filePath} objects
 * @returns Phase1Output ready for scoring and analysis
 */
export async function extractPhase1Data(sessionFiles) {
    const allUtterances = [];
    const allSlashCommands = [];
    const allInsightBlocks = [];
    const allSessions = [];
    for (const fileOrMeta of sessionFiles) {
        const filePath = typeof fileOrMeta === 'string' ? fileOrMeta : fileOrMeta.filePath;
        const sessionId = typeof fileOrMeta === 'string'
            ? filePath.split('/').pop()?.replace('.jsonl', '') ?? 'unknown'
            : fileOrMeta.sessionId;
        try {
            const content = await readFile(filePath, 'utf-8');
            const lines = content.split('\n')
                .map(l => parseJSONLLine(l))
                .filter((l) => l !== null);
            const session = parseSessionFile(lines, sessionId);
            allSessions.push(session);
            const { utterances, slashCommands, insightBlocks } = extractFromSession(session);
            allUtterances.push(...utterances);
            allSlashCommands.push(...slashCommands);
            allInsightBlocks.push(...insightBlocks);
        }
        catch {
            // Skip unreadable session files
        }
    }
    // Compute metrics
    const totalMessages = allSessions.reduce((sum, s) => sum + s.messages.length, 0);
    const questionCount = allUtterances.filter(u => u.hasQuestion).length;
    const codeBlockCount = allUtterances.filter(u => u.hasCodeBlock).length;
    const slashCommandCounts = {};
    for (const cmd of allSlashCommands) {
        slashCommandCounts[cmd] = (slashCommandCounts[cmd] ?? 0) + 1;
    }
    const timestamps = allUtterances.map(u => u.timestamp).sort();
    const contextFillMetrics = computeContextFillMetrics(allSessions);
    const frictionSignals = computeFrictionSignals(allSessions, allUtterances);
    const sessionHints = computeSessionHints(allSessions);
    const sessionMetrics = {
        totalSessions: allSessions.length,
        totalMessages,
        totalDeveloperUtterances: allUtterances.length,
        totalAIResponses: totalMessages - allUtterances.length,
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
    };
    // Strategic sampling
    const sampledUtterances = strategicSample(allUtterances, MAX_UTTERANCES);
    const sampledInsights = allInsightBlocks.slice(0, MAX_INSIGHT_BLOCKS);
    return {
        developerUtterances: sampledUtterances,
        sessionMetrics,
        ...(sampledInsights.length > 0 ? { aiInsightBlocks: sampledInsights } : {}),
    };
}
//# sourceMappingURL=data-extractor.js.map