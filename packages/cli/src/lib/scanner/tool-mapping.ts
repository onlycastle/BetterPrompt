/**
 * Tool Name Mapping
 *
 * Maps tool names from different AI coding assistants to a unified format.
 * The canonical format follows Claude Code naming conventions.
 *
 * This ensures consistent analysis regardless of which assistant
 * generated the session logs.
 */

import type { SessionSourceType } from './sources/base.js';

/**
 * Mapping from source-specific tool names to canonical names
 *
 * Keys are source-specific names, values are Claude Code equivalents
 */
export const TOOL_MAPPING: Record<SessionSourceType, Record<string, string>> = {
  /**
   * Claude Code uses PascalCase tool names
   * No mapping needed - this is the canonical format
   */
  'claude-code': {},

  /**
   * Cursor uses snake_case tool names
   * Map to Claude Code equivalents
   */
  'cursor': {
    // File operations
    'read_file': 'Read',
    'write_file': 'Write',
    'edit_file': 'Edit',
    'list_dir': 'Bash', // ls equivalent
    'list_directory': 'Bash',

    // Search operations
    'grep_search': 'Grep',
    'file_search': 'Glob',
    'codebase_search': 'Grep',
    'search': 'Grep',

    // Terminal operations
    'run_terminal_cmd': 'Bash',
    'run_command': 'Bash',
    'terminal': 'Bash',

    // Web operations
    'web_search': 'WebSearch',
    'fetch_url': 'WebFetch',
    'browser': 'WebFetch',

    // Code operations
    'code_edit': 'Edit',
    'apply_diff': 'Edit',
    'insert_code': 'Edit',
    'replace_code': 'Edit',

    // Notebook operations
    'notebook_edit': 'NotebookEdit',
    'jupyter': 'NotebookEdit',

    // MCP/Plugin operations
    'mcp_call': 'Skill',
    'plugin': 'Skill',

    // Task/Agent operations
    'spawn_agent': 'Task',
    'delegate': 'Task',

    // Misc
    'ask_user': 'AskUserQuestion',
    'user_input': 'AskUserQuestion',
  },
};

/**
 * Normalize a tool name to its canonical form
 *
 * @param toolName - The source-specific tool name
 * @param source - The session source type
 * @returns The canonical tool name (Claude Code format)
 */
export function normalizeToolName(
  toolName: string,
  source: SessionSourceType
): string {
  const mapping = TOOL_MAPPING[source];

  // Check if there's a direct mapping
  if (mapping && toolName in mapping) {
    return mapping[toolName];
  }

  // For Claude Code or unmapped tools, return as-is
  return toolName;
}

/**
 * Get all known tool names for a source
 */
export function getKnownTools(source: SessionSourceType): string[] {
  return Object.keys(TOOL_MAPPING[source] || {});
}

/**
 * Check if a tool name needs normalization
 */
export function needsNormalization(
  toolName: string,
  source: SessionSourceType
): boolean {
  if (source === 'claude-code') return false;

  const mapping = TOOL_MAPPING[source];
  return mapping ? toolName in mapping : false;
}

/**
 * Canonical tool categories for analysis
 *
 * Groups tools by their primary function for pattern analysis
 */
export const TOOL_CATEGORIES = {
  /** File reading operations */
  READ: ['Read', 'Glob', 'Grep'],

  /** File modification operations */
  WRITE: ['Write', 'Edit', 'NotebookEdit'],

  /** Command execution */
  EXECUTE: ['Bash', 'Task'],

  /** External resources */
  EXTERNAL: ['WebSearch', 'WebFetch'],

  /** User interaction */
  INTERACTION: ['AskUserQuestion', 'Skill'],
} as const;

/**
 * Get the category for a canonical tool name
 */
export function getToolCategory(
  canonicalToolName: string
): keyof typeof TOOL_CATEGORIES | 'OTHER' {
  for (const [category, tools] of Object.entries(TOOL_CATEGORIES)) {
    if ((tools as readonly string[]).includes(canonicalToolName)) {
      return category as keyof typeof TOOL_CATEGORIES;
    }
  }
  return 'OTHER';
}
