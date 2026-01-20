/**
 * Analyze Page
 *
 * Main screen after login - shows session summary and starts analysis.
 * Sessions are auto-selected based on recency, token count, and project diversity.
 */

import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAnalysis } from '../contexts/AnalysisContext';
import styles from './AnalyzePage.module.css';

/**
 * Reusable dimension bar for the preview card
 */
function DimensionBar({ name, percent }: { name: string; percent: number }) {
  return (
    <div className={styles.dimensionRow}>
      <span className={styles.dimensionName}>{name}</span>
      <div className={styles.dimensionTrack}>
        <div className={styles.dimensionFill} style={{ width: `${percent}%` }} />
      </div>
      <span className={styles.dimensionValue}>???</span>
    </div>
  );
}

interface AnalyzePageProps {
  onAnalysisComplete: (resultId: string) => void;
}

export default function AnalyzePage({ onAnalysisComplete }: AnalyzePageProps) {
  const { user, session } = useAuth();
  const {
    scanSummary,
    isScanning,
    scanError,
    isAnalyzing,
    analysisProgress,
    analysisError,
    scanSessions,
    startAnalysis,
  } = useAnalysis();

  // Scan sessions on mount (only if not already scanned)
  useEffect(() => {
    if (!scanSummary && !isScanning) {
      scanSessions();
    }
  }, [scanSummary, isScanning, scanSessions]);

  const handleStartAnalysis = async () => {
    if (!user) return;

    // Pass access token for server-side authentication
    const resultId = await startAnalysis(user.id, session?.access_token);
    if (resultId) {
      onAnalysisComplete(resultId);
    }
  };

  const hasSessions = scanSummary && scanSummary.sessionCount > 0;

  function renderSessionContent() {
    if (isScanning) {
      return (
        <div className={styles.loading}>
          <div className={styles.loadingContent}>
            <span className={styles.scannerIcon}>🔍</span>
            <p className={styles.loadingText}>Reading your history...</p>
            <p className={styles.loadingSubtext}>
              Selecting the sessions that tell your story
            </p>
          </div>
        </div>
      );
    }

    if (!hasSessions) {
      return (
        <div className={styles.empty}>
          <div className={styles.emptyContent}>
            <span className={styles.emptyIcon}>📝</span>
            <p className={styles.emptyTitle}>Nothing to analyze yet</p>
            <p className={styles.emptyDescription}>
              Use Claude Code first — we&apos;ll be here when you&apos;re ready
            </p>
            <code className={styles.hint}>~/.claude/projects/</code>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.previewCard}>
        {/* Radar chart preview */}
        <div className={styles.radarPreview}>
          <svg viewBox="0 0 200 200" className={styles.radarChart}>
            {/* Background hexagon grid */}
            <polygon
              className={styles.radarGrid}
              points="100,20 166,50 166,130 100,160 34,130 34,50"
            />
            <polygon
              className={styles.radarGrid}
              points="100,40 146,60 146,120 100,140 54,120 54,60"
            />
            <polygon
              className={styles.radarGrid}
              points="100,60 126,70 126,110 100,120 74,110 74,70"
            />
            {/* Data shape (mystery) */}
            <polygon
              className={styles.radarShape}
              points="100,35 150,55 160,115 100,145 50,100 45,55"
            />
            {/* Center dot */}
            <circle cx="100" cy="90" r="3" className={styles.radarCenter} />
          </svg>
          <div className={styles.radarBlur} />
        </div>

        {/* Type hint */}
        <div className={styles.typeHint}>
          <p className={styles.typeLabel}>You might be a...</p>
          <p className={styles.typeName}>
            <span className={styles.typeBlurred}>The Architect</span>
          </p>
        </div>

        {/* Dimension bars */}
        <div className={styles.dimensionBars}>
          <DimensionBar name="AI Control" percent={75} />
          <DimensionBar name="Context Quality" percent={60} />
          <DimensionBar name="Planning" percent={85} />
          {/* Faded hint rows */}
          <div className={styles.dimensionFade}>
            <DimensionBar name="Tool Mastery" percent={45} />
            <DimensionBar name="+ 2 more" percent={70} />
          </div>
        </div>

        {/* Subtext */}
        <p className={styles.previewSubtext}>Based on your real chat history</p>

        <button
          className={styles.rescanLink}
          onClick={scanSessions}
          disabled={isScanning}
        >
          Rescan
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Main content */}
      <main className={styles.main}>
        <h1 className={styles.title}>Know your AI mastery in 5 minutes</h1>
        <p className={styles.subtitle}>
          Based on your real conversations, not a quiz
        </p>

        {/* Privacy notice */}
        <div className={styles.privacyNotice}>
          Analyzed in the cloud, <strong>never stored</strong> — your sessions stay yours
        </div>

        {/* Session summary */}
        <div className={styles.sessionSection}>
          {scanError && <p className={styles.error}>{scanError}</p>}
          {renderSessionContent()}
        </div>

        {/* Analysis button */}
        <div className={styles.analyzeSection}>
          {isAnalyzing ? (
            <div className={styles.progress}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${analysisProgress?.percent || 0}%` }}
                />
              </div>
              <p className={styles.progressText}>
                {analysisProgress?.message || 'Analyzing...'}
              </p>
            </div>
          ) : (
            <button
              className={styles.analyzeButton}
              onClick={handleStartAnalysis}
              disabled={!scanSummary || scanSummary.sessionCount === 0}
            >
              Get My Report
            </button>
          )}

          {analysisError && <p className={styles.error}>{analysisError}</p>}
        </div>
      </main>
    </div>
  );
}
