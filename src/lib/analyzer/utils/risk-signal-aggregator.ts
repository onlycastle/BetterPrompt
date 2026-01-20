/**
 * Risk Signal Aggregator - Combines evidence from multiple analysis sources
 *
 * Aggregates risk signals from:
 * - Anti-patterns (AntiPatternSpotter)
 * - Critical thinking analysis (DataAnalyst)
 * - Planning analysis (DataAnalyst)
 * - Metacognition blind spots (MetacognitionWorker)
 * - Temporal fatigue patterns (TemporalAnalyzerWorker)
 *
 * @module analyzer/utils/risk-signal-aggregator
 */

import type { AntiPatternSpotterOutput } from '../../models/agent-outputs';
import type { MetacognitionOutput } from '../../models/metacognition-data';
import type { TemporalAnalysisOutput } from '../../models/temporal-data';
import type { StructuredAnalysisData } from '../../models/analysis-data';
import {
  type RiskSignal,
  type RiskAnalysis,
  type RiskType,
  createRiskSignalFromPattern,
  calculateRiskScore,
  calculateRiskByType,
  createDefaultRiskAnalysis,
  getRiskTypeForPattern,
  PATTERN_TO_RISK_TYPE,
} from '../../models/risk-signal';

// ============================================================================
// Types
// ============================================================================

/**
 * Input sources for risk aggregation
 */
export interface RiskAggregatorInput {
  /** Anti-pattern spotter output (optional) */
  antiPatternOutput?: AntiPatternSpotterOutput;

  /** Module A output with critical thinking and planning data (optional) */
  moduleAOutput?: StructuredAnalysisData;

  /** Metacognition worker output (optional) */
  metacognitionOutput?: MetacognitionOutput;

  /** Temporal analyzer output (optional) */
  temporalOutput?: TemporalAnalysisOutput;
}

// ============================================================================
// Aggregation Functions
// ============================================================================

/**
 * Extract risk signals from anti-pattern output
 *
 * @param output - AntiPatternSpotter output
 * @returns Risk signals
 */
function extractFromAntiPatterns(output: AntiPatternSpotterOutput): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // Parse error loops data: "error_type:repeat_count:avg_turns:example;..."
  if (output.errorLoopsData) {
    const entries = output.errorLoopsData.split(';').filter(Boolean);
    for (const entry of entries) {
      const parts = entry.split(':');
      const errorType = parts[0] || '';
      const repeatCount = parseInt(parts[1], 10) || 0;

      // Error loops with 3+ repeats indicate potential issues
      if (repeatCount >= 3) {
        const severity = Math.min(5, Math.ceil(repeatCount / 2));
        const signal = createRiskSignalFromPattern(
          'sunk_cost_loop',
          severity,
          `Error "${errorType}" repeated ${repeatCount} times`,
          'antiPattern',
          true,
          repeatCount
        );
        if (signal) signals.push(signal);
      }
    }
  }

  // Parse learning avoidance data: "pattern:evidence:severity;..."
  if (output.learningAvoidanceData) {
    const entries = output.learningAvoidanceData.split(';').filter(Boolean);
    for (const entry of entries) {
      const parts = entry.split(':');
      const pattern = parts[0] || '';
      const evidence = parts[1] || '';
      const severityStr = parts[2]?.toLowerCase() || 'medium';

      const severityMap: Record<string, number> = {
        high: 4,
        medium: 3,
        low: 2,
      };
      const severity = severityMap[severityStr] || 3;

      // Map learning avoidance patterns to risk pattern IDs
      let patternId: string;
      if (pattern.includes('copy') || pattern.includes('paste')) {
        patternId = 'passive_acceptance';
      } else if (pattern.includes('skip')) {
        patternId = 'blind_retry';
      } else {
        patternId = 'passive_acceptance';
      }

      const signal = createRiskSignalFromPattern(
        patternId,
        severity,
        evidence,
        'antiPattern',
        false
      );
      if (signal) signals.push(signal);
    }
  }

  // Parse repeated mistakes data: "mistake:count:sessions;..."
  if (output.repeatedMistakesData) {
    const entries = output.repeatedMistakesData.split(';').filter(Boolean);
    for (const entry of entries) {
      const parts = entry.split(':');
      const mistake = parts[0] || '';
      const count = parseInt(parts[1], 10) || 0;
      const sessionIds = parts[2]?.split(',').filter(Boolean) || [];

      if (count >= 3 || sessionIds.length >= 3) {
        const signal = createRiskSignalFromPattern(
          'repeated_blind_spots',
          Math.min(5, Math.ceil(count / 2)),
          `${mistake} repeated ${count} times across ${sessionIds.length} sessions`,
          'antiPattern',
          true,
          count,
          sessionIds
        );
        if (signal) signals.push(signal);
      }
    }
  }

  return signals;
}

