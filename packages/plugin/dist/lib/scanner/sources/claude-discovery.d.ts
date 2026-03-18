/**
 * Claude Data Directory Discovery
 *
 * Discovers Claude Code data directories using a 3-step waterfall:
 * 1. BETTERPROMPT_CLAUDE_DIR environment variable (explicit override)
 * 2. Default ~/.claude/projects/ path
 * 3. Prefix glob: scan homedir for .claude* directories
 *
 * Each candidate is validated with a fingerprint check:
 * - Has a projects/ subdirectory
 * - Contains at least one encoded directory (dash-prefixed or Windows drive pattern)
 * - Contains at least one .jsonl session file
 *
 * Symlink dedup ensures the same physical directory isn't registered twice.
 */
/**
 * Validate that a directory looks like a Claude Code data directory.
 *
 * Fingerprint criteria:
 * 1. {dir}/projects/ exists and is a directory
 * 2. projects/ contains at least one encoded directory
 *    (Unix: /Users/dev/app → -Users-dev-app, Windows: C:\app → C--app)
 * 3. That subdirectory contains at least one .jsonl file
 */
export declare function validateClaudeDataDir(dir: string): Promise<boolean>;
/**
 * Discover Claude Code data directories using a 3-step waterfall.
 *
 * Returns validated projects/ directory paths (ready to pass to ClaudeCodeSource).
 * Results are deduped by resolved real path to handle symlinks.
 *
 * Waterfall:
 * 1. BETTERPROMPT_CLAUDE_DIR env var → validate → use if valid
 * 2. ~/.claude/projects/ → check existence → use if valid
 * 3. Scan homedir for .claude* directories → validate each
 */
export declare function discoverClaudeDataDirs(): Promise<string[]>;
