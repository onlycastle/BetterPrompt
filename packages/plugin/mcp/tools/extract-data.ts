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
import { homedir } from 'node:os';
import { readCachedSessions, PLUGIN_DATA_DIR } from '../../lib/core/session-scanner.js';
import { extractPhase1Data } from '../../lib/core/data-extractor.js';
import { computeDeterministicScores } from '../../lib/core/deterministic-scorer.js';
import { createAnalysisRun } from '../../lib/results-db.js';

export const definition = {
  name: 'extract_data',
  description:
    'Run deterministic Phase 1 data extraction on scanned sessions. ' +
    'Extracts developer utterances, computes session metrics, friction signals, ' +
    'and deterministic scores. Must call scan_sessions first. ' +
    'Returns summary metrics and creates an analysis run for subsequent domain analysis.',
};

export async function execute(args: { maxSessions?: number }): Promise<string> {
  const maxSessions = args.maxSessions ?? 50;

  // Read cached session metadata
  const sessions = await readCachedSessions();
  if (sessions.length === 0) {
    return JSON.stringify({
      status: 'no_data',
      message: 'No cached session data. Call scan_sessions first.',
    });
  }

  // Limit to recent sessions
  const selectedSessions = sessions.slice(0, maxSessions);

  // Run Phase 1 extraction
  const phase1Output = await extractPhase1Data(selectedSessions);

  // Run deterministic scoring
  const scores = computeDeterministicScores(phase1Output);

  // Store Phase 1 output for domain analysis skills to read
  await mkdir(PLUGIN_DATA_DIR, { recursive: true });
  const phase1Path = join(PLUGIN_DATA_DIR, 'phase1-output.json');
  await writeFile(phase1Path, JSON.stringify(phase1Output, null, 2), 'utf-8');

  // Create analysis run in results DB
  const runId = createAnalysisRun(phase1Output.sessionMetrics, scores);

  // Store run ID for subsequent tools
  const runIdPath = join(PLUGIN_DATA_DIR, 'current-run-id.txt');
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
}