/**
 * Extract risk signals from critical thinking and planning analysis
 *
 * @param output - Module A output
 * @returns Risk signals
 */
function extractFromModuleA(output: StructuredAnalysisData): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // Check critical thinking moments (array of CriticalThinkingMoment)
  const criticalMoments = output.criticalThinkingMoments || [];
  const observedTypes = new Set(criticalMoments.map((m) => m.type));

  // Check for missing critical thinking types
  // Map expected types to actual schema enum values
  const expectedTypeMapping: Record<string, string[]> = {
    verification_request: ['verification_request', 'output_validation'],
    assumption_questioning: ['assumption_questioning'],
    alternative_exploration: ['alternative_exploration'],
  };

  for (const [expected, matchingTypes] of Object.entries(expectedTypeMapping)) {
    const hasType = matchingTypes.some((t) => observedTypes.has(t as typeof criticalMoments[number]['type']));

    if (!hasType && criticalMoments.length > 0) {
      // Only flag as missing if we have some critical thinking but missing this type
      // Map expected type to pattern ID
      let patternId: string;
      switch (expected) {
        case 'verification_request':
          patternId = 'missing_verification';
          break;
        case 'assumption_questioning':
          patternId = 'missing_assumption_questioning';
          break;
        default:
          patternId = 'missing_verification';
      }

      const signal = createRiskSignalFromPattern(
        patternId,
        3,
        `Missing ${expected.replace(/_/g, ' ')} behavior`,
        'criticalThinking',
        false
      );
      if (signal) signals.push(signal);
    }
  }

  // If no critical thinking moments at all, flag it
  if (criticalMoments.length === 0) {
    const signal = createRiskSignalFromPattern(
      'missing_verification',
      4,
      'No critical thinking moments detected - AI outputs accepted without questioning',
      'criticalThinking',
      false
    );
    if (signal) signals.push(signal);
  }

  // Check planning behaviors (array of PlanningBehavior)
  const planningBehaviors = output.planningBehaviors || [];
  const observedBehaviorTypes = new Set(planningBehaviors.map((b) => b.behaviorType));

  // Check for task decomposition
  const hasTaskDecomposition = observedBehaviorTypes.has('task_decomposition') ||
    observedBehaviorTypes.has('stepwise_approach') ||
    planningBehaviors.some((b) => b.planHasDecomposition === true);

  if (!hasTaskDecomposition && planningBehaviors.length < 2) {
    const signal = createRiskSignalFromPattern(
      'missing_task_decomposition',
      3,
      'Limited evidence of task decomposition or planning',
      'planning',
      false
    );
    if (signal) signals.push(signal);
  }

  // Check for reactive planning patterns in examples
  const reactiveKeywords = ['immediate', 'quick', 'just fix', 'just do', '빨리', '그냥'];
  const hasReactivePlanning = planningBehaviors.some((b) =>
    reactiveKeywords.some((kw) => b.examples?.toLowerCase().includes(kw) || b.behavior?.toLowerCase().includes(kw))
  );

  if (hasReactivePlanning) {
    const signal = createRiskSignalFromPattern(
      'reactive_planning',
      2,
      'Reactive planning patterns detected',
      'planning',
      false
    );
    if (signal) signals.push(signal);
  }

  return signals;
}

/**
 * Extract risk signals from metacognition analysis
 *
 * @param output - MetacognitionWorker output
 * @returns Risk signals
 */
