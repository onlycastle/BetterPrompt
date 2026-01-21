/**
 * Auth Module Exports
 *
 * Provides authentication utilities for CLI and Desktop apps.
 */

export {
  storeTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  getStoredUserEmail,
  getStoredTokens,
  clearTokens,
  hasStoredTokens,
  type StoredTokens,
} from './token-store.js';

export {
  startDeviceFlow,
  pollForToken,
  pollUntilComplete,
  getUserInfo,
  refreshAccessToken,
  type DeviceFlowResponse,
  type TokenResponse,
  type PollError,
  type PollResult,
} from './device-flow.js';
