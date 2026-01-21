/**
 * Schema Bridge
 *
 * Functions to convert between existing schemas and the new UnifiedReport schema.
 * This enables gradual migration while maintaining backward compatibility.
 */

import { randomUUID } from 'node:crypto';
import type { VerboseEvaluation, PerDimensionInsight, DimensionNameEnum } from './verbose-evaluation';
import type { TypeResult } from './coding-style';
import type { FullAnalysisResult } from '../analyzer/dimensions/index';
import {
  type Profile,
  type DimensionResult,
  type DimensionLevel,
  type EvidenceQuote,
  type ReportSummary,
  type UnifiedReport,
  type Tier,
  type CodingStyleType,
  type ControlLevel,
  type VerboseStrength,
  type VerboseGrowthArea,
  DIMENSION_DISPLAY_NAMES,
  STRENGTH_THRESHOLD,
  MATRIX_NAMES,
} from './unified-report';

// ============================================
// Profile Conversion
// ============================================

/**
 * Convert VerboseEvaluation to Profile
 */
export function verboseToProfile(verbose: VerboseEvaluation): Profile {
  const primaryType = verbose.primaryType as CodingStyleType;
  const controlLevel = verbose.controlLevel as ControlLevel;
  const matrix = MATRIX_NAMES[primaryType][controlLevel];

  return {
    primaryType,
    controlLevel,
    matrixName: matrix.name,
    matrixEmoji: matrix.emoji,
    distribution: verbose.distribution,
    personalitySummary: verbose.personalitySummary,
  };
}

/**
 * Convert TypeResult to Profile (for non-verbose analysis)
 */
export function typeResultToProfile(typeResult: TypeResult, controlLevel: ControlLevel): Profile {
  const primaryType = typeResult.primaryType as CodingStyleType;
  const matrix = MATRIX_NAMES[primaryType][controlLevel];

  return {
    primaryType,
    controlLevel,
    matrixName: matrix.name,
    matrixEmoji: matrix.emoji,
    distribution: typeResult.distribution,
    personalitySummary: '', // Will be filled by LLM
  };
}

// ============================================
// Dimension Conversion
// ============================================

/**
 * Level mapping groups for dimension conversion
 */
const LEVEL_MAPPINGS: Record<string, DimensionLevel> = {
  // Novice levels (includes burnout risk 'high' = bad)
  novice: 'novice',
  'at-risk': 'novice',
  high: 'novice',
  // Developing levels
  developing: 'developing',
  elevated: 'developing',
  explorer: 'developing',
  // Proficient levels
  proficient: 'proficient',
  moderate: 'proficient',
  navigator: 'proficient',
  // Expert levels (includes burnout risk 'low' = good)
  expert: 'expert',
  resilient: 'expert',
  low: 'expert',
  cartographer: 'expert',
};

/**
 * Map dimension level strings to DimensionLevel
 */
function mapLevel(level: string): DimensionLevel {
  return LEVEL_MAPPINGS[level] ?? 'developing';
}

/**
 * Score thresholds for dimension level calculation
 */
const SCORE_THRESHOLDS = {
  expert: 80,
  proficient: 60,
  developing: 40,
} as const;

/**
 * Burnout risk threshold for determining strength
 */
const BURNOUT_LOW_RISK_THRESHOLD = 30;

/**
 * Calculate dimension level from score
 */
function scoreToDimensionLevel(score: number): DimensionLevel {
  if (score >= SCORE_THRESHOLDS.expert) return 'expert';
  if (score >= SCORE_THRESHOLDS.proficient) return 'proficient';
  if (score >= SCORE_THRESHOLDS.developing) return 'developing';
  return 'novice';
}

/**
 * Convert FullAnalysisResult to DimensionResult array
 */
