/**
 * scan-sessions CLI command
 *
 * Scans all supported local session sources and caches fully parsed sessions.
 * Returns session metadata (count, date range, total messages).
 *
 * Usage: betterprompt-cli scan-sessions [--includeProjects '["proj1","proj2"]']
 */

import {
  scanAndCacheParsedSessions,
} from '../../lib/core/multi-source-session-scanner.js';
import { getAnalysisLifecycleState, isAnalysisPending } from '../../lib/debounce.js';
import { normalizeProjectFilters, normalizeProjectNameValue } from '../../lib/project-filters.js';

export async function execute(args: Record<string, unknown>): Promise<string> {
  const allSessions = await scanAndCacheParsedSessions();
  const includeProjects = normalizeProjectFilters(args.includeProjects as string[] | undefined);

  if (allSessions.length === 0) {
    return JSON.stringify({
      status: 'no_sessions',
      message: 'No supported Claude Code or Cursor sessions found on this machine.',
    });
  }

  const allProjectNames = [...new Set(allSessions.map(s => normalizeProjectNameValue(s.projectName)))];
  const allProjects = allProjectNames.map(name => ({
    name,
    sessionCount: allSessions.filter(s => normalizeProjectNameValue(s.projectName) === name).length,
  })).sort((a, b) => b.sessionCount - a.sessionCount);

  const sessions = includeProjects?.length
    ? allSessions.filter(s => includeProjects.includes(normalizeProjectNameValue(s.projectName)))
    : allSessions;

  if (sessions.length === 0) {
    return JSON.stringify({
      status: 'no_sessions_after_filter',
      allProjects,
      message: `No sessions match the selected projects. ${allSessions.length} total sessions available across ${allProjectNames.length} projects.`,
    });
  }

  const projectNames = [...new Set(sessions.map(s => normalizeProjectNameValue(s.projectName)))];
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
    allProjects,
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
      ? `Found ${sessions.length} sessions. A queued BetterPrompt analysis is pending.`
      : `Found ${sessions.length} sessions across ${projectNames.length} projects. Ready for extraction.`,
  });
}
