/**
 * Cursor Scanner Test Script
 *
 * Tests the CursorSource scanner to verify it produces the same
 * SourcedParsedSession format as Claude Code sessions.
 *
 * Usage:
 *   npx tsx scripts/test-cursor-scanner.ts                    # Default: scan latest 3 sessions
 *   npx tsx scripts/test-cursor-scanner.ts -n=5               # Latest 5 sessions
 *   npx tsx scripts/test-cursor-scanner.ts --compare          # Compare with Claude Code format
 *   npx tsx scripts/test-cursor-scanner.ts --debug            # Show blob parsing debug info
 *   npx tsx scripts/test-cursor-scanner.ts /path/to/store.db  # Specific file
 *
 * Requirements:
 *   - ~/.cursor/chats/ directory with Cursor session data
 *   - better-sqlite3 package installed
 */

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

import {
  CursorSource,
  CURSOR_CHATS_DIR,
} from '../src/lib/scanner/sources/cursor';
import { TOOL_MAPPING } from '../src/lib/scanner/tool-mapping';
import type { SourcedParsedSession } from '../src/lib/scanner/sources/base';
import type { ParsedMessage } from '../src/lib/models/session';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_SESSION_COUNT = 3;

// ============================================================================
// Debug Functions
// ============================================================================

interface BlobRow {
  id: string;
  data: Buffer;
}

interface MetaRow {
  key: string;
  value: string;
}

interface CursorMetadata {
  agentId: string;
  latestRootBlobId: string;
  name: string;
  mode: string;
  createdAt: number;
  lastUsedModel: string;
}

/**
 * Parse protobuf-like length-delimited string from Cursor blob
 * Cursor uses a simple format: [field_tag][length][data]
 */
function parseProtobufString(data: Buffer, offset: number): { value: string; nextOffset: number } | null {
  if (offset >= data.length) return null;

  const tag = data[offset]!;
  const wireType = tag & 0x07;

  // Wire type 2 = length-delimited (string, bytes, embedded messages)
  if (wireType !== 2) return null;

  // Read varint length
  let length = 0;
  let shift = 0;
  let pos = offset + 1;

  while (pos < data.length) {
    const byte = data[pos]!;
    length |= (byte & 0x7f) << shift;
    pos++;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }

  if (pos + length > data.length) return null;

  const value = data.subarray(pos, pos + length).toString('utf-8');
  return { value, nextOffset: pos + length };
}

/**
 * Extract text content from Cursor blob (protobuf format)
 */
function extractTextFromBlob(data: Buffer): string | null {
  // Try to find readable text in the blob
  // Cursor blobs often have text content after the first few bytes

  // First, try to parse as protobuf field 1 (common for text content)
  const result = parseProtobufString(data, 0);
  if (result && result.value.length > 10 && /^[\x20-\x7E\n\r\t]+$/.test(result.value.substring(0, 100))) {
    return result.value;
  }

  // Try field 3 (sometimes used for longer content)
  if (data[0] === 0x1a) { // field 3, wire type 2
    const result = parseProtobufString(data, 0);
    if (result) return result.value;
  }

  // Fallback: look for readable text regions
  const text = data.toString('utf-8');
  const readable = text.replace(/[\x00-\x1f]/g, ' ').trim();
  if (readable.length > 20) {
    return readable;
  }

  return null;
}

/**
 * Debug function to inspect raw blob data and diagnose parsing issues
 */
