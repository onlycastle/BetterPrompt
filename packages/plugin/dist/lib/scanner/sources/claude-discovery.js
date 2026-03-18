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
import { readdir, stat, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { isWindowsEncodedPath } from '../path-encoding.js';
/**
 * Validate that a directory looks like a Claude Code data directory.
 *
 * Fingerprint criteria:
 * 1. {dir}/projects/ exists and is a directory
 * 2. projects/ contains at least one encoded directory
 *    (Unix: /Users/dev/app → -Users-dev-app, Windows: C:\app → C--app)
 * 3. That subdirectory contains at least one .jsonl file
 */
export async function validateClaudeDataDir(dir) {
    try {
        const projectsDir = join(dir, 'projects');
        const projectsStat = await stat(projectsDir);
        if (!projectsStat.isDirectory())
            return false;
        const entries = await readdir(projectsDir);
        for (const entry of entries) {
            // Claude encodes paths: Unix starts with '-', Windows matches X--
            if (!entry.startsWith('-') && !isWindowsEncodedPath(entry))
                continue;
            const entryPath = join(projectsDir, entry);
            const entryStat = await stat(entryPath);
            if (!entryStat.isDirectory())
                continue;
            // Check for at least one .jsonl file
            const files = await readdir(entryPath);
            if (files.some((f) => f.endsWith('.jsonl'))) {
                return true;
            }
        }
        return false;
    }
    catch {
        return false;
    }
}
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
export async function discoverClaudeDataDirs() {
    const discovered = new Map(); // realPath → projectsDir
    const addIfValid = async (dir) => {
        try {
            const projectsDir = join(dir, 'projects');
            const resolved = await realpath(projectsDir);
            // Already discovered this physical path
            if (discovered.has(resolved))
                return true;
            if (await validateClaudeDataDir(dir)) {
                discovered.set(resolved, projectsDir);
                return true;
            }
        }
        catch {
            // Path doesn't exist or isn't accessible
        }
        return false;
    };
    // Step 1: Environment variable override
    const envDir = process.env.BETTERPROMPT_CLAUDE_DIR;
    if (envDir) {
        await addIfValid(envDir);
        // If env var is set, use it exclusively (don't mix with defaults)
        if (discovered.size > 0) {
            return Array.from(discovered.values());
        }
    }
    // Step 2: Default path ~/.claude/projects/
    const defaultDir = join(homedir(), '.claude');
    await addIfValid(defaultDir);
    // If default path works, return it (most common case — fast path)
    if (discovered.size > 0) {
        return Array.from(discovered.values());
    }
    // Step 3: Prefix glob — scan homedir for .claude* directories
    try {
        const home = homedir();
        const entries = await readdir(home);
        for (const entry of entries) {
            if (!entry.startsWith('.claude'))
                continue;
            // Skip the default .claude (already checked in step 2)
            if (entry === '.claude')
                continue;
            const candidateDir = join(home, entry);
            try {
                const s = await stat(candidateDir);
                if (s.isDirectory()) {
                    await addIfValid(candidateDir);
                }
            }
            catch {
                // Skip inaccessible entries
            }
        }
    }
    catch {
        // homedir not readable — unusual but handle gracefully
    }
    return Array.from(discovered.values());
}
//# sourceMappingURL=claude-discovery.js.map