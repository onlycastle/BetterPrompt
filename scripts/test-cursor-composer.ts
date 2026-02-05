#!/usr/bin/env npx tsx
/**
 * Test Script: Cursor Composer Source (state.vscdb)
 *
 * Validates CursorComposerSource against real globalStorage/state.vscdb data.
 *
 * Usage:
 *   npx tsx scripts/test-cursor-composer.ts                           # List all sessions
 *   npx tsx scripts/test-cursor-composer.ts -n=5                      # Show top 5 sessions
 *   npx tsx scripts/test-cursor-composer.ts --composer=<composerId>   # Parse specific session
 *   npx tsx scripts/test-cursor-composer.ts --debug                   # Show raw bubble data
 */

import { CursorComposerSource } from '../packages/cli/src/lib/scanner/sources/cursor-composer';
import { getCursorGlobalStateDbPath } from '../packages/cli/src/lib/scanner/sources/cursor-paths';
import { CURSOR_COMPOSER_TOOL_IDS } from '../packages/cli/src/lib/scanner/tool-mapping';
import type { SourcedParsedSession } from '../packages/cli/src/lib/scanner/sources/base';
import type { ParsedMessage } from '../packages/cli/src/lib/scanner/session-types';
import { existsSync } from 'node:fs';

// ─────────────────────────────────────────────────────────────────────────
// CLI argument parsing
// ─────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(prefix: string): string | undefined {
  const arg = args.find(a => a.startsWith(prefix));
  return arg?.split('=')[1];
}

const maxSessions = parseInt(getArg('-n') ?? '10', 10);
const targetComposerId = getArg('--composer');
const debugMode = args.includes('--debug');
const helpMode = args.includes('--help') || args.includes('-h');

