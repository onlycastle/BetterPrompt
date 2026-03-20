/**
 * extract_data MCP Tool
 *
 * Runs deterministic Phase 1 extraction:
 * 1. Reads parsed sessions from scan cache
 * 2. Extracts developer utterances with structural metadata
 * 3. Computes session metrics (friction, context fill, etc.)
 * 4. Runs DeterministicScorer (rubric-based scoring)
 * 5. Stores Phase1Output in ~/.betterprompt/phase1-output.json
 * 6. Creates an analysis run in the results database
 *
 * Returns summary metrics for the orchestrator.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readCachedParsedSessions } from '../../lib/core/multi-source-session-scanner.js';
import { getPluginDataDir } from '../../lib/core/session-scanner.js';
import { extractPhase1DataFromParsedSessions } from '../../lib/core/data-extractor.js';
import { computeDeterministicScores } from '../../lib/core/deterministic-scorer.js';
import { buildReportActivitySessions } from '../../lib/evaluation-assembler.js';
import { createAnalysisRun } from '../../lib/results-db.js';
import {
  clearAnalysisPending,
  markAnalysisFailed,
  markAnalysisStarted,
} from '../../lib/debounce.js';

export const definition = {
  name: 'extract_data',
  description:
    'Run deterministic Phase 1 data extraction on scanned sessions. ' +
    'Extracts developer utterances, computes session metrics, friction signals, ' +
    'and deterministic scores. Must call scan_sessions first. ' +
    'Returns summary metrics and creates an analysis run for subsequent domain analysis.',
};

export async function execute(args: { maxSessions?: number; includeProjects?: string[] }): Promise<string> {
  const maxSessions = args.maxSessions ?? 50;

  // Read cached parsed sessions from the multi-source scanner
  const allSessions = await readCachedParsedSessions();
  if (allSessions.length === 0) {
    return JSON.stringify({
      status: 'no_data',
      message: 'No cached parsed sessions. Call scan_sessions first.',
    });
  }

  // Filter by project before applying recency limit
  const sessions = args.includeProjects?.length
    ? allSessions.filter(s => args.includeProjects!.includes(s.projectName ?? 'unknown'))
    : allSessions;

  if (sessions.length === 0) {
    return JSON.stringify({
      status: 'no_data',
      message: 'No sessions match the selected projects. Call scan_sessions to see available projects.',
    });
  }

  // Clear any pending analysis flag and mark as in-progress
  clearAnalysisPending();
  markAnalysisStarted();

  try {
    // Limit to recent sessions (within filtered set)
    const selectedSessions = sessions.slice(0, maxSessions);

    // Run Phase 1 extraction
    const phase1Output = await extractPhase1DataFromParsedSessions(selectedSessions);

    // Run deterministic scoring
    const scores = computeDeterministicScores(phase1Output);
    const activitySessions = buildReportActivitySessions(phase1Output);

    // Store Phase 1 output for domain analysis skills to read
    const pluginDataDir = getPluginDataDir();
    await mkdir(pluginDataDir, { recursive: true });
    const phase1Path = join(pluginDataDir, 'phase1-output.json');
    await writeFile(phase1Path, JSON.stringify(phase1Output, null, 2), 'utf-8');

    // Create analysis run in results DB
    const runId = createAnalysisRun({
      metrics: phase1Output.sessionMetrics,
      scores,
      phase1Output,
      activitySessions,
    });

    // Store run ID for subsequent tools
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
        thinkingQuality: scores.thinkingQuality,
        communicationPatterns: scores.communicationPatterns,
        learningBehavior: scores.learningBehavior,
        contextEfficiency: scores.contextEfficiency,
        sessionOutcome: scores.sessionOutcome,
        controlScore: scores.controlScore,
      },
      message:
        `Extracted ${metrics.totalDeveloperUtterances} utterances from ${metrics.totalSessions} sessions. ` +
        `Analysis run #${runId} created. Phase 1 data saved to ${phase1Path}. ` +
        `Ready for domain analysis.`,
    });
  } catch (error) {
    markAnalysisFailed(error);
    throw error;
  }
}
