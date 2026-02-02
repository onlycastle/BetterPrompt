/**
 * Evaluation Assembler - Deterministic assembly of Phase 2 data into VerboseEvaluation
 *
 * Converts Phase 2 worker outputs (AgentOutputs) into VerboseEvaluation fields
 * without any LLM involvement. Phase 3 LLM only generates narrative content
 * (personalitySummary, promptPatterns, topFocusAreas).
 *
 * This module handles:
 * - workerInsights: Aggregated strengths/growthAreas from each Phase 2 worker
 *                   (ThinkingQuality, LearningBehavior, ContextEfficiency)
 * - Type classification: TypeClassifier → primaryType, controlLevel, distribution
 * - antiPatternsAnalysis: ThinkingQuality → deterministic transform
 * - criticalThinkingAnalysis: ThinkingQuality → deterministic transform
 * - planningAnalysis: ThinkingQuality → deterministic transform
 * - actionablePractices: derived from growthAreas
 *
 * v3 Architecture (2026-02): Consolidated domain workers into capability workers.
 *
 * @module analyzer/stages/evaluation-assembler
 */

import type { AgentOutputs, TypeClassifierOutput } from '../../models/agent-outputs';
import type { DimensionResourceMatch } from '../../models/verbose-evaluation';
import type {
  CommunicationPattern,
  ThinkingQualityOutput,
  DetectedAntiPattern,
  CriticalThinkingMoment,
  PlanningHabit,
} from '../../models/thinking-quality-data';
import {
  parseExamplesData,
  parseActionsData,
} from '../../models/verbose-evaluation';
import type { NarrativeLLMResponse } from '../../models/verbose-evaluation';
import type { Phase1Output } from '../../models/phase1-output';
import {
  aggregateWorkerInsights as doAggregateWorkerInsights,
  type AggregatedWorkerInsights,
  WORKER_DOMAIN_CONFIGS,
} from '../../models/agent-outputs';
import type { InsightEvidence } from '../../models/worker-insights';
import type {
  UtteranceLookupEntry,
  TransformationAuditEntry,
  TransformationType,
} from '../../models/verbose-evaluation';

// ============================================================================
// Debug Logging
// ============================================================================

const DEBUG_PROMPT_PATTERNS = process.env.DEBUG_PROMPT_PATTERNS === 'true';

function debugLog(message: string): void {
  if (DEBUG_PROMPT_PATTERNS) {
    console.log(`[EvalAssembler] ${message}`);
  }
}

// ============================================================================
// Text Truncation Utilities
// ============================================================================

/**
 * Truncate text at natural boundaries (sentence or word) to avoid
 * cutting mid-word or leaving unclosed parentheses/brackets.
 *
 * Priority order:
 * 1. Sentence boundary (". " or "! " or "? ") if within 70% of maxLen
 * 2. Word boundary (space) if within 80% of maxLen
 * 3. Hard cut with ellipsis as fallback
 *
 * @param text - Text to truncate
 * @param maxLen - Maximum length allowed
 * @returns Truncated text with appropriate ending
 */
function smartTruncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;

  // Look for sentence boundary (70% threshold)
  const sentenceEndPatterns = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
  const minSentencePos = maxLen * 0.7;
  let bestSentenceEnd = -1;

  for (const pattern of sentenceEndPatterns) {
    const pos = text.lastIndexOf(pattern, maxLen - 3);
    if (pos > minSentencePos && pos > bestSentenceEnd) {
      bestSentenceEnd = pos;
    }
  }

  if (bestSentenceEnd > 0) {
    return text.slice(0, bestSentenceEnd + 1);
  }

  // Look for word boundary (80% threshold)
  const minWordPos = maxLen * 0.8;
  const lastSpace = text.lastIndexOf(' ', maxLen - 4);

  if (lastSpace > minWordPos) {
    return text.slice(0, lastSpace) + '...';
  }

  // Fallback: hard cut with ellipsis
  return text.slice(0, maxLen - 3) + '...';
}

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
  result.personalitySummary = narrativeResult.personalitySummary;

  // ── Prompt Patterns: From ThinkingQuality communicationPatterns or Phase 3 fallback ──
  // v3 ThinkingQuality worker includes communicationPatterns directly
  if (agentOutputs.thinkingQuality?.communicationPatterns && agentOutputs.thinkingQuality.communicationPatterns.length > 0) {
    result.promptPatterns = resolvePatternQuotes(agentOutputs.thinkingQuality.communicationPatterns, phase1Output);
    debugLog(`Using ThinkingQuality communicationPatterns (${agentOutputs.thinkingQuality.communicationPatterns.length} patterns)`);
  } else if (narrativeResult.promptPatterns && narrativeResult.promptPatterns.length > 0) {
    result.promptPatterns = sanitizePromptPatterns(narrativeResult.promptPatterns, phase1Output);
    debugLog('Falling back to Phase 3 promptPatterns (ThinkingQuality patterns not available)');
  } else {
    // Both sources unavailable - create minimal placeholder
    result.promptPatterns = [];
    debugLog('No promptPatterns available from Phase 2 or Phase 3');
  }

  // topFocusAreas: prefer Phase 3 narrative, fall back to Phase 2 data
  if (narrativeResult.topFocusAreas) {
    result.topFocusAreas = sanitizeTopFocusAreas(narrativeResult.topFocusAreas);
  }

  // ── Phase 2 Deterministic Assembly ─────────────────────────────────────

  // Type classification from TypeClassifier (Phase 2.5) — authoritative source
  if (agentOutputs.typeClassifier) {
    Object.assign(result, assembleTypeClassification(agentOutputs.typeClassifier));
  }

  // ── Worker Insights: Domain-specific strengths/growthAreas from Phase 2 workers ──
  // v3 workers (ThinkingQuality, LearningBehavior, Efficiency) output strengths/growthAreas directly.
  const workerInsights = doAggregateWorkerInsights(agentOutputs);
  result.workerInsights = workerInsights;

  // ── Utterance Lookup: Extract referenced utterances for evidence linking ──
  // Only includes utterances that are referenced by structured evidence items
  // in workerInsights. This enables frontend to show original context on expand.
  if (phase1Output?.developerUtterances && workerInsights) {
    result.utteranceLookup = buildUtteranceLookup(workerInsights, phase1Output);
  }

  // ── Transformation Audit: Track text transformations for data integrity ──
  // Records how original text was transformed to displayText.
  // Enables post-hoc verification and debugging of text transformations.
  if (phase1Output?.developerUtterances) {
    result.transformationAudit = buildTransformationAudit(phase1Output);
  }

  // dimensionInsights is empty - v3 uses workerInsights instead
  result.dimensionInsights = [];

  // Anti-patterns from ThinkingQuality verificationAntiPatterns
  if (agentOutputs.thinkingQuality?.verificationAntiPatterns) {
    const antiPatterns = assembleAntiPatternsFromThinkingQuality(agentOutputs.thinkingQuality);
    if (antiPatterns) {
      result.antiPatternsAnalysis = antiPatterns;
    }
  }

  // Critical thinking from ThinkingQuality criticalThinkingMoments
  if (agentOutputs.thinkingQuality?.criticalThinkingMoments) {
    const criticalThinking = assembleCriticalThinkingFromThinkingQuality(agentOutputs.thinkingQuality);
    if (criticalThinking) {
      result.criticalThinkingAnalysis = criticalThinking;
    }
  }

  // Planning from ThinkingQuality planningHabits
  if (agentOutputs.thinkingQuality?.planningHabits) {
    const planning = assemblePlanningFromThinkingQuality(agentOutputs.thinkingQuality);
    if (planning) {
      result.planningAnalysis = planning;
    }
  }

  return result;
}

// ============================================================================
// Shared Helper Functions
// ============================================================================

/**
 * Build utterance text lookup map for O(1) access.
 * Prefers displayText (sanitized) over raw text.
 */
