/**
 * Segment Detector
 *
 * Detects segment boundaries within a session file to identify:
 * - Time gaps (30min+) that indicate session breaks
 * - Context continuation markers ("being continued from a previous conversation")
 * - /clear commands that reset the session
 *
 * This helps identify sessions that are mostly context reuse vs fresh work.
 */

/**
 * A segment represents a continuous block of work within a session
 */
export interface Segment {
  startLine: number;
  endLine: number;
  startTime: Date | null;
  endTime: Date | null;
  messageCount: number;
  boundaryType: 'time-gap' | 'context-continue' | 'clear-command' | 'session-start';
}

/**
 * Result of segment detection
 */
export interface SegmentDetectionResult {
  segments: Segment[];
  isMultiSegment: boolean;
  contextContinueCount: number;
  clearCommandCount: number;
  timeGapCount: number;
}

/**
 * Configuration for segment detection
 */
const SEGMENT_CONFIG = {
  // Minimum time gap (in minutes) to consider as a new segment
  TIME_GAP_THRESHOLD_MINUTES: 30,
  // Patterns that indicate context continuation
  CONTEXT_CONTINUE_PATTERNS: [
    /being continued from a previous conversation/i,
    /context from previous session/i,
    /resuming from where we left off/i,
    /continuing our previous discussion/i,
  ],
  // Patterns that indicate session clear/reset
  CLEAR_PATTERNS: [
    /^\/clear\s*$/m,
    /<command-name>\/clear<\/command-name>/,
  ],
};

/**
 * Parse a JSONL line and extract timestamp
 */
function parseLineWithTimestamp(line: string): {
  type: string;
  timestamp: Date | null;
  text: string;
} | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    const timestamp = parsed.timestamp ? new Date(parsed.timestamp) : null;
    const text = extractTextContent(parsed.message);

    return {
      type: parsed.type || '',
      timestamp,
      text,
    };
  } catch {
    return null;
  }
}

/**
 * Extract text content from a message (handles various formats)
 */
function extractTextContent(message: unknown): string {
  if (!message) return '';

  if (typeof message === 'string') return message;

  if (Array.isArray(message)) {
    return message
      .map(block => {
        if (typeof block === 'string') return block;
        if (block && typeof block === 'object') {
          if ('text' in block) return String(block.text);
          if ('content' in block) return extractTextContent(block.content);
        }
        return '';
      })
      .join(' ');
  }

  if (typeof message === 'object' && 'content' in message) {
    return extractTextContent((message as { content: unknown }).content);
  }

  return '';
}

/**
 * Check if text contains context continuation marker
 */
function hasContextContinueMarker(text: string): boolean {
  return SEGMENT_CONFIG.CONTEXT_CONTINUE_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Check if text contains clear command
 */
function hasClearCommand(text: string): boolean {
  return SEGMENT_CONFIG.CLEAR_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Calculate time gap in minutes between two timestamps
 */
function getTimeGapMinutes(prev: Date | null, curr: Date | null): number {
  if (!prev || !curr) return 0;
  return Math.abs(curr.getTime() - prev.getTime()) / (1000 * 60);
}

/**
 * Detect segments within session content
 *
 * Scans through JSONL lines and identifies segment boundaries based on:
 * 1. Time gaps > 30 minutes
 * 2. Context continuation markers in system/user messages
 * 3. /clear commands
 */
export function detectSegments(content: string): SegmentDetectionResult {
  const lines = content.split('\n');
  const segments: Segment[] = [];

  let currentSegment: Segment = {
    startLine: 0,
    endLine: 0,
    startTime: null,
    endTime: null,
    messageCount: 0,
    boundaryType: 'session-start',
  };

  let prevTimestamp: Date | null = null;
  let contextContinueCount = 0;
  let clearCommandCount = 0;
  let timeGapCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const parsed = parseLineWithTimestamp(lines[i]);
    if (!parsed) continue;

    // Only count user and assistant messages
    const isConversation = parsed.type === 'user' || parsed.type === 'assistant';
    if (!isConversation) continue;

    const timestamp = parsed.timestamp;
    const text = parsed.text;

    // Check for segment boundaries
    let newBoundaryType: Segment['boundaryType'] | null = null;

    // 1. Check for context continuation marker
    if (hasContextContinueMarker(text)) {
      newBoundaryType = 'context-continue';
      contextContinueCount++;
    }

    // 2. Check for /clear command
    if (hasClearCommand(text)) {
      newBoundaryType = 'clear-command';
      clearCommandCount++;
    }

    // 3. Check for time gap (only if we have both timestamps)
    if (!newBoundaryType && prevTimestamp && timestamp) {
      const gapMinutes = getTimeGapMinutes(prevTimestamp, timestamp);
      if (gapMinutes >= SEGMENT_CONFIG.TIME_GAP_THRESHOLD_MINUTES) {
        newBoundaryType = 'time-gap';
        timeGapCount++;
      }
    }

    // If we found a boundary, finalize current segment and start new one
    if (newBoundaryType && currentSegment.messageCount > 0) {
      currentSegment.endLine = i - 1;
      segments.push(currentSegment);

      currentSegment = {
        startLine: i,
        endLine: i,
        startTime: timestamp,
        endTime: timestamp,
        messageCount: 0,
        boundaryType: newBoundaryType,
      };
    }

    // Update current segment
    currentSegment.messageCount++;
    currentSegment.endLine = i;

    if (!currentSegment.startTime) {
      currentSegment.startTime = timestamp;
    }
    currentSegment.endTime = timestamp;
    prevTimestamp = timestamp;
  }

  // Finalize last segment
  if (currentSegment.messageCount > 0) {
    segments.push(currentSegment);
  }

  return {
    segments,
    isMultiSegment: segments.length > 1,
    contextContinueCount,
    clearCommandCount,
    timeGapCount,
  };
}

/**
 * Calculate a "freshness" score based on segment analysis
 *
 * Returns 0-100 where:
 * - 100 = All work is fresh (single segment, no context continuation)
 * - 0 = Mostly continued context with little new work
 */
export function calculateFreshnessScore(result: SegmentDetectionResult): number {
  if (result.segments.length === 0) return 0;

  // Count total messages and "fresh" messages
  let totalMessages = 0;
  let freshMessages = 0;

  for (const segment of result.segments) {
    totalMessages += segment.messageCount;

    // Session-start and time-gap segments are considered "fresh"
    // Context-continue segments are penalized
    if (segment.boundaryType === 'session-start' || segment.boundaryType === 'time-gap') {
      freshMessages += segment.messageCount;
    } else if (segment.boundaryType === 'clear-command') {
      // After /clear is a fresh start
      freshMessages += segment.messageCount;
    } else {
      // context-continue: only count partial as fresh
      freshMessages += segment.messageCount * 0.3;
    }
  }

  if (totalMessages === 0) return 0;

  // Penalty for having too many context continuations
  const continuePenalty = Math.min(result.contextContinueCount * 10, 30);

  const rawScore = (freshMessages / totalMessages) * 100;
  return Math.max(0, Math.round(rawScore - continuePenalty));
}
