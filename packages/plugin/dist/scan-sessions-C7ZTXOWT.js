import {
  normalizeProjectFilters,
  normalizeProjectNameValue,
  scanAndCacheParsedSessions
} from "./chunk-UNYQVFLT.js";
import {
  getAnalysisLifecycleState,
  isAnalysisPending
} from "./chunk-VXUKPHXP.js";
import "./chunk-FIGO7IPG.js";
import "./chunk-FW6ZW4J3.js";
import "./chunk-UORQZYNI.js";
import "./chunk-NSBPE2FW.js";

// cli/commands/scan-sessions.ts
async function execute(args) {
  const allSessions = await scanAndCacheParsedSessions();
  const includeProjects = normalizeProjectFilters(args.includeProjects);
  if (allSessions.length === 0) {
    return JSON.stringify({
      status: "no_sessions",
      message: "No supported Claude Code or Cursor sessions found on this machine."
    });
  }
  const allProjectNames = [...new Set(allSessions.map((s) => normalizeProjectNameValue(s.projectName)))];
  const allProjects = allProjectNames.map((name) => ({
    name,
    sessionCount: allSessions.filter((s) => normalizeProjectNameValue(s.projectName) === name).length
  })).sort((a, b) => b.sessionCount - a.sessionCount);
  const sessions = includeProjects?.length ? allSessions.filter((s) => includeProjects.includes(normalizeProjectNameValue(s.projectName))) : allSessions;
  if (sessions.length === 0) {
    return JSON.stringify({
      status: "no_sessions_after_filter",
      allProjects,
      message: `No sessions match the selected projects. ${allSessions.length} total sessions available across ${allProjectNames.length} projects.`
    });
  }
  const projectNames = [...new Set(sessions.map((s) => normalizeProjectNameValue(s.projectName)))];
  const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
  const totalDuration = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const sourceCounts = sessions.reduce((acc, session) => {
    const source = session.source ?? "unknown";
    acc[source] = (acc[source] ?? 0) + 1;
    return acc;
  }, {});
  const earliest = sessions[sessions.length - 1];
  const latest = sessions[0];
  const pending = isAnalysisPending();
  const analysisState = getAnalysisLifecycleState();
  return JSON.stringify({
    status: "ok",
    sessionCount: sessions.length,
    projectCount: projectNames.length,
    projects: projectNames.slice(0, 10),
    allProjects,
    sources: sourceCounts,
    totalMessages,
    totalDurationMinutes: Math.round(totalDuration / 60),
    dateRange: {
      earliest: earliest.startTime,
      latest: latest.startTime
    },
    avgMessagesPerSession: Math.round(totalMessages / sessions.length),
    analysisState,
    analysisPending: pending,
    message: pending ? `Found ${sessions.length} sessions. A queued BetterPrompt analysis is pending.` : `Found ${sessions.length} sessions across ${projectNames.length} projects. Ready for extraction.`
  });
}
export {
  execute
};
//# sourceMappingURL=scan-sessions-C7ZTXOWT.js.map