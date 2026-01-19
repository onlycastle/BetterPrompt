/**
 * Analysis Context
 *
 * Manages analysis state including session scanning, analysis progress, and results.
 *
 * Sessions are auto-selected based on recency, token count, and project diversity.
 * Users don't manually select sessions - this improves privacy perception.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/**
 * Summary of auto-selected sessions
 */
interface ScanSummary {
  sessionCount: number;
  projectCount: number;
  totalTokens: number;
  totalMessages: number;
  estimatedCost: string;
  dateRange: {
    oldest: string;
    newest: string;
  };
}

interface AnalysisProgress {
  stage: string;
  percent: number;
  message: string;
}

interface AnalysisContextType {
  // Scan state
  scanSummary: ScanSummary | null;
  isScanning: boolean;
  scanError: string | null;

  // Analysis state
  isAnalyzing: boolean;
  analysisProgress: AnalysisProgress | null;
  analysisError: string | null;

  // Actions
  scanSessions: () => Promise<void>;
  startAnalysis: (userId: string, accessToken?: string) => Promise<string | null>;
}

const AnalysisContext = createContext<AnalysisContextType | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  // Scan state
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
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
        setScanSummary(null);
      } else {
        setScanSummary(result.summary);
      }
    } catch (error) {
      setScanError((error as Error).message);
      setScanSummary(null);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const startAnalysis = useCallback(
    async (userId: string, accessToken?: string): Promise<string | null> => {
      if (!scanSummary || scanSummary.sessionCount === 0) {
        setAnalysisError('No sessions available');
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
        const result = await window.electronAPI.startAnalysis({ userId, accessToken });

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
    [scanSummary]
  );

  return (
    <AnalysisContext.Provider
      value={{
        scanSummary,
        isScanning,
        scanError,
        isAnalyzing,
        analysisProgress,
        analysisError,
        scanSessions,
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
