/**
 * Unified Report CLI Component
 *
 * Renders the UnifiedReport to terminal with all dimensions,
 * insights, and evidence quotes.
 */

import pc from 'picocolors';
import boxen from 'boxen';
import type {
  UnifiedReport,
  DimensionResult,
  DimensionInsight,
  EvidenceQuote,
  Recommendation,
} from '../../../models/unified-report';
import {
  TYPE_METADATA,
  MATRIX_NAMES,
  type CodingStyleType,
  type AIControlLevel,
} from '../../../models/coding-style';

// ============================================
// Dimension Configuration (CLI version)
// ============================================

const DIMENSION_CONFIG: Record<string, {
  icon: string;
  title: string;
  goodLevels: string[];
}> = {
  aiCollaboration: {
    icon: '🤝',
    title: 'AI Collaboration Mastery',
    goodLevels: ['expert', 'proficient'],
  },
  contextEngineering: {
    icon: '🧠',
    title: 'Context Engineering',
    goodLevels: ['expert', 'proficient'],
  },
  burnoutRisk: {
    icon: '🔥',
    title: 'Burnout Risk',
    goodLevels: ['low', 'expert', 'proficient'],
  },
  toolMastery: {
    icon: '🔧',
    title: 'Tool Mastery',
    goodLevels: ['expert', 'proficient'],
  },
  aiControl: {
    icon: '🎮',
    title: 'AI Control Index',
    goodLevels: ['ai-master', 'expert'],
  },
  skillResilience: {
    icon: '💪',
    title: 'Skill Resilience',
    goodLevels: ['resilient', 'expert', 'proficient'],
  },
};

// ============================================
// Main Render Function
// ============================================

/**
 * Render the complete unified report to CLI
 */
export function renderUnifiedReportCLI(
  report: UnifiedReport,
  isUnlocked: boolean = false
): string {
  const sections = [
    renderProfileSection(report),
    renderDimensionsOverview(report.dimensions),
    ...report.dimensions.map((dim) => renderDimensionDetail(dim, isUnlocked)),
    renderSummarySection(report.summary),
    renderEvidenceSection(report.evidence, isUnlocked),
    renderRecommendationsSection(report.recommendations, isUnlocked),
    isUnlocked ? '' : renderLockedTeaser(),
  ];

  return sections.filter(Boolean).join('\n');
}

// ============================================
// Section Renderers
// ============================================

/**
 * Render profile header section
 */
