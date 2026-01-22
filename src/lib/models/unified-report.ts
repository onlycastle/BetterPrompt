/**
 * Unified Report Schema
 *
 * Integrates all analysis outputs into a single comprehensive report:
 * - Profile (coding style + control level)
 * - 6 Analysis Dimensions with personalized insights
 * - Evidence quotes from actual conversations
 * - Actionable recommendations with KB-linked resources
 */

import { z } from 'zod';

// ============================================
// PART 1: Profile (Coding Style + Control)
// ============================================

export const CodingStyleTypeSchema = z.enum([
  'architect',
  'scientist',
  'collaborator',
  'speedrunner',
  'craftsman',
]);

export const ControlLevelSchema = z.enum(['explorer', 'navigator', 'cartographer']);

export const DimensionLevelSchema = z.enum(['novice', 'developing', 'proficient', 'expert']);

export const ProfileSchema = z.object({
  primaryType: CodingStyleTypeSchema,
  controlLevel: ControlLevelSchema,
  matrixName: z.string(),
  matrixEmoji: z.string(),
  distribution: z.object({
    architect: z.number().min(0).max(100),
    scientist: z.number().min(0).max(100),
    collaborator: z.number().min(0).max(100),
    speedrunner: z.number().min(0).max(100),
    craftsman: z.number().min(0).max(100),
  }),
  personalitySummary: z.string().min(100).max(1500),
});

// ============================================
// PART 2: Dimension Insights
// ============================================

export const InsightTypeSchema = z.enum(['reinforcement', 'improvement']);
export const SentimentSchema = z.enum(['praise', 'encouragement', 'suggestion']);
export const ResourceLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);

export const ConversationInsightSchema = z.object({
  quote: z.string().min(10).max(500),
  messageIndex: z.number().int().min(0),
  advice: z.string().min(20).max(500),
  sentiment: SentimentSchema,
});

export const ResearchInsightSchema = z.object({
  source: z.string().max(3000),
  insight: z.string().min(20).max(500),
  url: z.string().url().optional(),
});

export const LearningResourceSchema = z.object({
  title: z.string().max(3000),
  url: z.string().url(),
  platform: z.string().max(50),
  level: ResourceLevelSchema,
  relevanceScore: z.number().min(0).max(1),
});

export const DimensionInsightSchema = z.object({
  type: InsightTypeSchema,
  conversationBased: ConversationInsightSchema.optional(),
  researchBased: ResearchInsightSchema.optional(),
  learningResource: LearningResourceSchema.optional(),
});

// ============================================
// PART 3: Dimension Results
// ============================================

export const DimensionNameSchema = z.enum([
  // Original 6 dimensions
  'aiCollaboration',
  'contextEngineering',
  'toolMastery',
  'burnoutRisk',
  'aiControl',
  'skillResilience',
  // New 3 dimensions (Phase 3 - Premium/Enterprise)
  'iterationEfficiency',
  'learningVelocity',
  'scopeManagement',
]);

export const TrendSchema = z.enum(['improving', 'stable', 'declining']);

export const DimensionHighlightsSchema = z.object({
  strengths: z.array(z.string()).min(0).max(5),
  growthAreas: z.array(z.string()).min(0).max(5),
});

// ============================================
// Verbose Insight Schemas (for per-dimension display with evidence)
// ============================================

/**
 * Evidence for verbose insights
 */
export const VerboseEvidenceSchema = z.object({
  quote: z.string(),
  sessionDate: z.string(),
  context: z.string(),
});

/**
 * Strength with evidence (for display in dimension section)
 */
export const VerboseStrengthSchema = z.object({
  title: z.string(),
  description: z.string(),
  evidence: z.array(VerboseEvidenceSchema),
});

/**
 * Growth area with evidence and recommendation (for display in dimension section)
 */
export const VerboseGrowthAreaSchema = z.object({
  title: z.string(),
  description: z.string(),
  evidence: z.array(VerboseEvidenceSchema),
  recommendation: z.string(),
});

export const DimensionResultSchema = z.object({
  name: DimensionNameSchema,
  displayName: z.string(),
  score: z.number().min(0).max(100),
  level: DimensionLevelSchema,
  isStrength: z.boolean(),
  trend: TrendSchema.optional(),
  breakdown: z.record(z.string(), z.number()),
  highlights: DimensionHighlightsSchema,
  insights: z.array(DimensionInsightSchema).max(5),
  interpretation: z.string().max(1000),

  // NEW: Verbose insights with evidence (primary display content, replaces score-based display)
  verboseStrengths: z.array(VerboseStrengthSchema).optional(),
  verboseGrowthAreas: z.array(VerboseGrowthAreaSchema).optional(),
});

