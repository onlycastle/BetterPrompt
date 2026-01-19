/**
 * Auto-Updater Module
 *
 * Handles automatic updates using electron-updater with GitHub Releases.
 * Checks for updates on app start and periodically.
 */

import { app, BrowserWindow, dialog } from 'electron';

// Only import electron-updater in production
// This prevents initialization errors in dev mode
type AutoUpdater = typeof import('electron-updater').autoUpdater;
let autoUpdater: AutoUpdater | null = null;

let mainWindow: BrowserWindow | null = null;

/**
 * Initialize the auto-updater
 */
export function initAutoUpdater(window: BrowserWindow): void {
  // Skip in development mode
  if (!app.isPackaged) {
    console.log('[Updater] Skipping auto-updater in development mode');
    return;
  }

  mainWindow = window;

  // Dynamically import electron-updater only in production
  import('electron-updater').then((module) => {
    autoUpdater = module.autoUpdater;

    // Configure logging
    autoUpdater.logger = console;

    // Don't auto-download - let user decide
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Set up event handlers
    setupEventHandlers();

    // Check for updates immediately on start
    checkForUpdates();

    // Check for updates every 4 hours
    setInterval(checkForUpdates, 4 * 60 * 60 * 1000);
  }).catch((error) => {
    console.error('[Updater] Failed to load electron-updater:', error);
  });
}

/**
 * Set up auto-updater event handlers
 */
function setupEventHandlers(): void {
  if (!autoUpdater) return;

  // Event: Update available
  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version);

    // Show dialog to user
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available.`,
        detail: 'Would you like to download it now?',
        buttons: ['Download', 'Later'],
        defaultId: 0,
        cancelId: 1,
      }).then((result) => {
        if (result.response === 0 && autoUpdater) {
          autoUpdater.downloadUpdate();
        }
      });
    }
  });

  // Event: Update not available
  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] No updates available');
  });

  // Event: Download progress
  autoUpdater.on('download-progress', (progress) => {
    console.log(`[Updater] Download progress: ${progress.percent.toFixed(1)}%`);

    // Notify renderer about progress
    if (mainWindow) {
      mainWindow.webContents.send('update-download-progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        total: progress.total,
        transferred: progress.transferred,
      });
    }
  });

  // Event: Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded:', info.version);

    // Show dialog to restart
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded.',
        detail: 'The application will restart to install the update.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      }).then((result) => {
        if (result.response === 0 && autoUpdater) {
          autoUpdater.quitAndInstall();
        }
      });
    }
  });

  // Event: Error
  autoUpdater.on('error', (error) => {
    console.error('[Updater] Error:', error.message);
  });
}

/**
 * Check for available updates
 */
export async function checkForUpdates(): Promise<void> {
  if (!autoUpdater) {
    console.log('[Updater] Auto-updater not initialized');
    return;
  }

  try {
    console.log('[Updater] Checking for updates...');
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error('[Updater] Error checking for updates:', error);
  }
}
