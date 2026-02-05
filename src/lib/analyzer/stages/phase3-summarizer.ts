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

import {
  normalizeReasoning,
  type AgentOutputs,
  type TypeClassifierOutput,
  type KnowledgeGapOutput,
  type ContextEfficiencyOutput,
} from '../../models/agent-outputs';
import type { ThinkingQualityOutput } from '../../models/thinking-quality-data';
import type { CommunicationPatternsOutput } from '../../models/communication-patterns-data';
import type { LearningBehaviorOutput } from '../../models/learning-behavior-data';

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

  // v3.1 workers
  if (agentOutputs.thinkingQuality) {
    sections.push(summarizeThinkingQuality(agentOutputs.thinkingQuality));
  }

  if (agentOutputs.communicationPatterns) {
    sections.push(summarizeCommunicationPatterns(agentOutputs.communicationPatterns));
  }

  if (agentOutputs.learningBehavior) {
    sections.push(summarizeLearningBehavior(agentOutputs.learningBehavior));
  }

  if (agentOutputs.efficiency) {
    sections.push(summarizeEfficiency(agentOutputs.efficiency));
  }

  // Legacy workers (kept for cached data)
  if (agentOutputs.knowledgeGap) {
    sections.push(summarizeKnowledgeGap(agentOutputs.knowledgeGap));
  }

  if (agentOutputs.contextEfficiency) {
    sections.push(summarizeContextEfficiency(agentOutputs.contextEfficiency));
  }

  // Cross-Worker Insight Map — flat consolidated view for contradiction detection
  const insightMap = buildCrossWorkerInsightMap(agentOutputs);
  if (insightMap) {
    sections.push(insightMap);
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
  lines.push(`distribution: architect=${d.architect}, analyst=${d.analyst}, conductor=${d.conductor}, speedrunner=${d.speedrunner}, trendsetter=${d.trendsetter}`);

  const reasoningText = normalizeReasoning(tc.reasoning);
  if (reasoningText) {
    lines.push(`reasoning: ${reasoningText}`);
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

/**
 * v3 ThinkingQuality summarizer
 * Combines: Planning, Critical Thinking, Verification, Communication
 */
function summarizeThinkingQuality(tq: ThinkingQualityOutput): string {
  const lines: string[] = [
    `## ThinkingQuality (score: ${tq.overallThinkingQualityScore}/100, planQuality: ${tq.planQualityScore}/100, confidence: ${tq.confidenceScore})`,
  ];

  if (tq.summary) {
    lines.push(`summary: ${tq.summary}`);
  }

  // Planning Habits
  if (tq.planningHabits.length > 0) {
    lines.push(`### Planning Habits (${tq.planningHabits.length})`);
    tq.planningHabits.forEach((ph, i) => {
      const meta: string[] = [`freq: ${ph.frequency}`];
      if (ph.effectiveness) meta.push(`effectiveness: ${ph.effectiveness}`);
      lines.push(`${i + 1}. [${ph.type}] ${meta.join(', ')}`);
      if (ph.examples?.length > 0) {
        const exampleQuotes = ph.examples.slice(0, 3).map(e => `"${truncateQuote(e)}"`).join(', ');
        lines.push(`   Examples: ${exampleQuotes}`);
      }
    });
  }

  // Critical Thinking Moments
  if (tq.criticalThinkingMoments.length > 0) {
    lines.push(`### Critical Thinking Moments (${tq.criticalThinkingMoments.length})`);
    tq.criticalThinkingMoments.forEach((ct, i) => {
      lines.push(`${i + 1}. [${ct.type}] "${truncateQuote(ct.quote)}" → ${ct.result}`);
    });
  }

  // Verification Behavior
  const vb = tq.verificationBehavior;
  lines.push(`### Verification Behavior`);
  lines.push(`level: ${vb.level}`);
  lines.push(`recommendation: "${vb.recommendation}"`);

  // Verification Anti-Patterns
  if (tq.verificationAntiPatterns?.length > 0) {
    lines.push(`### Verification Anti-Patterns (${tq.verificationAntiPatterns.length})`);
    tq.verificationAntiPatterns.forEach((ap, i) => {
      const meta: string[] = [`freq: ${ap.frequency}`, `severity: ${ap.severity}`];
      if (ap.sessionPercentage !== undefined) meta.push(`sessionPct: ${ap.sessionPercentage}%`);
      lines.push(`${i + 1}. [${ap.type}] ${meta.join(', ')}`);
      if (ap.improvement) {
        lines.push(`   Improvement: "${ap.improvement}"`);
      }
      if (ap.examples?.length > 0) {
        const evidenceStr = ap.examples
          .slice(0, 3)
          .map(e => `${e.utteranceId}: "${truncateQuote(e.quote)}"`)
          .join(', ');
        lines.push(`   Evidence: ${evidenceStr}`);
      }
    });
  }

  // Multitasking
  if (tq.multitaskingPattern) {
    const mt = tq.multitaskingPattern;
    lines.push(`### Multitasking`);
    if (mt.focusScore !== undefined) lines.push(`focusScore: ${mt.focusScore}`);
    lines.push(`mixesTopics: ${mt.mixesTopicsInSessions}`);
    if (mt.recommendation) lines.push(`recommendation: "${mt.recommendation}"`);
  }

  // Strengths summary
  if (tq.strengths && tq.strengths.length > 0) {
    lines.push(`### Strengths (${tq.strengths.length})`);
    for (const s of tq.strengths) {
      lines.push(`- [ThinkingQuality] ${s.title}`);
    }
  }

  // Growth Areas summary
  if (tq.growthAreas && tq.growthAreas.length > 0) {
    lines.push(`### Growth Areas (${tq.growthAreas.length})`);
    for (const g of tq.growthAreas) {
      lines.push(`- [ThinkingQuality] ${g.title} [${g.severity ?? 'medium'}]`);
    }
  }

  return lines.join('\n');
}

/**
 * v3.1 CommunicationPatterns summarizer (separate worker)
 * Summarizes communication patterns and signature quotes
 */
function summarizeCommunicationPatterns(cp: CommunicationPatternsOutput): string {
  const lines: string[] = [
    `## CommunicationPatterns (score: ${cp.overallCommunicationScore}/100, confidence: ${cp.confidenceScore})`,
  ];

  if (cp.summary) {
    lines.push(`summary: ${cp.summary}`);
  }

  // Communication Patterns
  if (cp.communicationPatterns?.length > 0) {
    lines.push(`### Communication Patterns (${cp.communicationPatterns.length})`);
    cp.communicationPatterns.forEach((pattern, i) => {
      lines.push(`${i + 1}. "${pattern.patternName}" [${pattern.frequency}, ${pattern.effectiveness}]`);
      lines.push(`   ${truncateQuote(pattern.description, 200)}`);
    });
  }

  // Signature Quotes
  if (cp.signatureQuotes && cp.signatureQuotes.length > 0) {
    lines.push(`### Signature Quotes (${cp.signatureQuotes.length})`);
    for (const sq of cp.signatureQuotes) {
      lines.push(`- [${sq.utteranceId}] ${truncateQuote(sq.representedStrength, 60)}: ${truncateQuote(sq.significance, 80)}`);
    }
  }

  // Strengths summary
  if (cp.strengths && cp.strengths.length > 0) {
    lines.push(`### Strengths (${cp.strengths.length})`);
    for (const s of cp.strengths) {
      lines.push(`- [CommunicationPatterns] ${s.title}`);
    }
  }

  // Growth Areas summary
  if (cp.growthAreas && cp.growthAreas.length > 0) {
    lines.push(`### Growth Areas (${cp.growthAreas.length})`);
    for (const g of cp.growthAreas) {
      lines.push(`- [CommunicationPatterns] ${g.title} [${g.severity ?? 'medium'}]`);
    }
  }

  return lines.join('\n');
}

/**
 * v3 LearningBehavior summarizer
 * Combines: Knowledge Gaps, Learning Progress, Repeated Mistakes
 */
function summarizeLearningBehavior(lb: LearningBehaviorOutput): string {
  const lines: string[] = [
    `## LearningBehavior (score: ${lb.overallLearningScore}/100, confidence: ${lb.confidenceScore})`,
  ];

  if (lb.summary) {
    lines.push(`summary: ${lb.summary}`);
  }

  // Knowledge Gaps
  if (lb.knowledgeGaps && lb.knowledgeGaps.length > 0) {
    lines.push(`### Knowledge Gaps (${lb.knowledgeGaps.length})`);
    for (let i = 0; i < lb.knowledgeGaps.length; i++) {
      const kg = lb.knowledgeGaps[i];
      lines.push(`${i + 1}. [${kg.topic}] depth: ${kg.depth}, count: ${kg.questionCount}`);
    }
  }

  // Learning Progress
  if (lb.learningProgress && lb.learningProgress.length > 0) {
    lines.push(`### Learning Progress (${lb.learningProgress.length})`);
    for (let i = 0; i < lb.learningProgress.length; i++) {
      const lp = lb.learningProgress[i];
      lines.push(`${i + 1}. [${lp.topic}] ${lp.startLevel} → ${lp.currentLevel}`);
    }
  }

  // Repeated Mistake Patterns
  if (lb.repeatedMistakePatterns && lb.repeatedMistakePatterns.length > 0) {
    lines.push(`### Repeated Mistake Patterns (${lb.repeatedMistakePatterns.length})`);
    for (let i = 0; i < lb.repeatedMistakePatterns.length; i++) {
      const rm = lb.repeatedMistakePatterns[i];
      lines.push(`${i + 1}. [${rm.category}] ${rm.mistakeType} (${rm.occurrenceCount}x)`);
      if (rm.recommendation) {
        lines.push(`   Recommendation: "${rm.recommendation}"`);
      }
    }
  }

  // Strengths summary
  if (lb.strengths && lb.strengths.length > 0) {
    lines.push(`### Strengths (${lb.strengths.length})`);
    for (const s of lb.strengths) {
      lines.push(`- [LearningBehavior] ${s.title}`);
    }
  }

  // Growth Areas summary
  if (lb.growthAreas && lb.growthAreas.length > 0) {
    lines.push(`### Growth Areas (${lb.growthAreas.length})`);
    for (const g of lb.growthAreas) {
      lines.push(`- [LearningBehavior] ${g.title} [${g.severity ?? 'medium'}]`);
    }
  }

  return lines.join('\n');
}

/**
 * v3 Efficiency summarizer (new v3 worker, replaces contextEfficiency)
 */
function summarizeEfficiency(ce: ContextEfficiencyOutput): string {
  const lines: string[] = [
    `## Efficiency (efficiencyScore: ${ce.overallEfficiencyScore}/100, avgFill: ${ce.avgContextFillPercent}%, confidence: ${ce.confidenceScore})`,
  ];

  addTopInsights(lines, ce.topInsights);
  addOptionalSection(lines, 'ProductivitySummary', ce.productivitySummary);

  // Strengths summary
  if (ce.strengths && ce.strengths.length > 0) {
    lines.push(`### Strengths (${ce.strengths.length})`);
    for (const s of ce.strengths) {
      lines.push(`- [Efficiency] ${s.title}`);
    }
  }

  // Growth Areas summary
  if (ce.growthAreas && ce.growthAreas.length > 0) {
    lines.push(`### Growth Areas (${ce.growthAreas.length})`);
    for (const g of ce.growthAreas) {
      lines.push(`- [Efficiency] ${g.title} [${g.severity ?? 'medium'}]`);
    }
  }

  return lines.join('\n');
}

function summarizeKnowledgeGap(kg: KnowledgeGapOutput): string {
  const lines: string[] = [
    `## KnowledgeGap (knowledgeScore: ${kg.overallKnowledgeScore}/100, confidence: ${kg.confidenceScore})`,
  ];

  addTopInsights(lines, kg.topInsights);
  addOptionalSection(lines, 'KnowledgeGaps', kg.knowledgeGapsData);
  addOptionalSection(lines, 'LearningProgress', kg.learningProgressData);

  return lines.join('\n');
}

function summarizeContextEfficiency(ce: ContextEfficiencyOutput): string {
  const lines: string[] = [
    `## ContextEfficiency (efficiencyScore: ${ce.overallEfficiencyScore}/100, avgFill: ${ce.avgContextFillPercent}%, confidence: ${ce.confidenceScore})`,
  ];

  addTopInsights(lines, ce.topInsights);
  addOptionalSection(lines, 'ProductivitySummary', ce.productivitySummary);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-Worker Insight Map
// ─────────────────────────────────────────────────────────────────────────────

interface WorkerInsightEntry {
  domain: string;
  strengths: Array<{ title: string }>;
  growthAreas: Array<{ title: string; severity?: string }>;
}

/**
 * Build a flat consolidated view of ALL strengths and growth areas across ALL workers.
 *
 * This gives ContentWriter a single view to spot overlaps and contradictions
 * between different workers' assessments of the same behavior.
 */
export function buildCrossWorkerInsightMap(agentOutputs: AgentOutputs): string | null {
  const workers: WorkerInsightEntry[] = [];

  if (agentOutputs.thinkingQuality) {
    workers.push({
      domain: 'ThinkingQuality',
      strengths: agentOutputs.thinkingQuality.strengths ?? [],
      growthAreas: agentOutputs.thinkingQuality.growthAreas ?? [],
    });
  }

  if (agentOutputs.communicationPatterns) {
    workers.push({
      domain: 'CommunicationPatterns',
      strengths: agentOutputs.communicationPatterns.strengths ?? [],
      growthAreas: agentOutputs.communicationPatterns.growthAreas ?? [],
    });
  }

  if (agentOutputs.learningBehavior) {
    workers.push({
      domain: 'LearningBehavior',
      strengths: agentOutputs.learningBehavior.strengths ?? [],
      growthAreas: agentOutputs.learningBehavior.growthAreas ?? [],
    });
  }

  if (agentOutputs.efficiency) {
    workers.push({
      domain: 'Efficiency',
      strengths: agentOutputs.efficiency.strengths ?? [],
      growthAreas: agentOutputs.efficiency.growthAreas ?? [],
    });
  }

  const allStrengths = workers.flatMap(w =>
    w.strengths.map(s => `- [${w.domain}] "${s.title}"`)
  );
  const allGrowthAreas = workers.flatMap(w =>
    w.growthAreas.map(g => `- [${w.domain}] "${g.title}" [${g.severity ?? 'medium'}]`)
  );

  if (allStrengths.length === 0 && allGrowthAreas.length === 0) {
    return null;
  }

  const lines: string[] = ['## Cross-Worker Insight Map'];

  if (allStrengths.length > 0) {
    lines.push('### All Strengths:');
    lines.push(...allStrengths);
  }

  if (allGrowthAreas.length > 0) {
    lines.push('### All Growth Areas:');
    lines.push(...allGrowthAreas);
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
function truncateQuote(text: string, maxLength: number = 1000): string {
  if (text.length <= maxLength) return text;
  const cutPoint = text.lastIndexOf(' ', maxLength);
  const truncated = cutPoint > maxLength * 0.6 ? text.slice(0, cutPoint) : text.slice(0, maxLength);
  return truncated + '...';
}

/**
 * Add top insights section if available
 */
function addTopInsights(lines: string[], insights: string[] | undefined): void {
  if (!insights || insights.length === 0) return;
  lines.push(`### Top Insights`);
  for (const insight of insights) {
    lines.push(`- "${insight}"`);
  }
}

/**
 * Add optional section with header if data exists
 */
function addOptionalSection(lines: string[], header: string, data: string | undefined): void {
  if (!data) return;
  lines.push(`### ${header}`);
  lines.push(data);
}
