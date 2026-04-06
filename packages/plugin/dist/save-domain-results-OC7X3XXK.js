import {
  getCurrentRunId,
  recordStageStatus,
  saveDomainResult
} from "./chunk-C2D64W37.js";
import {
  DomainGrowthAreaSchema,
  DomainStrengthSchema,
  MultitaskingPatternSchema,
  containsToolFileApiReference,
  evaluateQualityRubric,
  external_exports,
  hasObservableSignal,
  isValidToolFileApiEntry,
  passesQualityRubric,
  validateDistinctEvidence,
  validateEvidenceContentDistinctness,
  validateGrowthAreaQuality
} from "./chunk-YLUEXS7F.js";
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
  minEvidenceCount: 2,
  minVerifiableActionLength: 50,
  minCheckDescriptionLength: 30,
  minGoalRelevanceLength: 50
};
var GENERIC_CATEGORY_TAG_PLACEHOLDERS = /* @__PURE__ */ new Set([
  "general",
  "tag",
  "tag-1",
  "tag-2",
  "tag-3",
  "tag-4",
  "tag-5",
  "placeholder",
  "category",
  "behavioral",
  "type",
  "skill",
  "practice",
  "area",
  "pattern",
  "issue",
  "problem",
  "improvement"
]);
var GENERIC_GOAL_RELEVANCE_PATTERNS = [
  // "will help you write better code/software"
  /\bwill\s+help\s+you\s+(write|create|produce)\s+better\s+(code|software|programs?)\b/i,
  // "testing/X is important for software/code quality/reliability"
  /\bis\s+important\s+for\s+(software|code)\s+(quality|reliability)\b/i,
  // "will improve/enhance your (overall) code quality/productivity/efficiency/reliability"
  /\bwill\s+(improve|enhance|boost)\s+your\s+(overall\s+)?(code\s+quality|productivity|efficiency|reliability)\b/i,
  // "will make you more productive/efficient/effective"
  /\bwill\s+make\s+you\s+(a\s+)?more\s+(productive|efficient|effective)\b/i,
  // "planning saves time in the long run"
  /\bplanning\s+saves?\s+time\s+in\s+the\s+long\s+run\b/i,
  // "helps you become a better developer/programmer/engineer"
  /\bhelps?\s+you\s+become\s+a\s+better\s+(developer|programmer|engineer|coder)\b/i,
  // "better X practices will improve your overall Y" (e.g., "better search practices will improve your overall efficiency")
  /\bbetter\s+\w+\s+practices?\s+will\s+(improve|enhance)\s+your\s+(overall\s+)?\w+\b/i,
  // "this will improve your overall efficiency/productivity (and reduce time ...)"
  /\bimprove\s+your\s+overall\s+(efficiency|productivity|workflow|quality)\b/i
];
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
  const qualityDiagnostics = [];
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
    if (area.evidenceMoments && area.evidenceMoments.length > 0) {
      const evidenceResult = validateDistinctEvidence(area.evidenceMoments);
      if (!evidenceResult.valid) {
        issues.push({
          field: `growthAreas[${i}].evidenceMoments`,
          message: `Growth area "${area.title}" has insufficient distinct evidence: ${evidenceResult.reason ?? "Unknown reason."}`,
          actual: evidenceResult.distinctUtteranceCount,
          required: 2
        });
      }
    }
    if (area.evidenceMoments && area.evidenceMoments.length >= 2) {
      const normalizedMoments = area.evidenceMoments.map((m) => ({
        utteranceId: m.utteranceId,
        sessionId: m.sessionId,
        quote: m.quote,
        context: m.context ?? "",
        observation: m.behaviorDescription
      }));
      const contentResult = validateEvidenceContentDistinctness(normalizedMoments);
      if (!contentResult.valid) {
        const issueSummary = [
          contentResult.repeatedContentCount > 0 ? `${contentResult.repeatedContentCount} moment(s) have near-identical quote content` : "",
          contentResult.genericContextCount > 0 ? `${contentResult.genericContextCount} moment(s) have generic context (no session anchor)` : "",
          contentResult.weakObservationCount > 0 ? `${contentResult.weakObservationCount} moment(s) have vague behavior descriptions` : ""
        ].filter(Boolean).join("; ");
        issues.push({
          field: `growthAreas[${i}].evidenceMoments`,
          message: `Growth area "${area.title}" has evidence content quality issues: ${issueSummary}. Distinct moment requirements: (1) Each quote must be from a DIFFERENT session turn \u2014 near-identical quotes with different utteranceIds are not distinct moments. (2) Every context must reference a concrete anchor (tool name, file path, project name, or technology \u2014 not "working on a feature"). (3) Every observation must describe the specific behavior demonstrated, naming the tool, command, or pattern involved. Per-moment diagnostics: ` + contentResult.issues.map((iss) => `[${iss.momentIndex}] ${iss.issueType}: ${iss.message}`).join(" | "),
          actual: contentResult.issues.length,
          required: 0
        });
      }
    }
    if (area.pea?.evidence && area.pea.evidence.length >= 2) {
      const contentResult = validateEvidenceContentDistinctness(area.pea.evidence);
      if (!contentResult.valid) {
        const issueSummary = [
          contentResult.repeatedContentCount > 0 ? `${contentResult.repeatedContentCount} moment(s) have near-identical quote content` : "",
          contentResult.genericContextCount > 0 ? `${contentResult.genericContextCount} moment(s) have generic context (no session anchor)` : "",
          contentResult.weakObservationCount > 0 ? `${contentResult.weakObservationCount} moment(s) have vague observations` : ""
        ].filter(Boolean).join("; ");
        issues.push({
          field: `growthAreas[${i}].pea.evidence`,
          message: `PEA evidence for "${area.title}" has content quality issues: ${issueSummary}. The PEA evidence array must contain genuinely distinct moment references, not repeated quotes with different utteranceIds. Per-moment diagnostics: ` + contentResult.issues.map((iss) => `[${iss.momentIndex}] ${iss.issueType}: ${iss.message}`).join(" | "),
          actual: contentResult.issues.length,
          required: 0
        });
      }
    }
    if (!area.verifiableAction) {
      issues.push({
        field: `growthAreas[${i}].verifiableAction`,
        message: `Growth area "${area.title}" is missing a verifiable next-session action. Every growth area must include a verifiableAction object with: action (what to do, min 50 chars), checkDescription (how to verify in session logs, min 30 chars). Example: { action: "In your next session, use /plan to outline task structure before implementation.", checkDescription: "Session starts with /plan command or TodoWrite tool_use." }`,
        actual: 0,
        required: 1
      });
    } else {
      const { action, checkDescription } = area.verifiableAction;
      if (action.length < QUALITY_THRESHOLDS.minVerifiableActionLength) {
        issues.push({
          field: `growthAreas[${i}].verifiableAction.action`,
          message: `Verifiable action for "${area.title}" is too short (${action.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minVerifiableActionLength} characters required. Actions must be specific: name the tool, command, or behavioral pattern to adopt.`,
          actual: action.length,
          required: QUALITY_THRESHOLDS.minVerifiableActionLength
        });
      }
      if (checkDescription.length < QUALITY_THRESHOLDS.minCheckDescriptionLength) {
        issues.push({
          field: `growthAreas[${i}].verifiableAction.checkDescription`,
          message: `Check description for "${area.title}" is too short (${checkDescription.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minCheckDescriptionLength} characters required. Must describe how to verify the action in session logs.`,
          actual: checkDescription.length,
          required: QUALITY_THRESHOLDS.minCheckDescriptionLength
        });
      }
      if (!hasObservableSignal(action, checkDescription)) {
        issues.push({
          field: `growthAreas[${i}].verifiableAction`,
          message: `Verifiable action for "${area.title}" does not reference any observable session-log signal. The action and checkDescription must mention at least one of: tool names (Read, Edit, Grep, Bash, etc.), CLI commands (npm, git, vitest), file names/extensions, slash commands (/plan, /compact), or prompt structure patterns (first message, before implementation). Current action: "${action.slice(0, 80)}..."`,
          actual: 0,
          required: 1
        });
      }
    }
    const toolsFromFlat = area.toolsFilesApis?.join(" ") ?? "";
    const toolsFromPea = area.pea?.pattern?.toolsFilesApis?.join(" ") ?? "";
    const toolOrPatternText = area.verifiableAction?.toolOrPattern ?? "";
    const combinedText = [
      area.title,
      area.description,
      toolOrPatternText,
      toolsFromFlat,
      toolsFromPea
    ].filter(Boolean).join(" ");
    if (!containsToolFileApiReference(combinedText)) {
      issues.push({
        field: `growthAreas[${i}].title`,
        message: `Growth area "${area.title}" does not name any specific tool, file, API, or technology. The title and/or description must reference at least one specific technology the builder interacted with (e.g., "Express", "vitest", "Grep", "middleware/auth.ts", "/plan"). You can also provide a toolsFilesApis array with explicit tool names. Generic titles like "Error Handling Issues" or "Better Planning" fail the tool_file_naming rubric criterion. Fix: Add the specific tool or technology name to the title AND to the toolsFilesApis array. BAD: "Limited Tool Usage" \u2192 GOOD: "Bash-Only File Search Instead of Glob/Grep Composition" with toolsFilesApis: ["Bash", "Glob", "Grep"]`,
        actual: 0,
        required: 1
      });
    }
    if (area.toolsFilesApis && area.toolsFilesApis.length > 0) {
      const vagueEntries = area.toolsFilesApis.filter((entry) => !isValidToolFileApiEntry(entry));
      if (vagueEntries.length > 0 && vagueEntries.length === area.toolsFilesApis.length) {
        issues.push({
          field: `growthAreas[${i}].toolsFilesApis`,
          message: `All toolsFilesApis entries for "${area.title}" are vague placeholders: [${vagueEntries.slice(0, 3).map((e) => `"${e}"`).join(", ")}]. Each entry must be a recognizable tool, file, or API name. BAD: ["tool", "API", "framework"]. GOOD: ["Express.js", "middleware/auth.ts", "vitest"]. Replace placeholders with the actual technology names from the builder's sessions.`,
          actual: 0,
          required: 1
        });
      }
    }
    const goalRelevanceText = area.goalRelevance ?? area.pea?.action?.goalRelevance ?? "";
    const descriptionHasGoalSection = /WHY IT MATTERS|why this matters|goal|trying to achieve/i.test(area.description);
    if (!goalRelevanceText && !descriptionHasGoalSection) {
      issues.push({
        field: `growthAreas[${i}].goalRelevance`,
        message: `Growth area "${area.title}" is missing goal relevance. Every growth area must explain WHY this pattern matters for what the builder is trying to achieve. Either provide a goalRelevance field (min ${QUALITY_THRESHOLDS.minGoalRelevanceLength} chars) or include a "WHY IT MATTERS" section in the description that connects the pattern to the builder's specific project, technology stack, or stated objectives. BAD: "This will improve code quality" (generic). GOOD: "Your Express API handles payment webhooks \u2014 untested error paths in middleware could silently drop Stripe events, causing revenue loss" (specific to builder's goals).`,
        actual: 0,
        required: QUALITY_THRESHOLDS.minGoalRelevanceLength
      });
    } else if (goalRelevanceText && goalRelevanceText.length < QUALITY_THRESHOLDS.minGoalRelevanceLength) {
      issues.push({
        field: `growthAreas[${i}].goalRelevance`,
        message: `Goal relevance for "${area.title}" is too short (${goalRelevanceText.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minGoalRelevanceLength} characters required. Goal relevance must explain why this pattern matters for the builder's specific goals \u2014 not generic advice. Reference the builder's actual project context, technology stack, or objectives.`,
        actual: goalRelevanceText.length,
        required: QUALITY_THRESHOLDS.minGoalRelevanceLength
      });
    } else if (goalRelevanceText) {
      const matchedGenericPattern = GENERIC_GOAL_RELEVANCE_PATTERNS.find((pattern) => pattern.test(goalRelevanceText));
      if (matchedGenericPattern) {
        issues.push({
          field: `growthAreas[${i}].goalRelevance`,
          message: `Goal relevance for "${area.title}" is a generic platitude that could apply to any developer. Every goal relevance statement must reference the builder's specific project context, technology stack, or stated objectives. BAD: "Testing is important for software quality" or "This will help you write better code" (generic \u2014 could apply to any developer). GOOD: "Your Express API handles payment webhooks \u2014 untested catch blocks in middleware silently swallow Stripe events, causing revenue loss" or "You're building a multi-tenant SaaS with Prisma \u2014 schema changes without a diff check risk breaking tenant data isolation" (specific to this builder's project and goals). Rewrite to explain WHY this pattern matters specifically for what THIS builder is trying to achieve.`,
          actual: goalRelevanceText.length,
          required: QUALITY_THRESHOLDS.minGoalRelevanceLength
        });
      }
    }
    if (area.pea) {
      if (!area.categoryTags || area.categoryTags.length === 0) {
        issues.push({
          field: `growthAreas[${i}].categoryTags`,
          message: `Growth area "${area.title}" is missing categoryTags. Every PEA growth area MUST include 1-5 freeform LLM-generated behavioral category tags for cross-developer clustering in team views. Tags are NOT constrained to a fixed taxonomy \u2014 generate descriptive tags based on the observed behavioral pattern. Examples: ["error-handling", "test-coverage", "express-middleware"] for an error handling pattern; ["context-management", "session-planning", "compact-usage"] for a context efficiency pattern. Add 2-3 descriptive tags that meaningfully describe this behavioral cluster for team aggregation.`,
          actual: 0,
          required: 1
        });
      } else {
        const genericTags = area.categoryTags.filter(
          (tag) => GENERIC_CATEGORY_TAG_PLACEHOLDERS.has(tag.toLowerCase().trim())
        );
        if (genericTags.length === area.categoryTags.length) {
          issues.push({
            field: `growthAreas[${i}].categoryTags`,
            message: `All categoryTags for "${area.title}" are generic placeholders: [${genericTags.slice(0, 3).map((t) => `"${t}"`).join(", ")}]. Replace with specific behavioral category tags that describe the observed pattern. Examples: ["error-handling", "test-coverage", "express-middleware"] for error handling patterns; ["context-management", "session-planning"] for context efficiency patterns; ["tool-composition", "bash-overuse", "file-discovery"] for tool usage patterns. Choose 2-3 tags that would meaningfully group this pattern with similar patterns from other team members.`,
            actual: 0,
            required: 1
          });
        }
      }
      const peaLLMOutput = {
        pattern: area.pea.pattern,
        evidence: area.pea.evidence,
        action: area.pea.action,
        // domain and categoryTags are required by GrowthAreaPEALLMOutput type
        // but not used by evaluateQualityRubric() — pass harmless defaults
        domain: "domain",
        categoryTags: area.categoryTags?.length ? area.categoryTags : ["general"]
      };
      const rubric = evaluateQualityRubric(peaLLMOutput);
      if (!passesQualityRubric(rubric)) {
        if (!rubric.distinctMoments) {
          issues.push({
            field: `growthAreas[${i}].pea.evidence`,
            message: `PEA evidence for "${area.title}" fails the distinct_moments criterion. The evidence array must contain 2+ moments with DISTINCT utteranceIds from actual sessions. Each moment must reference a different exchange, not the same moment cited multiple times. Fix: add a second evidence moment from a different session turn (different utteranceId).`,
            actual: 0,
            required: 1
          });
        }
        if (!rubric.verifiableAction) {
          issues.push({
            field: `growthAreas[${i}].pea.action`,
            message: `PEA action for "${area.title}" fails the verifiable_action criterion. The action.instruction (50+ chars) and action.verificationCheck (30+ chars) must together reference at least one observable session-log signal \u2014 a tool name (Read, Edit, Grep, Glob, Bash), CLI command (npm, git, vitest), slash command (/plan, /compact), or behavioral pattern (first message, before implementation). Fix: add the specific tool or command the builder should use in their next session.`,
            actual: 0,
            required: 1
          });
        }
        if (!rubric.patternSpecificity) {
          issues.push({
            field: `growthAreas[${i}].pea.pattern`,
            message: `PEA pattern for "${area.title}" fails the pattern_specificity criterion. pattern.description must be 100+ chars and pattern.toolsFilesApis must contain at least one tool/file/API entry. The description must name the specific behavior observed \u2014 not generic advice. Fix: expand the description to 100+ chars and add the specific technology the builder interacted with to toolsFilesApis.`,
            actual: area.pea.pattern.description.length,
            required: 100
          });
        }
        if (!rubric.toolFileNaming) {
          issues.push({
            field: `growthAreas[${i}].pea.pattern.toolsFilesApis`,
            message: `PEA pattern for "${area.title}" fails the tool_file_naming criterion. pattern.toolsFilesApis must contain at least one VALID entry (e.g., "Express.js", "vitest", "middleware/auth.ts", "/plan") AND the title or description must visibly mention a specific technology. Generic entries like "tool", "API", or "framework" are rejected. Fix: name the actual tool, file, or technology in both toolsFilesApis AND the pattern title or description.`,
            actual: 0,
            required: 1
          });
        }
        const richValidation = validateGrowthAreaQuality(peaLLMOutput);
        const detectedProblems = [];
        if (richValidation.problems.genericArea.detected) {
          detectedProblems.push(`genericArea (${richValidation.problems.genericArea.severity})`);
        }
        if (richValidation.problems.isolatedQuotes.detected) {
          detectedProblems.push(`isolatedQuotes (${richValidation.problems.isolatedQuotes.severity})`);
        }
        if (richValidation.problems.arbitraryScores.detected) {
          detectedProblems.push(`arbitraryScores (${richValidation.problems.arbitraryScores.severity})`);
        }
        if (richValidation.problems.missingPatterns.detected) {
          detectedProblems.push(`missingPatterns (${richValidation.problems.missingPatterns.severity})`);
        }
        qualityDiagnostics.push({
          growthAreaTitle: area.title,
          summary: richValidation.summary,
          criteriaScores: {
            distinctMoments: richValidation.criteria.distinctMoments.score,
            verifiableAction: richValidation.criteria.verifiableAction.score,
            patternSpecificity: richValidation.criteria.patternSpecificity.score,
            toolFileNaming: richValidation.criteria.toolFileNaming.score
          },
          detectedProblems
        });
      }
    }
  }
  return { issues, qualityDiagnostics };
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
  const { issues: qualityIssues, qualityDiagnostics } = validateContentQuality(
    parsed.data.strengths,
    parsed.data.growthAreas
  );
  if (qualityIssues.length > 0) {
    recordStageStatus(runId, parsed.data.domain, { status: "failed", lastError: `Quality gate failed for "${parsed.data.domain}".` });
    return JSON.stringify({
      status: "quality_error",
      message: `${qualityIssues.length} quality issue(s) detected. Expand the flagged fields and try again.`,
      issues: qualityIssues,
      // Rich quality diagnostics for PEA growth areas that fail the rubric.
      // Includes continuous criterion scores (0-1) and problem type detection
      // (genericArea, isolatedQuotes, arbitraryScores, missingPatterns) to
      // guide more targeted retries. Only present when PEA growth areas fail.
      ...qualityDiagnostics.length > 0 ? { qualityDiagnostics } : {}
    });
  }
  const growthAreasWithConfidence = parsed.data.growthAreas.map((area) => {
    const moments = area.evidenceMoments && area.evidenceMoments.length > 0 ? area.evidenceMoments : area.pea?.evidence && area.pea.evidence.length > 0 ? area.pea.evidence : null;
    if (moments) {
      const evidenceResult = validateDistinctEvidence(moments);
      if (evidenceResult.lowConfidence) {
        return { ...area, lowConfidence: true };
      }
    }
    return area;
  });
  const domainResult = {
    domain: parsed.data.domain,
    overallScore: parsed.data.overallScore,
    confidenceScore: parsed.data.confidenceScore ?? 0.5,
    strengths: parsed.data.strengths,
    growthAreas: growthAreasWithConfidence,
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
//# sourceMappingURL=save-domain-results-OC7X3XXK.js.map