var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// lib/config.ts
import { join as join2 } from "path";

// lib/core/session-scanner.ts
import { readFile, readdir, stat, mkdir, writeFile } from "fs/promises";
import { join, basename } from "path";
import { homedir } from "os";

// lib/core/types.ts
import { z as z8 } from "zod";

// ../shared/dist/schemas/phase1-output.js
import { z as z2 } from "zod";

// ../shared/dist/schemas/session.js
import { z } from "zod";
var ToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  input: z.record(z.string(), z.unknown()),
  result: z.string().optional(),
  isError: z.boolean().optional()
});
var ParsedMessageSchema = z.object({
  uuid: z.string(),
  role: z.enum(["user", "assistant"]),
  timestamp: z.string(),
  content: z.string(),
  toolCalls: z.array(ToolCallSchema).optional(),
  tokenUsage: z.object({
    input: z.number().int().min(0),
    output: z.number().int().min(0)
  }).optional()
});
var SessionStatsSchema = z.object({
  userMessageCount: z.number().int().min(0),
  assistantMessageCount: z.number().int().min(0),
  toolCallCount: z.number().int().min(0),
  uniqueToolsUsed: z.array(z.string()),
  totalInputTokens: z.number().int().min(0),
  totalOutputTokens: z.number().int().min(0)
});
var SessionSourceTypeSchema = z.enum([
  "claude-code",
  "cursor",
  "cursor-composer"
]);
var ParsedSessionSchema = z.object({
  sessionId: z.string(),
  projectPath: z.string(),
  projectName: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  durationSeconds: z.number().min(0),
  claudeCodeVersion: z.string(),
  messages: z.array(ParsedMessageSchema),
  stats: SessionStatsSchema,
  source: SessionSourceTypeSchema.optional()
});

// ../shared/dist/schemas/phase1-output.js
var AIInsightBlockSchema = z2.object({
  sessionId: z2.string(),
  turnIndex: z2.number().int().min(0),
  content: z2.string(),
  triggeringUtteranceId: z2.string().optional()
});
var NaturalLanguageSegmentSchema = z2.object({
  start: z2.number().int().min(0),
  end: z2.number().int().min(0),
  text: z2.string()
});
var UserUtteranceSchema = z2.object({
  id: z2.string(),
  text: z2.string(),
  displayText: z2.string().optional(),
  naturalLanguageSegments: z2.array(NaturalLanguageSegmentSchema).optional(),
  timestamp: z2.string(),
  sessionId: z2.string(),
  turnIndex: z2.number().int().min(0),
  characterCount: z2.number().int().min(0),
  wordCount: z2.number().int().min(0),
  hasCodeBlock: z2.boolean(),
  hasQuestion: z2.boolean(),
  isSessionStart: z2.boolean().optional(),
  isContinuation: z2.boolean().optional(),
  machineContentRatio: z2.number().min(0).max(1).optional(),
  precedingAIToolCalls: z2.array(z2.string()).optional(),
  precedingAIHadError: z2.boolean().optional()
});
var FrictionSignalsSchema = z2.object({
  toolFailureCount: z2.number().int().min(0),
  userRejectionSignals: z2.number().int().min(0),
  excessiveIterationSessions: z2.number().int().min(0),
  contextOverflowSessions: z2.number().int().min(0),
  frustrationExpressionCount: z2.number().int().min(0),
  repeatedToolErrorPatterns: z2.number().int().min(0),
  bareRetryAfterErrorCount: z2.number().int().min(0),
  errorChainMaxLength: z2.number().int().min(0)
});
var SessionHintsSchema = z2.object({
  avgTurnsPerSession: z2.number().min(0),
  shortSessions: z2.number().int().min(0),
  mediumSessions: z2.number().int().min(0),
  longSessions: z2.number().int().min(0)
});
var Phase1SessionMetricsSchema = z2.object({
  totalSessions: z2.number().int().min(0),
  totalMessages: z2.number().int().min(0),
  totalDeveloperUtterances: z2.number().int().min(0),
  totalAIResponses: z2.number().int().min(0),
  avgMessagesPerSession: z2.number(),
  avgDeveloperMessageLength: z2.number(),
  questionRatio: z2.number().min(0).max(1),
  codeBlockRatio: z2.number().min(0).max(1),
  dateRange: z2.object({
    earliest: z2.string(),
    latest: z2.string()
  }),
  slashCommandCounts: z2.record(z2.string(), z2.number()).optional(),
  avgContextFillPercent: z2.number().min(0).max(100).optional(),
  maxContextFillPercent: z2.number().min(0).max(100).optional(),
  contextFillExceeded90Count: z2.number().int().min(0).optional(),
  frictionSignals: FrictionSignalsSchema.optional(),
  sessionHints: SessionHintsSchema.optional(),
  aiInsightBlockCount: z2.number().int().min(0).optional()
});
var ActivitySessionSchema = z2.object({
  sessionId: z2.string(),
  projectName: z2.string(),
  projectPath: z2.string().optional(),
  startTime: z2.string(),
  durationSeconds: z2.number().min(0),
  messageCount: z2.number().int().min(0),
  userMessageCount: z2.number().int().min(0),
  assistantMessageCount: z2.number().int().min(0),
  totalInputTokens: z2.number().int().min(0),
  totalOutputTokens: z2.number().int().min(0),
  /** First user message text (truncated to 200 chars) for summary context */
  firstUserMessage: z2.string().optional()
});
var Phase1OutputSchema = z2.object({
  developerUtterances: z2.array(UserUtteranceSchema),
  sessionMetrics: Phase1SessionMetricsSchema,
  aiInsightBlocks: z2.array(AIInsightBlockSchema).optional(),
  /** Per-session metadata for Phase 1.5/2 stages */
  activitySessions: z2.array(ActivitySessionSchema).optional(),
  /** Full parsed sessions preserved for downstream evidence and parity needs */
  sessions: z2.array(ParsedSessionSchema).optional(),
  skippedFiles: z2.number().optional()
});

// ../shared/dist/schemas/deterministic-scores.js
import { z as z3 } from "zod";
var DeterministicScoresSchema = z3.object({
  contextEfficiency: z3.number().min(0).max(100),
  sessionOutcome: z3.number().min(0).max(100),
  thinkingQuality: z3.number().min(0).max(100),
  learningBehavior: z3.number().min(0).max(100),
  communicationPatterns: z3.number().min(0).max(100),
  controlScore: z3.number().min(0).max(100)
});
var CodingStyleTypeSchema = z3.enum([
  "architect",
  "analyst",
  "conductor",
  "speedrunner",
  "trendsetter"
]);
var AIControlLevelSchema = z3.enum([
  "explorer",
  "navigator",
  "cartographer"
]);
var DeterministicTypeResultSchema = z3.object({
  primaryType: CodingStyleTypeSchema,
  distribution: z3.object({
    architect: z3.number(),
    analyst: z3.number(),
    conductor: z3.number(),
    speedrunner: z3.number(),
    trendsetter: z3.number()
  }),
  controlLevel: AIControlLevelSchema,
  controlScore: z3.number().min(0).max(100),
  matrixName: z3.string(),
  matrixEmoji: z3.string()
});

// ../shared/dist/schemas/domain-result.js
import { z as z4 } from "zod";
var EvidenceSchema = z4.object({
  utteranceId: z4.string(),
  quote: z4.string(),
  context: z4.string().optional()
});
var DomainStrengthSchema = z4.object({
  title: z4.string(),
  description: z4.string().min(100),
  evidence: z4.array(EvidenceSchema).min(1)
});
var DomainGrowthAreaSchema = z4.object({
  title: z4.string(),
  description: z4.string().min(100),
  severity: z4.enum(["critical", "high", "medium", "low"]),
  recommendation: z4.string().min(50),
  evidence: z4.array(EvidenceSchema).min(1)
});
var DomainResultSchema = z4.object({
  domain: z4.enum([
    "thinkingQuality",
    "communicationPatterns",
    "learningBehavior",
    "contextEfficiency",
    "sessionOutcome",
    "content"
  ]),
  overallScore: z4.number().min(0).max(100),
  confidenceScore: z4.number().min(0).max(1),
  strengths: z4.array(DomainStrengthSchema),
  growthAreas: z4.array(DomainGrowthAreaSchema),
  /** Domain-specific typed data. Validated per domain when available. */
  data: z4.record(z4.string(), z4.unknown()).optional(),
  analyzedAt: z4.string()
});
var AnalysisReportSchema = z4.object({
  userId: z4.string(),
  analyzedAt: z4.string(),
  phase1Metrics: Phase1SessionMetricsSchema,
  deterministicScores: DeterministicScoresSchema,
  typeResult: DeterministicTypeResultSchema.nullable(),
  domainResults: z4.array(DomainResultSchema),
  content: z4.object({
    topFocusAreas: z4.array(z4.object({
      title: z4.string(),
      narrative: z4.string().optional(),
      description: z4.string().optional(),
      actions: z4.object({
        start: z4.string(),
        stop: z4.string(),
        continue: z4.string()
      }).optional()
    })).optional(),
    personalitySummary: z4.array(z4.string()).optional()
  }).optional()
});

// ../shared/dist/schemas/analysis-run.js
import { z as z6 } from "zod";

