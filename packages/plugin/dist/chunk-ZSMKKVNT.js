import {
  debug,
  error,
  info
} from "./chunk-PP5673GG.js";

// lib/native-deps.ts
import { existsSync, mkdirSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
import { homedir } from "os";
function ensureNativeDeps(opts) {
  const installDir = opts?.pluginRoot ?? join(homedir(), ".betterprompt");
  const dataDir = join(homedir(), ".betterprompt");
  try {
    mkdirSync(dataDir, { recursive: true });
  } catch {
  }
  const marker = join(installDir, "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node");
  if (existsSync(marker)) {
    debug("native-deps", "marker found, skipping install", { installDir });
    return;
  }
  info("native-deps", "installing better-sqlite3", { installDir });
  try {
    const output = execFileSync("npm", ["install", "--prefix", installDir, "better-sqlite3@12.8.0"], {
      timeout: 12e4,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    if (output) {
      debug("native-deps", "npm output", { output: output.slice(0, 500) });
    }
    info("native-deps", "install succeeded");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const stderr = err.stderr ?? "";
    error("native-deps", "install failed", {
      error: errorMsg,
      ...stderr ? { stderr: stderr.slice(0, 1e3) } : {},
      hint: "Ensure Node.js >=18 and build tools are available (Xcode CLI on macOS, build-essential on Linux)"
    });
    if (opts?.fatal) {
      throw new Error(
        `[betterprompt] Failed to install better-sqlite3: ${errorMsg}
` + (stderr ? `npm stderr: ${stderr.slice(0, 500)}
` : "") + "Hint: Ensure Node.js >=18 and build tools are installed (macOS: xcode-select --install)"
      );
    }
  }
}

export {
  ensureNativeDeps
};
//# sourceMappingURL=chunk-ZSMKKVNT.js.map