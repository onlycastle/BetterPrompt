import {
  getAllStageOutputs,
  getAnalysisRun,
  getCurrentRunId,
  getDomainResults
} from "./chunk-FFMI5SRQ.js";
import {
  CONTEXT_WINDOW_SIZE,
  external_exports,
  getPluginDataDir
} from "./chunk-SVAMHER4.js";
import "./chunk-NSBPE2FW.js";

// cli/commands/get-prompt-context.ts
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

// lib/prompt-context.ts
var PROMPT_CONTEXT_KINDS = [
  "sessionSummaries",
  "domainAnalysis",
  "projectSummaries",
  "weeklyInsights",
  "typeClassification",
  "evidenceVerification",
  "contentWriter",
  "translation"
];
var SKILL_INJECTION_PREFIX = "Base directory for this skill:";
function trimText(text, maxChars) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}\u2026`;
}
function isAnalyzablePromptContextUserMessage(message) {
  return message.role === "user" && !message.isMeta && typeof message.sourceToolUseID !== "string" && message.toolUseResult === void 0 && typeof message.content === "string" && !message.content.trim().startsWith(SKILL_INJECTION_PREFIX);
}
function trimMessages(messages, maxMessages, maxChars) {
  return messages.slice(0, maxMessages).map((message) => ({
    role: message.role,
    timestamp: message.timestamp,
    content: trimText(message.content, maxChars),
    ...Array.isArray(message.toolCalls) && message.toolCalls.length > 0 ? {
      toolCalls: message.toolCalls.slice(0, 5).map((toolCall) => ({
        id: toolCall.id,
        name: toolCall.name,
        ...toolCall.isError ? { isError: true } : {}
      }))
    } : {},
    ...message.tokenUsage ? { tokenUsage: message.tokenUsage } : {}
  }));
}
var MAX_UTTERANCES = 500;
var MAX_INTERACTION_SNAPSHOTS = 200;
var MAX_SESSION_OVERVIEWS = 60;
var MAX_SESSION_TRANSCRIPTS = 40;
function buildTrimmedDeveloperUtterances(phase1Output, maxChars) {
  return phase1Output.developerUtterances.slice(0, MAX_UTTERANCES).map((utterance) => ({
    id: utterance.id,
    text: trimText(utterance.displayText || utterance.text, maxChars),
    sessionId: utterance.sessionId,
    turnIndex: utterance.turnIndex,
    characterCount: utterance.characterCount,
    wordCount: utterance.wordCount,
    hasCodeBlock: utterance.hasCodeBlock,
    hasQuestion: utterance.hasQuestion,
    isSessionStart: utterance.isSessionStart,
    isContinuation: utterance.isContinuation,
    precedingAIToolCalls: utterance.precedingAIToolCalls?.slice(0, 8),
    precedingAIHadError: utterance.precedingAIHadError,
    timestamp: utterance.timestamp
  }));
}
function asSessionMessageWithMeta(message) {
  return message;
}
function buildSessionOverviews(phase1Output) {
  return (phase1Output.sessions ?? []).slice(0, MAX_SESSION_OVERVIEWS).map((session) => {
    const messages = session.messages.map(asSessionMessageWithMeta);
    const userMessages = messages.filter(isAnalyzablePromptContextUserMessage);
    const assistantMessages = messages.filter((message) => message.role === "assistant");
    const firstAssistant = assistantMessages[0];
    const toolSequence = assistantMessages.flatMap((message) => message.toolCalls?.map((toolCall) => toolCall.name) ?? []).filter((toolName, index, all) => all.indexOf(toolName) === index).slice(0, 10);
    const peakAssistantInputTokens = assistantMessages.reduce(
      (max, message) => Math.max(max, message.tokenUsage?.input ?? 0),
      0
    );
    const peakContextFillPercent = peakAssistantInputTokens > 0 ? Math.round(peakAssistantInputTokens / CONTEXT_WINDOW_SIZE * 1e3) / 10 : void 0;
    return {
      sessionId: session.sessionId,
      projectName: session.projectName ?? "unknown",
      startTime: session.startTime,
      endTime: session.endTime,
      durationSeconds: session.durationSeconds,
      stats: {
        userMessageCount: userMessages.length,
        assistantMessageCount: assistantMessages.length,
        toolCallCount: session.stats.toolCallCount,
        uniqueToolsUsed: session.stats.uniqueToolsUsed,
        totalInputTokens: session.stats.totalInputTokens,
        totalOutputTokens: session.stats.totalOutputTokens
      },
      firstUserMessage: trimText(userMessages[0]?.content, 350),
      firstAssistantPreview: trimText(firstAssistant?.content, 350),
      firstAssistantAskedQuestion: Boolean(firstAssistant?.content?.includes("?")),
      assistantErrorCount: assistantMessages.reduce(
        (count, message) => count + (message.toolCalls?.some((toolCall) => toolCall.isError) ? 1 : 0),
        0
      ),
      toolSequence,
      peakContextFillPercent
    };
  });
}
function buildInteractionSnapshots(phase1Output, options) {
  const { maxUserChars = 260, maxAssistantChars = 220 } = options ?? {};
  const snapshots = (phase1Output.sessions ?? []).flatMap((session) => {
    const messages = session.messages.map(asSessionMessageWithMeta);
    return messages.flatMap((message, index) => {
      if (!isAnalyzablePromptContextUserMessage(message)) {
        return [];
      }
      const precedingAssistant = [...messages.slice(0, index)].reverse().find((candidate) => candidate.role === "assistant");
      return [{
        utteranceId: `${session.sessionId}_${index}`,
        sessionId: session.sessionId,
        projectName: session.projectName ?? "unknown",
        turnIndex: index,
        text: trimText(message.content, maxUserChars),
        characterCount: message.content.length,
        hasQuestion: message.content.includes("?"),
        isSessionStart: !messages.slice(0, index).some(isAnalyzablePromptContextUserMessage),
        precedingAssistantPreview: trimText(precedingAssistant?.content, maxAssistantChars),
        precedingAssistantLength: precedingAssistant?.content?.length ?? 0,
        precedingAssistantHadCodeBlock: Boolean(precedingAssistant?.content?.includes("```")),
        precedingAIToolCalls: precedingAssistant?.toolCalls?.map((toolCall) => toolCall.name).slice(0, 8),
        precedingAIHadError: precedingAssistant?.toolCalls?.some((toolCall) => toolCall.isError) ?? false
      }];
    });
  });
  return snapshots.slice(0, MAX_INTERACTION_SNAPSHOTS);
}
function buildUtteranceLookup(phase1Output) {
  return Object.fromEntries(
    phase1Output.developerUtterances.map((utterance) => [
      utterance.id,
      utterance.displayText || utterance.text
    ])
  );
}
function buildTrimmedSessionInput(phase1Output, maxSessions, maxMsgChars) {
  const sessions = maxSessions ? (phase1Output.sessions ?? []).slice(0, maxSessions) : phase1Output.sessions ?? [];
  const msgChars = maxMsgChars ?? 700;
  return sessions.map((session) => ({
    sessionId: session.sessionId,
    projectPath: session.projectPath,
    projectName: session.projectName ?? "unknown",
    startTime: session.startTime,
    endTime: session.endTime,
    durationSeconds: session.durationSeconds,
    source: session.source,
    stats: session.stats,
    messages: trimMessages(session.messages, 10, msgChars)
  }));
}
function buildCondensedDomainResults(domainResults, options) {
  const {
    maxStrengths = 2,
    maxGrowthAreas = 2,
    maxDescriptionChars = 420,
    maxRecommendationChars = 260
  } = options ?? {};
  return domainResults.map((result) => ({
    domain: result.domain,
    overallScore: result.overallScore,
    confidenceScore: result.confidenceScore,
    strengths: result.strengths.slice(0, maxStrengths).map((strength) => ({
      title: strength.title,
      description: trimText(strength.description, maxDescriptionChars),
      evidenceCount: strength.evidence.length
    })),
    growthAreas: result.growthAreas.slice(0, maxGrowthAreas).map((growthArea) => ({
      title: growthArea.title,
      description: trimText(growthArea.description, maxDescriptionChars),
      severity: growthArea.severity,
      recommendation: trimText(growthArea.recommendation, maxRecommendationChars),
      evidenceCount: growthArea.evidence.length
    })),
    analyzedAt: result.analyzedAt
  }));
}
function buildCondensedContentWriterStageOutputs(stageOutputs) {
  return {
    typeClassification: stageOutputs.typeClassification ? {
      collaborationMaturity: stageOutputs.typeClassification.collaborationMaturity,
      reasoning: stageOutputs.typeClassification.reasoning.slice(0, 3).map((paragraph) => trimText(paragraph, 600)),
      personalityNarrative: stageOutputs.typeClassification.personalityNarrative.slice(0, 3).map((paragraph) => trimText(paragraph, 600))
    } : void 0,
    weeklyInsights: stageOutputs.weeklyInsights ? {
      stats: stageOutputs.weeklyInsights.stats,
      projects: stageOutputs.weeklyInsights.projects,
      topSessions: stageOutputs.weeklyInsights.topSessions,
      narrative: trimText(stageOutputs.weeklyInsights.narrative, 800),
      highlights: stageOutputs.weeklyInsights.highlights.slice(0, 8).map((item) => trimText(item, 250))
    } : void 0,
    projectSummaries: stageOutputs.projectSummaries,
    evidenceVerification: stageOutputs.evidenceVerification ? {
      threshold: stageOutputs.evidenceVerification.threshold,
      domainStats: stageOutputs.evidenceVerification.domainStats,
      verifiedEvidenceCount: stageOutputs.evidenceVerification.verifiedResults.length
    } : void 0
  };
}
function buildThinkingQualityContext(phase1Output) {
  return {
    developerUtterances: buildTrimmedDeveloperUtterances(phase1Output, 700),
    sessionMetrics: phase1Output.sessionMetrics,
    sessionOverviews: buildSessionOverviews(phase1Output),
    interactionSnapshots: buildInteractionSnapshots(phase1Output, {
      maxUserChars: 400,
      maxAssistantChars: 300
    }),
    ...phase1Output.aiInsightBlocks?.length ? {
      aiInsightBlocks: phase1Output.aiInsightBlocks.slice(0, 25).map((block) => ({
        sessionId: block.sessionId,
        turnIndex: block.turnIndex,
        content: trimText(block.content, 250),
        triggeringUtteranceId: block.triggeringUtteranceId
      }))
    } : {}
  };
}
function buildCommunicationContext(phase1Output) {
  return {
    developerUtterances: buildTrimmedDeveloperUtterances(phase1Output, 600),
    sessionMetrics: phase1Output.sessionMetrics,
    sessionOverviews: buildSessionOverviews(phase1Output),
    interactionSnapshots: buildInteractionSnapshots(phase1Output, {
      maxUserChars: 350,
      maxAssistantChars: 250
    })
  };
}
function buildLearningContext(phase1Output) {
  return {
    sessionMetrics: phase1Output.sessionMetrics,
    developerUtterances: buildTrimmedDeveloperUtterances(phase1Output, 700),
    sessionOverviews: buildSessionOverviews(phase1Output),
    interactionSnapshots: buildInteractionSnapshots(phase1Output, {
      maxUserChars: 380,
      maxAssistantChars: 300
    }),
    ...phase1Output.aiInsightBlocks?.length ? {
      aiInsightBlocks: phase1Output.aiInsightBlocks.slice(0, 40).map((block) => ({
        sessionId: block.sessionId,
        turnIndex: block.turnIndex,
        content: trimText(block.content, 350),
        triggeringUtteranceId: block.triggeringUtteranceId
      }))
    } : {},
    sessions: buildTrimmedSessionInput(phase1Output, MAX_SESSION_TRANSCRIPTS, 500)
  };
}
function buildEfficiencyContext(phase1Output) {
  return {
    sessionMetrics: phase1Output.sessionMetrics,
    activitySessions: phase1Output.activitySessions ?? [],
    sessionOverviews: buildSessionOverviews(phase1Output),
    interactionSnapshots: buildInteractionSnapshots(phase1Output, {
      maxUserChars: 350,
      maxAssistantChars: 250
    }),
    developerUtterances: buildTrimmedDeveloperUtterances(phase1Output, 600),
    sessions: buildTrimmedSessionInput(phase1Output, MAX_SESSION_TRANSCRIPTS, 500)
  };
}
function buildSessionMasteryContext(phase1Output) {
  return {
    sessionMetrics: phase1Output.sessionMetrics,
    activitySessions: phase1Output.activitySessions ?? [],
    sessionOverviews: buildSessionOverviews(phase1Output),
    interactionSnapshots: buildInteractionSnapshots(phase1Output, {
      maxUserChars: 300,
      maxAssistantChars: 220
    }),
    sessions: buildTrimmedSessionInput(phase1Output, MAX_SESSION_TRANSCRIPTS, 400)
  };
}
function buildDomainAnalysisContext(domain, phase1Output, deterministicScores) {
  const base = {
    domain,
    deterministicScores,
    dateRange: phase1Output.sessionMetrics.dateRange
  };
  switch (domain) {
    case "aiPartnership":
      return { ...base, phase1: {
        ...buildThinkingQualityContext(phase1Output),
        activitySessions: phase1Output.activitySessions ?? []
      } };
    case "sessionCraft":
      return { ...base, phase1: {
        ...buildEfficiencyContext(phase1Output),
        ...phase1Output.aiInsightBlocks?.length ? {
          aiInsightBlocks: phase1Output.aiInsightBlocks.slice(0, 30).map((block) => ({
            sessionId: block.sessionId,
            turnIndex: block.turnIndex,
            content: trimText(block.content, 300),
            triggeringUtteranceId: block.triggeringUtteranceId
          }))
        } : {}
      } };
    case "toolMastery":
      return { ...base, phase1: buildCommunicationContext(phase1Output) };
    case "skillResilience":
      return { ...base, phase1: buildLearningContext(phase1Output) };
    case "sessionMastery":
      return { ...base, phase1: buildSessionMasteryContext(phase1Output) };
  }
}
function buildPromptContext(input) {
  const {
    kind,
    phase1Output,
    deterministicScores,
    typeResult,
    domainResults,
    stageOutputs,
    domain
  } = input;
  const base = {
    kind,
    availableDomains: domainResults.map((result) => result.domain),
    availableStages: Object.keys(stageOutputs).filter(
      (key) => stageOutputs[key] !== void 0
    )
  };
  switch (kind) {
    case "sessionSummaries":
      return {
        ...base,
        phase1: {
          sessionMetrics: phase1Output.sessionMetrics,
          sessions: buildTrimmedSessionInput(phase1Output),
          activitySessions: phase1Output.activitySessions ?? []
        }
      };
    case "domainAnalysis":
      if (!domain) {
        throw new Error("Domain is required when kind=domainAnalysis.");
      }
      return {
        ...base,
        ...buildDomainAnalysisContext(domain, phase1Output, deterministicScores)
      };
    case "projectSummaries":
      return {
        ...base,
        activitySessions: phase1Output.activitySessions ?? [],
        sessionSummaries: stageOutputs.sessionSummaries ?? { summaries: [] }
      };
    case "weeklyInsights":
      return {
        ...base,
        activitySessions: phase1Output.activitySessions ?? [],
        sessionSummaries: stageOutputs.sessionSummaries ?? { summaries: [] }
      };
    case "typeClassification":
      return {
        ...base,
        deterministicScores,
        deterministicType: typeResult,
        sessionMetrics: phase1Output.sessionMetrics,
        domainResults: buildCondensedDomainResults(domainResults, {
          maxStrengths: 3,
          maxGrowthAreas: 3,
          maxDescriptionChars: 600,
          maxRecommendationChars: 400
        })
      };
    case "evidenceVerification":
      return {
        ...base,
        utteranceLookup: buildUtteranceLookup(phase1Output),
        domainResults
      };
    case "contentWriter":
      return {
        ...base,
        deterministicType: typeResult,
        domainResults: buildCondensedDomainResults(domainResults, {
          maxStrengths: 3,
          maxGrowthAreas: 3,
          maxDescriptionChars: 700,
          maxRecommendationChars: 500
        }),
        stageOutputs: buildCondensedContentWriterStageOutputs(stageOutputs)
      };
    case "translation":
      return {
        ...base,
        languageSample: phase1Output.developerUtterances.slice(-50).map((utterance) => utterance.displayText || utterance.text),
        deterministicType: typeResult,
        domainResults,
        stageOutputs
      };
  }
}

