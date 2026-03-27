import {
  getAnalysisRun,
  getCurrentRunId,
  getDomainResults,
  recordStageStatus,
  saveStageOutput
} from "./chunk-T2XRMW7B.js";
import "./chunk-UORQZYNI.js";
import "./chunk-NSBPE2FW.js";

// cli/commands/verify-evidence.ts
function normalizeText(text) {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function tokenize(text) {
  return normalizeText(text).split(" ").filter((token) => token.length > 1);
}
function bigrams(text) {
  const normalized = normalizeText(text).replace(/\s+/g, " ");
  if (normalized.length < 2) return normalized ? [normalized] : [];
  const grams = [];
  for (let index = 0; index < normalized.length - 1; index += 1) {
    grams.push(normalized.slice(index, index + 2));
  }
  return grams;
}
function diceCoefficient(left, right) {
  const leftBigrams = bigrams(left);
  const rightBigrams = bigrams(right);
  if (leftBigrams.length === 0 || rightBigrams.length === 0) return 0;
  const rightCounts = /* @__PURE__ */ new Map();
  for (const gram of rightBigrams) {
    rightCounts.set(gram, (rightCounts.get(gram) ?? 0) + 1);
  }
  let intersection = 0;
  for (const gram of leftBigrams) {
    const count = rightCounts.get(gram) ?? 0;
    if (count > 0) {
      intersection += 1;
      rightCounts.set(gram, count - 1);
    }
  }
  return 2 * intersection / (leftBigrams.length + rightBigrams.length);
}
function scoreEvidence(quote, utterance) {
  const normalizedQuote = normalizeText(quote);
  const normalizedUtterance = normalizeText(utterance);
  if (!normalizedQuote || !normalizedUtterance) return 0;
  if (normalizedUtterance.includes(normalizedQuote) || normalizedQuote.includes(normalizedUtterance)) {
    return 100;
  }
  const quoteTokens = tokenize(quote);
  const utteranceTokens = new Set(tokenize(utterance));
  if (quoteTokens.length === 0) return 0;
  const sharedTokens = quoteTokens.filter((token) => utteranceTokens.has(token)).length;
  const tokenCoverage = sharedTokens / quoteTokens.length;
  const similarity = diceCoefficient(normalizedQuote, normalizedUtterance);
  if (tokenCoverage >= 0.85 || similarity >= 0.82) return 85;
  if (tokenCoverage >= 0.6 || similarity >= 0.65) return 65;
  if (tokenCoverage >= 0.4 || similarity >= 0.5) return 45;
  return 0;
}
async function execute(args) {
  const threshold = typeof args.threshold === "number" ? args.threshold : 50;
  const runId = getCurrentRunId();
  if (!runId) {
    return JSON.stringify({
      status: "error",
      message: "No active analysis run. Run extract-data first."
    });
  }
  const run = getAnalysisRun(runId);
  if (!run?.phase1Output) {
    return JSON.stringify({
      status: "error",
      runId,
      message: `Run #${runId} has no Phase 1 output.`
    });
  }
  const domainResults = getDomainResults(runId);
  if (domainResults.length === 0) {
    return JSON.stringify({
      status: "error",
      runId,
      message: `Run #${runId} has no saved domain results to verify.`
    });
  }
  recordStageStatus(runId, "evidenceVerification", { status: "running" });
  try {
    const utteranceLookup = Object.fromEntries(
      run.phase1Output.developerUtterances.map((utterance) => [
        utterance.id,
        utterance.displayText || utterance.text
      ])
    );
    const verifiedResults = [];
    const domainStats = [];
    for (const result of domainResults) {
      const evidenceItems = [
        ...result.strengths.flatMap((strength) => strength.evidence ?? []),
        ...result.growthAreas.flatMap((growthArea) => growthArea.evidence ?? [])
      ];
      let keptCount2 = 0;
      let filteredCount2 = 0;
      for (const evidence of evidenceItems) {
        const utteranceId = typeof evidence.utteranceId === "string" ? evidence.utteranceId : "";
        const quote = typeof evidence.quote === "string" ? evidence.quote : "";
        const sourceUtterance = utteranceId ? utteranceLookup[utteranceId] ?? "" : "";
        const relevanceScore = scoreEvidence(quote, sourceUtterance);
        const verified = relevanceScore >= threshold;
        if (verified) keptCount2++;
        else filteredCount2++;
        verifiedResults.push({ utteranceId, quote, relevanceScore, verified });
      }
      domainStats.push({ domain: result.domain, totalEvidence: evidenceItems.length, keptCount: keptCount2, filteredCount: filteredCount2 });
    }
    const data = { verifiedResults, domainStats, threshold };
    saveStageOutput(runId, "evidenceVerification", data);
    recordStageStatus(runId, "evidenceVerification", { status: "validated" });
    const keptCount = verifiedResults.filter((r) => r.verified).length;
    const filteredCount = verifiedResults.length - keptCount;
    return JSON.stringify({
      status: "ok",
      runId,
      stage: "evidenceVerification",
      threshold,
      totalEvidence: verifiedResults.length,
      keptCount,
      filteredCount,
      domainStats,
      message: `Verified ${verifiedResults.length} evidence items. Kept ${keptCount}, filtered ${filteredCount}.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify evidence.";
    recordStageStatus(runId, "evidenceVerification", { status: "failed", lastError: message });
    return JSON.stringify({ status: "error", runId, message });
  }
}
export {
  execute
};
//# sourceMappingURL=verify-evidence-XTM6E7ST.js.map