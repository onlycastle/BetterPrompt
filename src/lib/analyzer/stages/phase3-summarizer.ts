/**
 * Phase 3 Summarizer - Structured summary of Phase 2 agent outputs
 *
 * Replaces raw JSON.stringify(agentOutputs) with a compact, structured
 * text format that Phase 3 (Content Writer) can efficiently parse.
 *
 * Design principles:
 * - Use ## headers for LLM navigation
 * - Include scores in headers for quick scanning
 * - For structured arrays, format as numbered items with key fields
 * - For flat data strings, pass through as-is (Phase 3 prompt already knows the format)
 * - Skip undefined/null/empty optional fields
 *
 * @module analyzer/stages/phase3-summarizer
 */

import type { AgentOutputs } from '../../models/agent-outputs';
import type { TypeClassifierOutput } from '../../models/agent-outputs';
import type { StrengthGrowthOutput } from '../../models/strength-growth-data';
import type { TrustVerificationOutput } from '../../models/trust-verification-data';
import type { WorkflowHabitOutput } from '../../models/workflow-habit-data';
import type { KnowledgeGapOutput, ContextEfficiencyOutput } from '../../models/agent-outputs';

/**
 * Summarize all Phase 2 agent outputs into structured text for Phase 3.
 *
 * Produces ~15-20K chars instead of 50-100K from JSON.stringify.
 */