function renderProfileSection(report: UnifiedReport): string {
  const { profile } = report;
  const lines: string[] = [];

  const typeMeta = TYPE_METADATA[profile.primaryType as CodingStyleType];
  const matrixName = MATRIX_NAMES[profile.primaryType as CodingStyleType]?.[profile.controlLevel as AIControlLevel];

  const titleContent = matrixName
    ? `${typeMeta.emoji}  YOU ARE ${matrixName.toUpperCase()}`
    : `${typeMeta.emoji}  ${typeMeta.name.toUpperCase()}`;

  const subtitle = `${typeMeta.name} × ${profile.controlLevel.replace('-', ' ')}`;

  const titleBox = boxen(
    `\n${pc.bold(pc.white(titleContent))}\n${pc.dim(subtitle)}\n\n${pc.cyan(`"${typeMeta.tagline}"`)}\n`,
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
 * Render dimensions overview (compact scores)
 */
function renderDimensionsOverview(dimensions: DimensionResult[]): string {
  const lines: string[] = [];

  lines.push(pc.bold('  📊 Dimension Scores'));
  lines.push('');

  for (const dim of dimensions) {
    const config = DIMENSION_CONFIG[dim.name];
    if (!config) continue;

    const isGood = config.goodLevels.includes(dim.level);
    const scoreColor = isGood ? pc.green : pc.yellow;
    const barWidth = 20;
    const filled = Math.round((dim.score / 100) * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

    lines.push(
      `   ${config.icon} ${dim.name.padEnd(20)} ${scoreColor(bar)} ${scoreColor(dim.score.toString().padStart(3))}${pc.dim('/100')}`
    );
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Render a single dimension detail
 */
function renderDimensionDetail(dim: DimensionResult, isUnlocked: boolean): string {
  const lines: string[] = [];
  const config = DIMENSION_CONFIG[dim.name];
  if (!config) return '';

  const isGood = config.goodLevels.includes(dim.level);
  const levelColor = isGood ? pc.green : pc.yellow;

  // Header
  lines.push(pc.dim('  ─'.repeat(30)));
  lines.push('');
  lines.push(`  ${config.icon} ${pc.bold(pc.white(config.title))}`);
  lines.push(`     ${levelColor(dim.level.toUpperCase())} ${pc.dim('•')} ${levelColor(dim.score.toString())}${pc.dim('/100')}`);
  lines.push('');

  // Interpretation
  const interpWrapped = wrapText(dim.interpretation, 65);
  for (const line of interpWrapped) {
    lines.push(`     ${pc.dim(line)}`);
  }
  lines.push('');

  // Breakdown metrics
  lines.push(`     ${pc.dim('Breakdown:')}`);
  for (const [key, value] of Object.entries(dim.breakdown)) {
    const metricBar = renderMiniBar(value);
    lines.push(`       ${formatLabel(key).padEnd(18)} ${metricBar} ${pc.dim(value.toString())}`);
  }
  lines.push('');

  // Strengths
  if (dim.highlights.strengths.length > 0) {
    lines.push(`     ${pc.green('✨')} ${pc.bold('Strengths')}`);
    for (const strength of dim.highlights.strengths) {
      lines.push(`       ${pc.green('•')} ${pc.white(strength)}`);
    }
    lines.push('');
  }

  // Growth Areas
  if (dim.highlights.growthAreas.length > 0) {
    const blurIndicator = isUnlocked ? '' : pc.dim(' [LOCKED]');
    lines.push(`     ${pc.yellow('🌱')} ${pc.bold('Growth Areas')}${blurIndicator}`);
    for (const area of dim.highlights.growthAreas) {
      const areaText = isUnlocked ? pc.white(area) : pc.dim(blurText(area));
      lines.push(`       ${pc.yellow('→')} ${areaText}`);
    }
    lines.push('');
  }

  // Insights
  if (dim.insights && dim.insights.length > 0 && isUnlocked) {
    lines.push(`     ${pc.cyan('💡')} ${pc.bold('Insights')}`);
    for (const insight of dim.insights) {
      lines.push(renderInsight(insight, 7));
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render summary section
 */
function renderSummarySection(summary: UnifiedReport['summary']): string {
  const lines: string[] = [];

  lines.push(pc.dim('  ─'.repeat(30)));
  lines.push('');
  lines.push(`  📋 ${pc.bold(pc.white('Analysis Summary'))}`);
  lines.push('');

  const messageWrapped = wrapText(summary.overallMessage, 65);
  for (const line of messageWrapped) {
    lines.push(`     ${pc.white(line)}`);
  }
  lines.push('');

  // Top Strengths
  lines.push(`     ${pc.green('🌟')} ${pc.bold('Top Strengths')}`);
  for (const s of summary.topStrengths) {
    lines.push(`       ${pc.green('•')} ${pc.white(s.displayName)} ${pc.dim('—')} ${pc.dim(s.highlight)}`);
  }
  lines.push('');

  // Top Growth Areas
  lines.push(`     ${pc.yellow('🎯')} ${pc.bold('Growth Opportunities')}`);
  for (const g of summary.topGrowthAreas) {
    lines.push(`       ${pc.yellow('→')} ${pc.white(g.displayName)} ${pc.dim('—')} ${pc.dim(g.highlight)}`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Render evidence section
 */
function renderEvidenceSection(evidence: EvidenceQuote[], isUnlocked: boolean): string {
  if (!evidence || evidence.length === 0) return '';

  const lines: string[] = [];
  const displayEvidence = evidence.slice(0, 5);

  lines.push(pc.dim('  ─'.repeat(30)));
  lines.push('');
  lines.push(`  📝 ${pc.bold(pc.white('Evidence from Your Sessions'))}`);
  lines.push('');

  for (const ev of displayEvidence) {
    const categoryIcon = ev.category === 'strength' ? pc.green('✓') : pc.yellow('→');
    const quoteText = isUnlocked ? ev.quote : blurText(ev.quote);

    lines.push(`     ${categoryIcon} ${pc.dim(ev.dimension || '')}`);
    lines.push(`       ${pc.italic(pc.dim('"'))}${pc.italic(pc.white(truncate(quoteText, 60)))}${pc.italic(pc.dim('"'))}`);
    if (isUnlocked) {
      const analysisWrapped = wrapText(ev.analysis, 55);
      for (const line of analysisWrapped) {
        lines.push(`       ${pc.dim('→')} ${pc.dim(line)}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render recommendations section
 */
function renderRecommendationsSection(recommendations: Recommendation[], isUnlocked: boolean): string {
  if (!recommendations || recommendations.length === 0) return '';

  const lines: string[] = [];
  const displayRecs = recommendations.slice(0, 3);

  lines.push(pc.dim('  ─'.repeat(30)));
  lines.push('');
  lines.push(`  💡 ${pc.bold(pc.white('Recommendations'))}${isUnlocked ? '' : pc.dim(' [LOCKED]')}`);
  lines.push('');

  for (const rec of displayRecs) {
    const typeIcon = rec.type === 'reinforce' ? pc.green('⭐') : pc.cyan('🎯');
    const priorityBadge = pc.dim(`P${rec.priority}`);

    if (isUnlocked) {
      lines.push(`     ${typeIcon} ${pc.bold(pc.white(rec.title))} ${priorityBadge}`);
      const descWrapped = wrapText(rec.description, 60);
      for (const line of descWrapped) {
        lines.push(`       ${pc.dim(line)}`);
      }
      lines.push('');

      for (const action of rec.actionItems.slice(0, 2)) {
        lines.push(`       ${pc.cyan('→')} ${pc.white(action)}`);
      }
      lines.push('');
    } else {
      lines.push(`     ${typeIcon} ${pc.dim(blurText(rec.title))} ${priorityBadge}`);
      lines.push(`       ${pc.dim(blurText(truncate(rec.description, 50)))}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Render locked teaser for free tier
 */
function renderLockedTeaser(): string {
  const lines: string[] = [];

  lines.push(pc.dim('  ─'.repeat(30)));
  lines.push('');

  const lockedItems = [
    '💡 Personalized Insights - Advice based on your actual prompts',
    '📝 Evidence Analysis - Full context from your sessions',
    '🎯 Action Items - Specific steps to improve',
    '📚 Learning Resources - Curated materials for your level',
  ];

  lines.push(`  ${pc.bold('🔒 Unlock Full Report')}`);
  lines.push('');

  for (const item of lockedItems) {
    lines.push(`   ${pc.dim(item)}`);
  }

  lines.push('');

  const ctaBox = boxen(
    `${pc.bold('☕ ONE-TIME: $6.99')}\n${pc.dim('Unlock this analysis forever')}`,
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

// ============================================
// Helper Functions
// ============================================

/**
 * Render a single insight
 */
function renderInsight(insight: DimensionInsight, indent: number): string {
  const lines: string[] = [];
  const prefix = ' '.repeat(indent);

  if (insight.conversationBased) {
    const { quote, advice, sentiment } = insight.conversationBased;
    const icon = sentiment === 'praise' ? pc.green('✓') : pc.cyan('→');
    lines.push(`${prefix}${icon} ${pc.italic(pc.dim('"'))}${pc.italic(truncate(quote, 50))}${pc.italic(pc.dim('"'))}`);
    const adviceWrapped = wrapText(advice, 55);
    for (const line of adviceWrapped) {
      lines.push(`${prefix}  ${pc.dim(line)}`);
    }
  }

  if (insight.researchBased) {
    const { insight: text, source } = insight.researchBased;
    lines.push(`${prefix}${pc.cyan('📚')} ${pc.dim(source)}`);
    const textWrapped = wrapText(text, 55);
    for (const line of textWrapped) {
      lines.push(`${prefix}  ${pc.white(line)}`);
    }
  }

  if (insight.learningResource) {
    const { title, platform, level, url } = insight.learningResource;
    lines.push(`${prefix}${pc.cyan('📖')} ${pc.white(title)}`);
    lines.push(`${prefix}  ${pc.dim(platform)} • ${pc.dim(level)} • ${pc.cyan(url)}`);
  }

  return lines.join('\n');
}

/**
 * Render a mini progress bar
 */
function renderMiniBar(value: number): string {
  const barWidth = 10;
  const filled = Math.round((value / 100) * barWidth);
  const color = value >= 60 ? pc.green : pc.yellow;
  return color('█'.repeat(filled) + '░'.repeat(barWidth - filled));
}

/**
 * Format camelCase to Title Case
 */
function formatLabel(camelCase: string): string {
  return camelCase
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Blur text for locked content
 */
function blurText(text: string): string {
  return text.replace(/[a-zA-Z0-9]/g, '•');
}

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
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
