import {
  getScanCacheDir
} from "./chunk-SVAMHER4.js";
import {
  __require
} from "./chunk-NSBPE2FW.js";

// lib/project-filters.ts
var TEMP_PROJECT_PREFIXES = [
  "private/tmp/",
  "tmp/",
  "temp/",
  "var/folders/",
  "private/var/"
];
function normalizeSlashes(value) {
  return value.trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}
function normalizeProjectNameValue(value) {
  const normalized = value ? normalizeSlashes(value) : "";
  if (!normalized) {
    return "unknown";
  }
  const lower = normalized.toLowerCase();
  if (TEMP_PROJECT_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    const segments = normalized.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? normalized;
  }
  return normalized;
}
function normalizeProjectFilter(value) {
  const normalized = normalizeSlashes(value);
  if (!normalized) {
    return "";
  }
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? normalized;
}
function normalizeProjectFilters(includeProjects) {
  if (!includeProjects?.length) {
    return includeProjects;
  }
  const normalized = Array.from(
    new Set(includeProjects.map(normalizeProjectFilter).filter(Boolean))
  );
  return normalized.length ? normalized : void 0;
}

// lib/core/multi-source-session-scanner.ts
import { mkdir, readFile as readFile2, writeFile } from "fs/promises";
import { join as join6 } from "path";

// lib/scanner/project-name-resolver.ts
import { readdirSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// lib/scanner/levenshtein.ts
function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) {
    prev[j] = j;
  }
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// lib/scanner/path-encoding.ts
function isWindowsEncodedPath(encoded) {
  return /^[A-Za-z]--/.test(encoded);
}
function decodeProjectPathCrossPlatform(encoded) {
  if (isWindowsEncodedPath(encoded)) {
    const driveLetter = encoded[0];
    const rest = encoded.slice(3);
    if (!rest) return `${driveLetter}:/`;
    return `${driveLetter}:/${rest.replace(/-/g, "/")}`;
  }
  if (encoded.startsWith("-")) {
    return encoded.replace(/-/g, "/");
  }
  return encoded;
}

// lib/scanner/project-name-resolver.ts
var UNIX_TEMP_PREFIXES = ["-private-var-", "-tmp-", "-temp-", "-var-folders-"];
var WINDOWS_TEMP_SEGMENTS = ["appdata-local-temp", "temp", "tmp"];
var CONTAINER_DIRS = /* @__PURE__ */ new Set([
  "projects",
  "repos",
  "code",
  "src",
  "work",
  "dev",
  "workspace",
  "github",
  "development",
  "coding",
  "repo",
  "git"
]);
var cache = /* @__PURE__ */ new Map();
function dirExists(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
function findClosestDirectory(parentPath, targetName) {
  try {
    const entries = readdirSync(parentPath, { withFileTypes: true });
    let bestMatch = null;
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
function resolveSegments(basePath, segments) {
  if (segments.length === 0) return [];
  for (let len = segments.length; len >= 1; len--) {
    const candidate = segments.slice(0, len).join("-");
    const candidatePath = basePath ? join(basePath, candidate) : `/${candidate}`;
    if (dirExists(candidatePath)) {
      const rest = resolveSegments(candidatePath, segments.slice(len));
      return [candidate, ...rest];
    }
  }
  const fallbackName = segments.join("-");
  if (basePath && fallbackName.length >= 4) {
    const fuzzyMatch = findClosestDirectory(basePath, fallbackName);
    if (fuzzyMatch) return [fuzzyMatch];
  }
  return [fallbackName];
}
function resolveProjectName(encodedDirName) {
  const cached = cache.get(encodedDirName);
  if (cached !== void 0) return cached;
  const result = resolveProjectNameUncached(encodedDirName);
  cache.set(encodedDirName, result);
  return result;
}
function resolveProjectNameUncached(encodedDirName) {
  if (isWindowsEncodedPath(encodedDirName)) {
    return resolveWindowsPath(encodedDirName);
  }
  if (!encodedDirName.startsWith("-")) {
    return encodedDirName || "unknown";
  }
  const lower = encodedDirName.toLowerCase();
  for (const prefix of UNIX_TEMP_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return "(temp)";
    }
  }
  const segments = encodedDirName.slice(1).split("-").filter(Boolean);
  if (segments.length === 0) return "unknown";
  const home = homedir();
  const homeParts = home.split(/[/\\]/).filter(Boolean);
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
      if (startSegments.length === 0) return "unknown";
      const resolved2 = resolveSegments(home, startSegments);
      return stripContainerDirs(resolved2);
    }
  }
  const resolved = resolveSegments("", segments);
  if (resolved.length === 0) return "unknown";
  return stripContainerDirs(resolved);
}
function resolveWindowsPath(encodedDirName) {
  const driveLetter = encodedDirName[0];
  const rest = encodedDirName.slice(3);
  if (!rest) return "unknown";
  const segments = rest.split("-").filter(Boolean);
  if (segments.length === 0) return "unknown";
  const lowerRest = rest.toLowerCase();
  for (const tempSeg of WINDOWS_TEMP_SEGMENTS) {
    if (lowerRest.startsWith(tempSeg)) {
      return "(temp)";
    }
  }
  const home = homedir();
  const homeParts = home.split(/[/\\]/).filter(Boolean);
  const homePartsNoDrive = homeParts[0]?.match(/^[A-Za-z]:$/) ? homeParts.slice(1) : homeParts;
  if (homePartsNoDrive.length > 0 && segments.length > homePartsNoDrive.length) {
    let matchesHome = true;
    for (let i = 0; i < homePartsNoDrive.length; i++) {
      if (segments[i] !== homePartsNoDrive[i]) {
        matchesHome = false;
        break;
      }
    }
    if (matchesHome) {
      const afterHome = segments.slice(homePartsNoDrive.length);
      if (afterHome.length === 0) return "unknown";
      const resolved2 = resolveSegments(home, afterHome);
      return stripContainerDirs(resolved2);
    }
  }
  const driveRoot = `${driveLetter}:/`;
  const resolved = resolveSegments(driveRoot, segments);
  if (resolved.length === 0) return "unknown";
  return stripContainerDirs(resolved);
}
function stripContainerDirs(parts) {
  if (parts.length === 0) return "unknown";
  let start = 0;
  while (start < parts.length - 1 && CONTAINER_DIRS.has(parts[start].toLowerCase())) {
    start++;
  }
  const remaining = parts.slice(start);
  return remaining.join("/") || "unknown";
}

// lib/scanner/sources/base.ts
var BaseSessionSource = class {
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
    const filtered = parts.filter((p) => !/^[A-Za-z]:$/.test(p));
    return filtered[filtered.length - 1] || "unknown";
  }
  /**
   * Calculate session duration in seconds
   */
  calculateDuration(startTime, endTime) {
    return Math.floor((endTime.getTime() - startTime.getTime()) / 1e3);
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
    const toolsUsed = /* @__PURE__ */ new Set();
    for (const msg of messages) {
      if (msg.role === "user") {
        userMessageCount++;
      } else {
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
      totalOutputTokens
    };
  }
};

