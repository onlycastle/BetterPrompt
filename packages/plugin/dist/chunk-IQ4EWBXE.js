import {
  getPluginDataDir
} from "./chunk-FIGO7IPG.js";

// lib/prefs.ts
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
function getPrefsFilePath() {
  return join(getPluginDataDir(), "prefs.json");
}
function readPrefs() {
  try {
    const raw = readFileSync(getPrefsFilePath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function writePrefs(partial) {
  const filePath = getPrefsFilePath();
  mkdirSync(dirname(filePath), { recursive: true });
  const existing = readPrefs();
  writeFileSync(
    filePath,
    JSON.stringify({ ...existing, ...partial }, null, 2)
  );
}
function isFirstRun() {
  return !readPrefs().welcomeCompleted;
}

export {
  readPrefs,
  writePrefs,
  isFirstRun
};
//# sourceMappingURL=chunk-IQ4EWBXE.js.map