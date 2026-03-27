import "./chunk-3Y74BQOH.js";
import {
  normalizeProjectFilters,
  normalizeProjectNameValue,
  readCachedParsedSessions
} from "./chunk-UNYQVFLT.js";
import {
  clearAnalysisPending,
  markAnalysisFailed,
  markAnalysisStarted
} from "./chunk-VXUKPHXP.js";
import "./chunk-FIGO7IPG.js";
import "./chunk-FW6ZW4J3.js";
import {
  createAnalysisRun
} from "./chunk-T2XRMW7B.js";
import {
  CONTEXT_WINDOW_SIZE,
  buildReportActivitySessions,
  computeDeterministicScores,
  getPluginDataDir
} from "./chunk-UORQZYNI.js";
import "./chunk-NSBPE2FW.js";

// cli/commands/extract-data.ts
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

// lib/core/data-extractor.ts
var MAX_TEXT_LENGTH = 2e3;
var SKILL_INJECTION_PREFIX = "Base directory for this skill:";
var KNOWN_SLASH_COMMANDS = /* @__PURE__ */ new Set([
  "plan",
  "review",
  "commit",
  "compact",
  "clear",
  "help",
  "init",
  "sisyphus",
  "orchestrator",
  "ultrawork",
  "ralph-loop",
  "deepsearch",
  "analyze",
  "prometheus",
  "cancel-ralph",
  "update",
  "bug",
  "config",
  "cost",
  "doctor",
  "login",
  "logout",
  "memory",
  "model",
  "permissions",
  "project",
  "status",
  "terminal-setup",
  "vim",
  "fast"
]);
var CLEAR_COMMAND_PATTERNS = [
  /^\/clear\b/m,
  /<command-name>\/clear<\/command-name>/
];
var INSIGHT_BLOCK_PATTERN = /`★\s*Insight\s*─+`\n([\s\S]*?)\n`─+`/g;
function stripSystemTags(content) {
  return content.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").replace(/<command-name>([\s\S]*?)<\/command-name>/g, "$1").replace(/<EXTREMELY_IMPORTANT>[\s\S]*?<\/EXTREMELY_IMPORTANT>/g, "").replace(/<tool_result>[\s\S]*?<\/tool_result>/g, "").replace(/\n{3,}/g, "\n\n").trim();
}
function truncateText(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "... [truncated]";
}
function countWords(text) {
  const cleaned = text.replace(/```[\s\S]*?```/g, "").trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter((w) => w.length > 0).length;
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
  return CLEAR_COMMAND_PATTERNS.some((p) => p.test(content));
}
function extractSlashCommands(rawContent) {
  const commands = [];
  const xmlPattern = /<command-name>\/([\w-]+)<\/command-name>/g;
  let match;
  while ((match = xmlPattern.exec(rawContent)) !== null) {
    commands.push(match[1]);
  }
  const plainPattern = /^\/(\w[\w-]*)/gm;
  while ((match = plainPattern.exec(rawContent)) !== null) {
    const cmd = match[1];
    if (KNOWN_SLASH_COMMANDS.has(cmd)) {
      commands.push(cmd);
    }
  }
  return commands;
}
function extractTextFromContent(content) {
  if (typeof content === "string") return content;
  return content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
}
function assistantHadError(assistantContent) {
  return assistantContent.some((block) => block.type === "tool_result" && block.is_error);
}
function extractToolCallNames(assistantContent) {
  return assistantContent.filter((block) => block.type === "tool_use").map((block) => block.name);
}
var REJECTION_PATTERNS = [
  /\bno\b/i,
  /\bwrong\b/i,
  /\bincorrect\b/i,
  /\btry again\b/i,
  /\bthat's not right\b/i,
  /\bnot what i/i,
  /\bdon't\b.*\bthat\b/i,
  /\bundo\b/i,
  /\brevert\b/i
];
var FRUSTRATION_PATTERNS = [
  /\bagain\b/i,
  /\bstill not working\b/i,
  /\bsame error\b/i,
  /\bfrustrat/i,
  /\bugh\b/i,
  /\bwhy (won't|doesn't|isn't)/i
];
function isRejection(text) {
  const lower = text.toLowerCase();
  if (lower.length > 200) return false;
  return REJECTION_PATTERNS.some((p) => p.test(lower));
}
function isFrustration(text) {
  return FRUSTRATION_PATTERNS.some((p) => p.test(text));
}
function isAnalyzableUserMessage(message) {
  const isSkillInjectedPrompt = message.rawContent.trim().startsWith(SKILL_INJECTION_PREFIX);
  return message.role === "user" && !message.isMeta && typeof message.sourceToolUseID !== "string" && message.toolUseResult === void 0 && !isSkillInjectedPrompt;
}
function toRawSessionData(session) {
  return {
    sessionId: session.sessionId,
    messages: session.messages.map((message) => {
      if (message.role === "user") {
        return {
          role: "user",
          rawContent: message.content,
          content: [{ type: "text", text: message.content }],
          timestamp: new Date(message.timestamp),
          ...message.isMeta ? { isMeta: true } : {},
          ...typeof message.sourceToolUseID === "string" ? { sourceToolUseID: message.sourceToolUseID } : {},
          ...message.toolUseResult !== void 0 ? { toolUseResult: message.toolUseResult } : {}
        };
      }
      const content = [];
      if (message.content) {
        content.push({ type: "text", text: message.content });
      }
      for (const toolCall of message.toolCalls ?? []) {
        content.push({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.name
        });
        if (toolCall.result !== void 0) {
          content.push({
            type: "tool_result",
            tool_use_id: toolCall.id,
            content: toolCall.result,
            is_error: toolCall.isError
          });
        }
      }
      return {
        role: "assistant",
        rawContent: message.content,
        content,
        timestamp: new Date(message.timestamp),
        tokenUsage: message.tokenUsage
      };
    })
  };
}
function extractFromSession(session) {
  const utterances = [];
  const slashCommands = [];
  const insightBlocks = [];
  const seenKeys = /* @__PURE__ */ new Set();
  let precedingAssistantContent = null;
  for (let i = 0; i < session.messages.length; i++) {
    const message = session.messages[i];
    if (message.role === "user") {
      if (!isAnalyzableUserMessage(message)) {
        precedingAssistantContent = null;
        continue;
      }
      const rawText = extractTextFromContent(
        message.content
      );
      slashCommands.push(...extractSlashCommands(message.rawContent || rawText));
      if (isClearCommand(rawText)) {
        precedingAssistantContent = null;
        continue;
      }
      const cleanText = stripSystemTags(rawText);
      if (!cleanText.trim()) continue;
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
        precedingAIToolCalls: precedingAssistantContent ? extractToolCallNames(precedingAssistantContent) : void 0,
        precedingAIHadError: precedingAssistantContent ? assistantHadError(precedingAssistantContent) : void 0
      });
      precedingAssistantContent = null;
    } else if (message.role === "assistant") {
      precedingAssistantContent = message.content;
      const assistantText = message.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      let match;
      const pattern = new RegExp(INSIGHT_BLOCK_PATTERN.source, "g");
      while ((match = pattern.exec(assistantText)) !== null) {
        const content = match[1].trim().slice(0, 500);
        if (content) {
          insightBlocks.push({
            sessionId: session.sessionId,
            turnIndex: i,
            content,
            triggeringUtteranceId: utterances.length > 0 ? utterances[utterances.length - 1].id : void 0
          });
        }
      }
    }
  }
  return { utterances, slashCommands, insightBlocks };
}
function computeFrictionSignals(sessions, utterances) {
  let toolFailureCount = 0;
  let userRejectionSignals = 0;
  let excessiveIterationSessions = 0;
  let contextOverflowSessions = 0;
  let frustrationExpressionCount = 0;
  let bareRetryAfterErrorCount = 0;
  let errorChainMaxLength = 0;
  for (const session of sessions) {
    let sessionUserMessages = 0;
    let sessionHadOverflow = false;
    let currentErrorChain = 0;
    for (const message of session.messages) {
      if (isAnalyzableUserMessage(message)) {
        sessionUserMessages++;
      } else if (message.role === "assistant") {
        for (const block of message.content) {
          if (block.type === "tool_result" && block.is_error) {
            toolFailureCount++;
            currentErrorChain++;
            errorChainMaxLength = Math.max(errorChainMaxLength, currentErrorChain);
          }
        }
        if (message.tokenUsage && message.tokenUsage.input / CONTEXT_WINDOW_SIZE >= 0.9) {
          sessionHadOverflow = true;
        }
      }
      if (message.role === "assistant") {
        const hasError = message.content.some((b) => b.type === "tool_result" && b.is_error);
        if (!hasError) currentErrorChain = 0;
      }
    }
    if (sessionUserMessages >= 10) excessiveIterationSessions++;
    if (sessionHadOverflow) contextOverflowSessions++;
  }
  for (const u of utterances) {
    if (isRejection(u.text)) userRejectionSignals++;
    if (isFrustration(u.text)) frustrationExpressionCount++;
    if (u.precedingAIHadError && u.wordCount < 10) {
      bareRetryAfterErrorCount++;
    }
  }
  const errorPatterns = /* @__PURE__ */ new Map();
  for (const session of sessions) {
    for (const message of session.messages) {
      if (message.role === "assistant") {
        for (const block of message.content) {
          if (block.type === "tool_result" && block.is_error) {
            const errText = typeof block.content === "string" ? block.content : "";
            const fingerprint = errText.replace(/\/[\w/.-]+/g, "<path>").replace(/\d{4}-\d{2}-\d{2}/g, "<date>").slice(0, 100);
            errorPatterns.set(fingerprint, (errorPatterns.get(fingerprint) ?? 0) + 1);
          }
        }
      }
    }
  }
  const repeatedToolErrorPatterns = [...errorPatterns.values()].filter((c) => c >= 2).length;
  return {
    toolFailureCount,
    userRejectionSignals,
    excessiveIterationSessions,
    contextOverflowSessions,
    frustrationExpressionCount,
    repeatedToolErrorPatterns,
    bareRetryAfterErrorCount,
    errorChainMaxLength
  };
}
function computeSessionHints(sessions) {
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
    longSessions
  };
}
function computeContextFillMetrics(sessions) {
  const fillPercentages = [];
  for (const session of sessions) {
    for (const message of session.messages) {
      if (message.role === "assistant" && message.tokenUsage?.input) {
        fillPercentages.push(message.tokenUsage.input / CONTEXT_WINDOW_SIZE * 100);
      }
    }
  }
  if (fillPercentages.length === 0) return {};
  const avgFill = fillPercentages.reduce((sum, p) => sum + p, 0) / fillPercentages.length;
  const maxFill = Math.max(...fillPercentages);
  return {
    avgContextFillPercent: Math.round(avgFill * 10) / 10,
    maxContextFillPercent: Math.round(maxFill * 10) / 10,
    contextFillExceeded90Count: fillPercentages.filter((p) => p >= 90).length
  };
}
async function extractPhase1DataFromParsedSessions(sessions) {
  const allUtterances = [];
  const allSlashCommands = [];
  const allInsightBlocks = [];
  const allSessions = [];
  if (sessions.length === 0) {
    throw new Error("No parsed sessions available for Phase 1 extraction.");
  }
  for (const parsedSession of sessions) {
    const session = toRawSessionData(parsedSession);
    allSessions.push(session);
    const { utterances, slashCommands, insightBlocks } = extractFromSession(session);
    allUtterances.push(...utterances);
    allSlashCommands.push(...slashCommands);
    allInsightBlocks.push(...insightBlocks);
  }
  const totalMessages = allSessions.reduce((sum, s) => sum + s.messages.length, 0);
  const totalUserMessages = allSessions.reduce(
    (sum, s) => sum + s.messages.filter(isAnalyzableUserMessage).length,
    0
  );
  const questionCount = allUtterances.filter((u) => u.hasQuestion).length;
  const codeBlockCount = allUtterances.filter((u) => u.hasCodeBlock).length;
  const slashCommandCounts = {};
  for (const cmd of allSlashCommands) {
    slashCommandCounts[cmd] = (slashCommandCounts[cmd] ?? 0) + 1;
  }
  const timestamps = allUtterances.map((u) => u.timestamp).sort();
  const contextFillMetrics = computeContextFillMetrics(allSessions);
  const frictionSignals = computeFrictionSignals(allSessions, allUtterances);
  const sessionHints = computeSessionHints(allSessions);
  const sessionMetrics = {
    totalSessions: allSessions.length,
    totalMessages,
    totalDeveloperUtterances: allUtterances.length,
    totalAIResponses: totalMessages - totalUserMessages,
    avgMessagesPerSession: allSessions.length > 0 ? totalMessages / allSessions.length : 0,
    avgDeveloperMessageLength: allUtterances.length > 0 ? allUtterances.reduce((sum, u) => sum + u.characterCount, 0) / allUtterances.length : 0,
    questionRatio: allUtterances.length > 0 ? questionCount / allUtterances.length : 0,
    codeBlockRatio: allUtterances.length > 0 ? codeBlockCount / allUtterances.length : 0,
    dateRange: {
      earliest: timestamps[0] ?? (/* @__PURE__ */ new Date()).toISOString(),
      latest: timestamps[timestamps.length - 1] ?? (/* @__PURE__ */ new Date()).toISOString()
    },
    ...Object.keys(slashCommandCounts).length > 0 ? { slashCommandCounts } : {},
    ...contextFillMetrics,
    frictionSignals,
    sessionHints,
    ...allInsightBlocks.length > 0 ? { aiInsightBlockCount: allInsightBlocks.length } : {}
  };
  const activitySessions = allSessions.map((session, idx) => {
    const parsedSession = sessions[idx];
    const userMessages = session.messages.filter(isAnalyzableUserMessage);
    const assistantMessages = session.messages.filter((m) => m.role === "assistant");
    const sessionTimestamps = session.messages.map((m) => m.timestamp.getTime()).sort();
    const startTime = sessionTimestamps.length > 0 ? new Date(sessionTimestamps[0]).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
    const endTime = sessionTimestamps.length > 0 ? sessionTimestamps[sessionTimestamps.length - 1] : Date.now();
    const durationSeconds = sessionTimestamps.length > 1 ? (endTime - sessionTimestamps[0]) / 1e3 : parsedSession.durationSeconds;
    const totalInputTokens = session.messages.reduce((sum, m) => sum + (m.tokenUsage?.input ?? 0), 0);
    const totalOutputTokens = session.messages.reduce((sum, m) => sum + (m.tokenUsage?.output ?? 0), 0);
    const firstUserMsg = userMessages[0]?.rawContent?.slice(0, 200) ?? "";
    return {
      sessionId: session.sessionId,
      projectName: parsedSession.projectName ?? "unknown",
      ...parsedSession.projectPath ? { projectPath: parsedSession.projectPath } : {},
      startTime,
      durationSeconds: Math.round(durationSeconds),
      messageCount: session.messages.length,
      userMessageCount: userMessages.length,
      assistantMessageCount: assistantMessages.length,
      totalInputTokens,
      totalOutputTokens,
      ...firstUserMsg ? { firstUserMessage: firstUserMsg } : {}
    };
  });
  return {
    developerUtterances: allUtterances,
    sessionMetrics,
    ...allInsightBlocks.length > 0 ? { aiInsightBlocks: allInsightBlocks } : {},
    activitySessions,
    sessions
  };
}

