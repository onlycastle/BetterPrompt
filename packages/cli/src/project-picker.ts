/**
 * Project Picker
 *
 * Discovers projects from session metadata and presents an interactive
 * ASCII card selection UI for choosing which projects to analyze.
 *
 * Data flow:
 *   multiSourceScanner.collectAllFileMetadata()  (Phase 0, metadata only)
 *     → group by projectDirName
 *     → resolveProjectName() for display
 *     → render ASCII cards in multi-column grid
 *     → readline prompt for selection
 */

import pc from 'picocolors';
import { multiSourceScanner } from './lib/scanner/index.js';
import { resolveProjectName } from './lib/project-name-resolver.js';
import { visualPadEnd } from './lib/string-utils.js';

// ============================================================================
// Types
// ============================================================================

export interface ProjectInfo {
  /** Encoded directory name (e.g. -Users-sungmancho-projects-nomoreaislop) */
  encodedName: string;
  /** Human-readable project name (e.g. nomoreaislop) */
  displayName: string;
  /** Number of session files found */
  sessionCount: number;
  /** Most recent file modification time */
  lastActivity: Date;
  /** Source types that contain this project */
  sources: string[];
}

export type ProjectSelection =
  | { mode: 'all' }
  | { mode: 'selected'; encodedNames: string[] };

// ============================================================================
// Discovery
// ============================================================================

/**
 * Discover all projects from session file metadata.
 * Uses Phase 1 metadata only (no file content read) — very fast.
 *
 * Returns projects sorted by session count descending.
 */
export async function discoverProjects(includeSources?: string[]): Promise<ProjectInfo[]> {
  const { files } = await multiSourceScanner.collectAllFileMetadata({
    minFileSize: 5 * 1024,
    maxFileSize: 50 * 1024 * 1024,
    includeSources,
  });

  // Group files by project
  const projectMap = new Map<string, {
    sessionCount: number;
    lastActivity: Date;
    sources: Set<string>;
  }>();

  for (const file of files) {
    const key = file.projectDirName;
    const existing = projectMap.get(key);

    if (existing) {
      existing.sessionCount++;
      if (file.mtime > existing.lastActivity) {
        existing.lastActivity = file.mtime;
      }
      existing.sources.add(file.source);
    } else {
      projectMap.set(key, {
        sessionCount: 1,
        lastActivity: file.mtime,
        sources: new Set([file.source]),
      });
    }
  }

  const projects: ProjectInfo[] = [];
  for (const [encodedName, data] of projectMap) {
    projects.push({
      encodedName,
      displayName: resolveProjectName(encodedName),
      sessionCount: data.sessionCount,
      lastActivity: data.lastActivity,
      sources: Array.from(data.sources),
    });
  }

  projects.sort((a, b) => b.sessionCount - a.sessionCount);
  return projects;
}

// ============================================================================
// Card Rendering
// ============================================================================

/** Fixed card inner width (content area, excluding border chars) */
const CARD_INNER_WIDTH = 26;
/** Full card width including border characters (╭ + content + ╮) */
const CARD_OUTER_WIDTH = CARD_INNER_WIDTH + 2;
/** Gap between cards in multi-column layout */
const CARD_GAP = 2;
/** Maximum projects to display (show "and N more" for the rest) */
const MAX_DISPLAY_PROJECTS = 20;

/**
 * Truncate a string to fit within maxLen, adding … if truncated.
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '\u2026';
}

/**
 * Format a date as "Mon DD" (e.g. "Feb 20")
 */
function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Render a single project card as an array of 4 lines.
 */
function renderCard(project: ProjectInfo, index: number): string[] {
  const num = String(index + 1);
  // Available space: inner width - number width - spaces around number
  const nameMaxLen = CARD_INNER_WIDTH - num.length - 3;
  const name = truncate(project.displayName, nameMaxLen);
  const sessions = project.sessionCount === 1 ? '1 session' : `${project.sessionCount} sessions`;
  const date = formatShortDate(project.lastActivity);
  const detail = `${sessions} \u00B7 ${date}`;

  const top = pc.dim('\u256D' + '\u2500'.repeat(CARD_INNER_WIDTH) + '\u256E');

  // Content between │...│ must be exactly CARD_INNER_WIDTH visible chars
  // Layout: ' '(1) + num + '  '(2) + name_padded = CARD_INNER_WIDTH
  const nameLine = pc.dim('\u2502')
    + ' ' + pc.bold(pc.cyan(num)) + '  '
    + visualPadEnd(pc.white(name), nameMaxLen)
    + pc.dim('\u2502');

  const detailPad = ' '.repeat(num.length + 2);
  const detailMaxLen = CARD_INNER_WIDTH - num.length - 3;
  const detailLine = pc.dim('\u2502')
    + ' ' + detailPad
    + visualPadEnd(pc.dim(truncate(detail, detailMaxLen)), detailMaxLen)
    + pc.dim('\u2502');

  const bottom = pc.dim('\u2570' + '\u2500'.repeat(CARD_INNER_WIDTH) + '\u256F');

  return [top, nameLine, detailLine, bottom];
}

