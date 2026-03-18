/**
 * Claude Code Session Source
 *
 * Parses Claude Code session logs stored as JSONL files in ~/.claude/projects/
 *
 * File format:
 * - Path: ~/.claude/projects/{encoded-path}/{session-uuid}.jsonl
 * - Format: JSONL (one JSON object per line)
 * - Message types: user, assistant, queue-operation, file-history-snapshot
 *
 * Path encoding: Paths are encoded by replacing '/' with '-'
 * Example: /Users/dev/myapp -> -Users-dev-myapp
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { BaseSessionSource, } from './base.js';
/**
 * Default Claude Code projects directory.
 * @deprecated Use {@link discoverClaudeDataDirs} from `claude-discovery.ts` for robust path resolution.
 */
export const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');
/**
 * Claude Code session source implementation
 */
export class ClaudeCodeSource extends BaseSessionSource {
    name = 'claude-code';
    displayName = 'Claude Code';
    baseDir;
    constructor(baseDir) {
        super();
        this.baseDir = baseDir ?? CLAUDE_PROJECTS_DIR;
    }
    getBaseDir() {
        return this.baseDir;
    }
    async isAvailable() {
        try {
            await stat(this.baseDir);
            return true;
        }
        catch {
            return false;
        }
    }
    async collectFileMetadata(config) {
        const minSize = config?.minFileSize ?? 0;
        const maxSize = config?.maxFileSize ?? Infinity;
        const projectDirs = await this.listProjectDirs();
        const allFiles = [];
        for (const dir of projectDirs) {
            const files = await this.listSessionFiles(dir);
            for (const file of files) {
                try {
                    const stats = await stat(file);
                    if (stats.isFile() &&
                        stats.size >= minSize &&
                        stats.size <= maxSize) {
                        allFiles.push({
                            filePath: file,
                            fileSize: stats.size,
                            mtime: stats.mtime,
                            projectDirName: basename(dir),
                            source: this.name,
                        });
                    }
                }
                catch {
                    // Skip inaccessible files
                }
            }
        }
        return allFiles;
    }
    async extractMetadata(filePath, content) {
        const lines = content.split('\n').filter((l) => l.trim());
        if (lines.length === 0)
            return null;
        const fileName = basename(filePath, '.jsonl');
        let messageCount = 0;
        let firstTimestamp = null;
        let lastTimestamp = null;
        for (const line of lines) {
            const parsed = this.parseJSONLLine(line);
            if (parsed && (parsed.type === 'user' || parsed.type === 'assistant')) {
                messageCount++;
                const ts = new Date(parsed.timestamp);
                if (!firstTimestamp || ts < firstTimestamp) {
                    firstTimestamp = ts;
                }
                if (!lastTimestamp || ts > lastTimestamp) {
                    lastTimestamp = ts;
                }
            }
        }
        if (!firstTimestamp || !lastTimestamp)
            return null;
        const projectDirName = basename(join(filePath, '..'));
        const projectPath = this.decodeProjectPath(projectDirName);
        const durationSeconds = this.calculateDuration(firstTimestamp, lastTimestamp);
        return {
            sessionId: fileName,
            projectPath,
            projectName: this.resolveProjectName(projectDirName),
            timestamp: firstTimestamp,
            messageCount,
            durationSeconds,
            filePath,
            source: this.name,
        };
    }
    async parseSessionContent(sessionId, projectPath, projectName, content) {
        const lines = this.parseJSONLContent(content);
        if (lines.length === 0)
            return null;
        // Parse timestamps
        const timestamps = lines.map((m) => new Date(m.timestamp));
        const startTime = new Date(Math.min(...timestamps.map((t) => t.getTime())));
        const endTime = new Date(Math.max(...timestamps.map((t) => t.getTime())));
        const durationSeconds = this.calculateDuration(startTime, endTime);
        // Get version from first message
        const claudeCodeVersion = lines[0].version || 'unknown';
        // Collect tool results first
        const toolResultsMap = new Map();
        for (const line of lines) {
            if (line.type === 'user') {
                const msgContent = line.message.content;
                if (Array.isArray(msgContent)) {
                    for (const block of msgContent) {
                        if (block.type === 'tool_result' && 'tool_use_id' in block) {
                            const resultContent = typeof block.content === 'string'
                                ? block.content
                                : JSON.stringify(block.content);
                            toolResultsMap.set(block.tool_use_id, {
                                content: resultContent,
                                isError: block.is_error ?? false,
                            });
                        }
                    }
                }
            }
        }
        // Parse messages
        const messages = [];
        for (const line of lines) {
            if (line.type === 'user') {
                const textContent = this.extractTextContent(line.message.content);
                if (!textContent.trim())
                    continue;
                messages.push({
                    uuid: line.uuid,
                    role: 'user',
                    timestamp: new Date(line.timestamp),
                    content: textContent,
                });
            }
            else if (line.type === 'assistant') {
                const textContent = this.extractTextContent(line.message.content);
                const toolCalls = Array.isArray(line.message.content)
                    ? this.extractToolCalls(line.message.content, toolResultsMap)
                    : undefined;
                messages.push({
                    uuid: line.uuid,
                    role: 'assistant',
                    timestamp: new Date(line.timestamp),
                    content: textContent,
                    toolCalls,
                    tokenUsage: line.message.usage
                        ? {
                            input: line.message.usage.input_tokens,
                            output: line.message.usage.output_tokens,
                        }
                        : undefined,
                });
            }
        }
        if (messages.length === 0)
            return null;
        const stats = this.computeStats(messages);
        return {
            sessionId,
            projectPath,
            startTime,
            endTime,
            durationSeconds,
            claudeCodeVersion,
            messages,
            stats,
            source: this.name,
        };
    }
    async readSessionContent(filePath) {
        return readFile(filePath, 'utf-8');
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Private helper methods
    // ─────────────────────────────────────────────────────────────────────────
    async listProjectDirs() {
        try {
            const entries = await readdir(this.baseDir);
            const dirs = [];
            for (const entry of entries) {
                const fullPath = join(this.baseDir, entry);
                try {
                    const stats = await stat(fullPath);
                    if (stats.isDirectory()) {
                        dirs.push(fullPath);
                    }
                }
                catch {
                    // Skip inaccessible entries
                }
            }
            return dirs;
        }
        catch {
            return [];
        }
    }
    async listSessionFiles(projectDir) {
        try {
            const files = await readdir(projectDir);
            return files
                .filter((f) => f.endsWith('.jsonl'))
                .map((f) => join(projectDir, f));
        }
        catch {
            return [];
        }
    }
    parseJSONLLine(line) {
        const trimmed = line.trim();
        if (!trimmed)
            return null;
        try {
            return JSON.parse(trimmed);
        }
        catch {
            return null;
        }
    }
    parseJSONLContent(content) {
        const lines = [];
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed.type === 'user' || parsed.type === 'assistant') {
                    lines.push(parsed);
                }
            }
            catch {
                // Skip invalid lines
            }
        }
        return lines;
    }
    extractTextContent(content) {
        if (typeof content === 'string')
            return content;
        const textParts = [];
        for (const block of content) {
            if (block.type === 'text' && 'text' in block) {
                textParts.push(block.text);
            }
        }
        return textParts.join('\n');
    }
    extractToolCalls(content, toolResultsMap) {
        const toolCalls = [];
        for (const block of content) {
            if (block.type === 'tool_use' && 'id' in block && 'name' in block) {
                const result = toolResultsMap.get(block.id);
                toolCalls.push({
                    id: block.id,
                    name: block.name,
                    input: block.input || {},
                    result: result?.content,
                    isError: result?.isError,
                });
            }
        }
        return toolCalls.length > 0 ? toolCalls : undefined;
    }
}
// Export singleton instance for convenience
export const claudeCodeSource = new ClaudeCodeSource();
//# sourceMappingURL=claude-code.js.map