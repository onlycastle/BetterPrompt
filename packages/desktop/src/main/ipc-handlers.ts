/**
 * IPC Handlers
 *
 * Bridge between renderer process and Node.js APIs.
 * Handles session scanning, analysis, and authentication.
 */

import { ipcMain, shell, type BrowserWindow } from 'electron';
import Store from 'electron-store';
import { scanSessionsForUI, loadSessionsForAnalysis, type SessionInfo } from './scanner';
import { uploadForAnalysis, type AnalysisResult } from './uploader';
import { estimateAnalysisCost, formatCostEstimateForUI } from './cost-estimator';
import { saveCache, loadCache, clearCache, getCacheInfo } from './cache';

// Secure store for tokens
const store = new Store({
  name: 'nomoreaislop-secure',
  encryptionKey: 'nomoreaislop-desktop-key', // TODO: Use keychain in production
});

// Store session info map for quick lookup by ID
const sessionInfoMap = new Map<string, SessionInfo>();

/**
 * Set up all IPC handlers
 */
export function setupIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  // Session scanning
  ipcMain.handle('scan-sessions', async () => {
    try {
      console.log('[IPC] Scanning sessions...');
      const sessions = await scanSessionsForUI(20);

      // Store session info for later lookup
      sessionInfoMap.clear();
      for (const session of sessions) {
        sessionInfoMap.set(session.id, session);
      }

      console.log(`[IPC] Found ${sessions.length} sessions`);
      return { sessions, error: null };
    } catch (error) {
      console.error('[IPC] Session scan error:', error);
      return { sessions: [], error: (error as Error).message };
    }
  });

  // Start analysis
  ipcMain.handle('start-analysis', async (_event, { sessions: sessionIds, userId }) => {
    try {
      console.log(`[IPC] Starting analysis for ${sessionIds.length} sessions, userId: ${userId}`);

      const mainWindow = getMainWindow();
      if (!mainWindow) {
        throw new Error('Main window not available');
      }

      // Get file paths for selected session IDs
      const sessionPaths: string[] = [];
      for (const id of sessionIds) {
        const info = sessionInfoMap.get(id);
        if (info) {
          sessionPaths.push(info.path);
        }
      }

      if (sessionPaths.length === 0) {
        throw new Error('No valid sessions selected');
      }

      // Load full session data
      const scanResult = await loadSessionsForAnalysis(sessionPaths);

      if (scanResult.sessions.length === 0) {
        throw new Error('Failed to load session data');
      }

      console.log(`[IPC] Loaded ${scanResult.sessions.length} sessions, uploading...`);

      // Upload and analyze
      const result = await uploadForAnalysis(scanResult, userId, mainWindow);

      console.log(`[IPC] Analysis complete, resultId: ${result.resultId}`);
      return { resultId: result.resultId, error: null };
    } catch (error) {
      console.error('[IPC] Analysis error:', error);
      return { resultId: null, error: (error as Error).message };
    }
  });

  // Open OAuth window in system browser
  ipcMain.handle('open-oauth', async (_event, { provider, redirectUrl }) => {
    console.log('[IPC] open-oauth called for provider:', provider);
    console.log('[IPC] Opening URL in system browser:', redirectUrl.substring(0, 80) + '...');
    try {
      await shell.openExternal(redirectUrl);
      console.log('[IPC] shell.openExternal succeeded');
      return { success: true };
    } catch (error) {
      console.error('[IPC] OAuth error:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Open checkout in browser
  ipcMain.handle('open-checkout', async (_event, { checkoutUrl }) => {
    try {
      await shell.openExternal(checkoutUrl);
      return { success: true };
    } catch (error) {
      console.error('Checkout error:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Open external URL in system browser
  ipcMain.handle('open-external', async (_event, { url }) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Open external error:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Token storage
  ipcMain.handle('store-tokens', async (_event, { accessToken, refreshToken }) => {
    store.set('accessToken', accessToken);
    store.set('refreshToken', refreshToken);
    return { success: true };
  });

  ipcMain.handle('get-tokens', async () => {
    return {
      accessToken: store.get('accessToken') as string | null,
      refreshToken: store.get('refreshToken') as string | null,
    };
  });

  ipcMain.handle('clear-tokens', async () => {
    store.delete('accessToken');
    store.delete('refreshToken');
    return { success: true };
  });

  // Cost estimation
  ipcMain.handle('get-cost-estimate', async (_event, { sessionIds }) => {
    try {
      console.log(`[IPC] Estimating cost for ${sessionIds.length} sessions`);

      // Get file paths for selected session IDs
      const sessionPaths: string[] = [];
      for (const id of sessionIds) {
        const info = sessionInfoMap.get(id);
        if (info) {
          sessionPaths.push(info.path);
        }
      }

      if (sessionPaths.length === 0) {
        throw new Error('No valid sessions selected');
      }

      // Load full session data for accurate estimation
      const scanResult = await loadSessionsForAnalysis(sessionPaths);

      if (scanResult.sessions.length === 0) {
        throw new Error('Failed to load session data');
      }

      // Extract parsed sessions for cost estimation
      const parsedSessions = scanResult.sessions.map(s => s.parsed);

      // Calculate cost estimate
      const estimate = estimateAnalysisCost(parsedSessions);
      const formatted = formatCostEstimateForUI(estimate, sessionIds.length);

      console.log(`[IPC] Cost estimate: ${formatted.totalCost}`);
      return { estimate: formatted, error: null };
    } catch (error) {
      console.error('[IPC] Cost estimation error:', error);
      return { estimate: null, error: (error as Error).message };
    }
  });

  // Analysis cache
  ipcMain.handle('save-analysis-cache', async (_event, { result }: { result: AnalysisResult }) => {
    try {
      saveCache(result);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Cache save error:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('load-analysis-cache', async () => {
    try {
      const result = loadCache();
      return { result, error: null };
    } catch (error) {
      console.error('[IPC] Cache load error:', error);
      return { result: null, error: (error as Error).message };
    }
  });

  ipcMain.handle('clear-analysis-cache', async () => {
    try {
      clearCache();
      return { success: true };
    } catch (error) {
      console.error('[IPC] Cache clear error:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('get-cache-info', async () => {
    try {
      const info = getCacheInfo();
      return { info, error: null };
    } catch (error) {
      console.error('[IPC] Cache info error:', error);
      return { info: null, error: (error as Error).message };
    }
  });

  console.log('IPC handlers registered');
}
