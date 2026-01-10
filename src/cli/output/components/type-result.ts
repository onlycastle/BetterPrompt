/**
 * Type Result Component
 *
 * Renders the AI Coding Style analysis result in terminal.
 * Shows primary type, distribution chart, and key metrics.
 */

import pc from 'picocolors';
import boxen from 'boxen';
import {
  type TypeResult,
  type CodingStyleType,
  TYPE_METADATA,
} from '../../../models/index.js';
import { type FullAnalysisResult } from '../../../analyzer/dimensions/index.js';

/**
 * Render the main type result display
 */
export function renderTypeResult(result: TypeResult): string {
  const lines: string[] = [];
  const meta = TYPE_METADATA[result.primaryType];

  // Main title box
  const titleContent = `${meta.emoji}  YOU ARE ${meta.name.toUpperCase()}`;
  const tagline = `"${meta.tagline}"`;

  const titleBox = boxen(
    `\n${pc.bold(pc.white(titleContent))}\n\n${pc.cyan(tagline)}\n`,
    {
      padding: { left: 4, right: 4, top: 1, bottom: 1 },
      borderStyle: 'round',
      borderColor: 'cyan',
      textAlignment: 'center',
    }
  );

  lines.push('');
  lines.push(titleBox);
  lines.push('');

  return lines.join('\n');
}

/**
 * Render the style distribution chart
 */
