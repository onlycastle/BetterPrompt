import { NextRequest, NextResponse } from 'next/server';
import { listAnalysesForUser } from '@/lib/local/analysis-store';
import type { StoredAnalysisResult } from '@/lib/local/analysis-store';
import { getCurrentUserFromRequest } from '@/lib/local/auth';
import { getWorkerDomainScores } from '@/lib/local/reporting';
import { WORKER_DOMAIN_CONFIGS } from '@/lib/models/worker-insights';
import type { WorkerInsightsContainer } from '@/lib/models/worker-insights';

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface SummaryStrength {
  domain: string;
  domainLabel: string;
  topStrength: string;
  domainScore: number;
}

interface SummaryGrowthArea {
  title: string;
  domain: string;
  severity: string;
  recommendation: string;
}

interface SummaryAntiPattern {
  pattern: string;
  frequency: number;
  impact: string;
}

interface SummaryKPT {
  keep: string[];
  problem: string[];
  tryNext: string[];
}

interface UserSummary {
  resultId: string;
  analyzedAt: string;
  profile: {
    primaryType: string;
    controlLevel: string;
    matrixName: string;
    personalitySummary: string;
    domainScores: Record<string, number>;
  };
  growthAreas: SummaryGrowthArea[];
  strengths: SummaryStrength[];
  antiPatterns: SummaryAntiPattern[];
  kpt: SummaryKPT;
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

function getDomainScoreMap(
  evaluation: StoredAnalysisResult['evaluation'],
): Record<string, number> {
  const domainMap = getWorkerDomainScores(evaluation);
  if (!domainMap) return {};

  const scores: Record<string, number> = {};
  for (const [key, container] of Object.entries(domainMap)) {
    if (container?.domainScore != null) {
      scores[key] = container.domainScore;
    }
  }
  return scores;
}

function buildStrengths(
  evaluation: StoredAnalysisResult['evaluation'],
): SummaryStrength[] {
  const domainMap = getWorkerDomainScores(evaluation);
  if (!domainMap) return [];

  const summaries: SummaryStrength[] = [];

  for (const config of WORKER_DOMAIN_CONFIGS) {
    const container = domainMap[config.key] as WorkerInsightsContainer | undefined;
    if (!container?.strengths?.length) continue;

    summaries.push({
      domain: config.key,
      domainLabel: config.title,
      topStrength: container.strengths[0].title,
      domainScore: container.domainScore ?? 0,
    });
  }

  return summaries;
}

function buildGrowthAreas(
  evaluation: StoredAnalysisResult['evaluation'],
): SummaryGrowthArea[] {
  const domainMap = getWorkerDomainScores(evaluation);
  if (!domainMap) return [];

  const areas: SummaryGrowthArea[] = [];

  for (const config of WORKER_DOMAIN_CONFIGS) {
    const container = domainMap[config.key] as WorkerInsightsContainer | undefined;
    if (!container?.growthAreas?.length) continue;

    for (const ga of container.growthAreas) {
      areas.push({
        title: ga.title,
        domain: config.key,
        severity: (ga as unknown as { severity?: string }).severity ?? 'medium',
        recommendation: ga.recommendation,
      });
    }
  }

  return areas;
}

function buildAntiPatterns(
  evaluation: StoredAnalysisResult['evaluation'],
): SummaryAntiPattern[] {
  if (!evaluation?.agentOutputs) return [];

  const effData = evaluation.agentOutputs.efficiency ?? evaluation.agentOutputs.contextEfficiency;
  if (!effData?.inefficiencyPatterns) return [];

  return effData.inefficiencyPatterns.map((ip) => ({
    pattern: ip.pattern,
    frequency: ip.frequency,
    impact: ip.impact,
  }));
}

function buildKPT(
  strengths: SummaryStrength[],
  antiPatterns: SummaryAntiPattern[],
  growthAreas: SummaryGrowthArea[],
): SummaryKPT {
  return {
    keep: strengths.map((s) => `${s.domainLabel}: ${s.topStrength}`),
    problem: antiPatterns.map((ap) => `${ap.pattern} (impact: ${ap.impact}, freq: ${ap.frequency}%)`),
    tryNext: growthAreas
      .filter((ga) => ga.recommendation)
      .slice(0, 5)
      .map((ga) => ga.recommendation),
  };
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest) {
  const userId = getCurrentUserFromRequest().id;

  const analyses = listAnalysesForUser(userId, 1);

  if (analyses.length === 0) {
    return NextResponse.json({ summary: null });
  }

  const latest = analyses[0];
  const evaluation = latest.evaluation;

  const domainScores = getDomainScoreMap(evaluation);
  const strengths = buildStrengths(evaluation);
  const growthAreas = buildGrowthAreas(evaluation);
  const antiPatterns = buildAntiPatterns(evaluation);
  const kpt = buildKPT(strengths, antiPatterns, growthAreas);

  // matrixName lives inside agentOutputs.typeClassifier
  const matrixName =
    evaluation.agentOutputs?.typeClassifier?.matrixName ?? '';

  const summary: UserSummary = {
    resultId: latest.resultId,
    analyzedAt: latest.claimedAt,
    profile: {
      primaryType: evaluation.primaryType,
      controlLevel: evaluation.controlLevel,
      matrixName,
      personalitySummary: truncate(evaluation.personalitySummary ?? '', 200),
      domainScores,
    },
    growthAreas,
    strengths,
    antiPatterns,
    kpt,
  };

  return NextResponse.json({ summary });
}
