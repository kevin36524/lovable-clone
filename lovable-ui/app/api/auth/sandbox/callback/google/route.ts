import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeSandboxCodeForTokens, validateSandboxToken } from '@/lib/sandbox-oauth';

/**
 * OAuth Callback Endpoint for Sandbox Applications
 *
 * GET /api/auth/sandbox/callback/google?code=...&state=...&error=...
 *
 * Handles Google OAuth callback, validates state (CSRF protection),
 * exchanges authorization code for tokens, and redirects to completion page.
 *
 * Query Parameters:
 * - code: Authorization code from Google (required for success)
 * - state: CSRF token (required)
 * - error: Error code from Google (if OAuth failed)
 *
 * Security Features:
 * - State validation (CSRF protection)
 * - Cookies cleared after completion
 * - Tokens never stored on server
 * - Tokens never logged
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Get cookie store
  const cookieStore = await cookies();

  // Retrieve stored values from cookies
  const storedState = cookieStore.get('sandbox_oauth_state')?.value;
  const returnUrl = cookieStore.get('sandbox_oauth_return')?.value;
  const storedBaseUrl = cookieStore.get('sandbox_oauth_base')?.value;

  // Use stored base URL or detect from request headers (Cloud Run, reverse proxies)
  let baseUrl = storedBaseUrl;
  if (!baseUrl) {
    const forwardedHost = req.headers.get('x-forwarded-host');
    const forwardedProto = req.headers.get('x-forwarded-proto');
    const host = forwardedHost || req.nextUrl.host;
    const protocol = forwardedProto || req.nextUrl.protocol.replace(':', '');
    baseUrl = `${protocol}://${host}`;
  }

  const redirectUri = `${baseUrl}/api/auth/sandbox/callback/google`;

  // Handle OAuth error from Google
  if (error) {
    console.error('[OAuth Bridge] OAuth error from Google:', error);

    // Clear OAuth cookies
    cookieStore.delete('sandbox_oauth_state');
    cookieStore.delete('sandbox_oauth_return');
    cookieStore.delete('sandbox_oauth_base');

    // Redirect to returnUrl with error if available
    if (returnUrl) {
      const errorUrl = new URL(returnUrl);
      errorUrl.searchParams.set('oauth_error', error);
      return NextResponse.redirect(errorUrl.toString());
    }

    return NextResponse.json(
      {
        error: 'OAuth failed',
        message: `Google OAuth error: ${error}`,
        code: 'OAUTH_ERROR',
      },
      { status: 400 }
    );
  }

  // Validate state parameter (CSRF protection)
  if (!state || !storedState || state !== storedState) {
    console.error('[OAuth Bridge] State mismatch - possible CSRF attack');

    // Clear OAuth cookies
    cookieStore.delete('sandbox_oauth_state');
    cookieStore.delete('sandbox_oauth_return');
    cookieStore.delete('sandbox_oauth_base');

    return NextResponse.json(
      {
        error: 'Invalid state parameter',
        message: 'State validation failed. Possible CSRF attack.',
        code: 'INVALID_STATE',
      },
      { status: 403 }
    );
  }

  // Validate authorization code is present
  if (!code) {
    console.error('[OAuth Bridge] Authorization code missing');

    // Clear OAuth cookies
    cookieStore.delete('sandbox_oauth_state');
    cookieStore.delete('sandbox_oauth_return');
    cookieStore.delete('sandbox_oauth_base');

    return NextResponse.json(
      {
        error: 'Missing authorization code',
        message: 'Authorization code is required',
        code: 'MISSING_CODE',
      },
      { status: 400 }
    );
  }

  try {
    // Exchange authorization code for tokens using the same redirect URI
    const tokens = await exchangeSandboxCodeForTokens(code, redirectUri);

    // Get user info (validates token and provides email, name, picture)
    const user = await validateSandboxToken(tokens.access_token);

    console.log('[OAuth Bridge] OAuth callback successful');

    // Build redirect URL to completion page with tokens
    const doneUrl = new URL('/api/auth/sandbox/done', baseUrl);
    doneUrl.searchParams.set('access_token', tokens.access_token);

    if (tokens.refresh_token) {
      doneUrl.searchParams.set('refresh_token', tokens.refresh_token);
    }

    doneUrl.searchParams.set('expires_in', tokens.expires_in.toString());
    doneUrl.searchParams.set('email', user.email);

    if (user.name) {
      doneUrl.searchParams.set('name', user.name);
    }

    if (user.picture) {
      doneUrl.searchParams.set('picture', user.picture);
    }

    // Include returnUrl for same-window navigation
    if (returnUrl) {
      doneUrl.searchParams.set('returnUrl', returnUrl);
    }

    // Clear OAuth cookies (cleanup)
    cookieStore.delete('sandbox_oauth_state');
    cookieStore.delete('sandbox_oauth_return');
    cookieStore.delete('sandbox_oauth_base');

    // Redirect to done page
    return NextResponse.redirect(doneUrl.toString());
  } catch (error: any) {
    console.error('[OAuth Bridge] OAuth callback error:', error.message);

    // Clear OAuth cookies
    cookieStore.delete('sandbox_oauth_state');
    cookieStore.delete('sandbox_oauth_return');
    cookieStore.delete('sandbox_oauth_base');

    // Redirect to returnUrl with error if available
    if (returnUrl) {
      const errorUrl = new URL(returnUrl);
      errorUrl.searchParams.set('oauth_error', 'token_exchange_failed');
      return NextResponse.redirect(errorUrl.toString());
    }

    return NextResponse.json(
      {
        error: 'Token exchange failed',
        message: 'Failed to complete OAuth flow',
        code: 'TOKEN_EXCHANGE_FAILED',
      },
      { status: 500 }
    );
  }
}
