/**
 * HTML Report Template Generator
 *
 * Generates a standalone HTML report with inlined CSS/JS/SVG.
 * Uses the notebook-sketch design system from the main app.
 *
 * @module plugin/lib/report-template
 */
// ============================================================================
// HTML Escaping
// ============================================================================
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
// ============================================================================
// SVG Radar Chart (ported from RadarChart.tsx math)
// ============================================================================
function polarToCartesian(cx, cy, radius, angleDeg) {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return {
        x: cx + radius * Math.cos(angleRad),
        y: cy + radius * Math.sin(angleRad),
    };
}
function generateRadarSvg(scores, labels, size = 300) {
    const entries = Object.entries(scores);
    const count = entries.length;
    if (count === 0)
        return '';
    const cx = size / 2;
    const cy = size / 2;
    const maxRadius = size / 2 - 40;
    const angleStep = 360 / count;
    // Grid circles
    const gridCircles = [0.25, 0.5, 0.75, 1.0]
        .map(frac => {
        const r = maxRadius * frac;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#E8EDF5" stroke-width="1" />`;
    })
        .join('\n');
    // Grid lines + labels
    const gridLines = entries
        .map(([key], i) => {
        const angle = i * angleStep;
        const end = polarToCartesian(cx, cy, maxRadius, angle);
        const labelPos = polarToCartesian(cx, cy, maxRadius + 20, angle);
        const label = labels[key] ?? key;
        return `
        <line x1="${cx}" y1="${cy}" x2="${end.x}" y2="${end.y}" stroke="#E8EDF5" stroke-width="1" />
        <text x="${labelPos.x}" y="${labelPos.y}" text-anchor="middle" dominant-baseline="middle"
              font-size="11" font-family="'Fira Code', monospace" fill="#4A4A5A">${label}</text>
      `;
    })
        .join('\n');
    // Data polygon
    const points = entries
        .map(([, score], i) => {
        const angle = i * angleStep;
        const r = maxRadius * (score / 100);
        const p = polarToCartesian(cx, cy, r, angle);
        return `${p.x},${p.y}`;
    })
        .join(' ');
    // Data dots
    const dots = entries
        .map(([, score], i) => {
        const angle = i * angleStep;
        const r = maxRadius * (score / 100);
        const p = polarToCartesian(cx, cy, r, angle);
        return `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#00BCD4" />`;
    })
        .join('\n');
    return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      ${gridCircles}
      ${gridLines}
      <polygon points="${points}" fill="rgba(0,188,212,0.15)" stroke="#00BCD4" stroke-width="2" />
      ${dots}
    </svg>
  `;
}
// ============================================================================
// Type Distribution Bar
// ============================================================================
function generateTypeDistributionBar(distribution) {
    const colors = {
        architect: '#3B82F6',
        analyst: '#9C7CF4',
        conductor: '#FFD93D',
        speedrunner: '#4ADE80',
        trendsetter: '#FF6B9D',
    };
    const entries = Object.entries(distribution);
    entries.sort((a, b) => b[1] - a[1]);
    const bars = entries
        .map(([type, pct]) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="width:100px;font-size:12px;color:#4A4A5A;text-transform:capitalize;">${type}</span>
        <div style="flex:1;height:20px;background:#F0F0F5;border-radius:4px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${colors[type]};border-radius:4px;transition:width 0.5s;"></div>
        </div>
        <span style="width:35px;text-align:right;font-size:12px;font-weight:600;color:#1A1A2E;">${pct}%</span>
      </div>
    `)
        .join('');
    return `<div style="margin:16px 0;">${bars}</div>`;
}
// ============================================================================
// Domain Section Cards
// ============================================================================
const DOMAIN_LABELS = {
    thinkingQuality: { label: 'Thinking Quality', emoji: '🧠' },
    communicationPatterns: { label: 'Communication', emoji: '💬' },
    learningBehavior: { label: 'Learning', emoji: '📚' },
    contextEfficiency: { label: 'Efficiency', emoji: '⚡' },
    sessionOutcome: { label: 'Sessions', emoji: '🎯' },
};
function generateDomainSection(result) {
    const meta = DOMAIN_LABELS[result.domain] ?? { label: result.domain, emoji: '📊' };
    const strengthCards = result.strengths
        .map(s => `
      <div class="card strength-card">
        <h4>${escapeHtml(s.title)}</h4>
        <p>${escapeHtml(s.description)}</p>
        ${s.evidence.length > 0 ? `
          <details>
            <summary>Evidence (${s.evidence.length})</summary>
            <ul>
              ${s.evidence.map(e => `<li><code>${escapeHtml(e.utteranceId)}</code>: "${escapeHtml(e.quote)}"</li>`).join('')}
            </ul>
          </details>
        ` : ''}
      </div>
    `)
        .join('');
    const growthCards = result.growthAreas
        .map(g => `
      <div class="card growth-card">
        <div class="severity-badge severity-${escapeHtml(g.severity)}">${escapeHtml(g.severity)}</div>
        <h4>${escapeHtml(g.title)}</h4>
        <p>${escapeHtml(g.description)}</p>
        <div class="recommendation">${escapeHtml(g.recommendation)}</div>
        ${g.evidence.length > 0 ? `
          <details>
            <summary>Evidence (${g.evidence.length})</summary>
            <ul>
              ${g.evidence.map(e => `<li><code>${escapeHtml(e.utteranceId)}</code>: "${escapeHtml(e.quote)}"</li>`).join('')}
            </ul>
          </details>
        ` : ''}
      </div>
    `)
        .join('');
    return `
    <section class="domain-section" id="domain-${result.domain}">
      <h2>${meta.emoji} ${meta.label} <span class="score">${result.overallScore}/100</span></h2>
      ${result.strengths.length > 0 ? `<h3>Strengths</h3><div class="card-grid">${strengthCards}</div>` : ''}
      ${result.growthAreas.length > 0 ? `<h3>Growth Areas</h3><div class="card-grid">${growthCards}</div>` : ''}
    </section>
  `;
}
// ============================================================================
// Focus Areas Section
// ============================================================================
function generateFocusAreas(content) {
    if (!content?.topFocusAreas?.length)
        return '';
    const areas = content.topFocusAreas
        .map(area => `
      <div class="card focus-card">
        <h3>${escapeHtml(area.title)}</h3>
        <p>${escapeHtml(area.narrative ?? area.description ?? '')}</p>
        ${area.actions ? `
        <div class="actions-grid">
          <div class="action start"><strong>Start:</strong> ${escapeHtml(area.actions.start)}</div>
          <div class="action stop"><strong>Stop:</strong> ${escapeHtml(area.actions.stop)}</div>
          <div class="action continue"><strong>Continue:</strong> ${escapeHtml(area.actions.continue)}</div>
        </div>
        ` : ''}
      </div>
    `)
        .join('');
    return `
    <section class="domain-section" id="focus-areas">
      <h2>🎯 Top Focus Areas</h2>
      ${areas}
    </section>
  `;
}
function generatePersonalitySummary(summary) {
    if (!summary?.trim())
        return '';
    return `
    <section class="domain-section" id="personality-summary">
      <h2>🪞 Personality Summary</h2>
      <div class="card">
        <p>${escapeHtml(summary).replace(/\n/g, '<br>')}</p>
      </div>
    </section>
  `;
}
function generatePromptPatternsSection(promptPatterns) {
    if (!promptPatterns?.length)
        return '';
    const items = promptPatterns
        .map(pattern => `
      <div class="card">
        <h4>${escapeHtml(pattern.patternName ?? 'Pattern')}</h4>
        <p>${escapeHtml(pattern.description ?? '')}</p>
        <p style="margin-top:8px;font-size:12px;"><strong>Frequency:</strong> ${escapeHtml(pattern.frequency ?? 'n/a')}</p>
        ${(pattern.examples?.length ?? 0) > 0 ? `
          <details>
            <summary>Examples (${pattern.examples.length})</summary>
            <ul>
              ${pattern.examples.map(example => `<li>"${escapeHtml(example.quote ?? '')}"${example.analysis ? ` — ${escapeHtml(example.analysis)}` : ''}</li>`).join('')}
            </ul>
          </details>
        ` : ''}
      </div>
    `)
        .join('');
    return `
    <section class="domain-section" id="prompt-patterns">
      <h2>🧩 Prompt Patterns</h2>
      <div class="card-grid">${items}</div>
    </section>
  `;
}
function generateProjectSummariesSection(projectSummaries) {
    if (!projectSummaries?.length)
        return '';
    const items = projectSummaries
        .map(project => `
      <div class="card">
        <h4>${escapeHtml(project.projectName)} <span style="color:var(--ink-muted);font-weight:400;">(${project.sessionCount} sessions)</span></h4>
        <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
          ${project.summaryLines.map(line => `<li>${escapeHtml(line)}</li>`).join('')}
        </ul>
      </div>
    `)
        .join('');
    return `
    <section class="domain-section" id="project-summaries">
      <h2>📁 Project Summaries</h2>
      <div class="card-grid">${items}</div>
    </section>
  `;
}
function generateWeeklyInsightsSection(weeklyInsights) {
    if (!weeklyInsights)
        return '';
    const stats = weeklyInsights.stats;
    const highlights = weeklyInsights.highlights ?? [];
    const projects = weeklyInsights.projects ?? [];
    const topSessions = weeklyInsights.topProjectSessions ?? [];
    return `
    <section class="domain-section" id="weekly-insights">
      <h2>📆 Weekly Insights</h2>
      ${stats ? `
        <div class="metrics-bar" style="margin-bottom:16px;">
          <div class="metric"><div class="value">${stats.totalSessions ?? 0}</div><div class="label">Sessions</div></div>
          <div class="metric"><div class="value">${Math.round(stats.totalMinutes ?? 0)}</div><div class="label">Minutes</div></div>
          <div class="metric"><div class="value">${Math.round((stats.totalTokens ?? 0) / 1000)}k</div><div class="label">Tokens</div></div>
          <div class="metric"><div class="value">${stats.activeDays ?? 0}</div><div class="label">Active Days</div></div>
        </div>
      ` : ''}
      ${weeklyInsights.narrative ? `<div class="card"><p>${escapeHtml(weeklyInsights.narrative)}</p></div>` : ''}
      ${projects.length > 0 ? `
        <div class="card">
          <h4>Project Breakdown</h4>
          <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
            ${projects.map(project => `<li>${escapeHtml(project.projectName)}: ${project.sessionCount} sessions, ${project.percentage}%</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      ${topSessions.length > 0 ? `
        <div class="card">
          <h4>Top Sessions</h4>
          <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
            ${topSessions.map(session => `<li>${escapeHtml(session.date)} · ${Math.round(session.durationMinutes)} min · ${escapeHtml(session.summary)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      ${highlights.length > 0 ? `
        <div class="card">
          <h4>Highlights</h4>
          <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
            ${highlights.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </section>
  `;
}
function generateActivitySection(activitySessions) {
    if (!activitySessions?.length)
        return '';
    const rows = activitySessions
        .slice(0, 20)
        .map(session => `
      <div class="card">
        <h4>${escapeHtml(session.projectName)}</h4>
        <p>${escapeHtml(session.summary)}</p>
        <p style="margin-top:8px;font-size:12px;">
          ${escapeHtml(new Date(session.startTime).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }))} ·
          ${Math.round(session.durationMinutes)} min ·
          ${session.messageCount} messages
        </p>
      </div>
    `)
        .join('');
    return `
    <section class="domain-section" id="activity-sessions">
      <h2>🗂 Activity Sessions</h2>
      <div class="card-grid">${rows}</div>
    </section>
  `;
}
function generatePlanningAnalysisSection(planningAnalysis) {
    if (!planningAnalysis)
        return '';
    const strengths = planningAnalysis.strengths ?? [];
    const opportunities = planningAnalysis.opportunities ?? [];
    return `
    <section class="domain-section" id="planning-analysis">
      <h2>🗺 Planning Analysis</h2>
      <div class="card">
        ${planningAnalysis.planningMaturityLevel ? `<p><strong>Maturity:</strong> ${escapeHtml(planningAnalysis.planningMaturityLevel)}</p>` : ''}
        ${planningAnalysis.summary ? `<p>${escapeHtml(planningAnalysis.summary)}</p>` : ''}
      </div>
      ${strengths.length > 0 ? `
        <h3>Observed Strengths</h3>
        <div class="card-grid">
          ${strengths.map((item) => `
            <div class="card">
              <h4>${escapeHtml(item.displayName ?? 'Planning strength')}</h4>
              <p>${escapeHtml(item.description ?? '')}</p>
              ${item.sophistication ? `<p style="margin-top:8px;font-size:12px;"><strong>Sophistication:</strong> ${escapeHtml(item.sophistication)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${opportunities.length > 0 ? `
        <h3>Opportunities</h3>
        <div class="card-grid">
          ${opportunities.map((item) => `
            <div class="card">
              <h4>${escapeHtml(item.displayName ?? 'Planning opportunity')}</h4>
              <p>${escapeHtml(item.description ?? '')}</p>
              ${item.sophistication ? `<p style="margin-top:8px;font-size:12px;"><strong>Sophistication:</strong> ${escapeHtml(item.sophistication)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </section>
  `;
}
function generateCriticalThinkingSection(criticalThinkingAnalysis) {
    if (!criticalThinkingAnalysis)
        return '';
    const strengths = criticalThinkingAnalysis.strengths ?? [];
    const opportunities = criticalThinkingAnalysis.opportunities ?? [];
    return `
    <section class="domain-section" id="critical-thinking-analysis">
      <h2>🔍 Critical Thinking</h2>
      <div class="card">
        ${typeof criticalThinkingAnalysis.overallScore === 'number' ? `<p><strong>Score:</strong> ${criticalThinkingAnalysis.overallScore}/100</p>` : ''}
        ${criticalThinkingAnalysis.summary ? `<p>${escapeHtml(criticalThinkingAnalysis.summary)}</p>` : ''}
      </div>
      ${strengths.length > 0 ? `
        <div class="card-grid">
          ${strengths.map((item) => `
            <div class="card">
              <h4>${escapeHtml(item.displayName ?? 'Signal')}</h4>
              <p>${escapeHtml(item.description ?? '')}</p>
              ${item.quality ? `<p style="margin-top:8px;font-size:12px;"><strong>Quality:</strong> ${escapeHtml(item.quality)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${opportunities.length > 0 ? `
        <div class="card-grid">
          ${opportunities.map((item) => `
            <div class="card">
              <h4>${escapeHtml(item.displayName ?? 'Opportunity')}</h4>
              <p>${escapeHtml(item.description ?? '')}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </section>
  `;
}
function generateAntiPatternsSection(antiPatternsAnalysis) {
    if (!antiPatternsAnalysis)
        return '';
    const detected = antiPatternsAnalysis.detected ?? [];
    return `
    <section class="domain-section" id="anti-patterns-analysis">
      <h2>🚧 Anti-Patterns</h2>
      <div class="card">
        ${typeof antiPatternsAnalysis.overallHealthScore === 'number' ? `<p><strong>Health Score:</strong> ${antiPatternsAnalysis.overallHealthScore}/100</p>` : ''}
        ${antiPatternsAnalysis.summary ? `<p>${escapeHtml(antiPatternsAnalysis.summary)}</p>` : ''}
      </div>
      ${detected.length > 0 ? `
        <div class="card-grid">
          ${detected.map((item) => `
            <div class="card">
              <h4>${escapeHtml(item.displayName ?? 'Anti-pattern')}</h4>
              <p>${escapeHtml(item.description ?? '')}</p>
              <p style="margin-top:8px;font-size:12px;">
                ${item.severity ? `<strong>Severity:</strong> ${escapeHtml(item.severity)} · ` : ''}
                ${typeof item.occurrences === 'number' ? `<strong>Occurrences:</strong> ${item.occurrences}` : ''}
              </p>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </section>
  `;
}
function generateKnowledgeResourcesSection(knowledgeResources) {
    if (!knowledgeResources?.length)
        return '';
    return `
    <section class="domain-section" id="knowledge-resources">
      <h2>📚 Knowledge Resources</h2>
      <div class="card-grid">
        ${knowledgeResources.map((group) => `
          <div class="card">
            <h4>${escapeHtml(group.dimensionDisplayName ?? 'Recommended Resources')}</h4>
            ${(group.professionalInsights?.length ?? 0) > 0 ? `
              <p style="margin-top:8px;"><strong>Professional Insights</strong></p>
              <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
                ${group.professionalInsights.slice(0, 3).map((item) => `<li>${escapeHtml(item.title ?? 'Insight')}${item.keyTakeaway ? `: ${escapeHtml(item.keyTakeaway)}` : ''}</li>`).join('')}
              </ul>
            ` : ''}
            ${(group.knowledgeItems?.length ?? 0) > 0 ? `
              <p style="margin-top:8px;"><strong>Suggested Reading</strong></p>
              <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
                ${group.knowledgeItems.slice(0, 3).map((item) => `<li>${escapeHtml(item.title ?? 'Resource')}${item.summary ? `: ${escapeHtml(item.summary)}` : ''}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </section>
  `;
}
// ============================================================================
// Main HTML Generator
// ============================================================================
export function generateReportHtml(report) {
    const { typeResult, deterministicScores, phase1Metrics, domainResults, content } = report;
    // Radar chart data
    const radarScores = {
        thinking: deterministicScores.thinkingQuality,
        communication: deterministicScores.communicationPatterns,
        learning: deterministicScores.learningBehavior,
        efficiency: deterministicScores.contextEfficiency,
        sessions: deterministicScores.sessionOutcome,
    };
    const radarLabels = {
        thinking: 'Thinking',
        communication: 'Communication',
        learning: 'Learning',
        efficiency: 'Efficiency',
        sessions: 'Sessions',
    };
    const radarSvg = generateRadarSvg(radarScores, radarLabels);
    // Type distribution
    const distributionBar = typeResult ? generateTypeDistributionBar(typeResult.distribution) : '<p style="color:var(--ink-muted);">Type classification not yet performed. Run classify_developer_type first.</p>';
    // Domain sections
    const domainSections = domainResults.map(generateDomainSection).join('\n');
    // Focus areas
    const focusAreasSection = generateFocusAreas(content);
    // Navigation dots
    const navDots = [
        { id: 'identity', label: 'Identity' },
        { id: 'scores', label: 'Scores' },
        ...domainResults.map((d) => ({
            id: `domain-${d.domain}`,
            label: DOMAIN_LABELS[d.domain]?.label ?? d.domain,
        })),
        ...(content?.topFocusAreas?.length ? [{ id: 'focus-areas', label: 'Focus' }] : []),
    ];
    const navDotsHtml = navDots
        .map((d) => `<a href="#${d.id}" class="nav-dot" title="${d.label}"><span class="dot"></span></a>`)
        .join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BetterPrompt Analysis Report</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&display=swap" media="print" onload="this.media='all'">
  <style>
    /* ── Notebook Sketch Design System ── */

    :root {
      --bg-paper: #FFFFFF;
      --bg-paper-warm: #FFFEF8;
      --bg-grid-color: #E8EDF5;
      --bg-grid-size: 20px;
      --ink-primary: #1A1A2E;
      --ink-secondary: #4A4A5A;
      --ink-muted: #8A8A9A;
      --sketch-cyan: #00BCD4;
      --sketch-green: #4ADE80;
      --sketch-pink: #FF6B9D;
      --sketch-blue: #3B82F6;
      --sketch-purple: #9C7CF4;
      --sketch-yellow: #FFD93D;
      --sketch-orange: #FB923C;
      --sketch-red: #EF4444;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Fira Code', monospace;
      background: var(--bg-paper-warm);
      background-image:
        linear-gradient(var(--bg-grid-color) 1px, transparent 1px),
        linear-gradient(90deg, var(--bg-grid-color) 1px, transparent 1px);
      background-size: var(--bg-grid-size) var(--bg-grid-size);
      color: var(--ink-primary);
      line-height: 1.6;
      padding: 40px 20px;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
    }

    /* ── Header ── */
    .header {
      text-align: center;
      margin-bottom: 48px;
      padding-bottom: 24px;
      border-bottom: 2px solid var(--ink-primary);
    }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .header .subtitle { color: var(--ink-secondary); font-size: 13px; }

    /* ── Identity Section ── */
    .identity {
      display: flex;
      gap: 32px;
      align-items: center;
      margin-bottom: 48px;
      padding: 24px;
      background: var(--bg-paper);
      border: 2px solid var(--ink-primary);
      border-radius: 8px;
    }
    .identity .type-info { flex: 1; }
    .identity .type-emoji { font-size: 48px; }
    .identity .type-name { font-size: 22px; font-weight: 700; margin-top: 8px; }
    .identity .type-detail { color: var(--ink-secondary); font-size: 13px; margin-top: 4px; }

    /* ── Scores Grid ── */
    .scores-section {
      display: flex;
      gap: 32px;
      margin-bottom: 48px;
      align-items: flex-start;
    }
    .radar-container { flex-shrink: 0; }
    .distribution-container { flex: 1; }

    /* ── Cards ── */
    .card {
      background: var(--bg-paper);
      border: 1px solid var(--bg-grid-color);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .card h4 { font-size: 14px; margin-bottom: 8px; }
    .card p { font-size: 13px; color: var(--ink-secondary); line-height: 1.5; }
    .card-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
    @media (min-width: 640px) { .card-grid { grid-template-columns: 1fr 1fr; } }

    .strength-card { border-left: 3px solid var(--sketch-green); }
    .growth-card { border-left: 3px solid var(--sketch-orange); }
    .focus-card { border-left: 3px solid var(--sketch-cyan); }

    .severity-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .severity-low { background: rgba(74,222,128,0.15); color: #16a34a; }
    .severity-medium { background: rgba(251,146,60,0.15); color: #ea580c; }
    .severity-high { background: rgba(239,68,68,0.15); color: #dc2626; }

    .recommendation {
      margin-top: 8px;
      padding: 8px 12px;
      background: rgba(0,188,212,0.08);
      border-radius: 4px;
      font-size: 12px;
      color: var(--ink-secondary);
    }

    details { margin-top: 8px; }
    details summary {
      cursor: pointer;
      font-size: 12px;
      color: var(--ink-muted);
    }
    details ul { margin-top: 4px; padding-left: 20px; font-size: 12px; color: var(--ink-secondary); }
    details li { margin-bottom: 4px; }
    details code { font-size: 11px; background: #f0f0f5; padding: 1px 4px; border-radius: 2px; }

    /* ── Domain Sections ── */
    .domain-section {
      margin-bottom: 48px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--bg-grid-color);
    }
    .domain-section h2 {
      font-size: 20px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .domain-section h3 {
      font-size: 14px;
      font-weight: 600;
      color: var(--ink-secondary);
      margin: 16px 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .score {
      font-size: 14px;
      font-weight: 400;
      color: var(--sketch-cyan);
      margin-left: auto;
    }

    /* ── Actions Grid ── */
    .actions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin-top: 12px;
    }
    .action {
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      color: var(--ink-secondary);
    }
    .action.start { background: rgba(74,222,128,0.1); }
    .action.stop { background: rgba(239,68,68,0.1); }
    .action.continue { background: rgba(59,130,246,0.1); }
    .action strong { display: block; font-size: 11px; color: var(--ink-primary); margin-bottom: 4px; }

    /* ── Metrics Bar ── */
    .metrics-bar {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
      margin-bottom: 32px;
      padding: 16px;
      background: var(--bg-paper);
      border: 1px solid var(--bg-grid-color);
      border-radius: 8px;
    }
    .metric {
      text-align: center;
    }
    .metric .value { font-size: 24px; font-weight: 700; color: var(--sketch-cyan); }
    .metric .label { font-size: 11px; color: var(--ink-muted); }

    /* ── Navigation Dots ── */
    .nav-dots {
      position: fixed;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 100;
    }
    .nav-dot {
      display: block;
      text-decoration: none;
    }
    .nav-dot .dot {
      display: block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--bg-grid-color);
      border: 1px solid var(--ink-muted);
      transition: all 0.2s;
    }
    .nav-dot:hover .dot,
    .nav-dot.active .dot {
      background: var(--sketch-cyan);
      border-color: var(--sketch-cyan);
      transform: scale(1.5);
    }

    /* ── Footer ── */
    .footer {
      text-align: center;
      padding: 24px;
      color: var(--ink-muted);
      font-size: 12px;
    }

    @media (max-width: 640px) {
      .identity { flex-direction: column; text-align: center; }
      .scores-section { flex-direction: column; }
      .actions-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <nav class="nav-dots">${navDotsHtml}</nav>

  <div class="container">
    <header class="header">
      <h1>BetterPrompt Analysis</h1>
      <p class="subtitle">Generated ${new Date(report.analyzedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </header>

    <!-- Identity -->
    <section class="identity" id="identity">
      ${typeResult ? `
        <div class="type-emoji">${typeResult.matrixEmoji}</div>
        <div class="type-info">
          <div class="type-name">${escapeHtml(typeResult.matrixName)}</div>
          <div class="type-detail">${escapeHtml(typeResult.primaryType)} / ${escapeHtml(typeResult.controlLevel)} (control: ${typeResult.controlScore})</div>
        </div>
      ` : `
        <div class="type-info">
          <div class="type-name">Type Not Classified</div>
          <div class="type-detail">Run classify_developer_type to determine your collaboration style</div>
        </div>
      `}
    </section>

    <!-- Metrics Bar -->
    <div class="metrics-bar">
      <div class="metric">
        <div class="value">${phase1Metrics.totalSessions}</div>
        <div class="label">Sessions</div>
      </div>
      <div class="metric">
        <div class="value">${phase1Metrics.totalDeveloperUtterances}</div>
        <div class="label">Utterances</div>
      </div>
      <div class="metric">
        <div class="value">${Math.round(phase1Metrics.avgMessagesPerSession)}</div>
        <div class="label">Avg Messages/Session</div>
      </div>
      <div class="metric">
        <div class="value">${Math.round(phase1Metrics.questionRatio * 100)}%</div>
        <div class="label">Questions</div>
      </div>
      <div class="metric">
        <div class="value">${Math.round(phase1Metrics.codeBlockRatio * 100)}%</div>
        <div class="label">Code Blocks</div>
      </div>
    </div>

    <!-- Scores -->
    <section class="scores-section" id="scores">
      <div class="radar-container">
        ${radarSvg}
      </div>
      <div class="distribution-container">
        <h3 style="margin-bottom:12px;">Type Distribution</h3>
        ${distributionBar}
      </div>
    </section>

    <!-- Domain Results -->
    ${domainSections}

    <!-- Focus Areas -->
    ${focusAreasSection}

    <footer class="footer">
      Generated by BetterPrompt Plugin v0.2.0 &mdash; local-first AI collaboration analysis
    </footer>
  </div>

  <script>
    // Scroll spy for navigation dots
    const sections = document.querySelectorAll('section[id], .scores-section[id]');
    const navDots = document.querySelectorAll('.nav-dot');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navDots.forEach(dot => dot.classList.remove('active'));
          const id = entry.target.id;
          const activeDot = document.querySelector('.nav-dot[href="#' + id + '"]');
          if (activeDot) activeDot.classList.add('active');
        }
      });
    }, { threshold: 0.3 });

    sections.forEach(section => observer.observe(section));
  </script>
</body>
</html>`;
}
export function generateCanonicalReportHtml(run) {
    const evaluation = run.evaluation;
    const personalitySummary = typeof evaluation.personalitySummary === 'string'
        ? evaluation.personalitySummary
        : '';
    const promptPatterns = Array.isArray(evaluation.promptPatterns)
        ? evaluation.promptPatterns
        : [];
    const projectSummaries = Array.isArray(evaluation.projectSummaries)
        ? evaluation.projectSummaries
        : [];
    const weeklyInsights = evaluation.weeklyInsights;
    const activitySessions = Array.isArray(run.activitySessions)
        ? run.activitySessions
        : [];
    const focusAreas = evaluation.topFocusAreas?.areas;
    const planningAnalysis = evaluation.planningAnalysis;
    const criticalThinkingAnalysis = evaluation.criticalThinkingAnalysis;
    const antiPatternsAnalysis = evaluation.antiPatternsAnalysis;
    const knowledgeResources = Array.isArray(evaluation.knowledgeResources)
        ? evaluation.knowledgeResources
        : [];
    const legacyContent = focusAreas
        ? {
            topFocusAreas: focusAreas.map(area => ({
                title: area.title,
                narrative: area.narrative,
                description: area.narrative,
                actions: area.actions,
            })),
        }
        : undefined;
    const typeResult = run.typeResult;
    const radarScores = {
        thinking: run.deterministicScores.thinkingQuality,
        communication: run.deterministicScores.communicationPatterns,
        learning: run.deterministicScores.learningBehavior,
        efficiency: run.deterministicScores.contextEfficiency,
        sessions: run.deterministicScores.sessionOutcome,
    };
    const radarLabels = {
        thinking: 'Thinking',
        communication: 'Communication',
        learning: 'Learning',
        efficiency: 'Efficiency',
        sessions: 'Sessions',
    };
    const radarSvg = generateRadarSvg(radarScores, radarLabels);
    const distributionBar = typeResult
        ? generateTypeDistributionBar(typeResult.distribution)
        : '<p style="color:var(--ink-muted);">Type classification not yet performed.</p>';
    const domainSections = run.domainResults.map(generateDomainSection).join('\n');
    const focusAreasSection = generateFocusAreas(legacyContent);
    const personalitySummarySection = generatePersonalitySummary(personalitySummary);
    const promptPatternsSection = generatePromptPatternsSection(promptPatterns);
    const projectSummariesSection = generateProjectSummariesSection(projectSummaries);
    const weeklyInsightsSection = generateWeeklyInsightsSection(weeklyInsights);
    const activitySection = generateActivitySection(activitySessions);
    const planningSection = generatePlanningAnalysisSection(planningAnalysis);
    const criticalThinkingSection = generateCriticalThinkingSection(criticalThinkingAnalysis);
    const antiPatternsSection = generateAntiPatternsSection(antiPatternsAnalysis);
    const knowledgeResourcesSection = generateKnowledgeResourcesSection(knowledgeResources);
    const navDots = [
        { id: 'identity', label: 'Identity' },
        { id: 'scores', label: 'Scores' },
        ...(personalitySummary ? [{ id: 'personality-summary', label: 'Summary' }] : []),
        ...(promptPatterns.length > 0 ? [{ id: 'prompt-patterns', label: 'Patterns' }] : []),
        ...(projectSummaries.length > 0 ? [{ id: 'project-summaries', label: 'Projects' }] : []),
        ...(weeklyInsights ? [{ id: 'weekly-insights', label: 'Week' }] : []),
        ...(activitySessions.length > 0 ? [{ id: 'activity-sessions', label: 'Activity' }] : []),
        ...(planningAnalysis ? [{ id: 'planning-analysis', label: 'Planning' }] : []),
        ...(criticalThinkingAnalysis ? [{ id: 'critical-thinking-analysis', label: 'Critical' }] : []),
        ...(antiPatternsAnalysis ? [{ id: 'anti-patterns-analysis', label: 'Anti' }] : []),
        ...(knowledgeResources.length > 0 ? [{ id: 'knowledge-resources', label: 'Resources' }] : []),
        ...run.domainResults.map((d) => ({
            id: `domain-${d.domain}`,
            label: DOMAIN_LABELS[d.domain]?.label ?? d.domain,
        })),
        ...(legacyContent?.topFocusAreas?.length ? [{ id: 'focus-areas', label: 'Focus' }] : []),
    ];
    const navDotsHtml = navDots
        .map((d) => `<a href="#${d.id}" class="nav-dot" title="${d.label}"><span class="dot"></span></a>`)
        .join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BetterPrompt Analysis Report</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&display=swap" media="print" onload="this.media='all'">
  <style>
    ${generateReportHtml({
        userId: 'local',
        analyzedAt: run.analyzedAt,
        phase1Metrics: run.phase1Output.sessionMetrics,
        deterministicScores: run.deterministicScores,
        typeResult: run.typeResult ?? null,
        domainResults: run.domainResults,
        content: legacyContent,
    }).match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''}
  </style>
</head>
<body>
  <nav class="nav-dots">${navDotsHtml}</nav>

  <div class="container">
    <header class="header">
      <h1>BetterPrompt Analysis</h1>
      <p class="subtitle">Generated ${new Date(run.analyzedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </header>

    <section class="identity" id="identity">
      ${typeResult ? `
        <div class="type-emoji">${typeResult.matrixEmoji}</div>
        <div class="type-info">
          <div class="type-name">${escapeHtml(typeResult.matrixName)}</div>
          <div class="type-detail">${escapeHtml(typeResult.primaryType)} / ${escapeHtml(typeResult.controlLevel)} (control: ${typeResult.controlScore})</div>
        </div>
      ` : `
        <div class="type-info">
          <div class="type-name">Type Not Classified</div>
          <div class="type-detail">Run type classification before generating the final report.</div>
        </div>
      `}
    </section>

    <div class="metrics-bar">
      <div class="metric">
        <div class="value">${run.phase1Output.sessionMetrics.totalSessions}</div>
        <div class="label">Sessions</div>
      </div>
      <div class="metric">
        <div class="value">${run.phase1Output.sessionMetrics.totalDeveloperUtterances}</div>
        <div class="label">Utterances</div>
      </div>
      <div class="metric">
        <div class="value">${Math.round(run.phase1Output.sessionMetrics.avgMessagesPerSession)}</div>
        <div class="label">Avg Messages/Session</div>
      </div>
      <div class="metric">
        <div class="value">${Math.round(run.phase1Output.sessionMetrics.questionRatio * 100)}%</div>
        <div class="label">Questions</div>
      </div>
      <div class="metric">
        <div class="value">${Math.round(run.phase1Output.sessionMetrics.codeBlockRatio * 100)}%</div>
        <div class="label">Code Blocks</div>
      </div>
    </div>

    <section class="scores-section" id="scores">
      <div class="radar-container">${radarSvg}</div>
      <div class="distribution-container">
        <h3 style="margin-bottom:12px;">Type Distribution</h3>
        ${distributionBar}
      </div>
    </section>

    ${personalitySummarySection}
    ${promptPatternsSection}
    ${projectSummariesSection}
    ${weeklyInsightsSection}
    ${activitySection}
    ${planningSection}
    ${criticalThinkingSection}
    ${antiPatternsSection}
    ${knowledgeResourcesSection}
    ${domainSections}
    ${focusAreasSection}

    <footer class="footer">
      Generated by BetterPrompt Plugin v0.2.0 - local-first AI collaboration analysis
    </footer>
  </div>

  <script>
    const sections = document.querySelectorAll('section[id], .scores-section[id]');
    const navDots = document.querySelectorAll('.nav-dot');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navDots.forEach(dot => dot.classList.remove('active'));
          const id = entry.target.id;
          const activeDot = document.querySelector('.nav-dot[href="#' + id + '"]');
          if (activeDot) activeDot.classList.add('active');
        }
      });
    }, { threshold: 0.3 });

    sections.forEach(section => observer.observe(section));
  </script>
</body>
</html>`;
}
//# sourceMappingURL=report-template.js.map