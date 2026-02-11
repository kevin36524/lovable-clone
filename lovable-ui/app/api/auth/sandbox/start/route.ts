import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getSandboxGoogleAuthUrl } from '@/lib/sandbox-oauth';

/**
 * OAuth Initiation Endpoint for Sandbox Applications
 *
 * GET /api/auth/sandbox/start?returnUrl=<sandbox-url>
 *
 * Initiates OAuth flow for sandbox applications to access Gmail and Calendar.
 * Generates CSRF state token, stores in cookie, and redirects to Google OAuth.
 *
 * Query Parameters:
 * - returnUrl: The sandbox URL to return tokens to (required)
 *
 * Security Features:
 * - CSRF protection via cryptographically random state
 * - State and returnUrl stored in httpOnly cookies
 * - Cookies expire after 10 minutes
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const returnUrl = searchParams.get('returnUrl');

  // Validate returnUrl parameter
  if (!returnUrl) {
    return NextResponse.json(
      {
        error: 'Missing returnUrl parameter',
        message: 'returnUrl query parameter is required',
      },
      { status: 400 }
    );
  }

  try {
    // Get base URL from request (supports both localhost and production)
    // Check for forwarded host headers (Cloud Run, reverse proxies)
    const forwardedHost = req.headers.get('x-forwarded-host');
    const forwardedProto = req.headers.get('x-forwarded-proto');

    const host = forwardedHost || req.nextUrl.host;
    const protocol = forwardedProto || req.nextUrl.protocol.replace(':', '');

    const baseUrl = `${protocol}://${host}`;
    const redirectUri = `${baseUrl}/api/auth/sandbox/callback/google`;

    // Generate cryptographically random state (32 bytes = 64 hex chars)
    const state = crypto.randomBytes(32).toString('hex');

    // Get cookie store
    const cookieStore = await cookies();

    // Store state in httpOnly cookie for CSRF protection
    cookieStore.set('sandbox_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // Store returnUrl in httpOnly cookie
    cookieStore.set('sandbox_oauth_return', returnUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // Store base URL for callback to use
    cookieStore.set('sandbox_oauth_base', baseUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // Generate Google OAuth URL with state and dynamic redirect URI
    const authUrl = getSandboxGoogleAuthUrl(state, redirectUri);

    console.log('[OAuth Bridge] OAuth flow initiated');

    // Redirect to Google OAuth
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('[OAuth Bridge] Failed to initiate OAuth flow:', error.message);

    return NextResponse.json(
      {
        error: 'Failed to initiate OAuth flow',
        message: 'An error occurred while starting authentication',
      },
      { status: 500 }
    );
  }
}
