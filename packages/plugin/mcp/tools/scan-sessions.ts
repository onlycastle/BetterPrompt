/**
 * scan_sessions MCP Tool
 *
 * Scans ~/.claude/projects/ for JSONL session logs.
 * Returns session metadata (count, date range, total messages).
 * Stores session list in scan cache for subsequent tools.
 */

import { z } from 'zod';
import {
  listAllSessions,
  cacheParsedSessions,
} from '../../lib/core/session-scanner.js';

export const definition = {
  name: 'scan_sessions',
  description:
    'Scan Claude Code session logs in ~/.claude/projects/. Returns session metadata ' +
    '(count, date range, projects, total messages). Use this as the first step before ' +
    'running extract_data. Does not return full session content.',
};

export const inputSchema = {};

export async function execute(_args: Record<string, unknown>): Promise<string> {
  const sessions = await listAllSessions();

  if (sessions.length === 0) {
    return JSON.stringify({
      status: 'no_sessions',
      message: 'No Claude Code sessions found in ~/.claude/projects/. Start using Claude Code to generate session data.',
    });
  }

  // Cache for subsequent tools
  await cacheParsedSessions(sessions);

  // Aggregate metadata
  const projectNames = [...new Set(sessions.map(s => s.projectName))];
  const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);
  const totalDuration = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);

  const earliest = sessions[sessions.length - 1]!;
  const latest = sessions[0]!;

  return JSON.stringify({
    status: 'ok',
    sessionCount: sessions.length,
    projectCount: projectNames.length,
    projects: projectNames.slice(0, 10),
    totalMessages,
    totalDurationMinutes: Math.round(totalDuration / 60),
    dateRange: {
      earliest: earliest.timestamp.toISOString(),
      latest: latest.timestamp.toISOString(),
    },
    avgMessagesPerSession: Math.round(totalMessages / sessions.length),
    message: `Found ${sessions.length} sessions across ${projectNames.length} projects. Call extract_data to run Phase 1 extraction.`,
  });
}
