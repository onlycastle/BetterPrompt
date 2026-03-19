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
/**
 * Resolve a project name from Claude Code's encoded directory name.
 *
 * @param encodedDirName - The encoded directory name (e.g. "-Users-sungmancho-projects-betterprompt")
 * @returns The resolved project name (e.g. "betterprompt")
 */
export declare function resolveProjectName(encodedDirName: string): string;
/**
 * Batch resolve multiple encoded directory names.
 * Leverages the internal cache for efficiency.
 */
export declare function resolveProjectNames(encodedDirNames: string[]): Map<string, string>;
/**
 * Clear the resolver cache. Useful for testing.
 */
export declare function clearResolverCache(): void;
