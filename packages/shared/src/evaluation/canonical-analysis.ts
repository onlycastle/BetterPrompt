/**
 * Canonical Analysis Evaluation Assembly
 *
 * Shared plugin/server logic for canonical run assembly and translated
 * report-field overlays. The plugin uses the full canonical builder and
 * the server reuses the translation merge helpers for final evaluation
 * convergence.
 *
 * @module @betterprompt/shared/evaluation/canonical-analysis
 */

import type {
  CanonicalAnalysisRun,
  CanonicalStageOutputs,
  ContentWriterOutput,
  DeterministicScores,
  DeterministicTypeResult,
  DomainResult,
  Evidence,
  EvidenceVerificationOutput,
  Phase1Output,
  ProjectSummary,
  ReportActivitySession,
  SessionSummary,
  TranslatorOutput,
  WeeklyInsights,
} from '../schemas/index.js';

type EvaluationPayload = CanonicalAnalysisRun['evaluation'];
type TranslationFields = Record<string, unknown>;

interface FinalEvaluationEnvelopeArgs {
  sessionId: string;
  analyzedAt: string;
  sessionsAnalyzed: number;
  avgPromptLength: number;
  avgTurnsPerSession: number;
  assembledSections?: Record<string, unknown>;
  sessionSummaries?: unknown;
  activitySessions?: unknown;
  projectSummaries?: unknown;
  weeklyInsights?: unknown;
  agentOutputs?: unknown;
  translatedAgentInsights?: unknown;
  knowledgeResources?: unknown;
  pipelineTokenUsage?: unknown;
  analysisMetadata?: unknown;
}

/** Maps worker domain → evaluation dimension (used by topFocusAreas for report display). */
const DOMAIN_TO_EVALUATION_DIMENSION: Record<string, string> = {
  thinkingQuality: 'aiControl',
  communicationPatterns: 'aiCollaboration',
  learningBehavior: 'skillResilience',
  contextEfficiency: 'contextEngineering',
  sessionOutcome: 'burnoutRisk',
};

