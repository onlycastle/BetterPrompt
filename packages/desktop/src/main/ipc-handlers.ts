/**
 * IPC Handlers
 *
 * Bridge between renderer process and Node.js APIs.
 * Handles session scanning, analysis, and authentication.
 *
 * Sessions are auto-selected based on recency, token count, and project diversity.
 * Users don't manually select sessions - this improves privacy perception.
 */

import { ipcMain, shell, type BrowserWindow } from 'electron';
import Store from 'electron-store';
import { scanAndSelectSessions, loadSessionsForAnalysis, type ScanSummary } from './scanner';
import { uploadForAnalysis, type AnalysisResult } from './uploader';
import { saveCache, loadCache, clearCache, getCacheInfo } from './cache';
import { getEncryptionKey } from './secure-storage';

// Secure store for tokens - uses OS keychain via safeStorage
const store = new Store({
  name: 'nomoreaislop-secure',
  encryptionKey: getEncryptionKey('tokens'),
});

// Store the latest scan summary for analysis
let lastScanSummary: ScanSummary | null = null;

/**
 * Set up all IPC handlers
 */
export function setupIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  // Session scanning - auto-selects optimal sessions
  ipcMain.handle('scan-sessions', async () => {
    try {
      console.log('[IPC] Scanning and auto-selecting sessions...');
      const summary = await scanAndSelectSessions(15);

      // Store for later use in analysis
      lastScanSummary = summary;

      console.log(`[IPC] Auto-selected ${summary.sessionCount} sessions from ${summary.projectCount} projects`);
      return { summary, error: null };
    } catch (error) {
      console.error('[IPC] Session scan error:', error);
      return { summary: null, error: (error as Error).message };
    }
  });

  // Start analysis - uses auto-selected sessions
  ipcMain.handle('start-analysis', async (_event, { userId, accessToken }) => {
    try {
      if (!lastScanSummary || lastScanSummary.sessionCount === 0) {
        throw new Error('No sessions available. Please scan first.');
      }

      console.log(`[IPC] Starting analysis for ${lastScanSummary.sessionCount} sessions, userId: ${userId}`);

      const mainWindow = getMainWindow();
      if (!mainWindow) {
        throw new Error('Main window not available');
      }

      // Load full session data from auto-selected paths
      const scanResult = await loadSessionsForAnalysis(lastScanSummary.sessionPaths);

      if (scanResult.sessions.length === 0) {
        throw new Error('Failed to load session data');
      }

      console.log(`[IPC] Loaded ${scanResult.sessions.length} sessions, uploading...`);

      // Upload and analyze (accessToken for server-side auth)
      const result = await uploadForAnalysis(scanResult, userId, mainWindow, accessToken);

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
