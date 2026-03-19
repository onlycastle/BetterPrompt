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
export declare const TOOL_MAPPING: Record<SessionSourceType, Record<string, string>>;
/**
 * Normalize a tool name to its canonical form
 *
 * @param toolName - The source-specific tool name
 * @param source - The session source type
 * @returns The canonical tool name (Claude Code format)
 */
export declare function normalizeToolName(toolName: string, source: SessionSourceType): string;
/**
 * Get all known tool names for a source
 */
export declare function getKnownTools(source: SessionSourceType): string[];
/**
 * Check if a tool name needs normalization
 */
export declare function needsNormalization(toolName: string, source: SessionSourceType): boolean;
/**
 * Canonical tool categories for analysis
 *
 * Groups tools by their primary function for pattern analysis
 */
export declare const TOOL_CATEGORIES: {
    /** File reading operations */
    readonly READ: readonly ["Read", "Glob", "Grep"];
    /** File modification operations */
    readonly WRITE: readonly ["Write", "Edit", "NotebookEdit"];
    /** Command execution */
    readonly EXECUTE: readonly ["Bash", "Task"];
    /** External resources */
    readonly EXTERNAL: readonly ["WebSearch", "WebFetch"];
    /** User interaction */
    readonly INTERACTION: readonly ["AskUserQuestion", "Skill"];
};
/**
 * Get the category for a canonical tool name
 */
export declare function getToolCategory(canonicalToolName: string): keyof typeof TOOL_CATEGORIES | 'OTHER';
/**
 * Cursor Composer numeric tool ID → tool name mapping
 *
 * Cursor Composer stores tool calls with numeric capabilityType IDs
 * in the toolFormerData.tool field. This maps known IDs to tool names
 * which can then be normalized via TOOL_MAPPING['cursor-composer'].
 *
 * Known IDs verified from real state.vscdb data (2026-02-05).
 * Unknown IDs will fall through as 'tool_{id}'.
 */
export declare const CURSOR_COMPOSER_TOOL_IDS: Record<number, string>;
/**
 * Resolve a Cursor Composer numeric tool ID to a canonical tool name
 */
export declare function resolveComposerToolId(numericId: number): string;
