/**
 * Sandbox OAuth Service
 *
 * Google OAuth utilities for sandbox applications to access Gmail and Calendar.
 * Uses separate OAuth credentials (SANDBOX_GOOGLE_CLIENT_*) from platform auth.
 *
 * Key Features:
 * - Stateless token handling (no server-side storage)
 * - Gmail and Calendar scopes
 * - Offline access for refresh tokens
 * - Force consent to ensure refresh_token is returned
 */

interface SandboxGoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

interface SandboxGoogleUser {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

/**
 * Generate Google OAuth URL for sandbox applications
 *
 * Includes Gmail and Calendar scopes for read-only access.
 * Uses offline access to get refresh tokens.
 *
 * @param state - CSRF protection token (must be cryptographically random)
 * @param redirectUri - The redirect URI to use (supports dynamic hosts for localhost/production)
 * @returns Google OAuth authorization URL
 */
export function getSandboxGoogleAuthUrl(state: string, redirectUri: string): string {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  const params = new URLSearchParams({
    client_id: process.env.SANDBOX_GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state,
    access_type: 'offline', // Request refresh token
    prompt: 'consent', // Force consent screen to ensure refresh_token
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for access and refresh tokens
 *
 * @param code - Authorization code from Google OAuth callback
 * @param redirectUri - The redirect URI used in the initial OAuth request
 * @returns Token response including access_token and refresh_token
 * @throws Error if token exchange fails
 */
export async function exchangeSandboxCodeForTokens(
  code: string,
  redirectUri: string
): Promise<SandboxGoogleTokens> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.SANDBOX_GOOGLE_CLIENT_ID!,
      client_secret: process.env.SANDBOX_GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    // Do NOT log error details as they may contain sensitive info
    throw new Error('Failed to exchange authorization code for tokens');
  }

  const tokens = await response.json();

  // Calculate expires_in as timestamp (current time + seconds)
  if (tokens.expires_in) {
    tokens.expires_in = Math.floor(Date.now() / 1000) + tokens.expires_in;
  }

  return tokens;
}

/**
 * Refresh access token using refresh token
 *
 * This is a stateless proxy - tokens are never stored on the server.
 *
 * @param refreshToken - Refresh token from initial OAuth flow
 * @returns New token response with fresh access_token
 * @throws Error if token refresh fails
 */
export async function refreshSandboxToken(
  refreshToken: string
): Promise<SandboxGoogleTokens> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.SANDBOX_GOOGLE_CLIENT_ID!,
      client_secret: process.env.SANDBOX_GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    // Do NOT log error details or refresh tokens
    throw new Error('Failed to refresh access token');
  }

  const tokens = await response.json();

  // Calculate expires_in as timestamp
  if (tokens.expires_in) {
    tokens.expires_in = Math.floor(Date.now() / 1000) + tokens.expires_in;
  }

  return tokens;
}

/**
 * Validate access token and get user info
 *
 * This validates the token by fetching user information from Google.
 * If the token is valid, returns user info. If invalid, throws error.
 *
 * @param accessToken - Access token to validate
 * @returns User information from Google
 * @throws Error if token is invalid
 */
export async function validateSandboxToken(
  accessToken: string
): Promise<SandboxGoogleUser> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    // Token is invalid or expired
    throw new Error('Invalid or expired access token');
  }

  return response.json();
}