// lib/scanner/sources/claude-code.ts
import { readFile, readdir, stat } from "fs/promises";
import { join as join2, basename } from "path";
import { homedir as homedir2 } from "os";
var CLAUDE_PROJECTS_DIR = join2(homedir2(), ".claude", "projects");
var ClaudeCodeSource = class extends BaseSessionSource {
  name = "claude-code";
  displayName = "Claude Code";
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
    } catch {
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
          if (stats.isFile() && stats.size >= minSize && stats.size <= maxSize) {
            allFiles.push({
              filePath: file,
              fileSize: stats.size,
              mtime: stats.mtime,
              projectDirName: basename(dir),
              source: this.name
            });
          }
        } catch {
        }
      }
    }
    return allFiles;
  }
  async extractMetadata(filePath, content) {
    const lines = content.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return null;
    const fileName = basename(filePath, ".jsonl");
    let messageCount = 0;
    let firstTimestamp = null;
    let lastTimestamp = null;
    for (const line of lines) {
      const parsed = this.parseJSONLLine(line);
      if (parsed && (parsed.type === "user" || parsed.type === "assistant")) {
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
    if (!firstTimestamp || !lastTimestamp) return null;
    const projectDirName = basename(join2(filePath, ".."));
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
      source: this.name
    };
  }
  async parseSessionContent(sessionId, projectPath, projectName, content) {
    const lines = this.parseJSONLContent(content);
    if (lines.length === 0) return null;
    const timestamps = lines.map((m) => new Date(m.timestamp));
    const startTime = new Date(Math.min(...timestamps.map((t) => t.getTime())));
    const endTime = new Date(Math.max(...timestamps.map((t) => t.getTime())));
    const durationSeconds = this.calculateDuration(startTime, endTime);
    const claudeCodeVersion = lines[0].version || "unknown";
    const toolResultsMap = /* @__PURE__ */ new Map();
    for (const line of lines) {
      if (line.type === "user") {
        const msgContent = line.message.content;
        if (Array.isArray(msgContent)) {
          for (const block of msgContent) {
            if (block.type === "tool_result" && "tool_use_id" in block) {
              const resultContent = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
              toolResultsMap.set(block.tool_use_id, {
                content: resultContent,
                isError: block.is_error ?? false
              });
            }
          }
        }
      }
    }
    const messages = [];
    for (const line of lines) {
      if (line.type === "user") {
        const textContent = this.extractTextContent(line.message.content);
        if (!textContent.trim()) continue;
        messages.push({
          uuid: line.uuid,
          role: "user",
          timestamp: new Date(line.timestamp),
          content: textContent,
          ...line.isMeta ? { isMeta: true } : {},
          ...typeof line.sourceToolUseID === "string" ? { sourceToolUseID: line.sourceToolUseID } : {},
          ...line.toolUseResult !== void 0 ? { toolUseResult: line.toolUseResult } : {}
        });
      } else if (line.type === "assistant") {
        const textContent = this.extractTextContent(line.message.content);
        const toolCalls = Array.isArray(line.message.content) ? this.extractToolCalls(line.message.content, toolResultsMap) : void 0;
        messages.push({
          uuid: line.uuid,
          role: "assistant",
          timestamp: new Date(line.timestamp),
          content: textContent,
          toolCalls,
          tokenUsage: line.message.usage ? {
            input: line.message.usage.input_tokens,
            output: line.message.usage.output_tokens
          } : void 0
        });
      }
    }
    if (messages.length === 0) return null;
    const stats = this.computeStats(messages);
    return {
      sessionId,
      projectPath,
      projectName,
      startTime,
      endTime,
      durationSeconds,
      claudeCodeVersion,
      messages,
      stats,
      source: this.name
    };
  }
  async readSessionContent(filePath) {
    return readFile(filePath, "utf-8");
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Private helper methods
  // ─────────────────────────────────────────────────────────────────────────
  async listProjectDirs() {
    try {
      const entries = await readdir(this.baseDir);
      const dirs = [];
      for (const entry of entries) {
        const fullPath = join2(this.baseDir, entry);
        try {
          const stats = await stat(fullPath);
          if (stats.isDirectory()) {
            dirs.push(fullPath);
          }
        } catch {
        }
      }
      return dirs;
    } catch {
      return [];
    }
  }
  async listSessionFiles(projectDir) {
    try {
      const files = await readdir(projectDir);
      return files.filter((f) => f.endsWith(".jsonl")).map((f) => join2(projectDir, f));
    } catch {
      return [];
    }
  }
  parseJSONLLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  parseJSONLContent(content) {
    const lines = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.type === "user" || parsed.type === "assistant") {
          lines.push(parsed);
        }
      } catch {
      }
    }
    return lines;
  }
  extractTextContent(content) {
    if (typeof content === "string") return content;
    const textParts = [];
    for (const block of content) {
      if (block.type === "text" && "text" in block) {
        textParts.push(block.text);
      }
    }
    return textParts.join("\n");
  }
  extractToolCalls(content, toolResultsMap) {
    const toolCalls = [];
    for (const block of content) {
      if (block.type === "tool_use" && "id" in block && "name" in block) {
        const result = toolResultsMap.get(block.id);
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input || {},
          result: result?.content,
          isError: result?.isError
        });
      }
    }
    return toolCalls.length > 0 ? toolCalls : void 0;
  }
};
var claudeCodeSource = new ClaudeCodeSource();

// lib/scanner/sources/cursor.ts
import { readdir as readdir2, stat as stat2 } from "fs/promises";
import { join as join3, basename as basename2, dirname } from "path";
import { homedir as homedir3 } from "os";