export function dimensionsToDimensionResults(
  analysis: FullAnalysisResult
): DimensionResult[] {
  const results: DimensionResult[] = [];

  // AI Collaboration
  results.push({
    name: 'aiCollaboration',
    displayName: DIMENSION_DISPLAY_NAMES.aiCollaboration,
    score: analysis.aiCollaboration.score,
    level: mapLevel(analysis.aiCollaboration.level),
    isStrength: analysis.aiCollaboration.score >= STRENGTH_THRESHOLD,
    breakdown: {
      structuredPlanning: analysis.aiCollaboration.breakdown.structuredPlanning.score,
      aiOrchestration: analysis.aiCollaboration.breakdown.aiOrchestration.score,
      criticalVerification: analysis.aiCollaboration.breakdown.criticalVerification.score,
    },
    highlights: {
      strengths: analysis.aiCollaboration.strengths,
      growthAreas: analysis.aiCollaboration.growthAreas,
    },
    insights: [], // Will be populated by InsightGenerator
    interpretation: analysis.aiCollaboration.interpretation,
  });

  // Context Engineering
  results.push({
    name: 'contextEngineering',
    displayName: DIMENSION_DISPLAY_NAMES.contextEngineering,
    score: analysis.contextEngineering.score,
    level: mapLevel(analysis.contextEngineering.level),
    isStrength: analysis.contextEngineering.score >= STRENGTH_THRESHOLD,
    breakdown: {
      write: analysis.contextEngineering.breakdown.write.score,
      select: analysis.contextEngineering.breakdown.select.score,
      compress: analysis.contextEngineering.breakdown.compress.score,
      isolate: analysis.contextEngineering.breakdown.isolate.score,
    },
    highlights: {
      strengths: analysis.contextEngineering.tips.filter((_, i) => i < 2),
      growthAreas: analysis.contextEngineering.tips.filter((_, i) => i >= 2),
    },
    insights: [],
    interpretation: analysis.contextEngineering.interpretation,
  });

  // Tool Mastery
  results.push({
    name: 'toolMastery',
    displayName: DIMENSION_DISPLAY_NAMES.toolMastery,
    score: analysis.toolMastery.overallScore,
    level: scoreToDimensionLevel(analysis.toolMastery.overallScore),
    isStrength: analysis.toolMastery.overallScore >= STRENGTH_THRESHOLD,
    breakdown: Object.fromEntries(
      Object.entries(analysis.toolMastery.toolUsage).map(([tool, data]) => [
        tool,
        data.percentage,
      ])
    ),
    highlights: {
      strengths: analysis.toolMastery.topTools.map((t) => `Strong usage of ${t}`),
      growthAreas: analysis.toolMastery.underutilizedTools.map(
        (t) => `Consider using ${t} more`
      ),
    },
    insights: [],
    interpretation: `Tool diversity and balance analysis. Top tools: ${analysis.toolMastery.topTools.join(', ')}`,
  });

  // Burnout Risk (inverted scoring - lower is better)
  const burnoutLevel = mapLevel(analysis.burnoutRisk.level);
  const burnoutScore = 100 - analysis.burnoutRisk.score; // Invert for display (higher = healthier)
  const isLowRisk = analysis.burnoutRisk.score <= BURNOUT_LOW_RISK_THRESHOLD;
  results.push({
    name: 'burnoutRisk',
    displayName: DIMENSION_DISPLAY_NAMES.burnoutRisk,
    score: burnoutScore,
    level: burnoutLevel,
    isStrength: isLowRisk,
    breakdown: {
      afterHoursRate: analysis.burnoutRisk.breakdown.afterHoursRate,
      weekendRate: analysis.burnoutRisk.breakdown.weekendRate,
      avgSessionDuration: analysis.burnoutRisk.breakdown.avgSessionDuration,
    },
    highlights: {
      strengths: isLowRisk ? ['Healthy work patterns', 'Good work-life balance'] : [],
      growthAreas: analysis.burnoutRisk.recommendations,
    },
    insights: [],
    interpretation: `Work pattern analysis. Risk level: ${analysis.burnoutRisk.level}`,
  });

  // AI Control
  results.push({
    name: 'aiControl',
    displayName: DIMENSION_DISPLAY_NAMES.aiControl,
    score: analysis.aiControl.score,
    level: mapLevel(analysis.aiControl.level),
    isStrength: analysis.aiControl.score >= STRENGTH_THRESHOLD,
    breakdown: {
      verificationRate: analysis.aiControl.breakdown.verificationRate,
      constraintSpecification: analysis.aiControl.breakdown.constraintSpecification,
      outputCritique: analysis.aiControl.breakdown.outputCritique,
      contextControl: analysis.aiControl.breakdown.contextControl,
    },
    highlights: {
      strengths: analysis.aiControl.strengths,
      growthAreas: analysis.aiControl.growthAreas,
    },
    insights: [],
    interpretation: analysis.aiControl.interpretation,
  });

  // Skill Resilience
  results.push({
    name: 'skillResilience',
    displayName: DIMENSION_DISPLAY_NAMES.skillResilience,
    score: analysis.skillResilience.score,
    level: mapLevel(analysis.skillResilience.level),
    isStrength: analysis.skillResilience.score >= STRENGTH_THRESHOLD,
    breakdown: {
      coldStartCapability: analysis.skillResilience.breakdown.coldStartCapability,
      hallucinationDetection: analysis.skillResilience.breakdown.hallucinationDetection,
      explainabilityGap: analysis.skillResilience.breakdown.explainabilityGap,
    },
    highlights: {
      strengths: analysis.skillResilience.score >= STRENGTH_THRESHOLD
        ? ['Strong independent coding ability']
        : [],
      growthAreas: analysis.skillResilience.warnings,
    },
    insights: [],
    interpretation: analysis.skillResilience.interpretation,
  });

  return results;
}

