import { NextResponse } from 'next/server';
import type { PersonalAnalytics, AnalysisSummary, HistoryEntry, WorkerDomainScores } from '@/types/personal';
import type { CodingStyleType, AIControlLevel } from '@/types/enterprise';
import { listAnalysesForUser, type StoredAnalysisResult } from '@/lib/local/analysis-store';
import { getCurrentUserFromRequest } from '@/lib/local/auth';

const WORKER_DOMAIN_KEYS = [
  'thinkingQuality',
  'communicationPatterns',
  'learningBehavior',
  'contextEfficiency',
  'sessionOutcome',
] as const;

function extractWorkerDomainScores(
  evaluation: StoredAnalysisResult['evaluation']
): WorkerDomainScores | null {
  const workerInsights = evaluation.workerInsights as Record<string, { domainScore?: number }> | undefined;
  if (!workerInsights) {
    return null;
  }

  const scores: Partial<WorkerDomainScores> = {};
  for (const key of WORKER_DOMAIN_KEYS) {
    if (workerInsights[key]?.domainScore != null) {
      scores[key] = workerInsights[key].domainScore;
    }
  }

  if (Object.keys(scores).length < 3) {
    return null;
  }

  return {
    thinkingQuality: scores.thinkingQuality ?? 50,
    communicationPatterns: scores.communicationPatterns ?? 50,
    learningBehavior: scores.learningBehavior ?? 50,
    contextEfficiency: scores.contextEfficiency ?? 50,
    sessionOutcome: scores.sessionOutcome ?? 50,
  };
}

function calculateOverallScore(domainScores: WorkerDomainScores): number {
  const total =
    domainScores.thinkingQuality +
    domainScores.communicationPatterns +
    domainScores.learningBehavior +
    domainScores.contextEfficiency +
    domainScores.sessionOutcome;
  return Math.round(total / 5);
}

function calculateStreak(dates: Date[]): { current: number; longest: number } {
  if (dates.length === 0) return { current: 0, longest: 0 };
  if (dates.length === 1) return { current: 1, longest: 1 };

  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  let longestStreak = 1;
  let tempStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const daysDiff = Math.floor(
      (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
    );
    tempStreak = daysDiff <= 14 ? tempStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, tempStreak);
  }

  let currentStreak = 1;
  for (let i = sortedDates.length - 1; i > 0; i--) {
    const daysDiff = Math.floor(
      (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff <= 14) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { current: currentStreak, longest: longestStreak };
}

function calculateDomainImprovements(
  first: WorkerDomainScores,
  latest: WorkerDomainScores
): WorkerDomainScores {
  return {
    thinkingQuality: latest.thinkingQuality - first.thinkingQuality,
    communicationPatterns: latest.communicationPatterns - first.communicationPatterns,
    learningBehavior: latest.learningBehavior - first.learningBehavior,
    contextEfficiency: latest.contextEfficiency - first.contextEfficiency,
    sessionOutcome: latest.sessionOutcome - first.sessionOutcome,
  };
}

function buildAnalysisSummary(
  result: StoredAnalysisResult,
  domainScores: WorkerDomainScores
): AnalysisSummary {
  const overallScore = calculateOverallScore(domainScores);
  return {
    date: result.claimedAt,
    score: overallScore,
    overallScore,
    primaryType: (result.evaluation.primaryType ?? 'conductor') as CodingStyleType,
    controlLevel: (result.evaluation.controlLevel ?? 'explorer') as AIControlLevel,
    domainScores,
  };
}

export async function GET() {
  try {
    const userId = getCurrentUserFromRequest().id;

    const results = listAnalysesForUser(userId).slice().reverse();
    if (results.length === 0) {
      return NextResponse.json({ analytics: null });
    }

    const validResults = results
      .map((result) => {
        const domainScores = extractWorkerDomainScores(result.evaluation);
        return domainScores ? { result, domainScores } : null;
      })
      .filter((entry): entry is { result: StoredAnalysisResult; domainScores: WorkerDomainScores } => !!entry);

    if (validResults.length === 0) {
      return NextResponse.json({ analytics: null });
    }

    const firstValid = validResults[0];
    const latestValid = validResults[validResults.length - 1];

    const history: HistoryEntry[] = validResults.map(({ result, domainScores }) => ({
      date: result.claimedAt.split('T')[0],
      overallScore: calculateOverallScore(domainScores),
      domainScores,
    }));

    const analysisDates = validResults.map(({ result }) => new Date(result.claimedAt));
    const { current: currentStreak, longest: longestStreak } = calculateStreak(analysisDates);

    const firstAnalysis = buildAnalysisSummary(firstValid.result, firstValid.domainScores);
    const latestAnalysis = buildAnalysisSummary(latestValid.result, latestValid.domainScores);
    const dimensionImprovements = calculateDomainImprovements(
      firstValid.domainScores,
      latestValid.domainScores
    );
    const totalImprovement = latestAnalysis.overallScore - firstAnalysis.overallScore;

    const analytics: PersonalAnalytics = {
      currentType: latestAnalysis.primaryType,
      firstAnalysisDate: firstValid.result.claimedAt,
      analysisCount: validResults.length,
      totalImprovement,
      currentDimensions: latestValid.domainScores,
      dimensionImprovements,
      firstAnalysis,
      latestAnalysis,
      journey: {
        totalAnalyses: validResults.length,
        currentStreak,
        longestStreak,
      },
      history,
      recommendations: [],
    };

    return NextResponse.json({ analytics });
  } catch (error) {
    console.error('User progress fetch error:', error);
    return NextResponse.json(
      {
        error: 'Fetch Failed',
        message: error instanceof Error ? error.message : 'Failed to fetch progress',
      },
      { status: 500 }
    );
  }
}
