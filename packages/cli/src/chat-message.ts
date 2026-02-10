/**
 * Chat Message Formatting
 *
 * Formats phase preview snippets as conversational box-bubble chat messages
 * for the CLI live results display. No emojis — plain box borders with
 * natural conversational text, word-wrapped to fit bubble width.
 */

import pc from 'picocolors';
import type { PreviewSnippet } from './uploader.js';
import type { SessionInsights } from './animations/index.js';
import { formatDuration, formatDateShort, formatNumber } from './animations/index.js';

/** Inner width of chat bubble (characters of content per line) */
const BUBBLE_INNER_WIDTH = 50;

/** Phase display configuration (title only — no emoji icons) */
const PHASE_DISPLAY: Record<string, { title: string }> = {
  scan_overview: { title: 'Scan complete' },
  scan_highlights: { title: 'Your AI history' },
  session_summaries: { title: 'Session highlights' },
  worker_ThinkingQuality: { title: 'Thinking Quality' },
  worker_CommunicationPatterns: { title: 'Communication' },
  worker_LearningBehavior: { title: 'Learning Behavior' },
  worker_ContextEfficiency: { title: 'Context Efficiency' },
  worker_SessionOutcome: { title: 'Session Outcomes' },
  type_classification: { title: 'Your Developer Type' },
  narrative_ready: { title: 'Focus Areas' },
  discovery_rhythm: { title: 'Session Rhythm' },
  discovery_hours: { title: 'Peak Hours' },
  discovery_dialogue: { title: 'Dialogue' },
  discovery_tools: { title: 'Tool Usage' },
  discovery_tokens: { title: 'AI Output' },
  discovery_sources: { title: 'Sources' },
};

/**
 * Word-wrap text to a maximum width, respecting existing newlines.
 * Splits on word boundaries only.
 */
export function wrapText(text: string, maxWidth: number): string[] {
  const result: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      result.push('');
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length === 0) {
        // First word on line — always take it even if it exceeds maxWidth
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= maxWidth) {
        currentLine += ' ' + word;
      } else {
        result.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine.length > 0) {
      result.push(currentLine);
    }
  }

  return result;
}

/**
 * Build conversational text from phase and snippets.
 * Worker/type/narrative phases get a title prefix; scan phases are purely conversational.
 */
function buildConversationalText(phase: string, snippets: PreviewSnippet[]): string {
  const display = PHASE_DISPLAY[phase] || { title: phase };

  // For worker results: "{Title} analysis done!\n\n{content}"
  if (phase.startsWith('worker_')) {
    const parts = snippets.map(s => {
      if (s.label && s.text) return `${s.label} — ${s.text}`;
      return s.text || s.label || '';
    }).filter(Boolean);
    return `${display.title} analysis done!\n\n${parts.join('\n\n')}`;
  }

  // For type classification: "Your Developer Type: {content}"
  if (phase === 'type_classification') {
    const parts = snippets.map(s => {
      if (s.label && s.text) return `${s.label} — ${s.text}`;
      return s.text || s.label || '';
    }).filter(Boolean);
    return `${display.title}: ${parts.join(' ')}`;
  }

  // For scan overview: "Scan complete! Found {content}"
  if (phase === 'scan_overview') {
    const texts = snippets.map(s => s.text).filter(Boolean);
    return `Scan complete! Found ${texts.join(' — ')}.`;
  }

  // For scan highlights: conversational text about the project
  if (phase === 'scan_highlights') {
    const texts = snippets.map(s => s.text).filter(Boolean);
    return texts.join('. ') + '.';
  }

  // Discovery messages: single snippet with conversational text
  if (phase.startsWith('discovery_')) {
    return snippets.map(s => s.text).filter(Boolean).join(' ');
  }

  // Default: join all snippet texts
  const texts = snippets.map(s => {
    if (s.label && s.text) return `${s.label}: ${s.text}`;
    return s.text || s.label || '';
  }).filter(Boolean);
  return texts.join('\n');
}

/**
 * Render a box bubble around wrapped text lines.
 * Returns array of formatted strings with box-drawing characters.
 *
 * ┌──────────────────────────────────────────────────────┐
 * │  content line padded to inner width                  │
 * └──────────────────────────────────────────────────────┘
 */
function renderBoxBubble(wrappedLines: string[], innerWidth: number): string[] {
  const border = '─'.repeat(innerWidth + 4);
  const lines: string[] = [];

  lines.push(`  ${pc.dim('┌' + border + '┐')}`);

  for (const line of wrappedLines) {
    const padded = line + ' '.repeat(Math.max(0, innerWidth - line.length));
    lines.push(`  ${pc.dim('│')}  ${padded}  ${pc.dim('│')}`);
  }

  lines.push(`  ${pc.dim('└' + border + '┘')}`);

  return lines;
}

/**
 * Format a complete chat message from phase preview data.
 * Returns an array of formatted lines as a box bubble with timestamp below.
 */
