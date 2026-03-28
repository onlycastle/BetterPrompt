/**
 * Hook Utilities
 *
 * Shared helpers for BetterPrompt Claude Code hooks.
 *
 * @module plugin/lib/hook-utils
 */

import { readFileSync } from 'node:fs';

interface TranscriptLine {
  timestamp?: string;
}

interface TranscriptEntry {
  type?: string;
  isMeta?: boolean;
  sourceToolUseID?: string;
  toolUseResult?: unknown;
  message?: {
    stop_reason?: string | null;
  };
}

function extractTimestampMs(line: string): number | null {
  try {
    const parsed = JSON.parse(line) as TranscriptLine;
    if (typeof parsed.timestamp !== 'string') {
      return null;
    }

    const timestampMs = new Date(parsed.timestamp).getTime();
    return Number.isNaN(timestampMs) ? null : timestampMs;
  } catch {
    return null;
  }
}

export function estimateSessionDurationMsFromTranscript(transcriptPath: string): number {
  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean);

    if (lines.length < 2) {
      return 0;
    }

    const firstTimestamp = extractTimestampMs(lines[0]!);
    const lastTimestamp = extractTimestampMs(lines[lines.length - 1]!);

    if (firstTimestamp === null || lastTimestamp === null || lastTimestamp <= firstTimestamp) {
      return 0;
    }

    return lastTimestamp - firstTimestamp;
  } catch {
    return 0;
  }
}

export function readLastTranscriptEntry(transcriptPath: string): TranscriptEntry | null {
  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      return null;
    }

    return JSON.parse(lines[lines.length - 1]!) as TranscriptEntry;
  } catch {
    return null;
  }
}

export function isInFlightTranscriptBoundary(transcriptPath: string): boolean {
  const lastEntry = readLastTranscriptEntry(transcriptPath);
  if (!lastEntry) {
    return false;
  }

  if (lastEntry.type === 'progress') {
    return true;
  }

  if (lastEntry.isMeta || typeof lastEntry.sourceToolUseID === 'string') {
    return true;
  }

  if (lastEntry.toolUseResult !== undefined) {
    return true;
  }

  if (lastEntry.message?.stop_reason === 'tool_use') {
    return true;
  }

  return false;
}

export function buildFirstRunAdditionalContext(): string {
  return [
    'BetterPrompt is installed but has not been set up yet.',
    'Immediately invoke the BetterPrompt `bp setup` skill to guide the user through first-time onboarding.',
    'This is a quick (~1 min) wizard that verifies the installation and points the user toward their first analysis.',
  ].join(' ');
}

export function buildPendingAnalysisAdditionalContext(): string {
  return [
    'BetterPrompt auto-analysis is pending from a previous session.',
    'Immediately invoke the BetterPrompt `bp analyze` skill to consume the queued analysis unless the user explicitly asks to cancel or defer it.',
    'Run the full local-first BetterPrompt pipeline through report generation for this queued task before treating it as complete, including translation when the report language requires it.',
  ].join(' ');
}
