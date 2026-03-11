# CLI Project Picker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an interactive project selection step to the CLI with ASCII card display, letting users choose which projects to analyze.

**Architecture:** New `project-picker.ts` module handles project discovery (Phase 0 metadata scan), ASCII card rendering (multi-column grid), and interactive selection. `scanner.ts` gains a `projectFilter` parameter. `index.ts` inserts the picker between tool selection and scanning.

**Tech Stack:** picocolors, string-width, readline, existing multiSourceScanner

---

### Task 1: Create project-picker.ts — discoverProjects()

**Files:**
- Create: `packages/cli/src/project-picker.ts`

**Step 1: Write discoverProjects function**

```typescript
/**
 * Project Picker
 *
 * Discovers projects from session metadata and presents an interactive
 * ASCII card selection UI for choosing which projects to analyze.
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
    minFileSize: 5 * 1024,   // 5KB min
    maxFileSize: 50 * 1024 * 1024, // 50MB max
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

  // Convert to ProjectInfo array
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

  // Sort by session count descending
  projects.sort((a, b) => b.sessionCount - a.sessionCount);

  return projects;
}
```

**Step 2: Verify it compiles**

Run: `cd $REPO_ROOT && npx tsc --noEmit packages/cli/src/project-picker.ts 2>&1 | head -20`

Note: This may fail until all exports are added. That's fine — we'll verify the full build at the end.

---

### Task 2: Add renderProjectCards() to project-picker.ts

**Files:**
- Modify: `packages/cli/src/project-picker.ts`

**Step 1: Add card rendering constants and helpers**

Append after the discovery section:

```typescript
// ============================================================================
// Card Rendering
// ============================================================================

/** Fixed card inner width (content area, excluding border chars) */
const CARD_INNER_WIDTH = 26;
/** Full card width including border characters */
const CARD_OUTER_WIDTH = CARD_INNER_WIDTH + 2; // │ + content + │
/** Gap between cards in multi-column layout */
const CARD_GAP = 2;
/** Maximum projects to display (show "and N more" for the rest) */
const MAX_DISPLAY_PROJECTS = 20;

/**
 * Truncate a string to fit within maxLen, adding … if truncated.
 * Operates on visible characters (ignores ANSI codes).
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/**
 * Format a date as "Mon DD" (e.g. "Feb 20")
 */
function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Render a single project card as an array of 4 lines.
 * Each line is exactly CARD_OUTER_WIDTH visible characters.
 */
function renderCard(project: ProjectInfo, index: number): string[] {
  const num = String(index + 1);
  const name = truncate(project.displayName, CARD_INNER_WIDTH - num.length - 3);
  const sessions = project.sessionCount === 1 ? '1 session' : `${project.sessionCount} sessions`;
  const date = formatShortDate(project.lastActivity);
  const detail = `${sessions} · ${date}`;

  // Line 1: top border
  const top = pc.dim('╭' + '─'.repeat(CARD_INNER_WIDTH) + '╮');

  // Line 2: number + project name
  const nameLine = pc.dim('│') + ' '
    + pc.bold(pc.cyan(num))
    + '  '
    + visualPadEnd(pc.white(name), CARD_INNER_WIDTH - num.length - 3)
    + pc.dim('│');

  // Line 3: session count + date
  const detailPad = ' '.repeat(num.length + 2);
  const detailLine = pc.dim('│') + ' '
    + visualPadEnd(pc.dim(detailPad + detail), CARD_INNER_WIDTH - 1)
    + pc.dim('│');

  // Line 4: bottom border
  const bottom = pc.dim('╰' + '─'.repeat(CARD_INNER_WIDTH) + '╯');

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
  const numColumns = Math.max(1, Math.floor((cols - 2) / (CARD_OUTER_WIDTH + CARD_GAP)));

  const displayProjects = projects.slice(0, MAX_DISPLAY_PROJECTS);
  const hiddenCount = projects.length - displayProjects.length;

  const lines: string[] = [];

  // Header
  const totalSessions = projects.reduce((sum, p) => sum + p.sessionCount, 0);
  lines.push('');
  lines.push(
    pc.bold(pc.cyan('  📂 '))
    + pc.white(`${projects.length} projects`)
    + pc.dim(` (${totalSessions} sessions total)`)
  );
  lines.push('');

  // Render cards in rows
  for (let rowStart = 0; rowStart < displayProjects.length; rowStart += numColumns) {
    const rowProjects = displayProjects.slice(rowStart, rowStart + numColumns);
    const cardLines = rowProjects.map((p, i) => renderCard(p, rowStart + i));

    // Merge card lines side by side (each card has 4 lines)
    for (let lineIdx = 0; lineIdx < 4; lineIdx++) {
      const merged = cardLines
        .map(card => card[lineIdx])
        .join(' '.repeat(CARD_GAP));
      lines.push('  ' + merged);
    }
  }

  // Footer for hidden projects
  if (hiddenCount > 0) {
    lines.push('');
    lines.push(pc.dim(`  ... and ${hiddenCount} more projects`));
  }

  lines.push('');

  return lines.join('\n');
}
```

