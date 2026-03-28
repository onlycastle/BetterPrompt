import "./chunk-3Y74BQOH.js";
import {
  getAnalysisRun,
  getCurrentRunId,
  saveTypeResult
} from "./chunk-FFMI5SRQ.js";
import {
  computeDeterministicScores,
  computeDeterministicType
} from "./chunk-SVAMHER4.js";
import "./chunk-NSBPE2FW.js";

// cli/commands/classify-developer-type.ts
async function execute(_args) {
  const runId = getCurrentRunId();
  if (!runId) {
    return JSON.stringify({
      status: "error",
      message: "No active analysis run. Run extract-data first."
    });
  }
  const existingRun = getAnalysisRun(runId);
  if (!existingRun?.phase1Output) {
    return JSON.stringify({
      status: "error",
      message: "No Phase 1 data found for the current run. Run extract-data first."
    });
  }
  const phase1Output = existingRun.phase1Output;
  const scores = existingRun.scores ?? computeDeterministicScores(phase1Output);
  const typeResult = computeDeterministicType(scores, phase1Output);
  saveTypeResult(runId, typeResult);
  return JSON.stringify({
    status: "ok",
    primaryType: typeResult.primaryType,
    controlLevel: typeResult.controlLevel,
    matrixName: typeResult.matrixName,
    matrixEmoji: typeResult.matrixEmoji,
    distribution: typeResult.distribution,
    controlScore: typeResult.controlScore,
    runId,
    message: `Developer type: ${typeResult.matrixEmoji} ${typeResult.matrixName} (${typeResult.primaryType} / ${typeResult.controlLevel}). Distribution: ${Object.entries(typeResult.distribution).map(([k, v]) => `${k} ${v}%`).join(", ")}.`
  });
}
export {
  execute
};
//# sourceMappingURL=classify-developer-type-GJA7F7C6.js.map