export function renderDistribution(result: TypeResult): string {
  const lines: string[] = [];
  const types: CodingStyleType[] = [
    'architect',
    'scientist',
    'collaborator',
    'speedrunner',
    'craftsman',
  ];

  lines.push(pc.bold('  📊 Style Distribution'));
  lines.push('');

  for (const type of types) {
    const meta = TYPE_METADATA[type];
    const pct = result.distribution[type];
    const barWidth = 16;
    const filled = Math.round((pct / 100) * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

    const isPrimary = type === result.primaryType;
    const colorFn = isPrimary ? pc.cyan : pc.dim;
    const marker = isPrimary ? pc.cyan(' ←') : '';

    const typeName = meta.name.padEnd(12);
    const pctStr = `${pct}%`.padStart(4);

    lines.push(
      `   ${meta.emoji} ${colorFn(typeName)} ${colorFn(bar)} ${colorFn(pctStr)}${marker}`
    );
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Render key metrics summary
 */
export function renderMetricsSummary(result: TypeResult): string {
  const lines: string[] = [];
  const { metrics } = result;

  lines.push(pc.bold('  📈 Key Metrics'));
  lines.push('');

  const metricItems = [
    { label: 'Avg prompt length', value: `${metrics.avgPromptLength} chars` },
    { label: 'First prompt length', value: `${metrics.avgFirstPromptLength} chars` },
    { label: 'Avg turns/session', value: `${metrics.avgTurnsPerSession}` },
    { label: 'Question frequency', value: `${metrics.questionFrequency}/turn` },
    { label: 'Modification rate', value: `${Math.round(metrics.modificationRate * 100)}%` },
    { label: 'Top tools', value: metrics.toolUsageHighlight },
  ];

  for (const item of metricItems) {
    lines.push(`   ${pc.dim('•')} ${pc.dim(item.label + ':')} ${pc.white(item.value)}`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Render strengths section
 */
export function renderStrengths(result: TypeResult): string {
  const lines: string[] = [];
  const meta = TYPE_METADATA[result.primaryType];

  lines.push(pc.bold('  ✨ Your Strengths'));
  lines.push('');

  for (const strength of meta.strengths) {
    lines.push(`   ${pc.green('✓')} ${pc.white(strength)}`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Render growth points section
 */
export function renderGrowthPoints(result: TypeResult): string {
  const lines: string[] = [];
  const meta = TYPE_METADATA[result.primaryType];

  lines.push(pc.bold('  🌱 Growth Points'));
  lines.push('');

  for (const point of meta.growthPoints) {
    lines.push(`   ${pc.yellow('→')} ${pc.dim(point)}`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Render evidence samples
 */
export function renderEvidence(
  result: TypeResult,
  maxSamples: number = 3
): string {
  const lines: string[] = [];
  const samples = result.evidence.slice(0, maxSamples);

  if (samples.length === 0) {
    return '';
  }

  lines.push(pc.bold('  💬 Evidence'));
  lines.push('');

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const meta = TYPE_METADATA[sample.type];
    const quoteLines = wrapQuote(sample.quote, 60);

    lines.push(`   ${pc.dim(`${i + 1}.`)} ${meta.emoji} ${pc.dim(sample.explanation)}`);
    for (const line of quoteLines) {
      lines.push(`   ${pc.dim('│')} ${pc.italic(pc.white(line))}`);
    }
    lines.push('');
  }

  if (result.evidence.length > maxSamples) {
    const remaining = result.evidence.length - maxSamples;
    lines.push(pc.dim(`   ... and ${remaining} more examples`));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render the locked section teaser (for free tier)
 */
export function renderLockedTeaser(): string {
  const lines: string[] = [];

  lines.push(pc.dim('  ─'.repeat(30)));
  lines.push('');

  const lockedItems = [
    '📊 Detailed metrics comparison',
    '💬 All conversation evidence (8 samples)',
    '🎯 Personalized growth roadmap',
    '📚 Professional insights & best practices',
    '📄 PDF download',
    '🏷️ Shareable badge',
  ];

  lines.push(pc.bold('  🔒 Unlock Full Analysis'));
  lines.push('');

  for (const item of lockedItems) {
    lines.push(`   ${pc.dim(item)}`);
  }

  lines.push('');

  const ctaBox = boxen(
    `${pc.bold('☕ ONE-TIME: $6.99')}\n${pc.dim('Less than a coffee')}\n${pc.dim('Unlock this analysis forever')}`,
    {
      padding: { left: 2, right: 2, top: 0, bottom: 0 },
      borderStyle: 'round',
      borderColor: 'yellow',
      textAlignment: 'center',
    }
  );

  lines.push(ctaBox);
  lines.push('');

  return lines.join('\n');
}

/**
 * Render web report link
 */
export function renderWebLink(port: number = 3000): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(
    `  ${pc.bold('🌐 View detailed report')} → ${pc.cyan(`http://localhost:${port}`)}`
  );
  lines.push('');

  return lines.join('\n');
}

/**
 * Render full type result for CLI
 */
export function renderFullTypeResult(
  result: TypeResult,
  options: {
    showEvidence?: boolean;
    maxEvidence?: number;
    showLockedTeaser?: boolean;
    webPort?: number;
  } = {}
): string {
  const {
    showEvidence = true,
    maxEvidence = 2,
    showLockedTeaser = true,
    webPort = 3000,
  } = options;

  const sections = [
    renderTypeResult(result),
    renderDistribution(result),
    renderStrengths(result),
    showEvidence ? renderEvidence(result, maxEvidence) : '',
    showLockedTeaser ? renderLockedTeaser() : '',
    renderWebLink(webPort),
  ];

  return sections.filter(Boolean).join('\n');
}

/**
 * Render dimension summary (compact CLI preview)
 */
export function renderDimensionSummary(dimensions: FullAnalysisResult): string {
  const lines: string[] = [];

  lines.push(pc.bold('  📈 Deep Analysis (Preview)'));
  lines.push('');

  // AI Collaboration Mastery - show score and level
  const collab = dimensions.aiCollaboration;
  const collabColor =
    collab.level === 'expert' || collab.level === 'proficient'
      ? pc.green
      : collab.level === 'developing'
        ? pc.cyan
        : pc.yellow;
  lines.push(
    `   🤝 ${pc.dim('AI Collaboration:')} ${collabColor(collab.score.toString())}${pc.dim('/100')} ${collabColor(`(${collab.level})`)}`
  );

  // Context Engineering breakdown
  const ctx = collab.breakdown.contextEngineering;
  lines.push(
    `      ${pc.dim('├─ Context Engineering:')} ${pc.white(ctx.score.toString())}${pc.dim('/100')}`
  );

  // Structured Planning breakdown
  const plan = collab.breakdown.structuredPlanning;
  lines.push(
    `      ${pc.dim('├─ Structured Planning:')} ${pc.white(plan.score.toString())}${pc.dim('/100')}`
  );

  // AI Orchestration breakdown
  const orch = collab.breakdown.aiOrchestration;
  lines.push(
    `      ${pc.dim('├─ AI Orchestration:')} ${pc.white(orch.score.toString())}${pc.dim('/100')}`
  );

  // Critical Verification breakdown
  const verify = collab.breakdown.criticalVerification;
  lines.push(
    `      ${pc.dim('└─ Critical Verification:')} ${pc.white(verify.score.toString())}${pc.dim('/100')}`
  );

  lines.push('');

  // Prompt Score - show score
  const prompt = dimensions.promptScore;
  const promptColor = prompt.score >= 70 ? pc.green : prompt.score >= 50 ? pc.cyan : pc.yellow;
  lines.push(
    `   🎯 ${pc.dim('Prompt Score:')} ${promptColor(prompt.score.toString())}${pc.dim('/100')}`
  );

  // Burnout Risk - teaser (locked)
  lines.push(
    `   🔥 ${pc.dim('Burnout Risk:')} ${pc.yellow('?')}${pc.dim('/100')} ${pc.dim('(unlock to see)')}`
  );

  // Tool Mastery - show score
  const tools = dimensions.toolMastery;
  lines.push(
    `   🛠️  ${pc.dim('Tool Mastery:')} ${pc.cyan(tools.overallScore.toString())}${pc.dim('/100')}`
  );

  lines.push('');
  lines.push(pc.dim('   → See full breakdown in web report'));
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// Helper functions
// ============================================================================

function wrapQuote(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 > width && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