export function summarizeAgentOutputsForPhase3(agentOutputs: AgentOutputs): string {
  const sections: string[] = [];

  if (agentOutputs.typeClassifier) {
    sections.push(summarizeTypeClassifier(agentOutputs.typeClassifier));
  }

  if (agentOutputs.strengthGrowth) {
    sections.push(summarizeStrengthGrowth(agentOutputs.strengthGrowth));
  }

  if (agentOutputs.trustVerification) {
    sections.push(summarizeTrustVerification(agentOutputs.trustVerification));
  }

  if (agentOutputs.workflowHabit) {
    sections.push(summarizeWorkflowHabit(agentOutputs.workflowHabit));
  }

  if (agentOutputs.knowledgeGap) {
    sections.push(summarizeKnowledgeGap(agentOutputs.knowledgeGap));
  }

  if (agentOutputs.contextEfficiency) {
    sections.push(summarizeContextEfficiency(agentOutputs.contextEfficiency));
  }

  return sections.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-Worker Summarizers
// ─────────────────────────────────────────────────────────────────────────────

function summarizeTypeClassifier(tc: TypeClassifierOutput): string {
  const lines: string[] = [
    `## TypeClassifier (confidence: ${tc.confidenceScore})`,
    `primaryType: ${tc.primaryType}`,
    `controlLevel: ${tc.controlLevel}`,
    `controlScore: ${tc.controlScore}`,
    `matrixName: ${tc.matrixName}`,
    `matrixEmoji: ${tc.matrixEmoji}`,
  ];

  const d = tc.distribution;
  lines.push(`distribution: architect=${d.architect}, scientist=${d.scientist}, collaborator=${d.collaborator}, speedrunner=${d.speedrunner}, craftsman=${d.craftsman}`);

  if (tc.reasoning) {
    lines.push(`reasoning: ${tc.reasoning}`);
  }

  if (tc.collaborationMaturity) {
    const cm = tc.collaborationMaturity;
    lines.push(`collaborationMaturity: ${cm.level} — "${cm.description}"`);
    if (cm.indicators && cm.indicators.length > 0) {
      lines.push(`  indicators: ${JSON.stringify(cm.indicators)}`);
    }
  }

  if (tc.adjustmentReasons && tc.adjustmentReasons.length > 0) {
    lines.push(`adjustmentReasons:`);
    for (const reason of tc.adjustmentReasons) {
      lines.push(`  - ${reason}`);
    }
  }

  if (tc.synthesisEvidence) {
    lines.push(`synthesisEvidence: ${tc.synthesisEvidence}`);
  }

  return lines.join('\n');
}

function summarizeStrengthGrowth(sg: StrengthGrowthOutput): string {
  const lines: string[] = [
    `## StrengthGrowth (confidence: ${sg.confidenceScore})`,
  ];

  if (sg.summary) {
    lines.push(`summary: ${sg.summary}`);
  }

  // Strengths
  if (sg.strengths.length > 0) {
    lines.push(`### Strengths (${sg.strengths.length})`);
    for (let i = 0; i < sg.strengths.length; i++) {
      const s = sg.strengths[i];
      lines.push(`${i + 1}. [${s.dimension}] ${s.title}`);
      lines.push(`   "${s.description}"`);
      if (s.evidence && s.evidence.length > 0) {
        const evidenceStr = s.evidence
          .slice(0, 5)
          .map(e => `${e.utteranceId}: "${truncateQuote(e.quote)}"`)
          .join(', ');
        lines.push(`   Evidence: ${evidenceStr}`);
      }
      if (s.developmentTip) {
        lines.push(`   Tip: ${s.developmentTip}`);
      }
    }
  }

  // Growth Areas
  if (sg.growthAreas.length > 0) {
    lines.push(`### Growth Areas (${sg.growthAreas.length})`);
    for (let i = 0; i < sg.growthAreas.length; i++) {
      const g = sg.growthAreas[i];
      const meta: string[] = [];
      if (g.frequency !== undefined) meta.push(`freq: ${g.frequency}%`);
      if (g.severity) meta.push(`severity: ${g.severity}`);
      if (g.priorityScore !== undefined) meta.push(`priority: ${g.priorityScore}`);
      const metaStr = meta.length > 0 ? ` (${meta.join(', ')})` : '';
      lines.push(`${i + 1}. [${g.dimension}] ${g.title}${metaStr}`);
      lines.push(`   "${g.description}"`);
      if (g.evidence && g.evidence.length > 0) {
        const evidenceStr = g.evidence
          .slice(0, 4)
          .map(e => `${e.utteranceId}: "${truncateQuote(e.quote)}"`)
          .join(', ');
        lines.push(`   Evidence: ${evidenceStr}`);
      }
      lines.push(`   Recommendation: ${g.recommendation}`);
    }
  }

  // Pass-through data strings
  if (sg.personalizedPrioritiesData) {
    lines.push(`### PersonalizedPriorities`);
    lines.push(sg.personalizedPrioritiesData);
  }

  if (sg.absenceBasedSignalsData) {
    lines.push(`### AbsenceBasedSignals`);
    lines.push(sg.absenceBasedSignalsData);
  }

  return lines.join('\n');
}

function summarizeTrustVerification(tv: TrustVerificationOutput): string {
  const lines: string[] = [
    `## TrustVerification (trustHealth: ${tv.overallTrustHealthScore}/100, confidence: ${tv.confidenceScore})`,
  ];

  if (tv.summary) {
    lines.push(`summary: ${tv.summary}`);
  }

  // Anti-Patterns
  if (tv.antiPatterns.length > 0) {
    lines.push(`### Anti-Patterns (${tv.antiPatterns.length})`);
    for (let i = 0; i < tv.antiPatterns.length; i++) {
      const ap = tv.antiPatterns[i];
      const meta: string[] = [`freq: ${ap.frequency}`];
      meta.push(`severity: ${ap.severity}`);
      if (ap.sessionPercentage !== undefined) meta.push(`sessionPct: ${ap.sessionPercentage}%`);
      lines.push(`${i + 1}. [${ap.type}] ${meta.join(', ')}`);
      if (ap.improvement) {
        lines.push(`   Improvement: "${ap.improvement}"`);
      }
      if (ap.examples && ap.examples.length > 0) {
        const evidenceStr = ap.examples
          .slice(0, 3)
          .map(e => `${e.utteranceId}: "${truncateQuote(e.quote)}"`)
          .join(', ');
        lines.push(`   Evidence: ${evidenceStr}`);
      }
    }
  }

  // Verification Behavior
  // Mapping: blind_trust ↔ vibe_coder, occasional_review ↔ supervised_coder,
  //          systematic_verification ↔ ai_assisted_engineer, skeptical ↔ reluctant_user
  // ContentWriter should reconcile this with TypeClassifier's collaborationMaturity.level
  const vb = tv.verificationBehavior;
  lines.push(`### Verification Behavior`);
  lines.push(`level: ${vb.level}`);
  lines.push(`recommendation: "${vb.recommendation}"`);

  // Pass-through data strings
  if (tv.detectedPatternsData) {
    lines.push(`### DetectedPatterns`);
    lines.push(tv.detectedPatternsData);
  }

  if (tv.actionablePatternMatchesData) {
    lines.push(`### ActionablePatternMatches`);
    lines.push(tv.actionablePatternMatchesData);
  }

  return lines.join('\n');
}

function summarizeWorkflowHabit(wh: WorkflowHabitOutput): string {
  const lines: string[] = [
    `## WorkflowHabit (workflowScore: ${wh.overallWorkflowScore}/100, confidence: ${wh.confidenceScore})`,
  ];

  if (wh.summary) {
    lines.push(`summary: ${wh.summary}`);
  }

  // Planning Habits
  if (wh.planningHabits.length > 0) {
    lines.push(`### Planning Habits (${wh.planningHabits.length})`);
    for (let i = 0; i < wh.planningHabits.length; i++) {
      const ph = wh.planningHabits[i];
      const meta: string[] = [`freq: ${ph.frequency}`];
      if (ph.effectiveness) meta.push(`effectiveness: ${ph.effectiveness}`);
      lines.push(`${i + 1}. [${ph.type}] ${meta.join(', ')}`);
      if (ph.examples && ph.examples.length > 0) {
        lines.push(`   Examples: ${ph.examples.slice(0, 3).map(e => `"${truncateQuote(e)}"`).join(', ')}`);
      }
    }
  }

  // Critical Thinking Moments
  if (wh.criticalThinkingMoments.length > 0) {
    lines.push(`### Critical Thinking Moments (${wh.criticalThinkingMoments.length})`);
    for (let i = 0; i < wh.criticalThinkingMoments.length; i++) {
      const ct = wh.criticalThinkingMoments[i];
      lines.push(`${i + 1}. [${ct.type}] "${truncateQuote(ct.quote)}" → ${ct.result}`);
    }
  }

  // Multitasking
  if (wh.multitaskingPattern) {
    const mt = wh.multitaskingPattern;
    lines.push(`### Multitasking`);
    if (mt.focusScore !== undefined) lines.push(`focusScore: ${mt.focusScore}`);
    lines.push(`mixesTopics: ${mt.mixesTopicsInSessions}`);
    if (mt.recommendation) lines.push(`recommendation: "${mt.recommendation}"`);
  }

  return lines.join('\n');
}

function summarizeKnowledgeGap(kg: KnowledgeGapOutput): string {
  const lines: string[] = [
    `## KnowledgeGap (knowledgeScore: ${kg.overallKnowledgeScore}/100, confidence: ${kg.confidenceScore})`,
  ];

  // Top Insights
  if (kg.topInsights && kg.topInsights.length > 0) {
    lines.push(`### Top Insights`);
    for (const insight of kg.topInsights) {
      lines.push(`- "${insight}"`);
    }
  }

  // Pass-through data strings
  if (kg.knowledgeGapsData) {
    lines.push(`### KnowledgeGaps`);
    lines.push(kg.knowledgeGapsData);
  }

  if (kg.learningProgressData) {
    lines.push(`### LearningProgress`);
    lines.push(kg.learningProgressData);
  }

  return lines.join('\n');
}

function summarizeContextEfficiency(ce: ContextEfficiencyOutput): string {
  const lines: string[] = [
    `## ContextEfficiency (efficiencyScore: ${ce.overallEfficiencyScore}/100, avgFill: ${ce.avgContextFillPercent}%, confidence: ${ce.confidenceScore})`,
  ];

  // Top Insights
  if (ce.topInsights && ce.topInsights.length > 0) {
    lines.push(`### Top Insights`);
    for (const insight of ce.topInsights) {
      lines.push(`- "${insight}"`);
    }
  }

  // Pass-through productivity data
  if (ce.productivitySummary) {
    lines.push(`### ProductivitySummary`);
    lines.push(ce.productivitySummary);
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Truncate a quote string to a max length for the summary.
 * Preserves readability by cutting at word boundaries.
 */
function truncateQuote(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) return text;
  const cutPoint = text.lastIndexOf(' ', maxLength);
  const truncated = cutPoint > maxLength * 0.6 ? text.slice(0, cutPoint) : text.slice(0, maxLength);
  return truncated + '...';
}
