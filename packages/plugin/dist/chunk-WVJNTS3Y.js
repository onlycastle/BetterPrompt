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
function buildPendingAnalysisAdditionalContext() {
  return [
    "BetterPrompt auto-analysis is pending from a previous session.",
    "Immediately invoke the BetterPrompt `/analyze` skill to consume the queued analysis unless the user explicitly asks to cancel or defer it.",
    "Run the full local-first BetterPrompt pipeline through report generation for this queued task before treating it as complete, including translation when the report language requires it."
  ].join(" ");
}

export {
  estimateSessionDurationMsFromTranscript,
  buildPendingAnalysisAdditionalContext
};
//# sourceMappingURL=chunk-WVJNTS3Y.js.map