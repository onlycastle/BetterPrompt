/**
 * Prompt Context Builders
 *
 * Produces stage- and domain-specific prompt payloads from the current
 * canonical run state so skills no longer need to reread the raw Phase 1 file.
 *
 * @module plugin/lib/prompt-context
 */

import type {
  CanonicalStageOutputs,
  DeterministicScores,
  DeterministicTypeResult,
  DomainResult,
  ParsedSession,
  Phase1Output,
  UtteranceEvidenceContext,
} from './core/types.js';
import { CONTEXT_WINDOW_SIZE } from './core/types.js';
import { buildEvidenceContextIndex } from './core/evidence-extractor.js';

export const PROMPT_CONTEXT_KINDS = [
  'sessionSummaries',
  'domainAnalysis',
  'projectSummaries',
  'weeklyInsights',
  'typeClassification',
  'evidenceVerification',
  'contentWriter',
  'translation',
] as const;

export type PromptContextKind = typeof PROMPT_CONTEXT_KINDS[number];

export type PromptContextDomain =
  | 'aiPartnership'
  | 'sessionCraft'
  | 'toolMastery'
  | 'skillResilience'
  | 'sessionMastery';

interface PromptContextInput {
  kind: PromptContextKind;
  phase1Output: Phase1Output;
  deterministicScores: DeterministicScores;
  typeResult: DeterministicTypeResult | null;
  domainResults: DomainResult[];
  stageOutputs: CanonicalStageOutputs;
  domain?: PromptContextDomain;
}

type SessionMessageWithMeta = ParsedSession['messages'][number] & {
  isMeta?: boolean;
};

/**
 * Extract specific file paths and key inputs from preceding AI tool calls.
 *
 * Provides file-level granularity for the tool_file_naming rubric criterion:
 * rather than just knowing "Read was called", the LLM knows "Read was called
 * on middleware/auth.ts", enabling toolsFilesApis to include specific files.
 *
 * Extracts:
 * - File paths from Read/Edit/Write/MultiEdit (file_path field)
 * - Search path scope from Grep/Glob (path field)
 * - Abbreviated Bash commands (first 80 chars, showing CLI tools used)
 *
 * @param toolCalls - Preceding assistant tool calls with input data
 * @returns Deduped list of file paths and command summaries (max 6 entries)
 */
function extractToolInputSummaries(
  toolCalls: Array<{ name: string; input: Record<string, unknown> }>,
): string[] {
  const seen = new Set<string>();
  const summaries: string[] = [];

  for (const tc of toolCalls.slice(0, 8)) {
    const input = tc.input;

    // File-based tools: extract the file path (most valuable for tool_file_naming)
    if (['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tc.name)) {
      const fp = typeof input.file_path === 'string' ? input.file_path : null;
      if (fp) {
        // Use last 2 path segments to keep it readable (e.g. "middleware/auth.ts")
        const parts = fp.replace(/\\/g, '/').split('/').filter(Boolean);
        const brief = parts.length > 2 ? parts.slice(-2).join('/') : fp;
        if (!seen.has(brief)) { seen.add(brief); summaries.push(brief); }
      }
    }

    // Grep: capture the scope path when it's a specific directory or file
    if (tc.name === 'Grep') {
      const searchPath = typeof input.path === 'string' ? input.path : null;
      if (searchPath && searchPath !== '.' && searchPath !== '/') {
        const parts = searchPath.replace(/\\/g, '/').split('/').filter(Boolean);
        const brief = parts.length > 2 ? parts.slice(-2).join('/') : searchPath;
        if (!seen.has(brief)) { seen.add(brief); summaries.push(brief); }
      }
    }

    // Glob: capture the pattern when it references a specific directory scope
    if (tc.name === 'Glob') {
      const globPath = typeof input.path === 'string' ? input.path : null;
      if (globPath && globPath !== '.' && globPath !== '/') {
        const parts = globPath.replace(/\\/g, '/').split('/').filter(Boolean);
        const brief = parts.length > 2 ? parts.slice(-2).join('/') : globPath;
        if (!seen.has(brief)) { seen.add(brief); summaries.push(brief); }
      }
    }

    // Bash: capture the first 80 chars of the command (shows CLI tools used)
    if (tc.name === 'Bash' && typeof input.command === 'string') {
      const cmd = input.command.trim().slice(0, 80);
      if (cmd && !seen.has(cmd)) { seen.add(cmd); summaries.push(cmd); }
    }

    if (summaries.length >= 6) break;
  }

  return summaries;
}

const SKILL_INJECTION_PREFIX = 'Base directory for this skill:';

function trimText(text: string | undefined, maxChars: number): string {
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

function isAnalyzablePromptContextUserMessage(message: SessionMessageWithMeta): boolean {
  return message.role === 'user'
    && !message.isMeta
    && typeof message.sourceToolUseID !== 'string'
    && message.toolUseResult === undefined
    && typeof message.content === 'string'
    && !message.content.trim().startsWith(SKILL_INJECTION_PREFIX);
}

function trimMessages(
  messages: ParsedSession['messages'],
  maxMessages: number,
  maxChars: number,
) {
  return messages.slice(0, maxMessages).map((message) => ({
    role: message.role,
    timestamp: message.timestamp,
    content: trimText(message.content, maxChars),
    ...(Array.isArray(message.toolCalls) && message.toolCalls.length > 0
      ? {
          toolCalls: message.toolCalls.slice(0, 5).map((toolCall) => ({
            id: toolCall.id,
            name: toolCall.name,
            ...(toolCall.isError ? { isError: true } : {}),
          })),
        }
      : {}),
    ...(message.tokenUsage ? { tokenUsage: message.tokenUsage } : {}),
  }));
}

// Target ~120k tokens for domain analysis payloads (Haiku-class: 200k context).
// Leaves ~80k tokens for SKILL.md instructions + generation + safety margin.
const MAX_UTTERANCES = 500;
const MAX_INTERACTION_SNAPSHOTS = 200;
const MAX_SESSION_OVERVIEWS = 60;
const MAX_SESSION_TRANSCRIPTS = 40;

function buildTrimmedDeveloperUtterances(
  phase1Output: Phase1Output,
  maxChars: number,
) {
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
    timestamp: utterance.timestamp,
  }));
}