// lib/scanner/tool-mapping.ts
var TOOL_MAPPING = {
  /**
   * Claude Code uses PascalCase tool names
   * No mapping needed - this is the canonical format
   */
  "claude-code": {},
  /**
   * @deprecated Cursor support was dropped. These mappings are retained only
   * for type compatibility with SessionSourceType and the cursor scanner sources.
   * Remove when the cursor/cursor-composer scanners are deleted.
   */
  "cursor": {
    // File operations
    "read_file": "Read",
    "write_file": "Write",
    "edit_file": "Edit",
    "list_dir": "Bash",
    // ls equivalent
    "list_directory": "Bash",
    "LS": "Bash",
    // Cursor's PascalCase variant
    // Search operations
    "grep_search": "Grep",
    "file_search": "Glob",
    "codebase_search": "Grep",
    "search": "Grep",
    // Terminal operations
    "run_terminal_cmd": "Bash",
    "run_command": "Bash",
    "terminal": "Bash",
    // Web operations
    "web_search": "WebSearch",
    "fetch_url": "WebFetch",
    "browser": "WebFetch",
    // Code operations
    "code_edit": "Edit",
    "apply_diff": "Edit",
    "insert_code": "Edit",
    "replace_code": "Edit",
    "ApplyPatch": "Edit",
    // Cursor's PascalCase variant
    // Shell operations (Cursor uses 'Shell' directly)
    "Shell": "Bash",
    // Notebook operations
    "notebook_edit": "NotebookEdit",
    "jupyter": "NotebookEdit",
    // MCP/Plugin operations
    "mcp_call": "Skill",
    "plugin": "Skill",
    // Task/Agent operations
    "spawn_agent": "Task",
    "delegate": "Task",
    // Misc
    "ask_user": "AskUserQuestion",
    "user_input": "AskUserQuestion"
  },
  /** @deprecated See cursor entry above. */
  "cursor-composer": {
    // File operations
    "read_file": "Read",
    "write_file": "Write",
    "edit_file": "Edit",
    "list_dir": "Bash",
    "list_directory": "Bash",
    "LS": "Bash",
    // Search operations
    "grep_search": "Grep",
    "file_search": "Glob",
    "codebase_search": "Grep",
    "search": "Grep",
    // Terminal operations
    "run_terminal_cmd": "Bash",
    "run_command": "Bash",
    "terminal": "Bash",
    // Web operations
    "web_search": "WebSearch",
    "fetch_url": "WebFetch",
    "browser": "WebFetch",
    // Code operations
    "code_edit": "Edit",
    "apply_diff": "Edit",
    "insert_code": "Edit",
    "replace_code": "Edit",
    "ApplyPatch": "Edit",
    // Shell operations
    "Shell": "Bash",
    // Notebook operations
    "notebook_edit": "NotebookEdit",
    "jupyter": "NotebookEdit",
    // MCP/Plugin operations
    "mcp_call": "Skill",
    "plugin": "Skill",
    // Task/Agent operations
    "spawn_agent": "Task",
    "delegate": "Task",
    // Misc
    "ask_user": "AskUserQuestion",
    "user_input": "AskUserQuestion"
  }
};
function normalizeToolName(toolName, source) {
  const mapping = TOOL_MAPPING[source];
  if (mapping && toolName in mapping) {
    return mapping[toolName];
  }
  return toolName;
}
var CURSOR_COMPOSER_TOOL_IDS = {
  15: "run_terminal_cmd",
  38: "edit_file",
  39: "list_dir",
  40: "write_file"
};
function resolveComposerToolId(numericId) {
  const toolName = CURSOR_COMPOSER_TOOL_IDS[numericId];
  if (toolName) {
    return normalizeToolName(toolName, "cursor-composer");
  }
  return `tool_${numericId}`;
}

// lib/scanner/sources/sqlite-loader.ts
var cachedConstructor = null;
var loadAttempted = false;
async function loadSqlite() {
  if (loadAttempted) return cachedConstructor;
  loadAttempted = true;
  try {
    const sqlite = await import("better-sqlite3");
    cachedConstructor = sqlite.default ?? sqlite;
    return cachedConstructor;
  } catch {
    return null;
  }
}