// cli/commands/get-prompt-context.ts
var InputSchema = external_exports.object({
  kind: external_exports.enum(PROMPT_CONTEXT_KINDS),
  domain: external_exports.enum([
    "aiPartnership",
    "sessionCraft",
    "toolMastery",
    "skillResilience",
    "sessionMastery"
  ]).optional()
});
async function execute(args) {
  const parsed = InputSchema.safeParse(args);
  if (!parsed.success) {
    return JSON.stringify({
      status: "validation_error",
      message: "Invalid prompt-context request.",
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }
  const runId = getCurrentRunId();
  if (!runId) {
    return JSON.stringify({
      status: "error",
      message: "No active analysis run. Run extract-data first."
    });
  }
  const run = getAnalysisRun(runId);
  if (!run?.phase1Output) {
    return JSON.stringify({
      status: "not_found",
      runId,
      message: `Run #${runId} has no Phase 1 output.`
    });
  }
  try {
    const data = buildPromptContext({
      kind: parsed.data.kind,
      domain: parsed.data.domain,
      phase1Output: run.phase1Output,
      deterministicScores: run.scores,
      typeResult: run.typeResult,
      domainResults: getDomainResults(runId),
      stageOutputs: getAllStageOutputs(runId)
    });
    const result = {
      status: "ok",
      runId,
      kind: parsed.data.kind,
      ...parsed.data.domain ? { domain: parsed.data.domain } : {},
      data
    };
    const tmpDir = join(getPluginDataDir(), "tmp");
    await mkdir(tmpDir, { recursive: true });
    const label = parsed.data.domain ? `${parsed.data.kind}-${parsed.data.domain}` : parsed.data.kind;
    const outputFile = join(tmpDir, `context-${label}.json`);
    await writeFile(outputFile, JSON.stringify(result, null, 2), "utf-8");
    return JSON.stringify({
      status: "ok",
      runId,
      kind: parsed.data.kind,
      ...parsed.data.domain ? { domain: parsed.data.domain } : {},
      outputFile,
      message: `Prompt context written to ${outputFile}.`
    });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      runId,
      message: error instanceof Error ? error.message : "Failed to build prompt context."
    });
  }
}
export {
  execute
};
//# sourceMappingURL=get-prompt-context-BPI5LNU7.js.map