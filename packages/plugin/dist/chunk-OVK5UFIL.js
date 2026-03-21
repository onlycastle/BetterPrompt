import {
  debug,
  error,
  info
} from "./chunk-HXPLIOJF.js";

// lib/native-deps.ts
import { existsSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
import { homedir } from "os";
function ensureNativeDeps(opts) {
  const installDir = opts?.pluginRoot ?? join(homedir(), ".betterprompt");
  const marker = join(installDir, "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node");
  if (existsSync(marker)) {
    debug("native-deps", "marker found, skipping install", { installDir });
    return;
  }
  info("native-deps", "installing better-sqlite3", { installDir });
  try {
    execFileSync("npm", ["install", "--prefix", installDir, "better-sqlite3@12.8.0"], {
      stdio: "ignore",
      timeout: 6e4
    });
    info("native-deps", "install succeeded");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    error("native-deps", "install failed", { error: errorMsg });
    if (opts?.fatal) {
      throw new Error(`[betterprompt] Failed to install better-sqlite3: ${errorMsg}`);
    }
  }
}

export {
  ensureNativeDeps
};
//# sourceMappingURL=chunk-OVK5UFIL.js.map