/**
 * scan_sessions MCP Tool
 *
 * Scans all supported local session sources and caches fully parsed sessions.
 * Returns session metadata (count, date range, total messages).
 */

import {
  scanAndCacheParsedSessions,
} from '../../lib/core/multi-source-session-scanner.js';
import { getAnalysisLifecycleState, isAnalysisPending } from '../../lib/debounce.js';

export const definition = {
  name: 'scan_sessions',
  description:
    'Scan Claude Code and Cursor session logs on this machine. Returns session metadata ' +
    '(count, date range, projects, total messages, and sources). Use this as the first step before ' +
    'running extract_data. Does not return full session content.',
};

export async function execute(_args: Record<string, unknown>): Promise<string> {
  const sessions = await scanAndCacheParsedSessions();

  if (sessions.length === 0) {
    return JSON.stringify({
      status: 'no_sessions',
      message: 'No supported Claude Code or Cursor sessions found on this machine.',
    });
  }

  // Aggregate metadata
  const projectNames = [...new Set(sessions.map(s => s.projectName ?? 'unknown'))];
  const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
  const totalDuration = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const sourceCounts = sessions.reduce<Record<string, number>>((acc, session) => {
    const source = session.source ?? 'unknown';
    acc[source] = (acc[source] ?? 0) + 1;
    return acc;
  }, {});

  const earliest = sessions[sessions.length - 1]!;
  const latest = sessions[0]!;

  const pending = isAnalysisPending();
  const analysisState = getAnalysisLifecycleState();

  return JSON.stringify({
    status: 'ok',
    sessionCount: sessions.length,
    projectCount: projectNames.length,
    projects: projectNames.slice(0, 10),
    sources: sourceCounts,
    totalMessages,
    totalDurationMinutes: Math.round(totalDuration / 60),
    dateRange: {
      earliest: earliest.startTime,
      latest: latest.startTime,
    },
    avgMessagesPerSession: Math.round(totalMessages / sessions.length),
    analysisState,
    analysisPending: pending,
    message: pending
      ? `Found ${sessions.length} sessions. A queued BetterPrompt analysis is pending and will be injected on the next session start. You can also run the analyze skill now.`
      : `Found ${sessions.length} sessions across ${projectNames.length} projects. Call extract_data to run Phase 1 extraction.`,
  });
}
