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
import { normalizeProjectFilters, normalizeProjectNameValue } from '../../lib/project-filters.js';

export const definition = {
  name: 'scan_sessions',
  description:
    'Scan Claude Code and Cursor session logs on this machine. Returns session metadata ' +
    '(count, date range, projects, total messages, and sources). Use this as the first step before ' +
    'running extract_data. Does not return full session content.',
};

export async function execute(args: { includeProjects?: string[] }): Promise<string> {
  const allSessions = await scanAndCacheParsedSessions();
  const includeProjects = normalizeProjectFilters(args.includeProjects);

  if (allSessions.length === 0) {
    return JSON.stringify({
      status: 'no_sessions',
      message: 'No supported Claude Code or Cursor sessions found on this machine.',
    });
  }

  // Build per-project session counts (always from full set)
  const allProjectNames = [...new Set(allSessions.map(s => normalizeProjectNameValue(s.projectName)))];
  const allProjects = allProjectNames.map(name => ({
    name,
    sessionCount: allSessions.filter(s => normalizeProjectNameValue(s.projectName) === name).length,
  })).sort((a, b) => b.sessionCount - a.sessionCount);

  // Apply project filter if provided
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

  // Aggregate metadata from filtered sessions
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
      ? `Found ${sessions.length} sessions. A queued BetterPrompt analysis is pending and will be injected on the next session start. You can also run the analyze skill now.`
      : `Found ${sessions.length} sessions across ${projectNames.length} projects. Call extract_data to run Phase 1 extraction.`,
  });
}
