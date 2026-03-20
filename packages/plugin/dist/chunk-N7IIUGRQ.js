// lib/native-deps.ts
import { existsSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
import { homedir } from "os";
function ensureNativeDeps(opts) {
  const installDir = opts?.pluginRoot ?? join(homedir(), ".betterprompt");
  const marker = join(installDir, "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node");
  if (existsSync(marker)) return;
  try {
    execFileSync("npm", ["install", "--prefix", installDir, "better-sqlite3@12.8.0"], {
      stdio: "ignore",
      timeout: 6e4
    });
  } catch (err) {
    const msg = `[betterprompt] Failed to install better-sqlite3: ${err instanceof Error ? err.message : err}`;
    if (opts?.fatal) {
      throw new Error(msg);
    }
    process.stderr.write(msg + "\n");
  }
}

export {
  ensureNativeDeps
};
//# sourceMappingURL=chunk-N7IIUGRQ.js.map