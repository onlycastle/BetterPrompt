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

import { readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { levenshteinDistance } from './levenshtein.js';

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
 * Find the closest directory name in `parentPath` to `targetName` using
 * Levenshtein distance. Only returns a match if distance is exactly 1.
 */
function findClosestDirectory(parentPath: string, targetName: string): string | null {
  try {
    const entries = readdirSync(parentPath, { withFileTypes: true });
    let bestMatch: string | null = null;
    let bestDistance = Infinity;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dist = levenshteinDistance(entry.name.toLowerCase(), targetName.toLowerCase());
      if (dist > 0 && dist <= 1 && dist < bestDistance) {
        bestDistance = dist;
        bestMatch = entry.name;
      }
    }

    return bestMatch;
  } catch {
    return null;
  }
}

/**
 * Resolve segments starting from `basePath` using greedy matching.
 * Tries joining progressively fewer segments until a match is found.
 */
function resolveSegments(basePath: string, segments: string[]): string[] {
  if (segments.length === 0) return [];

  for (let len = segments.length; len >= 1; len--) {
    const candidate = segments.slice(0, len).join('-');
    const candidatePath = `${basePath}/${candidate}`;

    if (dirExists(candidatePath)) {
      const rest = resolveSegments(candidatePath, segments.slice(len));
      return [candidate, ...rest];
    }
  }

  const fallbackName = segments.join('-');
  if (basePath && fallbackName.length >= 4) {
    const fuzzyMatch = findClosestDirectory(basePath, fallbackName);
    if (fuzzyMatch) return [fuzzyMatch];
  }

  return [fallbackName];
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

function resolveProjectNameUncached(encodedDirName: string): string {
  if (!encodedDirName.startsWith('-')) {
    return encodedDirName || 'unknown';
  }

  const lower = encodedDirName.toLowerCase();
  for (const prefix of TEMP_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return '(temp)';
    }
  }

  const segments = encodedDirName.slice(1).split('-').filter(Boolean);
  if (segments.length === 0) return 'unknown';

  const home = homedir();
  const homeParts = home.split('/').filter(Boolean);

  let startSegments = segments;

  if (homeParts.length > 0 && segments.length > homeParts.length) {
    let matchesHome = true;
    for (let i = 0; i < homeParts.length; i++) {
      if (segments[i] !== homeParts[i]) {
        matchesHome = false;
        break;
      }
    }

    if (matchesHome) {
      startSegments = segments.slice(homeParts.length);

      if (startSegments.length === 0) return 'unknown';

      const resolved = resolveSegments(home, startSegments);
      return stripContainerDirs(resolved);
    }
  }

  const resolved = resolveSegments('', segments);
  if (resolved.length === 0) return 'unknown';

  return stripContainerDirs(resolved);
}

/**
 * Strip well-known container directories from the front of resolved path parts.
 */
function stripContainerDirs(parts: string[]): string {
  if (parts.length === 0) return 'unknown';

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
