/**
 * Pure transformation: StoredAnalysisResult[] -> TeamMemberAnalysis
 *
 * Converts a user's analysis history into the enterprise team-member shape
 * so local-first dashboards can reuse the same enterprise UI components.
 *
 * No side effects, no database calls.
 */

import type { LocalUser } from './auth';
import type { StoredAnalysisResult } from './analysis-store';
import { getWorkerDomainScores } from './reporting';
import type {
  TeamMemberAnalysis,
  DimensionScores,
  HistoryEntry,
  MemberTokenUsage,
  WeeklyTokenTrend,
  MemberAntiPattern,
  MemberProjectActivity,
  MemberStrengthSummary,
  MemberGrowthSnapshot,
  MemberGrowthArea,
  MemberKPT,
} from '@/types/enterprise';
import type { CodingStyleType, AIControlLevel } from '@/lib/models/coding-style';
import { WORKER_DOMAIN_CONFIGS } from '@/lib/models/worker-insights';
import type { WorkerInsightsContainer } from '@/lib/models/worker-insights';
import type { InefficiencyPattern } from '@/lib/models/agent-outputs';

// ---------------------------------------------------------------------------
// Domain mapping: worker domain key -> DimensionScores key
// ---------------------------------------------------------------------------

const DOMAIN_TO_DIMENSION: Record<string, keyof DimensionScores> = {
  thinkingQuality: 'aiCollaboration',
  contextEfficiency: 'contextEngineering',
  sessionOutcome: 'burnoutRisk', // inverted: 100 - score
  communicationPatterns: 'aiControl',
  learningBehavior: 'skillResilience',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractNameFromEmail(email: string): string {
  const atIndex = email.indexOf('@');
  return atIndex > 0 ? email.slice(0, atIndex) : email;
}

/**
 * Extract domain scores from a single evaluation, returning a map of
 * worker-domain-key -> domainScore (0-100).
 */
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

/**
 * Average of all domain scores for a given score map.
 */
function averageOfScores(scores: Record<string, number>): number {
  const values = Object.values(scores);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

/**
 * Build DimensionScores from domain score map.
 */
function buildDimensions(domainScores: Record<string, number>): DimensionScores {
  const dims: DimensionScores = {
    aiCollaboration: 0,
    contextEngineering: 0,
    burnoutRisk: 0,
    aiControl: 0,
    skillResilience: 0,
  };

  for (const [domainKey, dimKey] of Object.entries(DOMAIN_TO_DIMENSION)) {
    const raw = domainScores[domainKey] ?? 0;
    // burnoutRisk is inverted: lower score = less risk (better)
    dims[dimKey] = dimKey === 'burnoutRisk' ? 100 - raw : raw;
  }

  return dims;
}

/**
 * Derive ISO-week-start string (Monday) for a given date.
 */
function weekStartOf(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  // Shift to Monday (day 0 = Sunday -> offset 6, else day - 1)
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Main transformer
// ---------------------------------------------------------------------------

export function mapUserToTeamMember(
  user: LocalUser,
  analyses: StoredAnalysisResult[],
  teamId: string,
  role: string,
  department: string,
): TeamMemberAnalysis {
  // Sort analyses newest-first (claimedAt descending)
  const sorted = [...analyses].sort(
    (a, b) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime(),
  );

  const latest = sorted[0];

  // ----- Latest evaluation fields -----
  const latestEval = latest?.evaluation;
  const primaryType: CodingStyleType = latestEval?.primaryType ?? 'analyst';
  const controlLevel: AIControlLevel = latestEval?.controlLevel ?? 'navigator';

  const latestDomainScores = latestEval ? getDomainScoreMap(latestEval) : {};
  const overallScore = averageOfScores(latestDomainScores);
  const dimensions = buildDimensions(latestDomainScores);

  // ----- History (one entry per analysis) -----
  const history: HistoryEntry[] = sorted.map((a) => {
    const scores = getDomainScoreMap(a.evaluation);
    return {
      date: a.claimedAt,
      overallScore: averageOfScores(scores),
      dimensions: buildDimensions(scores),
    };
  });

  // ----- Token usage from activitySessions -----
  const tokenUsage = buildTokenUsage(sorted);

  // ----- Anti-patterns from contextEfficiency -----
  const antiPatterns = buildAntiPatterns(latestEval);

  // ----- Projects from activitySessions -----
  const projects = buildProjects(sorted);

  // ----- Strength summaries -----
  const strengthSummaries = buildStrengthSummaries(latestEval);

  // ----- Growth -----
  const growth = buildGrowthSnapshot(history);

  // ----- Growth areas -----
  const growthAreas = buildGrowthAreas(latestEval);

  // ----- KPT -----
  const kpt = buildKPT(strengthSummaries, antiPatterns, growthAreas);

  return {
    id: user.id,
    name: extractNameFromEmail(user.email),
    email: user.email,
    role,
    department,
    primaryType,
    controlLevel,
    overallScore,
    dimensions,
    history,
    tokenUsage,
    antiPatterns,
    projects,
    strengthSummaries,
    growth,
    growthAreas,
    kpt,
    lastAnalyzedAt: latest?.claimedAt ?? '',
    analysisCount: analyses.length,
  };
}

// ---------------------------------------------------------------------------
// Sub-builders
// ---------------------------------------------------------------------------

function buildTokenUsage(sortedAnalyses: StoredAnalysisResult[]): MemberTokenUsage {
  const allSessions = sortedAnalyses.flatMap((a) => a.activitySessions ?? []);
  const totalSessions = allSessions.length;
  const totalMessages = allSessions.reduce((s, sess) => s + sess.messageCount, 0);

  // Group sessions by week for weeklyTokenTrend
  const weekMap = new Map<string, { sessions: number; messages: number }>();
  for (const sess of allSessions) {
    const week = weekStartOf(sess.startTime);
    const entry = weekMap.get(week) ?? { sessions: 0, messages: 0 };
    entry.sessions += 1;
    entry.messages += sess.messageCount;
    weekMap.set(week, entry);
  }

  const weeklyTokenTrend: WeeklyTokenTrend[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, data]) => ({
      weekStart,
      // We don't have raw token counts, approximate from messages
      totalTokens: data.messages * 500,
      sessions: data.sessions,
    }));

  return {
    totalSessions,
    totalMessages,
    avgContextFillPercent: 0,
    maxContextFillPercent: 0,
    contextFillExceeded90Count: 0,
    weeklyTokenTrend,
  };
}

function buildAntiPatterns(
  evaluation: StoredAnalysisResult['evaluation'] | undefined,
): MemberAntiPattern[] {
  if (!evaluation?.agentOutputs) return [];

  // Try efficiency (v3) first, then contextEfficiency (legacy)
  const effData = evaluation.agentOutputs.efficiency ?? evaluation.agentOutputs.contextEfficiency;
  if (!effData?.inefficiencyPatterns) return [];

  return effData.inefficiencyPatterns.map((ip) => ({
    pattern: ip.pattern as InefficiencyPattern,
    frequency: ip.frequency,
    impact: ip.impact,
  }));
}

function buildProjects(sortedAnalyses: StoredAnalysisResult[]): MemberProjectActivity[] {
  const projectMap = new Map<
    string,
    { sessionCount: number; lastActiveDate: string; summaries: Set<string> }
  >();

  for (const analysis of sortedAnalyses) {
    const sessions = analysis.activitySessions ?? [];
    for (const sess of sessions) {
      const existing = projectMap.get(sess.projectName);
      if (existing) {
        existing.sessionCount += 1;
        if (sess.startTime > existing.lastActiveDate) {
          existing.lastActiveDate = sess.startTime;
        }
        if (sess.summary) existing.summaries.add(sess.summary);
      } else {
        const summaries = new Set<string>();
        if (sess.summary) summaries.add(sess.summary);
        projectMap.set(sess.projectName, {
          sessionCount: 1,
          lastActiveDate: sess.startTime,
          summaries,
        });
      }
    }
  }

  return Array.from(projectMap.entries()).map(([projectName, data]) => ({
    projectName,
    sessionCount: data.sessionCount,
    lastActiveDate: data.lastActiveDate,
    summaryLines: Array.from(data.summaries).slice(0, 5),
  }));
}

function buildStrengthSummaries(
  evaluation: StoredAnalysisResult['evaluation'] | undefined,
): MemberStrengthSummary[] {
  if (!evaluation) return [];

  const domainMap = getWorkerDomainScores(evaluation);
  if (!domainMap) return [];

  const summaries: MemberStrengthSummary[] = [];

  for (const config of WORKER_DOMAIN_CONFIGS) {
    const container = domainMap[config.key] as WorkerInsightsContainer | undefined;
    if (!container?.strengths?.length) continue;

    // Pick the first strength as the "top" strength
    const topStrength = container.strengths[0];
    summaries.push({
      domain: config.key,
      domainLabel: config.title,
      topStrength: topStrength.title,
      domainScore: container.domainScore ?? 0,
    });
  }

  return summaries;
}

function buildGrowthSnapshot(history: HistoryEntry[]): MemberGrowthSnapshot {
  const current = history[0]?.overallScore ?? 0;

  // Find previous week: entry closest to 7 days ago
  const now = history[0]?.date ? new Date(history[0].date).getTime() : Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

  const previousWeekEntry = findClosestEntry(history.slice(1), oneWeekAgo);
  const previousMonthEntry = findClosestEntry(history.slice(1), oneMonthAgo);

  const previousWeekScore = previousWeekEntry?.overallScore ?? current;
  const previousMonthScore = previousMonthEntry?.overallScore ?? current;

  const weekDelta = current - previousWeekScore;
  const monthDelta = current - previousMonthScore;

  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (weekDelta > 3) trend = 'improving';
  else if (weekDelta < -3) trend = 'declining';

  return {
    currentScore: current,
    previousWeekScore,
    previousMonthScore,
    weekOverWeekDelta: weekDelta,
    monthOverMonthDelta: monthDelta,
    trend,
  };
}

function findClosestEntry(
  entries: HistoryEntry[],
  targetTimestamp: number,
): HistoryEntry | undefined {
  if (entries.length === 0) return undefined;

  let closest = entries[0];
  let closestDiff = Math.abs(new Date(closest.date).getTime() - targetTimestamp);

  for (const entry of entries) {
    const diff = Math.abs(new Date(entry.date).getTime() - targetTimestamp);
    if (diff < closestDiff) {
      closest = entry;
      closestDiff = diff;
    }
  }

  return closest;
}

function buildGrowthAreas(
  evaluation: StoredAnalysisResult['evaluation'] | undefined,
): MemberGrowthArea[] {
  if (!evaluation) return [];

  const domainMap = getWorkerDomainScores(evaluation);
  if (!domainMap) return [];

  const areas: MemberGrowthArea[] = [];

  for (const config of WORKER_DOMAIN_CONFIGS) {
    const container = domainMap[config.key] as WorkerInsightsContainer | undefined;
    if (!container?.growthAreas?.length) continue;

    for (const ga of container.growthAreas) {
      areas.push({
        title: ga.title,
        domain: config.key,
        severity: (ga as unknown as { severity?: string }).severity as MemberGrowthArea['severity'] ?? 'medium',
        recommendation: ga.recommendation,
      });
    }
  }

  return areas;
}

function buildKPT(
  strengths: MemberStrengthSummary[],
  antiPatterns: MemberAntiPattern[],
  growthAreas: MemberGrowthArea[],
): MemberKPT {
  return {
    keep: strengths.map((s) => `${s.domainLabel}: ${s.topStrength}`),
    problem: antiPatterns.map((ap) => `${ap.pattern} (impact: ${ap.impact}, freq: ${ap.frequency})`),
    tryNext: growthAreas
      .filter((ga) => ga.recommendation)
      .slice(0, 5)
      .map((ga) => ga.recommendation),
  };
}
