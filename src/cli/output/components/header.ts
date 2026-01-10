/**
 * Header Component
 *
 * Renders the report header with session metadata.
 */

import pc from 'picocolors';
import boxen from 'boxen';
import type { ParsedSession, Evaluation } from '../../../models/index.js';

/**
 * Render the main report header
 */
export function renderHeader(
  evaluation: Evaluation,
  session?: ParsedSession
): string {
  const lines: string[] = [];

  // Title box
  const title = boxen(pc.bold(pc.white(' AI COLLABORATION REPORT ')), {
    padding: { left: 2, right: 2, top: 0, bottom: 0 },
    borderStyle: 'double',
    borderColor: 'cyan',
  });

  lines.push('');
  lines.push(title);
  lines.push('');

  // Session metadata
  lines.push(pc.dim(`  Session: ${evaluation.sessionId}`));

  const date = new Date(evaluation.analyzedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  lines.push(pc.dim(`  Date: ${date}`));

  if (session) {
    const duration = Math.round(session.durationSeconds / 60);
    const messages =
      session.stats.userMessageCount + session.stats.assistantMessageCount;
    const tools = session.stats.toolCallCount;

    lines.push(
      pc.dim(`  Duration: ${duration} min │ Messages: ${messages} │ Tools: ${tools}`)
    );
  }

  return lines.join('\n');
}
