import {
  debug
} from "./chunk-FW6ZW4J3.js";
import {
  getPluginDataDir
} from "./chunk-UORQZYNI.js";

// lib/config.ts
import { join } from "path";
var DEFAULTS = {
  serverUrl: "http://localhost:3000",
  autoAnalyze: true,
  analyzeThreshold: 5
};
var cachedConfig = null;
function getConfig() {
  if (cachedConfig) return cachedConfig;
  cachedConfig = {
    serverUrl: (process.env.BETTERPROMPT_SERVER_URL ?? DEFAULTS.serverUrl).replace(/\/$/, ""),
    autoAnalyze: process.env.BETTERPROMPT_AUTO_ANALYZE !== "false",
    analyzeThreshold: Number.parseInt(
      process.env.BETTERPROMPT_ANALYZE_THRESHOLD ?? "",
      10
    ) || DEFAULTS.analyzeThreshold
  };
  debug("config", "resolved", { ...cachedConfig });
  return cachedConfig;
}
function getPluginDataDir2() {
  return getPluginDataDir();
}
function getStateFilePath() {
  return join(getPluginDataDir2(), "plugin-state.json");
}

export {
  getConfig,
  getPluginDataDir2 as getPluginDataDir,
  getStateFilePath
};
//# sourceMappingURL=chunk-FIGO7IPG.js.map