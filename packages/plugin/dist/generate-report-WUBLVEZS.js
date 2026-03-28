import {
  markAnalysisComplete
} from "./chunk-ZNJUTHXJ.js";
import "./chunk-SE3623WC.js";
import "./chunk-FW6ZW4J3.js";
import {
  REQUIRED_STAGE_NAMES,
  assembleCanonicalRun,
  getCurrentRunId,
  getDomainResult,
  getStageOutput,
  getStageStatuses
} from "./chunk-FFMI5SRQ.js";
import {
  getPluginDataDir
} from "./chunk-SVAMHER4.js";
import "./chunk-NSBPE2FW.js";

// cli/commands/generate-report.ts
import { readFileSync } from "fs";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { createServer } from "http";
import { exec } from "child_process";

// lib/report-template.ts
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function polarToCartesian(cx, cy, radius, angleDeg) {
  const angleRad = (angleDeg - 90) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad)
  };
}
function generateRadarSvg(scores, labels, size = 300) {
  const entries = Object.entries(scores);
  const count = entries.length;
  if (count === 0) return "";
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - 40;
  const angleStep = 360 / count;
  const gridCircles = [0.25, 0.5, 0.75, 1].map((frac) => {
    const r = maxRadius * frac;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#E8EDF5" stroke-width="1" />`;
  }).join("\n");
  const gridLines = entries.map(([key], i) => {
    const angle = i * angleStep;
    const end = polarToCartesian(cx, cy, maxRadius, angle);
    const labelPos = polarToCartesian(cx, cy, maxRadius + 20, angle);
    const label = labels[key] ?? key;
    return `
        <line x1="${cx}" y1="${cy}" x2="${end.x}" y2="${end.y}" stroke="#E8EDF5" stroke-width="1" />
        <text x="${labelPos.x}" y="${labelPos.y}" text-anchor="middle" dominant-baseline="middle"
              font-size="11" font-family="'Fira Code', monospace" fill="#4A4A5A">${label}</text>
      `;
  }).join("\n");
  const points = entries.map(([, score], i) => {
    const angle = i * angleStep;
    const r = maxRadius * (score / 100);
    const p = polarToCartesian(cx, cy, r, angle);
    return `${p.x},${p.y}`;
  }).join(" ");
  const dots = entries.map(([, score], i) => {
    const angle = i * angleStep;
    const r = maxRadius * (score / 100);
    const p = polarToCartesian(cx, cy, r, angle);
    return `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#00BCD4" />`;
  }).join("\n");
  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      ${gridCircles}
      ${gridLines}
      <polygon points="${points}" fill="rgba(0,188,212,0.15)" stroke="#00BCD4" stroke-width="2" />
      ${dots}
    </svg>
  `;
}
function generateTypeDistributionBar(distribution) {
  const colors = {
    architect: "#3B82F6",
    analyst: "#9C7CF4",
    conductor: "#FFD93D",
    speedrunner: "#4ADE80",
    trendsetter: "#FF6B9D"
  };
  const entries = Object.entries(distribution);
  entries.sort((a, b) => b[1] - a[1]);
  const bars = entries.map(([type, pct]) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="width:100px;font-size:12px;color:#4A4A5A;text-transform:capitalize;">${type}</span>
        <div style="flex:1;height:20px;background:#F0F0F5;border-radius:4px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${colors[type]};border-radius:4px;transition:width 0.5s;"></div>
        </div>
        <span style="width:35px;text-align:right;font-size:12px;font-weight:600;color:#1A1A2E;">${pct}%</span>
      </div>
    `).join("");
  return `<div style="margin:16px 0;">${bars}</div>`;
}
var RADAR_LABELS = {
  aiPartnership: "AI Partnership",
  sessionCraft: "Session Craft",
  toolMastery: "Tool Mastery",
  skillResilience: "Skill Resilience",
  sessionMastery: "Session Mastery"
};
function buildRadarScores(scores) {
  return {
    aiPartnership: scores.aiPartnership,
    sessionCraft: scores.sessionCraft,
    toolMastery: scores.toolMastery,
    skillResilience: scores.skillResilience,
    sessionMastery: scores.sessionMastery
  };
}
var DOMAIN_LABELS = {
  aiPartnership: { label: "AI Partnership", emoji: "\u{1F91D}" },
  sessionCraft: { label: "Session Craft", emoji: "\u{1F6E0}\uFE0F" },
  toolMastery: { label: "Tool Mastery", emoji: "\u{1F527}" },
  skillResilience: { label: "Skill Resilience", emoji: "\u{1F9E9}" },
  sessionMastery: { label: "Session Mastery", emoji: "\u2728" },
  // Legacy domain labels for old runs
  thinkingQuality: { label: "Thinking Quality", emoji: "\u{1F9E0}" },
  communicationPatterns: { label: "Communication", emoji: "\u{1F4AC}" },
  learningBehavior: { label: "Learning", emoji: "\u{1F4DA}" },
  contextEfficiency: { label: "Efficiency", emoji: "\u26A1" },
  sessionOutcome: { label: "Sessions", emoji: "\u{1F3AF}" },
  content: { label: "Skill Resilience", emoji: "\u{1F9E9}" }
};
function generateDomainSection(result) {
  const meta = DOMAIN_LABELS[result.domain] ?? { label: result.domain, emoji: "\u{1F4CA}" };
  const strengthCards = result.strengths.map((s) => `
      <div class="card strength-card">
        <h4>${escapeHtml(s.title)}</h4>
        <p>${escapeHtml(s.description)}</p>
        ${s.evidence.length > 0 ? `
          <details>
            <summary>Evidence (${s.evidence.length})</summary>
            <ul>
              ${s.evidence.map((e) => `<li><code>${escapeHtml(e.utteranceId)}</code>: "${escapeHtml(e.quote)}"</li>`).join("")}
            </ul>
          </details>
        ` : ""}
      </div>
    `).join("");
  const growthCards = result.growthAreas.map((g) => `
      <div class="card growth-card">
        <div class="severity-badge severity-${escapeHtml(g.severity)}">${escapeHtml(g.severity)}</div>
        <h4>${escapeHtml(g.title)}</h4>
        <p>${escapeHtml(g.description)}</p>
        <div class="recommendation">${escapeHtml(g.recommendation)}</div>
        ${g.evidence.length > 0 ? `
          <details>
            <summary>Evidence (${g.evidence.length})</summary>
            <ul>
              ${g.evidence.map((e) => `<li><code>${escapeHtml(e.utteranceId)}</code>: "${escapeHtml(e.quote)}"</li>`).join("")}
            </ul>
          </details>
        ` : ""}
      </div>
    `).join("");
  return `
    <section class="domain-section" id="domain-${result.domain}">
      <h2>${meta.emoji} ${meta.label} <span class="score">${result.overallScore}/100</span></h2>
      ${result.strengths.length > 0 ? `<h3>Strengths</h3><div class="card-grid">${strengthCards}</div>` : ""}
      ${result.growthAreas.length > 0 ? `<h3>Growth Areas</h3><div class="card-grid">${growthCards}</div>` : ""}
    </section>
  `;
}
function generateFocusAreas(content) {
  if (!content?.topFocusAreas?.length) return "";
  const areas = content.topFocusAreas.map((area) => `
      <div class="card focus-card">
        <h3>${escapeHtml(area.title)}</h3>
        <p>${escapeHtml(area.narrative ?? area.description ?? "")}</p>
        ${area.actions ? `
        <div class="actions-grid">
          <div class="action start"><strong>Start:</strong> ${escapeHtml(area.actions.start)}</div>
          <div class="action stop"><strong>Stop:</strong> ${escapeHtml(area.actions.stop)}</div>
          <div class="action continue"><strong>Continue:</strong> ${escapeHtml(area.actions.continue)}</div>
        </div>
        ` : ""}
      </div>
    `).join("");
  return `
    <section class="domain-section" id="focus-areas">
      <h2>\u{1F3AF} Top Focus Areas</h2>
      ${areas}
    </section>
  `;
}
function generatePersonalitySummary(summary) {
  if (!summary?.trim()) return "";
  return `
    <section class="domain-section" id="personality-summary">
      <h2>\u{1FA9E} Personality Summary</h2>
      <div class="card">
        <p>${escapeHtml(summary).replace(/\n/g, "<br>")}</p>
      </div>
    </section>
  `;
}
function generatePromptPatternsSection(promptPatterns) {
  if (!promptPatterns?.length) return "";
  const items = promptPatterns.map((pattern) => `
      <div class="card">
        <h4>${escapeHtml(pattern.patternName ?? "Pattern")}</h4>
        <p>${escapeHtml(pattern.description ?? "")}</p>
        <p style="margin-top:8px;font-size:12px;"><strong>Frequency:</strong> ${escapeHtml(pattern.frequency ?? "n/a")}</p>
        ${(pattern.examples?.length ?? 0) > 0 ? `
          <details>
            <summary>Examples (${pattern.examples.length})</summary>
            <ul>
              ${pattern.examples.map((example) => `<li>"${escapeHtml(example.quote ?? "")}"${example.analysis ? ` \u2014 ${escapeHtml(example.analysis)}` : ""}</li>`).join("")}
            </ul>
          </details>
        ` : ""}
      </div>
    `).join("");
  return `
    <section class="domain-section" id="prompt-patterns">
      <h2>\u{1F9E9} Prompt Patterns</h2>
      <div class="card-grid">${items}</div>
    </section>
  `;
}
function generateProjectSummariesSection(projectSummaries) {
  if (!projectSummaries?.length) return "";
  const items = projectSummaries.map((project) => `
      <div class="card">
        <h4>${escapeHtml(project.projectName)} <span style="color:var(--ink-muted);font-weight:400;">(${project.sessionCount} sessions)</span></h4>
        <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
          ${project.summaryLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
        </ul>
      </div>
    `).join("");
  return `
    <section class="domain-section" id="project-summaries">
      <h2>\u{1F4C1} Project Summaries</h2>
      <div class="card-grid">${items}</div>
    </section>
  `;
}
function heatmapToDateKey(dateStr) {
  return dateStr.slice(0, 10);
}
function heatmapGetWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function heatmapAddDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function heatmapFormatTokenCount(tokens) {
  if (tokens >= 1e9) return `${(tokens / 1e9).toFixed(1)}B`;
  if (tokens >= 1e6) return `${(tokens / 1e6).toFixed(1)}M`;
  if (tokens >= 1e3) return `${(tokens / 1e3).toFixed(1)}K`;
  return String(tokens);
}
function heatmapGetIntensityByCount(count) {
  if (count === 0) return 0;
  if (count <= 2) return count;
  if (count <= 4) return 3;
  return 4;
}
function heatmapComputeTokenIntensity(grid) {
  const nonZero = grid.map((d) => d.totalTokens).filter((t) => t > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) {
    return () => 0;
  }
  const p25 = nonZero[Math.floor(nonZero.length * 0.25)];
  const p50 = nonZero[Math.floor(nonZero.length * 0.5)];
  const p75 = nonZero[Math.floor(nonZero.length * 0.75)];
  return (tokens) => {
    if (tokens === 0) return 0;
    if (tokens <= p25) return 1;
    if (tokens <= p50) return 2;
    if (tokens <= p75) return 3;
    return 4;
  };
}
function heatmapFormatDate(dateStr) {
  const d = /* @__PURE__ */ new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}
