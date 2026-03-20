// lib/hook-utils.ts
import { readFileSync } from "fs";
function extractTimestampMs(line) {
  try {
    const parsed = JSON.parse(line);
    if (typeof parsed.timestamp !== "string") {
      return null;
    }
    const timestampMs = new Date(parsed.timestamp).getTime();
    return Number.isNaN(timestampMs) ? null : timestampMs;
  } catch {
    return null;
  }
}
function estimateSessionDurationMsFromTranscript(transcriptPath) {
  try {
    const content = readFileSync(transcriptPath, "utf-8");
    const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) {
      return 0;
    }
    const firstTimestamp = extractTimestampMs(lines[0]);
    const lastTimestamp = extractTimestampMs(lines[lines.length - 1]);
    if (firstTimestamp === null || lastTimestamp === null || lastTimestamp <= firstTimestamp) {
      return 0;
    }
    return lastTimestamp - firstTimestamp;
  } catch {
    return 0;
  }
}
function buildFirstRunAdditionalContext() {
  return [
    "BetterPrompt is installed but has not been set up yet.",
    "Immediately invoke the BetterPrompt `bp setup` skill to guide the user through first-time onboarding.",
    "This is a quick (~1 min) wizard that verifies the installation, optionally adds a command reference to CLAUDE.md, and points the user toward their first analysis."
  ].join(" ");
}
function buildPendingAnalysisAdditionalContext() {
  return [
    "BetterPrompt auto-analysis is pending from a previous session.",
    "Immediately invoke the BetterPrompt `bp analyze` skill to consume the queued analysis unless the user explicitly asks to cancel or defer it.",
    "Run the full local-first BetterPrompt pipeline through report generation for this queued task before treating it as complete, including translation when the report language requires it."
  ].join(" ");
}

export {
  estimateSessionDurationMsFromTranscript,
  buildFirstRunAdditionalContext,
  buildPendingAnalysisAdditionalContext
};
//# sourceMappingURL=chunk-ZKL2ZRNA.js.map