// ============================================
// Summary Generation
// ============================================

/**
 * Generate report summary from dimensions
 */
export function generateSummary(dimensions: DimensionResult[]): ReportSummary {
  // Sort by score
  const sorted = [...dimensions].sort((a, b) => b.score - a.score);

  // Top strengths (score >= 70, max 3)
  const topStrengths = sorted
    .filter((d) => d.isStrength)
    .slice(0, 3)
    .map((d) => ({
      dimension: d.name,
      displayName: d.displayName,
      score: d.score,
      highlight: d.highlights.strengths[0] || `Strong ${d.displayName.toLowerCase()} skills`,
    }));

  // Top growth areas (score < 70, max 3)
  const topGrowthAreas = sorted
    .filter((d) => !d.isStrength)
    .slice(-3)
    .reverse()
    .map((d) => ({
      dimension: d.name,
      displayName: d.displayName,
      score: d.score,
      highlight: d.highlights.growthAreas[0] || `Room to improve ${d.displayName.toLowerCase()}`,
    }));

  // Ensure at least one in each category
  if (topStrengths.length === 0) {
    const best = sorted[0];
    topStrengths.push({
      dimension: best.name,
      displayName: best.displayName,
      score: best.score,
      highlight: `Your strongest area: ${best.displayName}`,
    });
  }

  if (topGrowthAreas.length === 0) {
    const worst = sorted[sorted.length - 1];
    topGrowthAreas.push({
      dimension: worst.name,
      displayName: worst.displayName,
      score: worst.score,
      highlight: `Focus area: ${worst.displayName}`,
    });
  }

  const avgScore = dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length;
  const overallMessage = getOverallMessage(avgScore);

  return {
    topStrengths,
    topGrowthAreas,
    overallMessage,
  };
}

/**
 * Score thresholds for overall message generation
 */
const MESSAGE_THRESHOLDS = {
  strong: 70,
  moderate: 50,
} as const;

/**
 * Overall messages by score tier
 */
const OVERALL_MESSAGES = {
  strong: "You're demonstrating strong AI collaboration skills! Keep leveraging your strengths while exploring growth areas.",
  moderate: "You're making good progress in AI collaboration. Focus on the highlighted areas to level up.",
  foundational: "You're building your AI collaboration foundation. The recommendations below will help accelerate your growth.",
} as const;

/**
 * Generate overall message based on average score
 */
function getOverallMessage(avgScore: number): string {
  if (avgScore >= MESSAGE_THRESHOLDS.strong) return OVERALL_MESSAGES.strong;
  if (avgScore >= MESSAGE_THRESHOLDS.moderate) return OVERALL_MESSAGES.moderate;
  return OVERALL_MESSAGES.foundational;
}

// ============================================
// Dimension Insights Merging
// ============================================

/**
 * Merge verbose dimension insights into DimensionResult array
 * This adds verboseStrengths and verboseGrowthAreas to each dimension
 */
