/**
 * HTML Report Template Generator
 *
 * Generates a standalone HTML report with inlined CSS/JS/SVG.
 * Uses the notebook-sketch design system from the main app.
 *
 * @module plugin/lib/report-template
 */
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
        <h4>${s.title}</h4>
        <p>${s.description}</p>
        ${s.evidence.length > 0 ? `
          <details>
            <summary>Evidence (${s.evidence.length})</summary>
            <ul>
              ${s.evidence.map(e => `<li><code>${e.utteranceId}</code>: "${e.quote}"</li>`).join('')}
            </ul>
          </details>
        ` : ''}
      </div>
    `)
        .join('');
    const growthCards = result.growthAreas
        .map(g => `
      <div class="card growth-card">
        <div class="severity-badge severity-${g.severity}">${g.severity}</div>
        <h4>${g.title}</h4>
        <p>${g.description}</p>
        <div class="recommendation">${g.recommendation}</div>
        ${g.evidence.length > 0 ? `
          <details>
            <summary>Evidence (${g.evidence.length})</summary>
            <ul>
              ${g.evidence.map(e => `<li><code>${e.utteranceId}</code>: "${e.quote}"</li>`).join('')}
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
        <h3>${area.title}</h3>
        <p>${area.narrative}</p>
        <div class="actions-grid">
          <div class="action start"><strong>Start:</strong> ${area.actions.start}</div>
          <div class="action stop"><strong>Stop:</strong> ${area.actions.stop}</div>
          <div class="action continue"><strong>Continue:</strong> ${area.actions.continue}</div>
        </div>
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
    const distributionBar = generateTypeDistributionBar(typeResult.distribution);
    // Domain sections
    const domainSections = domainResults.map(generateDomainSection).join('\n');
    // Focus areas
    const focusAreasSection = generateFocusAreas(content);
    // Navigation dots
    const navDots = [
        { id: 'identity', label: 'Identity' },
        { id: 'scores', label: 'Scores' },
        ...domainResults.map(d => ({
            id: `domain-${d.domain}`,
            label: DOMAIN_LABELS[d.domain]?.label ?? d.domain,
        })),
        ...(content?.topFocusAreas?.length ? [{ id: 'focus-areas', label: 'Focus' }] : []),
    ];
    const navDotsHtml = navDots
        .map(d => `<a href="#${d.id}" class="nav-dot" title="${d.label}"><span class="dot"></span></a>`)
        .join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BetterPrompt Analysis Report</title>
  <style>
    /* ── Notebook Sketch Design System ── */
    @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&display=swap');

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
      <div class="type-emoji">${typeResult.matrixEmoji}</div>
      <div class="type-info">
        <div class="type-name">${typeResult.matrixName}</div>
        <div class="type-detail">${typeResult.primaryType} / ${typeResult.controlLevel} (control: ${typeResult.controlScore})</div>
      </div>
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
//# sourceMappingURL=report-template.js.map