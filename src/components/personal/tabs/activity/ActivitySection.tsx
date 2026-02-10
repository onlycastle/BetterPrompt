import { useMemo, useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import type { AnalyzedSessionInfo, ActivitySessionInfo, ProjectSummary, WeeklyInsights } from '../../../../types/verbose';
import { WeeklyInsightsCard } from './WeeklyInsightsCard';
import styles from './ActivitySection.module.css';

interface SessionSummaryItem {
  sessionId: string;
  summary: string;
}

interface ActivitySectionProps {
  activitySessions?: ActivitySessionInfo[];
  analyzedSessions: AnalyzedSessionInfo[];
  sessionSummaries?: SessionSummaryItem[];
  projectSummaries?: ProjectSummary[];
  analysisDateRange?: { earliest: string; latest: string };
  weeklyInsights?: WeeklyInsights;
}

interface UnifiedSession {
  sessionId: string;
  projectName: string;
  startTime: string;
  durationMinutes: number;
  messageCount: number;
  summary?: string;
  totalTokens: number;  // input + output tokens
}

interface DayData {
  date: string; // YYYY-MM-DD
  count: number;
  totalTokens: number;  // sum of all sessions' tokens for this day
  sessions: UnifiedSession[];
  summaries: string[];
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  data: DayData | null;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(dateStr: string): string {
  return dateStr.slice(0, 10);
}

function getIntensityByCount(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return count;
  if (count <= 4) return 3;
  return 4;
}

function computeTokenIntensityFn(
  grid: DayData[]
): (tokens: number) => number {
  const nonZero = grid
    .map(d => d.totalTokens)
    .filter(t => t > 0)
    .sort((a, b) => a - b);

  if (nonZero.length === 0) {
    return () => 0;
  }

  const p25 = nonZero[Math.floor(nonZero.length * 0.25)];
  const p50 = nonZero[Math.floor(nonZero.length * 0.50)];
  const p75 = nonZero[Math.floor(nonZero.length * 0.75)];

  return (tokens: number) => {
    if (tokens === 0) return 0;
    if (tokens <= p25) return 1;
    if (tokens <= p50) return 2;
    if (tokens <= p75) return 3;
    return 4;
  };
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(1)}B`;
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const MAX_SHOWN_SUMMARIES = 3;

function renderProjectSummaries(
  projectName: string,
  sessionSummaries: string[],
  projectSummaryMap: Map<string, ProjectSummary>
): React.ReactNode {
  const projectSummary = projectSummaryMap.get(projectName);
  if (projectSummary && projectSummary.summaryLines.length > 0) {
    return (
      <ul className={styles.summaryList}>
        {projectSummary.summaryLines.map((line, i) => (
          <li key={i} className={styles.summaryItem}>{line}</li>
        ))}
      </ul>
    );
  }

  if (sessionSummaries.length === 0) {
    return null;
  }

  const shown = sessionSummaries.slice(0, MAX_SHOWN_SUMMARIES);
  const remaining = sessionSummaries.length - MAX_SHOWN_SUMMARIES;
  return (
    <ul className={styles.summaryList}>
      {shown.map((s, i) => (
        <li key={i} className={styles.summaryItem}>{s}</li>
      ))}
      {remaining > 0 && (
        <li className={styles.summaryItem} style={{ opacity: 0.6 }}>
          +{remaining} more session{remaining !== 1 ? 's' : ''}
        </li>
      )}
    </ul>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ActivitySection({
  activitySessions,
  analyzedSessions,
  sessionSummaries,
  projectSummaries,
  analysisDateRange,
  weeklyInsights,
}: ActivitySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const toggleExpanded = useCallback(() => setIsExpanded(prev => !prev), []);
  const handleHeaderKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpanded();
    }
  }, [toggleExpanded]);

  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const unifiedSessions = useMemo((): UnifiedSession[] => {
    if (activitySessions && activitySessions.length > 0) {
      return activitySessions.map(s => ({
        sessionId: s.sessionId,
        projectName: s.projectName,
        startTime: s.startTime,
        durationMinutes: s.durationMinutes,
        messageCount: s.messageCount,
        summary: s.summary || undefined,
        totalTokens: (s.totalInputTokens || 0) + (s.totalOutputTokens || 0),
      }));
    }

    const summaryMap = new Map<string, string>();
    if (sessionSummaries) {
      for (const s of sessionSummaries) {
        summaryMap.set(s.sessionId, s.summary);
      }
    }

    return analyzedSessions.map(s => ({
      sessionId: s.sessionId,
      projectName: s.projectName,
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
      messageCount: s.messageCount,
      summary: summaryMap.get(s.sessionId),
      totalTokens: 0,
    }));
  }, [activitySessions, analyzedSessions, sessionSummaries]);

  // Build project summary lookup map by project name
  const projectSummaryMap = useMemo(() => {
    const map = new Map<string, ProjectSummary>();
    if (projectSummaries) {
      for (const ps of projectSummaries) {
        map.set(ps.projectName, ps);
      }
    }
    return map;
  }, [projectSummaries]);

  // Build summary lookup map from unified sessions
  const summaryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of unifiedSessions) {
      if (s.summary) {
        map.set(s.sessionId, s.summary);
      }
    }
    return map;
  }, [unifiedSessions]);

  // Group sessions by date
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, UnifiedSession[]>();
    for (const session of unifiedSessions) {
      const dateKey = toDateKey(session.startTime);
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(session);
    }
    return map;
  }, [unifiedSessions]);

  // Build calendar grid data
  const { grid, monthLabels } = useMemo(() => {
    if (unifiedSessions.length === 0) {
      return { grid: [], monthLabels: [] as { text: string; column: number }[] };
    }

    // Determine date range
    let startDate: Date;
    let endDate: Date;

    if (analysisDateRange && !activitySessions) {
      // Use analysis date range only for legacy cached data
      startDate = new Date(analysisDateRange.earliest);
      endDate = new Date(analysisDateRange.latest);
    } else {
      // Compute date range from actual session data
      const dates = unifiedSessions.map(s => new Date(s.startTime)).sort((a, b) => a.getTime() - b.getTime());
      startDate = dates[0];
      endDate = dates[dates.length - 1];
    }

    // Pad to full weeks
    const weekStart = getWeekStart(startDate);
    const weekEnd = addDays(endDate, 6 - endDate.getDay());

    // Build grid: each cell is a day
    const days: DayData[] = [];
    const months: { text: string; column: number }[] = [];
    let currentDate = new Date(weekStart);
    let prevMonth = -1;
    let column = 0;

    while (currentDate <= weekEnd) {
      const dateKey = currentDate.toISOString().slice(0, 10);
      const sessions = sessionsByDate.get(dateKey) || [];
      const summaries = sessions
        .map(s => summaryMap.get(s.sessionId))
        .filter((s): s is string => !!s);

      const totalTokens = sessions.reduce((sum, s) => sum + s.totalTokens, 0);
      days.push({
        date: dateKey,
        count: sessions.length,
        totalTokens,
        sessions,
        summaries,
      });

      // Track month labels (at the start of each week)
      const dayOfWeek = currentDate.getDay();
      const month = currentDate.getMonth();
      if (dayOfWeek === 0 && month !== prevMonth) {
        months.push({ text: MONTH_NAMES[month], column });
        prevMonth = month;
      }
      if (dayOfWeek === 6) {
        column++;
      }

      currentDate = addDays(currentDate, 1);
    }

    return { grid: days, monthLabels: months };
  }, [unifiedSessions, activitySessions, analysisDateRange, sessionsByDate, summaryMap]);

  // Compute summary stats
  const stats = useMemo(() => {
    const totalSessions = unifiedSessions.length;

    // Date range string (compute from data)
    let dateRange = '';
    if (unifiedSessions.length > 0) {
      const dates = unifiedSessions.map(s => new Date(s.startTime)).sort((a, b) => a.getTime() - b.getTime());
      const start = dates[0];
      const end = dates[dates.length - 1];
      dateRange = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (analysisDateRange) {
      const start = new Date(analysisDateRange.earliest);
      const end = new Date(analysisDateRange.latest);
      dateRange = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    // Most active project
    const projectCounts = new Map<string, number>();
    for (const session of unifiedSessions) {
      const count = (projectCounts.get(session.projectName) || 0) + 1;
      projectCounts.set(session.projectName, count);
    }
    let mostActiveProject = '';
    let maxCount = 0;
    for (const [project, count] of projectCounts) {
      if (count > maxCount) {
        mostActiveProject = project;
        maxCount = count;
      }
    }

    // Active days
    const activeDays = sessionsByDate.size;

    const totalTokensAll = unifiedSessions.reduce((sum, s) => sum + s.totalTokens, 0);

    return { totalSessions, dateRange, mostActiveProject, activeDays, totalTokensAll };
  }, [unifiedSessions, analysisDateRange, sessionsByDate]);

  // Determine if token data is available (non-legacy)
  const hasTokenData = useMemo(
    () => unifiedSessions.some(s => s.totalTokens > 0),
    [unifiedSessions]
  );

  // Percentile-based token intensity function
  const getTokenIntensity = useMemo(
    () => computeTokenIntensityFn(grid),
    [grid]
  );

  // Tooltip handlers
  const handleCellHover = useCallback((e: React.MouseEvent<HTMLDivElement>, day: DayData) => {
    if (day.count === 0) {
      setTooltip(prev => ({ ...prev, visible: false }));
      return;
    }

    const container = graphContainerRef.current;
    if (!container) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    setTooltip({
      visible: true,
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8,
      data: day,
    });
  }, []);

  const handleCellLeave = useCallback(() => {
    setTooltip(prev => ({ ...prev, visible: false }));
  }, []);

  // Click handler: toggle detail panel
  const handleCellClick = useCallback((day: DayData) => {
    if (day.count === 0) return;
    setHasInteracted(true);
    setSelectedDay(prev => prev?.date === day.date ? null : day);
  }, []);

  // Group selected day's sessions by project
  const selectedDayProjects = useMemo(() => {
    if (!selectedDay) return [];
    const projectMap = new Map<string, { sessions: UnifiedSession[]; summaries: string[] }>();
    for (const session of selectedDay.sessions) {
      if (!projectMap.has(session.projectName)) {
        projectMap.set(session.projectName, { sessions: [], summaries: [] });
      }
      const group = projectMap.get(session.projectName)!;
      group.sessions.push(session);
      // Use embedded summary from unified session, or fall back to summaryMap
      const summary = session.summary || summaryMap.get(session.sessionId);
      if (summary) group.summaries.push(summary);
    }
    return [...projectMap.entries()]
      .sort((a, b) => b[1].sessions.length - a[1].sessions.length)
      .map(([name, data]) => ({
        projectName: name,
        sessionCount: data.sessions.length,
        totalMinutes: data.sessions.reduce((sum, s) => sum + s.durationMinutes, 0),
        totalTokens: data.sessions.reduce((sum, s) => sum + s.totalTokens, 0),
        summaries: data.summaries,
      }));
  }, [selectedDay, summaryMap]);

  // Total weeks for month label positioning
  const totalWeeks = Math.ceil(grid.length / 7);
  const gap = 3;
  const dayLabelsWidth = 36; // dayLabels (32px) + gap (~4px)

  // Dynamic cell size: fills available heatmap width, capped at 28px
  const heatmapColumnRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(18);

  useEffect(() => {
    const el = heatmapColumnRef.current;
    if (!el || totalWeeks === 0) return;

    const compute = () => {
      const width = el.clientWidth;
      const available = width - dayLabelsWidth;
      const size = Math.floor((available - (totalWeeks - 1) * gap) / totalWeeks);
      setCellSize(Math.min(28, Math.max(14, size)));
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(el);
    return () => observer.disconnect();
  }, [totalWeeks]);

  return (
    <div className={styles.activitySection}>
      {/* Dark Terminal Header — Accordion */}
      <div
        className={styles.domainHeader}
        onClick={toggleExpanded}
        onKeyDown={handleHeaderKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
      >
        <div className={styles.domainTitleRow}>
          <span className={styles.domainIcon}>{'📊'}</span>
          <div className={styles.domainTitleGroup}>
            <h3 className={styles.domainTitle}>Monthly Vibe</h3>
            <p className={styles.domainSubtitle}>
              {stats.totalSessions} sessions {'·'} {stats.activeDays} active days
            </p>
          </div>
        </div>
        <span className={styles.expandPill} aria-hidden="true">
          {isExpanded ? '\u25B4 Hide' : '\u25BE View'}
        </span>
      </div>

      <div className={styles.contentWrapper} data-expanded={isExpanded || undefined}>
      <div className={styles.contentInner}>

      {/* Summary Stats */}
      <div className={styles.statsRow}>
        <div className={`${styles.statItem} ${styles.statSessions}`}>
          <span className={styles.statValue}>{stats.totalSessions}</span>
          <span className={styles.statLabel}>Sessions</span>
        </div>
        <div className={`${styles.statItem} ${styles.statDays}`}>
          <span className={styles.statValue}>{stats.activeDays}</span>
          <span className={styles.statLabel}>Active Days</span>
        </div>
        {stats.totalTokensAll > 0 && (
          <div className={`${styles.statItem} ${styles.statTokens}`}>
            <span className={styles.statValue}>{formatTokenCount(stats.totalTokensAll)}</span>
            <span className={styles.statLabel}>Total Tokens</span>
          </div>
        )}
        {stats.mostActiveProject && (
          <div className={`${styles.statItem} ${styles.statProject}`}>
            <span className={styles.statValue}>{stats.mostActiveProject}</span>
            <span className={styles.statLabel}>Top Project</span>
          </div>
        )}
      </div>

      {/* Contribution Graph */}
      {grid.length > 0 && (
        <div ref={graphContainerRef} className={styles.graphContainer}>
          <div className={styles.mainLayout}>
            {/* Left: Heatmap Column */}
            <div
              ref={heatmapColumnRef}
              className={styles.heatmapColumn}
              style={{ '--cell-size': `${cellSize}px` } as React.CSSProperties}
            >
              {/* Month Labels */}
              <div className={styles.monthLabels}>
                {monthLabels.map((m, i) => (
                  <span
                    key={`${m.text}-${i}`}
                    className={styles.monthLabel}
                    style={{ left: `${36 + m.column * (cellSize + gap)}px` }}
                  >
                    {m.text}
                  </span>
                ))}
              </div>

              {/* Graph: Day Labels + Grid */}
              <div className={styles.graphWrapper}>
                {/* Day Labels (Sun-Sat, only show Mon/Wed/Fri) */}
                <div className={styles.dayLabels}>
                  {DAY_LABELS.map((label, i) => (
                    <span
                      key={label}
                      className={`${styles.dayLabel} ${i % 2 === 0 ? styles.dayLabelHidden : ''}`}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                {/* Grid */}
                <div
                  className={styles.graphGrid}
                  style={{ gridTemplateColumns: `repeat(${totalWeeks}, ${cellSize}px)` }}
                >
                  {grid.map((day) => {
                    const intensity = hasTokenData
                      ? getTokenIntensity(day.totalTokens)
                      : getIntensityByCount(day.count);
                    const levelClass = styles[`level${intensity}` as keyof typeof styles];
                    const isSelected = selectedDay?.date === day.date;
                    return (
                      <div
                        key={day.date}
                        className={`${styles.cell} ${levelClass} ${isSelected ? styles.cellSelected : ''}`}
                        onMouseEnter={(e) => handleCellHover(e, day)}
                        onMouseLeave={handleCellLeave}
                        onClick={() => handleCellClick(day)}
                        tabIndex={day.count > 0 ? 0 : -1}
                        role="gridcell"
                        aria-label={`${formatDate(day.date)}: ${
                          day.totalTokens > 0
                            ? `${formatTokenCount(day.totalTokens)} tokens across ${day.count} session${day.count !== 1 ? 's' : ''}`
                            : `${day.count} session${day.count !== 1 ? 's' : ''}`
                        }`}
                        aria-expanded={isSelected}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className={styles.legend}>
                <span className={styles.legendLabel}>Less</span>
                <div className={styles.legendCells}>
                  {[0, 1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`${styles.legendCell} ${styles[`level${level}` as keyof typeof styles]}`}
                    />
                  ))}
                </div>
                <span className={styles.legendLabel}>More</span>
              </div>
            </div>

            {/* Right: Side Panel Column */}
            <div className={styles.sidePanelColumn}>
              {/* CTA: before any interaction */}
              {!selectedDay && !hasInteracted && (
                <div className={styles.ctaBox}>
                  <div className={styles.ctaTextRow}>
                    <span className={styles.ctaArrow}>&larr;</span>
                    <span className={styles.ctaText}>Click a day to see session details</span>
                  </div>
                  <span className={styles.ctaHint}>Color intensity = token volume</span>
                </div>
              )}

              {/* Dimmed CTA: after closing a detail panel */}
              {!selectedDay && hasInteracted && (
                <div className={`${styles.ctaBox} ${styles.ctaDimmed}`}>
                  <div className={styles.ctaTextRow}>
                    <span className={styles.ctaArrow}>&larr;</span>
                    <span className={styles.ctaText}>Select another day</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Detail Panel (full-width, below heatmap grid) */}
          {selectedDay && selectedDayProjects.length > 0 && (
            <div className={styles.detailPanel}>
              <div className={styles.panelHeader}>
                <h4 className={styles.panelDate}>{formatDate(selectedDay.date)}</h4>
                <span className={styles.panelCount}>
                  {selectedDay.count} session{selectedDay.count !== 1 ? 's' : ''}
                </span>
                <button
                  className={styles.panelClose}
                  onClick={() => setSelectedDay(null)}
                  type="button"
                  aria-label="Close detail panel"
                >
                  &times;
                </button>
              </div>

              <div className={styles.projectList}>
                {selectedDayProjects.map((project) => (
                  <div key={project.projectName} className={styles.projectGroup}>
                    <div className={styles.projectHeader}>
                      <span className={styles.projectName}>{project.projectName}</span>
                      <span className={styles.projectMeta}>
                        {project.sessionCount} session{project.sessionCount !== 1 ? 's' : ''}
                        {project.totalTokens > 0 && (
                          <> &middot; {formatTokenCount(project.totalTokens)} tokens</>
                        )}
                        {project.totalMinutes > 0 && (
                          <> &middot; {project.totalMinutes < 60
                            ? `${project.totalMinutes}m`
                            : `${Math.floor(project.totalMinutes / 60)}h ${project.totalMinutes % 60}m`
                          }</>
                        )}
                      </span>
                    </div>
                    {renderProjectSummaries(project.projectName, project.summaries, projectSummaryMap)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tooltip */}
          {tooltip.visible && tooltip.data && (
            <div
              className={styles.tooltip}
              style={{
                left: `${tooltip.x}px`,
                top: `${tooltip.y}px`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <div className={styles.tooltipDate}>
                {formatDate(tooltip.data.date)}
              </div>
              <div className={styles.tooltipProject}>
                {tooltip.data.count} session{tooltip.data.count !== 1 ? 's' : ''}
                {tooltip.data.totalTokens > 0 && ` · ${formatTokenCount(tooltip.data.totalTokens)} tokens`}
                {' - '}{[...new Set(tooltip.data.sessions.map(s => s.projectName))].join(', ')}
              </div>
              {tooltip.data.summaries.length > 0 && (
                <div className={styles.tooltipSummary}>
                  {tooltip.data.summaries.slice(0, 3).map((s, i) => (
                    <div key={i}>{s}</div>
                  ))}
                  {tooltip.data.summaries.length > 3 && (
                    <div>+{tooltip.data.summaries.length - 3} more</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {grid.length === 0 && (
        <div className={styles.graphContainer}>
          <p className={styles.sectionDescription}>
            No session activity data available.
          </p>
        </div>
      )}

      {/* Weekly Insights Dashboard */}
      <WeeklyInsightsCard weeklyInsights={weeklyInsights} />

      </div>
      </div>
    </div>
  );
}