function mergeDimensionInsights(
  dimensionResults: DimensionResult[],
  dimensionInsights: PerDimensionInsight[]
): void {
  for (const insight of dimensionInsights) {
    const result = dimensionResults.find(d => d.name === insight.dimension);
    if (result) {
      // Map DimensionStrength to VerboseStrength
      // NOTE: evidence is now optional string[] (just quotes) instead of required object[]
      // We convert to the VerboseEvidence format expected by unified-report
      if (insight.strengths && insight.strengths.length > 0) {
        result.verboseStrengths = insight.strengths.map(s => ({
          title: s.title,
          description: s.description,
          evidence: (s.evidence || []).map(quote => ({
            quote: typeof quote === 'string' ? quote : (quote as any).quote || '',
            sessionDate: typeof quote === 'string' ? '' : (quote as any).sessionDate || '',
            context: typeof quote === 'string' ? '' : (quote as any).context || '',
          })),
        })) as VerboseStrength[];
      }

      // Map DimensionGrowthArea to VerboseGrowthArea
      if (insight.growthAreas && insight.growthAreas.length > 0) {
        result.verboseGrowthAreas = insight.growthAreas.map(g => ({
          title: g.title,
          description: g.description,
          evidence: (g.evidence || []).map(quote => ({
            quote: typeof quote === 'string' ? quote : (quote as any).quote || '',
            sessionDate: typeof quote === 'string' ? '' : (quote as any).sessionDate || '',
            context: typeof quote === 'string' ? '' : (quote as any).context || '',
          })),
          recommendation: g.recommendation,
        })) as VerboseGrowthArea[];
      }
    }
  }
}

// ============================================
// Evidence Extraction
// ============================================

/**
 * Map evidence sentiment to EvidenceSentiment
 */
function mapEvidenceSentiment(
  sourceSentiment: string,
  category: 'strength' | 'growth' | 'pattern'
): 'positive' | 'negative' | 'neutral' {
  if (category === 'strength' && sourceSentiment === 'positive') return 'positive';
  if (category === 'growth' && sourceSentiment === 'growth_opportunity') return 'negative';
  if (category === 'pattern' && sourceSentiment === 'highly_effective') return 'positive';
  return 'neutral';
}

/**
 * Extract evidence quotes from VerboseEvaluation
 * Now handles both legacy (strengths/growthAreas) and new (dimensionInsights) formats
 * NOTE: evidence is now string[] (just quotes) instead of object[]
 */
export function extractEvidence(verbose: VerboseEvaluation): EvidenceQuote[] {
  const evidence: EvidenceQuote[] = [];

  // From dimensionInsights (new format)
  if (verbose.dimensionInsights) {
    for (const insight of verbose.dimensionInsights) {
      // Strengths from each dimension
      for (const strength of insight.strengths || []) {
        for (const quote of strength.evidence || []) {
          evidence.push({
            quote: typeof quote === 'string' ? quote : (quote as any).quote || '',
            messageIndex: 0,
            timestamp: typeof quote === 'string' ? '' : (quote as any).sessionDate || '',
            category: 'strength',
            dimension: insight.dimension as DimensionNameEnum,
            sentiment: 'positive',
            analysis: strength.description,
          });
        }
      }

      // Growth areas from each dimension
      for (const area of insight.growthAreas || []) {
        for (const quote of area.evidence || []) {
          evidence.push({
            quote: typeof quote === 'string' ? quote : (quote as any).quote || '',
            messageIndex: 0,
            timestamp: typeof quote === 'string' ? '' : (quote as any).sessionDate || '',
            category: 'growth',
            dimension: insight.dimension as DimensionNameEnum,
            sentiment: 'negative',
            analysis: area.description,
          });
        }
      }
    }
  }

  // Legacy: From global strengths (deprecated, but supported for backward compatibility)
  if (verbose.strengths) {
    for (const strength of verbose.strengths) {
      for (const e of strength.evidence) {
        evidence.push({
          quote: e.quote,
          messageIndex: 0,
          timestamp: e.sessionDate,
          category: 'strength',
          sentiment: mapEvidenceSentiment(e.sentiment, 'strength'),
          analysis: e.significance,
        });
      }
    }
  }

  // Legacy: From global growth areas (deprecated, but supported for backward compatibility)
  if (verbose.growthAreas) {
    for (const area of verbose.growthAreas) {
      for (const e of area.evidence) {
        evidence.push({
          quote: e.quote,
          messageIndex: 0,
          timestamp: e.sessionDate,
          category: 'growth',
          sentiment: mapEvidenceSentiment(e.sentiment, 'growth'),
          analysis: e.significance,
        });
      }
    }
  }

  // From prompt patterns
  for (const pattern of verbose.promptPatterns) {
    for (const example of pattern.examples) {
      evidence.push({
        quote: example.quote,
        messageIndex: 0,
        category: 'pattern',
        sentiment: mapEvidenceSentiment(pattern.effectiveness, 'pattern'),
        analysis: example.analysis,
      });
    }
  }

  return evidence.slice(0, 20);
}

