import {
  getAllStageOutputs,
  getCurrentRunId,
  getStageOutput
} from "./chunk-T2XRMW7B.js";
import {
  getPluginDataDir
} from "./chunk-UORQZYNI.js";
import "./chunk-NSBPE2FW.js";

// cli/commands/get-stage-output.ts
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
async function execute(args) {
  const runId = getCurrentRunId();
  if (!runId) {
    return JSON.stringify({
      status: "error",
      message: "No active analysis run. Run extract-data first."
    });
  }
  const tmpDir = join(getPluginDataDir(), "tmp");
  await mkdir(tmpDir, { recursive: true });
  if (typeof args.stage === "string") {
    const data = getStageOutput(runId, args.stage);
    if (!data) {
      return JSON.stringify({
        status: "not_found",
        stage: args.stage,
        runId,
        message: `No ${args.stage} output found for run #${runId}. This stage may not have been executed yet.`
      });
    }
    const result2 = { status: "ok", stage: args.stage, runId, data };
    const outputFile2 = join(tmpDir, `stage-${args.stage}.json`);
    await writeFile(outputFile2, JSON.stringify(result2, null, 2), "utf-8");
    return JSON.stringify({
      status: "ok",
      stage: args.stage,
      runId,
      outputFile: outputFile2,
      message: `Stage output written to ${outputFile2}.`
    });
  }
  const all = getAllStageOutputs(runId);
  const stages = Object.keys(all);
  const result = { status: "ok", runId, stagesAvailable: stages, data: all };
  const outputFile = join(tmpDir, "stage-all.json");
  await writeFile(outputFile, JSON.stringify(result, null, 2), "utf-8");
  return JSON.stringify({
    status: "ok",
    runId,
    stagesAvailable: stages,
    outputFile,
    message: `All stage outputs written to ${outputFile}.`
  });
}
export {
  execute
};
//# sourceMappingURL=get-stage-output-RZT4A4FD.js.map