---

### Task 3: Add promptProjectSelection() to project-picker.ts

**Files:**
- Modify: `packages/cli/src/project-picker.ts`

**Step 1: Add selection prompt**

Append after the card rendering section:

```typescript
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
 * Returns 'all' for auto mode (analyze everything) or
 * an array of encoded project directory names for filtered mode.
 *
 * Skips the prompt entirely if only 1 project exists.
 */
export async function promptProjectSelection(
  projects: ProjectInfo[],
  includeSources?: string[]
): Promise<{ mode: 'all' } | { mode: 'selected'; encodedNames: string[] }> {
  // Skip picker if 0 or 1 projects
  if (projects.length <= 1) {
    return { mode: 'all' };
  }

  // Render and display cards
  console.log(renderProjectCards(projects));

  // Selection prompt
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
          console.log(pc.dim('  → Analyzing all projects'));
          resolve({ mode: 'all' });
          return;
        }

        const indices = parseProjectSelection(normalized, projects.length);
        if (indices.length === 0) {
          console.log(pc.dim('  → Analyzing all projects'));
          resolve({ mode: 'all' });
          return;
        }

        const selected = indices.map(i => projects[i]);
        const names = selected.map(p => p.displayName).join(', ');
        console.log(pc.dim(`  → Selected: ${names}`));
        resolve({
          mode: 'selected',
          encodedNames: selected.map(p => p.encodedName),
        });
      }
    );
  });
}
```

---

### Task 4: Add projectFilter to scanSessions()

**Files:**
- Modify: `packages/cli/src/scanner.ts:532`

**Step 1: Update scanSessions signature and add filter**

Change the function signature and add filtering after Phase 1:

```typescript
// Before (line 532):
export async function scanSessions(maxSessions: number = 50, includeSources?: string[]): Promise<ScanResult> {

// After:
export async function scanSessions(
  maxSessions: number = 50,
  includeSources?: string[],
  projectFilter?: string[]
): Promise<ScanResult> {
```

Then after the `allFiles` mapping (after line 547), add:

```typescript
  // Apply project filter (if user selected specific projects)
  if (projectFilter && projectFilter.length > 0) {
    const filterSet = new Set(projectFilter);
    allFiles = allFiles.filter(f => filterSet.has(f.projectDirName));
  }
```

Also change `const allFiles` to `let allFiles` on line 541.

---

### Task 5: Integrate project picker into index.ts

**Files:**
- Modify: `packages/cli/src/index.ts:14-15` (imports)
- Modify: `packages/cli/src/index.ts:456-477` (runAnalysis flow)

**Step 1: Add import**

After the existing scanner import (line 14), add:

```typescript
import { discoverProjects, promptProjectSelection } from './project-picker.js';
```

**Step 2: Insert project selection between tool selection and scanning**

Replace lines 456-477 (from `promptToolSelection()` through `scanSessions()`) with:

```typescript
  // Tool selection: detect installed tools or prompt user
  const toolSelection = await promptToolSelection();
  console.log('');

  // Check if any session sources are available
  const hasProjects = await hasClaudeProjects();
  if (!hasProjects) {
    displayNoSessions(toolSelection.displayLabel);
    process.exit(1);
  }

  // Step 2.5: Discover and select projects
  const discoverySpinner = ora(`Discovering ${toolSelection.displayLabel} projects...`).start();
  let allProjects;
  try {
    allProjects = await discoverProjects(toolSelection.includeSources);
  } catch (error) {
    discoverySpinner.fail('Failed to discover projects');
    displayError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
  discoverySpinner.succeed(`Found ${allProjects.length} projects`);

  const projectSelection = await promptProjectSelection(allProjects);
  const projectFilter = projectSelection.mode === 'selected'
    ? projectSelection.encodedNames
    : undefined;

  console.log('');

  // Step 3: Auto-scan sessions and show summary
  const scanSpinner = ora(`Scanning ${toolSelection.displayLabel} sessions...`).start();

  let scanResult;
  try {
    scanResult = await scanSessions(50, toolSelection.includeSources, projectFilter);
  } catch (error) {
    scanSpinner.fail('Failed to scan sessions');
    displayError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
```

---

### Task 6: Build and manual verification

**Step 1: Run typecheck**

Run: `cd $REPO_ROOT && npm run typecheck`
Expected: No errors

**Step 2: Run build**

Run: `cd $REPO_ROOT/packages/cli && npm run build`
Expected: Successful build

**Step 3: Manual test**

Run: `cd $REPO_ROOT && NOSLOP_DEBUG=1 node packages/cli/dist/index.js`
Expected: After tool selection, see ASCII card grid of discovered projects, then selection prompt.
