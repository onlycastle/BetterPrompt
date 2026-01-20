/**
 * Analysis Context
 *
 * Manages analysis state including session scanning, analysis progress, and results.
 *
 * Sessions are auto-selected based on recency, token count, and project diversity.
 * Users don't manually select sessions - this improves privacy perception.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { saveAnalysis } from '../utils/analysisStorage';

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

type AnalysisPhase = 'idle' | 'scanning' | 'analyzing' | 'complete';

interface AnalysisContextType {
  // Scan state
  scanSummary: ScanSummary | null;
  isScanning: boolean;
  scanError: string | null;

  // Analysis state
  isAnalyzing: boolean;
  analysisProgress: AnalysisProgress | null;
  analysisError: string | null;

  // Combined flow state
  currentPhase: AnalysisPhase;

  // Actions
  scanSessions: () => Promise<void>;
  startAnalysis: (userId: string, accessToken?: string) => Promise<string | null>;
  startFullAnalysis: (userId: string, accessToken?: string) => Promise<string | null>;
  resetPhase: () => void;
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

  // Combined flow state
  const [currentPhase, setCurrentPhase] = useState<AnalysisPhase>('idle');

  /**
   * Handle scan failure - sets error state and resets to idle
   */
  const handleScanFailure = useCallback((errorMessage: string) => {
    setScanError(errorMessage);
    setScanSummary(null);
    setCurrentPhase('idle');
  }, []);

  const scanSessions = useCallback(async () => {
    setIsScanning(true);
    setCurrentPhase('scanning');
    setScanError(null);

    try {
      const result = await window.electronAPI.scanSessions();

      if (result.error) {
        handleScanFailure(result.error);
      } else {
        setScanSummary(result.summary);
        setCurrentPhase('idle');
      }
    } catch (error) {
      handleScanFailure((error as Error).message);
    } finally {
      setIsScanning(false);
    }
  }, [handleScanFailure]);

  /**
   * Handle analysis failure - sets error state and resets to idle
   */
  const handleAnalysisFailure = useCallback((errorMessage: string) => {
    setAnalysisError(errorMessage);
    setCurrentPhase('idle');
  }, []);

  /**
   * Start analyzing phase with progress subscription
   */
  const beginAnalyzing = useCallback(() => {
    setIsAnalyzing(true);
    setCurrentPhase('analyzing');
    setAnalysisProgress({ stage: 'starting', percent: 0, message: 'Starting analysis...' });
    setAnalysisError(null);
    return window.electronAPI.onAnalysisProgress((progress) => {
      setAnalysisProgress(progress);
    });
  }, []);

  /**
   * Cleanup after analysis completes (success or failure)
   */
  const cleanupAnalysis = useCallback((unsubscribe: () => void) => {
    setIsAnalyzing(false);
    setAnalysisProgress(null);
    unsubscribe();
  }, []);

  const startAnalysis = useCallback(
    async (userId: string, accessToken?: string): Promise<string | null> => {
      if (!scanSummary || scanSummary.sessionCount === 0) {
        setAnalysisError('No sessions available');
        return null;
      }

      const unsubscribe = beginAnalyzing();

      try {
        const result = await window.electronAPI.startAnalysis({ userId, accessToken });

        if (result.error) {
          handleAnalysisFailure(result.error);
          return null;
        }

        // Save to localStorage for Personal page
        if (result.resultId) {
          saveAnalysis({
            resultId: result.resultId,
            completedAt: new Date().toISOString(),
            sessionCount: scanSummary.sessionCount,
            projectCount: scanSummary.projectCount,
          });
        }

        setCurrentPhase('complete');
        return result.resultId;
      } catch (error) {
        handleAnalysisFailure((error as Error).message);
        return null;
      } finally {
        cleanupAnalysis(unsubscribe);
      }
    },
    [scanSummary, beginAnalyzing, handleAnalysisFailure, cleanupAnalysis]
  );

  /**
   * Combined action: scan sessions then start analysis automatically
   */
  const startFullAnalysis = useCallback(
    async (userId: string, accessToken?: string): Promise<string | null> => {
      // Phase 1: Scanning
      setCurrentPhase('scanning');
      setIsScanning(true);
      setScanError(null);

      let summary: ScanSummary | null = null;

      try {
        const result = await window.electronAPI.scanSessions();

        if (result.error) {
          handleScanFailure(result.error);
          return null;
        }

        summary = result.summary;
        setScanSummary(summary);

        if (!summary || summary.sessionCount === 0) {
          handleScanFailure('No sessions found');
          return null;
        }
      } catch (error) {
        handleScanFailure((error as Error).message);
        return null;
      } finally {
        setIsScanning(false);
      }

      // Phase 2: Analyzing (scanSummary is now set)
      const unsubscribe = beginAnalyzing();

      try {
        const result = await window.electronAPI.startAnalysis({ userId, accessToken });

        if (result.error) {
          handleAnalysisFailure(result.error);
          return null;
        }

        if (result.resultId && summary) {
          saveAnalysis({
            resultId: result.resultId,
            completedAt: new Date().toISOString(),
            sessionCount: summary.sessionCount,
            projectCount: summary.projectCount,
          });
        }

        setCurrentPhase('complete');
        return result.resultId;
      } catch (error) {
        handleAnalysisFailure((error as Error).message);
        return null;
      } finally {
        cleanupAnalysis(unsubscribe);
      }
    },
    [handleScanFailure, beginAnalyzing, handleAnalysisFailure, cleanupAnalysis]
  );

  const resetPhase = useCallback(() => {
    setCurrentPhase('idle');
  }, []);

  return (
    <AnalysisContext.Provider
      value={{
        scanSummary,
        isScanning,
        scanError,
        isAnalyzing,
        analysisProgress,
        analysisError,
        currentPhase,
        scanSessions,
        startAnalysis,
        startFullAnalysis,
        resetPhase,
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
