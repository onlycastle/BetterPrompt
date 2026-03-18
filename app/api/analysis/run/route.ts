import { gunzipSync } from 'node:zlib';
import { NextRequest, NextResponse } from 'next/server';
import { VerboseAnalyzer } from '@/lib/analyzer/verbose-analyzer';
import type { AnalysisResult as PipelineAnalysisResult, ProgressCallback } from '@/lib/analyzer/orchestrator/types';
import { aggregateMetrics } from '@/lib/analyzer/type-detector';
import type { ParsedSession } from '@/lib/domain/models/analysis';
import { createAnalysisRecord } from '@/lib/local/analysis-store';
import { getCurrentUserFromRequest } from '@/lib/local/auth';
import type { CanonicalAnalysisRun, ReportActivitySession } from '@betterprompt/shared';
import {
  MATRIX_METADATA,
  MATRIX_NAMES,
  type AIControlLevel,
  type CodingStyleType,
} from '@/lib/models/coding-style';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnalysisMode = 'plugin' | 'server';

interface SerializedMessage {
  uuid: string;
  role: 'user' | 'assistant';
  timestamp: string;
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
    result?: string;
    isError?: boolean;
  }>;
  tokenUsage?: {
    input: number;
    output: number;
  };
}

interface SerializedSession {
  sessionId: string;
  projectPath: string;
  projectName: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  claudeCodeVersion: string;
  messages: SerializedMessage[];
  stats: {
    userMessageCount: number;
    assistantMessageCount: number;
    toolCallCount: number;
    uniqueToolsUsed: string[];
    totalInputTokens: number;
    totalOutputTokens: number;
  };
}

interface ActivitySessionInfo {
  sessionId: string;
  projectName: string;
  startTime: string;
  durationMinutes: number;
  messageCount: number;
  summary: string;
}

interface AnalysisRequest {
  sessions: SerializedSession[];
  activitySessions?: ActivitySessionInfo[];
  totalMessages: number;
  totalDurationMinutes: number;
  version?: number;
}

