/**
 * Analysis Context
 *
 * Manages analysis state including session scanning, analysis progress, and results.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface Session {
  id: string;
  name: string;
  path: string;
  date: string;
  messageCount: number;
  durationMinutes: number;
}

interface AnalysisProgress {
  stage: string;
  percent: number;
  message: string;
}

interface AnalysisContextType {
  // Session state
  sessions: Session[];
  selectedSessions: string[];
  isScanning: boolean;
  scanError: string | null;

  // Analysis state
  isAnalyzing: boolean;
  analysisProgress: AnalysisProgress | null;
  analysisError: string | null;

  // Actions
  scanSessions: () => Promise<void>;
  selectSession: (id: string) => void;
  deselectSession: (id: string) => void;
  selectAllSessions: () => void;
  clearSelection: () => void;
  startAnalysis: (userId: string) => Promise<string | null>;
}

const AnalysisContext = createContext<AnalysisContextType | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  // Session state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const scanSessions = useCallback(async () => {
    setIsScanning(true);
    setScanError(null);

    try {
      const result = await window.electronAPI.scanSessions();

      if (result.error) {
        setScanError(result.error);
        setSessions([]);
      } else {
        setSessions(result.sessions);
        // Auto-select all sessions
        setSelectedSessions(result.sessions.map((s) => s.id));
      }
    } catch (error) {
      setScanError((error as Error).message);
      setSessions([]);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const selectSession = useCallback((id: string) => {
    setSelectedSessions((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  }, []);

  const deselectSession = useCallback((id: string) => {
    setSelectedSessions((prev) => prev.filter((s) => s !== id));
  }, []);

  const selectAllSessions = useCallback(() => {
    setSelectedSessions(sessions.map((s) => s.id));
  }, [sessions]);

  const clearSelection = useCallback(() => {
    setSelectedSessions([]);
  }, []);

  const startAnalysis = useCallback(
    async (userId: string): Promise<string | null> => {
      if (selectedSessions.length === 0) {
        setAnalysisError('No sessions selected');
        return null;
      }

      setIsAnalyzing(true);
      setAnalysisProgress({ stage: 'starting', percent: 0, message: 'Starting analysis...' });
      setAnalysisError(null);

      // Subscribe to progress updates
      const unsubscribe = window.electronAPI.onAnalysisProgress((progress) => {
        setAnalysisProgress(progress);
      });

      try {
        const result = await window.electronAPI.startAnalysis({
          sessions: selectedSessions,
          userId,
        });

        if (result.error) {
          setAnalysisError(result.error);
          return null;
        }

        return result.resultId;
      } catch (error) {
        setAnalysisError((error as Error).message);
        return null;
      } finally {
        setIsAnalyzing(false);
        setAnalysisProgress(null);
        unsubscribe();
      }
    },
    [selectedSessions]
  );

  return (
    <AnalysisContext.Provider
      value={{
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
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
}