function generateActivityHeatmapSection(activitySessions) {
  if (!activitySessions || activitySessions.length === 0) return "";
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const unified = activitySessions.map((s) => ({
    sessionId: s.sessionId,
    projectName: s.projectName,
    startTime: s.startTime,
    durationMinutes: s.durationMinutes,
    messageCount: s.messageCount,
    summary: s.summary || "",
    totalTokens: (s.totalInputTokens || 0) + (s.totalOutputTokens || 0)
  }));
  const sessionsByDate = /* @__PURE__ */ new Map();
  for (const session of unified) {
    const dateKey = heatmapToDateKey(session.startTime);
    if (!sessionsByDate.has(dateKey)) {
      sessionsByDate.set(dateKey, []);
    }
    sessionsByDate.get(dateKey).push(session);
  }
  const dates = unified.map((s) => new Date(s.startTime)).sort((a, b) => a.getTime() - b.getTime());
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const weekStart = heatmapGetWeekStart(startDate);
  const weekEnd = heatmapAddDays(endDate, 6 - endDate.getDay());
  const grid = [];
  const monthLabels = [];
  let currentDate = new Date(weekStart);
  let prevMonth = -1;
  let column = 0;
  while (currentDate <= weekEnd) {
    const dateKey = currentDate.toISOString().slice(0, 10);
    const sessions = sessionsByDate.get(dateKey) || [];
    const totalTokens = sessions.reduce((sum, s) => sum + s.totalTokens, 0);
    grid.push({ date: dateKey, count: sessions.length, totalTokens, sessions });
    const dayOfWeek = currentDate.getDay();
    const month = currentDate.getMonth();
    if (dayOfWeek === 0 && month !== prevMonth) {
      monthLabels.push({ text: MONTH_NAMES[month], column });
      prevMonth = month;
    }
    if (dayOfWeek === 6) {
      column++;
    }
    currentDate = heatmapAddDays(currentDate, 1);
  }
  const totalWeeks = Math.ceil(grid.length / 7);
  const hasTokenData = unified.some((s) => s.totalTokens > 0);
  const getTokenIntensity = heatmapComputeTokenIntensity(grid);
  const cellSize = 16;
  const gap = 3;
  const totalSessions = unified.length;
  const activeDays = sessionsByDate.size;
  const totalTokensAll = unified.reduce((sum, s) => sum + s.totalTokens, 0);
  const projectCounts = /* @__PURE__ */ new Map();
  for (const session of unified) {
    projectCounts.set(session.projectName, (projectCounts.get(session.projectName) || 0) + 1);
  }
  let mostActiveProject = "";
  let maxCount = 0;
  for (const [project, count] of projectCounts) {
    if (count > maxCount) {
      mostActiveProject = project;
      maxCount = count;
    }
  }
  const statCards = `
    <div class="heatmap-stats">
      <div class="heatmap-stat heatmap-stat-blue">
        <span class="heatmap-stat-value">${totalSessions}</span>
        <span class="heatmap-stat-label">Sessions</span>
      </div>
      <div class="heatmap-stat heatmap-stat-green">
        <span class="heatmap-stat-value">${activeDays}</span>
        <span class="heatmap-stat-label">Active Days</span>
      </div>
      ${totalTokensAll > 0 ? `
        <div class="heatmap-stat heatmap-stat-purple">
          <span class="heatmap-stat-value">${heatmapFormatTokenCount(totalTokensAll)}</span>
          <span class="heatmap-stat-label">Total Tokens</span>
        </div>
      ` : ""}
      ${mostActiveProject ? `
        <div class="heatmap-stat heatmap-stat-blue">
          <span class="heatmap-stat-value">${escapeHtml(mostActiveProject)}</span>
          <span class="heatmap-stat-label">Top Project</span>
        </div>
      ` : ""}
    </div>
  `;
  const monthLabelsHtml = monthLabels.map(
    (m) => `<span class="hm-month-label" style="left:${36 + m.column * (cellSize + gap)}px;">${m.text}</span>`
  ).join("");
  const dayLabelsHtml = DAY_LABELS.map(
    (label, i) => `<span class="hm-day-label${i % 2 === 0 ? " hm-day-hidden" : ""}" style="height:${cellSize}px;line-height:${cellSize}px;">${label}</span>`
  ).join("");
  const cellsHtml = grid.map((day) => {
    const intensity = hasTokenData ? getTokenIntensity(day.totalTokens) : heatmapGetIntensityByCount(day.count);
    const title = day.count > 0 ? `${heatmapFormatDate(day.date)}: ${day.totalTokens > 0 ? `${heatmapFormatTokenCount(day.totalTokens)} tokens, ` : ""}${day.count} session${day.count !== 1 ? "s" : ""}` : `${heatmapFormatDate(day.date)}: No sessions`;
    return `<div class="hm-cell hm-level${intensity}" data-date="${day.date}" title="${escapeHtml(title)}"${day.count > 0 ? ' onclick="showHeatmapDetail(this.dataset.date)"' : ""}></div>`;
  }).join("");
  const legendHtml = `
    <div class="hm-legend">
      <span class="hm-legend-label">Less</span>
      <div class="hm-legend-cells">
        ${[0, 1, 2, 3, 4].map((level) => `<div class="hm-legend-cell hm-level${level}"></div>`).join("")}
      </div>
      <span class="hm-legend-label">More</span>
    </div>
  `;
  const sessionDataByDate = {};
  for (const day of grid) {
    if (day.sessions.length > 0) {
      sessionDataByDate[day.date] = day.sessions;
    }
  }
  return `
    <section class="heatmap-section" id="activity-heatmap">
      <div class="heatmap-header">
        <span class="heatmap-header-icon">\u{1F4CA}</span>
        <div class="heatmap-header-text">
          <h2 class="heatmap-title">Monthly Vibe</h2>
          <p class="heatmap-subtitle">${totalSessions} sessions &middot; ${activeDays} active days</p>
        </div>
      </div>
      <div class="heatmap-body">
        ${statCards}
        <div class="heatmap-graph">
          <div class="hm-month-row">${monthLabelsHtml}</div>
          <div class="hm-graph-wrapper">
            <div class="hm-day-labels">${dayLabelsHtml}</div>
            <div class="hm-grid" style="grid-template-columns:repeat(${totalWeeks},${cellSize}px);">
              ${cellsHtml}
            </div>
          </div>
          ${legendHtml}
        </div>
        <div id="heatmap-detail" class="hm-detail" style="display:none;"></div>
      </div>
    </section>
    <script>
      var __heatmapData = ${JSON.stringify(sessionDataByDate).replace(/</g, "\\u003c")};
      function escHtml(s) {
        var d = document.createElement('div');
        d.appendChild(document.createTextNode(s));
        return d.innerHTML;
      }
      function formatHmTokens(t) {
        if (t >= 1e9) return (t/1e9).toFixed(1)+'B';
        if (t >= 1e6) return (t/1e6).toFixed(1)+'M';
        if (t >= 1e3) return (t/1e3).toFixed(1)+'K';
        return String(t);
      }
      function formatHmDuration(m) {
        if (m < 60) return m + 'm';
        return Math.floor(m/60) + 'h ' + (m%60) + 'm';
      }
      function showHeatmapDetail(dateKey) {
        var panel = document.getElementById('heatmap-detail');
        if (panel.dataset.activeDate === dateKey) {
          panel.style.display = 'none';
          panel.dataset.activeDate = '';
          document.querySelectorAll('.hm-cell-selected').forEach(function(el) { el.classList.remove('hm-cell-selected'); });
          return;
        }
        panel.dataset.activeDate = dateKey;
        document.querySelectorAll('.hm-cell-selected').forEach(function(el) { el.classList.remove('hm-cell-selected'); });
        var clickedCell = document.querySelector('.hm-cell[data-date="' + dateKey + '"]');
        if (clickedCell) clickedCell.classList.add('hm-cell-selected');

        var sessions = __heatmapData[dateKey] || [];
        if (sessions.length === 0) { panel.style.display = 'none'; return; }

        var d = new Date(dateKey + 'T00:00:00');
        var dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

        // Group by project
        var projects = {};
        sessions.forEach(function(s) {
          if (!projects[s.projectName]) projects[s.projectName] = { sessions: [], totalTokens: 0, totalMinutes: 0 };
          projects[s.projectName].sessions.push(s);
          projects[s.projectName].totalTokens += s.totalTokens;
          projects[s.projectName].totalMinutes += s.durationMinutes;
        });

        var html = '<div class="hm-detail-header">' +
          '<h4 class="hm-detail-date">' + dateStr + '</h4>' +
          '<span class="hm-detail-count">' + sessions.length + ' session' + (sessions.length !== 1 ? 's' : '') + '</span>' +
          '<button class="hm-detail-close" onclick="closeHeatmapDetail()" type="button">&times;</button>' +
          '</div><div class="hm-detail-projects">';

        Object.keys(projects).sort(function(a, b) {
          return projects[b].sessions.length - projects[a].sessions.length;
        }).forEach(function(name) {
          var p = projects[name];
          var meta = p.sessions.length + ' session' + (p.sessions.length !== 1 ? 's' : '');
          if (p.totalTokens > 0) meta += ' &middot; ' + formatHmTokens(p.totalTokens) + ' tokens';
          if (p.totalMinutes > 0) meta += ' &middot; ' + formatHmDuration(p.totalMinutes);
          html += '<div class="hm-detail-project">' +
            '<div class="hm-detail-project-header">' +
            '<span class="hm-detail-project-name">' + escHtml(name) + '</span>' +
            '<span class="hm-detail-project-meta">' + meta + '</span>' +
            '</div>';
          var summaries = p.sessions.map(function(s) { return s.summary; }).filter(function(s) { return s; });
          if (summaries.length > 0) {
            html += '<ul class="hm-detail-summaries">';
            summaries.slice(0, 3).forEach(function(s) { html += '<li>' + escHtml(s) + '</li>'; });
            if (summaries.length > 3) html += '<li style="opacity:0.6;">+' + (summaries.length - 3) + ' more</li>';
            html += '</ul>';
          }
          html += '</div>';
        });

        html += '</div>';
        panel.innerHTML = html;
        panel.style.display = 'block';
      }
      function closeHeatmapDetail() {
        var panel = document.getElementById('heatmap-detail');
        panel.style.display = 'none';
        panel.dataset.activeDate = '';
        document.querySelectorAll('.hm-cell-selected').forEach(function(el) { el.classList.remove('hm-cell-selected'); });
      }
    </script>
  `;
}
function generateWeeklyInsightsSection(weeklyInsights) {
  if (!weeklyInsights) return "";
  const stats = weeklyInsights.stats;
  const highlights = weeklyInsights.highlights ?? [];
  const projects = weeklyInsights.projects ?? [];
  const topSessions = weeklyInsights.topProjectSessions ?? [];
  return `
    <section class="domain-section" id="weekly-insights">
      <h2>\u{1F4C6} Weekly Insights</h2>
      ${stats ? `
        <div class="metrics-bar" style="margin-bottom:16px;">
          <div class="metric"><div class="value">${stats.totalSessions ?? 0}</div><div class="label">Sessions</div></div>
          <div class="metric"><div class="value">${Math.round(stats.totalMinutes ?? 0)}</div><div class="label">Minutes</div></div>
          <div class="metric"><div class="value">${Math.round((stats.totalTokens ?? 0) / 1e3)}k</div><div class="label">Tokens</div></div>
          <div class="metric"><div class="value">${stats.activeDays ?? 0}</div><div class="label">Active Days</div></div>
        </div>
      ` : ""}
      ${weeklyInsights.narrative ? `<div class="card"><p>${escapeHtml(weeklyInsights.narrative)}</p></div>` : ""}
      ${projects.length > 0 ? `
        <div class="card">
          <h4>Project Breakdown</h4>
          <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
            ${projects.map((project) => `<li>${escapeHtml(project.projectName)}: ${project.sessionCount} sessions, ${project.percentage}%</li>`).join("")}
          </ul>
        </div>
      ` : ""}
      ${topSessions.length > 0 ? `
        <div class="card">
          <h4>Top Sessions</h4>
          <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
            ${topSessions.map((session) => `<li>${escapeHtml(session.date)} \xB7 ${Math.round(session.durationMinutes)} min \xB7 ${escapeHtml(session.summary)}</li>`).join("")}
          </ul>
        </div>
      ` : ""}
      ${highlights.length > 0 ? `
        <div class="card">
          <h4>Highlights</h4>
          <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
            ${highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </div>
      ` : ""}
    </section>
  `;
}
function generateKnowledgeResourcesSection(knowledgeResources) {
  if (!knowledgeResources?.length) return "";
  return `
    <section class="domain-section" id="knowledge-resources">
      <h2>\u{1F4DA} Knowledge Resources</h2>
      <div class="card-grid">
        ${knowledgeResources.map((group) => `
          <div class="card">
            <h4>${escapeHtml(group.dimensionDisplayName ?? "Recommended Resources")}</h4>
            ${(group.professionalInsights?.length ?? 0) > 0 ? `
              <p style="margin-top:8px;"><strong>Professional Insights</strong></p>
              <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
                ${group.professionalInsights.slice(0, 3).map((item) => `<li>${escapeHtml(item.title ?? "Insight")}${item.keyTakeaway ? `: ${escapeHtml(item.keyTakeaway)}` : ""}</li>`).join("")}
              </ul>
            ` : ""}
            ${(group.knowledgeItems?.length ?? 0) > 0 ? `
              <p style="margin-top:8px;"><strong>Suggested Reading</strong></p>
              <ul style="padding-left:20px;font-size:13px;color:var(--ink-secondary);">
                ${group.knowledgeItems.slice(0, 3).map((item) => `<li>${escapeHtml(item.title ?? "Resource")}${item.summary ? `: ${escapeHtml(item.summary)}` : ""}</li>`).join("")}
              </ul>
            ` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  `;
}
function generateBaseCss() {
  return `
    /* \u2500\u2500 Notebook Sketch Design System \u2500\u2500 */

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

    /* \u2500\u2500 Header \u2500\u2500 */
    .header {
      text-align: center;
      margin-bottom: 48px;
      padding-bottom: 24px;
      border-bottom: 2px solid var(--ink-primary);
    }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .header .subtitle { color: var(--ink-secondary); font-size: 13px; }

    /* \u2500\u2500 Identity Section \u2500\u2500 */
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

    /* \u2500\u2500 Scores Grid \u2500\u2500 */
    .scores-section {
      display: flex;
      gap: 32px;
      margin-bottom: 48px;
      align-items: flex-start;
    }
    .radar-container { flex-shrink: 0; }
    .distribution-container { flex: 1; }

    /* \u2500\u2500 Cards \u2500\u2500 */
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

    /* \u2500\u2500 Domain Sections \u2500\u2500 */
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

    /* \u2500\u2500 Actions Grid \u2500\u2500 */
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

    /* \u2500\u2500 Metrics Bar \u2500\u2500 */
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

    /* \u2500\u2500 Navigation Dots \u2500\u2500 */
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

    /* \u2500\u2500 Footer \u2500\u2500 */
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
  `;
}
function renderNavDotsHtml(dots) {
  return dots.map((d) => `<a href="#${d.id}" class="nav-dot" title="${d.label}"><span class="dot"></span></a>`).join("");
}
function renderIdentitySection(typeResult, fallbackMessage) {
  if (typeResult) {
    return `
      <div class="type-emoji">${typeResult.matrixEmoji}</div>
      <div class="type-info">
        <div class="type-name">${escapeHtml(typeResult.matrixName)}</div>
        <div class="type-detail">${escapeHtml(typeResult.primaryType)} / ${escapeHtml(typeResult.controlLevel)} (control: ${typeResult.controlScore})</div>
      </div>
    `;
  }
  return `
    <div class="type-info">
      <div class="type-name">Type Not Classified</div>
      <div class="type-detail">${escapeHtml(fallbackMessage)}</div>
    </div>
  `;
}
function renderMetricsBar(metrics) {
  return `
    <div class="metrics-bar">
      <div class="metric">
        <div class="value">${metrics.totalSessions}</div>
        <div class="label">Sessions</div>
      </div>
      <div class="metric">
        <div class="value">${metrics.totalDeveloperUtterances}</div>
        <div class="label">Utterances</div>
      </div>
      <div class="metric">
        <div class="value">${Math.round(metrics.avgMessagesPerSession)}</div>
        <div class="label">Avg Messages/Session</div>
      </div>
      <div class="metric">
        <div class="value">${Math.round(metrics.questionRatio * 100)}%</div>
        <div class="label">Questions</div>
      </div>
      <div class="metric">
        <div class="value">${Math.round(metrics.codeBlockRatio * 100)}%</div>
        <div class="label">Code Blocks</div>
      </div>
    </div>
  `;
}
function renderScrollSpyScript() {
  return `
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
  </script>`;
}
function generateCanonicalReportHtml(run) {
  const evaluation = run.evaluation;
  const personalitySummary = typeof evaluation.personalitySummary === "string" ? evaluation.personalitySummary : "";
  const promptPatterns = Array.isArray(evaluation.promptPatterns) ? evaluation.promptPatterns : [];
  const projectSummaries = Array.isArray(evaluation.projectSummaries) ? evaluation.projectSummaries : [];
  const weeklyInsights = evaluation.weeklyInsights;
  const focusAreas = evaluation.topFocusAreas?.areas;
  const knowledgeResources = Array.isArray(evaluation.knowledgeResources) ? evaluation.knowledgeResources : [];
  const legacyContent = focusAreas ? {
    topFocusAreas: focusAreas.map((area) => ({
      title: area.title,
      narrative: area.narrative,
      description: area.narrative,
      actions: area.actions
    }))
  } : void 0;
  const typeResult = run.typeResult;
  const radarSvg = generateRadarSvg(buildRadarScores(run.deterministicScores), RADAR_LABELS);
  const distributionBar = typeResult ? generateTypeDistributionBar(typeResult.distribution) : '<p style="color:var(--ink-muted);">Type classification not yet performed.</p>';
  const domainSections = run.domainResults.map(generateDomainSection).join("\n");
  const focusAreasSection = generateFocusAreas(legacyContent);
  const personalitySummarySection = generatePersonalitySummary(personalitySummary);
  const promptPatternsSection = generatePromptPatternsSection(promptPatterns);
  const projectSummariesSection = generateProjectSummariesSection(projectSummaries);
  const weeklyInsightsSection = generateWeeklyInsightsSection(weeklyInsights);
  const knowledgeResourcesSection = generateKnowledgeResourcesSection(knowledgeResources);
  const activityHeatmapSection = generateActivityHeatmapSection(run.activitySessions);
  const navDots = [
    { id: "identity", label: "Identity" },
    { id: "scores", label: "Scores" },
    ...(run.activitySessions?.length ?? 0) > 0 ? [{ id: "activity-heatmap", label: "Activity" }] : [],
    ...personalitySummary ? [{ id: "personality-summary", label: "Summary" }] : [],
    ...promptPatterns.length > 0 ? [{ id: "prompt-patterns", label: "Patterns" }] : [],
    ...projectSummaries.length > 0 ? [{ id: "project-summaries", label: "Projects" }] : [],
    ...weeklyInsights ? [{ id: "weekly-insights", label: "Week" }] : [],
    ...knowledgeResources.length > 0 ? [{ id: "knowledge-resources", label: "Resources" }] : [],
    ...run.domainResults.map((d) => ({
      id: `domain-${d.domain}`,
      label: DOMAIN_LABELS[d.domain]?.label ?? d.domain
    })),
    ...legacyContent?.topFocusAreas?.length ? [{ id: "focus-areas", label: "Focus" }] : []
  ];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BetterPrompt Analysis Report</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&display=swap" media="print" onload="this.media='all'">
  <style>
    ${generateBaseCss()}

    /* \u2500\u2500 Activity Heatmap \u2500\u2500 */
    .heatmap-section {
      margin-bottom: 48px;
      background: var(--bg-paper);
      border: 2px solid var(--ink-primary);
      border-radius: 8px;
      overflow: hidden;
    }
    .heatmap-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: var(--ink-primary);
      color: var(--bg-paper);
    }
    .heatmap-header-icon { font-size: 24px; }
    .heatmap-title {
      font-size: 18px;
      font-weight: 600;
      margin: 0;
      color: var(--bg-paper);
    }
    .heatmap-subtitle {
      font-size: 12px;
      color: var(--ink-muted);
      margin: 2px 0 0 0;
    }
    .heatmap-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .heatmap-stats {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .heatmap-stat {
      flex: 1;
      min-width: 110px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      border: 1px solid var(--bg-grid-color);
      border-left: 3px solid var(--bg-grid-color);
      border-radius: 8px;
      background: var(--bg-paper);
    }
    .heatmap-stat-blue { border-left-color: var(--sketch-blue); background: rgba(59,130,246,0.06); }
    .heatmap-stat-green { border-left-color: var(--sketch-green); background: rgba(74,222,128,0.06); }
    .heatmap-stat-purple { border-left-color: var(--sketch-purple); background: rgba(156,124,244,0.06); }
    .heatmap-stat-value {
      font-size: 22px;
      font-weight: 700;
      color: var(--ink-primary);
      line-height: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .heatmap-stat-blue .heatmap-stat-value { color: var(--sketch-blue); }
    .heatmap-stat-green .heatmap-stat-value { color: #16a34a; }
    .heatmap-stat-purple .heatmap-stat-value { color: var(--sketch-purple); }
    .heatmap-stat-label {
      font-size: 10px;
      font-weight: 500;
      color: var(--ink-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .heatmap-graph { padding: 8px 0; }
    .hm-month-row {
      position: relative;
      height: 16px;
      margin-bottom: 4px;
      padding-left: 36px;
    }
    .hm-month-label {
      position: absolute;
      font-size: 10px;
      font-weight: 500;
      color: var(--ink-muted);
      white-space: nowrap;
    }
    .hm-graph-wrapper {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 4px;
    }
    .hm-day-labels {
      display: flex;
      flex-direction: column;
      gap: 3px;
      width: 32px;
      flex-shrink: 0;
    }
    .hm-day-label {
      font-size: 10px;
      font-weight: 500;
      color: var(--ink-muted);
      text-align: right;
    }
    .hm-day-hidden { visibility: hidden; }
    .hm-grid {
      display: grid;
      grid-template-rows: repeat(7, 16px);
      grid-auto-flow: column;
      grid-auto-columns: 16px;
      gap: 3px;
    }
    .hm-cell {
      width: 16px;
      height: 16px;
      border-radius: 2px;
      cursor: default;
      outline: none;
      transition: outline-color 0.1s;
    }
    .hm-cell[onclick] { cursor: pointer; }
    .hm-cell:hover { outline: 2px solid var(--ink-secondary); outline-offset: -1px; }
    .hm-cell-selected {
      outline: 2px solid var(--ink-primary);
      outline-offset: -1px;
      box-shadow: 0 0 0 2px var(--sketch-blue);
    }
    .hm-level0 { background-color: #EBEDF0; }
    .hm-level1 { background-color: #9BE9A8; }
    .hm-level2 { background-color: #40C463; }
    .hm-level3 { background-color: #30A14E; }
    .hm-level4 { background-color: #216E39; }
    .hm-legend {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      margin-top: 12px;
    }
    .hm-legend-label { font-size: 10px; font-weight: 500; color: var(--ink-muted); }
    .hm-legend-cells { display: flex; gap: 3px; }
    .hm-legend-cell { width: 16px; height: 16px; border-radius: 2px; }
    .hm-detail {
      padding: 16px 20px;
      background: #F8F9FA;
      border: 1px solid var(--bg-grid-color);
      border-top: 3px solid var(--sketch-blue);
      border-radius: 8px;
    }
    .hm-detail-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--bg-grid-color);
    }
    .hm-detail-date { font-size: 14px; font-weight: 700; margin: 0; }
    .hm-detail-count { font-size: 11px; color: var(--ink-muted); margin-left: auto; }
    .hm-detail-close {
      width: 24px; height: 24px;
      display: flex; align-items: center; justify-content: center;
      background: transparent;
      border: 1px solid var(--bg-grid-color);
      border-radius: 4px;
      font-size: 14px;
      color: var(--ink-muted);
      cursor: pointer;
    }
    .hm-detail-close:hover { color: var(--ink-primary); border-color: var(--ink-primary); }
    .hm-detail-projects { display: flex; flex-direction: column; gap: 8px; }
    .hm-detail-project {
      padding: 8px 12px;
      background: var(--bg-paper);
      border-left: 3px solid var(--sketch-blue);
      border-radius: 0 8px 8px 0;
    }
    .hm-detail-project-header { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .hm-detail-project-name { font-size: 13px; font-weight: 700; color: var(--ink-primary); }
    .hm-detail-project-meta { font-size: 11px; color: var(--ink-muted); margin-left: auto; }
    .hm-detail-summaries {
      list-style: none;
      margin: 6px 0 0 0;
      padding: 6px 0 0 0;
      border-top: 1px solid var(--bg-grid-color);
    }
    .hm-detail-summaries li {
      font-size: 12px;
      color: var(--ink-secondary);
      line-height: 1.5;
      padding-left: 12px;
      position: relative;
      margin-bottom: 2px;
    }
    .hm-detail-summaries li::before {
      content: '\\00B7';
      position: absolute;
      left: 0;
      color: var(--ink-muted);
      font-weight: 700;
    }

    @media (max-width: 640px) {
      .heatmap-stats { flex-direction: column; }
      .hm-grid { grid-template-rows: repeat(7, 12px); grid-auto-columns: 12px; gap: 2px; }
      .hm-cell { width: 12px; height: 12px; }
      .hm-day-labels { gap: 2px; width: 24px; }
      .hm-day-label { font-size: 9px; }
      .hm-month-row { padding-left: 28px; }
      .hm-month-label { font-size: 9px; }
      .hm-legend-cell { width: 12px; height: 12px; }
      .hm-detail-project-header { flex-direction: column; gap: 2px; }
      .hm-detail-project-meta { margin-left: 0; }
    }
  </style>
</head>
<body>
  <nav class="nav-dots">${renderNavDotsHtml(navDots)}</nav>

  <div class="container">
    <header class="header">
      <h1>BetterPrompt Analysis</h1>
      <p class="subtitle">Generated ${new Date(run.analyzedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
    </header>

    <section class="identity" id="identity">
      ${renderIdentitySection(typeResult, "Run type classification before generating the final report.")}
    </section>

    ${renderMetricsBar(run.phase1Output.sessionMetrics)}

    <section class="scores-section" id="scores">
      <div class="radar-container">${radarSvg}</div>
      <div class="distribution-container">
        <h3 style="margin-bottom:12px;">Type Distribution</h3>
        ${distributionBar}
      </div>
    </section>

    ${activityHeatmapSection}
    ${personalitySummarySection}
    ${promptPatternsSection}
    ${projectSummariesSection}
    ${weeklyInsightsSection}
    ${knowledgeResourcesSection}
    ${domainSections}
    ${focusAreasSection}

    <footer class="footer">
      Generated by BetterPrompt Plugin v0.2.0 - local-first AI collaboration analysis
    </footer>
  </div>
  ${renderScrollSpyScript()}
</body>
</html>`;
}

// cli/commands/generate-report.ts
var DOMAIN_STAGE_NAMES = /* @__PURE__ */ new Set([
  "aiPartnership",
  "sessionCraft",
  "toolMastery",
  "skillResilience",
  "sessionMastery"
]);
function hasFallbackArtifact(runId, stage) {
  if (DOMAIN_STAGE_NAMES.has(stage)) return getDomainResult(runId, stage) !== null;
  return getStageOutput(runId, stage) !== null;
}
function getRequiredStageGateIssues(runId) {
  const statuses = getStageStatuses(runId);
  const statusLookup = new Map(statuses.map((s) => [s.stage, s]));
  const issues = [];
  for (const stage of REQUIRED_STAGE_NAMES) {
    const status = statusLookup.get(stage);
    if (status) {
      if (status.status !== "validated") {
        issues.push({
          stage,
          required: status.required,
          status: status.status,
          attemptCount: status.attemptCount,
          lastError: status.lastError,
          updatedAt: status.updatedAt
        });
      }
      continue;
    }
    if (!hasFallbackArtifact(runId, stage)) {
      issues.push({
        stage,
        required: true,
        status: "missing",
        attemptCount: 0,
        lastError: null,
        updatedAt: null
      });
    }
  }
  return issues;
}
async function execute(args) {
  const serve = args.serve === true;
  const port = typeof args.port === "number" ? args.port : 3456;
  const noOpen = args.noOpen === true;
  const allowIncomplete = args.allowIncomplete === true;
  const runId = getCurrentRunId();
  if (!runId) {
    return JSON.stringify({
      status: "error",
      message: "No analysis results found. Run extract-data and domain analyses first."
    });
  }
  const gateIssues = getRequiredStageGateIssues(runId);
  if (gateIssues.length > 0 && !allowIncomplete) {
    return JSON.stringify({
      status: "blocked",
      message: "Required analysis stages are incomplete. Re-run the missing stages or pass --allowIncomplete.",
      issues: gateIssues
    });
  }
  const run = assembleCanonicalRun(runId);
  if (!run) {
    return JSON.stringify({
      status: "error",
      message: "No analysis results found. Run extract-data and domain analyses first."
    });
  }
  const html = generateCanonicalReportHtml(run);
  const reportsDir = join(getPluginDataDir(), "reports");
  await mkdir(reportsDir, { recursive: true });
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportPath = join(reportsDir, `report-${timestamp}.html`);
  await writeFile(reportPath, html, "utf-8");
  const latestPath = join(reportsDir, "latest.html");
  await writeFile(latestPath, html, "utf-8");
  if (!serve) {
    markAnalysisComplete(run.phase1Output.sessionMetrics.totalSessions);
    if (!noOpen) {
      try {
        const cmd = process.platform === "darwin" ? `open "${reportPath}"` : process.platform === "win32" ? `start "${reportPath}"` : `xdg-open "${reportPath}"`;
        exec(cmd);
      } catch {
      }
    }
    return JSON.stringify({
      status: "ok",
      url: `file://${reportPath}`,
      reportPath,
      latestPath,
      domainCount: run.domainResults.length,
      type: run.typeResult ? `${run.typeResult.matrixEmoji} ${run.typeResult.matrixName}` : "Not classified",
      ...gateIssues.length > 0 ? { warning: "Report generated with incomplete stages." } : {},
      message: `Report saved to ${reportPath}. Opened in browser.`
    });
  }
  const url = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (req.url !== "/" && req.url !== "") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache"
      });
      res.end(readFileSync(latestPath, "utf-8"));
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") resolve(`file://${reportPath}`);
      else reject(err);
    });
    server.listen(port, () => {
      setTimeout(() => server.close(), 30 * 60 * 1e3).unref();
      server.unref();
      resolve(`http://localhost:${port}`);
    });
  });
  markAnalysisComplete(run.phase1Output.sessionMetrics.totalSessions);
  if (!noOpen && url.startsWith("http")) {
    try {
      const cmd = process.platform === "darwin" ? `open "${url}"` : process.platform === "win32" ? `start "${url}"` : `xdg-open "${url}"`;
      exec(cmd);
    } catch {
    }
  }
  return JSON.stringify({
    status: "ok",
    url,
    reportPath,
    latestPath,
    domainCount: run.domainResults.length,
    type: run.typeResult ? `${run.typeResult.matrixEmoji} ${run.typeResult.matrixName}` : "Not classified",
    ...gateIssues.length > 0 ? { warning: "Report generated with incomplete stages." } : {},
    message: `Report available at ${url}. Saved to ${reportPath}.`
  });
}
export {
  execute
};
//# sourceMappingURL=generate-report-WUBLVEZS.js.map