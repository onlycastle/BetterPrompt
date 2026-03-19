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

// ============================================================================
// Tag Patterns
// ============================================================================

/** System-injected XML tag patterns to remove from user messages */
const SYSTEM_TAG_PATTERNS: RegExp[] = [
  // Claude Code system tags
  /<system-reminder>[\s\S]*?<\/system-reminder>/g,
  /<command-name>[\s\S]*?<\/command-name>/g,
  /<command-message>[\s\S]*?<\/command-message>/g,
  /<command-args>[\s\S]*?<\/command-args>/g,
  /<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g,
  /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g,
  /<local-command-stderr>[\s\S]*?<\/local-command-stderr>/g,

  // Task notification tags (Sisyphus/Ralph Loop system)
  /<task-notification>[\s\S]*?<\/task-notification>/g,
  /<task-id>[\s\S]*?<\/task-id>/g,
  /<status>[\s\S]*?<\/status>/g,
  /<summary>[\s\S]*?<\/summary>/g,
  /<result>[\s\S]*?<\/result>/g,
  /<output-file>[\s\S]*?<\/output-file>/g,
];

/** Noise text patterns that aren't useful for summaries */
const NOISE_TEXT_PATTERNS: RegExp[] = [
  /\[Request interrupted by user for tool use\]/g,
  /\[Request interrupted by user\]/g,
];

// ============================================================================
// Public API
// ============================================================================

/**
 * Strip system-injected tags and noise text from user message content.
 * Returns cleaned text with normalized whitespace.
 */
export function stripSystemTags(text: string): string {
  let cleaned = text;

  for (const pattern of SYSTEM_TAG_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  for (const pattern of NOISE_TEXT_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Backward-compatible alias for stripSystemTags.
 * @deprecated Use stripSystemTags directly.
 */
export const stripSystemReminders = stripSystemTags;

/**
 * Truncate text to maxLength at word boundary.
 */
export function truncateAtWordBoundary(text: string, maxLength: number = 80): string {
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const cutoff = maxLength - 3;
  const lastSpace = normalized.lastIndexOf(' ', cutoff);

  if (lastSpace > 0) {
    return normalized.slice(0, lastSpace) + '...';
  }

  return normalized.slice(0, cutoff) + '...';
}
