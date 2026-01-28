/**
 * Evaluation Assembler - Deterministic assembly of Phase 2 data into VerboseEvaluation
 *
 * Converts Phase 2 worker outputs (AgentOutputs) into VerboseEvaluation fields
 * without any LLM involvement. Phase 3 LLM only generates narrative content
 * (personalitySummary, promptPatterns, topFocusAreas).
 *
 * This module handles:
 * - dimensionInsights: StrengthGrowth → grouped by dimension
 * - Type classification: TypeClassifier → primaryType, controlLevel, distribution
 * - antiPatternsAnalysis: TrustVerification → deterministic transform
 * - criticalThinkingAnalysis: WorkflowHabit → deterministic transform
 * - planningAnalysis: WorkflowHabit → deterministic transform
 * - actionablePractices: TrustVerification → deterministic transform
 *
 * @module analyzer/stages/evaluation-assembler
 */

import type { AgentOutputs } from '../../models/agent-outputs';
import type { StrengthGrowthOutput } from '../../models/strength-growth-data';
import type { TrustVerificationOutput } from '../../models/trust-verification-data';
import type { WorkflowHabitOutput } from '../../models/workflow-habit-data';
import type { TypeClassifierOutput } from '../../models/agent-outputs';
import type { DimensionResourceMatch } from '../../models/verbose-evaluation';
import { validateDimension } from '../../models/dimension-schema';
import {
  DIMENSION_NAMES,
  DIMENSION_DISPLAY_NAMES,
  parseExamplesData,
  parseActionsData,
} from '../../models/verbose-evaluation';
import type { NarrativeLLMResponse } from '../../models/verbose-evaluation';
import type { Phase1Output } from '../../models/phase1-output';

// ============================================================================
// Main Assembly Function
// ============================================================================

/**
 * Assemble VerboseEvaluation fields from Phase 2 outputs + Phase 3 narrative.
 *
 * Phase 2 provides structural/quantitative data (deterministic).
 * Phase 3 provides narrative-only content (LLM-generated).
 * This function merges both into the VerboseEvaluation shape.
 */
