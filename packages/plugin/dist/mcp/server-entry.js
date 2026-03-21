#!/usr/bin/env node
import {
  ensureNativeDeps
} from "../chunk-KNCLT3SU.js";
import {
  info
} from "../chunk-QCP6GYGV.js";

// mcp/server-entry.ts
import { dirname, join } from "path";
import { fileURLToPath } from "url";
var pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
info("bootstrap", "ensuring native deps");
ensureNativeDeps({ pluginRoot, fatal: true });
info("bootstrap", "native deps ready, loading server");
await import("./server.js");
//# sourceMappingURL=server-entry.js.map