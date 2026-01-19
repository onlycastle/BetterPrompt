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

  // Scan sessions on mount
  useEffect(() => {
    scanSessions();
  }, [scanSessions]);

  const handleStartAnalysis = async () => {
    if (!user) return;

    // Pass access token for server-side authentication
    const resultId = await startAnalysis(user.id, session?.access_token);
    if (resultId) {
      onAnalysisComplete(resultId);
    }
  };

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

          {isScanning ? (
            <div className={styles.loading}>
              <div className={styles.loadingContent}>
                <span className={styles.scannerIcon}>🔍</span>
                <p className={styles.loadingText}>Reading your history...</p>
                <p className={styles.loadingSubtext}>
                  Selecting the sessions that tell your story
                </p>
              </div>
            </div>
          ) : !scanSummary || scanSummary.sessionCount === 0 ? (
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
          ) : (
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
                <div className={styles.dimensionRow}>
                  <span className={styles.dimensionName}>AI Control</span>
                  <div className={styles.dimensionTrack}>
                    <div className={styles.dimensionFill} style={{ width: '75%' }} />
                  </div>
                  <span className={styles.dimensionValue}>???</span>
                </div>
                <div className={styles.dimensionRow}>
                  <span className={styles.dimensionName}>Context Quality</span>
                  <div className={styles.dimensionTrack}>
                    <div className={styles.dimensionFill} style={{ width: '60%' }} />
                  </div>
                  <span className={styles.dimensionValue}>???</span>
                </div>
                <div className={styles.dimensionRow}>
                  <span className={styles.dimensionName}>Planning</span>
                  <div className={styles.dimensionTrack}>
                    <div className={styles.dimensionFill} style={{ width: '85%' }} />
                  </div>
                  <span className={styles.dimensionValue}>???</span>
                </div>
                {/* Faded hint rows */}
                <div className={styles.dimensionFade}>
                  <div className={styles.dimensionRow}>
                    <span className={styles.dimensionName}>Tool Mastery</span>
                    <div className={styles.dimensionTrack}>
                      <div className={styles.dimensionFill} style={{ width: '45%' }} />
                    </div>
                    <span className={styles.dimensionValue}>???</span>
                  </div>
                  <div className={styles.dimensionRow}>
                    <span className={styles.dimensionName}>+ 2 more</span>
                    <div className={styles.dimensionTrack}>
                      <div className={styles.dimensionFill} style={{ width: '70%' }} />
                    </div>
                    <span className={styles.dimensionValue}>???</span>
                  </div>
                </div>
              </div>

              {/* Subtext */}
              <p className={styles.previewSubtext}>
                Based on your real chat history
              </p>

              <button
                className={styles.rescanLink}
                onClick={scanSessions}
                disabled={isScanning}
              >
                Rescan
              </button>
            </div>
          )}
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