// ============================================
// Default Recommendations
// ============================================

import type { Recommendation, DimensionName } from './unified-report';

/**
 * Generate default recommendations based on dimension results
 */
function generateDefaultRecommendations(dimensions: DimensionResult[]): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Find dimensions that need improvement (score < 70)
  const improvementAreas = dimensions
    .filter((d) => !d.isStrength)
    .sort((a, b) => a.score - b.score);

  // Find strengths to reinforce
  const strengths = dimensions
    .filter((d) => d.isStrength)
    .sort((a, b) => b.score - a.score);

  // Add improvement recommendations (max 2)
  for (const dim of improvementAreas.slice(0, 2)) {
    recommendations.push({
      priority: recommendations.length + 1,
      type: 'improve',
      title: `Improve ${dim.displayName}`,
      description: dim.highlights.growthAreas[0] || `Focus on improving your ${dim.displayName.toLowerCase()} skills.`,
      relatedDimension: dim.name as DimensionName,
      actionItems: dim.highlights.growthAreas.slice(0, 3).map((g) => g) || [
        `Review your ${dim.displayName.toLowerCase()} patterns`,
        'Practice with intentional focus on this area',
      ],
      resources: [],
      expectedImpact: `Improving ${dim.displayName} will enhance your overall AI collaboration effectiveness.`,
    });
  }

  // Add reinforcement recommendations (max 1)
  for (const dim of strengths.slice(0, 1)) {
    recommendations.push({
      priority: recommendations.length + 1,
      type: 'reinforce',
      title: `Keep excelling at ${dim.displayName}`,
      description: dim.highlights.strengths[0] || `You're doing great with ${dim.displayName.toLowerCase()}. Keep it up!`,
      relatedDimension: dim.name as DimensionName,
      actionItems: [
        `Continue your strong ${dim.displayName.toLowerCase()} practices`,
        'Share your approach with others',
      ],
      resources: [],
      expectedImpact: `Maintaining strength in ${dim.displayName} provides a solid foundation.`,
    });
  }

  // Ensure at least one recommendation
  if (recommendations.length === 0) {
    const firstDim = dimensions[0];
    recommendations.push({
      priority: 1,
      type: 'improve',
      title: 'Continue Your AI Collaboration Journey',
      description: 'Keep practicing and exploring AI collaboration techniques.',
      relatedDimension: firstDim.name as DimensionName,
      actionItems: [
        'Review your session patterns regularly',
        'Experiment with new approaches',
        'Track your progress over time',
      ],
      resources: [],
      expectedImpact: 'Consistent practice leads to continuous improvement.',
    });
  }

  return recommendations;
}

// ============================================
// Full Conversion
// ============================================

export interface ConversionInput {
  verbose?: VerboseEvaluation;
  typeResult?: TypeResult;
  dimensions: FullAnalysisResult;
  tier?: Tier;
}

/**
 * Control level mappings (exploration metaphor)
 */
const CONTROL_LEVEL_MAPPINGS: Record<string, ControlLevel> = {
  cartographer: 'cartographer',
  explorer: 'explorer',
};

/**
 * Derive control level from AI control analysis level
 */
function deriveControlLevel(level: string): ControlLevel {
  return CONTROL_LEVEL_MAPPINGS[level] ?? 'navigator';
}

/**
 * Build profile from either verbose evaluation or type result
 */
function buildProfile(
  verbose: VerboseEvaluation | undefined,
  typeResult: TypeResult | undefined,
  controlLevel: ControlLevel
): Profile | null {
  if (verbose) return verboseToProfile(verbose);
  if (typeResult) return typeResultToProfile(typeResult, controlLevel);
  return null;
}

/**
 * Default evidence when no evidence is available from verbose evaluation
 */