function asSessionMessageWithMeta(
  message: ParsedSession['messages'][number],
): SessionMessageWithMeta {
  return message as SessionMessageWithMeta;
}

function buildSessionOverviews(phase1Output: Phase1Output) {
  return (phase1Output.sessions ?? []).slice(0, MAX_SESSION_OVERVIEWS).map((session) => {
    const messages = session.messages.map(asSessionMessageWithMeta);
    const userMessages = messages.filter(isAnalyzablePromptContextUserMessage);
    const assistantMessages = messages.filter((message) => message.role === 'assistant');
    const firstAssistant = assistantMessages[0];
    const toolSequence = assistantMessages
      .flatMap((message) => message.toolCalls?.map((toolCall) => toolCall.name) ?? [])
      .filter((toolName, index, all) => all.indexOf(toolName) === index)
      .slice(0, 10);
    const peakAssistantInputTokens = assistantMessages.reduce(
      (max, message) => Math.max(max, message.tokenUsage?.input ?? 0),
      0,
    );
    const peakContextFillPercent = peakAssistantInputTokens > 0
      ? Math.round((peakAssistantInputTokens / CONTEXT_WINDOW_SIZE) * 1000) / 10
      : undefined;

    return {
      sessionId: session.sessionId,
      projectName: session.projectName ?? 'unknown',
      startTime: session.startTime,
      endTime: session.endTime,
      durationSeconds: session.durationSeconds,
      stats: {
        userMessageCount: userMessages.length,
        assistantMessageCount: assistantMessages.length,
        toolCallCount: session.stats.toolCallCount,
        uniqueToolsUsed: session.stats.uniqueToolsUsed,
        totalInputTokens: session.stats.totalInputTokens,
        totalOutputTokens: session.stats.totalOutputTokens,
      },
      firstUserMessage: trimText(userMessages[0]?.content, 350),
      firstAssistantPreview: trimText(firstAssistant?.content, 350),
      firstAssistantAskedQuestion: Boolean(firstAssistant?.content?.includes('?')),
      assistantErrorCount: assistantMessages.reduce(
        (count, message) => count + (message.toolCalls?.some((toolCall) => toolCall.isError) ? 1 : 0),
        0,
      ),
      toolSequence,
      peakContextFillPercent,
    };
  });
}