function buildUtteranceTextLookup(phase1Output: Phase1Output | undefined): Map<string, string> {
  const lookup = new Map<string, string>();
  if (!phase1Output?.developerUtterances) return lookup;

  for (const u of phase1Output.developerUtterances) {
    const rawQuote = u.displayText || u.text;
    lookup.set(u.id, smartTruncate(rawQuote, 500));
  }
  return lookup;
}

/**
 * Resolve examples with utteranceId lookup and deduplication.
 */
function resolveExamples(
  examples: Array<{ utteranceId?: string; analysis: string }>,
  utteranceLookup: Map<string, string>,
  usedUtteranceIds: Set<string>
): Array<{ quote: string; analysis: string }> {
  return examples
    .map(ex => {
      if (!ex.utteranceId || usedUtteranceIds.has(ex.utteranceId)) {
        debugLog(`  Skip: ${!ex.utteranceId ? 'empty' : 'duplicate'} utteranceId`);
        return null;
      }

      const quote = utteranceLookup.get(ex.utteranceId);
      if (!quote) {
        debugLog(`  Skip: utteranceId "${ex.utteranceId}" not found`);
        return null;
      }

      usedUtteranceIds.add(ex.utteranceId);
      return { quote, analysis: ex.analysis };
    })
    .filter((ex): ex is { quote: string; analysis: string } => ex !== null);
}

/**
 * Truncate tip to maximum length.
 */
function truncateTip(tip: string | undefined): string | undefined {
  if (typeof tip !== 'string') return tip;
  return tip.length > 2000 ? tip.slice(0, 1997) + '...' : tip;
}

/**
 * Ensure minimum 3 prompt patterns with placeholder content.
 */
function ensureMinimumPatterns(patterns: any[]): any[] {
  while (patterns.length < 3) {
    patterns.push({
      patternName: `Pattern ${patterns.length + 1}`,
      description: 'A detected pattern in your prompting style.',
      frequency: 'occasional',
      examples: [],
      effectiveness: 'effective',
      tip: 'Continue developing this pattern through practice.',
    });
  }
  return patterns;
}

// ============================================================================
// Phase 2 Communication Patterns Resolution
// ============================================================================

/**
 * Resolve Phase 2 CommunicationPatterns to VerboseEvaluation promptPatterns format.
 * Looks up actual quote text from Phase1Output using utteranceId.
 */
function resolvePatternQuotes(
  patterns: CommunicationPattern[],
  phase1Output: Phase1Output | undefined
): any[] {
  const utteranceLookup = buildUtteranceTextLookup(phase1Output);
  const usedUtteranceIds = new Set<string>();

  const result = patterns.map((pattern, patternIndex) => {
    debugLog(`Pattern ${patternIndex + 1}: ${pattern.patternName}`);

    const resolvedExamples = resolveExamples(
      pattern.examples,
      utteranceLookup,
      usedUtteranceIds
    );

    debugLog(`  resolved: ${resolvedExamples.length}/${pattern.examples.length} items`);

    return {
      patternName: pattern.patternName,
      description: pattern.description,
      frequency: pattern.frequency,
      examples: resolvedExamples,
      effectiveness: pattern.effectiveness,
      tip: truncateTip(pattern.tip),
    };
  });

  return ensureMinimumPatterns(result);
}

// ============================================================================
// Narrative Sanitization (Legacy - Fallback for Phase 3)
// ============================================================================

/**
 * Convert flattened LLM prompt patterns to nested format.
 * Uses utteranceId-based quote resolution for accuracy.
 */