function debugBlobData(filePath: string): void {
  const db = new Database(filePath);

  console.log('\n[DEBUG] Database Schema:');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
  console.log(`  Tables: ${tables.map((t) => t.name).join(', ')}`);

  // Check meta table
  console.log('\n[DEBUG] Meta Table:');
  let metadata: CursorMetadata | null = null;
  const metaRows = db.prepare('SELECT key, value FROM meta').all() as MetaRow[];
  for (const row of metaRows) {
    // Value is hex-encoded JSON
    try {
      const decoded = Buffer.from(row.value, 'hex').toString('utf-8');
      const json = JSON.parse(decoded) as CursorMetadata;
      metadata = json;
      console.log(`  key=${row.key}:`);
      console.log(`    agentId: ${json.agentId}`);
      console.log(`    name: ${json.name}`);
      console.log(`    latestRootBlobId: ${json.latestRootBlobId}`);
      console.log(`    createdAt: ${new Date(json.createdAt).toISOString()}`);
      console.log(`    lastUsedModel: ${json.lastUsedModel}`);
    } catch {
      console.log(`  key=${row.key}: (hex) ${row.value.substring(0, 100)}...`);
    }
  }

  // Count blobs by type
  const blobRows = db.prepare('SELECT id, data FROM blobs').all() as BlobRow[];
  console.log(`\n[DEBUG] Blobs Analysis (${blobRows.length} total):`);

  let jsonBlobs = 0;
  let protobufBlobs = 0;
  let unknownBlobs = 0;
  let messagesFound = 0;

  const blobTypes: Record<string, number> = {};

  for (const row of blobRows) {
    // Try JSON
    try {
      JSON.parse(row.data.toString('utf-8'));
      jsonBlobs++;
      continue;
    } catch {
      // Not JSON
    }

    // Check protobuf field type
    const firstByte = row.data[0]!;
    const fieldNumber = firstByte >> 3;
    const wireType = firstByte & 0x07;
    const key = `field${fieldNumber}_wire${wireType}`;
    blobTypes[key] = (blobTypes[key] ?? 0) + 1;

    if (wireType === 2) {
      protobufBlobs++;

      // Check if this looks like a message (has readable content)
      const text = extractTextFromBlob(row.data);
      if (text && text.length > 50) {
        messagesFound++;
      }
    } else {
      unknownBlobs++;
    }
  }

  console.log(`  JSON blobs: ${jsonBlobs}`);
  console.log(`  Protobuf blobs: ${protobufBlobs}`);
  console.log(`  Unknown format: ${unknownBlobs}`);
  console.log(`  Blobs with readable text: ${messagesFound}`);
  console.log(`\n  Protobuf field distribution:`);
  for (const [key, count] of Object.entries(blobTypes).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${key}: ${count}`);
  }

  // Show sample blobs
  console.log('\n[DEBUG] Sample Blobs (first 5):');
  for (let i = 0; i < Math.min(5, blobRows.length); i++) {
    const row = blobRows[i]!;
    console.log(`\n  [${i + 1}] id=${row.id.substring(0, 16)}... (${row.data.length} bytes)`);

    const text = extractTextFromBlob(row.data);
    if (text) {
      const preview = text.replace(/\n/g, ' ').substring(0, 150);
      console.log(`      text: "${preview}${text.length > 150 ? '...' : ''}"`);
    } else {
      const hex = row.data.subarray(0, 32).toString('hex');
      console.log(`      hex: ${hex}...`);
    }
  }

  // Show JSON blobs if any
  if (jsonBlobs > 0) {
    console.log('\n[DEBUG] Sample JSON Blobs:');
    let jsonShown = 0;
    for (const row of blobRows) {
      if (jsonShown >= 3) break;
      try {
        const json = JSON.parse(row.data.toString('utf-8'));
        console.log(`\n  [JSON ${jsonShown + 1}] id=${row.id.substring(0, 16)}...`);
        const preview = JSON.stringify(json, null, 2).split('\n').slice(0, 10).join('\n');
        console.log(`      ${preview}`);
        jsonShown++;
      } catch {
        // Not JSON
      }
    }
  }

  // Diagnosis
  console.log('\n[DIAGNOSIS]');
  if (protobufBlobs > 0 && jsonBlobs === 0) {
    console.log('  ⚠️  All blobs are in protobuf format, not JSON');
    console.log('  ⚠️  CursorSource.parseBlob() only handles JSON');
    console.log('  → Need to implement protobuf parsing for Cursor blobs');
  } else if (jsonBlobs > 0) {
    console.log(`  ℹ️  ${jsonBlobs} JSON blobs found, but CursorSource may not be finding messages`);
    console.log('  → Check if JSON blobs contain "role" or "messages" fields');
  } else if (messagesFound === 0) {
    console.log('  ⚠️  No readable message content found in blobs');
  } else {
    console.log(`  ✓ Found ${messagesFound} blobs with readable content`);
  }

  db.close();
}

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

function truncate(text: string, maxLength: number = 60): string {
  const oneLine = text.replace(/\n/g, ' ').trim();
  if (oneLine.length <= maxLength) return `"${oneLine}"`;
  return `"${oneLine.substring(0, maxLength - 3)}..."`;
}

function formatBoolean(value: boolean | undefined): string {
  if (value === undefined) return '-';
  return value ? '✓' : '✗';
}

function padRight(str: string, len: number): string {
  return str.padEnd(len);
}

function padLeft(str: string | number, len: number): string {
  return String(str).padStart(len);
}

// ============================================================================
// Session Discovery
// ============================================================================

interface StoreDbFile {
  path: string;
  mtime: Date;
  size: number;
  workspaceHash: string;
  sessionId: string;
}

/**
 * Find store.db files in Cursor chats directory
 */
function findStoreDbFiles(baseDir: string, count: number): StoreDbFile[] {
  const files: StoreDbFile[] = [];

  try {
    // List workspace directories
    const workspaceDirs = fs.readdirSync(baseDir);

    for (const workspaceHash of workspaceDirs) {
      const workspacePath = path.join(baseDir, workspaceHash);
      const stat = fs.statSync(workspacePath);
      if (!stat.isDirectory()) continue;

      // List session directories
      try {
        const sessionDirs = fs.readdirSync(workspacePath);

        for (const sessionId of sessionDirs) {
          const sessionPath = path.join(workspacePath, sessionId);
          const sessionStat = fs.statSync(sessionPath);
          if (!sessionStat.isDirectory()) continue;

          const storeDbPath = path.join(sessionPath, 'store.db');
          try {
            const dbStat = fs.statSync(storeDbPath);
            if (dbStat.isFile()) {
              files.push({
                path: storeDbPath,
                mtime: dbStat.mtime,
                size: dbStat.size,
                workspaceHash,
                sessionId,
              });
            }
          } catch {
            // store.db doesn't exist
          }
        }
      } catch {
        // Can't read workspace directory
      }
    }
  } catch {
    // Can't read base directory
  }

  // Sort by modification time (newest first)
  files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return files.slice(0, count);
}

// ============================================================================
// Output Printers
// ============================================================================

function printHeader(title: string): void {
  console.log('='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
}

function printSubheader(title: string): void {
  console.log('');
  console.log('-'.repeat(80));
  console.log(title);
  console.log('-'.repeat(80));
}

function printSessionInfo(session: SourcedParsedSession, filePath: string): void {
  console.log('');
  console.log('Session Info:');
  console.log(`  sessionId:      ${session.sessionId}`);
  console.log(`  projectPath:    ${session.projectPath}`);
  console.log(`  source:         ${session.source}`);
  console.log(`  startTime:      ${formatDate(session.startTime)}`);
  console.log(`  endTime:        ${formatDate(session.endTime)}`);
  console.log(`  durationSeconds: ${session.durationSeconds}`);
  console.log(`  version:        ${session.claudeCodeVersion}`);
  console.log(`  filePath:       ${filePath}`);
}

function printMessages(messages: ParsedMessage[]): void {
  console.log('');
  console.log(`Messages (${messages.length} total):`);

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    const index = padLeft(i + 1, 3);
    const role = padRight(msg.role, 9);
    const time = formatDate(msg.timestamp).split(' ')[1] ?? '';
    const preview = truncate(msg.content || '[empty]', 50);

    let toolInfo = '';
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      const toolNames = msg.toolCalls.map((t) => t.name).join(', ');
      toolInfo = ` (tools: ${toolNames})`;
    }

    console.log(`#${index} | ${role} | ${time} | ${preview}${toolInfo}`);
  }
}

