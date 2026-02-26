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
import { scanAndSelectSessions, loadSessionsForAnalysis, listProjectDirs, listSessionFiles, type ScanSummary } from './scanner';
import { uploadForAnalysis, type AnalysisResult } from './uploader';
import { saveCache, loadCache, clearCache, getCacheInfo } from './cache';
import { getEncryptionKey } from './secure-storage';
import { analyzeQuickFix, type QuickFixResult } from './quick-fix-analyzer';
import { parseSessionContent } from './session-formatter';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

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
      const summary = await scanAndSelectSessions(10);

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
    console.log('[IPC] start-analysis called');
    console.log('[IPC] userId:', userId);
    console.log('[IPC] hasAccessToken:', !!accessToken);

    try {
      if (!lastScanSummary || lastScanSummary.sessionCount === 0) {
        console.error('[IPC] No sessions available');
        throw new Error('No sessions available. Please scan first.');
      }

      console.log('[IPC] lastScanSummary:', {
        sessionCount: lastScanSummary.sessionCount,
        projectCount: lastScanSummary.projectCount,
        totalTokens: lastScanSummary.totalTokens,
        totalMessages: lastScanSummary.totalMessages,
      });

      const mainWindow = getMainWindow();
      if (!mainWindow) {
        console.error('[IPC] Main window not available');
        throw new Error('Main window not available');
      }

      console.log('[IPC] Loading full session data from paths...');
      const scanResult = await loadSessionsForAnalysis(lastScanSummary.sessionPaths);

      if (scanResult.sessions.length === 0) {
        console.error('[IPC] No sessions loaded from paths');
        throw new Error('Failed to load session data');
      }

      console.log('[IPC] Session data loaded:', {
        sessionsCount: scanResult.sessions.length,
        totalMessages: scanResult.totalMessages,
        totalDurationMinutes: scanResult.totalDurationMinutes,
      });

      console.log('[IPC] Starting upload for analysis...');
      const result = await uploadForAnalysis(scanResult, userId, mainWindow, accessToken);

      console.log('[IPC] Analysis complete:', {
        resultId: result.resultId,
        reportUrl: result.reportUrl,
      });
      return { resultId: result.resultId, error: null };
    } catch (error) {
      console.error('[IPC] Analysis error:', error);
      console.error('[IPC] Error stack:', (error as Error).stack);
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

  // ========================================================================
  // Quick Fix - Local bottleneck detection
  // ========================================================================

  // List projects for Quick Fix selection
  ipcMain.handle('quick-fix:list-projects', async () => {
    try {
      const dirs = await listProjectDirs();

      // Get metadata for each project
      const projects = await Promise.all(
        dirs.map(async (dir) => {
          const files = await listSessionFiles(dir);
          const dirName = basename(dir);
          // Decode project path from dir name
          const projectPath = dirName.startsWith('-')
            ? dirName.replace(/-/g, '/')
            : dirName;
          const parts = projectPath.split('/').filter(Boolean);
          const projectName = parts[parts.length - 1] || 'unknown';

          return {
            projectName,
            projectPath: dirName,
            dirPath: dir,
            sessionCount: files.length,
          };
        })
      );

      // Filter to projects with sessions, sort by session count
      const filtered = projects
        .filter(p => p.sessionCount > 0)
        .sort((a, b) => b.sessionCount - a.sessionCount);

      return { projects: filtered, error: null };
    } catch (error) {
      console.error('[IPC] quick-fix:list-projects error:', error);
      return { projects: [], error: (error as Error).message };
    }
  });

  // Run Quick Fix analysis on a single project
  ipcMain.handle('quick-fix:analyze', async (_event, {
    projectDirPath,
    projectName,
    projectPath,
    apiKey,
    isPaid,
  }: {
    projectDirPath: string;
    projectName: string;
    projectPath: string;
    apiKey: string;
    isPaid: boolean;
  }) => {
    try {
      console.log(`[IPC] Quick Fix: analyzing project "${projectName}"`);

      const mainWindow = getMainWindow();

      // Get recent session files (max 5 for Quick Fix speed)
      const files = await listSessionFiles(projectDirPath);
      const recentFiles = files.slice(-5); // Take 5 most recent

      if (recentFiles.length === 0) {
        throw new Error('No session files found for this project');
      }

      // Parse sessions
      const sessions = [];
      for (const filePath of recentFiles) {
        try {
          const content = await readFile(filePath, 'utf-8');
          const fileName = basename(filePath, '.jsonl');
          const parsed = parseSessionContent(fileName, projectPath, projectName, content);
          if (parsed && parsed.messages.length >= 4) {
            sessions.push(parsed);
          }
        } catch (err) {
          console.warn(`[IPC] Quick Fix: skipping unparseable file ${filePath}:`, err);
        }
      }

      if (sessions.length === 0) {
        throw new Error('No valid sessions found. Need sessions with at least 4 messages.');
      }

      console.log(`[IPC] Quick Fix: parsed ${sessions.length} sessions`);

      const result = await analyzeQuickFix(sessions, {
        apiKey,
        projectName,
        projectPath,
        isPaid,
        onProgress: (stage, percent, message) => {
          try {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('quick-fix:progress', { stage, percent, message });
            }
          } catch {
            // Window destroyed mid-analysis — safe to ignore
          }
        },
      });

      console.log(`[IPC] Quick Fix complete: ${result.bottlenecks.length} bottlenecks, health: ${result.overallHealthScore}`);
      return { result, error: null };
    } catch (error) {
      console.error('[IPC] Quick Fix error:', error);
      return { result: null, error: (error as Error).message };
    }
  });

  console.log('IPC handlers registered');
}
