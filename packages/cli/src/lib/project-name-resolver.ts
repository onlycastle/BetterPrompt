/**
 * Project Name Resolver
 *
 * Resolves project names from Claude Code's encoded directory names
 * by probing the actual filesystem. This fixes the problem where
 * `decodeProjectPath` replaces ALL hyphens with slashes, losing the
 * distinction between path separators and literal hyphens in directory names.
 *
 * Algorithm: Greedy left-to-right segment matching against the filesystem.
 *
 * @example
 *   "-Users-sungmancho-projects-youtube-enlgish-mobile"
 *   → probes ~/projects/ and finds "youtube-enlgish-mobile" exists
 *   → returns "youtube-enlgish-mobile"
 *
 * @module project-name-resolver
 */

import { statSync } from 'node:fs';
import { homedir } from 'node:os';

// ============================================================================
// Constants
// ============================================================================

/** Temp directory prefixes that produce meaningless project names */
const TEMP_PREFIXES = ['-private-var-', '-tmp-', '-temp-', '-var-folders-'];

/** Container directories to strip from the resolved path (case-insensitive) */
const CONTAINER_DIRS = new Set([
  'projects', 'repos', 'code', 'src', 'work', 'dev', 'workspace', 'github',
  'development', 'coding', 'repo', 'git',
]);

/** Module-level cache: encodedDirName → resolved project name */
const cache = new Map<string, string>();

// ============================================================================
// Core Resolution
// ============================================================================

/**
 * Check if a directory exists on the filesystem.
 */
function dirExists(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Resolve segments starting from `basePath` using greedy matching.
 *
 * At each step, we try joining as many remaining segments as possible
 * into a single directory name (with hyphens), then check if that
 * directory exists. If it does, we recurse into it with the remaining
 * segments. If not, we try one fewer segment, and so on.
 *
 * @returns Array of resolved directory names (the actual dir names found)
 */
function resolveSegments(basePath: string, segments: string[]): string[] {
  if (segments.length === 0) return [];

  // Try longest match first (greedy): join all remaining segments
  // then progressively try fewer segments
  for (let len = segments.length; len >= 1; len--) {
    const candidate = segments.slice(0, len).join('-');
    const candidatePath = `${basePath}/${candidate}`;

    if (dirExists(candidatePath)) {
      // Found a match — recurse with remaining segments
      const rest = resolveSegments(candidatePath, segments.slice(len));
      return [candidate, ...rest];
    }
  }

  // No filesystem match found — treat all remaining segments as one name
  // This handles cases where directories have been deleted
  return [segments.join('-')];
}

/**
 * Resolve a project name from Claude Code's encoded directory name.
 *
 * @param encodedDirName - The encoded directory name (e.g. "-Users-sungmancho-projects-nomoreaislop")
 * @returns The resolved project name (e.g. "nomoreaislop")
 */
export function resolveProjectName(encodedDirName: string): string {
  // Check cache first
  const cached = cache.get(encodedDirName);
  if (cached !== undefined) return cached;

  const result = resolveProjectNameUncached(encodedDirName);
  cache.set(encodedDirName, result);
  return result;
}

/**
 * Internal uncached resolution logic.
 */
function resolveProjectNameUncached(encodedDirName: string): string {
  // Non-encoded names: return as-is
  if (!encodedDirName.startsWith('-')) {
    return encodedDirName || 'unknown';
  }

  // Detect temp directories
  const lower = encodedDirName.toLowerCase();
  for (const prefix of TEMP_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return '(temp)';
    }
  }

  // Split into segments (skip leading empty string from leading '-')
  const segments = encodedDirName.slice(1).split('-').filter(Boolean);
  if (segments.length === 0) return 'unknown';

  // Try to detect and skip the home directory prefix
  // Common pattern: Users-{username} or home-{username}
  const home = homedir(); // e.g. "/Users/sungmancho"
  const homeParts = home.split('/').filter(Boolean); // ["Users", "sungmancho"]

  let startSegments = segments;

  // Check if the segments start with the home directory parts
  if (homeParts.length > 0 && segments.length > homeParts.length) {
    let matchesHome = true;
    for (let i = 0; i < homeParts.length; i++) {
      if (segments[i] !== homeParts[i]) {
        matchesHome = false;
        break;
      }
    }

    if (matchesHome) {
      // Strip home prefix and resolve from home directory
      startSegments = segments.slice(homeParts.length);

      if (startSegments.length === 0) return 'unknown';

      const resolved = resolveSegments(home, startSegments);

      // Strip container directories from the front
      return stripContainerDirs(resolved);
    }
  }

  // Fallback: try resolving from root /
  const resolved = resolveSegments('', segments);
  if (resolved.length === 0) return 'unknown';

  // Strip container directories from the front
  return stripContainerDirs(resolved);
}

/**
 * Strip well-known container directories from the front of resolved path parts.
 *
 * e.g. ["projects", "youtube-enlgish-mobile"] → "youtube-enlgish-mobile"
 * e.g. ["projects", "my-app", "packages", "cli"] → "my-app/packages/cli"
 */
function stripContainerDirs(parts: string[]): string {
  if (parts.length === 0) return 'unknown';

  // Strip leading container dirs
  let start = 0;
  while (start < parts.length - 1 && CONTAINER_DIRS.has(parts[start].toLowerCase())) {
    start++;
  }

  const remaining = parts.slice(start);
  return remaining.join('/') || 'unknown';
}

/**
 * Batch resolve multiple encoded directory names.
 * Leverages the internal cache for efficiency.
 */
export function resolveProjectNames(encodedDirNames: string[]): Map<string, string> {
  const results = new Map<string, string>();
  for (const name of encodedDirNames) {
    results.set(name, resolveProjectName(name));
  }
  return results;
}

/**
 * Clear the resolver cache. Useful for testing.
 */
export function clearResolverCache(): void {
  cache.clear();
}
