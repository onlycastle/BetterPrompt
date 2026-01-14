/**
 * Verbose Report Component
 *
 * Renders the hyper-personalized verbose evaluation in terminal.
 * Shows full evidence quotes, personality summary, and locked premium content teaser.
 */

import pc from 'picocolors';
import boxen from 'boxen';
import {
  type VerboseEvaluation,
  type PersonalizedEvidence,
} from '../../../models/verbose-evaluation.js';
import {
  TYPE_METADATA,
  MATRIX_METADATA,
  MATRIX_NAMES,
  type CodingStyleType,
} from '../../../models/coding-style.js';

/**
 * Render the complete verbose report
 */
export function renderVerboseReport(
  evaluation: VerboseEvaluation,
  isUnlocked: boolean = false
): string {
  const sections = [
    renderTypeResultWithMatrix(evaluation),
    renderDistributionChart(evaluation),
    renderPersonalitySummary(evaluation),
    renderStrengths(evaluation),
    renderGrowthAreas(evaluation),
    renderPromptPatterns(evaluation),
    isUnlocked ? renderPremiumContent(evaluation) : renderLockedPremiumTeaser(),
  ];

  return sections.filter(Boolean).join('\n');
}

/**
 * Render type result with matrix name
 */
function renderTypeResultWithMatrix(evaluation: VerboseEvaluation): string {
  const lines: string[] = [];
  const typeMeta = TYPE_METADATA[evaluation.primaryType];
  const matrixMeta = MATRIX_METADATA[evaluation.primaryType][evaluation.controlLevel];
  const matrixName = MATRIX_NAMES[evaluation.primaryType][evaluation.controlLevel];

  // Main title box with matrix combination
  const titleContent = `${matrixMeta.emoji}  YOU ARE ${matrixName.toUpperCase()}`;
  const subtitle = `${typeMeta.emoji} ${typeMeta.name} × ${evaluation.controlLevel.replace('-', ' ')}`;
  const tagline = `"${typeMeta.tagline}"`;

  const titleBox = boxen(
    `\n${pc.bold(pc.white(titleContent))}\n${pc.dim(subtitle)}\n\n${pc.cyan(tagline)}\n`,
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
function renderDistributionChart(evaluation: VerboseEvaluation): string {
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
    const pct = evaluation.distribution[type];
    const barWidth = 16;
    const filled = Math.round((pct / 100) * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

    const isPrimary = type === evaluation.primaryType;
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
 * Render personality summary
 */
function renderPersonalitySummary(evaluation: VerboseEvaluation): string {
  const lines: string[] = [];

  lines.push(pc.bold('  💭 Your AI Coding Personality'));
  lines.push('');

  const wrapped = wrapText(evaluation.personalitySummary, 70);
  for (const line of wrapped) {
    lines.push(`   ${pc.white(line)}`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Render strengths section with full evidence quotes
 */
function renderStrengths(evaluation: VerboseEvaluation): string {
  const lines: string[] = [];

  lines.push(pc.bold('  ✨ Your Strengths'));
  lines.push('');

  // Handle legacy global strengths (deprecated, but supported)
  const strengths = evaluation.strengths ?? [];
  if (strengths.length === 0) {
    lines.push(pc.dim('     No global strengths available. See dimension-specific insights.'));
    lines.push('');
    return lines.join('\n');
  }

  for (const strength of strengths) {
    // Strength title with percentile if available
    const percentileText = strength.percentile
      ? pc.dim(` (Top ${100 - strength.percentile}%)`)
      : '';
    lines.push(`   ${pc.green('●')} ${pc.bold(pc.white(strength.title))}${percentileText}`);
    lines.push('');

    // Description
    const descWrapped = wrapText(strength.description, 65);
    for (const line of descWrapped) {
      lines.push(`     ${pc.dim(line)}`);
    }
    lines.push('');

    // Evidence with full quotes
    lines.push(`     ${pc.dim('Evidence:')}`);
    for (const evidence of strength.evidence) {
      lines.push(renderEvidence(evidence, 8));
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render growth areas section with quotes
 */
function renderGrowthAreas(evaluation: VerboseEvaluation): string {
  const lines: string[] = [];

  lines.push(pc.bold('  🌱 Growth Areas'));
  lines.push('');

  // Handle legacy global growth areas (deprecated, but supported)
  const growthAreas = evaluation.growthAreas ?? [];
  if (growthAreas.length === 0) {
    lines.push(pc.dim('     No global growth areas available. See dimension-specific insights.'));
    lines.push('');
    return lines.join('\n');
  }

  for (const area of growthAreas) {
    // Area title
    lines.push(`   ${pc.yellow('→')} ${pc.bold(pc.white(area.title))}`);
    lines.push('');

    // Description
    const descWrapped = wrapText(area.description, 65);
    for (const line of descWrapped) {
      lines.push(`     ${pc.dim(line)}`);
    }
    lines.push('');

    // Evidence examples
    if (area.evidence.length > 0) {
      lines.push(`     ${pc.dim('Examples:')}`);
      for (const evidence of area.evidence) {
        lines.push(renderEvidence(evidence, 8));
      }
    }

    // Recommendation
    lines.push(`     ${pc.cyan('💡 Recommendation:')}`);
    const recWrapped = wrapText(area.recommendation, 65);
    for (const line of recWrapped) {
      lines.push(`     ${pc.white(line)}`);
    }

    // Resources if available
    if (area.resources && area.resources.length > 0) {
      lines.push('');
      lines.push(`     ${pc.dim('Resources:')}`);
      for (const resource of area.resources) {
        lines.push(`     ${pc.dim('•')} ${pc.cyan(resource)}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render prompt patterns section
 */
function renderPromptPatterns(evaluation: VerboseEvaluation): string {
  const lines: string[] = [];

  lines.push(pc.bold('  💬 Your Prompt Patterns'));
  lines.push('');

  for (const pattern of evaluation.promptPatterns) {
    // Pattern header with frequency and effectiveness
    const freqIcon = getFrequencyIcon(pattern.frequency);
    const effIcon = getEffectivenessIcon(pattern.effectiveness);

    lines.push(
      `   ${freqIcon} ${pc.bold(pc.white(pattern.patternName))} ${pc.dim('•')} ${effIcon}`
    );
    lines.push('');

    // Description
    const descWrapped = wrapText(pattern.description, 65);
    for (const line of descWrapped) {
      lines.push(`     ${pc.dim(line)}`);
    }
    lines.push('');

    // Examples
    lines.push(`     ${pc.dim('Examples:')}`);
    for (const example of pattern.examples) {
      const quoteWrapped = wrapQuote(example.quote, 60);
      for (const line of quoteWrapped) {
        lines.push(`     ${pc.dim('│')} ${pc.italic(pc.white(line))}`);
      }
      const analysisWrapped = wrapText(example.analysis, 60);
      for (const line of analysisWrapped) {
        lines.push(`     ${pc.dim('→')} ${pc.dim(line)}`);
      }
      lines.push('');
    }

    // Tip if available
    if (pattern.tip) {
      lines.push(`     ${pc.cyan('💡 Tip:')}`);
      const tipWrapped = wrapText(pattern.tip, 65);
      for (const line of tipWrapped) {
        lines.push(`     ${pc.white(line)}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Render premium content (when unlocked)
 */
function renderPremiumContent(evaluation: VerboseEvaluation): string {
  const lines: string[] = [];

  lines.push(pc.dim('  ─'.repeat(30)));
  lines.push('');
  lines.push(pc.bold('  🎯 PREMIUM INSIGHTS'));
  lines.push('');

  // Tool Usage Deep Dive
  if (evaluation.toolUsageDeepDive) {
    lines.push(pc.bold('  🛠️  Tool Usage Deep Dive'));
    lines.push('');
    for (const insight of evaluation.toolUsageDeepDive) {
      lines.push(
        `   ${pc.cyan('●')} ${pc.bold(insight.toolName)} - ${insight.usagePercentage}% of usage`
      );
      lines.push(`     ${pc.white(insight.insightTitle)}`);
      lines.push(`     ${pc.dim(insight.insight)}`);
      lines.push(`     ${pc.dim(insight.comparison)}`);
      if (insight.recommendation) {
        lines.push(`     ${pc.yellow('→')} ${insight.recommendation}`);
      }
      lines.push('');
    }
  }

  // Token Efficiency
  if (evaluation.tokenEfficiency) {
    const eff = evaluation.tokenEfficiency;
    lines.push(pc.bold('  💰 Token Efficiency'));
    lines.push('');
    lines.push(
      `   Score: ${getEfficiencyColor(eff.tokenEfficiencyScore)(eff.tokenEfficiencyScore.toString())}${pc.dim('/100')} ${pc.dim(`(${eff.efficiencyLevel.replace('_', ' ')})`)}`
    );
    lines.push(`   ${pc.dim('Avg tokens/session:')} ${eff.averageTokensPerSession}`);
    lines.push(`   ${pc.dim('Potential savings:')} ${eff.savingsEstimate}`);
    lines.push('');
    for (const insight of eff.insights) {
      const impactColor = getImpactColor(insight.impact);
      lines.push(
        `   ${impactColor('●')} ${pc.white(insight.title)} ${pc.dim(`(${insight.impact} impact)`)}`
      );
      const descWrapped = wrapText(insight.description, 65);
      for (const line of descWrapped) {
        lines.push(`     ${pc.dim(line)}`);
      }
      lines.push('');
    }
  }

  // Growth Roadmap
  if (evaluation.growthRoadmap) {
    const roadmap = evaluation.growthRoadmap;
    lines.push(pc.bold('  🗺️  Growth Roadmap'));
    lines.push('');
    lines.push(`   Current Level: ${pc.cyan(roadmap.currentLevel)}`);
    lines.push(`   Next Milestone: ${pc.bold(pc.white(roadmap.nextMilestone))}`);
    lines.push(`   Estimated Time: ${pc.dim(roadmap.estimatedTimeToNextLevel)}`);
    lines.push('');

    for (const step of roadmap.steps) {
      lines.push(`   ${pc.cyan(step.order.toString() + '.')} ${pc.bold(step.title)}`);
      const descWrapped = wrapText(step.description, 65);
      for (const line of descWrapped) {
        lines.push(`     ${pc.dim(line)}`);
      }
      lines.push(`     ${pc.dim('Time:')} ${step.timeEstimate}`);
      lines.push(`     ${pc.dim('Measure:')} ${step.metrics}`);
      lines.push('');
    }
  }

  // Comparative Insights
  if (evaluation.comparativeInsights && evaluation.comparativeInsights.length > 0) {
    lines.push(pc.bold('  📊 How You Compare'));
    lines.push('');
    for (const insight of evaluation.comparativeInsights) {
      const comparison = insight.yourValue > insight.averageValue ? '↑' : '↓';
      const color = insight.yourValue > insight.averageValue ? pc.green : pc.yellow;
      lines.push(
        `   ${color(comparison)} ${pc.white(insight.metric)}: ${color(insight.yourValue.toString())} ${pc.dim(`(avg: ${insight.averageValue})`)}`
      );
      lines.push(`     ${pc.dim(`${insight.percentile}th percentile`)}`);
      lines.push(`     ${pc.dim(insight.interpretation)}`);
      lines.push('');
    }
  }

  // Session Trends
  if (evaluation.sessionTrends && evaluation.sessionTrends.length > 0) {
    lines.push(pc.bold('  📈 Session Trends'));
    lines.push('');
    for (const trend of evaluation.sessionTrends) {
      const trendIcon = getTrendIcon(trend.direction);
      lines.push(`   ${trendIcon} ${pc.white(trend.metricName)}`);
      lines.push(`     ${pc.dim(trend.description)}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Render locked premium teaser (for free tier)
 */
function renderLockedPremiumTeaser(): string {
  const lines: string[] = [];

  lines.push(pc.dim('  ─'.repeat(30)));
  lines.push('');

  const lockedItems = [
    '🛠️  Tool Usage Deep Dive - Master every Claude Code tool',
    '💰 Token Efficiency Analysis - Save money & optimize workflow',
    '🗺️  Personalized Growth Roadmap - Step-by-step improvement plan',
    '📊 Comparative Insights - See how you compare to other developers',
    '📈 Session Trends - Track your progress over time',
    '📄 PDF Download - Save and share your analysis',
  ];

  lines.push(pc.bold('  🔒 Unlock Premium Insights'));
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

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Render a single evidence item
 */
function renderEvidence(evidence: PersonalizedEvidence, indent: number = 5): string {
  const lines: string[] = [];
  const prefix = ' '.repeat(indent);

  // Sentiment icon
  const sentimentIcon = {
    positive: pc.green('✓'),
    neutral: pc.dim('•'),
    growth_opportunity: pc.yellow('→'),
  }[evidence.sentiment];

  // Date and context
  const date = new Date(evidence.sessionDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  lines.push(`${prefix}${sentimentIcon} ${pc.dim(date)} - ${pc.dim(evidence.context)}`);

  // Quote - dim italic with quotation marks (supporting evidence)
  const quoteWrapped = wrapQuoteWithMarks(evidence.quote, 60);
  for (const line of quoteWrapped) {
    lines.push(`${prefix}${pc.dim('│')} ${pc.dim(pc.italic(line))}`);
  }

  // Significance - white (primary analysis content)
  const sigWrapped = wrapText(evidence.significance, 60);
  for (const line of sigWrapped) {
    lines.push(`${prefix}${pc.dim('→')} ${pc.white(line)}`);
  }

  return lines.join('\n');
}

/**
 * Get frequency icon
 */
function getFrequencyIcon(frequency: string): string {
  switch (frequency) {
    case 'frequent':
      return pc.green('●●●');
    case 'occasional':
      return pc.yellow('●●○');
    case 'rare':
      return pc.dim('●○○');
    default:
      return pc.dim('○○○');
  }
}

/**
 * Get effectiveness icon
 */
function getEffectivenessIcon(effectiveness: string): string {
  switch (effectiveness) {
    case 'highly_effective':
      return pc.green('✓✓✓');
    case 'effective':
      return pc.cyan('✓✓');
    case 'could_improve':
      return pc.yellow('✓');
    default:
      return pc.dim('?');
  }
}

/**
 * Get trend icon
 */
function getTrendIcon(direction: string): string {
  switch (direction) {
    case 'improving':
      return pc.green('↗');
    case 'stable':
      return pc.cyan('→');
    case 'declining':
      return pc.yellow('↘');
    default:
      return pc.dim('→');
  }
}

/**
 * Get efficiency color
 */
function getEfficiencyColor(score: number): (s: string) => string {
  if (score >= 70) return pc.green;
  if (score >= 50) return pc.cyan;
  return pc.yellow;
}

/**
 * Get impact color
 */
function getImpactColor(impact: string): (s: string) => string {
  switch (impact) {
    case 'high':
      return pc.red;
    case 'medium':
      return pc.yellow;
    case 'low':
      return pc.dim;
    default:
      return pc.white;
  }
}

/**
 * Wrap text to fit within a specified width
 */
function wrapText(text: string, width: number): string[] {
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

/**
 * Wrap quote text (similar to wrapText but for quoted content)
 */
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

/**
 * Wrap quote text with quotation marks at start and end
 */
function wrapQuoteWithMarks(text: string, width: number): string[] {
  const lines = wrapQuote(text, width - 2); // Reserve space for quotes
  if (lines.length === 0) return [];

  if (lines.length === 1) {
    return [`"${lines[0]}"`];
  }

  return lines.map((line, i) => {
    if (i === 0) return `"${line}`;
    if (i === lines.length - 1) return `${line}"`;
    return line;
  });
}