function buildInteractionSnapshots(
  phase1Output: Phase1Output,
  options?: { maxUserChars?: number; maxAssistantChars?: number },
) {
  const { maxUserChars = 260, maxAssistantChars = 220 } = options ?? {};

  // Build O(1) lookup index from pre-computed Phase 1 evidence contexts.
  // The evidence contexts provide concrete tool call details (file paths,
  // commands, error text), context fill %, and cumulative error counts
  // needed by LLM extract workers to construct Evidence field context anchors.
  const evidenceContextIndex: Map<string, UtteranceEvidenceContext> | null =
    phase1Output.evidenceContexts
      ? buildEvidenceContextIndex(phase1Output.evidenceContexts)
      : null;

  const snapshots = (phase1Output.sessions ?? []).flatMap((session) => {
    const messages = session.messages.map(asSessionMessageWithMeta);
    return messages.flatMap((message, index) => {
      if (!isAnalyzablePromptContextUserMessage(message)) {
        return [];
      }

      // Extract utteranceId once so we can use it both in the snapshot and
      // for evidence context lookup without recomputing.
      const utteranceId = `${session.sessionId}_${index}`;

      const precedingAssistant = [...messages.slice(0, index)]
        .reverse()
        .find((candidate) => candidate.role === 'assistant');

      // Look up the pre-computed evidence context for this utterance.
      // Present when Phase 1 extraction ran with evidence context building enabled.
      const evidenceCtx: UtteranceEvidenceContext | undefined =
        evidenceContextIndex?.get(utteranceId);

      return [{
        utteranceId,
        sessionId: session.sessionId,
        projectName: session.projectName ?? 'unknown',
        turnIndex: index,
        /**
         * ISO timestamp of the message — enables evidence moments to carry
         * explicit session time for temporal verification of distinctness.
         * LLM extract/write stages should propagate this into evidenceMoments.
         */
        timestamp: message.timestamp,
        text: trimText(message.content, maxUserChars),
        characterCount: message.content.length,
        hasQuestion: message.content.includes('?'),
        isSessionStart: !messages.slice(0, index).some(isAnalyzablePromptContextUserMessage),
        precedingAssistantPreview: trimText(precedingAssistant?.content, maxAssistantChars),
        precedingAssistantLength: precedingAssistant?.content?.length ?? 0,
        precedingAssistantHadCodeBlock: Boolean(precedingAssistant?.content?.includes('```')),
        precedingAIToolCalls: precedingAssistant?.toolCalls?.map((toolCall) => toolCall.name).slice(0, 8),
        /**
         * Specific file paths and command summaries from preceding tool call inputs.
         *
         * Provides file-level granularity for the tool_file_naming rubric:
         * - File paths from Read/Edit/Write calls (e.g. "middleware/auth.ts")
         * - Bash commands showing which CLI tools were run (e.g. "npm test")
         * - Grep/Glob search scope when scoped to a specific path
         *
         * Extract skills: look up by matching utteranceId and use these entries
         * alongside toolCallsBefore to populate toolsFilesApis with specific files,
         * not just tool names. Example: if precedingAIToolInputSummaries contains
         * "middleware/auth.ts", include it in the extracted quote's toolCallsBefore
         * and in the growth area's toolsFilesApis array.
         */
        precedingAIToolInputSummaries: precedingAssistant?.toolCalls
          ? extractToolInputSummaries(
              precedingAssistant.toolCalls
                .filter((tc): tc is { name: string; input: Record<string, unknown>; id: string } =>
                  typeof tc.input === 'object' && tc.input !== null,
                ),
            )
          : undefined,
        precedingAIHadError: precedingAssistant?.toolCalls?.some((toolCall) => toolCall.isError) ?? false,
        // ── Evidence enrichment from Phase 1 evidence contexts ────────────
        // These fields supply concrete session JSONL data for constructing
        // specific Evidence field context anchors in PEA growth areas.
        // Extract workers should use these to build context strings like:
        //   "In the {projectName} project, after Read(src/auth.ts) then Bash(npm test)"
        ...(evidenceCtx ? {
          /**
           * Structured tool call sequence with concrete parameters.
           * Each entry: {name, detail, isError?, errorText?}
           *
           * detail provides:
           * - file path for Read/Edit/Write (e.g. "src/middleware/auth.ts")
           * - "pattern [in path]" for Grep/Glob
           * - command (truncated) for Bash
           * - description (truncated) for Task/Agent
           *
           * Use this to construct evidence context anchors:
           * "after Read(auth.ts) then Bash(npm test)"
           * "after Edit(middleware/stripe.ts) [with 1 error]"
           */
          precedingToolDetails: evidenceCtx.precedingToolSequence,
          /**
           * Context window fill % at this utterance (0-100).
           * Cite in evidence: "when context was {contextFillPercent}% full".
           * Absent when token usage data is unavailable.
           */
          ...(evidenceCtx.contextFillPercent !== undefined
            ? { contextFillPercent: evidenceCtx.contextFillPercent }
            : {}),
          /**
           * Cumulative tool call errors in session up to this point.
           * Cite in evidence: "after {cumulativeErrorCount} tool failures in this session".
           * Use with errorChainMaxLength to detect error spiral patterns.
           */
          cumulativeErrorCount: evidenceCtx.cumulativeErrorCount,
          /**
           * 1-indexed user turn number within this session.
           * Cite in evidence: "turn {sessionTurnNumber} of the session".
           * Distinguishes "first message" from "mid-session correction" patterns.
           */
          sessionTurnNumber: evidenceCtx.sessionTurnNumber,
          /**
           * Seconds elapsed since session start at this utterance.
           * Convert to minutes: Math.round(sessionDurationAtTurnSec / 60).
           * Cite in evidence: "after {N} minutes into the session".
           */
          ...(evidenceCtx.sessionDurationAtTurnSec !== undefined
            ? { sessionDurationAtTurnSec: evidenceCtx.sessionDurationAtTurnSec }
            : {}),
        } : {}),
      }];
    });
  });

  return snapshots.slice(0, MAX_INTERACTION_SNAPSHOTS);
}

