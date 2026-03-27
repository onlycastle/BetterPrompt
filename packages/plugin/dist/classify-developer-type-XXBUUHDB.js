import "./chunk-3Y74BQOH.js";
import {
  getAnalysisRun,
  getCurrentRunId,
  saveTypeResult
} from "./chunk-T2XRMW7B.js";
import {
  computeDeterministicScores,
  computeDeterministicType,
  getPluginDataDir
} from "./chunk-UORQZYNI.js";
import "./chunk-NSBPE2FW.js";

// cli/commands/classify-developer-type.ts
import { readFile } from "fs/promises";
import { join } from "path";
async function execute(_args) {
  const runId = getCurrentRunId();
  let phase1Output;
  const existingRun = runId ? getAnalysisRun(runId) : null;
  if (existingRun?.phase1Output) {
    phase1Output = existingRun.phase1Output;
  } else {
    try {
      const phase1Path = join(getPluginDataDir(), "phase1-output.json");
      const content = await readFile(phase1Path, "utf-8");
      phase1Output = JSON.parse(content);
    } catch {
      return JSON.stringify({
        status: "error",
        message: "No Phase 1 data found. Run extract-data first."
      });
    }
  }
  const scores = existingRun?.phase1Output ? existingRun.scores : computeDeterministicScores(phase1Output);
  const typeResult = computeDeterministicType(scores, phase1Output);
  if (runId) {
    saveTypeResult(runId, typeResult);
  }
  return JSON.stringify({
    status: "ok",
    primaryType: typeResult.primaryType,
    controlLevel: typeResult.controlLevel,
    matrixName: typeResult.matrixName,
    matrixEmoji: typeResult.matrixEmoji,
    distribution: typeResult.distribution,
    controlScore: typeResult.controlScore,
    runId,
    message: `Developer type: ${typeResult.matrixEmoji} ${typeResult.matrixName} (${typeResult.primaryType} / ${typeResult.controlLevel}).`
  });
}
export {
  execute
};
//# sourceMappingURL=classify-developer-type-XXBUUHDB.js.map