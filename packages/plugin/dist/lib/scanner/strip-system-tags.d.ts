/**
 * Strip System Tags
 *
 * Shared utility for removing system-injected tags from user message content.
 * Claude Code injects various tags (system-reminder, command-name, etc.) into
 * user-role messages. These are not the developer's own words and should be
 * stripped before display or analysis.
 *
 * Pattern list sourced from DataExtractorWorker.stripSystemTags().
 *
 * @module strip-system-tags
 */
/**
 * Strip system-injected tags and noise text from user message content.
 * Returns cleaned text with normalized whitespace.
 */
export declare function stripSystemTags(text: string): string;
/**
 * Backward-compatible alias for stripSystemTags.
 * @deprecated Use stripSystemTags directly.
 */
export declare const stripSystemReminders: typeof stripSystemTags;
/**
 * Truncate text to maxLength at word boundary.
 */
export declare function truncateAtWordBoundary(text: string, maxLength?: number): string;