function buildUtteranceLookup(phase1Output: Phase1Output): Record<string, string> {
  return Object.fromEntries(
    phase1Output.developerUtterances.map((utterance) => [
      utterance.id,
      utterance.displayText || utterance.text,
    ]),
  );
}

function buildTrimmedSessionInput(
  phase1Output: Phase1Output,
  maxSessions?: number,
  maxMsgChars?: number,
) {
  const sessions = maxSessions
    ? (phase1Output.sessions ?? []).slice(0, maxSessions)
    : (phase1Output.sessions ?? []);
  const msgChars = maxMsgChars ?? 700;
  return sessions.map((session) => ({
    sessionId: session.sessionId,
    projectPath: session.projectPath,
    projectName: session.projectName ?? 'unknown',
    startTime: session.startTime,
    endTime: session.endTime,
    durationSeconds: session.durationSeconds,
    source: session.source,
    stats: session.stats,
    messages: trimMessages(session.messages, 10, msgChars),
  }));
}

function buildCondensedDomainResults(
  domainResults: DomainResult[],
  options?: {
    maxStrengths?: number;
    maxGrowthAreas?: number;
    maxDescriptionChars?: number;
    maxRecommendationChars?: number;
  },
) {
  const {
    maxStrengths = 2,
    maxGrowthAreas = 2,
    maxDescriptionChars = 420,
    maxRecommendationChars = 260,
  } = options ?? {};

  return domainResults.map((result) => ({
    domain: result.domain,
    overallScore: result.overallScore,
    confidenceScore: result.confidenceScore,
    strengths: result.strengths.slice(0, maxStrengths).map((strength) => ({
      title: strength.title,
      description: trimText(strength.description, maxDescriptionChars),
      evidenceCount: strength.evidence.length,
    })),
    growthAreas: result.growthAreas.slice(0, maxGrowthAreas).map((growthArea) => ({
      title: growthArea.title,
      description: trimText(growthArea.description, maxDescriptionChars),
      severity: growthArea.severity,
      recommendation: trimText(growthArea.recommendation, maxRecommendationChars),
      evidenceCount: growthArea.evidence.length,
    })),
    analyzedAt: result.analyzedAt,
  }));
}

function buildCondensedContentWriterStageOutputs(stageOutputs: CanonicalStageOutputs) {
  return {
    typeClassification: stageOutputs.typeClassification
      ? {
          collaborationMaturity: stageOutputs.typeClassification.collaborationMaturity,
          reasoning: stageOutputs.typeClassification.reasoning.slice(0, 3).map((paragraph) => trimText(paragraph, 600)),
          personalityNarrative: stageOutputs.typeClassification.personalityNarrative
            .slice(0, 3)
            .map((paragraph) => trimText(paragraph, 600)),
        }
      : undefined,
    weeklyInsights: stageOutputs.weeklyInsights
      ? {
          stats: stageOutputs.weeklyInsights.stats,
          projects: stageOutputs.weeklyInsights.projects,
          topSessions: stageOutputs.weeklyInsights.topSessions,
          narrative: trimText(stageOutputs.weeklyInsights.narrative, 800),
          highlights: stageOutputs.weeklyInsights.highlights.slice(0, 8).map((item) => trimText(item, 250)),
        }
      : undefined,
    projectSummaries: stageOutputs.projectSummaries,
    evidenceVerification: stageOutputs.evidenceVerification
      ? {
          threshold: stageOutputs.evidenceVerification.threshold,
          domainStats: stageOutputs.evidenceVerification.domainStats,
          verifiedEvidenceCount: stageOutputs.evidenceVerification.verifiedResults.length,
        }
      : undefined,
  };
}

