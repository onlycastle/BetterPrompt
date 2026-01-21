/**
 * OAuth Device Flow
 *
 * Implements OAuth 2.0 Device Authorization Grant (RFC 8628)
 * for CLI applications. User authorizes in browser, CLI polls for token.
 *
 * Flow:
 * 1. CLI calls startDeviceFlow() -> gets device_code, user_code, verification_uri
 * 2. User visits verification_uri and enters user_code
 * 3. CLI polls pollForToken() until authorized or expired
 * 4. On success, returns access_token and refresh_token
 */

const DEFAULT_API_BASE = 'https://www.nomoreaislop.xyz';

/**
 * Device flow initiation response
 */
export interface DeviceFlowResponse {
  /** Code that CLI uses to poll for authorization */
  deviceCode: string;
  /** Code that user enters on the authorization page */
  userCode: string;
  /** URL where user should go to authorize */
  verificationUri: string;
  /** Short URL for user convenience (optional) */
  verificationUriComplete?: string;
  /** Seconds until the device_code expires */
  expiresIn: number;
  /** Recommended polling interval in seconds */
  interval: number;
}

/**
 * Token response from polling
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Polling error types
 */
export type PollError =
  | 'authorization_pending'  // User hasn't completed authorization yet
  | 'slow_down'              // Polling too fast
  | 'expired_token'          // Device code expired
  | 'access_denied';         // User denied authorization

/**
 * Poll result
 */
export type PollResult =
  | { status: 'pending' }
  | { status: 'success'; tokens: TokenResponse }
  | { status: 'error'; error: PollError; message: string };

/**
 * Start the device authorization flow
 *
 * @param apiBase - Base URL for the API (default: nomoreaislop.xyz)
 * @returns Device flow response with codes for user authorization
 */
export async function startDeviceFlow(
  apiBase: string = DEFAULT_API_BASE
): Promise<DeviceFlowResponse> {
  const response = await fetch(`${apiBase}/api/auth/device`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to start device flow: ${response.status} ${errorText}`);
  }

  const data = await response.json();

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
 *
 * @param deviceCode - The device code from startDeviceFlow
 * @param apiBase - Base URL for the API
 * @returns Poll result indicating pending, success, or error
 */
export async function pollForToken(
  deviceCode: string,
  apiBase: string = DEFAULT_API_BASE
): Promise<PollResult> {
  const response = await fetch(`${apiBase}/api/auth/device/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });

  const data = await response.json();

  if (response.ok && data.access_token) {
    return {
      status: 'success',
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type || 'Bearer',
      },
    };
  }

  // Handle standard OAuth errors
  if (data.error === 'authorization_pending') {
    return { status: 'pending' };
  }

  if (data.error) {
    return {
      status: 'error',
      error: data.error as PollError,
      message: data.error_description || data.error,
    };
  }

  return {
    status: 'error',
    error: 'access_denied',
    message: 'Unknown error during authorization',
  };
}

/**
 * Poll for token with automatic retry
 *
 * @param deviceCode - The device code from startDeviceFlow
 * @param options - Polling options
 * @returns Token response on success
 * @throws Error on timeout or denial
 */
export async function pollUntilComplete(
  deviceCode: string,
  options: {
    interval?: number;
    timeout?: number;
    apiBase?: string;
    onPoll?: () => void;
  } = {}
): Promise<TokenResponse> {
  const {
    interval = 5,
    timeout = 300,  // 5 minutes default
    apiBase = DEFAULT_API_BASE,
    onPoll,
  } = options;

  const startTime = Date.now();
  let currentInterval = interval;

  while (true) {
    // Check timeout
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > timeout) {
      throw new Error('Device authorization timed out');
    }

    // Wait before polling
    await sleep(currentInterval * 1000);
    onPoll?.();

    const result = await pollForToken(deviceCode, apiBase);

    switch (result.status) {
      case 'success':
        return result.tokens;

      case 'pending':
        // Continue polling
        break;

      case 'error':
        if (result.error === 'slow_down') {
          // Increase interval as requested
          currentInterval += 5;
        } else {
          throw new Error(result.message);
        }
        break;
    }
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get user info from access token
 */
export async function getUserInfo(
  accessToken: string,
  apiBase: string = DEFAULT_API_BASE
): Promise<{ id: string; email: string }> {
  const response = await fetch(`${apiBase}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  const data = await response.json();
  return {
    id: data.id,
    email: data.email,
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  apiBase: string = DEFAULT_API_BASE
): Promise<TokenResponse> {
  const response = await fetch(`${apiBase}/api/auth/refresh`, {
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

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type || 'Bearer',
  };
}
