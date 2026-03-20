#!/usr/bin/env node
import {
  ensureNativeDeps
} from "../chunk-QHWHFHUD.js";
import "../chunk-PR4QN5HX.js";

// mcp/server-entry.ts
import { dirname, join } from "path";
import { fileURLToPath } from "url";
var pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
ensureNativeDeps({ pluginRoot, fatal: true });
await import("./server.js");
//# sourceMappingURL=server-entry.js.map