function buildThinkingQualityContext(phase1Output: Phase1Output) {
  return {
    developerUtterances: buildTrimmedDeveloperUtterances(phase1Output, 700),
    sessionMetrics: phase1Output.sessionMetrics,
    sessionOverviews: buildSessionOverviews(phase1Output),
    interactionSnapshots: buildInteractionSnapshots(phase1Output, {
      maxUserChars: 400,
      maxAssistantChars: 300,
    }),
    ...(phase1Output.aiInsightBlocks?.length
      ? {
          aiInsightBlocks: phase1Output.aiInsightBlocks.slice(0, 25).map((block) => ({
            sessionId: block.sessionId,
            turnIndex: block.turnIndex,
            content: trimText(block.content, 250),
            triggeringUtteranceId: block.triggeringUtteranceId,
          })),
        }
      : {}),
  };
}

function buildCommunicationContext(phase1Output: Phase1Output) {
  return {
    developerUtterances: buildTrimmedDeveloperUtterances(phase1Output, 600),
    sessionMetrics: phase1Output.sessionMetrics,
    sessionOverviews: buildSessionOverviews(phase1Output),
    interactionSnapshots: buildInteractionSnapshots(phase1Output, {
      maxUserChars: 350,
      maxAssistantChars: 250,
    }),
  };
}

function buildLearningContext(phase1Output: Phase1Output) {
  return {
    sessionMetrics: phase1Output.sessionMetrics,
    developerUtterances: buildTrimmedDeveloperUtterances(phase1Output, 700),
    sessionOverviews: buildSessionOverviews(phase1Output),
    interactionSnapshots: buildInteractionSnapshots(phase1Output, {
      maxUserChars: 380,
      maxAssistantChars: 300,
    }),
    ...(phase1Output.aiInsightBlocks?.length
      ? {
          aiInsightBlocks: phase1Output.aiInsightBlocks.slice(0, 40).map((block) => ({
            sessionId: block.sessionId,
            turnIndex: block.turnIndex,
            content: trimText(block.content, 350),
            triggeringUtteranceId: block.triggeringUtteranceId,
          })),
        }
      : {}),
    sessions: buildTrimmedSessionInput(phase1Output, MAX_SESSION_TRANSCRIPTS, 500),
  };
}

function buildEfficiencyContext(phase1Output: Phase1Output) {
  return {
    sessionMetrics: phase1Output.sessionMetrics,
    activitySessions: phase1Output.activitySessions ?? [],
    sessionOverviews: buildSessionOverviews(phase1Output),
    interactionSnapshots: buildInteractionSnapshots(phase1Output, {
      maxUserChars: 350,
      maxAssistantChars: 250,
    }),
    developerUtterances: buildTrimmedDeveloperUtterances(phase1Output, 600),
    sessions: buildTrimmedSessionInput(phase1Output, MAX_SESSION_TRANSCRIPTS, 500),
  };
}

function buildSessionOutcomeContext(phase1Output: Phase1Output) {
  return {
    sessionMetrics: phase1Output.sessionMetrics,
    activitySessions: phase1Output.activitySessions ?? [],
    sessionOverviews: buildSessionOverviews(phase1Output),
    sessions: buildTrimmedSessionInput(phase1Output, MAX_SESSION_TRANSCRIPTS, 500),
  };
}

function buildSessionMasteryContext(phase1Output: Phase1Output) {
  return {
    sessionMetrics: phase1Output.sessionMetrics,
    activitySessions: phase1Output.activitySessions ?? [],
    sessionOverviews: buildSessionOverviews(phase1Output),
    interactionSnapshots: buildInteractionSnapshots(phase1Output, {
      maxUserChars: 300,
      maxAssistantChars: 220,
    }),
    sessions: buildTrimmedSessionInput(phase1Output, MAX_SESSION_TRANSCRIPTS, 400),
  };
}

