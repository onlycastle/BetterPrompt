/**
 * Preload Script - IPC Bridge
 *
 * Exposes a secure API to the renderer process via contextBridge.
 * This is the ONLY way renderer can communicate with main process.
 *
 * Sessions are auto-selected based on recency, token count, and project diversity.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { DeepLinkData } from '../main/deep-link';

// Scan summary - aggregate stats for auto-selected sessions
export interface ScanSummary {
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

// Cache info type
interface CacheInfo {
  exists: boolean;
  ageMinutes?: number;
  createdAt?: string;
}

// Quick Fix types
export interface QuickFixProject {
  projectName: string;
  projectPath: string;
  dirPath: string;
  sessionCount: number;
}

export interface QuickFixProgress {
  stage: string;
  percent: number;
  message: string;
}

// Type definitions for the exposed API
export interface ElectronAPI {
  // Session operations - auto-selects optimal sessions
  scanSessions: () => Promise<{
    summary: ScanSummary | null;
    error: string | null;
  }>;
  startAnalysis: (params: {
    userId: string;
    accessToken?: string;
  }) => Promise<{ resultId: string | null; error: string | null }>;

  // Analysis progress listener
  onAnalysisProgress: (
    callback: (progress: { stage: string; percent: number; message: string }) => void
  ) => () => void;

  // Analysis cache
  saveAnalysisCache: (params: {
    result: unknown;
  }) => Promise<{ success: boolean; error?: string }>;
  loadAnalysisCache: () => Promise<{ result: unknown | null; error: string | null }>;
  clearAnalysisCache: () => Promise<{ success: boolean; error?: string }>;
  getCacheInfo: () => Promise<{ info: CacheInfo | null; error: string | null }>;

  // OAuth
  openOAuth: (params: {
    provider: 'google' | 'github';
    redirectUrl: string;
  }) => Promise<{ success: boolean; error?: string }>;

  // Payment
  openCheckout: (params: {
    checkoutUrl: string;
  }) => Promise<{ success: boolean; error?: string }>;

  // External URL
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;

  // Token storage
  storeTokens: (params: {
    accessToken: string;
    refreshToken: string;
  }) => Promise<{ success: boolean }>;
  getTokens: () => Promise<{
    accessToken: string | null;
    refreshToken: string | null;
  }>;
  clearTokens: () => Promise<{ success: boolean }>;

  // Deep link listener
  onDeepLink: (callback: (data: DeepLinkData) => void) => () => void;

  // Quick Fix - local bottleneck detection
  quickFixListProjects: () => Promise<{
    projects: QuickFixProject[];
    error: string | null;
  }>;
  quickFixAnalyze: (params: {
    projectDirPath: string;
    projectName: string;
    projectPath: string;
    apiKey: string;
    isPaid: boolean;
  }) => Promise<{ result: unknown; error: string | null }>;
  onQuickFixProgress: (callback: (progress: QuickFixProgress) => void) => () => void;
}

// Expose API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Session operations - auto-selects optimal sessions
  scanSessions: () => ipcRenderer.invoke('scan-sessions'),
  startAnalysis: (params: { userId: string; accessToken?: string }) =>
    ipcRenderer.invoke('start-analysis', params),

  // Analysis progress listener
  onAnalysisProgress: (
    callback: (progress: { stage: string; percent: number; message: string }) => void
  ) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: { stage: string; percent: number; message: string }) => callback(progress);
    ipcRenderer.on('analysis-progress', handler);
    return () => ipcRenderer.removeListener('analysis-progress', handler);
  },

  // OAuth
  openOAuth: (params: { provider: 'google' | 'github'; redirectUrl: string }) =>
    ipcRenderer.invoke('open-oauth', params),

  // Payment
  openCheckout: (params: { checkoutUrl: string }) =>
    ipcRenderer.invoke('open-checkout', params),

  // External URL
  openExternal: (url: string) =>
    ipcRenderer.invoke('open-external', { url }),

  // Token storage
  storeTokens: (params: { accessToken: string; refreshToken: string }) =>
    ipcRenderer.invoke('store-tokens', params),
  getTokens: () => ipcRenderer.invoke('get-tokens'),
  clearTokens: () => ipcRenderer.invoke('clear-tokens'),

  // Analysis cache
  saveAnalysisCache: (params: { result: unknown }) =>
    ipcRenderer.invoke('save-analysis-cache', params),
  loadAnalysisCache: () => ipcRenderer.invoke('load-analysis-cache'),
  clearAnalysisCache: () => ipcRenderer.invoke('clear-analysis-cache'),
  getCacheInfo: () => ipcRenderer.invoke('get-cache-info'),

  // Deep link listener
  onDeepLink: (callback: (data: DeepLinkData) => void) => {
    console.log('[Preload] onDeepLink: registering listener');
    const handler = (_event: Electron.IpcRendererEvent, data: DeepLinkData) => {
      console.log('[Preload] deep-link IPC received:', data.route);
      callback(data);
    };
    ipcRenderer.on('deep-link', handler);
    return () => {
      console.log('[Preload] onDeepLink: removing listener');
      ipcRenderer.removeListener('deep-link', handler);
    };
  },

  // Quick Fix - local bottleneck detection
  quickFixListProjects: () => ipcRenderer.invoke('quick-fix:list-projects'),
  quickFixAnalyze: (params: {
    projectDirPath: string;
    projectName: string;
    projectPath: string;
    apiKey: string;
    isPaid: boolean;
  }) => ipcRenderer.invoke('quick-fix:analyze', params),
  onQuickFixProgress: (callback: (progress: { stage: string; percent: number; message: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: { stage: string; percent: number; message: string }) => callback(progress);
    ipcRenderer.on('quick-fix:progress', handler);
    return () => ipcRenderer.removeListener('quick-fix:progress', handler);
  },
} satisfies ElectronAPI);

// Type declaration for renderer
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
