// lib/logger.ts
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var stderrEnabled = process.env.BETTERPROMPT_DEBUG === "1";
var logDir = join(homedir(), ".betterprompt");
var logPath = join(logDir, "debug.log");
var dirEnsured = false;
function ensureLogDir() {
  if (dirEnsured) return;
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
  }
  dirEnsured = true;
}
function format(tag, msg, data) {
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  return `[bp:${tag}] ${msg}${suffix}
`;
}
function writeToFile(line) {
  ensureLogDir();
  try {
    const timestamped = `${(/* @__PURE__ */ new Date()).toISOString()} ${line}`;
    appendFileSync(logPath, timestamped);
  } catch {
  }
}
function debug(tag, msg, data) {
  const line = format(tag, msg, data);
  writeToFile(line);
  if (stderrEnabled) process.stderr.write(line);
}
function info(tag, msg, data) {
  const line = format(tag, msg, data);
  writeToFile(line);
  process.stderr.write(line);
}
function error(tag, msg, data) {
  const line = format(tag, msg, data);
  writeToFile(line);
  process.stderr.write(line);
}

export {
  debug,
  info,
  error
};
//# sourceMappingURL=chunk-FW6ZW4J3.js.map