// cli/commands/extract-data.ts
async function execute(args) {
  const maxSessions = args.maxSessions ?? 50;
  const includeProjects = normalizeProjectFilters(args.includeProjects);
  const allSessions = await readCachedParsedSessions();
  if (allSessions.length === 0) {
    return JSON.stringify({
      status: "no_data",
      message: "No cached parsed sessions. Run scan-sessions first."
    });
  }
  const sessions = includeProjects?.length ? allSessions.filter((s) => includeProjects.includes(normalizeProjectNameValue(s.projectName))) : allSessions;
  if (sessions.length === 0) {
    return JSON.stringify({
      status: "no_data",
      message: "No sessions match the selected projects. Run scan-sessions to see available projects."
    });
  }
  clearAnalysisPending();
  markAnalysisStarted();
  try {
    const selectedSessions = sessions.slice(0, maxSessions);
    const phase1Output = await extractPhase1DataFromParsedSessions(selectedSessions);
    const scores = computeDeterministicScores(phase1Output);
    const activitySessions = buildReportActivitySessions(phase1Output);
    const pluginDataDir = getPluginDataDir();
    await mkdir(pluginDataDir, { recursive: true });
    const phase1Path = join(pluginDataDir, "phase1-output.json");
    await writeFile(phase1Path, JSON.stringify(phase1Output, null, 2), "utf-8");
    const runId = createAnalysisRun({
      metrics: phase1Output.sessionMetrics,
      scores,
      phase1Output,
      activitySessions
    });
    const runIdPath = join(pluginDataDir, "current-run-id.txt");
    await writeFile(runIdPath, String(runId), "utf-8");
    const metrics = phase1Output.sessionMetrics;
    return JSON.stringify({
      status: "ok",
      runId,
      phase1OutputPath: phase1Path,
      metrics: {
        totalSessions: metrics.totalSessions,
        totalUtterances: metrics.totalDeveloperUtterances,
        totalMessages: metrics.totalMessages,
        avgMessagesPerSession: Math.round(metrics.avgMessagesPerSession),
        avgMessageLength: Math.round(metrics.avgDeveloperMessageLength),
        questionRatio: Math.round(metrics.questionRatio * 100),
        codeBlockRatio: Math.round(metrics.codeBlockRatio * 100),
        dateRange: metrics.dateRange
      },
      deterministicScores: {
        aiPartnership: scores.aiPartnership,
        sessionCraft: scores.sessionCraft,
        toolMastery: scores.toolMastery,
        skillResilience: scores.skillResilience,
        sessionMastery: scores.sessionMastery,
        controlScore: scores.controlScore
      },
      message: `Extracted ${metrics.totalDeveloperUtterances} utterances from ${metrics.totalSessions} sessions. Analysis run #${runId} created. Ready for domain analysis.`
    });
  } catch (error) {
    markAnalysisFailed(error);
    throw error;
  }
}
export {
  execute
};
//# sourceMappingURL=extract-data-SA3L25BI.js.map