if (helpMode) {
  console.log(`
Cursor Composer Source Test Script

Usage:
  npx tsx scripts/test-cursor-composer.ts [options]

Options:
  -n=<count>              Show top N sessions (default: 10)
  --composer=<id>         Parse and display a specific composer session
  --debug                 Show raw bubble data for debugging
  -h, --help              Show this help message

Examples:
  npx tsx scripts/test-cursor-composer.ts
  npx tsx scripts/test-cursor-composer.ts -n=5
  npx tsx scripts/test-cursor-composer.ts --composer=7985e2a5-fd77-47a0-a4b9-1b50c0ba8392
  npx tsx scripts/test-cursor-composer.ts --debug
`);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────────────────

function printHeader(title: string): void {
  const line = '═'.repeat(70);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(`${line}`);
}

function printSubheader(title: string): void {
  console.log(`\n  ── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

function truncate(text: string, maxLen = 80): string {
  const oneLine = text.replace(/\n/g, ' ').trim();
  return oneLine.length > maxLen ? oneLine.substring(0, maxLen - 3) + '...' : oneLine;
}

function padRight(str: string, len: number): string {
  return str.padEnd(len);
}

function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const dbPath = getCursorGlobalStateDbPath();

  printHeader('Cursor Composer Source Test');
  console.log(`  DB Path: ${dbPath}`);
  console.log(`  Exists:  ${existsSync(dbPath) ? '✓ YES' : '✗ NO'}`);

  if (!existsSync(dbPath)) {
    console.error('\n  ✗ state.vscdb not found. Is Cursor installed?');
    process.exit(1);
  }

  const source = new CursorComposerSource(dbPath);

  // Check availability
  const available = await source.isAvailable();
  console.log(`  Available: ${available ? '✓ YES' : '✗ NO (is better-sqlite3 installed?)'}`);

  if (!available) {
    console.error('\n  ✗ CursorComposerSource is not available.');
    console.error('    Install better-sqlite3: npm install better-sqlite3');
    process.exit(1);
  }

  // Known tool ID mappings
  printSubheader('Known Tool ID Mappings');
  for (const [id, name] of Object.entries(CURSOR_COMPOSER_TOOL_IDS)) {
    console.log(`    ${padRight(id, 6)} → ${name}`);
  }

  // Collect all sessions
  printSubheader('Collecting File Metadata');
  const files = await source.collectFileMetadata();
  console.log(`  Found ${files.length} composer sessions`);

  if (files.length === 0) {
    console.log('\n  No composer sessions found in state.vscdb');
    process.exit(0);
  }

  // Sort by mtime (newest first)
  files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  // Show session list
  printSubheader(`Sessions (showing ${Math.min(maxSessions, files.length)} of ${files.length})`);
  console.log(`  ${'#'.padStart(3)}  ${padRight('Composer ID', 38)}  ${padRight('Last Updated', 20)}  ${padRight('Size', 8)}  Project`);
  console.log(`  ${'─'.repeat(3)}  ${'─'.repeat(38)}  ${'─'.repeat(20)}  ${'─'.repeat(8)}  ${'─'.repeat(30)}`);

  const displayFiles = files.slice(0, maxSessions);
  for (let i = 0; i < displayFiles.length; i++) {
    const f = displayFiles[i]!;
    const composerId = f.filePath.substring(f.filePath.indexOf('#') + 1);
    const sizeKb = Math.round(f.fileSize / 1024);
    const projectName = f.projectDirName.split('-').pop() || f.projectDirName;
    console.log(
      `  ${String(i + 1).padStart(3)}  ${padRight(composerId, 38)}  ${padRight(formatDate(f.mtime), 20)}  ${padRight(sizeKb + 'KB', 8)}  ${truncate(projectName, 30)}`
    );
  }

  // Parse specific session or the most recent one
  const composerIdToParse = targetComposerId
    ?? files[0]!.filePath.substring(files[0]!.filePath.indexOf('#') + 1);

  const filePathToParse = `${dbPath}#${composerIdToParse}`;

  printHeader(`Parsing Session: ${composerIdToParse}`);

  const parsed = await source.parseFromFile(filePathToParse);

  if (!parsed) {
    console.error('  ✗ Failed to parse session');
    process.exit(1);
  }

  printSessionDetails(parsed);

  if (debugMode) {
    await printDebugInfo(dbPath, composerIdToParse);
  }

  // Schema validation
  printSubheader('Schema Validation');
  validateParsedSession(parsed);

  console.log('\n  ✓ Test complete\n');
}

function printSessionDetails(session: SourcedParsedSession): void {
  printSubheader('Session Info');
  console.log(`  Session ID:    ${session.sessionId}`);
  console.log(`  Project:       ${session.projectPath}`);
  console.log(`  Source:        ${session.source}`);
  console.log(`  Start:         ${formatDate(session.startTime)}`);
  console.log(`  End:           ${formatDate(session.endTime)}`);
  console.log(`  Duration:      ${formatDuration(session.durationSeconds)}`);
  console.log(`  Version:       ${session.claudeCodeVersion}`);

  printSubheader('Statistics');
  console.log(`  Messages:      ${session.messages.length}`);
  console.log(`    User:        ${session.stats.userMessageCount}`);
  console.log(`    Assistant:   ${session.stats.assistantMessageCount}`);
  console.log(`  Tool Calls:    ${session.stats.toolCallCount}`);
  console.log(`  Tools Used:    ${session.stats.uniqueToolsUsed.join(', ') || '(none)'}`);
  console.log(`  Input Tokens:  ${session.stats.totalInputTokens.toLocaleString()}`);
  console.log(`  Output Tokens: ${session.stats.totalOutputTokens.toLocaleString()}`);

  printSubheader('Messages');
  for (let i = 0; i < session.messages.length; i++) {
    const msg = session.messages[i]!;
    printMessage(i, msg);
  }
}

function printMessage(index: number, msg: ParsedMessage): void {
  const roleIcon = msg.role === 'user' ? '👤' : '🤖';
  const timestamp = formatDate(msg.timestamp);
  const contentPreview = truncate(msg.content, 60);

  console.log(`\n  [${index + 1}] ${roleIcon} ${msg.role.toUpperCase()} (${timestamp})`);

  if (msg.content) {
    console.log(`      Content: ${contentPreview}`);
  }

  if (msg.toolCalls && msg.toolCalls.length > 0) {
    console.log(`      Tool Calls (${msg.toolCalls.length}):`);
    for (const tool of msg.toolCalls) {
      const inputPreview = truncate(JSON.stringify(tool.input), 50);
      console.log(`        - ${tool.name} (${tool.id.substring(0, 12)}...)`);
      console.log(`          Args: ${inputPreview}`);
    }
  }

  if (msg.tokenUsage && (msg.tokenUsage.input > 0 || msg.tokenUsage.output > 0)) {
    console.log(`      Tokens: ${msg.tokenUsage.input.toLocaleString()} in / ${msg.tokenUsage.output.toLocaleString()} out`);
  }
}

async function printDebugInfo(dbPath: string, composerId: string): Promise<void> {
  printSubheader('Debug: Raw Bubble Data');

  try {
    // @ts-ignore
    const sqlite = await import('better-sqlite3');
    const Database = (sqlite.default ?? sqlite) as unknown as new (path: string, opts?: { readonly?: boolean }) => {
      prepare(sql: string): { all(...p: unknown[]): { key: string; value: string }[] };
      close(): void;
    };

    const db = new Database(dbPath, { readonly: true });

    // Show composerData
    const composerRows = db.prepare("SELECT value FROM cursorDiskKV WHERE key = ?")
      .all(`composerData:${composerId}`);
    if (composerRows.length > 0 && composerRows[0]) {
      const data = JSON.parse(composerRows[0].value);
      console.log('\n  ComposerData:');
      console.log(`    Name: ${data.name ?? '(unnamed)'}`);
      console.log(`    Mode: ${data.unifiedMode ?? 'unknown'}`);
      console.log(`    Created: ${data.createdAt ?? 'unknown'}`);
      console.log(`    Keys: ${Object.keys(data).join(', ')}`);
    }

    // Show bubbles
    const bubbleRows = db.prepare("SELECT key, value FROM cursorDiskKV WHERE key LIKE ?")
      .all(`bubbleId:${composerId}:%`);

    console.log(`\n  Bubbles (${bubbleRows.length} total):`);
    for (const row of bubbleRows.slice(0, 20)) {
      const bubble = JSON.parse(row.value);
      const typeLabel = bubble.type === 1 ? 'USER' : bubble.type === 2 ? 'ASST' : `T${bubble.type}`;
      const hasText = bubble.text && bubble.text.length > 0;
      const hasTool = bubble.toolFormerData != null;
      const hasThinking = bubble.thinking != null;
      const flags = [
        hasText ? 'text' : null,
        hasTool ? `tool(${bubble.toolFormerData?.tool})` : null,
        hasThinking ? 'thinking' : null,
        bubble.capabilityType != null ? `cap=${bubble.capabilityType}` : null,
      ].filter(Boolean).join(', ');

      console.log(`    [${typeLabel}] ${flags} | ${truncate(bubble.text || '', 50)}`);
    }
    if (bubbleRows.length > 20) {
      console.log(`    ... and ${bubbleRows.length - 20} more bubbles`);
    }

    db.close();
  } catch (err) {
    console.error(`  Debug info failed: ${err}`);
  }
}

function validateParsedSession(session: SourcedParsedSession): void {
  const checks: [string, boolean][] = [
    ['sessionId is string', typeof session.sessionId === 'string' && session.sessionId.length > 0],
    ['projectPath is string', typeof session.projectPath === 'string'],
    ['source is cursor-composer', session.source === 'cursor-composer'],
    ['startTime is Date', session.startTime instanceof Date && !isNaN(session.startTime.getTime())],
    ['endTime is Date', session.endTime instanceof Date && !isNaN(session.endTime.getTime())],
    ['endTime >= startTime', session.endTime >= session.startTime],
    ['durationSeconds >= 0', session.durationSeconds >= 0],
    ['messages is array', Array.isArray(session.messages)],
    ['messages.length > 0', session.messages.length > 0],
    ['stats.userMessageCount >= 0', session.stats.userMessageCount >= 0],
    ['stats.assistantMessageCount >= 0', session.stats.assistantMessageCount >= 0],
    ['stats.toolCallCount >= 0', session.stats.toolCallCount >= 0],
    ['stats.uniqueToolsUsed is array', Array.isArray(session.stats.uniqueToolsUsed)],
  ];

  // Validate individual messages
  for (const msg of session.messages) {
    checks.push(
      [`msg.role is valid (${msg.role})`, msg.role === 'user' || msg.role === 'assistant'],
      [`msg.uuid exists`, typeof msg.uuid === 'string' && msg.uuid.length > 0],
      [`msg.timestamp is Date`, msg.timestamp instanceof Date && !isNaN(msg.timestamp.getTime())],
      [`msg.content is string`, typeof msg.content === 'string'],
    );

    if (msg.toolCalls) {
      for (const tool of msg.toolCalls) {
        checks.push(
          [`toolCall.name exists (${tool.name})`, typeof tool.name === 'string' && tool.name.length > 0],
          [`toolCall.id exists`, typeof tool.id === 'string' && tool.id.length > 0],
          [`toolCall.input is object`, typeof tool.input === 'object' && tool.input !== null],
        );
      }
    }
  }

  let passed = 0;
  let failed = 0;
  for (const [label, ok] of checks) {
    if (ok) {
      passed++;
    } else {
      failed++;
      console.log(`  ✗ FAIL: ${label}`);
    }
  }

  console.log(`  ${passed} passed, ${failed} failed out of ${checks.length} checks`);
  if (failed === 0) {
    console.log('  ✓ All schema validations passed');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