const DEFAULT_EVIDENCE: EvidenceQuote[] = [
  {
    quote: 'Analysis based on session patterns',
    messageIndex: 0,
    category: 'pattern',
    sentiment: 'neutral',
    analysis: 'Automated pattern detection',
  },
  {
    quote: 'See dimension breakdowns for details',
    messageIndex: 0,
    category: 'pattern',
    sentiment: 'neutral',
    analysis: 'Detailed metrics available',
  },
  {
    quote: 'Recommendations generated from analysis',
    messageIndex: 0,
    category: 'pattern',
    sentiment: 'neutral',
    analysis: 'Actionable improvement suggestions',
  },
];

/**
 * Convert all existing schemas to UnifiedReport
 */
export function toUnifiedReport(input: ConversionInput): UnifiedReport {
  const { verbose, typeResult, dimensions, tier = 'free' } = input;

  // Determine control level from verbose or derive from dimensions
  const controlLevel: ControlLevel = (verbose?.controlLevel as ControlLevel) ||
    deriveControlLevel(dimensions.aiControl.level);

  // Build profile
  const profile = buildProfile(verbose, typeResult, controlLevel);
  if (!profile) {
    throw new Error('Either verbose or typeResult must be provided');
  }

  // Convert dimensions
  const dimensionResults = dimensionsToDimensionResults(dimensions);

  // Merge verbose dimension insights if available
  if (verbose?.dimensionInsights) {
    mergeDimensionInsights(dimensionResults, verbose.dimensionInsights);
  }

  // Generate summary
  const summary = generateSummary(dimensionResults);

  // Extract evidence or use defaults
  const extractedEvidence = verbose ? extractEvidence(verbose) : [];
  const evidence = extractedEvidence.length >= 3 ? extractedEvidence : DEFAULT_EVIDENCE;

  // Build report
  const report: UnifiedReport = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    sessionsAnalyzed: verbose?.sessionsAnalyzed || 1,
    profile,
    dimensions: dimensionResults,
    summary,
    evidence,
    recommendations: generateDefaultRecommendations(dimensionResults),
    tier,
  };

  // Add premium content if applicable
  if (tier === 'premium' || tier === 'enterprise') {
    report.premium = buildPremiumContent(dimensions, verbose);
  }

  return report;
}

/**
 * Build premium content from dimensions and optional verbose evaluation
 */
function buildPremiumContent(
  dimensions: FullAnalysisResult,
  verbose?: VerboseEvaluation
): UnifiedReport['premium'] {
  const toolUsageDeepDive = Object.entries(dimensions.toolMastery.toolUsage)
    .slice(0, 5)
    .map(([tool, data]) => ({
      tool,
      usagePercentage: data.percentage,
      insight: data.assessment,
      recommendation: getToolRecommendation(tool, data.level),
    }));

  const comparativeInsights = [
    createComparativeInsight('AI Control Index', dimensions.aiControl),
    createComparativeInsight('Context Engineering', dimensions.contextEngineering),
  ];

  const premium: UnifiedReport['premium'] = {
    toolUsageDeepDive,
    comparativeInsights,
  };

  if (verbose?.tokenEfficiency) {
    premium.tokenEfficiency = {
      score: verbose.tokenEfficiency.tokenEfficiencyScore,
      avgTokensPerSession: verbose.tokenEfficiency.averageTokensPerSession,
      savingsOpportunity: verbose.tokenEfficiency.savingsEstimate,
    };
  }

  return premium;
}

/**
 * Get tool recommendation based on proficiency level
 */
function getToolRecommendation(tool: string, level: string): string {
  if (level === 'expert') return 'Keep up the great work!';
  return `Consider using ${tool} more strategically`;
}

/**
 * Create a comparative insight from dimension data
 */
function createComparativeInsight(
  metric: string,
  dimension: { score: number; interpretation: string }
): { metric: string; yourScore: number; percentile: number; interpretation: string } {
  return {
    metric,
    yourScore: dimension.score,
    percentile: Math.min(95, Math.round(dimension.score * 1.1)),
    interpretation: dimension.interpretation,
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if a dimension is a strength
 */
export function isDimensionStrength(score: number): boolean {
  return score >= STRENGTH_THRESHOLD;
}

/**
 * Get matrix info for a style/control combination
 */
export function getMatrixInfo(
  style: CodingStyleType,
  control: ControlLevel
): { name: string; emoji: string } {
  return MATRIX_NAMES[style][control];
}
