# CLI Project Picker Design

**Date**: 2026-02-22
**Status**: Approved

## Problem

The CLI currently auto-scans all projects after tool selection. Users have no visibility into which projects exist or control over which ones are analyzed.

## Solution

Add an interactive project selection step between tool selection and session scanning. Projects are displayed as ASCII cards in a multi-column grid layout.

## Data Flow

```
promptToolSelection()
  → discoverProjects(sources)          # Phase 0: metadata only (fast)
  → renderProjectCards() + prompt      # ASCII card UI + selection
  → scanSessions(50, sources, filter)  # Existing logic + project filter
  → upload
```

## New File: `packages/cli/src/project-picker.ts`

### Types

```typescript
interface ProjectInfo {
  encodedName: string;      // -Users-sungmancho-projects-nomoreaislop
  displayName: string;      // nomoreaislop
  sessionCount: number;
  lastActivity: Date;
  sources: string[];
}
```

### Functions

1. **`discoverProjects(includeSources?)`** — Collects file metadata via `multiSourceScanner.collectAllFileMetadata()`, groups by `projectDirName`, resolves display names. Returns `ProjectInfo[]` sorted by session count descending.

2. **`renderProjectCards(projects, terminalCols)`** — Renders multi-column ASCII card grid. Card width: 28 chars. Columns: `Math.max(1, Math.floor((cols - 2) / 31))`. Uses `string-width` for ANSI-safe width calculation.

3. **`promptProjectSelection(projects)`** — readline prompt returning `'all'` or `string[]` of encoded project names.

### Card Layout

```
  ╭──────────────────────────╮  ╭──────────────────────────╮
  │  1  nomoreaislop         │  │  2  youtube-english      │
  │     23 sessions · Feb 20 │  │      8 sessions · Feb 18 │
  ╰──────────────────────────╯  ╰──────────────────────────╯
```

## Modified Files

### `scanner.ts`

Add `projectFilter?: string[]` parameter to `scanSessions()`. Filter `allFiles` after Phase 1 collection, before Phase 2 pre-filtering.

### `index.ts`

Insert project selection between `promptToolSelection()` and scanning. Skip selection UI when only 1 project exists.

## Edge Cases

- **1 project**: Skip picker, auto-select
- **0 projects**: Existing `displayNoSessions()` path
- **Narrow terminal (<40)**: Single column fallback
- **20+ projects**: Show top 20 by session count, "and N more" footer
- **Session limit**: Keep existing 50-session cap with diversity algorithm applied to selected projects only
