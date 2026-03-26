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
} from './core/types.js';
import { CONTEXT_WINDOW_SIZE } from './core/types.js';

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

// Caps to keep domainAnalysis payloads under ~80k tokens for haiku-class models.
// Tune these if analysis quality degrades or rate limits persist.
const MAX_UTTERANCES = 300;
const MAX_INTERACTION_SNAPSHOTS = 200;
const MAX_SESSION_OVERVIEWS = 40;

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
      firstUserMessage: trimText(userMessages[0]?.content, 220),
      firstAssistantPreview: trimText(firstAssistant?.content, 220),
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

  const snapshots = (phase1Output.sessions ?? []).flatMap((session) => {
    const messages = session.messages.map(asSessionMessageWithMeta);
    return messages.flatMap((message, index) => {
      if (!isAnalyzablePromptContextUserMessage(message)) {
        return [];
      }

      const precedingAssistant = [...messages.slice(0, index)]
        .reverse()
        .find((candidate) => candidate.role === 'assistant');

      return [{
        utteranceId: `${session.sessionId}_${index}`,
        sessionId: session.sessionId,
        projectName: session.projectName ?? 'unknown',
        turnIndex: index,
        text: trimText(message.content, maxUserChars),
        characterCount: message.content.length,
        hasQuestion: message.content.includes('?'),
        isSessionStart: !messages.slice(0, index).some(isAnalyzablePromptContextUserMessage),
        precedingAssistantPreview: trimText(precedingAssistant?.content, maxAssistantChars),
        precedingAssistantLength: precedingAssistant?.content?.length ?? 0,
        precedingAssistantHadCodeBlock: Boolean(precedingAssistant?.content?.includes('```')),
        precedingAIToolCalls: precedingAssistant?.toolCalls?.map((toolCall) => toolCall.name).slice(0, 8),
        precedingAIHadError: precedingAssistant?.toolCalls?.some((toolCall) => toolCall.isError) ?? false,
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

function buildTrimmedSessionInput(phase1Output: Phase1Output) {
  return (phase1Output.sessions ?? []).map((session) => ({
    sessionId: session.sessionId,
    projectPath: session.projectPath,
    projectName: session.projectName ?? 'unknown',
    startTime: session.startTime,
    endTime: session.endTime,
    durationSeconds: session.durationSeconds,
    source: session.source,
    stats: session.stats,
    messages: trimMessages(session.messages, 12, 700),
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
          reasoning: stageOutputs.typeClassification.reasoning.slice(0, 1).map((paragraph) => trimText(paragraph, 500)),
          personalityNarrative: stageOutputs.typeClassification.personalityNarrative
            .slice(0, 1)
            .map((paragraph) => trimText(paragraph, 500)),
        }
      : undefined,
    weeklyInsights: stageOutputs.weeklyInsights
      ? {
          stats: stageOutputs.weeklyInsights.stats,
          projects: stageOutputs.weeklyInsights.projects,
          topSessions: stageOutputs.weeklyInsights.topSessions,
          narrative: trimText(stageOutputs.weeklyInsights.narrative, 600),
          highlights: stageOutputs.weeklyInsights.highlights.slice(0, 5).map((item) => trimText(item, 180)),
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
    developerUtterances: buildTrimmedDeveloperUtterances(phase1Output, 280),
    sessionMetrics: phase1Output.sessionMetrics,
    sessionOverviews: buildSessionOverviews(phase1Output),
    interactionSnapshots: buildInteractionSnapshots(phase1Output, {
      maxUserChars: 260,
      maxAssistantChars: 200,
    }),
    ...(phase1Output.aiInsightBlocks?.length
      ? {
          aiInsightBlocks: phase1Output.aiInsightBlocks.slice(0, 20).map((block) => ({
            sessionId: block.sessionId,
            turnIndex: block.turnIndex,
            content: trimText(block.content, 180),
            triggeringUtteranceId: block.triggeringUtteranceId,
          })),
        }
      : {}),
  };
}

function buildCommunicationContext(phase1Output: Phase1Output) {
  return {
    developerUtterances: buildTrimmedDeveloperUtterances(phase1Output, 260),
    sessionMetrics: phase1Output.sessionMetrics,
    sessionOverviews: buildSessionOverviews(phase1Output),
    interactionSnapshots: buildInteractionSnapshots(phase1Output, {
      maxUserChars: 220,
      maxAssistantChars: 160,
    }),
  };
}

function buildLearningContext(phase1Output: Phase1Output) {
  return {
    sessionMetrics: phase1Output.sessionMetrics,
    developerUtterances: buildTrimmedDeveloperUtterances(phase1Output, 260),
    sessionOverviews: buildSessionOverviews(phase1Output),
    interactionSnapshots: buildInteractionSnapshots(phase1Output, {
      maxUserChars: 240,
      maxAssistantChars: 200,
    }),
    ...(phase1Output.aiInsightBlocks?.length
      ? {
          aiInsightBlocks: phase1Output.aiInsightBlocks.slice(0, 24).map((block) => ({
            sessionId: block.sessionId,
            turnIndex: block.turnIndex,
            content: trimText(block.content, 200),
            triggeringUtteranceId: block.triggeringUtteranceId,
          })),
        }
      : {}),
  };
}

function buildEfficiencyContext(phase1Output: Phase1Output) {
  return {
    sessionMetrics: phase1Output.sessionMetrics,
    activitySessions: phase1Output.activitySessions ?? [],
    sessionOverviews: buildSessionOverviews(phase1Output),
    interactionSnapshots: buildInteractionSnapshots(phase1Output, {
      maxUserChars: 220,
      maxAssistantChars: 160,
    }),
    developerUtterances: buildTrimmedDeveloperUtterances(phase1Output, 240),
  };
}

function buildSessionOutcomeContext(phase1Output: Phase1Output) {
  return {
    sessionMetrics: phase1Output.sessionMetrics,
    activitySessions: phase1Output.activitySessions ?? [],
    sessionOverviews: buildSessionOverviews(phase1Output),
  };
}

function buildSessionMasteryContext(phase1Output: Phase1Output) {
  return {
    sessionMetrics: phase1Output.sessionMetrics,
    activitySessions: phase1Output.activitySessions ?? [],
    sessionOverviews: buildSessionOverviews(phase1Output),
    interactionSnapshots: buildInteractionSnapshots(phase1Output, {
      maxUserChars: 200,
      maxAssistantChars: 160,
    }),
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
              aiInsightBlocks: phase1Output.aiInsightBlocks.slice(0, 24).map((block) => ({
                sessionId: block.sessionId,
                turnIndex: block.turnIndex,
                content: trimText(block.content, 200),
                triggeringUtteranceId: block.triggeringUtteranceId,
              })),
            }
          : {}),
      } };
    case 'toolMastery':
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
          maxStrengths: 2,
          maxGrowthAreas: 2,
          maxDescriptionChars: 420,
          maxRecommendationChars: 260,
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
          maxStrengths: 2,
          maxGrowthAreas: 2,
          maxDescriptionChars: 520,
          maxRecommendationChars: 320,
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