function extractFromMetacognition(output: MetacognitionOutput): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // Low metacognitive awareness
  if (output.metacognitiveAwarenessScore < 40) {
    const signal = createRiskSignalFromPattern(
      'low_self_awareness',
      Math.max(2, Math.ceil((50 - output.metacognitiveAwarenessScore) / 10)),
      `Low metacognitive awareness score: ${output.metacognitiveAwarenessScore}`,
      'metacognition',
      false
    );
    if (signal) signals.push(signal);
  }

  // Parse blind spots: "pattern|frequency|sessionIds|linkedAntiPattern;..."
  if (output.blindSpotsData) {
    const entries = output.blindSpotsData.split(';').filter(Boolean);
    for (const entry of entries) {
      const parts = entry.split('|');
      const pattern = parts[0] || '';
      const frequency = parseInt(parts[1], 10) || 0;
      const sessionIds = parts[2]?.split(',').filter(Boolean) || [];
      const linkedAntiPattern = parts[3] || '';

      // Use linked anti-pattern if available, otherwise generic
      const patternId = linkedAntiPattern || 'repeated_blind_spots';

      if (frequency >= 3 || sessionIds.length >= 2) {
        const signal = createRiskSignalFromPattern(
          patternId,
          Math.min(5, Math.ceil(frequency / 2)),
          `Blind spot: ${pattern} (${frequency} times)`,
          'metacognition',
          true,
          frequency,
          sessionIds
        );
        if (signal) signals.push(signal);
      }
    }
  }

  return signals;
}

/**
 * Extract risk signals from temporal analysis
 *
 * @param output - TemporalAnalyzerWorker output
 * @returns Risk signals
 */
function extractFromTemporal(output: TemporalAnalysisOutput): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // Parse fatigue patterns: "type|hours|evidence|recommendation;..."
  if (output.fatiguePatternsData) {
    const entries = output.fatiguePatternsData.split(';').filter(Boolean);
    for (const entry of entries) {
      const parts = entry.split('|');
      const type = parts[0] || '';
      const hours = parts[1]?.split(',').map((h) => parseInt(h, 10)).filter((h) => !isNaN(h)) || [];
      const evidence = parts[2] || '';

      // Map temporal pattern types to risk patterns
      const patternMap: Record<string, string> = {
        late_night_drop: 'late_night_drop',
        post_lunch_dip: 'late_night_drop', // Similar risk
        end_of_day_rush: 'late_night_drop',
        typo_spike: 'typo_spike',
      };

      const patternId = patternMap[type] || 'late_night_drop';

      // Severity based on number of affected hours
      const severity = Math.min(5, Math.max(2, Math.ceil(hours.length / 2)));

      const signal = createRiskSignalFromPattern(
        patternId,
        severity,
        evidence || `Fatigue pattern "${type}" detected at hours: ${hours.join(', ')}`,
        'temporal',
        hours.length >= 3, // Recurring if 3+ hours affected
        hours.length
      );
      if (signal) signals.push(signal);
    }
  }

  // Check caution hours for passive acceptance spike
  if (output.cautionHoursData) {
    const parts = output.cautionHoursData.split('|');
    if (parts.length >= 3) {
      const evidenceParts = parts[2].split(':');
      const passiveAcceptanceRate = parseFloat(evidenceParts[0]) || 0;

      // High passive acceptance rate in caution hours
      if (passiveAcceptanceRate > 0.3) {
        const signal = createRiskSignalFromPattern(
          'passive_acceptance_spike',
          Math.ceil(passiveAcceptanceRate * 5),
          `High passive acceptance (${Math.round(passiveAcceptanceRate * 100)}%) during caution hours`,
          'temporal',
          false
        );
        if (signal) signals.push(signal);
      }
    }
  }

  return signals;
}

/**
 * Merge duplicate signals (same type and pattern)
 *
 * @param signals - All extracted signals
 * @returns Merged signals
 */
function mergeSignals(signals: RiskSignal[]): RiskSignal[] {
  const merged = new Map<string, RiskSignal>();

  for (const signal of signals) {
    // Create a key based on type and severity range
    const key = `${signal.type}-${Math.floor(signal.severity / 2)}`;

    if (merged.has(key)) {
      const existing = merged.get(key)!;

      // Merge evidence arrays
      existing.evidenceFromAntiPatterns = [
        ...(existing.evidenceFromAntiPatterns || []),
        ...(signal.evidenceFromAntiPatterns || []),
      ];
      existing.evidenceFromCriticalThinking = [
        ...(existing.evidenceFromCriticalThinking || []),
        ...(signal.evidenceFromCriticalThinking || []),
      ];
      existing.evidenceFromPlanning = [
        ...(existing.evidenceFromPlanning || []),
        ...(signal.evidenceFromPlanning || []),
      ];
      existing.evidenceFromMetacognition = [
        ...(existing.evidenceFromMetacognition || []),
        ...(signal.evidenceFromMetacognition || []),
      ];
      existing.evidenceFromTemporalPatterns = [
        ...(existing.evidenceFromTemporalPatterns || []),
        ...(signal.evidenceFromTemporalPatterns || []),
      ];

      // Merge KB recommendations (dedupe)
      existing.kbRecommendationIds = [
        ...new Set([
          ...(existing.kbRecommendationIds || []),
          ...(signal.kbRecommendationIds || []),
        ]),
      ];

      // Update severity (take max)
      existing.severity = Math.max(existing.severity, signal.severity);

      // Update occurrence count
      existing.occurrenceCount = (existing.occurrenceCount || 1) + (signal.occurrenceCount || 1);

      // Merge session IDs
      existing.sessionIds = [
        ...new Set([...(existing.sessionIds || []), ...(signal.sessionIds || [])]),
      ];

      // Mark as recurring if either is recurring or merged count > 2
      existing.isRecurring =
        existing.isRecurring || signal.isRecurring || (existing.occurrenceCount || 0) > 2;
    } else {
      merged.set(key, { ...signal });
    }
  }

  return Array.from(merged.values());
}