function buildDomainAnalysisContext(
  domain: PromptContextDomain,
  phase1Output: Phase1Output,
  deterministicScores: DeterministicScores,
) {
  const base = {
    domain,
    deterministicScores,
    dateRange: phase1Output.sessionMetrics.dateRange,
    ...(phase1Output.sessionMetrics.expertSignals
      ? { expertSignals: phase1Output.sessionMetrics.expertSignals }
      : {}),
  };

  switch (domain) {
    case 'aiPartnership':
      // Merged thinking + control: needs full interaction data + AI insight blocks
      return { ...base, phase1: {
        ...buildThinkingQualityContext(phase1Output),
        activitySessions: phase1Output.activitySessions ?? [],
      } };
    case 'sessionCraft':
      // Merged context efficiency + burnout: needs efficiency + learning context
      return { ...base, phase1: {
        ...buildEfficiencyContext(phase1Output),
        ...(phase1Output.aiInsightBlocks?.length
          ? {
              aiInsightBlocks: phase1Output.aiInsightBlocks.slice(0, 30).map((block) => ({
                sessionId: block.sessionId,
                turnIndex: block.turnIndex,
                content: trimText(block.content, 300),
                triggeringUtteranceId: block.triggeringUtteranceId,
              })),
            }
          : {}),
      } };
    case 'toolMastery':
      // Tool mastery analysis uses the communication context (utterances + interaction snapshots)
      // because tool usage patterns are best observed through developer-AI dialogue.
      return { ...base, phase1: buildCommunicationContext(phase1Output) };
    case 'skillResilience':
      // Cold-start, error recovery: needs session overviews + interaction data
      return { ...base, phase1: buildLearningContext(phase1Output) };
    case 'sessionMastery':
      // Absence scoring: needs session-level anti-pattern data
      return { ...base, phase1: buildSessionMasteryContext(phase1Output) };
  }
}

export function buildPromptContext(input: PromptContextInput): Record<string, unknown> {
  const {
    kind,
    phase1Output,
    deterministicScores,
    typeResult,
    domainResults,
    stageOutputs,
    domain,
  } = input;

  const base = {
    kind,
    availableDomains: domainResults.map((result) => result.domain),
    availableStages: Object.keys(stageOutputs).filter(
      (key) => stageOutputs[key as keyof CanonicalStageOutputs] !== undefined,
    ),
  };

  switch (kind) {
    case 'sessionSummaries':
      return {
        ...base,
        phase1: {
          sessionMetrics: phase1Output.sessionMetrics,
          sessions: buildTrimmedSessionInput(phase1Output),
          activitySessions: phase1Output.activitySessions ?? [],
        },
      };
    case 'domainAnalysis':
      if (!domain) {
        throw new Error('Domain is required when kind=domainAnalysis.');
      }
      return {
        ...base,
        ...buildDomainAnalysisContext(domain, phase1Output, deterministicScores),
      };
    case 'projectSummaries':
      return {
        ...base,
        activitySessions: phase1Output.activitySessions ?? [],
        sessionSummaries: stageOutputs.sessionSummaries ?? { summaries: [] },
      };
    case 'weeklyInsights':
      return {
        ...base,
        activitySessions: phase1Output.activitySessions ?? [],
        sessionSummaries: stageOutputs.sessionSummaries ?? { summaries: [] },
      };
    case 'typeClassification':
      return {
        ...base,
        deterministicScores,
        deterministicType: typeResult,
        sessionMetrics: phase1Output.sessionMetrics,
        domainResults: buildCondensedDomainResults(domainResults, {
          maxStrengths: 3,
          maxGrowthAreas: 3,
          maxDescriptionChars: 600,
          maxRecommendationChars: 400,
        }),
      };
    case 'evidenceVerification':
      return {
        ...base,
        utteranceLookup: buildUtteranceLookup(phase1Output),
        domainResults,
      };
    case 'contentWriter':
      return {
        ...base,
        deterministicType: typeResult,
        domainResults: buildCondensedDomainResults(domainResults, {
          maxStrengths: 3,
          maxGrowthAreas: 3,
          maxDescriptionChars: 700,
          maxRecommendationChars: 500,
        }),
        stageOutputs: buildCondensedContentWriterStageOutputs(stageOutputs),
      };
    case 'translation':
      return {
        ...base,
        languageSample: phase1Output.developerUtterances
          .slice(-50)
          .map((utterance) => utterance.displayText || utterance.text),
        deterministicType: typeResult,
        domainResults,
        stageOutputs,
      };
  }
}
