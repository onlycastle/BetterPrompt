// lib/native-deps.ts
import { existsSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
function ensureNativeDeps() {
  const pluginDataDir = process.env.CLAUDE_PLUGIN_DATA;
  if (!pluginDataDir) return;
  const marker = join(pluginDataDir, "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node");
  if (existsSync(marker)) return;
  try {
    execFileSync("npm", ["install", "--prefix", pluginDataDir, "better-sqlite3@12.8.0"], {
      stdio: "ignore",
      timeout: 6e4
    });
  } catch (err) {
    process.stderr.write(`[betterprompt] Failed to install better-sqlite3: ${err instanceof Error ? err.message : err}
`);
  }
}

export {
  ensureNativeDeps
};
//# sourceMappingURL=chunk-T7MBAB73.js.map