interface StageTokenUsage {
  stage: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface PipelineTokenUsage {
  stages: StageTokenUsage[];
  totals: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
  model: string;
  modelName: string;
}

interface AnalysisResponse {
  resultId: string;
  primaryType: string;
  controlLevel: string;
  controlScore: number;
  matrixName: string;
  matrixEmoji: string;
  distribution: Record<string, number>;
  personalitySummary: string;
  skillScores?: {
    thinking: number;
    communication: number;
    learning: number;
    context: number;
    control: number;
  };
  tokenUsage?: PipelineTokenUsage;
}

interface DebugPhaseOutput {
  phase: string;
  phaseName: string;
  completedAt: string;
  durationMs: number;
  data: unknown;
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
}

type SSEEvent =
  | { type: 'progress'; stage: string; progress: number; message: string }
  | { type: 'phase_preview'; phase: string; snippets: Array<{ label: string; text: string; icon: string }> }
  | { type: 'result'; data: AnalysisResponse }
  | { type: 'debug_phase'; data: DebugPhaseOutput }
  | { type: 'error'; code: string; message: string };

function formatSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function isGzipBuffer(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

function getAnalysisMode(): AnalysisMode {
  const rawMode = process.env.BETTERPROMPT_ANALYSIS_MODE?.trim().toLowerCase();
  return rawMode === 'server' ? 'server' : 'plugin';
}

function deserializeSession(data: SerializedSession): ParsedSession {
  return {
    sessionId: data.sessionId,
    projectPath: data.projectPath,
    startTime: new Date(data.startTime),
    endTime: new Date(data.endTime),
    durationSeconds: data.durationSeconds,
    claudeCodeVersion: data.claudeCodeVersion,
    messages: data.messages.map((message) => ({
      uuid: message.uuid,
      role: message.role,
      timestamp: new Date(message.timestamp),
      content: message.content,
      toolCalls: message.toolCalls,
      tokenUsage: message.tokenUsage,
    })),
    stats: data.stats,
  };
}

type AnalysisResultWithOptionalCanonical = PipelineAnalysisResult & {
  canonicalRun?: CanonicalAnalysisRun;
  activitySessions?: ReportActivitySession[];
};

function collectActivitySessions(
  result: AnalysisResultWithOptionalCanonical,
  body: AnalysisRequest,
): ReportActivitySession[] | undefined {
  if (Array.isArray(result.canonicalRun?.activitySessions)) {
    return result.canonicalRun.activitySessions;
  }

  if (Array.isArray(result.evaluation.activitySessions)) {
    return result.evaluation.activitySessions;
  }

  if (Array.isArray(result.activitySessions)) {
    return result.activitySessions;
  }

  return body.activitySessions;
}

async function runAnalysis(
  body: AnalysisRequest,
  geminiApiKey: string,
  userId: string,
  write: (event: SSEEvent) => void,
  debug: boolean,
  noTranslate: boolean,
): Promise<void> {
  write({
    type: 'progress',
    stage: 'parsing',
    progress: 10,
    message: `Loading ${body.sessions.length} pre-parsed session(s)...`,
  });

  const parsedSessions = body.sessions.map(deserializeSession);
  if (parsedSessions.length === 0) {
    write({
      type: 'error',
      code: 'NO_VALID_SESSIONS',
      message: 'No valid sessions found in request',
    });
    return;
  }

  write({
    type: 'progress',
    stage: 'parsing',
    progress: 30,
    message: `Loaded ${parsedSessions.length} sessions`,
  });

  const metrics = aggregateMetrics(parsedSessions);
  write({
    type: 'progress',
    stage: 'analyzing',
    progress: 40,
    message: 'Running AI analysis pipeline...',
  });

  let lastProgress = 40;
  let lastMessage = 'Running AI analysis pipeline...';
  let dotCount = 0;

  const onProgress: ProgressCallback = (_stage, progress, message) => {
    lastProgress = progress;
    lastMessage = message;
    dotCount = 0;
    write({
      type: 'progress',
      stage: 'analyzing',
      progress,
      message,
    });
  };

  const onPhasePreview = (
    phase: string,
    snippets: Array<{ label: string; text: string; icon: string }>,
  ) => {
    write({
      type: 'phase_preview',
      phase,
      snippets,
    });
  };

  const livenessInterval = setInterval(() => {
    dotCount = (dotCount % 3) + 1;
    write({
      type: 'progress',
      stage: 'analyzing',
      progress: lastProgress,
      message: lastMessage.replace(/\.{1,3}$/, '') + '.'.repeat(dotCount),
    });
  }, 1000);

  try {
    const analyzer = new VerboseAnalyzer({
      tier: 'enterprise',
      geminiApiKey,
      debug,
    });

    const analysisResult = (await analyzer.analyzeVerbose(parsedSessions, metrics, {
      tier: 'enterprise',
      onProgress,
      onPhasePreview,
      activitySessions: body.activitySessions,
      noTranslate,
    })) as AnalysisResultWithOptionalCanonical;

    if (debug && analysisResult.debugOutputs) {
      for (const debugOutput of analysisResult.debugOutputs) {
        write({ type: 'debug_phase', data: debugOutput });
      }
    }

    write({
      type: 'progress',
      stage: 'storing',
      progress: 90,
      message: 'Storing results...',
    });

    const activitySessions = collectActivitySessions(analysisResult, body);
    const canonicalRun = analysisResult.canonicalRun;
    const stored = canonicalRun
      ? createAnalysisRecord({
          userId,
          evaluation: analysisResult.evaluation,
          phase1Output: analysisResult.phase1Output as PipelineAnalysisResult['phase1Output'],
          canonicalRun,
          activitySessions,
        })
      : createAnalysisRecord({
          userId,
          evaluation: analysisResult.evaluation,
          phase1Output: analysisResult.phase1Output as PipelineAnalysisResult['phase1Output'],
          activitySessions,
        });

    write({
      type: 'progress',
      stage: 'complete',
      progress: 100,
      message: 'Analysis complete!',
    });

    const evaluation = analysisResult.evaluation;
    const primaryType = evaluation.primaryType as CodingStyleType;
    const controlLevel = (evaluation.controlLevel || 'navigator') as AIControlLevel;
    const controlScore =
      evaluation.controlScore ??
      evaluation.agentOutputs?.typeClassifier?.controlScore ??
      50;
    const matrixName =
      evaluation.agentOutputs?.typeClassifier?.matrixName ??
      MATRIX_NAMES[primaryType]?.[controlLevel] ??
      `${primaryType} ${controlLevel}`;
    const matrixEmoji =
      evaluation.agentOutputs?.typeClassifier?.matrixEmoji ??
      MATRIX_METADATA[primaryType]?.[controlLevel]?.emoji ??
      '🎯';

    const workerInsights = evaluation.workerInsights as Record<string, { domainScore?: number }> | undefined;
    const skillScores = workerInsights
      ? {
          thinking: workerInsights.thinkingQuality?.domainScore ?? 0,
          communication: workerInsights.communicationPatterns?.domainScore ?? 0,
          learning: workerInsights.learningBehavior?.domainScore ?? 0,
          context: workerInsights.contextEfficiency?.domainScore ?? 0,
          control: controlScore,
        }
      : undefined;

    write({
      type: 'result',
      data: {
        resultId: stored.resultId,
        primaryType,
        controlLevel,
        controlScore,
        matrixName,
        matrixEmoji,
        distribution: evaluation.distribution as Record<string, number>,
        personalitySummary: evaluation.personalitySummary,
        skillScores,
        tokenUsage: evaluation.pipelineTokenUsage as PipelineTokenUsage | undefined,
      },
    });
  } catch (error) {
    write({
      type: 'error',
      code: 'ANALYSIS_FAILED',
      message: error instanceof Error ? error.message : 'Analysis failed',
    });
  } finally {
    clearInterval(livenessInterval);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse | Response> {
  if (getAnalysisMode() !== 'server') {
    return NextResponse.json(
      {
        error: 'ANALYSIS_ROUTE_REMOVED',
        message: 'Server-side BetterPrompt analysis has been removed. Install the Claude Code plugin, run `/analyze` locally, and sync the canonical run with `sync_to_team` or `/api/analysis/sync` if you need dashboard storage.',
      },
      { status: 410 },
    );
  }

  const userId = getCurrentUserFromRequest(request).id;

  const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiApiKey) {
    return NextResponse.json(
      {
        error: 'SERVER_CONFIG_ERROR',
        message: 'GOOGLE_GEMINI_API_KEY is not configured on the self-hosted server',
      },
      { status: 500 },
    );
  }

  let body: AnalysisRequest;
  try {
    const rawBody = Buffer.from(await request.arrayBuffer());
    const decoded = request.headers.get('content-encoding') === 'gzip' || isGzipBuffer(rawBody)
      ? gunzipSync(rawBody)
      : rawBody;
    body = JSON.parse(decoded.toString('utf-8')) as AnalysisRequest;
  } catch (error) {
    return NextResponse.json(
      {
        error: 'INVALID_PAYLOAD',
        message: error instanceof Error ? error.message : 'Failed to parse request body',
      },
      { status: 400 },
    );
  }

  if (!body.sessions?.length) {
    return NextResponse.json(
      { error: 'NO_VALID_SESSIONS', message: 'No valid sessions found in request' },
      { status: 400 },
    );
  }

  const debug = request.headers.get('x-debug') === '1';
  const noTranslate =
    request.nextUrl.searchParams.get('noTranslate') === '1' ||
    request.headers.get('x-no-translate') === '1';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const write = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(formatSSE(event)));
      };

      void runAnalysis(body, geminiApiKey, userId, write, debug, noTranslate)
        .finally(() => {
          controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
