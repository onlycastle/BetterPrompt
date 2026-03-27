import {
  getCurrentRunId,
  getDomainResult,
  getDomainResults
} from "./chunk-T2XRMW7B.js";
import {
  getPluginDataDir
} from "./chunk-UORQZYNI.js";
import "./chunk-NSBPE2FW.js";

// cli/commands/get-domain-results.ts
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
  if (typeof args.domain === "string") {
    const result = getDomainResult(runId, args.domain);
    if (!result) {
      return JSON.stringify({
        status: "not_found",
        domain: args.domain,
        runId,
        message: `No ${args.domain} result found for run #${runId}.`
      });
    }
    const output2 = { status: "ok", domain: args.domain, runId, data: result };
    const outputFile2 = join(tmpDir, `domain-${args.domain}.json`);
    await writeFile(outputFile2, JSON.stringify(output2, null, 2), "utf-8");
    return JSON.stringify({
      status: "ok",
      domain: args.domain,
      runId,
      outputFile: outputFile2,
      message: `Domain result written to ${outputFile2}.`
    });
  }
  const results = getDomainResults(runId);
  const output = { status: "ok", runId, domainsAvailable: results.map((r) => r.domain), data: results };
  const outputFile = join(tmpDir, "domain-all.json");
  await writeFile(outputFile, JSON.stringify(output, null, 2), "utf-8");
  return JSON.stringify({
    status: "ok",
    runId,
    domainsAvailable: results.map((r) => r.domain),
    outputFile,
    message: `All domain results written to ${outputFile}.`
  });
}
export {
  execute
};
//# sourceMappingURL=get-domain-results-AJSUPVA2.js.map