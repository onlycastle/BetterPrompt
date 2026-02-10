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
import { visualWidth, visualPadEnd } from './lib/string-utils.js';

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
  discovery_tokens: { title: 'AI Output' },
  discovery_sources: { title: 'Sources' },
  scan_stats: { title: 'Your AI journey' },
  discovery_firstwords: { title: 'First words' },
  discovery_longest_prompt: { title: 'Epic prompt' },
  discovery_ai_highlight: { title: 'AI highlight' },
  discovery_avg_length: { title: 'Message style' },
  discovery_quote: { title: 'Found in your sessions' },
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
      } else if (visualWidth(currentLine) + 1 + visualWidth(word) <= maxWidth) {
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

  // For scan stats: plain conversational text
  if (phase === 'scan_stats') {
    return snippets.map(s => s.text).filter(Boolean).join(' ');
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
    const padded = visualPadEnd(line, innerWidth);
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

// -- Instant-Frame Streaming API -------------------------------------------

/** Decomposed chat message parts for instant-frame streaming */
export interface ChatMessageParts {
  /** Word-wrapped content lines (no box frame) */
  wrappedLines: string[];
  /** wrappedLines.join('\n') — used for character counting */
  contentText: string;
  /** Inner width of the box bubble (BUBBLE_INNER_WIDTH) */
  innerWidth: number;
  /** Timestamp string (e.g. "1:23") */
  elapsed: string;
}

/**
 * Extract the content parts of a chat message without rendering the box frame.
 * Used by the streaming display to count only content characters.
 */
export function getChatMessageParts(
  phase: string,
  snippets: PreviewSnippet[],
  elapsed: string
): ChatMessageParts {
  const text = buildConversationalText(phase, snippets);
  const wrappedLines = wrapText(text, BUBBLE_INNER_WIDTH);
  const contentText = wrappedLines.join('\n');
  return { wrappedLines, contentText, innerWidth: BUBBLE_INNER_WIDTH, elapsed };
}

/**
 * Render a box-framed message with only a portion of the content revealed.
 * The box frame (top/bottom borders, side borders) always renders in full.
 * Content inside the box is progressively revealed up to `revealedChars`.
 *
 * @param parts - Decomposed message parts from getChatMessageParts()
 * @param revealedChars - Number of content characters to show (0 = empty box)
 * @param cursorStr - Cursor string to append at typing position (null = no cursor)
 * @returns Array of formatted lines (same structure as formatChatMessage)
 */
export function renderPartialBoxMessage(
  parts: ChatMessageParts,
  revealedChars: number,
  cursorStr: string | null
): string[] {
  const { wrappedLines, contentText, innerWidth, elapsed } = parts;
  const border = '─'.repeat(innerWidth + 4);
  const lines: string[] = [];

  // Top border — always full
  lines.push(`  ${pc.dim('┌' + border + '┐')}`);

  // Walk wrapped lines, tracking how many content chars have been consumed.
  // The content text is wrappedLines.join('\n'), so between each line there
  // is one '\n' character that counts toward revealedChars.
  let charsConsumed = 0;

  for (let i = 0; i < wrappedLines.length; i++) {
    const lineText = wrappedLines[i];
    // Account for the '\n' separator before this line (except the first)
    if (i > 0) charsConsumed++; // the '\n'

    if (charsConsumed >= revealedChars) {
      // This line is not yet reached — render empty
      const padded = ' '.repeat(innerWidth);
      lines.push(`  ${pc.dim('│')}  ${padded}  ${pc.dim('│')}`);
    } else if (charsConsumed + lineText.length <= revealedChars) {
      // Fully revealed line
      const padded = visualPadEnd(lineText, innerWidth);
      lines.push(`  ${pc.dim('│')}  ${padded}  ${pc.dim('│')}`);
      charsConsumed += lineText.length;
    } else {
      // Partially revealed line
      const visibleCount = revealedChars - charsConsumed;
      const visiblePart = lineText.slice(0, visibleCount);
      const cursor = cursorStr ?? '';
      // Padding must account for visible chars only (cursor is ANSI-colored, zero visual width counted separately)
      const padLen = Math.max(0, innerWidth - visualWidth(visiblePart) - (cursorStr ? 1 : 0));
      const padded = visiblePart + cursor + ' '.repeat(padLen);
      lines.push(`  ${pc.dim('│')}  ${padded}  ${pc.dim('│')}`);
      charsConsumed += lineText.length;
    }
  }

  // Bottom border — always full
  lines.push(`  ${pc.dim('└' + border + '┘')}`);

  // Timestamp — only shown when all content is revealed
  const isFullyRevealed = revealedChars >= contentText.length;
  const totalBubbleWidth = innerWidth + 6;
  if (isFullyRevealed) {
    const timestampPad = Math.max(0, totalBubbleWidth - elapsed.length);
    lines.push(' '.repeat(timestampPad) + pc.dim(elapsed));
  } else {
    lines.push(''); // placeholder line to keep spacing consistent
  }

  return lines;
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

  if (highlightParts.length > 0) {
    messages.push({
      phase: 'scan_highlights',
      snippets: [{ label: '', icon: '', text: highlightParts.join('. ') }],
    });
  }

  // Message 3: scan_stats — total hours, coding streak
  const totalHours = Math.round(insights.totalDurationMinutes / 60);
  const daySpan = Math.max(
    1,
    Math.ceil(
      (insights.dateRange.to.getTime() - insights.dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1
  );
  if (totalHours > 0) {
    let statsText = `${totalHours} hours of AI pair programming across ${daySpan} days.`;
    if (insights.codingStreakDays > 1) {
      statsText += ` Your longest coding streak: ${insights.codingStreakDays} consecutive days.`;
    }
    messages.push({
      phase: 'scan_stats',
      snippets: [{ label: '', icon: '', text: statsText }],
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

  // 4. Token volume
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

  // 7. First words
  if (insights.firstUserMessage) {
    messages.push({
      phase: 'discovery_firstwords',
      snippets: [{ label: '', icon: '', text: `Your first words to AI: "${insights.firstUserMessage}"` }],
    });
  }

  // 8. Longest prompt
  if (insights.longestUserPrompt.words > 20) {
    messages.push({
      phase: 'discovery_longest_prompt',
      snippets: [{
        label: '', icon: '',
        text: `Your longest prompt: ${formatNumber(insights.longestUserPrompt.words)} words on ${insights.longestUserPrompt.project} — that's a detailed spec.`,
      }],
    });
  }

  // 9. AI highlight
  if (insights.longestAIResponse.words > 100) {
    messages.push({
      phase: 'discovery_ai_highlight',
      snippets: [{
        label: '', icon: '',
        text: `AI's longest response: ${formatNumber(insights.longestAIResponse.words)} words building your ${insights.longestAIResponse.project} project.`,
      }],
    });
  }

  // 10. Average message length
  if (insights.avgUserMessageWords > 0) {
    let style: string;
    if (insights.avgUserMessageWords < 15) style = 'You give short, precise commands.';
    else if (insights.avgUserMessageWords < 40) style = 'You give clear, mid-length instructions.';
    else style = 'You write detailed, thorough prompts.';
    messages.push({
      phase: 'discovery_avg_length',
      snippets: [{
        label: '', icon: '',
        text: `Average message: ${insights.avgUserMessageWords} words. ${style}`,
      }],
    });
  }

  // 11. Random quote
  if (insights.shortUserQuotes.length > 0) {
    const quote = insights.shortUserQuotes[Math.floor(Math.random() * insights.shortUserQuotes.length)];
    messages.push({
      phase: 'discovery_quote',
      snippets: [{ label: '', icon: '', text: `Random find from your sessions: "${quote}"` }],
    });
  }

  return messages;
}