function normalizeQuote(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function buildVerificationKey(utteranceId: string, quote: string): string {
  return `${utteranceId}::${normalizeQuote(quote)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function filterEvidence(
  evidence: Evidence[],
  verification?: EvidenceVerificationOutput,
): Evidence[] {
  if (!verification?.verifiedResults?.length) {
    return evidence;
  }

  const verifiedKeys = new Set(
    verification.verifiedResults
      .filter(item => item.verified)
      .map(item => buildVerificationKey(item.utteranceId, item.quote)),
  );

  return evidence.filter(item => {
    if (!item || typeof item === 'string') {
      return false;
    }
    return verifiedKeys.has(buildVerificationKey(item.utteranceId, item.quote));
  });
}

export function applyEvidenceVerification(
  domainResults: DomainResult[],
  verification?: EvidenceVerificationOutput,
): DomainResult[] {
  if (!verification?.verifiedResults?.length) {
    return domainResults;
  }

  return domainResults.map(result => ({
    ...result,
    strengths: result.strengths
      .map(strength => ({
        ...strength,
        evidence: filterEvidence(strength.evidence, verification),
      }))
      .filter(strength => strength.evidence.length > 0),
    growthAreas: result.growthAreas
      .map(area => ({
        ...area,
        evidence: filterEvidence(area.evidence, verification),
      }))
      .filter(area => area.evidence.length > 0),
  }));
}

function buildSessionSummaryLookup(
  sessionSummaries?: { summaries?: SessionSummary[] },
): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const item of sessionSummaries?.summaries ?? []) {
    lookup.set(item.sessionId, item.summary);
  }
  return lookup;
}

export function buildReportActivitySessions(
  phase1Output: Phase1Output,
  sessionSummaries?: { summaries?: SessionSummary[] },
): ReportActivitySession[] {
  const summaryLookup = buildSessionSummaryLookup(sessionSummaries);

  return (phase1Output.activitySessions ?? []).map(session => ({
    sessionId: session.sessionId,
    projectName: session.projectName,
    startTime: session.startTime,
    durationMinutes: Math.round(((session.durationSeconds ?? 0) / 60) * 10) / 10,
    messageCount: session.messageCount,
    summary: summaryLookup.get(session.sessionId)
      ?? session.firstUserMessage
      ?? 'Session activity',
    ...(typeof session.totalInputTokens === 'number'
      ? { totalInputTokens: session.totalInputTokens }
      : {}),
    ...(typeof session.totalOutputTokens === 'number'
      ? { totalOutputTokens: session.totalOutputTokens }
      : {}),
  }));
}

export function assembleFinalEvaluationEnvelope(
  args: FinalEvaluationEnvelopeArgs,
): Record<string, unknown> {
  const evaluation: Record<string, unknown> = {
    sessionId: args.sessionId,
    analyzedAt: args.analyzedAt,
    sessionsAnalyzed: args.sessionsAnalyzed,
    avgPromptLength: args.avgPromptLength,
    avgTurnsPerSession: args.avgTurnsPerSession,
    ...(args.activitySessions !== undefined ? { activitySessions: args.activitySessions } : {}),
    ...(args.sessionSummaries !== undefined ? { sessionSummaries: args.sessionSummaries } : {}),
    ...(args.projectSummaries !== undefined ? { projectSummaries: args.projectSummaries } : {}),
    ...(args.weeklyInsights !== undefined ? { weeklyInsights: args.weeklyInsights } : {}),
    ...(args.assembledSections ?? {}),
    ...(args.agentOutputs !== undefined ? { agentOutputs: args.agentOutputs } : {}),
    ...(args.translatedAgentInsights !== undefined
      ? { translatedAgentInsights: args.translatedAgentInsights }
      : {}),
    ...(args.knowledgeResources !== undefined ? { knowledgeResources: args.knowledgeResources } : {}),
    ...(args.pipelineTokenUsage !== undefined ? { pipelineTokenUsage: args.pipelineTokenUsage } : {}),
    ...(args.analysisMetadata !== undefined ? { analysisMetadata: args.analysisMetadata } : {}),
  };

  return evaluation;
}

function toPromptPatternFrequency(value: unknown): 'frequent' | 'occasional' | 'rare' {
  if (typeof value === 'number') {
    if (value >= 0.34) return 'frequent';
    if (value >= 0.12) return 'occasional';
    return 'rare';
  }

  if (typeof value === 'string') {
    if (value === 'frequent' || value === 'occasional' || value === 'rare') {
      return value;
    }
    if (value === 'often' || value === 'high') return 'frequent';
    if (value === 'sometimes' || value === 'medium') return 'occasional';
  }

  return 'occasional';
}

function toPromptPatternEffectiveness(value: unknown): 'highly_effective' | 'effective' | 'could_improve' {
  if (typeof value === 'string') {
    if (value === 'highly_effective' || value === 'effective' || value === 'could_improve') {
      return value;
    }
    if (value === 'very_effective' || value === 'high') return 'highly_effective';
    if (value === 'medium' || value === 'moderate') return 'effective';
  }
  return 'effective';
}

function buildPromptPatterns(domainResults: DomainResult[]): Array<Record<string, unknown>> {
  const communication = domainResults.find(result => result.domain === 'communicationPatterns');
  const rawPatterns = communication?.data && typeof communication.data === 'object'
    ? (communication.data as Record<string, unknown>).communicationPatterns
    : undefined;

  if (!Array.isArray(rawPatterns)) {
    return [];
  }

  return rawPatterns
    .filter((pattern): pattern is Record<string, unknown> => !!pattern && typeof pattern === 'object')
    .map((pattern, index) => {
      const evidence = Array.isArray(pattern.evidence) ? pattern.evidence : [];
      return {
        patternName: typeof pattern.title === 'string'
          ? pattern.title
          : typeof pattern.patternId === 'string'
            ? pattern.patternId
            : `Pattern ${index + 1}`,
        description: typeof pattern.description === 'string' ? pattern.description : '',
        frequency: toPromptPatternFrequency(pattern.frequency),
        examples: evidence
          .filter((item): item is { quote?: unknown; context?: unknown } => !!item && typeof item === 'object')
          .map(item => ({
            quote: typeof item.quote === 'string' ? item.quote : '',
            analysis: typeof item.context === 'string' ? item.context : 'Observed in communication behavior',
          }))
          .filter(item => item.quote)
          .slice(0, 3),
        effectiveness: toPromptPatternEffectiveness(pattern.effectiveness),
      };
    })
    .filter(pattern => typeof pattern.description === 'string' && pattern.description.length > 0);
}

function buildTopFocusAreas(contentWriter?: ContentWriterOutput): EvaluationPayload['topFocusAreas'] {
  if (!contentWriter?.topFocusAreas?.length) {
    return undefined;
  }

  return {
    summary: 'Highest-leverage collaboration habits surfaced in this analysis.',
    areas: contentWriter.topFocusAreas.slice(0, 3).map((area, index) => ({
      rank: index + 1,
      dimension: DOMAIN_TO_EVALUATION_DIMENSION[area.relatedQualities[0] ?? ''] ?? 'aiCollaboration',
      title: area.title,
      narrative: area.description,
      expectedImpact: `Improves ${area.relatedQualities.join(', ') || 'overall collaboration quality'}.`,
      priorityScore: Math.max(100 - index * 10, 70),
      ...(area.actions ? { actions: area.actions } : {}),
    })),
  };
}

function inferWeekRange(activitySessions: ReportActivitySession[], analyzedAt: string): { start: string; end: string } {
  const end = activitySessions[0]?.startTime ?? analyzedAt;
  const startDate = new Date(end);
  startDate.setDate(startDate.getDate() - 6);
  return {
    start: startDate.toISOString(),
    end,
  };
}

function buildWeeklyInsights(
  weeklyInsights: WeeklyInsights | undefined,
  activitySessions: ReportActivitySession[],
  analyzedAt: string,
): EvaluationPayload['weeklyInsights'] {
  if (!weeklyInsights) {
    return undefined;
  }

  const totalMinutes = weeklyInsights.stats.totalMinutes;

  return {
    weekRange: inferWeekRange(activitySessions, analyzedAt),
    stats: {
      totalSessions: weeklyInsights.stats.sessionCount,
      totalMinutes,
      totalTokens: weeklyInsights.stats.totalTokens,
      activeDays: weeklyInsights.stats.activeDays,
      avgSessionMinutes: weeklyInsights.stats.sessionCount > 0
        ? Math.round((totalMinutes / weeklyInsights.stats.sessionCount) * 10) / 10
        : 0,
    },
    ...(typeof weeklyInsights.stats.deltaSessionCount === 'number'
      || typeof weeklyInsights.stats.deltaMinutes === 'number'
      || typeof weeklyInsights.stats.deltaTokens === 'number'
      ? {
          comparison: {
            sessionsDelta: weeklyInsights.stats.deltaSessionCount ?? 0,
            minutesDelta: weeklyInsights.stats.deltaMinutes ?? 0,
            tokensDelta: weeklyInsights.stats.deltaTokens ?? 0,
            activeDaysDelta: 0,
          },
        }
      : {}),
    projects: weeklyInsights.projects.map(project => ({
      projectName: project.projectName,
      sessionCount: project.sessionCount,
      totalMinutes: Math.round((totalMinutes * project.percentage) / 100),
      percentage: project.percentage,
    })),
    topProjectSessions: weeklyInsights.topSessions.map(session => {
      const activity = activitySessions.find(item => item.sessionId === session.sessionId);
      return {
        summary: session.summary,
        durationMinutes: activity?.durationMinutes ?? 0,
        date: activity?.startTime
          ? new Date(activity.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '',
      };
    }),
    narrative: weeklyInsights.narrative,
    highlights: weeklyInsights.highlights,
  };
}

function buildWorkerInsights(domainResults: DomainResult[]): Record<string, unknown> {
  const workerInsights: Record<string, unknown> = {};

  for (const result of domainResults) {
    if (result.domain === 'content') continue;

    workerInsights[result.domain] = {
      strengths: result.strengths,
      growthAreas: result.growthAreas,
      domainScore: result.overallScore,
    };
  }

  return workerInsights;
}

// ============================================================================
// Structured Sub-Analysis Assembly (Fix 4)
//
// These functions extract secondary structures from the thinkingQuality
// domain's `data` field and surface them as top-level evaluation fields.
// The server's evaluation-assembler produces these; without them, the
// report's detail panels appear empty.
// ============================================================================

function formatDisplayName(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function mapAntiPatternSeverity(severity: unknown): 'mild' | 'moderate' | 'significant' {
  if (severity === 'critical' || severity === 'significant') return 'significant';
  if (severity === 'mild') return 'mild';
  return 'moderate';
}

function buildAntiPatternsAnalysis(domainResults: DomainResult[]): Record<string, unknown> | undefined {
  const tq = domainResults.find(r => r.domain === 'thinkingQuality');
  const data = tq?.data as Record<string, unknown> | undefined;
  const antiPatterns = data?.verificationAntiPatterns;

  if (!Array.isArray(antiPatterns) || antiPatterns.length === 0) {
    return undefined;
  }

  const detected = antiPatterns
    .filter((ap): ap is Record<string, unknown> => isRecord(ap))
    .map(ap => {
      const type = String(ap.type ?? 'unknown');
      return {
        antiPatternType: type,
        displayName: formatDisplayName(type),
        description: typeof ap.improvement === 'string'
          ? ap.improvement
          : `Detected ${type.replace(/_/g, ' ')} pattern`,
        occurrences: typeof ap.frequency === 'number' ? ap.frequency : 1,
        severity: mapAntiPatternSeverity(ap.severity),
        evidence: Array.isArray(ap.examples)
          ? ap.examples
              .filter((e): e is Record<string, unknown> => isRecord(e))
              .map(e => typeof e.quote === 'string' ? e.quote : '')
              .filter(Boolean)
          : [],
        growthOpportunity: typeof ap.improvement === 'string'
          ? ap.improvement
          : `Consider addressing the ${type.replace(/_/g, ' ')} pattern`,
        actionableTip: typeof ap.improvement === 'string'
          ? ap.improvement
          : `Try to be more mindful of ${type.replace(/_/g, ' ')} patterns`,
      };
    });

  return {
    detected,
    summary: typeof data?.summary === 'string'
      ? data.summary
      : 'Some growth opportunities were identified. These are common learning patterns that every developer experiences.',
    overallHealthScore: tq?.overallScore ?? 80,
  };
}

function buildCriticalThinkingAnalysis(domainResults: DomainResult[]): Record<string, unknown> | undefined {
  const tq = domainResults.find(r => r.domain === 'thinkingQuality');
  const data = tq?.data as Record<string, unknown> | undefined;
  const moments = data?.criticalThinkingMoments;

  if (!Array.isArray(moments) || moments.length === 0) {
    return undefined;
  }

  const strengths = moments
    .filter((ct): ct is Record<string, unknown> => isRecord(ct))
    .map(ct => ({
      indicatorType: typeof ct.type === 'string' ? ct.type : 'unknown',
      displayName: formatDisplayName(typeof ct.type === 'string' ? ct.type : 'unknown'),
      description: typeof ct.result === 'string'
        ? ct.result
        : `Demonstrated ${String(ct.type ?? 'critical thinking').replace(/_/g, ' ')}`,
      frequency: 1,
      quality: 'intermediate' as const,
      evidence: typeof ct.quote === 'string' ? [ct.quote] : [],
    }));

  const uniqueTypes = new Set(moments
    .filter((ct): ct is Record<string, unknown> => isRecord(ct))
    .map(ct => ct.type));
  const overallScore = Math.min(100, 40 + uniqueTypes.size * 10 + moments.length * 5);

  return {
    strengths,
    opportunities: [],
    summary: typeof data?.summary === 'string'
      ? data.summary
      : 'Shows signs of critical evaluation when working with AI-generated content.',
    overallScore,
  };
}

function buildPlanningAnalysis(domainResults: DomainResult[]): Record<string, unknown> | undefined {
  const tq = domainResults.find(r => r.domain === 'thinkingQuality');
  const data = tq?.data as Record<string, unknown> | undefined;
  const habits = data?.planningHabits;

  if (!Array.isArray(habits) || habits.length === 0) {
    return undefined;
  }

  const hasSlashPlan = habits.some((h): h is Record<string, unknown> =>
    isRecord(h) && h.type === 'uses_plan_command');
  const hasTodoWrite = habits.some((h): h is Record<string, unknown> =>
    isRecord(h) && h.type === 'todowrite_usage');
  const hasTaskDecomp = habits.some((h): h is Record<string, unknown> =>
    isRecord(h) && h.type === 'task_decomposition');

  const maturityLevel = hasSlashPlan && hasTaskDecomp ? 'expert'
    : hasSlashPlan ? 'structured'
    : (hasTodoWrite || hasTaskDecomp) ? 'emerging'
    : 'reactive';

  const strengths: Array<Record<string, unknown>> = [];
  const opportunities: Array<Record<string, unknown>> = [];

  for (const habit of habits) {
    if (!isRecord(habit)) continue;

    const type = typeof habit.type === 'string' ? habit.type : 'unknown';
    const frequency = typeof habit.frequency === 'string' ? habit.frequency : 'sometimes';
    const effectiveness = typeof habit.effectiveness === 'string' ? habit.effectiveness : 'medium';

    const insight = {
      behaviorType: type,
      displayName: formatDisplayName(type),
      description: `Planning habit "${type.replace(/_/g, ' ')}" observed with ${frequency} frequency`,
      frequency: frequency === 'always' || frequency === 'often' ? 3 : frequency === 'sometimes' ? 2 : 1,
      sophistication: effectiveness === 'high' ? 'advanced' : effectiveness === 'medium' ? 'intermediate' : 'basic',
      evidence: Array.isArray(habit.examples) ? habit.examples : [],
    };

    const isStrength = effectiveness === 'high' || frequency === 'always' || frequency === 'often';
    if (isStrength) {
      strengths.push(insight);
    } else {
      opportunities.push(insight);
    }
  }

  return {
    strengths,
    opportunities,
    summary: typeof data?.summary === 'string'
      ? data.summary
      : 'Shows planning awareness in development workflow.',
    planningMaturityLevel: maturityLevel,
  };
}

function normalizeInefficiencyPattern(value: unknown): string {
  if (value === 'late_compact'
    || value === 'context_bloat'
    || value === 'redundant_info'
    || value === 'prompt_length_inflation'
    || value === 'no_session_separation'
    || value === 'verbose_error_pasting'
    || value === 'no_knowledge_persistence') {
    return value;
  }

  if (value === 'stale_context' || value === 'context_spillover') {
    return 'context_bloat';
  }

  return 'context_bloat';
}

function buildAgentOutputs(
  phase1Output: Phase1Output,
  domainResults: DomainResult[],
): Record<string, unknown> | undefined {
  const contextEfficiency = domainResults.find(result => result.domain === 'contextEfficiency');
  const patterns = contextEfficiency?.data && typeof contextEfficiency.data === 'object'
    ? (contextEfficiency.data as Record<string, unknown>).inefficiencyPatterns
    : undefined;

  if (!contextEfficiency) {
    return undefined;
  }

  const mappedPatterns = Array.isArray(patterns)
    ? patterns
      .filter((pattern): pattern is Record<string, unknown> => isRecord(pattern))
      .map(pattern => ({
        pattern: normalizeInefficiencyPattern(pattern.type ?? pattern.pattern),
        frequency: typeof pattern.frequency === 'number'
          ? Math.max(1, Math.round(pattern.frequency))
          : 1,
        impact: pattern.impact === 'high' || pattern.impact === 'low' ? pattern.impact : 'medium',
        description: typeof pattern.description === 'string'
          ? pattern.description
          : `Observed ${String(pattern.type ?? pattern.pattern ?? 'context issue')} behavior with ${String(pattern.impact ?? 'medium')} impact.`,
      }))
    : [];

  return {
    efficiency: {
      contextUsagePatterns: [],
      inefficiencyPatterns: mappedPatterns,
      promptLengthTrends: [],
      redundantInfo: [],
      topInsights: [],
      overallEfficiencyScore: contextEfficiency.overallScore,
      avgContextFillPercent: phase1Output.sessionMetrics.avgContextFillPercent ?? 0,
      confidenceScore: contextEfficiency.confidenceScore,
      strengths: contextEfficiency.strengths,
      growthAreas: contextEfficiency.growthAreas,
    },
  };
}

function mergePromptPatternTranslations(
  evaluation: Record<string, unknown>,
  translatedFields: TranslationFields,
): void {
  if (!Array.isArray(translatedFields.promptPatterns) || !Array.isArray(evaluation.promptPatterns)) {
    return;
  }

  const translatedPatterns = translatedFields.promptPatterns as Array<Record<string, unknown>>;
  const englishPatterns = evaluation.promptPatterns as Array<Record<string, unknown>>;
  const minLength = Math.min(translatedPatterns.length, englishPatterns.length);

  for (let i = 0; i < minLength; i += 1) {
    const translated = translatedPatterns[i];
    const english = englishPatterns[i];

    if (typeof translated.patternName === 'string') english.patternName = translated.patternName;
    if (typeof translated.description === 'string') english.description = translated.description;
    if (typeof translated.tip === 'string') english.tip = translated.tip;

    if (!Array.isArray(translated.examples) || !Array.isArray(english.examples)) {
      continue;
    }

    const translatedExamples = translated.examples as Array<Record<string, unknown>>;
    const englishExamples = english.examples as Array<Record<string, unknown>>;
    const exampleCount = Math.min(translatedExamples.length, englishExamples.length);

    for (let j = 0; j < exampleCount; j += 1) {
      if (typeof translatedExamples[j]?.analysis === 'string') {
        englishExamples[j].analysis = translatedExamples[j].analysis;
      }
    }
  }
}

function mergeTopFocusAreaTranslations(
  evaluation: Record<string, unknown>,
  translatedFields: TranslationFields,
): void {
  if (!isRecord(translatedFields.topFocusAreas) || !isRecord(evaluation.topFocusAreas)) {
    return;
  }

  const translated = translatedFields.topFocusAreas;
  const english = evaluation.topFocusAreas;

  if (typeof translated.summary === 'string') {
    english.summary = translated.summary;
  }

  if (!Array.isArray(translated.areas) || !Array.isArray(english.areas)) {
    return;
  }

  const englishAreas = english.areas as Array<Record<string, unknown>>;

  for (const translatedArea of translated.areas as Array<Record<string, unknown>>) {
    const rank = typeof translatedArea.rank === 'number' ? translatedArea.rank : null;
    const englishArea = rank === null
      ? undefined
      : englishAreas.find(area => area.rank === rank);

    if (!englishArea) continue;

    if (typeof translatedArea.title === 'string') englishArea.title = translatedArea.title;
    if (typeof translatedArea.narrative === 'string') englishArea.narrative = translatedArea.narrative;
    if (typeof translatedArea.expectedImpact === 'string') {
      englishArea.expectedImpact = translatedArea.expectedImpact;
    }

    if (!isRecord(translatedArea.actions) || !isRecord(englishArea.actions)) {
      continue;
    }

    englishArea.actions = {
      start: typeof translatedArea.actions.start === 'string' ? translatedArea.actions.start : '',
      stop: typeof translatedArea.actions.stop === 'string' ? translatedArea.actions.stop : '',
      continue: typeof translatedArea.actions.continue === 'string' ? translatedArea.actions.continue : '',
    };
  }
}

function mergeProjectSummaryTranslations(
  evaluation: Record<string, unknown>,
  translatedFields: TranslationFields,
): void {
  if (!Array.isArray(translatedFields.projectSummaries) || !Array.isArray(evaluation.projectSummaries)) {
    return;
  }

  const englishProjects = evaluation.projectSummaries as Array<Record<string, unknown>>;

  for (const translatedProject of translatedFields.projectSummaries as Array<Record<string, unknown>>) {
    const projectName = typeof translatedProject.projectName === 'string'
      ? translatedProject.projectName
      : null;
    const englishProject = projectName
      ? englishProjects.find(project => project.projectName === projectName)
      : undefined;

    if (!englishProject || !Array.isArray(translatedProject.summaryLines)) {
      continue;
    }

    englishProject.summaryLines = translatedProject.summaryLines;
  }
}

function mergeWeeklyInsightTranslations(
  evaluation: Record<string, unknown>,
  translatedFields: TranslationFields,
): void {
  if (!isRecord(translatedFields.weeklyInsights) || !isRecord(evaluation.weeklyInsights)) {
    return;
  }

  const translated = translatedFields.weeklyInsights;
  const english = evaluation.weeklyInsights;

  if (typeof translated.narrative === 'string') {
    english.narrative = translated.narrative;
  }

  if (Array.isArray(translated.highlights)) {
    english.highlights = translated.highlights;
  }

  if (!Array.isArray(translated.topSessionSummaries) || !Array.isArray(english.topProjectSessions)) {
    return;
  }

  const englishTopSessions = english.topProjectSessions as Array<Record<string, unknown>>;
  const sessionCount = Math.min(translated.topSessionSummaries.length, englishTopSessions.length);

  for (let i = 0; i < sessionCount; i += 1) {
    if (typeof translated.topSessionSummaries[i] === 'string') {
      englishTopSessions[i].summary = translated.topSessionSummaries[i];
    }
  }
}

function mergeTranslatedAgentInsights(
  evaluation: Record<string, unknown>,
  translatedFields: TranslationFields,
): void {
  if (!isRecord(translatedFields.translatedAgentInsights)) {
    return;
  }

  evaluation.translatedAgentInsights = translatedFields.translatedAgentInsights;
}

export function mergeTranslatedEvaluationFields(
  evaluation: Record<string, unknown>,
  translatedFields: TranslationFields,
  targetLanguage?: string,
): void {
  const cjkLanguages = new Set(['ko', 'ja', 'zh']);
  const minLengthRatio = targetLanguage && cjkLanguages.has(targetLanguage) ? 0.45 : 0.65;

  if (typeof translatedFields.personalitySummary === 'string') {
    const englishSummary = typeof evaluation.personalitySummary === 'string'
      ? evaluation.personalitySummary
      : '';
    const translatedSummary = translatedFields.personalitySummary;
    const ratio = englishSummary.length > 0 ? translatedSummary.length / englishSummary.length : 1;

    if (englishSummary.length === 0 || ratio >= minLengthRatio) {
      evaluation.personalitySummary = translatedSummary;
    }
  }

  mergeTranslatedAgentInsights(evaluation, translatedFields);
  mergeProjectSummaryTranslations(evaluation, translatedFields);
  mergeWeeklyInsightTranslations(evaluation, translatedFields);
  mergePromptPatternTranslations(evaluation, translatedFields);
  mergeTopFocusAreaTranslations(evaluation, translatedFields);
}

function mergeTranslation(
  evaluation: EvaluationPayload,
  translator?: TranslatorOutput,
): void {
  if (!translator?.translatedFields || typeof translator.translatedFields !== 'object') {
    return;
  }

  mergeTranslatedEvaluationFields(
    evaluation as Record<string, unknown>,
    translator.translatedFields as TranslationFields,
    translator.targetLanguage,
  );
}

export function buildCanonicalEvaluation(args: {
  analyzedAt: string;
  phase1Output: Phase1Output;
  activitySessions: ReportActivitySession[];
  deterministicScores: DeterministicScores;
  typeResult: DeterministicTypeResult | null;
  domainResults: DomainResult[];
  stageOutputs: CanonicalStageOutputs;
}): EvaluationPayload {
  const {
    analyzedAt,
    phase1Output,
    activitySessions,
    deterministicScores,
    typeResult,
    domainResults,
    stageOutputs,
  } = args;

  const filteredDomainResults = applyEvidenceVerification(
    domainResults,
    stageOutputs.evidenceVerification,
  );

  const confidenceScores = filteredDomainResults
    .map(result => result.confidenceScore)
    .filter((score): score is number => typeof score === 'number');
  const overallConfidence = confidenceScores.length > 0
    ? Math.round((confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length) * 100) / 100
    : 0;
  const filteredEvidenceCount = stageOutputs.evidenceVerification?.domainStats
    ?.reduce((sum, stat) => sum + stat.filteredCount, 0) ?? 0;
  const dataQuality = phase1Output.sessionMetrics.totalSessions >= 10
    ? 'high'
    : phase1Output.sessionMetrics.totalSessions >= 5
      ? 'medium'
      : 'low';

  const agentOutputs = buildAgentOutputs(phase1Output, filteredDomainResults);

  // Build sub-analyses once (avoid double-calling non-trivial functions)
  const antiPatterns = buildAntiPatternsAnalysis(filteredDomainResults);
  const criticalThinking = buildCriticalThinkingAnalysis(filteredDomainResults);
  const planning = buildPlanningAnalysis(filteredDomainResults);

  const evaluation = assembleFinalEvaluationEnvelope({
    sessionId: activitySessions[0]?.sessionId
      ?? phase1Output.activitySessions?.[0]?.sessionId
      ?? 'plugin-local-analysis',
    analyzedAt,
    sessionsAnalyzed: phase1Output.sessionMetrics.totalSessions,
    avgPromptLength: Math.round(phase1Output.sessionMetrics.avgDeveloperMessageLength),
    avgTurnsPerSession: Math.round(phase1Output.sessionMetrics.avgMessagesPerSession * 10) / 10,
    activitySessions,
    sessionSummaries: stageOutputs.sessionSummaries?.summaries,
    projectSummaries: stageOutputs.projectSummaries?.projects as ProjectSummary[] | undefined,
    weeklyInsights: buildWeeklyInsights(stageOutputs.weeklyInsights, activitySessions, analyzedAt),
    assembledSections: {
      primaryType: typeResult?.primaryType ?? 'analyst',
      controlLevel: typeResult?.controlLevel ?? 'navigator',
      ...(typeof typeResult?.controlScore === 'number' ? { controlScore: typeResult.controlScore } : {}),
      distribution: typeResult?.distribution ?? {
        architect: 20,
        analyst: 20,
        conductor: 20,
        speedrunner: 20,
        trendsetter: 20,
      },
      personalitySummary: stageOutputs.typeClassification?.personalityNarrative?.join('\n\n')
        ?? stageOutputs.typeClassification?.reasoning?.join('\n\n')
        ?? '',
      promptPatterns: buildPromptPatterns(filteredDomainResults),
      topFocusAreas: buildTopFocusAreas(stageOutputs.contentWriter),
      workerInsights: buildWorkerInsights(filteredDomainResults),
      // Structured sub-analyses from thinkingQuality domain data (Fix 4)
      ...(antiPatterns ? { antiPatternsAnalysis: antiPatterns } : {}),
      ...(criticalThinking ? { criticalThinkingAnalysis: criticalThinking } : {}),
      ...(planning ? { planningAnalysis: planning } : {}),
    },
    agentOutputs,
    pipelineTokenUsage: {
      stages: [],
      totals: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
      model: 'plugin-local',
      modelName: 'plugin-local',
    },
    analysisMetadata: {
      overallConfidence,
      totalMessagesAnalyzed: phase1Output.sessionMetrics.totalMessages,
      dataQuality,
      analysisDateRange: phase1Output.sessionMetrics.dateRange,
      confidenceThreshold: stageOutputs.evidenceVerification ? 0.5 : undefined,
      insightsFiltered: filteredEvidenceCount,
      deterministicScores,
      evidenceVerification: stageOutputs.evidenceVerification
        ? {
            threshold: stageOutputs.evidenceVerification.threshold,
            domainStats: stageOutputs.evidenceVerification.domainStats,
          }
        : undefined,
    },
  }) as EvaluationPayload;

  mergeTranslation(evaluation, stageOutputs.translator);

  return evaluation;
}

export function assembleCanonicalAnalysisRun(args: {
  runId: number;
  analyzedAt: string;
  phase1Output: Phase1Output;
  deterministicScores: DeterministicScores;
  typeResult: DeterministicTypeResult | null;
  domainResults: DomainResult[];
  stageOutputs: CanonicalStageOutputs;
}): CanonicalAnalysisRun {
  const activitySessions = buildReportActivitySessions(
    args.phase1Output,
    args.stageOutputs.sessionSummaries,
  );

  const evaluation = buildCanonicalEvaluation({
    analyzedAt: args.analyzedAt,
    phase1Output: args.phase1Output,
    activitySessions,
    deterministicScores: args.deterministicScores,
    typeResult: args.typeResult,
    domainResults: args.domainResults,
    stageOutputs: args.stageOutputs,
  });

  return {
    runId: args.runId,
    analyzedAt: args.analyzedAt,
    phase1Output: args.phase1Output,
    activitySessions,
    deterministicScores: args.deterministicScores,
    typeResult: args.typeResult,
    domainResults: applyEvidenceVerification(
      args.domainResults,
      args.stageOutputs.evidenceVerification,
    ),
    stageOutputs: args.stageOutputs,
    evaluation,
    ...(args.stageOutputs.translator ? { translation: args.stageOutputs.translator } : {}),
  };
}