function printToolCalls(session: SourcedParsedSession): void {
  // Collect all tool calls
  const toolCalls: Array<{
    index: number;
    originalName: string;
    normalizedName: string;
    wasNormalized: boolean;
  }> = [];

  for (const msg of session.messages) {
    if (msg.toolCalls) {
      for (const call of msg.toolCalls) {
        // Since we already have normalized names in the session,
        // we need to reverse-lookup the original name
        toolCalls.push({
          index: toolCalls.length + 1,
          originalName: call.name, // Already normalized in parsed session
          normalizedName: call.name,
          wasNormalized: false, // We can't determine this after parsing
        });
      }
    }
  }

  if (toolCalls.length === 0) {
    console.log('');
    console.log('Tool Calls: None');
    return;
  }

  console.log('');
  console.log(`Tool Calls (${toolCalls.length} total):`);

  for (const call of toolCalls) {
    const index = padLeft(call.index, 3);
    console.log(
      `#${index} | ${call.normalizedName}`
    );
  }
}

function printToolMappingReference(): void {
  console.log('');
  console.log('Tool Mapping Reference (Cursor → Claude Code):');

  const cursorMapping = TOOL_MAPPING.cursor;
  const entries = Object.entries(cursorMapping).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  for (const [original, normalized] of entries) {
    console.log(`  ${padRight(original, 20)} → ${normalized}`);
  }
}

