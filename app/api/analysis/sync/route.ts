/**
 * POST /api/analysis/sync
 *
 * Receives pre-analyzed results from the BetterPrompt plugin's sync_to_team tool.
 * Transforms the plugin's AnalysisReport format into a VerboseEvaluation-compatible
 * shape and stores it via createAnalysisRecord().
 *
 * This bridges the plugin-first local analysis with the server-side team dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest, findUserByEmail } from '@/lib/local/auth';
import { createAnalysisRecord } from '@/lib/local/analysis-store';
import type { VerboseEvaluation } from '@/lib/models/verbose-evaluation';

/**
 * Plugin report shape (from packages/plugin/lib/core/types.ts AnalysisReport)
 */
interface PluginDomainResult {
  domain: string;
  overallScore: number;
  confidenceScore: number;
  strengths: Array<{
    title: string;
    description: string;
    evidence: Array<{ utteranceId: string; quote: string; context?: string }>;
  }>;
  growthAreas: Array<{
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
    evidence: Array<{ utteranceId: string; quote: string; context?: string }>;
  }>;
  data?: Record<string, unknown>;
  analyzedAt: string;
}

interface PluginTypeResult {
  primaryType: 'architect' | 'analyst' | 'conductor' | 'speedrunner' | 'trendsetter';
  distribution: {
    architect: number;
    analyst: number;
    conductor: number;
    speedrunner: number;
    trendsetter: number;
  };
  controlLevel: 'explorer' | 'navigator' | 'cartographer';
  controlScore: number;
  matrixName: string;
  matrixEmoji: string;
}

interface PluginReport {
  userId: string;
  analyzedAt: string;
  phase1Metrics: {
    totalSessions: number;
    totalMessages: number;
    totalDeveloperUtterances: number;
    avgMessagesPerSession: number;
    avgDeveloperMessageLength: number;
    questionRatio: number;
    codeBlockRatio: number;
    dateRange: { earliest: string; latest: string };
    avgContextFillPercent?: number;
  };
  deterministicScores: Record<string, number>;
  typeResult: PluginTypeResult | null;
  domainResults: PluginDomainResult[];
  content?: {
    topFocusAreas?: Array<{
      title: string;
      narrative: string;
      actions: { start: string; stop: string; continue: string };
    }>;
    personalitySummary?: string[];
  };
}

/**
 * Transform plugin AnalysisReport → VerboseEvaluation-compatible shape.
 *
 * The team dashboard reads:
 * - evaluation.primaryType, controlLevel, distribution (from typeResult)
 * - evaluation.workerInsights (from domainResults → keyed by domain)
 * - evaluation.agentOutputs.efficiency.inefficiencyPatterns (from contextEfficiency data)
 * - activitySessions (from phase1Metrics)
 */
