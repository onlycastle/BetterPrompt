/**
 * Analyze Page
 *
 * Main screen after login - shows session list and starts analysis.
 */

import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAnalysis } from '../contexts/AnalysisContext';
import styles from './AnalyzePage.module.css';

interface AnalyzePageProps {
  onAnalysisComplete: (resultId: string) => void;
}

export default function AnalyzePage({ onAnalysisComplete }: AnalyzePageProps) {
  const { user, signOut } = useAuth();
  const {
    sessions,
    selectedSessions,
    isScanning,
    scanError,
    isAnalyzing,
    analysisProgress,
    analysisError,
    scanSessions,
    selectSession,
    deselectSession,
    selectAllSessions,
    clearSelection,
    startAnalysis,
  } = useAnalysis();

  // Scan sessions on mount
  useEffect(() => {
    scanSessions();
  }, [scanSessions]);

  const handleStartAnalysis = async () => {
    if (!user) return;

    const resultId = await startAnalysis(user.id);
    if (resultId) {
      onAnalysisComplete(resultId);
    }
  };

  const toggleSession = (id: string) => {
    if (selectedSessions.includes(id)) {
      deselectSession(id);
    } else {
      selectSession(id);
    }
  };

  return (
    <div className={styles.container}>
      {/* Drag region for macOS titlebar */}
      <div className={styles.dragRegion} />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span>🎯</span>
          <span className={styles.logoText}>NoMoreAISlop</span>
        </div>
        <div className={styles.userInfo}>
          <span className={styles.email}>{user?.email}</span>
          <button className={styles.signOutBtn} onClick={signOut}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className={styles.main}>
        <h1 className={styles.title}>Analyze Your Sessions</h1>
        <p className={styles.subtitle}>
          Select the Claude Code sessions you want to analyze
        </p>

        {/* Privacy notice */}
        <div className={styles.privacyNotice}>
          🔒 Your data is analyzed in the cloud but <strong>not stored</strong> on our servers
        </div>

        {/* Session list */}
        <div className={styles.sessionSection}>
          <div className={styles.sessionHeader}>
            <h2>Available Sessions</h2>
            <div className={styles.sessionActions}>
              <button onClick={selectAllSessions} disabled={isScanning}>
                Select All
              </button>
              <button onClick={clearSelection} disabled={isScanning}>
                Clear
              </button>
              <button onClick={scanSessions} disabled={isScanning}>
                {isScanning ? 'Scanning...' : 'Refresh'}
              </button>
            </div>
          </div>

          {scanError && <p className={styles.error}>{scanError}</p>}

          {isScanning ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>Scanning for sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className={styles.empty}>
              <p>No Claude Code sessions found.</p>
              <p className={styles.hint}>
                Sessions are stored in ~/.claude/projects/
              </p>
            </div>
          ) : (
            <ul className={styles.sessionList}>
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className={`${styles.sessionItem} ${
                    selectedSessions.includes(session.id) ? styles.selected : ''
                  }`}
                  onClick={() => toggleSession(session.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedSessions.includes(session.id)}
                    onChange={() => toggleSession(session.id)}
                    className={styles.checkbox}
                  />
                  <div className={styles.sessionInfo}>
                    <span className={styles.sessionName}>{session.name}</span>
                    <span className={styles.sessionMeta}>
                      {session.date} · {session.messageCount} messages · {session.durationMinutes} min
                    </span>
                  </div>
                </li>
              ))}
            </ul>
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
              disabled={selectedSessions.length === 0}
            >
              Analyze {selectedSessions.length} Session
              {selectedSessions.length !== 1 ? 's' : ''}
            </button>
          )}

          {analysisError && <p className={styles.error}>{analysisError}</p>}
        </div>
      </main>
    </div>
  );
}