/**
 * Generate top risk signal summaries
 *
 * @param signals - Merged risk signals
 * @returns Top 3 risk summaries
 */
function generateTopRiskSignals(
  signals: RiskSignal[]
): RiskAnalysis['topRiskSignals'] {
  // Sort by severity and recurring status
  const sorted = [...signals].sort((a, b) => {
    const aScore = a.severity * (a.isRecurring ? 1.5 : 1);
    const bScore = b.severity * (b.isRecurring ? 1.5 : 1);
    return bScore - aScore;
  });

  return sorted.slice(0, 3).map((signal) => {
    // Generate summary from evidence
    const allEvidence = [
      ...(signal.evidenceFromAntiPatterns || []),
      ...(signal.evidenceFromCriticalThinking || []),
      ...(signal.evidenceFromPlanning || []),
      ...(signal.evidenceFromMetacognition || []),
      ...(signal.evidenceFromTemporalPatterns || []),
    ];

    const summary =
      allEvidence[0] ||
      `${signal.type.replace('_', ' ')} detected (severity: ${signal.severity})`;

    return {
      type: signal.type,
      summary: summary.slice(0, 300),
      severity: signal.severity,
      isRecurring: signal.isRecurring,
    };
  });
}

// ============================================================================
// Main Aggregation Function
// ============================================================================

/**
 * Aggregate risk signals from multiple analysis sources
 *
 * @param input - Input sources (all optional)
 * @returns Aggregated risk analysis
 */
export function aggregateRiskSignals(input: RiskAggregatorInput): RiskAnalysis {
  const allSignals: RiskSignal[] = [];

  // Extract from each source
  if (input.antiPatternOutput) {
    allSignals.push(...extractFromAntiPatterns(input.antiPatternOutput));
  }

  if (input.moduleAOutput) {
    allSignals.push(...extractFromModuleA(input.moduleAOutput));
  }

  if (input.metacognitionOutput) {
    allSignals.push(...extractFromMetacognition(input.metacognitionOutput));
  }

  if (input.temporalOutput) {
    allSignals.push(...extractFromTemporal(input.temporalOutput));
  }

  // If no signals, return default
  if (allSignals.length === 0) {
    return createDefaultRiskAnalysis();
  }

  // Merge duplicate signals
  const mergedSignals = mergeSignals(allSignals);

  // Calculate scores
  const overallRiskScore = calculateRiskScore(mergedSignals);
  const riskByType = calculateRiskByType(mergedSignals);

  // Generate top risk summaries
  const topRiskSignals = generateTopRiskSignals(mergedSignals);

  // Calculate confidence based on number of sources
  const sourceCount = [
    input.antiPatternOutput,
    input.moduleAOutput,
    input.metacognitionOutput,
    input.temporalOutput,
  ].filter(Boolean).length;
  const confidenceScore = Math.min(0.95, 0.5 + sourceCount * 0.15);

  return {
    overallRiskScore,
    signals: mergedSignals,
    topRiskSignals,
    riskByType,
    confidenceScore,
  };
}

/**
 * Check if risk analysis has significant findings
 *
 * @param analysis - Risk analysis result
 * @returns True if significant risks detected
 */
export function hasSignificantRisks(analysis: RiskAnalysis): boolean {
  return (
    analysis.overallRiskScore >= 30 ||
    analysis.signals.some((s) => s.severity >= 4) ||
    analysis.signals.some((s) => s.isRecurring && s.severity >= 3)
  );
}
