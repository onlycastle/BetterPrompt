/**
 * Chat Message Formatting
 *
 * Formats phase preview snippets as tree-style chat messages
 * for the CLI live results display.
 */

import pc from 'picocolors';
import type { PreviewSnippet } from './uploader.js';

/** Phase display configuration */
const PHASE_DISPLAY: Record<string, { title: string; icon: string }> = {
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
