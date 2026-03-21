var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

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
  __require,
  __commonJS,
  __export,
  __toESM,
  debug,
  info,
  error
};
//# sourceMappingURL=chunk-PP5673GG.js.map