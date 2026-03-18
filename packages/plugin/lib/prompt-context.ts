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
  | 'thinkingQuality'
  | 'communicationPatterns'
  | 'learningBehavior'
  | 'contextEfficiency'
  | 'sessionOutcome';

interface PromptContextInput {
  kind: PromptContextKind;
  phase1Output: Phase1Output;
  deterministicScores: DeterministicScores;
  typeResult: DeterministicTypeResult | null;
  domainResults: DomainResult[];
  stageOutputs: CanonicalStageOutputs;
  domain?: PromptContextDomain;
}

function trimText(text: string | undefined, maxChars: number): string {
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
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

function buildThinkingQualityContext(phase1Output: Phase1Output) {
  return {
    developerUtterances: phase1Output.developerUtterances.map((utterance) => ({
      id: utterance.id,
      text: trimText(utterance.displayText || utterance.text, 1000),
      sessionId: utterance.sessionId,
      turnIndex: utterance.turnIndex,
      wordCount: utterance.wordCount,
      hasCodeBlock: utterance.hasCodeBlock,
      hasQuestion: utterance.hasQuestion,
      isSessionStart: utterance.isSessionStart,
      isContinuation: utterance.isContinuation,
      precedingAIHadError: utterance.precedingAIHadError,
      timestamp: utterance.timestamp,
    })),
    sessionMetrics: phase1Output.sessionMetrics,
    ...(phase1Output.aiInsightBlocks?.length
      ? {
          aiInsightBlocks: phase1Output.aiInsightBlocks.slice(0, 20).map((block) => ({
            sessionId: block.sessionId,
            turnIndex: block.turnIndex,
            content: trimText(block.content, 200),
            triggeringUtteranceId: block.triggeringUtteranceId,
          })),
        }
      : {}),
  };
}

function buildCommunicationContext(phase1Output: Phase1Output) {
  return {
    developerUtterances: phase1Output.developerUtterances.map((utterance) => ({
      id: utterance.id,
      text: trimText(utterance.displayText || utterance.text, 1000),
      sessionId: utterance.sessionId,
      turnIndex: utterance.turnIndex,
      wordCount: utterance.wordCount,
      hasCodeBlock: utterance.hasCodeBlock,
      hasQuestion: utterance.hasQuestion,
      isSessionStart: utterance.isSessionStart,
      isContinuation: utterance.isContinuation,
      timestamp: utterance.timestamp,
    })),
    sessionMetrics: phase1Output.sessionMetrics,
  };
}

function buildLearningContext(phase1Output: Phase1Output) {
  return {
    sessionMetrics: phase1Output.sessionMetrics,
    developerUtterances: phase1Output.developerUtterances.map((utterance) => ({
      id: utterance.id,
      sessionId: utterance.sessionId,
      turnIndex: utterance.turnIndex,
      text: trimText(utterance.displayText || utterance.text, 1000),
      hasQuestion: utterance.hasQuestion,
      precedingAIToolCalls: utterance.precedingAIToolCalls?.slice(0, 8),
      precedingAIHadError: utterance.precedingAIHadError,
      timestamp: utterance.timestamp,
    })),
    ...(phase1Output.aiInsightBlocks?.length
      ? {
          aiInsightBlocks: phase1Output.aiInsightBlocks.slice(0, 40).map((block) => ({
            sessionId: block.sessionId,
            turnIndex: block.turnIndex,
            content: trimText(block.content, 400),
            triggeringUtteranceId: block.triggeringUtteranceId,
          })),
        }
      : {}),
    sessions: buildTrimmedSessionInput(phase1Output),
  };
}

function buildEfficiencyContext(phase1Output: Phase1Output) {
  return {
    sessionMetrics: phase1Output.sessionMetrics,
    activitySessions: phase1Output.activitySessions ?? [],
    sessions: buildTrimmedSessionInput(phase1Output),
    developerUtterances: phase1Output.developerUtterances.map((utterance) => ({
      id: utterance.id,
      sessionId: utterance.sessionId,
      turnIndex: utterance.turnIndex,
      text: trimText(utterance.displayText || utterance.text, 800),
      characterCount: utterance.characterCount,
      wordCount: utterance.wordCount,
      hasCodeBlock: utterance.hasCodeBlock,
      hasQuestion: utterance.hasQuestion,
      precedingAIToolCalls: utterance.precedingAIToolCalls?.slice(0, 8),
      timestamp: utterance.timestamp,
    })),
  };
}

function buildSessionOutcomeContext(phase1Output: Phase1Output) {
  return {
    sessionMetrics: phase1Output.sessionMetrics,
    activitySessions: phase1Output.activitySessions ?? [],
    sessions: buildTrimmedSessionInput(phase1Output),
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
    case 'thinkingQuality':
      return { ...base, phase1: buildThinkingQualityContext(phase1Output) };
    case 'communicationPatterns':
      return { ...base, phase1: buildCommunicationContext(phase1Output) };
    case 'learningBehavior':
      return { ...base, phase1: buildLearningContext(phase1Output) };
    case 'contextEfficiency':
      return { ...base, phase1: buildEfficiencyContext(phase1Output) };
    case 'sessionOutcome':
      return { ...base, phase1: buildSessionOutcomeContext(phase1Output) };
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
        domainResults,
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
        domainResults,
        stageOutputs: {
          typeClassification: stageOutputs.typeClassification,
          weeklyInsights: stageOutputs.weeklyInsights,
          projectSummaries: stageOutputs.projectSummaries,
          evidenceVerification: stageOutputs.evidenceVerification,
        },
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
