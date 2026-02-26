/**
 * Quick Fix Page
 *
 * Primary action page for the "Solve Issue" path.
 * Users select a project, then get top 3 bottlenecks with suggested prompts.
 *
 * States: project-select → loading → results
 */

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types (mirrored from main process)
// ============================================================================

interface QuickFixProject {
  projectName: string;
  projectPath: string;
  dirPath: string;
  sessionCount: number;
}

interface Bottleneck {
  title: string;
  category: string;
  severity: string;
  issue: string;
  suggestedPrompt: string;
  explanation: string;
  evidence: Array<{ utteranceId: string; quote: string; context?: string }>;
  estimatedTimeSaved: string;
  suggestedPromptPreview?: string;
  explanationPreview?: string;
}

interface QuickFixResult {
  resultId: string;
  projectName: string;
  projectPath: string;
  sessionsAnalyzed: number;
  analyzedAt: string;
  overallHealthScore: number;
  summary: string;
  bottlenecks: Bottleneck[];
  isFreeGated: boolean;
}

type PageState = 'select' | 'loading' | 'results' | 'error';

// ============================================================================
// Severity Config
// ============================================================================

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#DC2626', bg: '#FEF2F2' },
  high: { label: 'High', color: '#EA580C', bg: '#FFF7ED' },
  medium: { label: 'Medium', color: '#CA8A04', bg: '#FEFCE8' },
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: string }> = {
  thinking: { label: 'Planning', icon: '🧠' },
  communication: { label: 'Communication', icon: '💬' },
  learning: { label: 'Learning', icon: '📈' },
  efficiency: { label: 'Efficiency', icon: '⚡' },
  outcome: { label: 'Outcomes', icon: '🎯' },
};

// ============================================================================
// Component
// ============================================================================

