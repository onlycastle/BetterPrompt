/**
 * Dimension Insights Renderer for Verbose Reports
 *
 * Renders the dimension insights section of verbose reports, displaying:
 * - Strengths with hero quotes and evidence clusters
 * - Growth areas with recommendations
 * - Interactive quote expansion UI
 *
 * @module web/verbose/dimension-insights
 */

import { type VerboseEvaluation } from '../../models/verbose-evaluation.js';
import { escapeHtml } from '../components.js';

/**
 * Render verbose dimension insights section
 *
 * Generates HTML for detailed dimension analysis including:
 * - Dimension cards with color-coded headers
 * - Strength clusters with hero quotes and supporting evidence
 * - Growth areas with contextual recommendations
 * - Expandable quote walls for detailed exploration
 *
 * @param verboseEval - The verbose evaluation data containing dimension insights
 * @param isUnlocked - Whether premium content should be visible (false = blurred)
 * @returns HTML string for the dimension insights section
 */
export function renderVerboseDimensionInsights(
  verboseEval: VerboseEvaluation,
  isUnlocked: boolean
): string {
  const dimensionInsights = verboseEval.dimensionInsights;
  if (!dimensionInsights || dimensionInsights.length === 0) {
    return '';
  }

  const dimensionConfig: Record<
    string,
    { color: string; bgColor: string; icon: string }
  > = {
    aiCollaboration: {
      color: 'var(--neon-green)',
      bgColor: 'rgba(0, 255, 136, 0.08)',
      icon: '🤝',
    },
    contextEngineering: {
      color: 'var(--neon-cyan)',
      bgColor: 'rgba(0, 212, 255, 0.08)',
      icon: '📐',
    },
    toolMastery: {
      color: '#ff6b35',
      bgColor: 'rgba(255, 107, 53, 0.08)',
      icon: '🛠️',
    },
    burnoutRisk: {
      color: 'var(--neon-red)',
      bgColor: 'rgba(255, 71, 87, 0.08)',
      icon: '🔥',
    },
    aiControl: {
      color: 'var(--neon-purple)',
      bgColor: 'rgba(168, 85, 247, 0.08)',
      icon: '🎮',
    },
    skillResilience: {
      color: 'var(--neon-yellow)',
      bgColor: 'rgba(251, 191, 36, 0.08)',
      icon: '💪',
    },
  };

  const dimensionsHtml = dimensionInsights
    .map((insight, dimIndex) => {
      const config = dimensionConfig[insight.dimension] || {
        color: 'var(--text-secondary)',
        bgColor: 'var(--bg-tertiary)',
        icon: '📊',
      };

      // Count total quotes in this dimension
      const strengthQuotes = insight.strengths.reduce(
        (sum, s) => sum + s.evidence.length,
        0
      );
      const growthQuotes = insight.growthAreas.reduce(
        (sum, g) => sum + g.evidence.length,
        0
      );
      const totalQuotes = strengthQuotes + growthQuotes;

      // Render strengths
      const strengthsHtml = insight.strengths
        .map((strength, sIdx) => {
          const showMoreNeeded = strength.evidence.length > 2;
          const quoteWallId = `dim-${dimIndex}-str-${sIdx}-quotes`;

          // Separate hero quote (first) from regular quotes
          const [heroEvidence, ...regularEvidence] = strength.evidence;

          // Hero quote - visually prominent
          const heroQuoteHtml = heroEvidence
            ? `
            <div class="quote-card quote-card--hero" style="
              padding: 20px 24px;
              background: linear-gradient(135deg, ${config.bgColor}, rgba(255, 255, 255, 0.02));
              border-radius: 12px;
              border-left: 4px solid ${config.color};
              margin-bottom: 16px;
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03);
              position: relative;
              overflow: hidden;
            " data-quote-idx="0">
              <div style="
                position: absolute;
                top: 12px;
                right: 16px;
                font-size: 9px;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: ${config.color};
                opacity: 0.7;
              ">defining moment</div>
              <p style="
                font-size: 15px;
                color: var(--text-muted);
                font-style: italic;
                line-height: 1.75;
                margin: 0 0 14px 0;
                font-weight: 400;
                letter-spacing: 0.01em;
              ">
                "${escapeHtml(heroEvidence.quote)}"
              </p>
              <div style="display: flex; align-items: center; gap: 12px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.06);">
                <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">
                  [${new Date(heroEvidence.sessionDate).toLocaleDateString()}]
                </span>
                <span style="font-size: 11px; color: ${config.color};">
                  → ${escapeHtml(heroEvidence.context)}
                </span>
              </div>
            </div>
          `
            : '';

          // Regular quotes - smaller but still readable
          const quotesHtml = regularEvidence
            .map(
              (ev, qIdx) => `
            <div class="quote-card quote-card--strength" style="
              display: ${qIdx >= 2 ? 'none' : 'block'};
              padding: 16px 20px;
              background: rgba(255, 255, 255, 0.025);
              border-radius: 8px;
              border-left: 4px solid ${config.color};
              margin-bottom: 12px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
              transition: transform 0.2s ease, box-shadow 0.2s ease;
            " data-quote-idx="${qIdx + 1}">
              <p style="
                font-size: 14px;
                color: var(--text-muted);
                font-style: italic;
                line-height: 1.7;
                margin: 0 0 10px 0;
                font-weight: 400;
                letter-spacing: 0.01em;
              ">
                "${escapeHtml(ev.quote)}"
              </p>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span style="font-size: 10px; color: #6a6a7a; font-family: var(--font-mono);">
                  [${new Date(ev.sessionDate).toLocaleDateString()}]
                </span>
                <span style="font-size: 10px; color: ${config.color}; text-align: right;">
                  → ${escapeHtml(ev.context)}
                </span>
              </div>
            </div>
          `
            )
            .join('');

          const hiddenCount = regularEvidence.length > 2 ? regularEvidence.length - 2 : 0;

          return `
          <div class="strength-cluster" style="margin-bottom: 28px;">
            <!-- Cluster Header -->
            <div style="
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 16px;
              padding-bottom: 12px;
              border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            ">
              <span style="font-size: 18px;">✨</span>
              <span style="
                font-size: 15px;
                font-weight: 600;
                color: var(--text-primary);
                letter-spacing: -0.01em;
              ">${escapeHtml(strength.title)}</span>
              <span style="
                margin-left: auto;
                font-size: 11px;
                color: ${config.color};
                background: ${config.bgColor};
                padding: 4px 12px;
                border-radius: 100px;
                font-weight: 500;
              ">${strength.evidence.length} instances</span>
            </div>

            <!-- Description -->
            <p style="
              font-size: 13px;
              color: var(--text-primary);
              margin-bottom: 20px;
              padding-left: 24px;
              border-left: 2px solid rgba(255, 255, 255, 0.08);
              line-height: 1.6;
            ">
              ${escapeHtml(strength.description)}
            </p>

            <!-- Hero Quote -->
            ${heroQuoteHtml}

            <!-- Regular Quotes -->
            <div class="quote-wall" id="${quoteWallId}">
              ${quotesHtml}
            </div>

            ${
              showMoreNeeded && hiddenCount > 0
                ? `
              <button onclick="toggleDimensionQuotes('${quoteWallId}', this, ${regularEvidence.length})" style="
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 10px 18px;
                margin-top: 8px;
                background: transparent;
                border: 1px dashed rgba(255, 255, 255, 0.12);
                border-radius: 8px;
                color: var(--text-muted);
                font-family: var(--font-mono);
                font-size: 11px;
                cursor: pointer;
                transition: all 0.2s ease;
              ">
                <span>Show</span>
                <span style="
                  background: ${config.bgColor};
                  padding: 3px 8px;
                  border-radius: 4px;
                  color: ${config.color};
                  font-weight: 500;
                ">+${hiddenCount}</span>
                <span>more quotes</span>
              </button>
            `
                : ''
            }
          </div>
        `;
        })
        .join('');

      // Render growth areas
      const growthAreasHtml = insight.growthAreas
        .map((growth, _gIdx) => {
          const quotesHtml = growth.evidence
            .map(
              ev => `
            <div class="quote-card quote-card--growth" style="
              padding: 16px 20px;
              background: rgba(251, 191, 36, 0.04);
              border-radius: 8px;
              border-left: 4px solid var(--neon-yellow);
              margin-bottom: 12px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
              transition: transform 0.2s ease, box-shadow 0.2s ease;
            ">
              <p style="
                font-size: 14px;
                color: var(--text-muted);
                font-style: italic;
                line-height: 1.7;
                margin: 0 0 10px 0;
                font-weight: 400;
                letter-spacing: 0.01em;
              ">
                "${escapeHtml(ev.quote)}"
              </p>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span style="font-size: 10px; color: #6a6a7a; font-family: var(--font-mono);">
                  [${new Date(ev.sessionDate).toLocaleDateString()}]
                </span>
                <span style="font-size: 10px; color: var(--neon-yellow); text-align: right;">
                  → ${escapeHtml(ev.context)}
                </span>
              </div>
            </div>
          `
            )
            .join('');

          return `
          <div class="growth-cluster ${isUnlocked ? '' : 'blurred-content'}" style="margin-bottom: 28px;">
            <!-- Growth Header -->
            <div style="
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 16px;
              padding-bottom: 12px;
              border-bottom: 1px solid rgba(251, 191, 36, 0.15);
            ">
              <span style="font-size: 18px;">🌱</span>
              <span style="
                font-size: 15px;
                font-weight: 600;
                color: var(--neon-yellow);
                letter-spacing: -0.01em;
              ">${escapeHtml(growth.title)}</span>
              <span style="
                margin-left: auto;
                font-size: 11px;
                color: var(--neon-yellow);
                background: rgba(251, 191, 36, 0.1);
                padding: 4px 12px;
                border-radius: 100px;
                font-weight: 500;
              ">${growth.evidence.length} instances</span>
            </div>

            <!-- Description -->
            <p style="
              font-size: 13px;
              color: var(--text-primary);
              margin-bottom: 20px;
              padding-left: 24px;
              border-left: 2px solid rgba(251, 191, 36, 0.2);
              line-height: 1.6;
            ">
              ${escapeHtml(growth.description)}
            </p>

            <!-- Quotes -->
            <div class="quote-wall">
              ${quotesHtml}
            </div>

            <!-- Recommendation Box -->
            <div style="
              margin-top: 16px;
              padding: 18px 20px;
              background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(251, 191, 36, 0.02));
              border: 1px solid rgba(251, 191, 36, 0.2);
              border-radius: 10px;
            ">
              <div style="
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: var(--neon-yellow);
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                gap: 8px;
              ">
                <span>💡</span>
                <span>Recommendation</span>
              </div>
              <p style="
                font-size: 13px;
                color: var(--text-primary);
                margin: 0;
                line-height: 1.6;
              ">
                ${escapeHtml(growth.recommendation)}
              </p>
            </div>
          </div>
        `;
        })
        .join('');

      return `
        <article class="dimension-card" style="
          background: var(--bg-tertiary);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 24px;
        " data-dimension="${insight.dimension}">
          <!-- Dimension Header -->
          <header style="
            padding: 20px 24px;
            background: ${config.bgColor};
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            display: flex;
            align-items: center;
            justify-content: space-between;
          ">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="
                width: 44px;
                height: 44px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                background: ${config.bgColor};
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 8px;
              ">${config.icon}</div>
              <div>
                <h3 style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin: 0;">
                  ${escapeHtml(insight.dimensionDisplayName)}
                </h3>
                <p style="font-size: 11px; color: var(--text-muted); margin: 4px 0 0 0;">
                  ${totalQuotes} quotes analyzed
                </p>
              </div>
            </div>
          </header>

          <!-- Strengths Section -->
          ${
            insight.strengths.length > 0
              ? `
            <div style="padding: 20px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
              ${strengthsHtml}
            </div>
          `
              : ''
          }

          <!-- Growth Areas Section -->
          ${
            insight.growthAreas.length > 0
              ? `
            <div style="padding: 20px 24px;">
              ${growthAreasHtml}
            </div>
          `
              : ''
          }
        </article>
      `;
    })
    .join('');

  return `
    <div class="dimension-insights-section" style="margin: 40px 0;">
      <div style="margin-bottom: 28px;">
        <h2 style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin: 0 0 8px 0; display: flex; align-items: center; gap: 10px;">
          <span>📊</span>
          <span>Your AI Coding Dimensions</span>
        </h2>
        <p style="font-size: 12px; color: var(--text-muted);">
          Based on ${verboseEval.sessionsAnalyzed} sessions analyzed • Evidence from your actual conversations
        </p>
      </div>
      ${dimensionsHtml}
    </div>
  `;
}