// ../shared/dist/schemas/stage-outputs.js
import { z as z5 } from "zod";
var SessionSummarySchema = z5.object({
  sessionId: z5.string(),
  summary: z5.string()
});
var SessionSummaryBatchSchema = z5.object({
  summaries: z5.array(SessionSummarySchema)
});
var ProjectSummarySchema = z5.object({
  projectName: z5.string(),
  summaryLines: z5.array(z5.string()),
  sessionCount: z5.number().int().min(0)
});
var ProjectSummaryBatchSchema = z5.object({
  projects: z5.array(ProjectSummarySchema)
});
var WeeklyProjectBreakdownSchema = z5.object({
  projectName: z5.string(),
  sessionCount: z5.number().int().min(0),
  percentage: z5.number().min(0).max(100)
});
var WeeklyTopSessionSchema = z5.object({
  sessionId: z5.string(),
  summary: z5.string()
});
var WeeklyInsightsSchema = z5.object({
  stats: z5.object({
    sessionCount: z5.number().int().min(0),
    totalMinutes: z5.number().min(0),
    totalTokens: z5.number().int().min(0),
    activeDays: z5.number().int().min(0).max(7),
    deltaSessionCount: z5.number().optional(),
    deltaMinutes: z5.number().optional(),
    deltaTokens: z5.number().optional()
  }),
  projects: z5.array(WeeklyProjectBreakdownSchema),
  topSessions: z5.array(WeeklyTopSessionSchema),
  narrative: z5.string(),
  highlights: z5.array(z5.string())
});
var EvidenceVerificationResultSchema = z5.object({
  utteranceId: z5.string(),
  quote: z5.string(),
  relevanceScore: z5.number().min(0).max(100),
  verified: z5.boolean()
});
var DomainVerificationStatsSchema = z5.object({
  domain: z5.string(),
  totalEvidence: z5.number().int().min(0),
  keptCount: z5.number().int().min(0),
  filteredCount: z5.number().int().min(0)
});
var EvidenceVerificationOutputSchema = z5.object({
  verifiedResults: z5.array(EvidenceVerificationResultSchema),
  domainStats: z5.array(DomainVerificationStatsSchema),
  threshold: z5.number().min(0).max(100)
});
var TopFocusAreaSchema = z5.object({
  title: z5.string(),
  description: z5.string(),
  relatedQualities: z5.array(z5.string()),
  actions: z5.object({
    start: z5.string(),
    stop: z5.string(),
    continue: z5.string()
  })
});
var ContentWriterOutputSchema = z5.object({
  topFocusAreas: z5.array(TopFocusAreaSchema),
  personalitySummary: z5.array(z5.string()).optional()
});
var TypeClassificationStageOutputSchema = z5.object({
  reasoning: z5.array(z5.string()),
  personalityNarrative: z5.array(z5.string()),
  collaborationMaturity: z5.string().optional()
});
var TranslatorOutputSchema = z5.object({
  targetLanguage: z5.string(),
  translatedFields: z5.record(z5.string(), z5.unknown())
});
var STAGE_SCHEMAS = {
  sessionSummaries: SessionSummaryBatchSchema,
  projectSummaries: ProjectSummaryBatchSchema,
  weeklyInsights: WeeklyInsightsSchema,
  typeClassification: TypeClassificationStageOutputSchema,
  evidenceVerification: EvidenceVerificationOutputSchema,
  contentWriter: ContentWriterOutputSchema,
  translator: TranslatorOutputSchema
};

// ../shared/dist/schemas/analysis-run.js
var ReportActivitySessionSchema = z6.object({
  sessionId: z6.string(),
  projectName: z6.string(),
  startTime: z6.string(),
  durationMinutes: z6.number().min(0),
  messageCount: z6.number().int().min(0),
  summary: z6.string(),
  totalInputTokens: z6.number().int().min(0).optional(),
  totalOutputTokens: z6.number().int().min(0).optional()
});
var CanonicalStageOutputsSchema = z6.object({
  sessionSummaries: SessionSummaryBatchSchema.optional(),
  projectSummaries: ProjectSummaryBatchSchema.optional(),
  weeklyInsights: WeeklyInsightsSchema.optional(),
  typeClassification: TypeClassificationStageOutputSchema.optional(),
  evidenceVerification: EvidenceVerificationOutputSchema.optional(),
  contentWriter: ContentWriterOutputSchema.optional(),
  translator: TranslatorOutputSchema.optional()
});
var CanonicalEvaluationPayloadSchema = z6.record(z6.string(), z6.unknown());
var CanonicalAnalysisRunSchema = z6.object({
  runId: z6.number().int().min(1),
  analyzedAt: z6.string(),
  phase1Output: Phase1OutputSchema,
  activitySessions: z6.array(ReportActivitySessionSchema),
  deterministicScores: DeterministicScoresSchema,
  typeResult: DeterministicTypeResultSchema.nullable(),
  domainResults: z6.array(DomainResultSchema),
  stageOutputs: CanonicalStageOutputsSchema,
  evaluation: CanonicalEvaluationPayloadSchema,
  translation: TranslatorOutputSchema.optional(),
  debug: z6.record(z6.string(), z6.unknown()).optional()
});

