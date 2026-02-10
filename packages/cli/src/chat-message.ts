/**
 * Chat Message Formatting
 *
 * Formats phase preview snippets as tree-style chat messages
 * for the CLI live results display.
 */

import pc from 'picocolors';
import type { PreviewSnippet } from './uploader.js';
import type { SessionInsights } from './animations/index.js';
import { formatDuration, formatDateShort } from './animations/index.js';

/** Phase display configuration */
const PHASE_DISPLAY: Record<string, { title: string; icon: string }> = {
  scan_overview: { title: 'Scan Complete', icon: '\u{1F4CA}' },
  scan_highlights: { title: 'Your AI History', icon: '\u{1F3C6}' },
  session_summaries: { title: 'Session Highlights', icon: '\u{1F4CB}' },
  worker_ThinkingQuality: { title: 'Thinking Quality', icon: '\u{1F9E0}' },
  worker_CommunicationPatterns: { title: 'Communication', icon: '\u{1F4AC}' },
  worker_LearningBehavior: { title: 'Learning Behavior', icon: '\u{1F4DA}' },
  worker_ContextEfficiency: { title: 'Context Efficiency', icon: '\u{26A1}' },
  worker_SessionOutcome: { title: 'Session Outcomes', icon: '\u{1F3AF}' },
  type_classification: { title: '\u{2B50} Your Developer Type', icon: '' },
  narrative_ready: { title: 'Focus Areas', icon: '\u{1F3AF}' },
};

/**
 * Format a complete chat message from phase preview data.
 * Returns an array of formatted lines (without trailing newline).
 */
export function formatChatMessage(
  phase: string,
  snippets: PreviewSnippet[],
  elapsed: string
): string[] {
  const display = PHASE_DISPLAY[phase] || { title: phase, icon: '\u{1F4CA}' };
  const lines: string[] = [];

  // Header line
  const icon = display.icon ? `${display.icon} ` : '';
  lines.push(`  ${pc.bold(`${icon}${display.title}`)}  ${pc.dim(elapsed)}`);

  // Snippet lines with tree connectors
  snippets.forEach((snippet, idx) => {
    const isLast = idx === snippets.length - 1;
    const connector = isLast ? '\u2514\u2500' : '\u251C\u2500';
    const text = snippet.text.length > 80
      ? snippet.text.slice(0, 77) + '...'
      : snippet.text;
    lines.push(`  ${pc.dim(connector)} ${snippet.icon} ${text}`);
  });

  return lines;
}

/**
 * Get the full text content of a message for streaming animation.
 * Returns concatenated text of all lines (used to calculate total chars).
 */
export function getMessageTextContent(
  phase: string,
  snippets: PreviewSnippet[],
  elapsed: string
): string {
  return formatChatMessage(phase, snippets, elapsed).join('\n');
}

/**
 * Check if a phase is the type classification (gets special treatment)
 */
export function isTypeClassification(phase: string): boolean {
  return phase === 'type_classification';
}

/**
 * Build scan-phase preview messages from local session insights.
 * Returns two messages: overview (counts/dates) and highlights (top project/session/tools).
 */
export function buildScanPreviewMessages(
  insights: SessionInsights
): Array<{ phase: string; snippets: PreviewSnippet[] }> {
  const messages: Array<{ phase: string; snippets: PreviewSnippet[] }> = [];

  // Message 1: scan_overview — session count, project count, date range
  const overviewSnippets: PreviewSnippet[] = [
    {
      label: 'Sessions',
      icon: '\u{1F50D}',
      text: `${insights.sessionCount} sessions across ${insights.projectCount} project${insights.projectCount !== 1 ? 's' : ''}`,
    },
    {
      label: 'Period',
      icon: '\u{1F4C5}',
      text: `${formatDateShort(insights.dateRange.from)} \u2192 ${formatDateShort(insights.dateRange.to)}`,
    },
  ];
  messages.push({ phase: 'scan_overview', snippets: overviewSnippets });

  // Message 2: scan_highlights — most active project, longest session, top tools
  const highlightSnippets: PreviewSnippet[] = [];

  if (insights.mostActiveProject.name) {
    highlightSnippets.push({
      label: 'Most active',
      icon: '\u{1F525}',
      text: `${insights.mostActiveProject.name} \u2014 ${insights.mostActiveProject.count} sessions`,
    });
  }

  if (insights.longestSession.durationMin > 0) {
    highlightSnippets.push({
      label: 'Longest',
      icon: '\u{23F1}\uFE0F',
      text: `Longest: ${formatDuration(insights.longestSession.durationMin)} on ${insights.longestSession.project}`,
    });
  }

  if (insights.topTools.length >= 3) {
    highlightSnippets.push({
      label: 'Top tools',
      icon: '\u{1F6E0}\uFE0F',
      text: `Top: ${insights.topTools.slice(0, 3).join(', ')}`,
    });
  }

  if (highlightSnippets.length > 0) {
    messages.push({ phase: 'scan_highlights', snippets: highlightSnippets });
  }

  return messages;
}