function printStats(session: SourcedParsedSession): void {
  console.log('');
  console.log('Stats:');
  console.log(`  userMessageCount:      ${session.stats.userMessageCount}`);
  console.log(`  assistantMessageCount: ${session.stats.assistantMessageCount}`);
  console.log(`  toolCallCount:         ${session.stats.toolCallCount}`);
  console.log(`  uniqueToolsUsed:       [${session.stats.uniqueToolsUsed.join(', ')}]`);
  console.log(`  totalInputTokens:      ${session.stats.totalInputTokens}`);
  console.log(`  totalOutputTokens:     ${session.stats.totalOutputTokens}`);
}

function printSchemaValidation(session: SourcedParsedSession): void {
  console.log('');
  console.log('Schema Validation:');

  const errors: string[] = [];

  // Check sessionId
  if (typeof session.sessionId !== 'string' || !session.sessionId) {
    errors.push('sessionId must be a non-empty string');
  } else {
    console.log('  ✓ sessionId is valid string');
  }

  // Check projectPath
  if (typeof session.projectPath !== 'string') {
    errors.push('projectPath must be a string');
  } else {
    console.log('  ✓ projectPath is valid string');
  }

  // Check timestamps
  if (!(session.startTime instanceof Date) || isNaN(session.startTime.getTime())) {
    errors.push('startTime must be a valid Date');
  } else {
    console.log('  ✓ startTime is valid Date');
  }

  if (!(session.endTime instanceof Date) || isNaN(session.endTime.getTime())) {
    errors.push('endTime must be a valid Date');
  } else {
    console.log('  ✓ endTime is valid Date');
  }

  // Check source
  if (session.source !== 'cursor' && session.source !== 'claude-code') {
    errors.push(`source must be 'cursor' or 'claude-code', got: ${session.source}`);
  } else {
    console.log(`  ✓ source is valid: ${session.source}`);
  }

  // Check messages
  let messageErrors = 0;
  for (let i = 0; i < session.messages.length; i++) {
    const msg = session.messages[i]!;

    if (typeof msg.uuid !== 'string' || !msg.uuid) {
      errors.push(`message[${i}].uuid must be a non-empty string`);
      messageErrors++;
    }

    if (msg.role !== 'user' && msg.role !== 'assistant') {
      errors.push(`message[${i}].role must be 'user' or 'assistant', got: ${msg.role}`);
      messageErrors++;
    }

    if (!(msg.timestamp instanceof Date) || isNaN(msg.timestamp.getTime())) {
      errors.push(`message[${i}].timestamp must be a valid Date`);
      messageErrors++;
    }

    if (typeof msg.content !== 'string') {
      errors.push(`message[${i}].content must be a string`);
      messageErrors++;
    }

    // Check tool calls
    if (msg.toolCalls) {
      for (let j = 0; j < msg.toolCalls.length; j++) {
        const tool = msg.toolCalls[j]!;

        if (typeof tool.id !== 'string' || !tool.id) {
          errors.push(`message[${i}].toolCalls[${j}].id must be a non-empty string`);
          messageErrors++;
        }

        if (typeof tool.name !== 'string' || !tool.name) {
          errors.push(`message[${i}].toolCalls[${j}].name must be a non-empty string`);
          messageErrors++;
        }

        if (typeof tool.input !== 'object' || tool.input === null) {
          errors.push(`message[${i}].toolCalls[${j}].input must be an object`);
          messageErrors++;
        }
      }
    }
  }

  if (messageErrors === 0) {
    console.log(`  ✓ All ${session.messages.length} messages have valid schema`);
  } else {
    console.log(`  ✗ ${messageErrors} message validation errors`);
  }

  // Check stats
  if (typeof session.stats.userMessageCount !== 'number') {
    errors.push('stats.userMessageCount must be a number');
  }
  if (typeof session.stats.assistantMessageCount !== 'number') {
    errors.push('stats.assistantMessageCount must be a number');
  }
  if (typeof session.stats.toolCallCount !== 'number') {
    errors.push('stats.toolCallCount must be a number');
  }
  if (!Array.isArray(session.stats.uniqueToolsUsed)) {
    errors.push('stats.uniqueToolsUsed must be an array');
  }

  if (
    typeof session.stats.userMessageCount === 'number' &&
    typeof session.stats.assistantMessageCount === 'number'
  ) {
    console.log('  ✓ stats fields are valid');
  }

  // Summary
  if (errors.length > 0) {
    console.log('');
    console.log('Validation Errors:');
    for (const error of errors) {
      console.log(`  ✗ ${error}`);
    }
  } else {
    console.log('');
    console.log('  ✓ All schema validations passed');
  }
}