// ../shared/dist/schemas/worker-outputs.js
import { z as z7 } from "zod";
var InsightEvidenceSchema = z7.object({
  /** Utterance ID from Phase 1 (format: {sessionId}_{turnIndex}) */
  utteranceId: z7.string(),
  /** Direct quote or paraphrase from the developer's message */
  quote: z7.string(),
  /** Brief context description */
  context: z7.string().optional()
});
var EvidenceItemSchema = z7.union([
  z7.string(),
  InsightEvidenceSchema
]);
var WorkerStrengthSchema = z7.object({
  /** Clear, specific title (e.g., "Systematic Output Verification") */
  title: z7.string(),
  /** 6-10 sentences providing comprehensive analysis */
  description: z7.string(),
  /**
   * Direct quotes from developer messages demonstrating this (1-8 items).
   * Can be simple strings (legacy) or structured with utterance linking.
   */
  evidence: z7.array(EvidenceItemSchema).min(1).max(8),
  /** Truncated description preview for free tier blur teaser (set by ContentGateway) */
  descriptionPreview: z7.string().optional()
});
var WorkerGrowthSeveritySchema = z7.enum(["critical", "high", "medium", "low"]);
var WorkerGrowthSchema = z7.object({
  /** Clear, specific title (e.g., "Error Loop Pattern") */
  title: z7.string(),
  /** 6-10 sentences providing comprehensive analysis */
  description: z7.string(),
  /**
   * Direct quotes from developer messages showing this pattern (1-8 items).
   * Can be simple strings (legacy) or structured with utterance linking.
   */
  evidence: z7.array(EvidenceItemSchema).min(1).max(8),
  /** 4-6 sentences with step-by-step actionable advice */
  recommendation: z7.string(),
  /** How critical this growth area is to address */
  severity: WorkerGrowthSeveritySchema.optional(),
  /** Truncated description preview for free tier blur teaser (set by ContentGateway) */
  descriptionPreview: z7.string().optional(),
  /** Truncated recommendation preview for free tier blur teaser (set by ContentGateway) */
  recommendationPreview: z7.string().optional()
});
var ReferencedInsightSchema = z7.object({
  /** Insight ID (e.g., "pi-001") */
  id: z7.string(),
  /** Human-readable title */
  title: z7.string(),
  /** Source URL for the insight */
  url: z7.string(),
  /** Main insight text */
  keyTakeaway: z7.string(),
  /** Actionable tips array */
  actionableAdvice: z7.array(z7.string()),
  /** Insight category: diagnosis | trend | tool | type-specific */
  category: z7.string(),
  /** Author name from source */
  sourceAuthor: z7.string()
});
var PlanningHabitTypeSchema = z7.enum([
  "uses_plan_command",
  "plan_mode_usage",
  "task_decomposition",
  "structure_first",
  "todowrite_usage",
  "no_planning"
]);
var HabitFrequencySchema = z7.enum(["always", "often", "sometimes", "rarely", "never"]);
var PlanningHabitSchema = z7.object({
  type: PlanningHabitTypeSchema,
  frequency: HabitFrequencySchema,
  examples: z7.array(z7.string()),
  effectiveness: z7.enum(["high", "medium", "low"]).optional()
});
var CriticalThinkingTypeSchema = z7.enum([
  "verification_request",
  "output_validation",
  "assumption_questioning",
  "alternative_exploration",
  "edge_case_consideration",
  "security_check",
  "ai_output_correction"
]);
var CriticalThinkingMomentSchema = z7.object({
  type: CriticalThinkingTypeSchema,
  quote: z7.string(),
  result: z7.string(),
  utteranceId: z7.string().optional()
});
var VerificationLevelSchema = z7.enum([
  "blind_trust",
  "occasional_review",
  "systematic_verification",
  "skeptical"
]);
var VerificationBehaviorSchema = z7.object({
  level: VerificationLevelSchema,
  examples: z7.array(z7.string()),
  recommendation: z7.string(),
  confidence: z7.number().min(0).max(1).optional()
});
var PatternSeveritySchema = z7.enum(["critical", "significant", "moderate", "mild"]);
var AntiPatternExampleSchema = z7.object({
  utteranceId: z7.string(),
  quote: z7.string(),
  context: z7.string().optional()
});
var DetectedAntiPatternSchema = z7.object({
  type: z7.string(),
  frequency: z7.number().int().min(1),
  examples: z7.array(AntiPatternExampleSchema),
  severity: PatternSeveritySchema,
  improvement: z7.string().optional(),
  sessionPercentage: z7.number().min(0).max(100).optional()
});
var ContextPollutionSchema = z7.object({
  description: z7.string(),
  impact: z7.enum(["high", "medium", "low"])
});
var MultitaskingPatternSchema = z7.object({
  mixesTopicsInSessions: z7.boolean(),
  contextPollutionInstances: z7.array(ContextPollutionSchema),
  focusScore: z7.number().min(0).max(100).optional(),
  recommendation: z7.string().optional()
});
var ThinkingQualityOutputSchema = z7.object({
  // Planning Dimension
  planningHabits: z7.array(PlanningHabitSchema),
  planQualityScore: z7.number().min(0).max(100),
  multitaskingPattern: MultitaskingPatternSchema.optional(),
  // Critical Thinking Dimension
  verificationBehavior: VerificationBehaviorSchema,
  criticalThinkingMoments: z7.array(CriticalThinkingMomentSchema),
  verificationAntiPatterns: z7.array(DetectedAntiPatternSchema),
  // Overall Scores
  overallThinkingQualityScore: z7.number().min(0).max(100),
  confidenceScore: z7.number().min(0).max(1),
  summary: z7.string().optional(),
  // Domain-specific Strengths & Growth Areas
  strengths: z7.array(WorkerStrengthSchema).optional(),
  growthAreas: z7.array(WorkerGrowthSchema).optional(),
  referencedInsights: z7.array(ReferencedInsightSchema).optional()
});
var PatternFrequencySchema = z7.enum(["frequent", "occasional", "rare"]);
var PatternEffectivenessSchema = z7.enum(["highly_effective", "effective", "could_improve"]);
var PatternExampleSchema = z7.object({
  utteranceId: z7.string(),
  analysis: z7.string()
});
var CommunicationPatternSchema = z7.object({
  patternName: z7.string(),
  description: z7.string(),
  frequency: PatternFrequencySchema,
  examples: z7.array(PatternExampleSchema).min(1).max(5),
  effectiveness: PatternEffectivenessSchema,
  tip: z7.string().optional()
});
var SignatureQuoteSchema = z7.object({
  utteranceId: z7.string(),
  significance: z7.string(),
  representedStrength: z7.string()
});
var CommunicationPatternsOutputSchema = z7.object({
  // Communication Patterns
  communicationPatterns: z7.array(CommunicationPatternSchema),
  signatureQuotes: z7.array(SignatureQuoteSchema).optional(),
  // Overall Scores
  overallCommunicationScore: z7.number().min(0).max(100),
  confidenceScore: z7.number().min(0).max(1),
  summary: z7.string().optional(),
  // Domain-specific Strengths & Growth Areas
  strengths: z7.array(WorkerStrengthSchema),
  growthAreas: z7.array(WorkerGrowthSchema).optional(),
  referencedInsights: z7.array(ReferencedInsightSchema).optional()
});
var KnowledgeGapItemSchema = z7.object({
  topic: z7.string(),
  description: z7.string(),
  questionCount: z7.number().int().min(1),
  depth: z7.enum(["shallow", "moderate", "deep"]),
  example: z7.string()
});
var LearningProgressSchema = z7.object({
  topic: z7.string(),
  description: z7.string(),
  startLevel: z7.enum(["novice", "shallow", "moderate", "deep", "expert"]),
  currentLevel: z7.enum(["novice", "shallow", "moderate", "deep", "expert"]),
  evidence: z7.string()
});
var ResourceSchema = z7.object({
  topic: z7.string(),
  resourceType: z7.enum(["docs", "tutorial", "course", "article", "video"]),
  url: z7.string()
});
var RepeatedMistakePatternSchema = z7.object({
  category: z7.string(),
  mistakeType: z7.string(),
  description: z7.string(),
  occurrenceCount: z7.number().int().min(2),
  sessionPercentage: z7.number().min(0).max(100).optional(),
  exampleUtteranceIds: z7.array(z7.string()).max(5),
  recommendation: z7.string()
});
var LearningBehaviorOutputSchema = z7.object({
  // Knowledge Gap Dimension
  knowledgeGaps: z7.array(KnowledgeGapItemSchema),
  learningProgress: z7.array(LearningProgressSchema),
  recommendedResources: z7.array(ResourceSchema),
  // Repeated Mistakes Dimension
  repeatedMistakePatterns: z7.array(RepeatedMistakePatternSchema),
  // Insights
  topInsights: z7.array(z7.string()).max(3),
  kptKeep: z7.array(z7.string()).max(2).optional(),
  kptProblem: z7.array(z7.string()).max(2).optional(),
  kptTry: z7.array(z7.string()).max(2).optional(),
  // Overall Scores
  overallLearningScore: z7.number().min(0).max(100),
  confidenceScore: z7.number().min(0).max(1),
  summary: z7.string().optional(),
  // Domain-specific Strengths & Growth Areas
  strengths: z7.array(WorkerStrengthSchema).optional(),
  growthAreas: z7.array(WorkerGrowthSchema).optional(),
  referencedInsights: z7.array(ReferencedInsightSchema).optional()
});
var ContextUsagePatternSchema = z7.object({
  sessionId: z7.string(),
  avgFillPercent: z7.number().min(0).max(100),
  compactTriggerPercent: z7.number().min(0).max(100).optional()
});
var InefficiencyPatternEnum = z7.enum([
  "late_compact",
  "context_bloat",
  "redundant_info",
  "prompt_length_inflation",
  "no_session_separation",
  "verbose_error_pasting",
  "no_knowledge_persistence"
]);
var InefficiencySchema = z7.object({
  pattern: InefficiencyPatternEnum,
  frequency: z7.number().int().min(1),
  impact: z7.enum(["high", "medium", "low"]),
  description: z7.string()
});
var PromptLengthTrendSchema = z7.object({
  phase: z7.enum(["early", "mid", "late"]),
  avgLength: z7.number().int().min(0)
});
var RedundantInfoSchema = z7.object({
  infoType: z7.string(),
  repeatCount: z7.number().int().min(1)
});
var IterationSummarySchema = z7.object({
  sessionId: z7.string(),
  iterationCount: z7.number().int().min(0),
  avgTurnsPerIteration: z7.number().min(0)
});
var ContextEfficiencyOutputSchema = z7.object({
  // Context usage patterns
  contextUsagePatterns: z7.array(ContextUsagePatternSchema),
  inefficiencyPatterns: z7.array(InefficiencySchema),
  promptLengthTrends: z7.array(PromptLengthTrendSchema),
  redundantInfo: z7.array(RedundantInfoSchema),
  // Insights
  topInsights: z7.array(z7.string()).max(3),
  kptKeep: z7.array(z7.string()).max(2).optional(),
  kptProblem: z7.array(z7.string()).max(2).optional(),
  kptTry: z7.array(z7.string()).max(2).optional(),
  // Overall Scores
  overallEfficiencyScore: z7.number().min(0).max(100),
  avgContextFillPercent: z7.number().min(0).max(100),
  confidenceScore: z7.number().min(0).max(1),
  // Domain-specific Strengths & Growth Areas
  strengths: z7.array(WorkerStrengthSchema).optional(),
  growthAreas: z7.array(WorkerGrowthSchema).optional(),
  referencedInsights: z7.array(ReferencedInsightSchema).optional(),
  // Productivity metrics (consolidated from ProductivityAnalyst)
  iterationSummaries: z7.array(IterationSummarySchema).optional(),
  collaborationEfficiencyScore: z7.number().min(0).max(100).optional(),
  overallProductivityScore: z7.number().min(0).max(100).optional(),
  productivitySummary: z7.string().optional()
});
var GoalCategoryEnum = z7.enum([
  "debug_investigate",
  "implement_feature",
  "fix_bug",
  "refactor",
  "write_tests",
  "setup_config",
  "documentation",
  "review_feedback",
  "exploration",
  "quick_question",
  "deploy_infra",
  "dependency_management",
  "performance_optimization",
  "security_audit"
]);
var SessionTypeEnum = z7.enum([
  "single_task",
  "multi_task",
  "iterative_refinement",
  "exploration",
  "quick_question"
]);
var FrictionTypeEnum = z7.enum([
  "misunderstood_request",
  "wrong_approach",
  "buggy_code_generated",
  "user_rejection",
  "blocked_state",
  "tool_failure",
  "context_overflow",
  "hallucination",
  "incomplete_solution",
  "excessive_iterations",
  "permission_error",
  "environment_mismatch"
]);
var OutcomeEnum = z7.enum([
  "fully_achieved",
  "mostly_achieved",
  "partially_achieved",
  "not_achieved",
  "unclear"
]);
var SatisfactionEnum = z7.enum([
  "frustrated",
  "dissatisfied",
  "neutral",
  "satisfied",
  "happy"
]);
var SessionAnalysisSchema = z7.object({
  sessionId: z7.string(),
  primaryGoal: GoalCategoryEnum,
  secondaryGoals: z7.array(GoalCategoryEnum).max(2).optional(),
  sessionType: SessionTypeEnum,
  outcome: OutcomeEnum,
  satisfaction: SatisfactionEnum,
  frictionTypes: z7.array(FrictionTypeEnum).max(3),
  keyMoment: z7.string().optional()
});
var GoalDistributionItemSchema = z7.object({
  goal: GoalCategoryEnum,
  count: z7.number().int().min(1),
  successRate: z7.number().min(0).max(100)
});
var SessionTypeDistributionItemSchema = z7.object({
  type: SessionTypeEnum,
  count: z7.number().int().min(1),
  avgOutcomeScore: z7.number().min(0).max(100)
});
var FrictionSummaryItemSchema = z7.object({
  type: FrictionTypeEnum,
  count: z7.number().int().min(1),
  impactLevel: z7.enum(["high", "medium", "low"]),
  commonCause: z7.string(),
  recommendation: z7.string()
});
var SuccessPatternSchema = z7.object({
  pattern: z7.string(),
  associatedGoals: z7.array(GoalCategoryEnum),
  frequency: z7.number().min(0).max(100)
});
var FailurePatternSchema = z7.object({
  pattern: z7.string(),
  associatedFrictions: z7.array(FrictionTypeEnum),
  frequency: z7.number().min(0).max(100)
});
var SessionOutcomeOutputSchema = z7.object({
  // Per-Session Analysis
  sessionAnalyses: z7.array(SessionAnalysisSchema),
  // Aggregated Statistics
  overallSuccessRate: z7.number().min(0).max(100),
  goalDistribution: z7.array(GoalDistributionItemSchema),
  sessionTypeDistribution: z7.array(SessionTypeDistributionItemSchema),
  frictionSummary: z7.array(FrictionSummaryItemSchema),
  // Pattern Analysis
  successPatterns: z7.array(SuccessPatternSchema),
  failurePatterns: z7.array(FailurePatternSchema),
  // Overall Scores
  overallOutcomeScore: z7.number().min(0).max(100),
  confidenceScore: z7.number().min(0).max(1),
  summary: z7.string().optional(),
  // Domain-specific Strengths & Growth Areas
  strengths: z7.array(WorkerStrengthSchema).optional(),
  growthAreas: z7.array(WorkerGrowthSchema).optional(),
  referencedInsights: z7.array(ReferencedInsightSchema).optional()
});

