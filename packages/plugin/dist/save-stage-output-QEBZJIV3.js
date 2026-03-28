import {
  getCurrentRunId,
  recordStageStatus,
  saveStageOutput
} from "./chunk-FFMI5SRQ.js";
import {
  STAGE_NAMES,
  STAGE_SCHEMAS,
  external_exports
} from "./chunk-SVAMHER4.js";
import "./chunk-NSBPE2FW.js";

// cli/commands/save-stage-output.ts
import { readFileSync } from "fs";
var StageOutputInputSchema = external_exports.object({
  stage: external_exports.enum(STAGE_NAMES),
  data: external_exports.record(external_exports.string(), external_exports.unknown())
});
async function execute(args) {
  const runId = getCurrentRunId();
  const stageName = typeof args.stage === "string" ? args.stage : null;
  if (!runId) {
    return JSON.stringify({
      status: "error",
      message: "No active analysis run. Run extract-data first to start an analysis."
    });
  }
  let data = args.data;
  if (typeof args.file === "string") {
    try {
      data = JSON.parse(readFileSync(args.file, "utf-8"));
    } catch (error) {
      return JSON.stringify({
        status: "error",
        message: `Failed to read input file: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    }
  }
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (error) {
      return JSON.stringify({
        status: "error",
        message: `Invalid JSON in --data: ${error instanceof Error ? error.message : "parse error"}`
      });
    }
  }
  const input = { stage: args.stage, data };
  const parsed = StageOutputInputSchema.safeParse(input);
  if (!parsed.success) {
    if (stageName) {
      recordStageStatus(runId, stageName, {
        status: "failed",
        lastError: "Invalid stage output format."
      });
    }
    return JSON.stringify({
      status: "validation_error",
      message: "Invalid stage output format.",
      errors: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message
      }))
    });
  }
  const { stage, data: validatedData } = parsed.data;
  const stageSchema = STAGE_SCHEMAS[stage];
  if (stageSchema) {
    const stageValidation = stageSchema.safeParse(validatedData);
    if (!stageValidation.success) {
      recordStageStatus(runId, stage, {
        status: "failed",
        lastError: `Data does not match ${stage} schema.`
      });
      return JSON.stringify({
        status: "validation_error",
        message: `Data does not match ${stage} schema.`,
        errors: stageValidation.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message
        }))
      });
    }
  }
  saveStageOutput(runId, stage, validatedData);
  recordStageStatus(runId, stage, { status: "validated" });
  return JSON.stringify({
    status: "ok",
    stage,
    runId,
    message: `Saved ${stage} output to run #${runId}.`
  });
}
export {
  execute
};
//# sourceMappingURL=save-stage-output-QEBZJIV3.js.map