/**
 * Render project cards in a multi-column grid layout.
 *
 * Adapts to terminal width:
 * - 80+ cols: 2 columns
 * - 120+ cols: 3 columns
 * - <45 cols: 1 column (fallback)
 */
export function renderProjectCards(
  projects: ProjectInfo[],
  terminalCols?: number
): string {
  const cols = terminalCols ?? process.stdout.columns ?? 80;
  const numColumns = Math.max(1, Math.floor((cols - 4) / (CARD_OUTER_WIDTH + CARD_GAP)));

  const displayProjects = projects.slice(0, MAX_DISPLAY_PROJECTS);
  const hiddenCount = projects.length - displayProjects.length;

  const lines: string[] = [];

  // Header
  const totalSessions = projects.reduce((sum, p) => sum + p.sessionCount, 0);
  lines.push('');
  lines.push(
    pc.bold(pc.cyan('  \uD83D\uDCC2 '))
    + pc.white(`${projects.length} projects`)
    + pc.dim(` (${totalSessions} sessions total)`)
  );
  lines.push('');

  // Render cards in rows
  for (let rowStart = 0; rowStart < displayProjects.length; rowStart += numColumns) {
    const rowProjects = displayProjects.slice(rowStart, rowStart + numColumns);
    const cardLines = rowProjects.map((p, i) => renderCard(p, rowStart + i));
    const gap = ' '.repeat(CARD_GAP);

    // Merge card lines side by side (each card has 4 lines)
    for (let lineIdx = 0; lineIdx < 4; lineIdx++) {
      const merged = cardLines.map(card => card[lineIdx]).join(gap);
      lines.push('  ' + merged);
    }
  }

  if (hiddenCount > 0) {
    lines.push('');
    lines.push(pc.dim(`  ... and ${hiddenCount} more projects`));
  }

  lines.push('');
  return lines.join('\n');
}

// ============================================================================
// Selection Prompt
// ============================================================================

/**
 * Parse project selection input into indices.
 * Supports: "all", "1,2,3", "1-5", "1,3-5,7"
 */
function parseProjectSelection(input: string, max: number): number[] {
  const indices = new Set<number>();
  const parts = input.split(',').map(p => p.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= max) indices.add(i - 1);
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= 1 && num <= max) {
        indices.add(num - 1);
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Display project cards and prompt user to select projects.
 *
 * Returns { mode: 'all' } for auto mode or
 * { mode: 'selected', encodedNames: [...] } for filtered mode.
 *
 * Skips the prompt entirely if only 1 project exists.
 */
export async function promptProjectSelection(
  projects: ProjectInfo[]
): Promise<ProjectSelection> {
  if (projects.length <= 1) {
    return { mode: 'all' };
  }

  console.log(renderProjectCards(projects));

  const { createInterface } = await import('node:readline');
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      pc.cyan('  Select projects ')
        + pc.dim('(1,2,3 or Enter for all): '),
      (answer) => {
        rl.close();
        const normalized = answer.trim().toLowerCase();

        if (normalized === '' || normalized === 'all') {
          console.log(pc.dim('  \u2192 Analyzing all projects'));
          resolve({ mode: 'all' });
          return;
        }

        const indices = parseProjectSelection(normalized, projects.length);
        if (indices.length === 0) {
          console.log(pc.dim('  \u2192 Analyzing all projects'));
          resolve({ mode: 'all' });
          return;
        }

        const selected = indices.map(i => projects[i]);
        const names = selected.map(p => p.displayName).join(', ');
        console.log(pc.dim(`  \u2192 Selected: ${names}`));
        resolve({
          mode: 'selected',
          encodedNames: selected.map(p => p.encodedName),
        });
      }
    );
  });
}