// lib/scanner/sources/cursor.ts
var CURSOR_CHATS_DIR = join3(homedir3(), ".cursor", "chats");
var CursorSource = class extends BaseSessionSource {
  name = "cursor";
  displayName = "Cursor";
  baseDir;
  constructor(baseDir) {
    super();
    this.baseDir = baseDir ?? CURSOR_CHATS_DIR;
  }
  getBaseDir() {
    return this.baseDir;
  }
  async isAvailable() {
    try {
      await stat2(this.baseDir);
      const Database = await loadSqlite();
      return Database !== null;
    } catch {
      return false;
    }
  }
  async collectFileMetadata(config) {
    const minSize = config?.minFileSize ?? 0;
    const maxSize = config?.maxFileSize ?? Infinity;
    const allFiles = [];
    try {
      const workspaceDirs = await this.listWorkspaceDirs();
      for (const workspaceDir of workspaceDirs) {
        const sessionDirs = await this.listSessionDirs(workspaceDir);
        for (const sessionDir of sessionDirs) {
          const storeDbPath = join3(sessionDir, "store.db");
          try {
            const stats = await stat2(storeDbPath);
            if (stats.isFile() && stats.size >= minSize && stats.size <= maxSize) {
              const workspaceHash = basename2(workspaceDir);
              allFiles.push({
                filePath: storeDbPath,
                fileSize: stats.size,
                mtime: stats.mtime,
                projectDirName: workspaceHash,
                source: this.name
              });
            }
          } catch {
          }
        }
      }
    } catch {
    }
    return allFiles;
  }
  async extractMetadata(filePath, _content) {
    const Database = await loadSqlite();
    if (!Database) return null;
    try {
      const db = new Database(filePath);
      try {
        const conversation = this.parseConversation(db);
        if (!conversation || conversation.messages.length === 0) {
          db.close();
          return null;
        }
        const messages = conversation.messages.filter(
          (m) => m.role === "user" || m.role === "assistant"
        );
        if (messages.length === 0) {
          db.close();
          return null;
        }
        const timestamps = messages.map((m) => this.extractTimestamp(m)).filter((t) => t !== null);
        if (timestamps.length === 0) {
          db.close();
          return null;
        }
        const firstTimestamp = new Date(
          Math.min(...timestamps.map((t) => t.getTime()))
        );
        const lastTimestamp = new Date(
          Math.max(...timestamps.map((t) => t.getTime()))
        );
        const sessionDir = dirname(filePath);
        const sessionId = basename2(sessionDir);
        const workspaceDir = dirname(sessionDir);
        const workspaceHash = basename2(workspaceDir);
        const projectPath = conversation.metadata?.workspacePath ?? conversation.metadata?.projectPath ?? this.decodeProjectPath(workspaceHash);
        db.close();
        return {
          sessionId,
          projectPath,
          projectName: this.getProjectName(projectPath),
          timestamp: firstTimestamp,
          messageCount: messages.length,
          durationSeconds: this.calculateDuration(firstTimestamp, lastTimestamp),
          filePath,
          source: this.name
        };
      } catch {
        db.close();
        return null;
      }
    } catch {
      return null;
    }
  }
  async parseSessionContent(sessionId, projectPath, _projectName, _content) {
    return null;
  }
  /**
   * Parse session directly from SQLite file
   */
  async parseFromFile(filePath) {
    const Database = await loadSqlite();
    if (!Database) return null;
    let db = null;
    try {
      db = new Database(filePath);
      const conversation = this.parseConversation(db);
      if (!conversation || conversation.messages.length === 0) {
        return null;
      }
      const sessionDir = dirname(filePath);
      const sessionId = basename2(sessionDir);
      const workspaceDir = dirname(sessionDir);
      const workspaceHash = basename2(workspaceDir);
      const projectPath = conversation.metadata?.workspacePath ?? conversation.metadata?.projectPath ?? this.decodeProjectPath(workspaceHash);
      const toolResultsMap = /* @__PURE__ */ new Map();
      for (const msg of conversation.messages) {
        if (msg.role === "tool") {
          if (Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (block.type === "tool-result") {
                const resultBlock = block;
                if (resultBlock.toolCallId) {
                  const resultText = resultBlock.result || "";
                  const isError = resultText.toLowerCase().includes("error");
                  toolResultsMap.set(resultBlock.toolCallId, {
                    content: resultText,
                    isError,
                    toolName: resultBlock.toolName || "unknown"
                  });
                }
              }
            }
          }
          if (msg.toolResults) {
            for (const result of msg.toolResults) {
              const toolId = result.tool_use_id ?? result.toolCallId;
              if (toolId) {
                toolResultsMap.set(toolId, {
                  content: result.content,
                  isError: result.isError ?? result.is_error ?? false,
                  toolName: "unknown"
                });
              }
            }
          }
        }
      }
      const messages = [];
      for (const msg of conversation.messages) {
        if (msg.role === "user") {
          const content = typeof msg.content === "string" ? msg.content : msg.text ?? "";
          if (!content.trim()) continue;
          messages.push({
            uuid: msg.id ?? this.generateUUID(),
            role: "user",
            timestamp: this.extractTimestamp(msg) ?? /* @__PURE__ */ new Date(),
            content
          });
        } else if (msg.role === "assistant") {
          const { textContent, toolCallBlocks } = this.parseAssistantContent(msg);
          const toolCalls = this.extractToolCallsFromBlocks(toolCallBlocks, toolResultsMap);
          const legacyToolCalls = this.extractLegacyToolCalls(msg, toolResultsMap);
          const allToolCalls = toolCalls.length > 0 ? toolCalls : legacyToolCalls && legacyToolCalls.length > 0 ? legacyToolCalls : void 0;
          messages.push({
            uuid: msg.id ?? this.generateUUID(),
            role: "assistant",
            timestamp: this.extractTimestamp(msg) ?? /* @__PURE__ */ new Date(),
            content: textContent,
            toolCalls: allToolCalls
          });
        }
      }
      if (messages.length === 0) return null;
      const timestamps = messages.map((m) => m.timestamp);
      const startTime = new Date(
        Math.min(...timestamps.map((t) => t.getTime()))
      );
      const endTime = new Date(
        Math.max(...timestamps.map((t) => t.getTime()))
      );
      const stats = this.computeStats(messages);
      return {
        sessionId,
        projectPath,
        startTime,
        endTime,
        durationSeconds: this.calculateDuration(startTime, endTime),
        claudeCodeVersion: "cursor",
        // Use 'cursor' as version identifier
        messages,
        stats,
        source: this.name
      };
    } catch {
      return null;
    } finally {
      db?.close();
    }
  }
  async readSessionContent(filePath) {
    return "";
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Private helper methods
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * List all subdirectories within a given directory
   */
  async listSubdirectories(parentDir) {
    try {
      const entries = await readdir2(parentDir);
      const dirs = [];
      for (const entry of entries) {
        const fullPath = join3(parentDir, entry);
        try {
          const stats = await stat2(fullPath);
          if (stats.isDirectory()) {
            dirs.push(fullPath);
          }
        } catch {
        }
      }
      return dirs;
    } catch {
      return [];
    }
  }
  async listWorkspaceDirs() {
    return this.listSubdirectories(this.baseDir);
  }
  async listSessionDirs(workspaceDir) {
    return this.listSubdirectories(workspaceDir);
  }
  parseConversation(db) {
    try {
      const stmt = db.prepare("SELECT id, data FROM blobs");
      const rows = stmt.all();
      if (rows.length === 0) return null;
      const messages = [];
      let metadata;
      for (const row of rows) {
        try {
          const data = this.parseBlob(row.data);
          if (!data) continue;
          if (data.messages && Array.isArray(data.messages)) {
            messages.push(...data.messages);
          } else if (data.role) {
            const msg = {
              id: data.id ?? row.id,
              role: data.role,
              // Preserve content array for assistant messages (contains tool-call blocks)
              content: data.content,
              text: data.text,
              timestamp: data.timestamp,
              createdAt: data.createdAt,
              toolCalls: data.toolCalls ?? data.tool_calls,
              signature: data.signature
            };
            if (Array.isArray(data.content) && msg.role === "tool") {
              for (const block of data.content) {
                if (block.type === "tool-result" && typeof block.result === "string") {
                  const toolId = block.toolCallId;
                  if (toolId) {
                    msg.toolResults = msg.toolResults ?? [];
                    msg.toolResults.push({
                      toolCallId: toolId,
                      content: block.result,
                      isError: block.result.toLowerCase().includes("error")
                    });
                  }
                }
              }
            }
            if (msg.role !== "system") {
              messages.push(msg);
            }
          }
          if (data.metadata || data.workspacePath) {
            metadata = {
              workspacePath: data.workspacePath ?? data.metadata?.workspacePath,
              projectPath: data.projectPath ?? data.metadata?.projectPath,
              createdAt: data.createdAt ?? data.metadata?.createdAt,
              updatedAt: data.updatedAt ?? data.metadata?.updatedAt
            };
          }
        } catch {
        }
      }
      messages.sort((a, b) => {
        const tsA = this.extractTimestamp(a);
        const tsB = this.extractTimestamp(b);
        if (!tsA || !tsB) return 0;
        return tsA.getTime() - tsB.getTime();
      });
      return {
        id: this.generateUUID(),
        messages,
        metadata
      };
    } catch {
      return null;
    }
  }
  parseBlob(data) {
    try {
      const text = data.toString("utf-8");
      return JSON.parse(text);
    } catch {
    }
    try {
      const zlib = __require("zlib");
      const decompressed = zlib.inflateSync(data);
      return JSON.parse(decompressed.toString("utf-8"));
    } catch {
    }
    try {
      return this.parseProtobuf(data);
    } catch {
    }
    return null;
  }
  /**
   * Parse a varint from buffer at given offset
   * Protobuf uses variable-length encoding for integers
   */
  parseVarint(data, offset) {
    if (offset >= data.length) return null;
    let value = 0;
    let shift = 0;
    let bytesRead = 0;
    const MAX_VARINT_BYTES = 10;
    while (offset + bytesRead < data.length) {
      const byte = data[offset + bytesRead];
      value |= (byte & 127) << shift;
      bytesRead++;
      const isLastByte = (byte & 128) === 0;
      if (isLastByte) break;
      shift += 7;
      if (bytesRead > MAX_VARINT_BYTES) return null;
    }
    return { value, bytesRead };
  }
  /**
   * Parse Cursor protobuf blob format
   *
   * Cursor stores some messages in a simple protobuf format:
   * - field1 (wire2): text content (message body, tool results)
   * - field2 (wire2): UUID (message ID)
   * - field3 (wire2): usually empty
   * - field4 (wire2): nested JSON (full message object)
   *
   * Wire type 2 = length-delimited (string, bytes, embedded messages)
   */
  parseProtobuf(data) {
    const fields = /* @__PURE__ */ new Map();
    let offset = 0;
    while (offset < data.length) {
      const tagVarint = this.parseVarint(data, offset);
      if (!tagVarint) break;
      const tag = tagVarint.value;
      const fieldNumber = tag >> 3;
      const wireType = tag & 7;
      offset += tagVarint.bytesRead;
      let fieldContent;
      switch (wireType) {
        case 0: {
          const varint = this.parseVarint(data, offset);
          if (!varint) break;
          fieldContent = varint.value;
          offset += varint.bytesRead;
          break;
        }
        case 1: {
          if (offset + 8 > data.length) return null;
          fieldContent = data.subarray(offset, offset + 8);
          offset += 8;
          break;
        }
        case 2: {
          const lengthVarint = this.parseVarint(data, offset);
          if (!lengthVarint) return null;
          const length = lengthVarint.value;
          offset += lengthVarint.bytesRead;
          if (offset + length > data.length) return null;
          fieldContent = data.subarray(offset, offset + length);
          offset += length;
          break;
        }
        case 5: {
          if (offset + 4 > data.length) return null;
          fieldContent = data.subarray(offset, offset + 4);
          offset += 4;
          break;
        }
        default:
          return null;
      }
      if (!fields.has(fieldNumber)) {
        fields.set(fieldNumber, []);
      }
      fields.get(fieldNumber).push({ wireType, content: fieldContent });
    }
    return this.mapProtobufFields(fields);
  }
  /**
   * Map protobuf fields to a message-like structure
   */
  mapProtobufFields(fields) {
    const field4 = fields.get(4);
    if (field4 && field4.length > 0) {
      for (const { content } of field4) {
        if (Buffer.isBuffer(content)) {
          try {
            const jsonStr = content.toString("utf-8");
            const parsed = JSON.parse(jsonStr);
            if (parsed && (parsed.role || parsed.messages || parsed.content)) {
              return parsed;
            }
          } catch {
          }
        }
      }
    }
    const result = {};
    const field1 = fields.get(1);
    if (field1 && field1.length > 0) {
      const { content } = field1[0];
      if (Buffer.isBuffer(content)) {
        const text = content.toString("utf-8");
        if (text.length > 0 && this.isPrintableText(text)) {
          result.text = text;
        }
      }
    }
    const field2 = fields.get(2);
    if (field2 && field2.length > 0) {
      const { content } = field2[0];
      if (Buffer.isBuffer(content)) {
        const uuid = content.toString("utf-8");
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
          result.id = uuid;
        }
      }
    }
    if (Object.keys(result).length > 0) {
      return result;
    }
    return null;
  }
  /**
   * Check if a string is printable text (not binary garbage)
   */
  isPrintableText(str) {
    const sample = str.substring(0, 100);
    return /^[\x20-\x7E\n\r\t\u00A0-\uFFFF]+$/.test(sample);
  }
  /**
   * Convert Unix timestamp to Date, handling both seconds and milliseconds
   */
  unixToDate(timestamp) {
    const MILLISECONDS_THRESHOLD = 1e12;
    const normalizedTs = timestamp > MILLISECONDS_THRESHOLD ? timestamp : timestamp * 1e3;
    return new Date(normalizedTs);
  }
  extractTimestamp(msg) {
    if (msg.timestamp) return new Date(msg.timestamp);
    if (msg.createdAt) return this.unixToDate(msg.createdAt);
    return null;
  }
  /**
   * Parse assistant message content array to extract text and tool-call blocks
   * Cursor stores tool calls in the content array with type: 'tool-call'
   */
  parseAssistantContent(msg) {
    const textParts = [];
    const toolCallBlocks = [];
    if (typeof msg.content === "string") {
      return { textContent: msg.content, toolCallBlocks: [] };
    }
    if (!Array.isArray(msg.content)) {
      return { textContent: msg.text ?? "", toolCallBlocks: [] };
    }
    for (const block of msg.content) {
      if (block.type === "text" && typeof block.text === "string") {
        textParts.push(block.text);
      } else if (block.type === "reasoning" && typeof block.text === "string") {
        textParts.push(block.text);
      } else if (block.type === "tool-call") {
        const toolBlock = block;
        if (toolBlock.toolCallId && toolBlock.toolName) {
          toolCallBlocks.push(toolBlock);
        }
      }
    }
    return {
      textContent: textParts.join("\n"),
      toolCallBlocks
    };
  }
  /**
   * Extract tool calls from Cursor's tool-call blocks
   */
  extractToolCallsFromBlocks(blocks, toolResultsMap) {
    const toolCalls = [];
    for (const block of blocks) {
      const id = block.toolCallId;
      const name = block.toolName;
      const input = block.args || {};
      const result = toolResultsMap.get(id);
      const normalizedName = normalizeToolName(name, this.name);
      toolCalls.push({
        id,
        name: normalizedName,
        input,
        result: result?.content,
        isError: result?.isError
      });
    }
    return toolCalls;
  }
  /**
   * Extract tool calls from legacy toolCalls/tool_calls fields
   */
  extractLegacyToolCalls(msg, toolResultsMap) {
    const rawCalls = msg.toolCalls ?? msg.tool_calls ?? [];
    if (rawCalls.length === 0) return void 0;
    const toolCalls = [];
    for (const call of rawCalls) {
      const name = call.name ?? call.function?.name ?? "unknown";
      const id = call.id ?? this.generateUUID();
      let input = {};
      if (call.input) {
        input = call.input;
      } else if (call.arguments) {
        try {
          input = typeof call.arguments === "string" ? JSON.parse(call.arguments) : call.arguments;
        } catch {
          input = { raw: call.arguments };
        }
      } else if (call.function?.arguments) {
        try {
          input = typeof call.function.arguments === "string" ? JSON.parse(call.function.arguments) : call.function.arguments;
        } catch {
          input = { raw: call.function.arguments };
        }
      }
      const result = toolResultsMap.get(id);
      const normalizedName = normalizeToolName(name, this.name);
      toolCalls.push({
        id,
        name: normalizedName,
        input,
        result: result?.content,
        isError: result?.isError
      });
    }
    return toolCalls.length > 0 ? toolCalls : void 0;
  }
  generateUUID() {
    return "cursor-" + Math.random().toString(36).substring(2, 15);
  }
};
var cursorSource = new CursorSource();

