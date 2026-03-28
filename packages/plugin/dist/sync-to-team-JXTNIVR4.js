import {
  markAnalysisComplete
} from "./chunk-ZNJUTHXJ.js";
import {
  getConfig
} from "./chunk-SE3623WC.js";
import "./chunk-FW6ZW4J3.js";
import {
  assembleCanonicalRun
} from "./chunk-FFMI5SRQ.js";
import "./chunk-SVAMHER4.js";
import "./chunk-NSBPE2FW.js";

// cli/commands/sync-to-team.ts
async function execute(args) {
  const serverUrl = (args.serverUrl ?? getConfig().serverUrl)?.replace(/\/$/, "");
  if (!serverUrl) {
    return JSON.stringify({
      status: "not_configured",
      message: "No team server URL. Set BETTERPROMPT_SERVER_URL or pass --serverUrl."
    });
  }
  const run = assembleCanonicalRun();
  if (!run) {
    return JSON.stringify({
      status: "no_data",
      message: "No analysis results to sync. Run a full analysis first."
    });
  }
  try {
    const response = await fetch(`${serverUrl}/api/analysis/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run, syncedAt: (/* @__PURE__ */ new Date()).toISOString() }),
      signal: AbortSignal.timeout(15e3)
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return JSON.stringify({
        status: "sync_failed",
        httpStatus: response.status,
        message: `Server returned ${response.status}: ${errorText}`
      });
    }
    const result = await response.json().catch(() => ({}));
    markAnalysisComplete(run.phase1Output.sessionMetrics.totalSessions);
    return JSON.stringify({
      status: "ok",
      serverUrl,
      message: `Successfully synced analysis to ${serverUrl}.`,
      ...result && typeof result === "object" ? result : {}
    });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: `Failed to connect to ${serverUrl}: ${error instanceof Error ? error.message : "Unknown error"}`
    });
  }
}
export {
  execute
};
//# sourceMappingURL=sync-to-team-JXTNIVR4.js.map