/**
 * Reusable HTML Components for Web Reports
 *
 * Extracted from template.ts to reduce duplication and improve maintainability.
 * Each component is a pure function that returns an HTML string.
 */

import type { DimensionResult, DimensionInsight, EvidenceQuote } from '../models/unified-report.js';

// ============================================
// Types
// ============================================

export interface MetricRowProps {
  label: string;
  score: number;
  colorThreshold?: number;
  positiveColor?: string;
  negativeColor?: string;
}

export interface SectionHeaderProps {
  icon: string;
  title: string;
  subtitle: string;
}

export interface ScoreDisplayProps {
  score: number;
  level: string;
  levelLabel: string;
  levelClass: string;
  scoreLabel?: string;
}

export interface ListSectionProps {
  title: string;
  icon: string;
  items: string[];
  itemColor: string;
  itemPrefix: string;
  blurred?: boolean;
}

// ============================================
// Level Configuration
// ============================================

export const DIMENSION_CONFIG: Record<string, {
  icon: string;
  title: string;
  subtitle: string;
  levelLabels: Record<string, string>;
  goodLevels: string[];
}> = {
  aiCollaboration: {
    icon: '🤝',
    title: 'AI Collaboration Mastery',
    subtitle: 'How effectively do you collaborate with AI?',
    levelLabels: {
      expert: 'Expert Collaborator',
      proficient: 'Proficient User',
      developing: 'Developing Skills',
      novice: 'Getting Started',
    },
    goodLevels: ['expert', 'proficient'],
  },
  contextEngineering: {
    icon: '🧠',
    title: 'Context Engineering',
    subtitle: 'How effectively do you manage AI context?',
    levelLabels: {
      expert: 'Context Master',
      proficient: 'Proficient',
      developing: 'Developing',
      novice: 'Getting Started',
    },
    goodLevels: ['expert', 'proficient'],
  },
  burnoutRisk: {
    icon: '🔥',
    title: 'Burnout Risk',
    subtitle: 'Are your work patterns sustainable?',
    levelLabels: {
      low: 'Healthy Balance',
      moderate: 'Watch Out',
      elevated: 'High Alert',
      high: 'Critical',
      expert: 'Healthy Balance',
      proficient: 'Moderate',
      developing: 'Watch Out',
      novice: 'High Risk',
    },
    goodLevels: ['low', 'expert', 'proficient'],
  },
  toolMastery: {
    icon: '🔧',
    title: 'Tool Mastery',
    subtitle: 'How effectively do you use AI tools?',
    levelLabels: {
      expert: 'Tool Master',
      proficient: 'Proficient',
      developing: 'Developing',
      novice: 'Beginner',
    },
    goodLevels: ['expert', 'proficient'],
  },
  aiControl: {
    icon: '🎮',
    title: 'AI Control Index',
    subtitle: 'Do you control AI, or does AI control you?',
    levelLabels: {
      'ai-master': 'AI Master',
      expert: 'AI Master',
      proficient: 'Developing Control',
      developing: 'Developing Control',
      'vibe-coder': 'Vibe Coder',
      novice: 'Vibe Coder',
    },
    goodLevels: ['ai-master', 'expert'],
  },
  skillResilience: {
    icon: '💪',
    title: 'Skill Resilience',
    subtitle: 'Can you code without AI assistance?',
    levelLabels: {
      resilient: 'Highly Resilient',
      expert: 'Highly Resilient',
      proficient: 'Moderate',
      developing: 'At Risk',
      'at-risk': 'At Risk',
      novice: 'Dependent',
    },
    goodLevels: ['resilient', 'expert', 'proficient'],
  },
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get CSS class for level badge (green for good, yellow for others)
 */
export function getLevelClass(level: string, goodLevels: string[]): string {
  return goodLevels.includes(level) ? 'level-green' : 'level-yellow';
}

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================
// Reusable Components
// ============================================

/**
 * Render a section header with icon, title, and subtitle
 */
export function renderSectionHeader({ icon, title, subtitle }: SectionHeaderProps): string {
  return `
    <div class="section-header">
      <div class="section-icon">${icon}</div>
      <div class="section-title">${escapeHtml(title)}</div>
      <div class="section-subtitle">${escapeHtml(subtitle)}</div>
    </div>
  `;
}

/**
 * Render a score display with level badge
 */
export function renderScoreDisplay({
  score,
  level: _level,
  levelLabel,
  levelClass,
  scoreLabel = 'out of 100',
}: ScoreDisplayProps): string {
  return `
    <div class="score-display">
      <div class="score-value">${Math.round(score)}</div>
      <div class="score-label">${escapeHtml(scoreLabel)}</div>
      <span class="score-level ${levelClass}">${escapeHtml(levelLabel)}</span>
    </div>
  `;
}

/**
 * Render a single metric row with progress bar
 */
export function renderMetricRow({
  label,
  score,
  colorThreshold = 60,
  positiveColor = 'green',
  negativeColor = 'cyan',
}: MetricRowProps): string {
  const fillColor = score >= colorThreshold ? positiveColor : negativeColor;
  const clampedScore = Math.max(0, Math.min(100, score));

  return `
    <div class="metric-row">
      <span class="metric-label">${escapeHtml(label)}</span>
      <div class="metric-bar">
        <div class="metric-fill ${fillColor}" style="width: ${clampedScore}%"></div>
      </div>
      <span class="metric-value">${Math.round(score)}</span>
    </div>
  `;
}

/**
 * Render multiple metric rows from a breakdown object
 */
export function renderMetricsFromBreakdown(
  breakdown: Record<string, number>,
  colorThreshold = 60
): string {
  return Object.entries(breakdown)
    .map(([label, score]) =>
      renderMetricRow({
        label: formatLabel(label),
        score,
        colorThreshold,
      })
    )
    .join('');
}

/**
 * Format camelCase label to Title Case with spaces
 */
function formatLabel(camelCase: string): string {
  return camelCase
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Render an interpretation block
 */
export function renderInterpretation(text: string): string {
  if (!text) return '';
  return `<div class="interpretation">${escapeHtml(text)}</div>`;
}

/**
 * Render a list section (strengths, growth areas, etc.)
 */
export function renderListSection({
  title,
  icon,
  items,
  itemColor,
  itemPrefix,
  blurred = false,
}: ListSectionProps): string {
  if (!items || items.length === 0) return '';

  const blurClass = blurred ? 'blurred-content' : '';

  return `
    <div class="subsection-title ${blurClass}">${icon} ${escapeHtml(title)}</div>
    <ul class="highlight-list ${blurClass}">
      ${items.map((item) => `<li style="color: ${itemColor};">${itemPrefix} ${escapeHtml(item)}</li>`).join('')}
    </ul>
  `;
}

/**
 * Render strengths list
 */
export function renderStrengths(strengths: string[], blurred = false): string {
  return renderListSection({
    title: 'Your Strengths',
    icon: '✨',
    items: strengths,
    itemColor: 'var(--neon-green)',
    itemPrefix: '✓',
    blurred,
  });
}

/**
 * Render growth areas list
 */
export function renderGrowthAreas(growthAreas: string[], blurred = false): string {
  return renderListSection({
    title: 'Growth Areas',
    icon: '🌱',
    items: growthAreas,
    itemColor: 'var(--text-muted)',
    itemPrefix: '→',
    blurred,
  });
}

/**
 * Render unlock prompt for premium content
 */
export function renderUnlockPrompt(message: string, isUnlocked: boolean): string {
  if (isUnlocked) return '';
  return `
    <div class="unlock-prompt">
      <span class="unlock-prompt-text">🔓 ${escapeHtml(message)}</span>
    </div>
  `;
}

// ============================================
// Insight Components (for UnifiedReport)
// ============================================

/**
 * Render dimension insights from UnifiedReport
 */
export function renderDimensionInsights(
  insights: DimensionInsight[],
  isUnlocked: boolean
): string {
  if (!insights || insights.length === 0) return '';

  const blurClass = isUnlocked ? '' : 'blurred-content';

  const insightItems = insights.map((insight) => {
    if (insight.conversationBased) {
      return renderConversationInsight(insight.conversationBased, insight.type);
    }
    if (insight.researchBased) {
      return renderResearchInsight(insight.researchBased);
    }
    if (insight.learningResource) {
      return renderLearningResource(insight.learningResource);
    }
    return '';
  }).filter(Boolean);

  if (insightItems.length === 0) return '';

  return `
    <div class="insights-section ${blurClass}">
      <div class="subsection-title">💡 Personalized Insights</div>
      ${insightItems.join('')}
    </div>
  `;
}

/**
 * Render a conversation-based insight
 */
function renderConversationInsight(
  insight: NonNullable<DimensionInsight['conversationBased']>,
  type: 'reinforcement' | 'improvement'
): string {
  const sentimentClass = insight.sentiment === 'praise' ? 'insight-praise' : 'insight-encouragement';
  const typeIcon = type === 'reinforcement' ? '⭐' : '🎯';

  return `
    <div class="insight-card ${sentimentClass}">
      <div class="insight-type">${typeIcon} ${type === 'reinforcement' ? 'Strength' : 'Growth Opportunity'}</div>
      <blockquote class="insight-quote">"${escapeHtml(insight.quote)}"</blockquote>
      <p class="insight-advice">${escapeHtml(insight.advice)}</p>
    </div>
  `;
}

/**
 * Render a research-based insight
 */
function renderResearchInsight(
  insight: NonNullable<DimensionInsight['researchBased']>
): string {
  const sourceLink = insight.url
    ? `<a href="${escapeHtml(insight.url)}" target="_blank" rel="noopener">${escapeHtml(insight.source)}</a>`
    : escapeHtml(insight.source);

  return `
    <div class="insight-card insight-research">
      <div class="insight-type">📚 Expert Insight</div>
      <p class="insight-text">${escapeHtml(insight.insight)}</p>
      <p class="insight-source">— ${sourceLink}</p>
    </div>
  `;
}

/**
 * Render a learning resource
 */
function renderLearningResource(
  resource: NonNullable<DimensionInsight['learningResource']>
): string {
  const levelBadge = `<span class="resource-level level-${resource.level}">${resource.level}</span>`;

  return `
    <div class="insight-card insight-resource">
      <div class="insight-type">📖 Recommended Resource</div>
      <a href="${escapeHtml(resource.url)}" target="_blank" rel="noopener" class="resource-link">
        ${escapeHtml(resource.title)}
      </a>
      <div class="resource-meta">
        <span class="resource-platform">${escapeHtml(resource.platform)}</span>
        ${levelBadge}
      </div>
    </div>
  `;
}

/**
 * Render evidence quotes section
 */
export function renderEvidenceQuotes(
  quotes: EvidenceQuote[],
  maxQuotes = 5,
  isUnlocked = true
): string {
  if (!quotes || quotes.length === 0) return '';

  const blurClass = isUnlocked ? '' : 'blurred-content';
  const displayQuotes = quotes.slice(0, maxQuotes);

  return `
    <div class="evidence-section ${blurClass}">
      <div class="subsection-title">📝 Evidence from Your Sessions</div>
      ${displayQuotes.map((quote) => `
        <div class="evidence-card evidence-${quote.category}">
          <blockquote>"${escapeHtml(quote.quote)}"</blockquote>
          <p class="evidence-analysis">${escapeHtml(quote.analysis)}</p>
          ${quote.dimension ? `<span class="evidence-dimension">${formatLabel(quote.dimension)}</span>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================
// Dimension Section Renderer (Generic)
// ============================================

export interface DimensionSectionData {
  name: string;
  score: number;
  level: string;
  breakdown: Record<string, number>;
  interpretation: string;
  strengths: string[];
  growthAreas: string[];
  insights?: DimensionInsight[];
}

/**
 * Render a complete dimension section using unified structure
 */
export function renderDimensionSection(
  data: DimensionSectionData,
  isUnlocked: boolean
): string {
  const config = DIMENSION_CONFIG[data.name];
  if (!config) {
    console.warn(`No config found for dimension: ${data.name}`);
    return '';
  }

  const levelLabel = config.levelLabels[data.level] || data.level;
  const levelClass = getLevelClass(data.level, config.goodLevels);

  return `
    ${renderSectionHeader({
      icon: config.icon,
      title: config.title,
      subtitle: config.subtitle,
    })}

    ${renderScoreDisplay({
      score: data.score,
      level: data.level,
      levelLabel,
      levelClass,
    })}

    ${renderInterpretation(data.interpretation)}

    <div class="metrics-container">
      ${renderMetricsFromBreakdown(data.breakdown)}
    </div>

    ${renderStrengths(data.strengths)}
    ${renderGrowthAreas(data.growthAreas, !isUnlocked)}

    ${data.insights ? renderDimensionInsights(data.insights, isUnlocked) : ''}

    ${renderUnlockPrompt('Unlock detailed breakdown + personalized recommendations', isUnlocked)}
  `;
}

/**
 * Convert DimensionResult from UnifiedReport to DimensionSectionData
 */
export function dimensionResultToSectionData(result: DimensionResult): DimensionSectionData {
  return {
    name: result.name,
    score: result.score,
    level: result.level,
    breakdown: result.breakdown,
    interpretation: result.interpretation,
    strengths: result.highlights.strengths,
    growthAreas: result.highlights.growthAreas,
    insights: result.insights,
  };
}
