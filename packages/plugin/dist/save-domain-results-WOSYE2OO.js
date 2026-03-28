import {
  getCurrentRunId,
  recordStageStatus,
  saveDomainResult
} from "./chunk-FFMI5SRQ.js";
import {
  DomainGrowthAreaSchema,
  DomainStrengthSchema,
  MultitaskingPatternSchema,
  external_exports
} from "./chunk-SVAMHER4.js";
import "./chunk-NSBPE2FW.js";

// cli/commands/save-domain-results.ts
import { readFileSync } from "fs";
var ThinkingQualityDataSchema = external_exports.object({
  planningHabits: external_exports.union([
    external_exports.array(external_exports.object({
      type: external_exports.string(),
      frequency: external_exports.string().optional(),
      examples: external_exports.array(external_exports.string()).optional(),
      effectiveness: external_exports.string().optional()
    }).passthrough()).min(1),
    external_exports.object({
      dominantType: external_exports.string().optional(),
      typeDistribution: external_exports.record(external_exports.string(), external_exports.number()).optional()
    }).passthrough()
  ]),
  verificationBehavior: external_exports.object({ level: external_exports.string() }).passthrough(),
  criticalThinkingMoments: external_exports.array(external_exports.object({
    type: external_exports.string(),
    quote: external_exports.string().optional(),
    result: external_exports.string().optional(),
    utteranceId: external_exports.string().optional(),
    sessionId: external_exports.string().optional()
  }).passthrough()),
  verificationAntiPatterns: external_exports.array(external_exports.object({
    type: external_exports.string(),
    frequency: external_exports.number().optional(),
    severity: external_exports.string().optional(),
    examples: external_exports.array(external_exports.unknown()).optional(),
    evidence: external_exports.array(external_exports.unknown()).optional(),
    improvement: external_exports.string().optional()
  }).passthrough()),
  planQualityScore: external_exports.number().min(0).max(100).optional(),
  multitaskingPattern: MultitaskingPatternSchema.optional()
}).passthrough();
var CommunicationPatternsDataSchema = external_exports.object({
  communicationPatterns: external_exports.array(external_exports.object({
    patternName: external_exports.string().optional(),
    patternId: external_exports.string().optional(),
    title: external_exports.string().optional(),
    category: external_exports.string().optional(),
    description: external_exports.string().optional(),
    frequency: external_exports.union([external_exports.string(), external_exports.number()]).optional(),
    effectiveness: external_exports.string().optional(),
    tip: external_exports.string().optional(),
    examples: external_exports.array(external_exports.unknown()).optional(),
    evidence: external_exports.array(external_exports.unknown()).optional()
  }).passthrough()).min(1),
  signatureQuotes: external_exports.array(external_exports.object({ utteranceId: external_exports.string() }).passthrough()).optional(),
  structuralDistribution: external_exports.record(external_exports.string(), external_exports.number()).optional(),
  contextDistribution: external_exports.record(external_exports.string(), external_exports.number()).optional(),
  questioningDistribution: external_exports.record(external_exports.string(), external_exports.number()).optional()
}).passthrough();
var LearningBehaviorDataSchema = external_exports.object({
  knowledgeGaps: external_exports.array(external_exports.object({
    area: external_exports.string().optional(),
    topic: external_exports.string().optional(),
    severity: external_exports.string().optional(),
    trend: external_exports.string().optional(),
    evidence: external_exports.array(external_exports.unknown()).optional(),
    description: external_exports.string().optional(),
    questionCount: external_exports.number().optional(),
    depth: external_exports.string().optional(),
    example: external_exports.string().optional()
  }).passthrough()).optional(),
  repeatedMistakePatterns: external_exports.array(external_exports.object({
    category: external_exports.string(),
    description: external_exports.string().optional(),
    mistakeType: external_exports.string().optional(),
    frequency: external_exports.number().optional(),
    occurrenceCount: external_exports.number().optional(),
    sessionsAffected: external_exports.array(external_exports.string()).optional(),
    exampleUtteranceIds: external_exports.array(external_exports.string()).optional(),
    evidence: external_exports.array(external_exports.unknown()).optional(),
    recommendation: external_exports.string().optional()
  }).passthrough()).optional(),
  learningProgress: external_exports.array(external_exports.object({
    area: external_exports.string().optional(),
    topic: external_exports.string().optional(),
    startLevel: external_exports.string().optional(),
    currentLevel: external_exports.string().optional(),
    evidence: external_exports.unknown().optional(),
    milestones: external_exports.array(external_exports.string()).optional(),
    description: external_exports.string().optional()
  }).passthrough()).optional(),
  recommendedResources: external_exports.array(external_exports.object({
    name: external_exports.string().optional(),
    topic: external_exports.string().optional(),
    url: external_exports.string().optional(),
    resourceType: external_exports.string().optional(),
    targetGap: external_exports.string().optional(),
    timeInvestment: external_exports.string().optional(),
    priority: external_exports.string().optional()
  }).passthrough()).optional(),
  topInsights: external_exports.array(external_exports.unknown()).optional()
}).passthrough();
var ContextEfficiencyDataSchema = external_exports.object({
  inefficiencyPatterns: external_exports.array(external_exports.object({
    type: external_exports.string().optional(),
    pattern: external_exports.string().optional(),
    frequency: external_exports.number().optional(),
    severity: external_exports.string().optional(),
    impact: external_exports.string().optional(),
    description: external_exports.string().optional(),
    evidence: external_exports.array(external_exports.unknown()).optional()
  }).passthrough()).optional(),
  contextUsagePatterns: external_exports.array(external_exports.object({
    sessionId: external_exports.string().optional(),
    avgFillPercent: external_exports.number().optional(),
    pattern: external_exports.string().optional(),
    trajectory: external_exports.string().optional()
  }).passthrough()).optional(),
  promptLengthTrends: external_exports.unknown().optional(),
  iterationAnalysis: external_exports.unknown().optional(),
  avgContextFillPercent: external_exports.number().optional(),
  topInsights: external_exports.array(external_exports.unknown()).optional()
}).passthrough();
var SessionOutcomeDataSchema = external_exports.object({
  sessionAnalyses: external_exports.array(external_exports.object({
    sessionId: external_exports.string(),
    goals: external_exports.array(external_exports.string()).optional(),
    primaryGoal: external_exports.string().optional(),
    sessionType: external_exports.string(),
    outcome: external_exports.string(),
    satisfaction: external_exports.string().optional(),
    satisfactionSignal: external_exports.string().optional(),
    frictionPoints: external_exports.array(external_exports.unknown()).optional(),
    frictionTypes: external_exports.array(external_exports.string()).optional(),
    outcomeScore: external_exports.number().optional(),
    duration: external_exports.string().optional(),
    utteranceCount: external_exports.number().optional(),
    keyMoment: external_exports.string().optional()
  })).min(1),
  overallSuccessRate: external_exports.number().min(0).max(100).optional(),
  goalDistribution: external_exports.array(external_exports.unknown()).optional(),
  frictionSummary: external_exports.array(external_exports.unknown()).optional(),
  successPatterns: external_exports.array(external_exports.unknown()).optional(),
  failurePatterns: external_exports.array(external_exports.unknown()).optional()
}).passthrough();
var ToolMasteryDataSchema = external_exports.object({
  toolMastery: external_exports.array(external_exports.object({
    patternName: external_exports.string().optional(),
    category: external_exports.string().optional(),
    description: external_exports.string().optional(),
    frequency: external_exports.union([external_exports.string(), external_exports.number()]).optional(),
    examples: external_exports.array(external_exports.unknown()).optional(),
    evidence: external_exports.array(external_exports.unknown()).optional()
  }).passthrough()).min(1),
  signatureQuotes: external_exports.array(external_exports.object({ utteranceId: external_exports.string() }).passthrough()).optional()
}).passthrough();
var DOMAIN_DATA_SCHEMAS = {
  aiPartnership: ThinkingQualityDataSchema.merge(SessionOutcomeDataSchema.partial()).passthrough(),
  sessionCraft: ContextEfficiencyDataSchema.merge(LearningBehaviorDataSchema.partial()).passthrough(),
  toolMastery: ToolMasteryDataSchema,
  skillResilience: external_exports.record(external_exports.string(), external_exports.unknown()),
  sessionMastery: external_exports.record(external_exports.string(), external_exports.unknown()),
  thinkingQuality: ThinkingQualityDataSchema,
  communicationPatterns: CommunicationPatternsDataSchema,
  learningBehavior: LearningBehaviorDataSchema,
  contextEfficiency: ContextEfficiencyDataSchema,
  sessionOutcome: SessionOutcomeDataSchema
};
var QUALITY_THRESHOLDS = {
  minDescriptionLength: 300,
  minRecommendationLength: 150,
  minEvidenceCount: 2
};
var DomainResultInputSchema = external_exports.object({
  domain: external_exports.enum([
    "aiPartnership",
    "sessionCraft",
    "toolMastery",
    "skillResilience",
    "sessionMastery",
    "thinkingQuality",
    "communicationPatterns",
    "learningBehavior",
    "contextEfficiency",
    "sessionOutcome",
    "content"
  ]),
  overallScore: external_exports.number().min(0).max(100),
  confidenceScore: external_exports.number().min(0).max(1).optional(),
  strengths: external_exports.array(DomainStrengthSchema),
  growthAreas: external_exports.array(DomainGrowthAreaSchema),
  data: external_exports.record(external_exports.string(), external_exports.unknown()).optional()
});
function parseStringifiedInput(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (trimmed.startsWith("{") && trimmed.endsWith("}") || trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  return value;
}
function normalizeDomainResultArgs(args) {
  return {
    ...args,
    overallScore: parseStringifiedInput(args.overallScore),
    confidenceScore: parseStringifiedInput(args.confidenceScore),
    strengths: parseStringifiedInput(args.strengths),
    growthAreas: parseStringifiedInput(args.growthAreas),
    data: parseStringifiedInput(args.data)
  };
}
function validateContentQuality(strengths, growthAreas) {
  const issues = [];
  for (const [i, strength] of strengths.entries()) {
    if (strength.description.length < QUALITY_THRESHOLDS.minDescriptionLength) {
      issues.push({
        field: `strengths[${i}].description`,
        message: `Description for "${strength.title}" is too short (${strength.description.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minDescriptionLength} characters required.`,
        actual: strength.description.length,
        required: QUALITY_THRESHOLDS.minDescriptionLength
      });
    }
    if (strength.evidence.length < QUALITY_THRESHOLDS.minEvidenceCount) {
      issues.push({
        field: `strengths[${i}].evidence`,
        message: `Strength "${strength.title}" needs at least ${QUALITY_THRESHOLDS.minEvidenceCount} evidence items (has ${strength.evidence.length}).`,
        actual: strength.evidence.length,
        required: QUALITY_THRESHOLDS.minEvidenceCount
      });
    }
  }
  for (const [i, area] of growthAreas.entries()) {
    if (area.description.length < QUALITY_THRESHOLDS.minDescriptionLength) {
      issues.push({
        field: `growthAreas[${i}].description`,
        message: `Description for "${area.title}" is too short (${area.description.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minDescriptionLength} characters required.`,
        actual: area.description.length,
        required: QUALITY_THRESHOLDS.minDescriptionLength
      });
    }
    if (area.recommendation.length < QUALITY_THRESHOLDS.minRecommendationLength) {
      issues.push({
        field: `growthAreas[${i}].recommendation`,
        message: `Recommendation for "${area.title}" is too short (${area.recommendation.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minRecommendationLength} characters required.`,
        actual: area.recommendation.length,
        required: QUALITY_THRESHOLDS.minRecommendationLength
      });
    }
    if (area.evidence.length < QUALITY_THRESHOLDS.minEvidenceCount) {
      issues.push({
        field: `growthAreas[${i}].evidence`,
        message: `Growth area "${area.title}" needs at least ${QUALITY_THRESHOLDS.minEvidenceCount} evidence items (has ${area.evidence.length}).`,
        actual: area.evidence.length,
        required: QUALITY_THRESHOLDS.minEvidenceCount
      });
    }
  }
  return issues;
}
function getDomainDataHint(domain) {
  const hints = {
    aiPartnership: "Expected: planningHabits[], verificationBehavior, sessionAnalyses[], overallSuccessRate",
    sessionCraft: "Expected: inefficiencyPatterns[], contextUsagePatterns[], knowledgeGaps[], repeatedMistakePatterns[]",
    toolMastery: "Required: toolMastery[] (min 1). Optional: signatureQuotes[]",
    skillResilience: "Expected: domain-specific data (flexible schema)",
    sessionMastery: "Expected: absenceIndicators[], sessionCleanliness[], cleanSessionPercentage, scaffoldingDependencyScore",
    thinkingQuality: "Required: planningHabits[] (min 1), verificationBehavior, criticalThinkingMoments[], verificationAntiPatterns[]",
    communicationPatterns: "Required: communicationPatterns[] (min 1). Optional: signatureQuotes[]",
    learningBehavior: "Expected: knowledgeGaps[], repeatedMistakePatterns[], learningProgress[], recommendedResources[]",
    contextEfficiency: "Expected: inefficiencyPatterns[], contextUsagePatterns[], promptLengthTrends, avgContextFillPercent",
    sessionOutcome: "Required: sessionAnalyses[] (min 1). Optional: overallSuccessRate"
  };
  return hints[domain] ?? "";
}
async function execute(args) {
  let inputArgs = args;
  if (typeof args.file === "string") {
    try {
      inputArgs = JSON.parse(readFileSync(args.file, "utf-8"));
    } catch (error) {
      return JSON.stringify({
        status: "error",
        message: `Failed to read input file: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    }
  }
  const normalizedArgs = normalizeDomainResultArgs(inputArgs);
  const runId = getCurrentRunId();
  const domainName = typeof normalizedArgs.domain === "string" ? normalizedArgs.domain : null;
  if (!runId) {
    return JSON.stringify({
      status: "error",
      message: "No active analysis run. Run extract-data first to start an analysis."
    });
  }
  const parsed = DomainResultInputSchema.safeParse(normalizedArgs);
  if (!parsed.success) {
    if (domainName) {
      recordStageStatus(runId, domainName, { status: "failed", lastError: "Invalid domain result format." });
    }
    return JSON.stringify({
      status: "validation_error",
      message: "Invalid domain result format.",
      errors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    });
  }
  const domainSchema = DOMAIN_DATA_SCHEMAS[parsed.data.domain];
  if (domainSchema && parsed.data.data) {
    const dataResult = domainSchema.safeParse(parsed.data.data);
    if (!dataResult.success) {
      recordStageStatus(runId, parsed.data.domain, { status: "failed", lastError: `Domain-specific data for "${parsed.data.domain}" is incomplete or invalid.` });
      return JSON.stringify({
        status: "validation_error",
        message: `Domain-specific data for "${parsed.data.domain}" is incomplete or invalid.`,
        errors: dataResult.error.issues.map((i) => ({ path: `data.${i.path.join(".")}`, message: i.message })),
        hint: getDomainDataHint(parsed.data.domain)
      });
    }
  } else if (parsed.data.domain !== "content" && !parsed.data.data) {
    recordStageStatus(runId, parsed.data.domain, { status: "failed", lastError: `Domain "${parsed.data.domain}" requires a data field.` });
    return JSON.stringify({
      status: "validation_error",
      message: `Domain "${parsed.data.domain}" requires a data field with domain-specific structures.`,
      hint: getDomainDataHint(parsed.data.domain)
    });
  }
  const qualityIssues = validateContentQuality(parsed.data.strengths, parsed.data.growthAreas);
  if (qualityIssues.length > 0) {
    recordStageStatus(runId, parsed.data.domain, { status: "failed", lastError: `Quality gate failed for "${parsed.data.domain}".` });
    return JSON.stringify({
      status: "quality_error",
      message: `${qualityIssues.length} quality issue(s) detected. Expand the flagged fields and try again.`,
      issues: qualityIssues
    });
  }
  const domainResult = {
    domain: parsed.data.domain,
    overallScore: parsed.data.overallScore,
    confidenceScore: parsed.data.confidenceScore ?? 0.5,
    strengths: parsed.data.strengths,
    growthAreas: parsed.data.growthAreas,
    data: parsed.data.data,
    analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  saveDomainResult(runId, domainResult);
  recordStageStatus(runId, domainResult.domain, { status: "validated" });
  return JSON.stringify({
    status: "ok",
    domain: domainResult.domain,
    score: domainResult.overallScore,
    strengthCount: domainResult.strengths.length,
    growthAreaCount: domainResult.growthAreas.length,
    runId,
    message: `Saved ${domainResult.domain} analysis (score: ${domainResult.overallScore}/100) to run #${runId}.`
  });
}
export {
  execute
};
//# sourceMappingURL=save-domain-results-WOSYE2OO.js.map