export function assembleEvaluation(
  agentOutputs: AgentOutputs,
  narrativeResult: NarrativeLLMResponse,
  phase1Output: Phase1Output | undefined,
  sessionCount: number,
  knowledgeResources?: DimensionResourceMatch[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // ── Phase 3 Narrative (LLM-generated) ──────────────────────────────────
  result.personalitySummary = truncatePersonalitySummary(narrativeResult.personalitySummary);
  result.promptPatterns = sanitizePromptPatterns(narrativeResult.promptPatterns);

  // topFocusAreas: prefer Phase 3 narrative, fall back to Phase 2 data
  if (narrativeResult.topFocusAreas) {
    result.topFocusAreas = sanitizeTopFocusAreas(narrativeResult.topFocusAreas);
  }

  // ── Phase 2 Deterministic Assembly ─────────────────────────────────────

  // Type classification from TypeClassifier (Phase 2.5) — authoritative source
  if (agentOutputs.typeClassifier) {
    Object.assign(result, assembleTypeClassification(agentOutputs.typeClassifier));
  }

  // Dimension insights from StrengthGrowth
  if (agentOutputs.strengthGrowth) {
    result.dimensionInsights = assembleDimensionInsights(agentOutputs.strengthGrowth);
  } else {
    // Fallback: empty dimension insights for all 6 dimensions
    result.dimensionInsights = DIMENSION_NAMES.map((dim) => ({
      dimension: dim,
      dimensionDisplayName: DIMENSION_DISPLAY_NAMES[dim],
      strengths: [],
      growthAreas: [],
    }));
  }

  // Anti-patterns from TrustVerification
  if (agentOutputs.trustVerification) {
    const antiPatterns = assembleAntiPatterns(agentOutputs.trustVerification);
    if (antiPatterns) {
      result.antiPatternsAnalysis = antiPatterns;
    }
  }

  // Critical thinking + Planning from WorkflowHabit
  if (agentOutputs.workflowHabit) {
    const criticalThinking = assembleCriticalThinking(agentOutputs.workflowHabit);
    if (criticalThinking) {
      result.criticalThinkingAnalysis = criticalThinking;
    }

    const planning = assemblePlanning(agentOutputs.workflowHabit);
    if (planning) {
      result.planningAnalysis = planning;
    }
  }

  // Actionable practices from TrustVerification
  if (agentOutputs.trustVerification?.actionablePatternMatchesData) {
    const practices = assembleActionablePractices(agentOutputs.trustVerification);
    if (practices) {
      result.actionablePractices = practices;
    }
  }

  // Top focus areas fallback: if Phase 3 didn't produce them, use Phase 2 data
  if (!result.topFocusAreas && agentOutputs.strengthGrowth?.personalizedPrioritiesData) {
    const areas = parsePersonalizedPriorities(agentOutputs.strengthGrowth.personalizedPrioritiesData);
    if (areas.length > 0) {
      result.topFocusAreas = {
        areas,
        summary: 'Personalized priorities based on your analysis results.',
      };
    }
  }

  return result;
}

// ============================================================================
// Narrative Sanitization
// ============================================================================

/**
 * Truncate personalitySummary to 3000 chars, preserving bold markers
 */
function truncatePersonalitySummary(summary: string): string {
  if (!summary || typeof summary !== 'string') return '';
  if (summary.length <= 3000) return summary;

  let truncated = summary.slice(0, 2997);
  // Don't leave dangling bold markers
  const lastBoldStart = truncated.lastIndexOf('**');
  const beforeLastBold = truncated.slice(0, lastBoldStart).lastIndexOf('**');
  if (lastBoldStart > beforeLastBold && lastBoldStart > 0) {
    truncated = truncated.slice(0, lastBoldStart).trimEnd();
  }
  return truncated + '...';
}

/**
 * Convert flattened LLM prompt patterns to nested format and truncate tips
 */
function sanitizePromptPatterns(patterns: any[]): any[] {
  if (!Array.isArray(patterns)) return [];

  const result = patterns.map((pattern: any) => ({
    patternName: pattern.patternName,
    description: pattern.description,
    frequency: pattern.frequency,
    examples: pattern.examplesData
      ? parseExamplesData(pattern.examplesData)
      : (pattern.examples || []),
    effectiveness: pattern.effectiveness,
    tip: typeof pattern.tip === 'string' && pattern.tip.length > 2000
      ? pattern.tip.slice(0, 1997) + '...'
      : pattern.tip,
  }));

  // Ensure minimum 3 prompt patterns
  while (result.length < 3) {
    result.push({
      patternName: `Pattern ${result.length + 1}`,
      description: 'A detected pattern in your prompting style.',
      frequency: 'occasional',
      examples: [{ quote: 'Example quote', analysis: 'Pattern analysis' }],
      effectiveness: 'effective',
      tip: 'Continue developing this pattern through practice.',
    });
  }

  return result;
}

/**
 * Convert flattened topFocusAreas to nested format
 */
function sanitizeTopFocusAreas(topFocusAreas: any): any {
  if (!topFocusAreas || !Array.isArray(topFocusAreas.areas)) return topFocusAreas;

  return {
    areas: topFocusAreas.areas.map((area: any) => ({
      rank: area.rank,
      dimension: area.dimension,
      title: area.title,
      narrative: area.narrative,
      expectedImpact: area.expectedImpact,
      priorityScore: area.priorityScore,
      actions: area.actionsData
        ? parseActionsData(area.actionsData)
        : area.actions,
    })),
    summary: topFocusAreas.summary,
  };
}

// ============================================================================
// Type Classification Assembly
// ============================================================================

/**
 * Copy core TypeClassifier fields to VerboseEvaluation top-level.
 *
 * Only primaryType, controlLevel, distribution, controlScore are promoted.
 * matrixName, matrixEmoji, collaborationMaturity remain accessible via
 * evaluation.agentOutputs.typeClassifier.* (not duplicated at top-level).
 */
function assembleTypeClassification(tc: TypeClassifierOutput): Record<string, unknown> {
  return {
    primaryType: tc.primaryType,
    controlLevel: tc.controlLevel,
    distribution: tc.distribution,
    controlScore: tc.controlScore,
  };
}

// ============================================================================
// Dimension Insights Assembly
// ============================================================================

/**
 * Group StrengthGrowth strengths and growthAreas by dimension into 6 PerDimensionInsight objects.
 *
 * Each strength/growthArea from Phase 2 has a `dimension` field.
 * We group them, preserving order, and map to the VerboseEvaluation format.
 */
function assembleDimensionInsights(sg: StrengthGrowthOutput): any[] {
  // Build dimension → { strengths, growthAreas } map
  const byDimension = new Map<string, { strengths: any[]; growthAreas: any[] }>();

  // Initialize all 6 dimensions
  for (const dim of DIMENSION_NAMES) {
    byDimension.set(dim, { strengths: [], growthAreas: [] });
  }

  // Group strengths by dimension
  for (const s of sg.strengths) {
    const group = byDimension.get(s.dimension || 'aiCollaboration');
    if (group) {
      group.strengths.push({
        title: s.title,
        description: s.description,
        evidence: mapEvidence(s.evidence),
      });
    }
  }

  // Group growth areas by dimension
  for (const g of sg.growthAreas) {
    const group = byDimension.get(g.dimension || 'aiCollaboration');
    if (group) {
      group.growthAreas.push({
        title: g.title,
        description: g.description,
        recommendation: g.recommendation,
        frequency: g.frequency,
        severity: g.severity,
        priorityScore: g.priorityScore,
        evidence: mapEvidence(g.evidence),
      });
    }
  }

  // Convert to array in DIMENSION_NAMES order
  return DIMENSION_NAMES.map((dim) => {
    const data = byDimension.get(dim)!;
    return {
      dimension: dim,
      dimensionDisplayName: DIMENSION_DISPLAY_NAMES[dim],
      strengths: data.strengths,
      growthAreas: data.growthAreas,
    };
  });
}

// ============================================================================
// Anti-Patterns Assembly
// ============================================================================

/**
 * Convert TrustVerification anti-patterns to AntiPatternsAnalysis format.
 *
 * Mapping:
 * - type → antiPatternType + displayName (human-readable)
 * - frequency → occurrences
 * - severity: critical/significant → significant, moderate → moderate, mild → mild
 * - improvement → growthOpportunity + actionableTip
 * - examples[].quote → evidence[]
 */
function assembleAntiPatterns(tv: TrustVerificationOutput): any | null {
  if (!tv.antiPatterns || tv.antiPatterns.length === 0) return null;

  const detected = tv.antiPatterns.map(ap => {
    const displayName = formatDisplayName(ap.type);
    const readableType = ap.type.replace(/_/g, ' ');

    // Map Phase 2 severity (critical/significant/moderate/mild)
    // to VerboseEvaluation severity (mild/moderate/significant)
    const severity = mapAntiPatternSeverity(ap.severity);

    return {
      antiPatternType: ap.type,
      displayName,
      description: ap.improvement || `Detected ${readableType} pattern`,
      occurrences: ap.frequency,
      severity,
      evidence: ap.examples?.map(e => e.quote) ?? [],
      growthOpportunity: ap.improvement || `Consider addressing the ${readableType} pattern`,
      actionableTip: ap.improvement || `Try to be more mindful of ${readableType} patterns`,
    };
  });

  return {
    detected,
    summary: tv.summary || 'Some growth opportunities were identified. These are common learning patterns that every developer experiences.',
    overallHealthScore: tv.overallTrustHealthScore ?? 80,
  };
}

// ============================================================================
// Critical Thinking Assembly
// ============================================================================

/**
 * Convert WorkflowHabit critical thinking moments to CriticalThinkingAnalysis format.
 *
 * Mapping:
 * - type → indicatorType + displayName
 * - quote → evidence[]
 * - result → description
 * - Split into strengths (all moments are strengths by default)
 */
function assembleCriticalThinking(wh: WorkflowHabitOutput): any | null {
  if (!wh.criticalThinkingMoments || wh.criticalThinkingMoments.length === 0) return null;

  const strengths = wh.criticalThinkingMoments.map(ct => ({
    indicatorType: ct.type,
    displayName: formatDisplayName(ct.type),
    description: ct.result || `Demonstrated ${ct.type.replace(/_/g, ' ')}`,
    frequency: 1,
    quality: 'intermediate' as const,
    evidence: ct.quote ? [ct.quote] : [],
  }));

  // Calculate overall score based on number and variety of moments
  const uniqueTypes = new Set(wh.criticalThinkingMoments.map(ct => ct.type));
  const overallScore = Math.min(100, 40 + uniqueTypes.size * 10 + wh.criticalThinkingMoments.length * 5);

  return {
    strengths,
    opportunities: [],
    summary: wh.summary || 'Shows signs of critical evaluation when working with AI-generated content.',
    overallScore,
  };
}

// ============================================================================
// Planning Assembly
// ============================================================================

/**
 * Convert WorkflowHabit planning habits to PlanningAnalysis format.
 *
 * Mapping:
 * - type → behaviorType + displayName
 * - frequency/effectiveness → sophistication mapping
 * - examples → evidence[]
 */
function assemblePlanning(wh: WorkflowHabitOutput): any | null {
  if (!wh.planningHabits || wh.planningHabits.length === 0) return null;

  const hasSlashPlan = wh.planningHabits.some(ph => ph.type === 'uses_plan_command');
  const hasTodoWrite = wh.planningHabits.some(ph => ph.type === 'todowrite_usage');
  const hasTaskDecomp = wh.planningHabits.some(ph => ph.type === 'task_decomposition');

  // Determine maturity level
  let maturityLevel: 'reactive' | 'emerging' | 'structured' | 'expert' = 'reactive';
  if (hasSlashPlan && hasTaskDecomp) maturityLevel = 'expert';
  else if (hasSlashPlan) maturityLevel = 'structured';
  else if (hasTodoWrite || hasTaskDecomp) maturityLevel = 'emerging';

  // Convert habits to insights, split by effectiveness
  const strengths: any[] = [];
  const opportunities: any[] = [];

  for (const habit of wh.planningHabits) {
    const isStrength = habit.effectiveness === 'high' ||
      (habit.frequency === 'always' || habit.frequency === 'often');

    const insight = {
      behaviorType: habit.type,
      displayName: formatDisplayName(habit.type),
      description: `Planning habit "${habit.type.replace(/_/g, ' ')}" observed with ${habit.frequency} frequency`,
      frequency: frequencyToNumber(habit.frequency),
      sophistication: effectivenessToSophistication(habit.effectiveness),
      evidence: habit.examples ?? [],
    };

    if (isStrength) {
      strengths.push(insight);
    } else {
      opportunities.push(insight);
    }
  }

  // Calculate /plan stats from planning habits
  const slashPlanCount = wh.planningHabits.filter(ph => ph.type === 'uses_plan_command').length;
  const slashPlanStats = slashPlanCount > 0 ? { totalUsage: slashPlanCount } : undefined;

  return {
    strengths,
    opportunities,
    summary: wh.summary || 'Shows planning awareness in development workflow.',
    planningMaturityLevel: maturityLevel,
    slashPlanStats,
  };
}

// ============================================================================
// Actionable Practices Assembly
// ============================================================================

/**
 * Parse TrustVerification actionablePatternMatchesData into practiced/opportunities.
 *
 * Format: "patternId|practiced|advice|source|feedback_or_tip|dimension|priority;..."
 * - practiced=true → practiced[]
 * - practiced=false → opportunities[]
 */
function assembleActionablePractices(tv: TrustVerificationOutput): any | null {
  const data = tv.actionablePatternMatchesData;
  if (!data || data.trim() === '') return null;

  const practiced: any[] = [];
  const opportunities: any[] = [];

  const entries = data.split(';').filter(Boolean);
  for (const entry of entries) {
    const parts = entry.split('|');
    const patternId = parts[0]?.trim() || '';
    const isPracticed = parts[1]?.trim().toLowerCase() === 'true';
    const advice = parts[2]?.trim() || '';
    const source = parts[3]?.trim() || '';
    const feedbackOrTip = parts[4]?.trim() || '';
    const dimension = parts[5]?.trim() || '';
    const priority = parts[6] ? parseInt(parts[6], 10) : 5;

    if (!patternId) continue;

    if (isPracticed) {
      practiced.push({
        patternId,
        advice,
        source,
        feedback: feedbackOrTip,
        evidence: [],
        dimension,
      });
    } else {
      opportunities.push({
        patternId,
        advice,
        source,
        tip: feedbackOrTip,
        dimension,
        priority: isNaN(priority) ? 5 : priority,
      });
    }
  }

  if (practiced.length === 0 && opportunities.length === 0) return null;

  return {
    practiced,
    opportunities,
    summary: `Developer follows ${practiced.length} expert practices and has ${opportunities.length} opportunities to adopt.`,
  };
}

// ============================================================================
// Helper: Parse Personalized Priorities
// ============================================================================

/**
 * Parse personalizedPrioritiesData into focus areas
 * Format: "dimension|focusArea|rationale|impact|score;..."
 */
function parsePersonalizedPriorities(data: string): any[] {
  if (!data || data.trim() === '') return [];

  return data
    .split(';')
    .filter(Boolean)
    .slice(0, 3)
    .map((entry, index) => {
      const parts = entry.split('|');
      return {
        rank: index + 1,
        dimension: validateDimension(parts[0], 'personalizedPriority'),
        title: parts[1]?.trim() || '',
        narrative: parts[2]?.trim() || '',
        expectedImpact: parts[3]?.trim() || '',
        priorityScore: parts[4] ? parseFloat(parts[4]) : 0,
      };
    })
    .filter(a => a.title);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Map InsightEvidence[] to the VerboseEvaluation evidence format with sessionId extraction.
 */
function mapEvidence(evidence: Array<{ utteranceId?: string; quote?: string }> | undefined): any[] {
  return evidence?.map(e => ({
    utteranceId: e.utteranceId ?? '',
    quote: e.quote ?? '',
    sessionId: extractSessionId(e.utteranceId ?? ''),
  })) ?? [];
}

/**
 * Map Phase 2 anti-pattern severity to VerboseEvaluation severity.
 *
 * Phase 2: critical | significant | moderate | mild
 * VerboseEvaluation: significant | moderate | mild
 */
function mapAntiPatternSeverity(
  severity: string | undefined
): 'mild' | 'moderate' | 'significant' {
  switch (severity) {
    case 'critical':
    case 'significant':
      return 'significant';
    case 'mild':
      return 'mild';
    default:
      return 'moderate';
  }
}

/**
 * Convert snake_case type to human-readable display name
 * e.g., "error_loop" → "Error Loop", "blind_acceptance" → "Blind Acceptance"
 */
function formatDisplayName(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extract sessionId from utteranceId format: "{sessionId}_{turnIndex}"
 */
function extractSessionId(utteranceId: string): string | undefined {
  const lastUnderscore = utteranceId.lastIndexOf('_');
  if (lastUnderscore <= 0) return undefined;
  return utteranceId.slice(0, lastUnderscore);
}

/**
 * Convert habit frequency to a numeric value
 */
function frequencyToNumber(freq: string | undefined): number {
  switch (freq) {
    case 'always': return 5;
    case 'often': return 4;
    case 'sometimes': return 3;
    case 'rarely': return 2;
    case 'never': return 1;
    default: return 3;
  }
}

/**
 * Convert effectiveness to sophistication level
 */
function effectivenessToSophistication(eff: string | undefined): 'basic' | 'intermediate' | 'advanced' {
  switch (eff) {
    case 'high': return 'advanced';
    case 'medium': return 'intermediate';
    case 'low': return 'basic';
    default: return 'intermediate';
  }
}