// ============================================================================
// Compare Mode
// ============================================================================

interface FieldComparison {
  field: string;
  claudeCode: string;
  cursor: string;
  match: boolean;
}

function printFormatComparison(session: SourcedParsedSession): void {
  printSubheader('Output Format Comparison (Expected vs Actual)');

  // Expected format based on Claude Code ParsedSession
  const comparisons: FieldComparison[] = [
    {
      field: 'sessionId',
      claudeCode: 'string (uuid)',
      cursor: typeof session.sessionId,
      match: typeof session.sessionId === 'string',
    },
    {
      field: 'projectPath',
      claudeCode: 'string',
      cursor: typeof session.projectPath,
      match: typeof session.projectPath === 'string',
    },
    {
      field: 'startTime',
      claudeCode: 'Date',
      cursor: session.startTime instanceof Date ? 'Date' : typeof session.startTime,
      match: session.startTime instanceof Date,
    },
    {
      field: 'endTime',
      claudeCode: 'Date',
      cursor: session.endTime instanceof Date ? 'Date' : typeof session.endTime,
      match: session.endTime instanceof Date,
    },
    {
      field: 'durationSeconds',
      claudeCode: 'number',
      cursor: typeof session.durationSeconds,
      match: typeof session.durationSeconds === 'number',
    },
    {
      field: 'source',
      claudeCode: "'claude-code' | 'cursor'",
      cursor: String(session.source),
      match: session.source === 'cursor' || session.source === 'claude-code',
    },
    {
      field: 'messages',
      claudeCode: 'ParsedMessage[]',
      cursor: Array.isArray(session.messages) ? 'ParsedMessage[]' : typeof session.messages,
      match: Array.isArray(session.messages),
    },
    {
      field: 'stats',
      claudeCode: 'SessionStats',
      cursor: typeof session.stats === 'object' ? 'SessionStats' : typeof session.stats,
      match: typeof session.stats === 'object',
    },
  ];

  // Check first message format
  if (session.messages.length > 0) {
    const firstMsg = session.messages[0]!;
    comparisons.push(
      {
        field: 'messages[0].uuid',
        claudeCode: 'string',
        cursor: typeof firstMsg.uuid,
        match: typeof firstMsg.uuid === 'string',
      },
      {
        field: 'messages[0].role',
        claudeCode: "'user' | 'assistant'",
        cursor: firstMsg.role,
        match: firstMsg.role === 'user' || firstMsg.role === 'assistant',
      },
      {
        field: 'messages[0].timestamp',
        claudeCode: 'Date',
        cursor: firstMsg.timestamp instanceof Date ? 'Date' : typeof firstMsg.timestamp,
        match: firstMsg.timestamp instanceof Date,
      },
      {
        field: 'messages[0].content',
        claudeCode: 'string',
        cursor: typeof firstMsg.content,
        match: typeof firstMsg.content === 'string',
      }
    );

    // Check tool call format if present
    const msgWithTools = session.messages.find((m) => m.toolCalls && m.toolCalls.length > 0);
    if (msgWithTools && msgWithTools.toolCalls) {
      const firstTool = msgWithTools.toolCalls[0]!;
      comparisons.push(
        {
          field: 'toolCalls[0].id',
          claudeCode: 'string',
          cursor: typeof firstTool.id,
          match: typeof firstTool.id === 'string',
        },
        {
          field: 'toolCalls[0].name',
          claudeCode: 'string (PascalCase)',
          cursor: firstTool.name,
          match: typeof firstTool.name === 'string' && /^[A-Z]/.test(firstTool.name),
        },
        {
          field: 'toolCalls[0].input',
          claudeCode: 'Record<string, unknown>',
          cursor: typeof firstTool.input === 'object' ? 'object' : typeof firstTool.input,
          match: typeof firstTool.input === 'object' && firstTool.input !== null,
        }
      );
    }
  }

  console.log('');
  console.log(
    `${padRight('Field', 25)} | ${padRight('Expected (Claude Code)', 22)} | ${padRight('Actual (Cursor)', 18)} | Match`
  );
  console.log('-'.repeat(25) + '-+-' + '-'.repeat(22) + '-+-' + '-'.repeat(18) + '-+------');

  for (const comp of comparisons) {
    const matchIcon = comp.match ? '✓' : '✗';
    console.log(
      `${padRight(comp.field, 25)} | ${padRight(comp.claudeCode, 22)} | ${padRight(comp.cursor, 18)} | ${matchIcon}`
    );
  }

  // Summary
  const allMatch = comparisons.every((c) => c.match);
  console.log('');
  if (allMatch) {
    console.log('✓ All format comparisons passed - Cursor output matches Claude Code format');
  } else {
    const failCount = comparisons.filter((c) => !c.match).length;
    console.log(`✗ ${failCount} format mismatches found`);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  // Parse arguments
  const args = process.argv.slice(2);
  let sessionCount = DEFAULT_SESSION_COUNT;
  let compareMode = false;
  let debugMode = false;
  let specificFiles: string[] = [];

  for (const arg of args) {
    if (arg === '--compare') {
      compareMode = true;
    } else if (arg === '--debug') {
      debugMode = true;
    } else if (arg.startsWith('-n=')) {
      const n = parseInt(arg.replace('-n=', ''), 10);
      if (!isNaN(n) && n > 0) {
        sessionCount = n;
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Cursor Scanner Test Script

Usage:
  npx tsx scripts/test-cursor-scanner.ts                    # Default: scan latest ${DEFAULT_SESSION_COUNT} sessions
  npx tsx scripts/test-cursor-scanner.ts -n=5               # Latest 5 sessions
  npx tsx scripts/test-cursor-scanner.ts --compare          # Compare with Claude Code format
  npx tsx scripts/test-cursor-scanner.ts --debug            # Show blob parsing debug info
  npx tsx scripts/test-cursor-scanner.ts /path/to/store.db  # Specific file

Options:
  -n=N       Number of sessions to scan (default: ${DEFAULT_SESSION_COUNT})
  --compare  Show format comparison with Claude Code
  --debug    Show detailed blob parsing debug info
  --help     Show this help
`);
      process.exit(0);
    } else if (!arg.startsWith('-') && arg.endsWith('.db')) {
      specificFiles.push(arg);
    }
  }

  printHeader('Cursor Scanner Test');

  // Check if Cursor directory exists
  console.log(`Cursor chats directory: ${CURSOR_CHATS_DIR}`);

  if (!fs.existsSync(CURSOR_CHATS_DIR)) {
    console.error(`\n✗ Cursor chats directory not found: ${CURSOR_CHATS_DIR}`);
    console.error('  Make sure Cursor IDE is installed and has session data.');
    process.exit(1);
  }

  // Create CursorSource instance
  const cursorSource = new CursorSource();

  // Check availability
  const isAvailable = await cursorSource.isAvailable();
  console.log(`CursorSource available: ${isAvailable ? '✓' : '✗'}`);

  if (!isAvailable) {
    console.error('\n✗ CursorSource is not available.');
    console.error('  Make sure better-sqlite3 is installed: npm install better-sqlite3');
    process.exit(1);
  }

  // Find files to process
  let filesToProcess: StoreDbFile[];

  if (specificFiles.length > 0) {
    // Use specific files
    filesToProcess = specificFiles.map((filePath) => {
      const stats = fs.statSync(filePath);
      const sessionDir = path.dirname(filePath);
      const workspaceDir = path.dirname(sessionDir);
      return {
        path: filePath,
        mtime: stats.mtime,
        size: stats.size,
        workspaceHash: path.basename(workspaceDir),
        sessionId: path.basename(sessionDir),
      };
    });
    console.log(`Processing ${filesToProcess.length} specific file(s)`);
  } else {
    // Find latest sessions
    filesToProcess = findStoreDbFiles(CURSOR_CHATS_DIR, sessionCount);
    console.log(`Found ${filesToProcess.length} store.db file(s)`);
  }

  if (filesToProcess.length === 0) {
    console.error('\n✗ No store.db files found');
    process.exit(1);
  }

  // Show tool mapping reference once
  printToolMappingReference();

  // Process each file
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i]!;

    printSubheader(`Session ${i + 1}/${filesToProcess.length}`);
    console.log(`File: ${file.path}`);
    console.log(`Size: ${file.size} bytes`);
    console.log(`Modified: ${formatDate(file.mtime)}`);

    try {
      // Debug mode: show raw blob data
      if (debugMode) {
        debugBlobData(file.path);
      }

      // Parse the session
      const session = await cursorSource.parseFromFile(file.path);

      if (!session) {
        console.log('\n✗ Failed to parse session (returned null)');
        if (!debugMode) {
          console.log('  Tip: Run with --debug flag to see raw blob data');
        }
        failCount++;
        continue;
      }

      successCount++;

      // Print session info
      printSessionInfo(session, file.path);

      // Print messages
      printMessages(session.messages);

      // Print tool calls
      printToolCalls(session);

      // Print stats
      printStats(session);

      // Schema validation
      printSchemaValidation(session);

      // Compare mode
      if (compareMode) {
        printFormatComparison(session);
      }
    } catch (error) {
      console.error('\n✗ Error parsing session:', error);
      failCount++;
    }
  }

  // Summary
  printHeader('Summary');
  console.log(`Total sessions:    ${filesToProcess.length}`);
  console.log(`Successfully parsed: ${successCount}`);
  console.log(`Failed:            ${failCount}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
