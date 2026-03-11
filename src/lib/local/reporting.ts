import type { TypeResult } from '@/lib/models/coding-style';
import type { VerboseEvaluation } from '@/lib/models/verbose-evaluation';
import type { WorkerInsightsContainer } from '@/lib/models/worker-insights';
import { aggregateWorkerInsights } from '@/lib/models/agent-outputs';
import type { StoredAnalysisResult } from './analysis-store';

type DomainScoreMap = Record<string, WorkerInsightsContainer | undefined>;

export function buildTypeResultFromEvaluation(evaluation: VerboseEvaluation): TypeResult {
  return {
    primaryType: evaluation.primaryType,
    distribution: evaluation.distribution,
    metrics: {
      avgPromptLength: evaluation.avgPromptLength ?? 0,
      avgFirstPromptLength: 0,
      avgTurnsPerSession: evaluation.avgTurnsPerSession ?? 0,
      questionFrequency: 0,
      modificationRate: 0,
      toolUsageHighlight: 'Local self-hosted analysis',
    },
    evidence: [],
    sessionCount: evaluation.sessionsAnalyzed,
    analyzedAt: evaluation.analyzedAt,
  };
}

export function getWorkerDomainScores(
  evaluation: VerboseEvaluation
): DomainScoreMap | null {
  if (evaluation.workerInsights) {
    return evaluation.workerInsights as DomainScoreMap;
  }

  if (evaluation.agentOutputs) {
    return aggregateWorkerInsights(evaluation.agentOutputs) as DomainScoreMap;
  }

  return null;
}

export function buildSessionMetadata(record: StoredAnalysisResult): {
  sessionId?: string;
  durationMinutes?: number;
  messageCount?: number;
  toolCallCount?: number;
} {
  const firstActivity = record.activitySessions?.[0];

  return {
    sessionId: firstActivity?.sessionId ?? record.evaluation.sessionId,
    durationMinutes: firstActivity?.durationMinutes,
    messageCount: firstActivity?.messageCount,
    toolCallCount: undefined,
  };
}