// ../shared/dist/evaluation/canonical-analysis.js
var DOMAIN_TO_EVALUATION_DIMENSION = {
  thinkingQuality: "aiControl",
  communicationPatterns: "aiCollaboration",
  learningBehavior: "skillResilience",
  contextEfficiency: "contextEngineering",
  sessionOutcome: "burnoutRisk"
};
function normalizeQuote(text) {
  return text.replace(/\s+/g, " ").trim();
}
function buildVerificationKey(utteranceId, quote) {
  return `${utteranceId}::${normalizeQuote(quote)}`;
}
function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function filterEvidence(evidence, verification) {
  if (!verification?.verifiedResults?.length) {
    return evidence;
  }
  const verifiedKeys = new Set(verification.verifiedResults.filter((item) => item.verified).map((item) => buildVerificationKey(item.utteranceId, item.quote)));
  return evidence.filter((item) => {
    if (!item || typeof item === "string") {
      return false;
    }
    return verifiedKeys.has(buildVerificationKey(item.utteranceId, item.quote));
  });
}
function applyEvidenceVerification(domainResults, verification) {
  if (!verification?.verifiedResults?.length) {
    return domainResults;
  }
  return domainResults.map((result) => ({
    ...result,
    strengths: result.strengths.map((strength) => ({
      ...strength,
      evidence: filterEvidence(strength.evidence, verification)
    })).filter((strength) => strength.evidence.length > 0),
    growthAreas: result.growthAreas.map((area) => ({
      ...area,
      evidence: filterEvidence(area.evidence, verification)
    })).filter((area) => area.evidence.length > 0)
  }));
}
function buildSessionSummaryLookup(sessionSummaries) {
  const lookup = /* @__PURE__ */ new Map();
  for (const item of sessionSummaries?.summaries ?? []) {
    lookup.set(item.sessionId, item.summary);
  }
  return lookup;
}
function buildReportActivitySessions(phase1Output, sessionSummaries) {
  const summaryLookup = buildSessionSummaryLookup(sessionSummaries);
  return (phase1Output.activitySessions ?? []).map((session) => ({
    sessionId: session.sessionId,
    projectName: session.projectName,
    startTime: session.startTime,
    durationMinutes: Math.round((session.durationSeconds ?? 0) / 60 * 10) / 10,
    messageCount: session.messageCount,
    summary: summaryLookup.get(session.sessionId) ?? session.firstUserMessage ?? "Session activity",
    ...typeof session.totalInputTokens === "number" ? { totalInputTokens: session.totalInputTokens } : {},
    ...typeof session.totalOutputTokens === "number" ? { totalOutputTokens: session.totalOutputTokens } : {}
  }));
}
function assembleFinalEvaluationEnvelope(args) {
  const evaluation = {
    sessionId: args.sessionId,
    analyzedAt: args.analyzedAt,
    sessionsAnalyzed: args.sessionsAnalyzed,
    avgPromptLength: args.avgPromptLength,
    avgTurnsPerSession: args.avgTurnsPerSession,
    ...args.activitySessions !== void 0 ? { activitySessions: args.activitySessions } : {},
    ...args.sessionSummaries !== void 0 ? { sessionSummaries: args.sessionSummaries } : {},
    ...args.projectSummaries !== void 0 ? { projectSummaries: args.projectSummaries } : {},
    ...args.weeklyInsights !== void 0 ? { weeklyInsights: args.weeklyInsights } : {},
    ...args.assembledSections ?? {},
    ...args.agentOutputs !== void 0 ? { agentOutputs: args.agentOutputs } : {},
    ...args.translatedAgentInsights !== void 0 ? { translatedAgentInsights: args.translatedAgentInsights } : {},
    ...args.knowledgeResources !== void 0 ? { knowledgeResources: args.knowledgeResources } : {},
    ...args.pipelineTokenUsage !== void 0 ? { pipelineTokenUsage: args.pipelineTokenUsage } : {},
    ...args.analysisMetadata !== void 0 ? { analysisMetadata: args.analysisMetadata } : {}
  };
  return evaluation;
}
function toPromptPatternFrequency(value) {
  if (typeof value === "number") {
    if (value >= 0.34)
      return "frequent";
    if (value >= 0.12)
      return "occasional";
    return "rare";
  }
  if (typeof value === "string") {
    if (value === "frequent" || value === "occasional" || value === "rare") {
      return value;
    }
    if (value === "often" || value === "high")
      return "frequent";
    if (value === "sometimes" || value === "medium")
      return "occasional";
  }
  return "occasional";
}
function toPromptPatternEffectiveness(value) {
  if (typeof value === "string") {
    if (value === "highly_effective" || value === "effective" || value === "could_improve") {
      return value;
    }
    if (value === "very_effective" || value === "high")
      return "highly_effective";
    if (value === "medium" || value === "moderate")
      return "effective";
  }
  return "effective";
}
function buildPromptPatterns(domainResults) {
  const communication = domainResults.find((result) => result.domain === "communicationPatterns");
  const rawPatterns = communication?.data && typeof communication.data === "object" ? communication.data.communicationPatterns : void 0;
  if (!Array.isArray(rawPatterns)) {
    return [];
  }
  return rawPatterns.filter((pattern) => !!pattern && typeof pattern === "object").map((pattern, index) => {
    const evidence = Array.isArray(pattern.evidence) ? pattern.evidence : [];
    return {
      patternName: typeof pattern.title === "string" ? pattern.title : typeof pattern.patternId === "string" ? pattern.patternId : `Pattern ${index + 1}`,
      description: typeof pattern.description === "string" ? pattern.description : "",
      frequency: toPromptPatternFrequency(pattern.frequency),
      examples: evidence.filter((item) => !!item && typeof item === "object").map((item) => ({
        quote: typeof item.quote === "string" ? item.quote : "",
        analysis: typeof item.context === "string" ? item.context : "Observed in communication behavior"
      })).filter((item) => item.quote).slice(0, 3),
      effectiveness: toPromptPatternEffectiveness(pattern.effectiveness)
    };
  }).filter((pattern) => typeof pattern.description === "string" && pattern.description.length > 0);
}
function buildTopFocusAreas(contentWriter) {
  if (!contentWriter?.topFocusAreas?.length) {
    return void 0;
  }
  return {
    summary: "Highest-leverage collaboration habits surfaced in this analysis.",
    areas: contentWriter.topFocusAreas.slice(0, 3).map((area, index) => ({
      rank: index + 1,
      dimension: DOMAIN_TO_EVALUATION_DIMENSION[area.relatedQualities[0] ?? ""] ?? "aiCollaboration",
      title: area.title,
      narrative: area.description,
      expectedImpact: `Improves ${area.relatedQualities.join(", ") || "overall collaboration quality"}.`,
      priorityScore: Math.max(100 - index * 10, 70),
      ...area.actions ? { actions: area.actions } : {}
    }))
  };
}
function inferWeekRange(activitySessions, analyzedAt) {
  const end = activitySessions[0]?.startTime ?? analyzedAt;
  const startDate = new Date(end);
  startDate.setDate(startDate.getDate() - 6);
  return {
    start: startDate.toISOString(),
    end
  };
}
function buildWeeklyInsights(weeklyInsights, activitySessions, analyzedAt) {
  if (!weeklyInsights) {
    return void 0;
  }
  const totalMinutes = weeklyInsights.stats.totalMinutes;
  return {
    weekRange: inferWeekRange(activitySessions, analyzedAt),
    stats: {
      totalSessions: weeklyInsights.stats.sessionCount,
      totalMinutes,
      totalTokens: weeklyInsights.stats.totalTokens,
      activeDays: weeklyInsights.stats.activeDays,
      avgSessionMinutes: weeklyInsights.stats.sessionCount > 0 ? Math.round(totalMinutes / weeklyInsights.stats.sessionCount * 10) / 10 : 0
    },
    ...typeof weeklyInsights.stats.deltaSessionCount === "number" || typeof weeklyInsights.stats.deltaMinutes === "number" || typeof weeklyInsights.stats.deltaTokens === "number" ? {
      comparison: {
        sessionsDelta: weeklyInsights.stats.deltaSessionCount ?? 0,
        minutesDelta: weeklyInsights.stats.deltaMinutes ?? 0,
        tokensDelta: weeklyInsights.stats.deltaTokens ?? 0,
        activeDaysDelta: 0
      }
    } : {},
    projects: weeklyInsights.projects.map((project) => ({
      projectName: project.projectName,
      sessionCount: project.sessionCount,
      totalMinutes: Math.round(totalMinutes * project.percentage / 100),
      percentage: project.percentage
    })),
    topProjectSessions: weeklyInsights.topSessions.map((session) => {
      const activity = activitySessions.find((item) => item.sessionId === session.sessionId);
      return {
        summary: session.summary,
        durationMinutes: activity?.durationMinutes ?? 0,
        date: activity?.startTime ? new Date(activity.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""
      };
    }),
    narrative: weeklyInsights.narrative,
    highlights: weeklyInsights.highlights
  };
}
function buildWorkerInsights(domainResults) {
  const workerInsights = {};
  for (const result of domainResults) {
    if (result.domain === "content")
      continue;
    workerInsights[result.domain] = {
      strengths: result.strengths,
      growthAreas: result.growthAreas,
      domainScore: result.overallScore
    };
  }
  return workerInsights;
}
function formatDisplayName(type) {
  return type.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
function mapAntiPatternSeverity(severity) {
  if (severity === "critical" || severity === "significant")
    return "significant";
  if (severity === "mild")
    return "mild";
  return "moderate";
}
function buildAntiPatternsAnalysis(domainResults) {
  const tq = domainResults.find((r) => r.domain === "thinkingQuality");
  const data = tq?.data;
  const antiPatterns = data?.verificationAntiPatterns;
  if (!Array.isArray(antiPatterns) || antiPatterns.length === 0) {
    return void 0;
  }
  const detected = antiPatterns.filter((ap) => isRecord(ap)).map((ap) => {
    const type = String(ap.type ?? "unknown");
    return {
      antiPatternType: type,
      displayName: formatDisplayName(type),
      description: typeof ap.improvement === "string" ? ap.improvement : `Detected ${type.replace(/_/g, " ")} pattern`,
      occurrences: typeof ap.frequency === "number" ? ap.frequency : 1,
      severity: mapAntiPatternSeverity(ap.severity),
      evidence: Array.isArray(ap.examples) ? ap.examples.filter((e) => isRecord(e)).map((e) => typeof e.quote === "string" ? e.quote : "").filter(Boolean) : [],
      growthOpportunity: typeof ap.improvement === "string" ? ap.improvement : `Consider addressing the ${type.replace(/_/g, " ")} pattern`,
      actionableTip: typeof ap.improvement === "string" ? ap.improvement : `Try to be more mindful of ${type.replace(/_/g, " ")} patterns`
    };
  });
  return {
    detected,
    summary: typeof data?.summary === "string" ? data.summary : "Some growth opportunities were identified. These are common learning patterns that every developer experiences.",
    overallHealthScore: tq?.overallScore ?? 80
  };
}
function buildCriticalThinkingAnalysis(domainResults) {
  const tq = domainResults.find((r) => r.domain === "thinkingQuality");
  const data = tq?.data;
  const moments = data?.criticalThinkingMoments;
  if (!Array.isArray(moments) || moments.length === 0) {
    return void 0;
  }
  const strengths = moments.filter((ct) => isRecord(ct)).map((ct) => ({
    indicatorType: typeof ct.type === "string" ? ct.type : "unknown",
    displayName: formatDisplayName(typeof ct.type === "string" ? ct.type : "unknown"),
    description: typeof ct.result === "string" ? ct.result : `Demonstrated ${String(ct.type ?? "critical thinking").replace(/_/g, " ")}`,
    frequency: 1,
    quality: "intermediate",
    evidence: typeof ct.quote === "string" ? [ct.quote] : []
  }));
  const uniqueTypes = new Set(moments.filter((ct) => isRecord(ct)).map((ct) => ct.type));
  const overallScore = Math.min(100, 40 + uniqueTypes.size * 10 + moments.length * 5);
  return {
    strengths,
    opportunities: [],
    summary: typeof data?.summary === "string" ? data.summary : "Shows signs of critical evaluation when working with AI-generated content.",
    overallScore
  };
}
function buildPlanningAnalysis(domainResults) {
  const tq = domainResults.find((r) => r.domain === "thinkingQuality");
  const data = tq?.data;
  const habits = data?.planningHabits;
  if (!Array.isArray(habits) || habits.length === 0) {
    return void 0;
  }
  const hasSlashPlan = habits.some((h) => isRecord(h) && h.type === "uses_plan_command");
  const hasTodoWrite = habits.some((h) => isRecord(h) && h.type === "todowrite_usage");
  const hasTaskDecomp = habits.some((h) => isRecord(h) && h.type === "task_decomposition");
  const maturityLevel = hasSlashPlan && hasTaskDecomp ? "expert" : hasSlashPlan ? "structured" : hasTodoWrite || hasTaskDecomp ? "emerging" : "reactive";
  const strengths = [];
  const opportunities = [];
  for (const habit of habits) {
    if (!isRecord(habit))
      continue;
    const type = typeof habit.type === "string" ? habit.type : "unknown";
    const frequency = typeof habit.frequency === "string" ? habit.frequency : "sometimes";
    const effectiveness = typeof habit.effectiveness === "string" ? habit.effectiveness : "medium";
    const insight = {
      behaviorType: type,
      displayName: formatDisplayName(type),
      description: `Planning habit "${type.replace(/_/g, " ")}" observed with ${frequency} frequency`,
      frequency: frequency === "always" || frequency === "often" ? 3 : frequency === "sometimes" ? 2 : 1,
      sophistication: effectiveness === "high" ? "advanced" : effectiveness === "medium" ? "intermediate" : "basic",
      evidence: Array.isArray(habit.examples) ? habit.examples : []
    };
    const isStrength = effectiveness === "high" || frequency === "always" || frequency === "often";
    if (isStrength) {
      strengths.push(insight);
    } else {
      opportunities.push(insight);
    }
  }
  return {
    strengths,
    opportunities,
    summary: typeof data?.summary === "string" ? data.summary : "Shows planning awareness in development workflow.",
    planningMaturityLevel: maturityLevel
  };
}
function normalizeInefficiencyPattern(value) {
  if (value === "late_compact" || value === "context_bloat" || value === "redundant_info" || value === "prompt_length_inflation" || value === "no_session_separation" || value === "verbose_error_pasting" || value === "no_knowledge_persistence") {
    return value;
  }
  if (value === "stale_context" || value === "context_spillover") {
    return "context_bloat";
  }
  return "context_bloat";
}
function buildAgentOutputs(phase1Output, domainResults) {
  const contextEfficiency = domainResults.find((result) => result.domain === "contextEfficiency");
  const patterns = contextEfficiency?.data && typeof contextEfficiency.data === "object" ? contextEfficiency.data.inefficiencyPatterns : void 0;
  if (!contextEfficiency) {
    return void 0;
  }
  const mappedPatterns = Array.isArray(patterns) ? patterns.filter((pattern) => isRecord(pattern)).map((pattern) => ({
    pattern: normalizeInefficiencyPattern(pattern.type ?? pattern.pattern),
    frequency: typeof pattern.frequency === "number" ? Math.max(1, Math.round(pattern.frequency)) : 1,
    impact: pattern.impact === "high" || pattern.impact === "low" ? pattern.impact : "medium",
    description: typeof pattern.description === "string" ? pattern.description : `Observed ${String(pattern.type ?? pattern.pattern ?? "context issue")} behavior with ${String(pattern.impact ?? "medium")} impact.`
  })) : [];
  return {
    efficiency: {
      contextUsagePatterns: [],
      inefficiencyPatterns: mappedPatterns,
      promptLengthTrends: [],
      redundantInfo: [],
      topInsights: [],
      overallEfficiencyScore: contextEfficiency.overallScore,
      avgContextFillPercent: phase1Output.sessionMetrics.avgContextFillPercent ?? 0,
      confidenceScore: contextEfficiency.confidenceScore,
      strengths: contextEfficiency.strengths,
      growthAreas: contextEfficiency.growthAreas
    }
  };
}
function mergePromptPatternTranslations(evaluation, translatedFields) {
  if (!Array.isArray(translatedFields.promptPatterns) || !Array.isArray(evaluation.promptPatterns)) {
    return;
  }
  const translatedPatterns = translatedFields.promptPatterns;
  const englishPatterns = evaluation.promptPatterns;
  const minLength = Math.min(translatedPatterns.length, englishPatterns.length);
  for (let i = 0; i < minLength; i += 1) {
    const translated = translatedPatterns[i];
    const english = englishPatterns[i];
    if (typeof translated.patternName === "string")
      english.patternName = translated.patternName;
    if (typeof translated.description === "string")
      english.description = translated.description;
    if (typeof translated.tip === "string")
      english.tip = translated.tip;
    if (!Array.isArray(translated.examples) || !Array.isArray(english.examples)) {
      continue;
    }
    const translatedExamples = translated.examples;
    const englishExamples = english.examples;
    const exampleCount = Math.min(translatedExamples.length, englishExamples.length);
    for (let j = 0; j < exampleCount; j += 1) {
      if (typeof translatedExamples[j]?.analysis === "string") {
        englishExamples[j].analysis = translatedExamples[j].analysis;
      }
    }
  }
}
function mergeTopFocusAreaTranslations(evaluation, translatedFields) {
  if (!isRecord(translatedFields.topFocusAreas) || !isRecord(evaluation.topFocusAreas)) {
    return;
  }
  const translated = translatedFields.topFocusAreas;
  const english = evaluation.topFocusAreas;
  if (typeof translated.summary === "string") {
    english.summary = translated.summary;
  }
  if (!Array.isArray(translated.areas) || !Array.isArray(english.areas)) {
    return;
  }
  const englishAreas = english.areas;
  for (const translatedArea of translated.areas) {
    const rank = typeof translatedArea.rank === "number" ? translatedArea.rank : null;
    const englishArea = rank === null ? void 0 : englishAreas.find((area) => area.rank === rank);
    if (!englishArea)
      continue;
    if (typeof translatedArea.title === "string")
      englishArea.title = translatedArea.title;
    if (typeof translatedArea.narrative === "string")
      englishArea.narrative = translatedArea.narrative;
    if (typeof translatedArea.expectedImpact === "string") {
      englishArea.expectedImpact = translatedArea.expectedImpact;
    }
    if (!isRecord(translatedArea.actions) || !isRecord(englishArea.actions)) {
      continue;
    }
    englishArea.actions = {
      start: typeof translatedArea.actions.start === "string" ? translatedArea.actions.start : "",
      stop: typeof translatedArea.actions.stop === "string" ? translatedArea.actions.stop : "",
      continue: typeof translatedArea.actions.continue === "string" ? translatedArea.actions.continue : ""
    };
  }
}
function mergeProjectSummaryTranslations(evaluation, translatedFields) {
  if (!Array.isArray(translatedFields.projectSummaries) || !Array.isArray(evaluation.projectSummaries)) {
    return;
  }
  const englishProjects = evaluation.projectSummaries;
  for (const translatedProject of translatedFields.projectSummaries) {
    const projectName = typeof translatedProject.projectName === "string" ? translatedProject.projectName : null;
    const englishProject = projectName ? englishProjects.find((project) => project.projectName === projectName) : void 0;
    if (!englishProject || !Array.isArray(translatedProject.summaryLines)) {
      continue;
    }
    englishProject.summaryLines = translatedProject.summaryLines;
  }
}
function mergeWeeklyInsightTranslations(evaluation, translatedFields) {
  if (!isRecord(translatedFields.weeklyInsights) || !isRecord(evaluation.weeklyInsights)) {
    return;
  }
  const translated = translatedFields.weeklyInsights;
  const english = evaluation.weeklyInsights;
  if (typeof translated.narrative === "string") {
    english.narrative = translated.narrative;
  }
  if (Array.isArray(translated.highlights)) {
    english.highlights = translated.highlights;
  }
  if (!Array.isArray(translated.topSessionSummaries) || !Array.isArray(english.topProjectSessions)) {
    return;
  }
  const englishTopSessions = english.topProjectSessions;
  const sessionCount = Math.min(translated.topSessionSummaries.length, englishTopSessions.length);
  for (let i = 0; i < sessionCount; i += 1) {
    if (typeof translated.topSessionSummaries[i] === "string") {
      englishTopSessions[i].summary = translated.topSessionSummaries[i];
    }
  }
}
function mergeTranslatedAgentInsights(evaluation, translatedFields) {
  if (!isRecord(translatedFields.translatedAgentInsights)) {
    return;
  }
  evaluation.translatedAgentInsights = translatedFields.translatedAgentInsights;
}
function mergeTranslatedEvaluationFields(evaluation, translatedFields, targetLanguage) {
  const cjkLanguages = /* @__PURE__ */ new Set(["ko", "ja", "zh"]);
  const minLengthRatio = targetLanguage && cjkLanguages.has(targetLanguage) ? 0.45 : 0.65;
  if (typeof translatedFields.personalitySummary === "string") {
    const englishSummary = typeof evaluation.personalitySummary === "string" ? evaluation.personalitySummary : "";
    const translatedSummary = translatedFields.personalitySummary;
    const ratio = englishSummary.length > 0 ? translatedSummary.length / englishSummary.length : 1;
    if (englishSummary.length === 0 || ratio >= minLengthRatio) {
      evaluation.personalitySummary = translatedSummary;
    }
  }
  mergeTranslatedAgentInsights(evaluation, translatedFields);
  mergeProjectSummaryTranslations(evaluation, translatedFields);
  mergeWeeklyInsightTranslations(evaluation, translatedFields);
  mergePromptPatternTranslations(evaluation, translatedFields);
  mergeTopFocusAreaTranslations(evaluation, translatedFields);
}
function mergeTranslation(evaluation, translator) {
  if (!translator?.translatedFields || typeof translator.translatedFields !== "object") {
    return;
  }
  mergeTranslatedEvaluationFields(evaluation, translator.translatedFields, translator.targetLanguage);
}
function buildCanonicalEvaluation(args) {
  const { analyzedAt, phase1Output, activitySessions, deterministicScores, typeResult, domainResults, stageOutputs } = args;
  const filteredDomainResults = applyEvidenceVerification(domainResults, stageOutputs.evidenceVerification);
  const confidenceScores = filteredDomainResults.map((result) => result.confidenceScore).filter((score) => typeof score === "number");
  const overallConfidence = confidenceScores.length > 0 ? Math.round(confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length * 100) / 100 : 0;
  const filteredEvidenceCount = stageOutputs.evidenceVerification?.domainStats?.reduce((sum, stat2) => sum + stat2.filteredCount, 0) ?? 0;
  const dataQuality = phase1Output.sessionMetrics.totalSessions >= 10 ? "high" : phase1Output.sessionMetrics.totalSessions >= 5 ? "medium" : "low";
  const agentOutputs = buildAgentOutputs(phase1Output, filteredDomainResults);
  const antiPatterns = buildAntiPatternsAnalysis(filteredDomainResults);
  const criticalThinking = buildCriticalThinkingAnalysis(filteredDomainResults);
  const planning = buildPlanningAnalysis(filteredDomainResults);
  const evaluation = assembleFinalEvaluationEnvelope({
    sessionId: activitySessions[0]?.sessionId ?? phase1Output.activitySessions?.[0]?.sessionId ?? "plugin-local-analysis",
    analyzedAt,
    sessionsAnalyzed: phase1Output.sessionMetrics.totalSessions,
    avgPromptLength: Math.round(phase1Output.sessionMetrics.avgDeveloperMessageLength),
    avgTurnsPerSession: Math.round(phase1Output.sessionMetrics.avgMessagesPerSession * 10) / 10,
    activitySessions,
    sessionSummaries: stageOutputs.sessionSummaries?.summaries,
    projectSummaries: stageOutputs.projectSummaries?.projects,
    weeklyInsights: buildWeeklyInsights(stageOutputs.weeklyInsights, activitySessions, analyzedAt),
    assembledSections: {
      primaryType: typeResult?.primaryType ?? "analyst",
      controlLevel: typeResult?.controlLevel ?? "navigator",
      ...typeof typeResult?.controlScore === "number" ? { controlScore: typeResult.controlScore } : {},
      distribution: typeResult?.distribution ?? {
        architect: 20,
        analyst: 20,
        conductor: 20,
        speedrunner: 20,
        trendsetter: 20
      },
      personalitySummary: stageOutputs.typeClassification?.personalityNarrative?.join("\n\n") ?? stageOutputs.typeClassification?.reasoning?.join("\n\n") ?? "",
      promptPatterns: buildPromptPatterns(filteredDomainResults),
      topFocusAreas: buildTopFocusAreas(stageOutputs.contentWriter),
      workerInsights: buildWorkerInsights(filteredDomainResults),
      // Structured sub-analyses from thinkingQuality domain data (Fix 4)
      ...antiPatterns ? { antiPatternsAnalysis: antiPatterns } : {},
      ...criticalThinking ? { criticalThinkingAnalysis: criticalThinking } : {},
      ...planning ? { planningAnalysis: planning } : {}
    },
    agentOutputs,
    pipelineTokenUsage: {
      stages: [],
      totals: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
      model: "plugin-local",
      modelName: "plugin-local"
    },
    analysisMetadata: {
      overallConfidence,
      totalMessagesAnalyzed: phase1Output.sessionMetrics.totalMessages,
      dataQuality,
      analysisDateRange: phase1Output.sessionMetrics.dateRange,
      confidenceThreshold: stageOutputs.evidenceVerification ? 0.5 : void 0,
      insightsFiltered: filteredEvidenceCount,
      deterministicScores,
      evidenceVerification: stageOutputs.evidenceVerification ? {
        threshold: stageOutputs.evidenceVerification.threshold,
        domainStats: stageOutputs.evidenceVerification.domainStats
      } : void 0
    }
  });
  mergeTranslation(evaluation, stageOutputs.translator);
  return evaluation;
}
function assembleCanonicalAnalysisRun(args) {
  const activitySessions = buildReportActivitySessions(args.phase1Output, args.stageOutputs.sessionSummaries);
  const evaluation = buildCanonicalEvaluation({
    analyzedAt: args.analyzedAt,
    phase1Output: args.phase1Output,
    activitySessions,
    deterministicScores: args.deterministicScores,
    typeResult: args.typeResult,
    domainResults: args.domainResults,
    stageOutputs: args.stageOutputs
  });
  return {
    runId: args.runId,
    analyzedAt: args.analyzedAt,
    phase1Output: args.phase1Output,
    activitySessions,
    deterministicScores: args.deterministicScores,
    typeResult: args.typeResult,
    domainResults: applyEvidenceVerification(args.domainResults, args.stageOutputs.evidenceVerification),
    stageOutputs: args.stageOutputs,
    evaluation,
    ...args.stageOutputs.translator ? { translation: args.stageOutputs.translator } : {}
  };
}

// ../shared/dist/scoring/deterministic-scorer.js
function clampScore(value, min = 0, max = 100) {
  return Math.round(Math.max(min, Math.min(max, value)));
}
function invertedScale(value) {
  return 100 - Math.max(0, Math.min(100, value));
}
function bellCurveScore(value, optimalLow, optimalHigh, falloffRate = 0.01) {
  if (value >= optimalLow && value <= optimalHigh)
    return 100;
  const distance = value < optimalLow ? optimalLow - value : value - optimalHigh;
  return 100 * Math.exp(-falloffRate * distance * distance);
}
function coefficientOfVariation(values) {
  if (values.length === 0)
    return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (mean === 0)
    return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}
function scoreContextEfficiency(metrics) {
  const avgFill = metrics.avgContextFillPercent ?? 50;
  const totalSessions = Math.max(metrics.totalSessions, 1);
  const baseScore = invertedScale(avgFill);
  const overflowCount = metrics.contextFillExceeded90Count ?? 0;
  const overflowRatio = overflowCount / totalSessions;
  const overflowPenalty = overflowRatio * 30;
  const slashCmds = metrics.slashCommandCounts ?? {};
  const compactCount = (slashCmds["compact"] ?? 0) + (slashCmds["clear"] ?? 0);
  const compactionBonus = compactCount > 0 ? Math.min(compactCount * 3, 15) : 0;
  const longSessionRatio = (metrics.sessionHints?.longSessions ?? 0) / totalSessions;
  const longSessionPenalty = longSessionRatio * 10;
  return clampScore(baseScore - overflowPenalty + compactionBonus - longSessionPenalty);
}
function scoreSessionOutcome(metrics) {
  const totalSessions = Math.max(metrics.totalSessions, 1);
  const friction = metrics.frictionSignals;
  const toolFailures = friction?.toolFailureCount ?? 0;
  const rejections = friction?.userRejectionSignals ?? 0;
  const excessiveIterations = friction?.excessiveIterationSessions ?? 0;
  const contextOverflows = friction?.contextOverflowSessions ?? 0;
  const frustrationExpressions = friction?.frustrationExpressionCount ?? 0;
  const totalFriction = toolFailures + rejections + excessiveIterations + contextOverflows + frustrationExpressions;
  const frictionDensity = totalFriction / totalSessions;
  const baseScore = 85 * Math.exp(-0.3 * frictionDensity);
  const mediumSessions = metrics.sessionHints?.mediumSessions ?? 0;
  const mediumRatio = mediumSessions / totalSessions;
  const balanceBonus = mediumRatio * 15;
  const excessiveRatio = excessiveIterations / totalSessions;
  const excessivePenalty = excessiveRatio * 10;
  return clampScore(baseScore + balanceBonus - excessivePenalty);
}
function scoreThinkingQuality(metrics) {
  const slashCmds = metrics.slashCommandCounts ?? {};
  const planCount = slashCmds["plan"] ?? 0;
  const reviewCount = slashCmds["review"] ?? 0;
  const planningActivityCount = planCount + reviewCount;
  const planningScore = planningActivityCount > 0 ? 30 + 55 * (1 - Math.exp(-0.4 * planningActivityCount)) : 30;
  const questionRatio = metrics.questionRatio;
  const criticalThinkingFromQuestions = bellCurveScore(questionRatio * 100, 15, 40, 3e-3);
  const rejectionRate = (metrics.frictionSignals?.userRejectionSignals ?? 0) / Math.max(metrics.totalDeveloperUtterances, 1);
  const criticalThinkingFromRejections = bellCurveScore(rejectionRate * 100, 2, 10, 5e-3);
  const criticalThinkingScore = criticalThinkingFromQuestions * 0.6 + criticalThinkingFromRejections * 0.4;
  const toolFailureRate = (metrics.frictionSignals?.toolFailureCount ?? 0) / Math.max(metrics.totalMessages, 1);
  let errorRecoveryScore = 80 * Math.exp(-8 * toolFailureRate) + 20;
  const errorChainMax = metrics.frictionSignals?.errorChainMaxLength ?? 0;
  if (errorChainMax >= 3) {
    const chainPenalty = Math.min((errorChainMax - 2) * 5, 30);
    errorRecoveryScore = Math.max(0, errorRecoveryScore - chainPenalty);
  }
  return clampScore(planningScore * 0.4 + criticalThinkingScore * 0.3 + errorRecoveryScore * 0.3);
}
function scoreLearningBehavior(metrics) {
  const totalSessions = Math.max(metrics.totalSessions, 1);
  const totalUtterances = Math.max(metrics.totalDeveloperUtterances, 1);
  const questionScore = Math.min(metrics.questionRatio * 200, 100);
  const insightCount = metrics.aiInsightBlockCount ?? 0;
  const insightEngagement = insightCount > 0 ? 40 + 50 * (1 - Math.exp(-0.1 * insightCount)) : 40;
  const learningIntentScore = questionScore * 0.6 + insightEngagement * 0.4;
  const excessiveIterationRate = (metrics.frictionSignals?.excessiveIterationSessions ?? 0) / totalSessions;
  const bareRetryRate = (metrics.frictionSignals?.bareRetryAfterErrorCount ?? 0) / totalUtterances;
  const combinedMistakeRate = excessiveIterationRate + bareRetryRate;
  const mistakeScore = invertedScale(combinedMistakeRate * 100) * 0.8 + 20;
  const codeExperimentation = Math.min(metrics.codeBlockRatio * 150, 100);
  const slashCmds = metrics.slashCommandCounts ?? {};
  const uniqueCommands = Object.keys(slashCmds).length;
  const diversityBonus = Math.min(uniqueCommands * 8, 40);
  const experimentationScore = codeExperimentation * 0.6 + diversityBonus * 0.4 + 20;
  return clampScore(learningIntentScore * 0.5 + mistakeScore * 0.3 + experimentationScore * 0.2);
}
function scoreCommunicationPatterns(metrics, phase1Output) {
  const avgLen = metrics.avgDeveloperMessageLength;
  const promptQualityScore = bellCurveScore(avgLen, 200, 500, 3e-5);
  const codeStructure = Math.min(metrics.codeBlockRatio * 200, 100);
  const questionStructure = Math.min(metrics.questionRatio * 250, 100);
  const structureScore = codeStructure * 0.5 + questionStructure * 0.5;
  const wordCounts = phase1Output.developerUtterances.map((u) => u.wordCount);
  const cv = coefficientOfVariation(wordCounts);
  const consistencyScore = 100 * Math.exp(-0.3 * cv);
  return clampScore(promptQualityScore * 0.4 + structureScore * 0.3 + consistencyScore * 0.3);
}
function scoreControl(metrics) {
  const totalUtterances = Math.max(metrics.totalDeveloperUtterances, 1);
  const rejectionRate = (metrics.frictionSignals?.userRejectionSignals ?? 0) / totalUtterances;
  const rejectionSignal = Math.min(rejectionRate * 500, 100);
  const questionSignal = Math.min(metrics.questionRatio * 200, 100);
  const avgLen = metrics.avgDeveloperMessageLength;
  const lengthSignal = Math.min(avgLen / 5, 100);
  const slashCmds = metrics.slashCommandCounts ?? {};
  const uniqueCommands = Object.keys(slashCmds).length;
  const totalCommands = Object.values(slashCmds).reduce((sum, c) => sum + c, 0);
  const commandSignal = Math.min(uniqueCommands * 10 + totalCommands * 2, 100);
  return clampScore(rejectionSignal * 0.25 + questionSignal * 0.25 + lengthSignal * 0.25 + commandSignal * 0.25);
}
function computeDeterministicScores(phase1Output) {
  const metrics = phase1Output.sessionMetrics;
  return {
    contextEfficiency: scoreContextEfficiency(metrics),
    sessionOutcome: scoreSessionOutcome(metrics),
    thinkingQuality: scoreThinkingQuality(metrics),
    learningBehavior: scoreLearningBehavior(metrics),
    communicationPatterns: scoreCommunicationPatterns(metrics, phase1Output),
    controlScore: scoreControl(metrics)
  };
}

// ../shared/dist/constants.js
var CONTEXT_WINDOW_SIZE = 2e5;
var MATRIX_NAMES = {
  architect: {
    explorer: "Visionary",
    navigator: "Strategist",
    cartographer: "Systems Architect"
  },
  analyst: {
    explorer: "Questioner",
    navigator: "Research Lead",
    cartographer: "Quality Sentinel"
  },
  conductor: {
    explorer: "Improviser",
    navigator: "Arranger",
    cartographer: "Maestro"
  },
  speedrunner: {
    explorer: "Experimenter",
    navigator: "Rapid Prototyper",
    cartographer: "Velocity Expert"
  },
  trendsetter: {
    explorer: "Early Adopter",
    navigator: "Tech Radar",
    cartographer: "Innovation Lead"
  }
};
var MATRIX_METADATA = {
  architect: {
    explorer: { emoji: "\u{1F4AD}" },
    navigator: { emoji: "\u{1F4D0}" },
    cartographer: { emoji: "\u{1F3DB}\uFE0F" }
  },
  analyst: {
    explorer: { emoji: "\u{1F50E}" },
    navigator: { emoji: "\u{1F9EA}" },
    cartographer: { emoji: "\u{1F52C}" }
  },
  conductor: {
    explorer: { emoji: "\u{1F3B5}" },
    navigator: { emoji: "\u{1F3BC}" },
    cartographer: { emoji: "\u{1F3B9}" }
  },
  speedrunner: {
    explorer: { emoji: "\u{1F3B2}" },
    navigator: { emoji: "\u{1F3C3}" },
    cartographer: { emoji: "\u26A1" }
  },
  trendsetter: {
    explorer: { emoji: "\u{1F331}" },
    navigator: { emoji: "\u{1F4E1}" },
    cartographer: { emoji: "\u{1F680}" }
  }
};

// ../shared/dist/scoring/deterministic-type-mapper.js
var TREND_KEYWORDS_KO = ["\uCD5C\uC2E0", "\uD2B8\uB80C\uB4DC", "\uC720\uD589", "\uC0C8\uB85C\uC6B4", "\uC5C5\uB370\uC774\uD2B8\uB41C", "\uC694\uC998"];
var TREND_KEYWORDS_EN = ["latest", "newest", "trending", "modern", "up-to-date", "best practice", "current version", "recently released"];
var ALL_TREND_KEYWORDS = [...TREND_KEYWORDS_KO, ...TREND_KEYWORDS_EN];
function computeTrendDensity(phase1Output) {
  const utterances = phase1Output.developerUtterances;
  if (utterances.length === 0)
    return 0;
  let totalMatches = 0;
  for (const utterance of utterances) {
    const text = (utterance.displayText || utterance.text).toLowerCase();
    for (const keyword of ALL_TREND_KEYWORDS) {
      const regex = new RegExp(keyword.toLowerCase(), "g");
      const matches = text.match(regex);
      if (matches)
        totalMatches += matches.length;
    }
  }
  return totalMatches / utterances.length * 100;
}
var STYLE_TYPES = ["architect", "analyst", "conductor", "speedrunner", "trendsetter"];
function computeAffinities(scores, metrics, trendDensity) {
  const slashCmds = metrics.slashCommandCounts ?? {};
  const planCount = (slashCmds["plan"] ?? 0) + (slashCmds["review"] ?? 0);
  const planBonus = planCount > 0 ? Math.min(planCount * 8, 30) : 0;
  const architectAffinity = scores.thinkingQuality * 0.5 + scores.controlScore * 0.3 + planBonus;
  const analystAffinity = scores.thinkingQuality * 0.3 + scores.learningBehavior * 0.4 + scores.sessionOutcome * 0.2 + (metrics.questionRatio > 0.2 ? 10 : 0);
  const uniqueCommands = Object.keys(slashCmds).length;
  const totalCommands = Object.values(slashCmds).reduce((sum, c) => sum + c, 0);
  const orchestrationCmds = (slashCmds["sisyphus"] ?? 0) + (slashCmds["orchestrator"] ?? 0) + (slashCmds["ultrawork"] ?? 0) + (slashCmds["ralph-loop"] ?? 0);
  const commandDiversityScore = Math.min(uniqueCommands * 12, 60);
  const commandVolumeScore = Math.min(totalCommands * 2, 30);
  const orchestrationBonus = orchestrationCmds > 0 ? Math.min(orchestrationCmds * 10, 30) : 0;
  const conductorAffinity = commandDiversityScore + commandVolumeScore + orchestrationBonus;
  const avgLen = metrics.avgDeveloperMessageLength;
  const concisenessScore = avgLen < 200 ? 40 : avgLen < 400 ? 25 : 10;
  const speedrunnerAffinity = scores.contextEfficiency * 0.5 + concisenessScore + (scores.sessionOutcome > 70 ? 15 : 0);
  const trendKeywordScore = trendDensity > 3 ? Math.min(trendDensity * 15, 60) : trendDensity * 5;
  const learningCuriosityBonus = scores.learningBehavior > 70 ? 15 : 0;
  const trendsetterAffinity = trendKeywordScore + learningCuriosityBonus;
  return {
    architect: architectAffinity,
    analyst: analystAffinity,
    conductor: conductorAffinity,
    speedrunner: speedrunnerAffinity,
    trendsetter: trendsetterAffinity
  };
}
function normalizeToDistribution(affinities) {
  const MIN_PERCENT = 5;
  const totalAffinity = STYLE_TYPES.reduce((sum2, t) => sum2 + Math.max(affinities[t], 0), 0);
  if (totalAffinity === 0) {
    return { architect: 20, analyst: 20, conductor: 20, speedrunner: 20, trendsetter: 20 };
  }
  const raw = {};
  for (const type of STYLE_TYPES) {
    raw[type] = Math.max(affinities[type] / totalAffinity * 100, 0);
  }
  let totalBelow = 0;
  let totalAbove = 0;
  const aboveTypes = [];
  for (const type of STYLE_TYPES) {
    if (raw[type] < MIN_PERCENT) {
      totalBelow += MIN_PERCENT - raw[type];
      raw[type] = MIN_PERCENT;
    } else {
      totalAbove += raw[type];
      aboveTypes.push(type);
    }
  }
  if (totalBelow > 0 && totalAbove > 0) {
    for (const type of aboveTypes) {
      raw[type] -= totalBelow * (raw[type] / totalAbove);
    }
  }
  const result = {};
  let sum = 0;
  for (const type of STYLE_TYPES) {
    result[type] = Math.round(raw[type]);
    sum += result[type];
  }
  if (sum !== 100) {
    const maxType = STYLE_TYPES.reduce((a, b) => result[a] >= result[b] ? a : b);
    result[maxType] += 100 - sum;
  }
  return result;
}
function controlLevelFromScore(score) {
  if (score <= 34)
    return "explorer";
  if (score <= 64)
    return "navigator";
  return "cartographer";
}
function computeDeterministicType(scores, phase1Output) {
  const metrics = phase1Output.sessionMetrics;
  const trendDensity = computeTrendDensity(phase1Output);
  const affinities = computeAffinities(scores, metrics, trendDensity);
  const distribution = normalizeToDistribution(affinities);
  const primaryType = STYLE_TYPES.reduce((a, b) => affinities[a] >= affinities[b] ? a : b);
  const controlLevel = controlLevelFromScore(scores.controlScore);
  const matrixName = MATRIX_NAMES[primaryType][controlLevel];
  const matrixEmoji = MATRIX_METADATA[primaryType][controlLevel].emoji;
  return {
    primaryType,
    distribution,
    controlLevel,
    controlScore: scores.controlScore,
    matrixName,
    matrixEmoji
  };
}

// lib/core/types.ts
var TextBlockSchema = z8.object({
  type: z8.literal("text"),
  text: z8.string()
});
var ToolUseBlockSchema = z8.object({
  type: z8.literal("tool_use"),
  id: z8.string(),
  name: z8.string(),
  input: z8.record(z8.string(), z8.unknown())
});
var ToolResultBlockSchema = z8.object({
  type: z8.literal("tool_result"),
  tool_use_id: z8.string(),
  content: z8.union([z8.string(), z8.array(z8.unknown())]),
  is_error: z8.boolean().optional()
});
var ContentBlockSchema = z8.union([
  TextBlockSchema,
  ToolUseBlockSchema,
  ToolResultBlockSchema
]);
var TokenUsageSchema = z8.object({
  input_tokens: z8.number(),
  output_tokens: z8.number(),
  cache_creation_input_tokens: z8.number().optional(),
  cache_read_input_tokens: z8.number().optional(),
  cache_creation: z8.object({
    ephemeral_5m_input_tokens: z8.number(),
    ephemeral_1h_input_tokens: z8.number()
  }).optional(),
  service_tier: z8.string().optional()
});
var UserMessageSchema = z8.object({
  type: z8.literal("user"),
  sessionId: z8.string(),
  timestamp: z8.string(),
  uuid: z8.string(),
  parentUuid: z8.string().nullable(),
  cwd: z8.string().optional(),
  version: z8.string().optional(),
  gitBranch: z8.string().optional(),
  userType: z8.string().optional(),
  isSidechain: z8.boolean().optional(),
  message: z8.object({
    role: z8.literal("user"),
    content: z8.union([z8.string(), z8.array(ContentBlockSchema)])
  })
});
var AssistantMessageSchema = z8.object({
  type: z8.literal("assistant"),
  sessionId: z8.string(),
  timestamp: z8.string(),
  uuid: z8.string(),
  parentUuid: z8.string().nullable(),
  isSidechain: z8.boolean().optional(),
  message: z8.object({
    id: z8.string().optional(),
    role: z8.literal("assistant"),
    content: z8.array(ContentBlockSchema),
    model: z8.string().optional(),
    stop_reason: z8.string().optional(),
    usage: TokenUsageSchema.optional()
  })
});
var JSONLLineSchema = z8.discriminatedUnion("type", [
  UserMessageSchema,
  AssistantMessageSchema,
  // Queue operations and file history are parsed but not analyzed
  z8.object({ type: z8.literal("queue-operation"), timestamp: z8.string() }).passthrough(),
  z8.object({ type: z8.literal("file-history-snapshot"), timestamp: z8.string() }).passthrough()
]);

// lib/core/session-scanner.ts
function getPluginDataDir() {
  return join(homedir(), ".betterprompt");
}
function getScanCacheDir() {
  return join(getPluginDataDir(), "scan-cache");
}

// lib/config.ts
var DEFAULTS = {
  serverUrl: "http://localhost:3000",
  autoAnalyze: true,
  analyzeThreshold: 5
};
var cachedConfig = null;
function getConfig() {
  if (cachedConfig) return cachedConfig;
  cachedConfig = {
    serverUrl: (process.env.BETTERPROMPT_SERVER_URL ?? DEFAULTS.serverUrl).replace(/\/$/, ""),
    autoAnalyze: process.env.BETTERPROMPT_AUTO_ANALYZE !== "false",
    analyzeThreshold: Number.parseInt(
      process.env.BETTERPROMPT_ANALYZE_THRESHOLD ?? "",
      10
    ) || DEFAULTS.analyzeThreshold
  };
  return cachedConfig;
}
function getPluginDataDir2() {
  return getPluginDataDir();
}
function getStateFilePath() {
  return join2(getPluginDataDir2(), "plugin-state.json");
}
function getCacheDbPath() {
  return join2(getPluginDataDir2(), "insight-cache.db");
}

// lib/debounce.ts
import Database from "better-sqlite3";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join as join3 } from "path";
import { homedir as homedir2, platform } from "os";
import { dirname } from "path";
var COOLDOWN_MS = 4 * 60 * 60 * 1e3;
var MIN_SESSION_DURATION_MS = 3 * 60 * 1e3;
var MAX_RUNNING_STATE_AGE_MS = 30 * 60 * 1e3;
var DEFAULT_STATE = {
  lastAnalysisTimestamp: null,
  lastAnalysisSessionCount: 0,
  analysisState: "idle",
  analysisInProgress: false,
  analysisPending: false,
  pendingSince: null,
  lastError: null,
  stateUpdatedAt: null
};
function normalizeState(state) {
  let analysisState = state.analysisState;
  if (!analysisState) {
    if (state.analysisInProgress) analysisState = "running";
    else if (state.analysisPending) analysisState = "pending";
    else analysisState = "idle";
  }
  return {
    ...state,
    analysisState,
    analysisInProgress: analysisState === "running",
    analysisPending: analysisState === "pending"
  };
}
function readState() {
  try {
    const raw = readFileSync(getStateFilePath(), "utf-8");
    return normalizeState({ ...DEFAULT_STATE, ...JSON.parse(raw) });
  } catch {
    return { ...DEFAULT_STATE };
  }
}
function writeState(state) {
  const filePath = getStateFilePath();
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    JSON.stringify(
      normalizeState({
        ...state,
        stateUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }),
      null,
      2
    )
  );
}
function countClaudeSessions() {
  const projectsDir = join3(homedir2(), ".claude", "projects");
  let count = 0;
  try {
    const projects = readdirSync(projectsDir);
    for (const project of projects) {
      const projectPath = join3(projectsDir, project);
      try {
        const files = readdirSync(projectPath);
        for (const file of files) {
          if (file.endsWith(".jsonl")) {
            count++;
          }
        }
      } catch {
      }
    }
  } catch {
  }
  return count;
}
function getCursorChatsDir() {
  return join3(homedir2(), ".cursor", "chats");
}
function countCursorSessions() {
  const chatsDir = getCursorChatsDir();
  let count = 0;
  try {
    const workspaces = readdirSync(chatsDir);
    for (const workspace of workspaces) {
      const workspacePath = join3(chatsDir, workspace);
      try {
        const sessions = readdirSync(workspacePath);
        for (const session of sessions) {
          if (existsSync(join3(workspacePath, session, "store.db"))) {
            count++;
          }
        }
      } catch {
      }
    }
  } catch {
  }
  return count;
}
function getCursorComposerDbPath() {
  switch (platform()) {
    case "darwin":
      return join3(homedir2(), "Library", "Application Support", "Cursor", "User", "globalStorage", "state.vscdb");
    case "win32":
      return join3(process.env.APPDATA ?? join3(homedir2(), "AppData", "Roaming"), "Cursor", "User", "globalStorage", "state.vscdb");
    default:
      return join3(homedir2(), ".config", "Cursor", "User", "globalStorage", "state.vscdb");
  }
}
function countCursorComposerSessions() {
  const dbPath = getCursorComposerDbPath();
  if (!existsSync(dbPath)) {
    return 0;
  }
  let db = null;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const row = db.prepare("SELECT COUNT(*) as count FROM cursorDiskKV WHERE key LIKE 'composerData:%'").get();
    return row?.count ?? 0;
  } catch {
    return 0;
  } finally {
    db?.close();
  }
}
function countLocalSessions() {
  return countClaudeSessions() + countCursorSessions() + countCursorComposerSessions();
}
function getAnalysisLifecycleState() {
  return readState().analysisState;
}
function recoverStaleAnalysisState(options) {
  const state = readState();
  if (state.analysisState !== "running") {
    return state;
  }
  const updatedAt = state.stateUpdatedAt ? new Date(state.stateUpdatedAt).getTime() : Number.NaN;
  const isStale = options?.force || Number.isNaN(updatedAt) || Date.now() - updatedAt > MAX_RUNNING_STATE_AGE_MS;
  if (!isStale) {
    return state;
  }
  const recoveredState = {
    ...state,
    analysisState: "failed",
    analysisInProgress: false,
    analysisPending: false,
    pendingSince: null,
    lastError: options?.reason ?? state.lastError ?? "Recovered stale running analysis state."
  };
  writeState(recoveredState);
  return recoveredState;
}
function shouldTriggerAnalysis(sessionDurationMs) {
  const state = recoverStaleAnalysisState();
  const config = getConfig();
  if (state.analysisInProgress) {
    return { shouldAnalyze: false, reason: "Analysis already in progress" };
  }
  if (sessionDurationMs > 0 && sessionDurationMs < MIN_SESSION_DURATION_MS) {
    return {
      shouldAnalyze: false,
      reason: `Session too short (${Math.round(sessionDurationMs / 1e3)}s < 3min)`
    };
  }
  if (state.lastAnalysisTimestamp) {
    const elapsed = Date.now() - new Date(state.lastAnalysisTimestamp).getTime();
    if (elapsed < COOLDOWN_MS) {
      const remainingMin = Math.round((COOLDOWN_MS - elapsed) / 6e4);
      return {
        shouldAnalyze: false,
        reason: `Cooldown active (${remainingMin}min remaining)`
      };
    }
  }
  const currentCount = countLocalSessions();
  const newSessions = currentCount - state.lastAnalysisSessionCount;
  if (newSessions < config.analyzeThreshold) {
    return {
      shouldAnalyze: false,
      reason: `Not enough new sessions (${newSessions}/${config.analyzeThreshold})`
    };
  }
  return {
    shouldAnalyze: true,
    reason: `${newSessions} new sessions, cooldown passed`
  };
}
function markAnalysisStarted() {
  const state = readState();
  state.analysisState = "running";
  state.analysisInProgress = true;
  state.analysisPending = false;
  state.pendingSince = null;
  state.lastError = null;
  writeState(state);
}
function markAnalysisComplete(sessionCount) {
  const currentCount = sessionCount ?? countLocalSessions();
  writeState({
    lastAnalysisTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
    lastAnalysisSessionCount: currentCount,
    analysisState: "complete",
    analysisInProgress: false,
    analysisPending: false,
    pendingSince: null,
    lastError: null,
    stateUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
function markAnalysisFailed(error) {
  const state = readState();
  state.analysisState = "failed";
  state.analysisInProgress = false;
  state.analysisPending = false;
  state.pendingSince = null;
  state.lastError = error instanceof Error ? error.message : error ? String(error) : null;
  writeState(state);
}
function markAnalysisPending() {
  const state = readState();
  state.analysisState = "pending";
  state.analysisPending = true;
  state.analysisInProgress = false;
  state.pendingSince = (/* @__PURE__ */ new Date()).toISOString();
  state.lastError = null;
  writeState(state);
}
function isAnalysisPending() {
  const state = readState();
  return state.analysisState === "pending";
}
function clearAnalysisPending() {
  const state = readState();
  if (state.analysisState === "pending") {
    state.analysisState = "idle";
    state.analysisPending = false;
    state.pendingSince = null;
  }
  writeState(state);
}

export {
  __require,
  DomainStrengthSchema,
  DomainGrowthAreaSchema,
  STAGE_SCHEMAS,
  MultitaskingPatternSchema,
  buildReportActivitySessions,
  assembleCanonicalAnalysisRun,
  computeDeterministicScores,
  CONTEXT_WINDOW_SIZE,
  computeDeterministicType,
  getPluginDataDir,
  getScanCacheDir,
  getConfig,
  getCacheDbPath,
  getAnalysisLifecycleState,
  recoverStaleAnalysisState,
  shouldTriggerAnalysis,
  markAnalysisStarted,
  markAnalysisComplete,
  markAnalysisFailed,
  markAnalysisPending,
  isAnalysisPending,
  clearAnalysisPending
};
//# sourceMappingURL=chunk-EUSLREZV.js.map