function sanitizePromptPatterns(patterns: any[], phase1Output: Phase1Output | undefined): any[] {
  if (!Array.isArray(patterns)) return [];

  const utteranceLookup = buildUtteranceTextLookup(phase1Output);
  const usedUtteranceIds = new Set<string>();

  const result = patterns.map((pattern: any, patternIndex: number) => {
    const parsedExamples = pattern.examplesData
      ? parseExamplesData(pattern.examplesData)
      : [];

    debugLog(`Pattern ${patternIndex + 1}: ${pattern.patternName}`);
    debugLog(`  examplesData: ${pattern.examplesData?.slice(0, 80) || 'EMPTY'}...`);

    const resolvedExamples = resolveExamples(
      parsedExamples,
      utteranceLookup,
      usedUtteranceIds
    );

    debugLog(`  resolved: ${resolvedExamples.length}/${parsedExamples.length} items`);

    return {
      patternName: pattern.patternName,
      description: pattern.description,
      frequency: pattern.frequency,
      examples: resolvedExamples,
      effectiveness: pattern.effectiveness,
      tip: truncateTip(pattern.tip),
    };
  });

  return ensureMinimumPatterns(result);
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
// Anti-Patterns Assembly (v3 - ThinkingQuality)
// ============================================================================

/**
 * Convert ThinkingQuality verificationAntiPatterns to AntiPatternsAnalysis format.
 *
 * v3 architecture: Uses ThinkingQualityOutput instead of legacy TrustVerificationOutput
 *
 * Mapping:
 * - type → antiPatternType + displayName (human-readable)
 * - frequency → occurrences
 * - severity: critical/significant → significant, moderate → moderate, mild → mild
 * - improvement → growthOpportunity + actionableTip
 * - examples[].quote → evidence[]
 */
function assembleAntiPatternsFromThinkingQuality(tq: ThinkingQualityOutput): any | null {
  if (!tq.verificationAntiPatterns || tq.verificationAntiPatterns.length === 0) return null;

  const detected = tq.verificationAntiPatterns.map((ap: DetectedAntiPattern) => {
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

  // Calculate overall health score from thinking quality score
  const overallHealthScore = tq.overallThinkingQualityScore ?? 80;

  return {
    detected,
    summary: tq.summary || 'Some growth opportunities were identified. These are common learning patterns that every developer experiences.',
    overallHealthScore,
  };
}

// ============================================================================
// Critical Thinking Assembly (v3 - ThinkingQuality)
// ============================================================================

/**
 * Convert ThinkingQuality criticalThinkingMoments to CriticalThinkingAnalysis format.
 *
 * v3 architecture: Uses ThinkingQualityOutput instead of legacy WorkflowHabitOutput
 *
 * Mapping:
 * - type → indicatorType + displayName
 * - quote → evidence[]
 * - result → description
 * - Split into strengths (all moments are strengths by default)
 */
function assembleCriticalThinkingFromThinkingQuality(tq: ThinkingQualityOutput): any | null {
  if (!tq.criticalThinkingMoments || tq.criticalThinkingMoments.length === 0) return null;

  const strengths = tq.criticalThinkingMoments.map((ct: CriticalThinkingMoment) => ({
    indicatorType: ct.type,
    displayName: formatDisplayName(ct.type),
    description: ct.result || `Demonstrated ${ct.type.replace(/_/g, ' ')}`,
    frequency: 1,
    quality: 'intermediate' as const,
    evidence: ct.quote ? [ct.quote] : [],
  }));

  // Calculate overall score based on number and variety of moments
  const uniqueTypes = new Set(tq.criticalThinkingMoments.map((ct: CriticalThinkingMoment) => ct.type));
  const overallScore = Math.min(100, 40 + uniqueTypes.size * 10 + tq.criticalThinkingMoments.length * 5);

  return {
    strengths,
    opportunities: [],
    summary: tq.summary || 'Shows signs of critical evaluation when working with AI-generated content.',
    overallScore,
  };
}

// ============================================================================
// Planning Assembly (v3 - ThinkingQuality)
// ============================================================================

/**
 * Convert ThinkingQuality planningHabits to PlanningAnalysis format.
 *
 * v3 architecture: Uses ThinkingQualityOutput instead of legacy WorkflowHabitOutput
 *
 * Mapping:
 * - type → behaviorType + displayName
 * - frequency/effectiveness → sophistication mapping
 * - examples → evidence[]
 */
function assemblePlanningFromThinkingQuality(tq: ThinkingQualityOutput): any | null {
  if (!tq.planningHabits || tq.planningHabits.length === 0) return null;

  const hasSlashPlan = tq.planningHabits.some((ph: PlanningHabit) => ph.type === 'uses_plan_command');
  const hasTodoWrite = tq.planningHabits.some((ph: PlanningHabit) => ph.type === 'todowrite_usage');
  const hasTaskDecomp = tq.planningHabits.some((ph: PlanningHabit) => ph.type === 'task_decomposition');

  let maturityLevel: 'reactive' | 'emerging' | 'structured' | 'expert';
  if (hasSlashPlan && hasTaskDecomp) {
    maturityLevel = 'expert';
  } else if (hasSlashPlan) {
    maturityLevel = 'structured';
  } else if (hasTodoWrite || hasTaskDecomp) {
    maturityLevel = 'emerging';
  } else {
    maturityLevel = 'reactive';
  }

  // Convert habits to insights, split by effectiveness
  const strengths: any[] = [];
  const opportunities: any[] = [];

  for (const habit of tq.planningHabits) {
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
  const slashPlanCount = tq.planningHabits.filter((ph: PlanningHabit) => ph.type === 'uses_plan_command').length;
  const slashPlanStats = slashPlanCount > 0 ? { totalUsage: slashPlanCount } : undefined;

  return {
    strengths,
    opportunities,
    summary: tq.summary || 'Shows planning awareness in development workflow.',
    planningMaturityLevel: maturityLevel,
    slashPlanStats,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Map Phase 2 anti-pattern severity to VerboseEvaluation severity.
 *
 * Phase 2: critical | significant | moderate | mild
 * VerboseEvaluation: significant | moderate | mild
 */
function mapAntiPatternSeverity(severity: string | undefined): 'mild' | 'moderate' | 'significant' {
  if (severity === 'critical' || severity === 'significant') return 'significant';
  if (severity === 'mild') return 'mild';
  return 'moderate';
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
  if (freq === 'always') return 5;
  if (freq === 'often') return 4;
  if (freq === 'sometimes') return 3;
  if (freq === 'rarely') return 2;
  if (freq === 'never') return 1;
  return 3;
}

/**
 * Convert effectiveness to sophistication level
 */
function effectivenessToSophistication(eff: string | undefined): 'basic' | 'intermediate' | 'advanced' {
  if (eff === 'high') return 'advanced';
  if (eff === 'medium') return 'intermediate';
  if (eff === 'low') return 'basic';
  return 'intermediate';
}

// ============================================================================
// Utterance Lookup Builder
// ============================================================================

/**
 * Build utterance lookup from workerInsights evidence references.
 *
 * Scans all evidence items in workerInsights (strengths + growthAreas across all domains)
 * and extracts unique utteranceIds. Then looks up full text from Phase1Output.
 *
 * Also includes preceding AI response snippet for context display,
 * showing what the AI said before the developer's message.
 *
 * Only includes utterances that are:
 * 1. Referenced by structured evidence (has utteranceId field)
 * 2. Found in Phase1Output.developerUtterances
 *
 * @returns Array of UtteranceLookupEntry for referenced utterances
 */
function buildUtteranceLookup(
  workerInsights: AggregatedWorkerInsights,
  phase1Output: Phase1Output
): UtteranceLookupEntry[] {
  // Collect all unique utteranceIds from workerInsights evidence
  const referencedIds = new Set<string>();

  for (const domain of Object.values(workerInsights)) {
    if (!domain) continue;

    // Scan strengths evidence
    for (const strength of domain.strengths || []) {
      for (const evidence of strength.evidence || []) {
        if (typeof evidence === 'object' && evidence.utteranceId) {
          referencedIds.add(evidence.utteranceId);
        }
      }
    }

    // Scan growthAreas evidence
    for (const growth of domain.growthAreas || []) {
      for (const evidence of growth.evidence || []) {
        if (typeof evidence === 'object' && evidence.utteranceId) {
          referencedIds.add(evidence.utteranceId);
        }
      }
    }
  }

  // If no structured evidence references, return empty array
  if (referencedIds.size === 0) {
    return [];
  }

  // Build lookup map from Phase1Output
  const utteranceMap = new Map<string, Phase1Output['developerUtterances'][0]>();

  for (const u of phase1Output.developerUtterances) {
    utteranceMap.set(u.id, u);
  }

  const lookup: UtteranceLookupEntry[] = [];

  for (const id of referencedIds) {
    const utterance = utteranceMap.get(id);
    if (utterance) {
      // Parse utteranceId format: "{sessionId}_{turnIndex}"
      const lastUnderscore = id.lastIndexOf('_');
      const sessionId = lastUnderscore > 0 ? id.slice(0, lastUnderscore) : id;
      const turnIndex = lastUnderscore > 0 ? parseInt(id.slice(lastUnderscore + 1), 10) : 0;

      // Note: precedingAISnippet is no longer available as aiResponses was removed from Phase1Output
      // to reduce token usage. The field remains in UtteranceLookupEntry but is always undefined.

      lookup.push({
        id,
        // Use displayText (sanitized) if available, fallback to raw text
        text: utterance.displayText || utterance.text,
        timestamp: utterance.timestamp,
        sessionId,
        turnIndex: isNaN(turnIndex) ? 0 : turnIndex,
        precedingAISnippet: undefined,
      });
    }
  }

  return lookup;
}

// ============================================================================
// Transformation Audit Builder
// ============================================================================

/**
 * Build transformation audit from Phase1Output.
 *
 * Scans all developer utterances and records transformations:
 * - Original text vs displayText comparison
 * - Compression ratio calculation
 * - Transformation type detection (error summarized, stack trace, etc.)
 *
 * Only includes utterances where a transformation occurred (displayText differs from text).
 *
 * @param phase1Output - Phase1Output containing developerUtterances
 * @returns Array of TransformationAuditEntry for transformed utterances
 */
function buildTransformationAudit(phase1Output: Phase1Output): TransformationAuditEntry[] {
  const audit: TransformationAuditEntry[] = [];

  for (const utterance of phase1Output.developerUtterances) {
    const originalText = utterance.text;
    const displayText = utterance.displayText || originalText;

    // Skip if no transformation occurred
    if (originalText === displayText) {
      continue;
    }

    const compressionRatio = displayText.length / originalText.length;
    const isVerbatim = false; // By definition, if we're here, it's not verbatim

    // Detect transformation type based on displayText content
    const transformationType = detectTransformationType(originalText, displayText);

    audit.push({
      utteranceId: utterance.id,
      originalText: originalText.slice(0, 500), // Truncate for storage
      displayText: displayText.slice(0, 500),
      transformationType,
      isVerbatim,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
      transformedAt: new Date().toISOString(),
      validationPassed: compressionRatio >= getMinCompressionRatio(originalText.length),
    });
  }

  return audit;
}

/**
 * Detect the type of transformation applied based on content analysis.
 */
function detectTransformationType(original: string, display: string): TransformationType {
  const hasErrorTag = display.includes('[Error:') && !original.includes('[Error:');
  const hasStackTag = display.includes('[Stack trace]') && !original.includes('[Stack trace]');
  const hasCodeTag = display.includes('[Code:') && !original.includes('[Code:');
  const isTruncated = display.endsWith('...');

  const transformationCount = [hasErrorTag, hasStackTag, hasCodeTag, isTruncated].filter(Boolean).length;

  if (transformationCount === 0) return 'none';
  if (transformationCount > 1) return 'mixed';
  if (hasErrorTag) return 'error_summarized';
  if (hasStackTag) return 'stack_trace_summarized';
  if (hasCodeTag) return 'code_block_summarized';
  if (isTruncated) return 'truncated';
  return 'none';
}

/**
 * Get minimum acceptable compression ratio based on original text length.
 * Mirrors the validation logic in DataExtractorWorker.
 */
function getMinCompressionRatio(originalLength: number): number {
  if (originalLength < 50) return 0.8;
  if (originalLength < 200) return 0.5;
  return 0.3;
}