// lib/scanner/sources/cursor-composer.ts
import { stat as stat3 } from "fs/promises";

// lib/scanner/sources/cursor-paths.ts
import { join as join4 } from "path";
import { homedir as homedir4, platform } from "os";
function getCursorUserDir() {
  const home = homedir4();
  switch (platform()) {
    case "darwin":
      return join4(home, "Library", "Application Support", "Cursor", "User");
    case "win32":
      return join4(process.env.APPDATA ?? join4(home, "AppData", "Roaming"), "Cursor", "User");
    default:
      return join4(home, ".config", "Cursor", "User");
  }
}
function getCursorGlobalStoragePath() {
  return join4(getCursorUserDir(), "globalStorage");
}
function getCursorGlobalStateDbPath() {
  return join4(getCursorGlobalStoragePath(), "state.vscdb");
}

// lib/scanner/sources/cursor-composer.ts
var CursorComposerSource = class extends BaseSessionSource {
  name = "cursor-composer";
  displayName = "Cursor Composer";
  dbPath;
  constructor(dbPath) {
    super();
    this.dbPath = dbPath ?? getCursorGlobalStateDbPath();
  }
  getBaseDir() {
    return this.dbPath;
  }
  async isAvailable() {
    try {
      await stat3(this.dbPath);
      const Database = await loadSqlite();
      return Database !== null;
    } catch {
      return false;
    }
  }
  /**
   * Collect file metadata for all composer sessions in state.vscdb.
   *
   * Each composerId becomes a virtual "file" entry with a synthetic path
   * of the form: state.vscdb#{composerId}
   */
  async collectFileMetadata(config) {
    const Database = await loadSqlite();
    if (!Database) return [];
    let db = null;
    try {
      db = new Database(this.dbPath, { readonly: true });
      const composerIds = this.listComposerIds(db);
      const results = [];
      for (const composerId of composerIds) {
        try {
          const data = this.getComposerData(db, composerId);
          if (!data) continue;
          const bubbleCount = this.countBubbles(db, composerId);
          const estimatedSize = bubbleCount * 2048;
          if (config?.minFileSize && estimatedSize < config.minFileSize) continue;
          if (config?.maxFileSize && estimatedSize > config.maxFileSize) continue;
          const projectDir = data.workspaceProjectDir ?? this.getProjectDirFromBubbles(db, composerId) ?? "unknown";
          const createdAt = data.createdAt ? new Date(data.createdAt) : /* @__PURE__ */ new Date();
          const lastUpdated = data.lastUpdatedAt ? new Date(data.lastUpdatedAt) : createdAt;
          results.push({
            filePath: `${this.dbPath}#${composerId}`,
            fileSize: estimatedSize,
            mtime: lastUpdated,
            projectDirName: this.encodeProjectDir(projectDir),
            source: this.name
          });
        } catch {
        }
      }
      return results;
    } catch {
      return [];
    } finally {
      db?.close();
    }
  }
  async extractMetadata(filePath, _content) {
    const composerId = this.extractComposerId(filePath);
    if (!composerId) return null;
    const Database = await loadSqlite();
    if (!Database) return null;
    let db = null;
    try {
      db = new Database(this.dbPath, { readonly: true });
      const data = this.getComposerData(db, composerId);
      if (!data) return null;
      const bubbles = this.getBubbles(db, composerId);
      const conversationBubbles = bubbles.filter((b) => b.type === 1 || b.type === 2);
      if (conversationBubbles.length === 0) return null;
      const timestamps = conversationBubbles.map((b) => b.createdAt ? new Date(b.createdAt) : null).filter((t) => t !== null && !isNaN(t.getTime()));
      if (timestamps.length === 0) return null;
      const firstTimestamp = new Date(Math.min(...timestamps.map((t) => t.getTime())));
      const lastTimestamp = new Date(Math.max(...timestamps.map((t) => t.getTime())));
      const projectDir = data.workspaceProjectDir ?? this.getProjectDirFromBubbleList(bubbles) ?? "unknown";
      return {
        sessionId: composerId,
        projectPath: projectDir,
        projectName: this.getProjectName(projectDir),
        timestamp: firstTimestamp,
        messageCount: conversationBubbles.length,
        durationSeconds: this.calculateDuration(firstTimestamp, lastTimestamp),
        filePath,
        source: this.name
      };
    } catch {
      return null;
    } finally {
      db?.close();
    }
  }
  async parseSessionContent(_sessionId, _projectPath, _projectName, _content) {
    return null;
  }
  /**
   * Parse a composer session directly from state.vscdb
   */
  async parseFromFile(filePath) {
    const composerId = this.extractComposerId(filePath);
    if (!composerId) return null;
    const Database = await loadSqlite();
    if (!Database) return null;
    let db = null;
    try {
      db = new Database(this.dbPath, { readonly: true });
      const data = this.getComposerData(db, composerId);
      if (!data) return null;
      const bubbles = this.getBubbles(db, composerId);
      if (bubbles.length === 0) return null;
      const messages = this.convertBubblesToMessages(bubbles);
      if (messages.length === 0) return null;
      const timestamps = messages.map((m) => m.timestamp);
      const startTime = new Date(Math.min(...timestamps.map((t) => t.getTime())));
      const endTime = new Date(Math.max(...timestamps.map((t) => t.getTime())));
      const projectDir = data.workspaceProjectDir ?? this.getProjectDirFromBubbleList(bubbles) ?? "unknown";
      const stats = this.computeStats(messages);
      return {
        sessionId: composerId,
        projectPath: projectDir,
        projectName: this.getProjectName(projectDir),
        startTime,
        endTime,
        durationSeconds: this.calculateDuration(startTime, endTime),
        claudeCodeVersion: "cursor-composer",
        messages,
        stats,
        source: this.name
      };
    } catch {
      return null;
    } finally {
      db?.close();
    }
  }
  async readSessionContent(_filePath) {
    return "";
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Private: Database query helpers
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * List all composer IDs from composerData:* keys
   */
  listComposerIds(db) {
    const stmt = db.prepare(
      "SELECT key FROM cursorDiskKV WHERE key LIKE 'composerData:%'"
    );
    const rows = stmt.all();
    return rows.map((r) => r.key.replace("composerData:", ""));
  }
  /**
   * Get composer metadata for a specific composer ID
   */
  getComposerData(db, composerId) {
    const stmt = db.prepare(
      "SELECT value FROM cursorDiskKV WHERE key = ?"
    );
    const row = stmt.get(`composerData:${composerId}`);
    if (!row?.value) return null;
    try {
      return JSON.parse(row.value);
    } catch {
      return null;
    }
  }
  /**
   * Count bubbles for a composer session
   */
  countBubbles(db, composerId) {
    const stmt = db.prepare(
      "SELECT COUNT(*) as count FROM cursorDiskKV WHERE key LIKE ?"
    );
    const row = stmt.get(`bubbleId:${composerId}:%`);
    return row?.count ?? 0;
  }
  /**
   * Get all bubbles for a composer session, sorted by creation time
   */
  getBubbles(db, composerId) {
    const stmt = db.prepare(
      "SELECT key, value FROM cursorDiskKV WHERE key LIKE ?"
    );
    const rows = stmt.all(`bubbleId:${composerId}:%`);
    const bubbles = [];
    for (const row of rows) {
      try {
        const bubble = JSON.parse(row.value);
        bubbles.push(bubble);
      } catch {
      }
    }
    bubbles.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
    return bubbles;
  }
  /**
   * Get project directory from the first bubble that has workspaceProjectDir
   */
  getProjectDirFromBubbles(db, composerId) {
    const stmt = db.prepare(
      "SELECT value FROM cursorDiskKV WHERE key LIKE ? LIMIT 20"
    );
    const rows = stmt.all(`bubbleId:${composerId}:%`);
    for (const row of rows) {
      try {
        const bubble = JSON.parse(row.value);
        if (bubble.workspaceProjectDir) {
          return bubble.workspaceProjectDir;
        }
      } catch {
      }
    }
    return null;
  }
  /**
   * Get project directory from already-loaded bubbles
   */
  getProjectDirFromBubbleList(bubbles) {
    for (const bubble of bubbles) {
      if (bubble.workspaceProjectDir) {
        return bubble.workspaceProjectDir;
      }
    }
    return null;
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Private: Bubble → ParsedMessage conversion
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Convert sorted bubbles into ParsedMessages.
   *
   * Conversion rules:
   * - User bubbles (type=1): → ParsedMessage { role: 'user' }
   * - Assistant text bubbles (type=2, has text): → ParsedMessage { role: 'assistant' }
   * - Assistant tool bubbles (type=2, has toolFormerData): → append toolCall to previous assistant message
   * - Thinking bubbles (type=2, has thinking): → skip (not relevant for analysis)
   * - Empty bubbles (type=2, no text, no tool): → skip
   *
   * Consecutive assistant tool bubbles are merged into the preceding text message.
   */
  convertBubblesToMessages(bubbles) {
    const messages = [];
    let currentAssistant = null;
    for (const bubble of bubbles) {
      if (bubble.type === 1) {
        const text = bubble.text?.trim();
        if (!text) continue;
        currentAssistant = null;
        messages.push({
          uuid: this.generateUUID(),
          role: "user",
          timestamp: bubble.createdAt ? new Date(bubble.createdAt) : /* @__PURE__ */ new Date(),
          content: text
        });
      } else if (bubble.type === 2) {
        const hasText = bubble.text && bubble.text.trim().length > 0;
        const hasTool = bubble.toolFormerData != null;
        const hasThinking = bubble.thinking?.text != null;
        if (hasThinking && !hasText && !hasTool) {
          continue;
        }
        if (hasText) {
          currentAssistant = {
            uuid: this.generateUUID(),
            role: "assistant",
            timestamp: bubble.createdAt ? new Date(bubble.createdAt) : /* @__PURE__ */ new Date(),
            content: bubble.text.trim(),
            toolCalls: [],
            tokenUsage: this.extractTokenUsage(bubble)
          };
          messages.push(currentAssistant);
        }
        if (hasTool) {
          const toolCall = this.convertToolFormerData(bubble.toolFormerData);
          if (toolCall) {
            if (currentAssistant) {
              if (!currentAssistant.toolCalls) {
                currentAssistant.toolCalls = [];
              }
              currentAssistant.toolCalls.push(toolCall);
            } else {
              currentAssistant = {
                uuid: this.generateUUID(),
                role: "assistant",
                timestamp: bubble.createdAt ? new Date(bubble.createdAt) : /* @__PURE__ */ new Date(),
                content: "",
                toolCalls: [toolCall],
                tokenUsage: this.extractTokenUsage(bubble)
              };
              messages.push(currentAssistant);
            }
          }
        }
        if (bubble.tokenCount && currentAssistant) {
          const usage = this.extractTokenUsage(bubble);
          if (usage && (usage.input > 0 || usage.output > 0)) {
            currentAssistant.tokenUsage = usage;
          }
        }
      }
    }
    for (const msg of messages) {
      if (msg.toolCalls && msg.toolCalls.length === 0) {
        delete msg.toolCalls;
      }
    }
    return messages;
  }
  /**
   * Convert toolFormerData to a ToolCall
   */
  convertToolFormerData(toolData) {
    const toolName = resolveComposerToolId(toolData.tool);
    let input = {};
    if (toolData.rawArgs) {
      try {
        input = JSON.parse(toolData.rawArgs);
      } catch {
        input = { raw: toolData.rawArgs };
      }
    }
    return {
      id: toolData.toolCallId ?? this.generateUUID(),
      name: toolName,
      input
    };
  }
  /**
   * Extract token usage from bubble
   */
  extractTokenUsage(bubble) {
    if (!bubble.tokenCount) return void 0;
    const input = bubble.tokenCount.inputTokens ?? 0;
    const output = bubble.tokenCount.outputTokens ?? 0;
    if (input === 0 && output === 0) return void 0;
    return { input, output };
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Private: Utility helpers
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Extract composerId from synthetic file path: state.vscdb#{composerId}
   */
  extractComposerId(filePath) {
    const hashIndex = filePath.indexOf("#");
    if (hashIndex === -1) return null;
    return filePath.substring(hashIndex + 1);
  }
  /**
   * Encode a project directory path into a safe directory name.
   * Replaces '/' with '-' for consistency with ClaudeCodeSource encoding.
   */
  encodeProjectDir(projectDir) {
    return projectDir.replace(/\//g, "-");
  }
  generateUUID() {
    return "composer-" + Math.random().toString(36).substring(2, 15);
  }
};
var cursorComposerSource = new CursorComposerSource();

// lib/scanner/sources/claude-discovery.ts
import { readdir as readdir3, stat as stat4, realpath } from "fs/promises";
import { join as join5 } from "path";
import { homedir as homedir5 } from "os";
async function validateClaudeDataDir(dir) {
  try {
    const projectsDir = join5(dir, "projects");
    const projectsStat = await stat4(projectsDir);
    if (!projectsStat.isDirectory()) return false;
    const entries = await readdir3(projectsDir);
    for (const entry of entries) {
      if (!entry.startsWith("-") && !isWindowsEncodedPath(entry)) continue;
      const entryPath = join5(projectsDir, entry);
      const entryStat = await stat4(entryPath);
      if (!entryStat.isDirectory()) continue;
      const files = await readdir3(entryPath);
      if (files.some((f) => f.endsWith(".jsonl"))) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
async function discoverClaudeDataDirs() {
  const discovered = /* @__PURE__ */ new Map();
  const addIfValid = async (dir) => {
    try {
      const projectsDir = join5(dir, "projects");
      const resolved = await realpath(projectsDir);
      if (discovered.has(resolved)) return true;
      if (await validateClaudeDataDir(dir)) {
        discovered.set(resolved, projectsDir);
        return true;
      }
    } catch {
    }
    return false;
  };
  const defaultDir = join5(homedir5(), ".claude");
  await addIfValid(defaultDir);
  if (discovered.size > 0) {
    return Array.from(discovered.values());
  }
  try {
    const home = homedir5();
    const entries = await readdir3(home);
    for (const entry of entries) {
      if (!entry.startsWith(".claude")) continue;
      if (entry === ".claude") continue;
      const candidateDir = join5(home, entry);
      try {
        const s = await stat4(candidateDir);
        if (s.isDirectory()) {
          await addIfValid(candidateDir);
        }
      } catch {
      }
    }
  } catch {
  }
  return Array.from(discovered.values());
}

// lib/scanner/index.ts
var SourceRegistry = class {
  sources = [];
  claudeInitialized = false;
  constructor() {
    this.register(new CursorSource());
    this.register(new CursorComposerSource());
  }
  /**
   * Register a new session source
   */
  register(source) {
    this.sources.push(source);
  }
  /**
   * Get all registered sources
   */
  getAll() {
    return [...this.sources];
  }
  /**
   * Get available sources (directory exists, dependencies met).
   * Lazily initializes Claude Code sources on first call.
   */
  async getAvailable() {
    if (!this.claudeInitialized) {
      await this.initClaudeSources();
      this.claudeInitialized = true;
    }
    const available = [];
    for (const source of this.sources) {
      if (await source.isAvailable()) {
        available.push(source);
      }
    }
    return available;
  }
  /**
   * Get a specific source by name
   */
  get(name) {
    return this.sources.find((s) => s.name === name);
  }
  /**
   * Discover and register Claude Code sources from available data directories.
   */
  async initClaudeSources() {
    const dirs = await discoverClaudeDataDirs();
    for (const dir of dirs) {
      this.register(new ClaudeCodeSource(dir));
    }
  }
};
var sourceRegistry = new SourceRegistry();
var MultiSourceScanner = class {
  constructor(registry = sourceRegistry) {
    this.registry = registry;
  }
  /**
   * Collect file metadata from all available sources
   */
  async collectAllFileMetadata(config) {
    const sources = await this.getFilteredSources(config);
    const allFiles = [];
    const sourceStats = /* @__PURE__ */ new Map();
    for (const source of sources) {
      const files = await source.collectFileMetadata({
        minFileSize: config?.minFileSize,
        maxFileSize: config?.maxFileSize
      });
      allFiles.push(...files);
      sourceStats.set(source.name, files.length);
    }
    return { files: allFiles, sourceStats };
  }
  /**
   * Extract metadata for a file from the appropriate source
   */
  async extractMetadata(file) {
    const source = this.registry.get(file.source);
    if (!source) return null;
    try {
      const content = await source.readSessionContent(file.filePath);
      return source.extractMetadata(file.filePath, content);
    } catch {
      return null;
    }
  }
  /**
   * Parse a session from the appropriate source
   */
  async parseSession(metadata) {
    const source = this.registry.get(metadata.source);
    if (!source) return null;
    try {
      if (metadata.source === "cursor") {
        const cursorSource2 = source;
        return cursorSource2.parseFromFile(metadata.filePath);
      }
      if (metadata.source === "cursor-composer") {
        const composerSource = source;
        return composerSource.parseFromFile(metadata.filePath);
      }
      const content = await source.readSessionContent(metadata.filePath);
      return source.parseSessionContent(
        metadata.sessionId,
        metadata.projectPath,
        metadata.projectName,
        content
      );
    } catch {
      return null;
    }
  }
  /**
   * Get available source names
   */
  async getAvailableSources() {
    const sources = await this.registry.getAvailable();
    return sources.map((s) => s.name);
  }
  /**
   * Check source availability status.
   * Triggers lazy Claude source init if not yet done.
   */
  async getSourceStatus() {
    const available = await this.registry.getAvailable();
    const status = /* @__PURE__ */ new Map();
    for (const source of this.registry.getAll()) {
      status.set(source.name, available.some((s) => s === source));
    }
    return status;
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────
  async getFilteredSources(config) {
    let sources = await this.registry.getAvailable();
    if (config?.includeSources && config.includeSources.length > 0) {
      sources = sources.filter((s) => config.includeSources.includes(s.name));
    }
    if (config?.excludeSources && config.excludeSources.length > 0) {
      sources = sources.filter((s) => !config.excludeSources.includes(s.name));
    }
    return sources;
  }
};
var multiSourceScanner = new MultiSourceScanner();

// lib/core/multi-source-session-scanner.ts
function getParsedSessionsCachePath() {
  return join6(getScanCacheDir(), "parsed-sessions.json");
}
function isNonNull(value) {
  return value !== null;
}
function serializeParsedSession(session) {
  let projectName = session.projectName;
  if (!projectName && session.projectPath) {
    const encoded = session.projectPath.replace(/\//g, "-");
    projectName = resolveProjectName(encoded);
  }
  projectName = normalizeProjectNameValue(projectName);
  return {
    sessionId: session.sessionId,
    projectPath: session.projectPath,
    projectName,
    startTime: session.startTime.toISOString(),
    endTime: session.endTime.toISOString(),
    durationSeconds: session.durationSeconds,
    claudeCodeVersion: session.claudeCodeVersion,
    messages: session.messages.map((message) => ({
      uuid: message.uuid,
      role: message.role,
      timestamp: message.timestamp.toISOString(),
      content: message.content,
      toolCalls: message.toolCalls,
      tokenUsage: message.tokenUsage
    })),
    stats: session.stats,
    source: session.source
  };
}
async function scanAndCacheParsedSessions() {
  const { files } = await multiSourceScanner.collectAllFileMetadata({
    minFileSize: 1024,
    maxFileSize: 50 * 1024 * 1024
  });
  const metadata = (await Promise.all(files.map((file) => multiSourceScanner.extractMetadata(file)))).filter(isNonNull).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const parsedSessions = (await Promise.all(metadata.map((item) => multiSourceScanner.parseSession(item)))).filter(isNonNull).map(serializeParsedSession).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  await cacheParsedSessions(parsedSessions);
  return parsedSessions;
}
async function cacheParsedSessions(sessions) {
  const scanCacheDir = getScanCacheDir();
  const cachePath = getParsedSessionsCachePath();
  await mkdir(scanCacheDir, { recursive: true });
  await writeFile(cachePath, JSON.stringify(sessions, null, 2), "utf-8");
  return cachePath;
}
async function readCachedParsedSessions() {
  try {
    const raw = await readFile2(getParsedSessionsCachePath(), "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export {
  normalizeProjectNameValue,
  normalizeProjectFilters,
  scanAndCacheParsedSessions,
  readCachedParsedSessions
};
//# sourceMappingURL=chunk-5ERQTXTD.js.map