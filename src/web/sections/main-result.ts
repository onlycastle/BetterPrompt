/**
 * Main Result Section
 *
 * Renders the primary coding style result with distribution breakdown.
 */

import { type TypeResult, type CodingStyleType, TYPE_METADATA } from '../types.js';

/**
 * Renders the main result section showing the primary coding style type
 * and distribution across all types.
 *
 * @param result - The type analysis result containing primary type and distribution
 * @param meta - The metadata for the primary type (emoji, name, tagline)
 * @returns HTML string for the main result section
 */
export function renderMainResultSection(result: TypeResult, meta: typeof TYPE_METADATA[CodingStyleType]): string {
  const types: CodingStyleType[] = ['architect', 'scientist', 'collaborator', 'speedrunner', 'craftsman'];

  const distributionRows = types.map(type => {
    const typeMeta = TYPE_METADATA[type];
    const pct = result.distribution[type];
    const isPrimary = type === result.primaryType;

    return `
      <div class="distribution-row${isPrimary ? ' primary' : ''}">
        <span class="distribution-emoji">${typeMeta.emoji}</span>
        <span class="distribution-name">${typeMeta.name}</span>
        <div class="distribution-bar">
          <div class="distribution-fill" style="width: ${pct}%"></div>
        </div>
        <span class="distribution-pct">${pct}%</span>
        <span class="distribution-marker">${isPrimary ? '◀' : ''}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="result-box">
      <div class="result-emoji">${meta.emoji}</div>
      <div class="result-title">YOU ARE ${meta.name.toUpperCase()}</div>
      <div class="result-tagline">"${meta.tagline}"</div>
    </div>

    <div class="distribution">
      <div class="subsection-title">📊 Style Distribution</div>
      ${distributionRows}
    </div>
  `;
}