// ============================================
// PART 4: Evidence Quotes
// ============================================

export const EvidenceCategorySchema = z.enum(['strength', 'growth', 'pattern']);
export const EvidenceSentimentSchema = z.enum(['positive', 'negative', 'neutral']);

export const EvidenceQuoteSchema = z.object({
  quote: z.string().min(10).max(500),
  messageIndex: z.number().int().min(0),
  timestamp: z.string().optional(),
  category: EvidenceCategorySchema,
  dimension: DimensionNameSchema.optional(),
  sentiment: EvidenceSentimentSchema,
  analysis: z.string().max(500),
});

// ============================================
// PART 5: Recommendations
// ============================================

export const RecommendationTypeSchema = z.enum(['reinforce', 'improve']);
export const ResourceTypeSchema = z.enum(['article', 'video', 'documentation', 'example']);

export const RecommendationResourceSchema = z.object({
  title: z.string().max(3000),
  url: z.string().url(),
  type: ResourceTypeSchema,
  level: ResourceLevelSchema,
});

export const RecommendationSchema = z.object({
  priority: z.number().int().min(1).max(5),
  type: RecommendationTypeSchema,
  title: z.string().max(3000),
  description: z.string().max(500),
  relatedDimension: DimensionNameSchema,
  actionItems: z.array(z.string().max(3000)).min(1).max(5),
  resources: z.array(RecommendationResourceSchema).max(5),
  expectedImpact: z.string().max(3000),
});

// ============================================
// PART 6: Summary
// ============================================

export const DimensionSummaryItemSchema = z.object({
  dimension: DimensionNameSchema,
  displayName: z.string(),
  score: z.number().min(0).max(100),
  highlight: z.string().max(3000),
});

export const ReportSummarySchema = z.object({
  topStrengths: z.array(DimensionSummaryItemSchema).min(1).max(3),
  topGrowthAreas: z.array(DimensionSummaryItemSchema).min(1).max(3),
  overallMessage: z.string().max(500),
});

// ============================================
// PART 7: Premium Content
// ============================================

export const ToolInsightSchema = z.object({
  tool: z.string(),
  usagePercentage: z.number().min(0).max(100),
  insight: z.string().max(3000),
  recommendation: z.string().max(3000),
});

export const TokenEfficiencySchema = z.object({
  score: z.number().min(0).max(100),
  avgTokensPerSession: z.number(),
  savingsOpportunity: z.string().max(3000),
});

export const MilestoneSchema = z.object({
  title: z.string().max(3000),
  description: z.string().max(3000),
  completed: z.boolean(),
});

export const GrowthRoadmapSchema = z.object({
  milestones: z.array(MilestoneSchema).min(1).max(10),
});

export const ComparativeInsightSchema = z.object({
  metric: z.string().max(3000),
  yourScore: z.number(),
  percentile: z.number().min(0).max(100),
  interpretation: z.string().max(3000),
});

export const SessionTrendSchema = z.object({
  metric: z.string().max(3000),
  trend: TrendSchema,
  change: z.number(),
  interpretation: z.string().max(3000),
});

export const PremiumContentSchema = z.object({
  toolUsageDeepDive: z.array(ToolInsightSchema).max(10).optional(),
  tokenEfficiency: TokenEfficiencySchema.optional(),
  growthRoadmap: GrowthRoadmapSchema.optional(),
  comparativeInsights: z.array(ComparativeInsightSchema).max(10).optional(),
  sessionTrends: z.array(SessionTrendSchema).max(5).optional(),
});

// ============================================
// MAIN SCHEMA: UnifiedReport
// ============================================

export const TierSchema = z.enum(['free', 'pro', 'premium', 'enterprise']);

export const UnifiedReportSchema = z.object({
  // Metadata
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  sessionsAnalyzed: z.number().int().min(1),

  // Core Analysis
  profile: ProfileSchema,
  dimensions: z.array(DimensionResultSchema).length(6),

  // Summary
  summary: ReportSummarySchema,

  // Personalized Content
  evidence: z.array(EvidenceQuoteSchema).min(3).max(20),
  recommendations: z.array(RecommendationSchema).min(1).max(10),

  // Premium (tier-gated)
  premium: PremiumContentSchema.optional(),

  // Tier Control
  tier: TierSchema,
});

