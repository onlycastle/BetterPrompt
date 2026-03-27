/**
 * extract-data CLI command
 *
 * Runs deterministic Phase 1 extraction on scanned sessions.
 *
 * Usage: betterprompt-cli extract-data [--maxSessions 50] [--includeProjects '["proj1"]']
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readCachedParsedSessions } from '../../lib/core/multi-source-session-scanner.js';
import { getPluginDataDir } from '../../lib/core/session-scanner.js';
import { extractPhase1DataFromParsedSessions } from '../../lib/core/data-extractor.js';
import { computeDeterministicScores } from '../../lib/core/deterministic-scorer.js';
import { buildReportActivitySessions } from '../../lib/evaluation-assembler.js';
import { createAnalysisRun } from '../../lib/results-db.js';
import { normalizeProjectFilters, normalizeProjectNameValue } from '../../lib/project-filters.js';
import {
  clearAnalysisPending,
  markAnalysisFailed,
  markAnalysisStarted,
} from '../../lib/debounce.js';

export async function execute(args: Record<string, unknown>): Promise<string> {
  const maxSessions = (args.maxSessions as number) ?? 50;
  const includeProjects = normalizeProjectFilters(args.includeProjects as string[] | undefined);

  const allSessions = await readCachedParsedSessions();
  if (allSessions.length === 0) {
    return JSON.stringify({
      status: 'no_data',
      message: 'No cached parsed sessions. Run scan-sessions first.',
    });
  }

  const sessions = includeProjects?.length
    ? allSessions.filter(s => includeProjects.includes(normalizeProjectNameValue(s.projectName)))
    : allSessions;

  if (sessions.length === 0) {
    return JSON.stringify({
      status: 'no_data',
      message: 'No sessions match the selected projects. Run scan-sessions to see available projects.',
    });
  }

  clearAnalysisPending();
  markAnalysisStarted();

  try {
    const selectedSessions = sessions.slice(0, maxSessions);
    const phase1Output = await extractPhase1DataFromParsedSessions(selectedSessions);
    const scores = computeDeterministicScores(phase1Output);
    const activitySessions = buildReportActivitySessions(phase1Output);

    const pluginDataDir = getPluginDataDir();
    await mkdir(pluginDataDir, { recursive: true });
    const phase1Path = join(pluginDataDir, 'phase1-output.json');
    await writeFile(phase1Path, JSON.stringify(phase1Output, null, 2), 'utf-8');

    const runId = createAnalysisRun({
      metrics: phase1Output.sessionMetrics,
      scores,
      phase1Output,
      activitySessions,
    });

    const runIdPath = join(pluginDataDir, 'current-run-id.txt');
    await writeFile(runIdPath, String(runId), 'utf-8');

    const metrics = phase1Output.sessionMetrics;

    return JSON.stringify({
      status: 'ok',
      runId,
      phase1OutputPath: phase1Path,
      metrics: {
        totalSessions: metrics.totalSessions,
        totalUtterances: metrics.totalDeveloperUtterances,
        totalMessages: metrics.totalMessages,
        avgMessagesPerSession: Math.round(metrics.avgMessagesPerSession),
        avgMessageLength: Math.round(metrics.avgDeveloperMessageLength),
        questionRatio: Math.round(metrics.questionRatio * 100),
        codeBlockRatio: Math.round(metrics.codeBlockRatio * 100),
        dateRange: metrics.dateRange,
      },
      deterministicScores: {
        aiPartnership: scores.aiPartnership,
        sessionCraft: scores.sessionCraft,
        toolMastery: scores.toolMastery,
        skillResilience: scores.skillResilience,
        sessionMastery: scores.sessionMastery,
        controlScore: scores.controlScore,
      },
      message:
        `Extracted ${metrics.totalDeveloperUtterances} utterances from ${metrics.totalSessions} sessions. ` +
        `Analysis run #${runId} created. Ready for domain analysis.`,
    });
  } catch (error) {
    markAnalysisFailed(error);
    throw error;
  }
}