export default function QuickFixPage() {
  const [state, setState] = useState<PageState>('select');
  const [projects, setProjects] = useState<QuickFixProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<QuickFixProject | null>(null);
  const [result, setResult] = useState<QuickFixResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ stage: '', percent: 0, message: '' });
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Listen for progress updates
  useEffect(() => {
    const unsub = window.electronAPI.onQuickFixProgress((p) => {
      setProgress(p);
    });
    return unsub;
  }, []);

  const loadProjects = async () => {
    const { projects: projs, error: err } = await window.electronAPI.quickFixListProjects();
    if (err) {
      setError(err);
      setState('error');
    } else {
      setProjects(projs);
    }
  };

  const runAnalysis = useCallback(async (project: QuickFixProject) => {
    setSelectedProject(project);
    setState('loading');
    setProgress({ stage: 'starting', percent: 0, message: 'Starting analysis...' });

    try {
      // TODO: Get API key from settings/env
      const apiKey = ''; // Will be configured in settings

      const { result: res, error: err } = await window.electronAPI.quickFixAnalyze({
        projectDirPath: project.dirPath,
        projectName: project.projectName,
        projectPath: project.projectPath,
        apiKey,
        isPaid: false, // TODO: Check actual tier
      });

      if (err || !res) {
        throw new Error(err || 'Analysis failed');
      }

      setResult(res as QuickFixResult);
      setState('results');
    } catch (e) {
      setError((e as Error).message);
      setState('error');
    }
  }, []);

  const handleCopyPrompt = (prompt: string, index: number) => {
    navigator.clipboard.writeText(prompt);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleReset = () => {
    setState('select');
    setResult(null);
    setError(null);
    setSelectedProject(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (state === 'error') {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <h2 style={styles.errorTitle}>Analysis Error</h2>
          <p style={styles.errorMessage}>{error}</p>
          <button style={styles.primaryButton} onClick={handleReset}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div style={styles.container}>
        <div style={styles.loadingCard}>
          <div style={styles.loadingIcon}>🔍</div>
          <h2 style={styles.loadingTitle}>Analyzing {selectedProject?.projectName}...</h2>
          <div style={styles.progressBar}>
            <div
              style={{ ...styles.progressFill, width: `${progress.percent}%` }}
            />
          </div>
          <p style={styles.progressMessage}>{progress.message}</p>
        </div>
      </div>
    );
  }

  if (state === 'results' && result) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backButton} onClick={handleReset}>
            ← Back
          </button>
          <div>
            <h1 style={styles.title}>Quick Fix: {result.projectName}</h1>
            <p style={styles.subtitle}>
              {result.sessionsAnalyzed} sessions analyzed ·{' '}
              Health Score: <strong>{result.overallHealthScore}/100</strong>
            </p>
          </div>
        </div>

        <p style={styles.summary}>{result.summary}</p>

        <div style={styles.bottleneckList}>
          {result.bottlenecks.map((bottleneck, index) => {
            const isLocked = !bottleneck.suggestedPrompt && bottleneck.suggestedPromptPreview;
            const severity = SEVERITY_CONFIG[bottleneck.severity] || SEVERITY_CONFIG.medium;
            const category = CATEGORY_CONFIG[bottleneck.category] || CATEGORY_CONFIG.communication;

            return (
              <div
                key={index}
                style={{
                  ...styles.bottleneckCard,
                  borderLeftColor: severity.color,
                }}
              >
                {/* Header */}
                <div style={styles.cardHeader}>
                  <div style={styles.cardHeaderLeft}>
                    <span style={styles.cardIndex}>#{index + 1}</span>
                    <h3 style={styles.cardTitle}>{bottleneck.title}</h3>
                  </div>
                  <div style={styles.cardBadges}>
                    <span style={{ ...styles.severityBadge, color: severity.color, backgroundColor: severity.bg }}>
                      {severity.label}
                    </span>
                    <span style={styles.categoryBadge}>
                      {category.icon} {category.label}
                    </span>
                    <span style={styles.timeSaved}>
                      ~{bottleneck.estimatedTimeSaved} time saved
                    </span>
                  </div>
                </div>

                {/* Issue (diagnosis - always visible) */}
                <div style={styles.issueSection}>
                  <h4 style={styles.sectionLabel}>The Problem</h4>
                  <p style={styles.issueText}>{bottleneck.issue}</p>
                </div>

                {/* Evidence */}
                {bottleneck.evidence.length > 0 && (
                  <div style={styles.evidenceSection}>
                    <h4 style={styles.sectionLabel}>From Your Sessions</h4>
                    {bottleneck.evidence.map((e, ei) => (
                      <div key={ei} style={styles.evidenceQuote}>
                        <span style={styles.quoteIcon}>›</span>
                        <span style={styles.quoteText}>{e.quote}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggested Prompt (prescription - may be locked) */}
                <div style={styles.promptSection}>
                  <h4 style={styles.sectionLabel}>Better Prompt</h4>
                  {isLocked ? (
                    <div style={styles.lockedSection}>
                      <p style={styles.lockedPreview}>
                        {bottleneck.suggestedPromptPreview}...
                      </p>
                      <div style={styles.lockOverlay}>
                        <span style={styles.lockIcon}>🔒</span>
                        <span>Unlock to see full prompt</span>
                      </div>
                    </div>
                  ) : (
                    <div style={styles.promptBox}>
                      <pre style={styles.promptText}>{bottleneck.suggestedPrompt}</pre>
                      <button
                        style={styles.copyButton}
                        onClick={() => handleCopyPrompt(bottleneck.suggestedPrompt, index)}
                      >
                        {copiedIndex === index ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Explanation */}
                {bottleneck.explanation ? (
                  <div style={styles.explanationSection}>
                    <h4 style={styles.sectionLabel}>Why This Works</h4>
                    <p style={styles.explanationText}>{bottleneck.explanation}</p>
                  </div>
                ) : bottleneck.explanationPreview ? (
                  <div style={styles.lockedSection}>
                    <p style={styles.lockedPreview}>{bottleneck.explanationPreview}...</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Upgrade CTA for free tier */}
        {result.isFreeGated && (
          <div style={styles.upgradeBanner}>
            <p style={styles.upgradeText}>
              🔓 You have <strong>{result.bottlenecks.length - 1} more bottleneck{result.bottlenecks.length > 2 ? 's' : ''}</strong> with
              better prompts waiting. Upgrade to unlock all insights.
            </p>
            <button style={styles.upgradeButton}>Unlock All</button>
          </div>
        )}
      </div>
    );
  }

  // ── Project Selection (default state) ───────────────────────────────────

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Solve Issue</h1>
          <p style={styles.subtitle}>
            Select a project to find your top bottlenecks and get better prompts
          </p>
        </div>
      </div>

      {projects.length === 0 ? (
        <div style={styles.emptyState}>
          <p>No projects found in ~/.claude/projects/</p>
          <p style={styles.emptyHint}>
            Start using Claude Code in a project to see it here.
          </p>
        </div>
      ) : (
        <div style={styles.projectGrid}>
          {projects.map((project) => (
            <button
              key={project.dirPath}
              style={styles.projectCard}
              onClick={() => runAnalysis(project)}
            >
              <div style={styles.projectName}>{project.projectName}</div>
              <div style={styles.projectMeta}>
                {project.sessionCount} session{project.sessionCount !== 1 ? 's' : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Inline Styles (matching Notebook Sketch design system)
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '32px',
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: "'Fira Code', monospace",
    height: '100%',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#1A1A2E',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#6B7280',
  },
  summary: {
    fontSize: '14px',
    lineHeight: 1.6,
    color: '#374151',
    padding: '16px',
    background: '#F9FAFB',
    borderRadius: '8px',
    marginBottom: '24px',
    borderLeft: '3px solid #6366F1',
  },

  // Project selection
  projectGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '12px',
  },
  projectCard: {
    padding: '20px',
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'all 0.15s',
    fontFamily: "'Fira Code', monospace",
  },
  projectName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1A1A2E',
    marginBottom: '8px',
  },
  projectMeta: {
    fontSize: '12px',
    color: '#9CA3AF',
  },

  // Loading
  loadingCard: {
    textAlign: 'center' as const,
    padding: '64px 32px',
  },
  loadingIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  loadingTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '24px',
    color: '#1A1A2E',
  },
  progressBar: {
    width: '300px',
    height: '6px',
    background: '#E5E7EB',
    borderRadius: '3px',
    margin: '0 auto 12px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#6366F1',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  progressMessage: {
    fontSize: '13px',
    color: '#6B7280',
  },

  // Bottleneck cards
  bottleneckList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  bottleneckCard: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderLeft: '4px solid #6366F1',
    borderRadius: '8px',
    padding: '24px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
    flexWrap: 'wrap' as const,
    gap: '8px',
  },
  cardHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  cardIndex: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#6366F1',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1A1A2E',
  },
  cardBadges: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  severityBadge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '4px',
  },
  categoryBadge: {
    fontSize: '11px',
    color: '#6B7280',
    padding: '2px 8px',
    background: '#F3F4F6',
    borderRadius: '4px',
  },
  timeSaved: {
    fontSize: '11px',
    color: '#059669',
    fontWeight: 500,
  },

  // Sections
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#9CA3AF',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '8px',
  },
  issueSection: {
    marginBottom: '16px',
  },
  issueText: {
    fontSize: '13px',
    lineHeight: 1.6,
    color: '#374151',
  },
  evidenceSection: {
    marginBottom: '16px',
  },
  evidenceQuote: {
    display: 'flex',
    gap: '8px',
    padding: '8px 12px',
    background: '#F9FAFB',
    borderRadius: '4px',
    marginBottom: '4px',
  },
  quoteIcon: {
    color: '#6366F1',
    fontWeight: 700,
  },
  quoteText: {
    fontSize: '12px',
    color: '#4B5563',
    fontStyle: 'italic' as const,
  },

  // Prompt
  promptSection: {
    marginBottom: '16px',
  },
  promptBox: {
    position: 'relative' as const,
    background: '#1A1A2E',
    borderRadius: '8px',
    padding: '16px',
    paddingRight: '80px',
  },
  promptText: {
    fontSize: '13px',
    color: '#E5E7EB',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap' as const,
    fontFamily: "'Fira Code', monospace",
    margin: 0,
  },
  copyButton: {
    position: 'absolute' as const,
    top: '12px',
    right: '12px',
    padding: '4px 12px',
    background: '#6366F1',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Fira Code', monospace",
  },

  // Explanation
  explanationSection: {
    marginBottom: '0',
  },
  explanationText: {
    fontSize: '13px',
    lineHeight: 1.6,
    color: '#6B7280',
  },

  // Locked content
  lockedSection: {
    position: 'relative' as const,
    padding: '16px',
    background: '#F9FAFB',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  lockedPreview: {
    fontSize: '13px',
    color: '#9CA3AF',
    filter: 'blur(2px)',
    userSelect: 'none' as const,
  },
  lockOverlay: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#6366F1',
    background: 'rgba(249, 250, 251, 0.7)',
  },
  lockIcon: {
    fontSize: '16px',
  },

  // Upgrade banner
  upgradeBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
    borderRadius: '8px',
    marginTop: '24px',
  },
  upgradeText: {
    fontSize: '13px',
    color: '#374151',
  },
  upgradeButton: {
    padding: '8px 20px',
    background: '#6366F1',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Fira Code', monospace",
    whiteSpace: 'nowrap' as const,
  },

  // Error
  errorCard: {
    textAlign: 'center' as const,
    padding: '64px 32px',
  },
  errorTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#DC2626',
    marginBottom: '12px',
  },
  errorMessage: {
    fontSize: '13px',
    color: '#6B7280',
    marginBottom: '24px',
  },
  primaryButton: {
    padding: '10px 24px',
    background: '#6366F1',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Fira Code', monospace",
  },

  // Empty state
  emptyState: {
    textAlign: 'center' as const,
    padding: '64px 32px',
    color: '#6B7280',
  },
  emptyHint: {
    fontSize: '12px',
    color: '#9CA3AF',
    marginTop: '8px',
  },

  // Back button
  backButton: {
    padding: '6px 12px',
    background: 'none',
    border: '1px solid #E5E7EB',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#6B7280',
    cursor: 'pointer',
    fontFamily: "'Fira Code', monospace",
    marginTop: '4px',
  },
};
