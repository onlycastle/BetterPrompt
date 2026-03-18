/**
 * Session Source Base Interface
 *
 * Abstract interface for different AI coding assistant session sources.
 * Enables multi-source scanning while maintaining a unified data model.
 *
 * Supported sources:
 * - claude-code: Claude Code JSONL logs (~/.claude/projects/)
 * - cursor: Cursor SQLite databases (~/.cursor/chats/)
 */
import { resolveProjectName } from '../project-name-resolver.js';
import { decodeProjectPathCrossPlatform } from '../path-encoding.js';
/**
 * Abstract base class with common utility methods
 */
export class BaseSessionSource {
    /**
     * Decode project path from encoded directory name.
     * Handles both Unix (-Users-dev-app) and Windows (C--alphacut) formats.
     */
    decodeProjectPath(encoded) {
        return decodeProjectPathCrossPlatform(encoded);
    }
    /**
     * Resolve project name from encoded directory name using filesystem probing
     */
    resolveProjectName(encodedDirName) {
        return resolveProjectName(encodedDirName);
    }
    /**
     * Get project name from path (last segment)
     * @deprecated Use resolveProjectName() for accurate names
     */
    getProjectName(projectPath) {
        const parts = projectPath.split(/[/\\]/).filter(Boolean);
        // Filter out drive letter (e.g. 'C:')
        const filtered = parts.filter(p => !/^[A-Za-z]:$/.test(p));
        return filtered[filtered.length - 1] || 'unknown';
    }
    /**
     * Calculate session duration in seconds
     */
    calculateDuration(startTime, endTime) {
        return Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    }
    /**
     * Compute session statistics from parsed messages
     */
    computeStats(messages) {
        let userMessageCount = 0;
        let assistantMessageCount = 0;
        let toolCallCount = 0;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        const toolsUsed = new Set();
        for (const msg of messages) {
            if (msg.role === 'user') {
                userMessageCount++;
            }
            else {
                assistantMessageCount++;
                if (msg.toolCalls) {
                    toolCallCount += msg.toolCalls.length;
                    for (const tool of msg.toolCalls) {
                        toolsUsed.add(tool.name);
                    }
                }
                if (msg.tokenUsage) {
                    totalInputTokens += msg.tokenUsage.input;
                    totalOutputTokens += msg.tokenUsage.output;
                }
            }
        }
        return {
            userMessageCount,
            assistantMessageCount,
            toolCallCount,
            uniqueToolsUsed: Array.from(toolsUsed).sort(),
            totalInputTokens,
            totalOutputTokens,
        };
    }
}
//# sourceMappingURL=base.js.map