// ============================================
// Type Exports
// ============================================

export type CodingStyleType = z.infer<typeof CodingStyleTypeSchema>;
export type ControlLevel = z.infer<typeof ControlLevelSchema>;
export type DimensionLevel = z.infer<typeof DimensionLevelSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type InsightType = z.infer<typeof InsightTypeSchema>;
export type ConversationInsight = z.infer<typeof ConversationInsightSchema>;
export type ResearchInsight = z.infer<typeof ResearchInsightSchema>;
export type LearningResource = z.infer<typeof LearningResourceSchema>;
export type DimensionInsight = z.infer<typeof DimensionInsightSchema>;
export type DimensionName = z.infer<typeof DimensionNameSchema>;
export type Trend = z.infer<typeof TrendSchema>;
export type DimensionHighlights = z.infer<typeof DimensionHighlightsSchema>;
export type VerboseEvidence = z.infer<typeof VerboseEvidenceSchema>;
export type VerboseStrength = z.infer<typeof VerboseStrengthSchema>;
export type VerboseGrowthArea = z.infer<typeof VerboseGrowthAreaSchema>;
export type DimensionResult = z.infer<typeof DimensionResultSchema>;
export type EvidenceCategory = z.infer<typeof EvidenceCategorySchema>;
export type EvidenceSentiment = z.infer<typeof EvidenceSentimentSchema>;
export type EvidenceQuote = z.infer<typeof EvidenceQuoteSchema>;
export type RecommendationType = z.infer<typeof RecommendationTypeSchema>;
export type ResourceType = z.infer<typeof ResourceTypeSchema>;
export type RecommendationResource = z.infer<typeof RecommendationResourceSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type DimensionSummaryItem = z.infer<typeof DimensionSummaryItemSchema>;
export type ReportSummary = z.infer<typeof ReportSummarySchema>;
export type ToolInsight = z.infer<typeof ToolInsightSchema>;
export type TokenEfficiency = z.infer<typeof TokenEfficiencySchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
export type GrowthRoadmap = z.infer<typeof GrowthRoadmapSchema>;
export type ComparativeInsight = z.infer<typeof ComparativeInsightSchema>;
export type SessionTrend = z.infer<typeof SessionTrendSchema>;
export type PremiumContent = z.infer<typeof PremiumContentSchema>;
export type Tier = z.infer<typeof TierSchema>;
export type UnifiedReport = z.infer<typeof UnifiedReportSchema>;

// ============================================
// Constants
// ============================================

export const DIMENSION_DISPLAY_NAMES: Record<DimensionName, string> = {
  // Original 6 dimensions
  aiCollaboration: 'AI Collaboration Mastery',
  contextEngineering: 'Context Engineering',
  toolMastery: 'Tool Mastery',
  burnoutRisk: 'Burnout Risk',
  aiControl: 'AI Control Index',
  skillResilience: 'Skill Resilience',
  // New 3 dimensions (Phase 3 - Premium/Enterprise)
  iterationEfficiency: 'Iteration Efficiency',
  learningVelocity: 'Learning Velocity',
  scopeManagement: 'Scope Management',
};

export const STRENGTH_THRESHOLD = 70;

export const MATRIX_NAMES: Record<CodingStyleType, Record<ControlLevel, { name: string; emoji: string }>> = {
  architect: {
    explorer: { name: 'Visionary', emoji: '💭' },
    navigator: { name: 'Strategist', emoji: '📐' },
    cartographer: { name: 'Systems Architect', emoji: '🏛️' },
  },
  scientist: {
    explorer: { name: 'Questioner', emoji: '🔎' },
    navigator: { name: 'Analyst', emoji: '🧪' },
    cartographer: { name: 'Research Lead', emoji: '🔬' },
  },
  collaborator: {
    explorer: { name: 'Conversationalist', emoji: '👥' },
    navigator: { name: 'Team Player', emoji: '🤝' },
    cartographer: { name: 'Facilitator', emoji: '🎭' },
  },
  speedrunner: {
    explorer: { name: 'Experimenter', emoji: '🎲' },
    navigator: { name: 'Rapid Prototyper', emoji: '🏃' },
    cartographer: { name: 'Velocity Expert', emoji: '⚡' },
  },
  craftsman: {
    explorer: { name: 'Detail Lover', emoji: '🎨' },
    navigator: { name: 'Quality Crafter', emoji: '🔧' },
    cartographer: { name: 'Master Artisan', emoji: '💎' },
  },
};
