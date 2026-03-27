import {
  readPrefs,
  writePrefs
} from "./chunk-IQ4EWBXE.js";
import {
  markAnalysisPending
} from "./chunk-VXUKPHXP.js";
import "./chunk-FIGO7IPG.js";
import "./chunk-FW6ZW4J3.js";
import {
  external_exports
} from "./chunk-UORQZYNI.js";
import "./chunk-NSBPE2FW.js";

// cli/commands/save-user-prefs.ts
import { readFileSync } from "fs";
var SaveUserPrefsInputSchema = external_exports.object({
  selectedProjects: external_exports.array(external_exports.string()).optional(),
  starAsked: external_exports.boolean().optional(),
  welcomeShown: external_exports.boolean().optional(),
  welcomeVersion: external_exports.string().optional(),
  markWelcomeCompleted: external_exports.boolean().optional(),
  queueAnalysis: external_exports.boolean().optional()
});
function normalizeWelcomeVersion(value) {
  if (value === void 0) return void 0;
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}
async function execute(args) {
  let inputArgs = args;
  if (args.json !== void 0) {
    try {
      const parsed2 = typeof args.json === "string" ? JSON.parse(args.json) : args.json;
      if (typeof parsed2 === "object" && parsed2 !== null) {
        inputArgs = { ...args, ...parsed2 };
      }
    } catch (error) {
      return JSON.stringify({
        status: "error",
        message: `Invalid JSON: ${error instanceof Error ? error.message : "parse error"}`
      });
    }
  }
  if (typeof args.file === "string") {
    try {
      inputArgs = { ...args, ...JSON.parse(readFileSync(args.file, "utf-8")) };
    } catch (error) {
      return JSON.stringify({
        status: "error",
        message: `Failed to read input file: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    }
  }
  const { json: _j, file: _f, ...cleanArgs } = inputArgs;
  const parsed = SaveUserPrefsInputSchema.safeParse(cleanArgs);
  if (!parsed.success) {
    return JSON.stringify({
      status: "validation_error",
      message: "Invalid user prefs payload.",
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }
  const { markWelcomeCompleted = false, queueAnalysis = false, ...partial } = parsed.data;
  const nextPrefs = {
    ...partial,
    ...partial.welcomeVersion !== void 0 ? { welcomeVersion: normalizeWelcomeVersion(partial.welcomeVersion) } : {}
  };
  if (markWelcomeCompleted) {
    nextPrefs.welcomeCompleted = (/* @__PURE__ */ new Date()).toISOString();
  }
  if (Object.keys(nextPrefs).length === 0 && !queueAnalysis) {
    return JSON.stringify({
      status: "noop",
      prefs: readPrefs(),
      message: "No preference fields were provided."
    });
  }
  if (Object.keys(nextPrefs).length > 0) {
    writePrefs(nextPrefs);
  }
  if (queueAnalysis) {
    markAnalysisPending();
  }
  return JSON.stringify({
    status: "ok",
    prefs: readPrefs(),
    ...queueAnalysis ? { analysisQueued: true } : {},
    message: queueAnalysis ? "Updated preferences and queued analysis for next session." : "Updated BetterPrompt user preferences."
  });
}
export {
  execute
};
//# sourceMappingURL=save-user-prefs-TSPPMLMV.js.map