function transformToEvaluation(report: PluginReport): VerboseEvaluation {
  // Build workerInsights from domainResults
  const workerInsights: Record<string, {
    strengths: Array<{
      title: string;
      description: string;
      evidence: Array<{ utteranceId: string; quote: string; context?: string }>;
    }>;
    growthAreas: Array<{
      title: string;
      description: string;
      evidence: Array<{ utteranceId: string; quote: string; context?: string }>;
      recommendation: string;
      severity?: 'critical' | 'high' | 'medium' | 'low';
    }>;
    domainScore: number;
  }> = {};

  // Build agentOutputs for anti-pattern extraction
  const inefficiencyPatterns: Array<{
    pattern: string;
    frequency: number;
    impact: string;
  }> = [];

  for (const dr of report.domainResults) {
    if (dr.domain === 'content') continue; // content is narrative, not a worker domain

    workerInsights[dr.domain] = {
      strengths: dr.strengths.map(s => ({
        title: s.title,
        description: s.description,
        evidence: s.evidence,
      })),
      growthAreas: dr.growthAreas.map(ga => ({
        title: ga.title,
        description: ga.description,
        evidence: ga.evidence,
        recommendation: ga.recommendation,
        severity: ga.severity,
      })),
      domainScore: dr.overallScore,
    };

    // Extract inefficiency patterns from contextEfficiency domain data
    if (dr.domain === 'contextEfficiency' && dr.data) {
      const patterns = dr.data.inefficiencyPatterns as Array<{
        type: string;
        frequency: number;
        impact: string;
      }> | undefined;

      if (Array.isArray(patterns)) {
        for (const p of patterns) {
          inefficiencyPatterns.push({
            pattern: p.type,
            frequency: p.frequency ?? 1,
            impact: p.impact ?? 'medium',
          });
        }
      }
    }
  }

  const typeResult = report.typeResult;

  // Construct a VerboseEvaluation-compatible object
  // Only the fields actually consumed by mapUserToTeamMember are needed
  const evaluation = {
    sessionId: `plugin-sync-${Date.now()}`,
    analyzedAt: report.analyzedAt,
    sessionsAnalyzed: report.phase1Metrics.totalSessions,
    avgPromptLength: report.phase1Metrics.avgDeveloperMessageLength,
    avgTurnsPerSession: report.phase1Metrics.avgMessagesPerSession,

    primaryType: typeResult?.primaryType ?? 'analyst',
    controlLevel: typeResult?.controlLevel ?? 'navigator',
    controlScore: typeResult?.controlScore,
    distribution: typeResult?.distribution ?? {
      architect: 20, analyst: 20, conductor: 20, speedrunner: 20, trendsetter: 20,
    },

    // Required string field
    personalitySummary: report.content?.personalitySummary?.join('\n\n') ??
      `${typeResult?.matrixEmoji ?? '🔬'} ${typeResult?.matrixName ?? 'Developer'} — ` +
      `analyzed ${report.phase1Metrics.totalSessions} sessions.`,

    // Prompt patterns (empty array - plugin doesn't produce these)
    promptPatterns: [],

    // Worker insights — the key bridge for team dashboard
    workerInsights,

    // Agent outputs for anti-pattern extraction
    agentOutputs: inefficiencyPatterns.length > 0 ? {
      efficiency: { inefficiencyPatterns },
    } : undefined,

    // Pipeline token usage (zeroed — plugin uses Claude, not Gemini)
    pipelineTokenUsage: {
      stages: [],
      totals: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
    },
  } as unknown as VerboseEvaluation;

  return evaluation;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { report?: PluginReport; syncedAt?: string };

    if (!body.report) {
      return NextResponse.json(
        { error: 'missing_report', message: 'Request body must include a report object.' },
        { status: 400 },
      );
    }

    const report = body.report;

    // Resolve user: check auth header first, fall back to local user
    const authHeader = request.headers.get('authorization');
    let userId: string;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      // Token could be an email or a user ID — try email lookup first
      const userByEmail = findUserByEmail(token);
      userId = userByEmail?.id ?? getCurrentUserFromRequest().id;
    } else {
      userId = getCurrentUserFromRequest().id;
    }

    // Transform plugin report to VerboseEvaluation
    const evaluation = transformToEvaluation(report);

    // Build activity sessions from phase1 metrics (minimal)
    const activitySessions = report.phase1Metrics ? [{
      sessionId: `plugin-${Date.now()}`,
      projectName: 'plugin-analysis',
      startTime: report.phase1Metrics.dateRange?.earliest ?? new Date().toISOString(),
      durationMinutes: 0,
      messageCount: report.phase1Metrics.totalMessages,
      summary: `Plugin analysis of ${report.phase1Metrics.totalSessions} sessions`,
    }] : undefined;

    // Store the analysis record
    const record = createAnalysisRecord({
      userId,
      evaluation,
      activitySessions,
    });

    return NextResponse.json({
      status: 'ok',
      resultId: record.resultId,
      message: `Analysis synced successfully. Result ID: ${record.resultId}`,
    });
  } catch (error) {
    console.error('[Analysis/Sync] Error:', error);
    return NextResponse.json(
      {
        error: 'sync_failed',
        message: error instanceof Error ? error.message : 'Failed to sync analysis.',
      },
      { status: 500 },
    );
  }
}
