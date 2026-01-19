/**
 * Electron Main Process Entry Point
 *
 * Handles:
 * - Window creation and lifecycle
 * - Deep link protocol (nomoreaislop://)
 * - IPC communication with renderer
 */

import { app, BrowserWindow, shell, protocol } from 'electron';
import path from 'path';
import { registerDeepLinkHandler, handleDeepLink } from './deep-link';
import { setupIpcHandlers } from './ipc-handlers';
import { initAutoUpdater } from './updater';

// Keep a global reference of the window object to prevent garbage collection
let mainWindow: BrowserWindow | null = null;

const PROTOCOL = 'nomoreaislop';

/**
 * Check if running in development mode
 * Must be called after app is ready, not at module load time
 */
function isDev(): boolean {
  return !app.isPackaged;
}

/**
 * Create the main browser window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // macOS native feel
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Load the app
  if (isDev()) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Initialize auto-updater after window is ready
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      initAutoUpdater(mainWindow);
    }
  });
}

/**
 * Register as default protocol handler for nomoreaislop://
 */
function registerProtocol(): void {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
}

/**
 * Handle deep link on macOS (single instance)
 */
function handleMacOSDeepLink(url: string): void {
  console.log('=== DEEP LINK FLOW START ===');
  console.log('1. handleMacOSDeepLink called with URL:', url);
  console.log('2. mainWindow exists:', !!mainWindow);

  if (mainWindow) {
    console.log('3. Window state - isMinimized:', mainWindow.isMinimized(), 'isVisible:', mainWindow.isVisible(), 'isFocused:', mainWindow.isFocused());

    // Ensure window is visible and focused
    if (mainWindow.isMinimized()) {
      console.log('4a. Restoring minimized window...');
      mainWindow.restore();
    }

    console.log('5. Calling mainWindow.show()...');
    mainWindow.show();

    console.log('6. Calling mainWindow.focus()...');
    mainWindow.focus();

    // macOS: Bring app to front
    console.log('7. Showing dock and stealing focus...');
    app.dock?.show();
    app.focus({ steal: true });

    console.log('8. Window state AFTER focus - isVisible:', mainWindow.isVisible(), 'isFocused:', mainWindow.isFocused());

    // Small delay to ensure renderer is ready to receive
    console.log('9. Scheduling deep link handler (100ms delay)...');
    setTimeout(() => {
      if (mainWindow) {
        console.log('10. Timeout fired, calling handleDeepLink...');
        handleDeepLink(mainWindow, url);
        console.log('11. handleDeepLink completed');
      } else {
        console.error('10. ERROR: mainWindow became null during timeout');
      }
    }, 100);
  } else {
    console.error('ERROR: No main window available for deep link');
  }
}

// macOS: Handle deep link when app is already running
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleMacOSDeepLink(url);
});

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    // Handle deep link from second instance
    const url = commandLine.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (url) {
      handleMacOSDeepLink(url);
    } else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerProtocol();
    registerDeepLinkHandler();
    setupIpcHandlers(getMainWindow);
    createWindow();

    app.on('activate', () => {
      // macOS: Re-create window when dock icon is clicked
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  // macOS: Apps typically stay active until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Export for other modules
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
