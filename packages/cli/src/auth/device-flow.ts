/**
 * OAuth Device Flow
 *
 * Implements OAuth 2.0 Device Authorization Grant (RFC 8628)
 * for CLI applications.
 */

const API_BASE = 'https://www.nomoreaislop.xyz';

export interface DeviceFlowResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresIn: number;
  interval: number;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type PollResult =
  | { status: 'pending' }
  | { status: 'success'; tokens: TokenResponse }
  | { status: 'error'; error: string; message: string };

interface DeviceFlowAPIResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval?: number;
}

interface TokenPollAPIResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface UserInfoAPIResponse {
  id: string;
  email: string;
}

/**
 * Start the device authorization flow
 */
export async function startDeviceFlow(): Promise<DeviceFlowResponse> {
  const response = await fetch(`${API_BASE}/api/auth/device`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to start device flow: ${response.status} ${errorText}`);
  }

  const data = await response.json() as DeviceFlowAPIResponse;

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    verificationUriComplete: data.verification_uri_complete,
    expiresIn: data.expires_in,
    interval: data.interval || 5,
  };
}

/**
 * Poll for token authorization
 */
export async function pollForToken(deviceCode: string): Promise<PollResult> {
  const response = await fetch(`${API_BASE}/api/auth/device/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });

  const data = await response.json() as TokenPollAPIResponse;

  if (response.ok && data.access_token) {
    return {
      status: 'success',
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token!,
        expiresIn: data.expires_in!,
      },
    };
  }

  if (data.error === 'authorization_pending') {
    return { status: 'pending' };
  }

  return {
    status: 'error',
    error: data.error || 'unknown_error',
    message: data.error_description || data.error || 'Unknown error',
  };
}

/**
 * Get user info from access token
 */
export async function getUserInfo(accessToken: string): Promise<{ id: string; email: string }> {
  const response = await fetch(`${API_BASE}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  return response.json() as Promise<UserInfoAPIResponse>;
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const response = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const data = await response.json() as TokenPollAPIResponse;
  return {
    accessToken: data.access_token!,
    refreshToken: data.refresh_token!,
    expiresIn: data.expires_in!,
  };
}