export function formatChatMessage(
  phase: string,
  snippets: PreviewSnippet[],
  elapsed: string
): string[] {
  const text = buildConversationalText(phase, snippets);
  const wrappedLines = wrapText(text, BUBBLE_INNER_WIDTH);
  const bubbleLines = renderBoxBubble(wrappedLines, BUBBLE_INNER_WIDTH);

  // Right-aligned timestamp below the box
  const totalBubbleWidth = BUBBLE_INNER_WIDTH + 6; // 2 indent + 2 padding + 2 border
  const timestampPad = Math.max(0, totalBubbleWidth - elapsed.length);
  bubbleLines.push(' '.repeat(timestampPad) + pc.dim(elapsed));

  return bubbleLines;
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
 * Returns two conversational messages: overview (counts/dates) and highlights (top project/session/tools).
 */
export function buildScanPreviewMessages(
  insights: SessionInsights
): Array<{ phase: string; snippets: PreviewSnippet[] }> {
  const messages: Array<{ phase: string; snippets: PreviewSnippet[] }> = [];

  // Message 1: scan_overview — session count, project count, date range
  const overviewSnippets: PreviewSnippet[] = [
    {
      label: 'Sessions',
      icon: '',
      text: `${insights.sessionCount} sessions across ${insights.projectCount} project${insights.projectCount !== 1 ? 's' : ''}`,
    },
    {
      label: 'Period',
      icon: '',
      text: `${formatDateShort(insights.dateRange.from)} to ${formatDateShort(insights.dateRange.to)}`,
    },
  ];
  messages.push({ phase: 'scan_overview', snippets: overviewSnippets });

  // Message 2: scan_highlights — most active project, longest session, top tools
  const highlightParts: string[] = [];

  if (insights.mostActiveProject.name) {
    highlightParts.push(
      `Your most active project is ${insights.mostActiveProject.name} with ${insights.mostActiveProject.count} sessions`
    );
  }

  if (insights.longestSession.durationMin > 0) {
    highlightParts.push(
      `Longest deep work: ${formatDuration(insights.longestSession.durationMin)} on ${insights.longestSession.project}`
    );
  }

  if (insights.topTools.length >= 3) {
    highlightParts.push(
      `Top tools: ${insights.topTools.slice(0, 3).join(', ')}`
    );
  }

  if (highlightParts.length > 0) {
    messages.push({
      phase: 'scan_highlights',
      snippets: [{ label: '', icon: '', text: highlightParts.join('. ') }],
    });
  }

  return messages;
}

/**
 * Build progressive discovery messages from session insights.
 * These appear every ~7s during the analysis wait, providing interesting
 * data points about the user's coding patterns.
 */
export function buildProgressiveDiscoveryMessages(
  insights: SessionInsights
): Array<{ phase: string; snippets: PreviewSnippet[] }> {
  const messages: Array<{ phase: string; snippets: PreviewSnippet[] }> = [];

  // 1. Rhythm — sprints/deep dives/marathons
  const { sprints, deepDives, marathons } = insights.rhythm;
  if (insights.sessionCount > 5) {
    const parts: string[] = [];
    if (sprints > 0) parts.push(`${sprints} quick sprint${sprints !== 1 ? 's' : ''}`);
    if (deepDives > 0) parts.push(`${deepDives} deep dive${deepDives !== 1 ? 's' : ''}`);
    if (marathons > 0) parts.push(`${marathons} marathon session${marathons !== 1 ? 's' : ''}`);

    let insight = '';
    if (marathons > deepDives && marathons > sprints) {
      insight = 'you favor long, focused coding sessions.';
    } else if (sprints > deepDives && sprints > marathons) {
      insight = 'you prefer quick targeted interactions.';
    } else {
      insight = 'you balance quick fixes with serious deep work.';
    }

    messages.push({
      phase: 'discovery_rhythm',
      snippets: [{ label: '', icon: '', text: `${parts.join(', ')} — ${insight}` }],
    });
  }

  // 2. Peak hours
  if (insights.peakHours && insights.sessionCount > 3) {
    const { peakStart, peakEnd, label } = insights.peakHours;
    const fmtHour = (h: number) => {
      if (h === 0) return '12am';
      if (h < 12) return `${h}am`;
      if (h === 12) return '12pm';
      return `${h - 12}pm`;
    };
    messages.push({
      phase: 'discovery_hours',
      snippets: [{
        label: '', icon: '',
        text: `Most sessions started between ${fmtHour(peakStart)} and ${fmtHour(peakEnd)}. ${label} is your coding power zone.`,
      }],
    });
  }

  // 3. Dialogue ratio
  if (insights.userMessages > 0 && insights.aiMessages > 0) {
    const ratio = (insights.aiMessages / insights.userMessages).toFixed(1);
    messages.push({
      phase: 'discovery_dialogue',
      snippets: [{
        label: '', icon: '',
        text: `You sent ${formatNumber(insights.userMessages)} messages, AI responded ${formatNumber(insights.aiMessages)} times — that's a ${ratio}x response ratio.`,
      }],
    });
  }

  // 4. Tool usage
  if (insights.totalToolCalls > 100 && insights.topTools.length >= 3) {
    const tools = insights.topTools.slice(0, 3);
    messages.push({
      phase: 'discovery_tools',
      snippets: [{
        label: '', icon: '',
        text: `${tools[0]}, ${tools[1]}, ${tools[2]} — your top 3 tools across ${formatNumber(insights.totalToolCalls)} total calls.`,
      }],
    });
  }

  // 5. Token volume
  if (insights.totalOutputTokens > 10000) {
    const pages = Math.round(insights.totalOutputTokens / 1300);
    messages.push({
      phase: 'discovery_tokens',
      snippets: [{
        label: '', icon: '',
        text: `AI generated ${formatNumber(insights.totalOutputTokens)} tokens for you — roughly ${pages} pages of code and analysis.`,
      }],
    });
  }

  // 6. Source breakdown
  if (insights.sourceBreakdown.size > 1) {
    const entries = [...insights.sourceBreakdown.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    const parts = entries.map(([source, count]) => `${count} ${source}`);
    messages.push({
      phase: 'discovery_sources',
      snippets: [{
        label: '', icon: '',
        text: `${parts.join(' + ')} sessions — multi-tool workflow.`,
      }],
    });
  }

  return messages;
}
