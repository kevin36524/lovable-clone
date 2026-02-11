import { NextRequest, NextResponse } from 'next/server';
import { refreshSandboxToken } from '@/lib/sandbox-oauth';

/**
 * Token Refresh Proxy Endpoint
 *
 * POST /api/token/refresh
 * Body: { "refresh_token": "string" }
 *
 * Stateless proxy that refreshes Google OAuth access tokens.
 * Tokens are NEVER stored on the server.
 *
 * Request Body:
 * - refresh_token: Google refresh token (required)
 *
 * Response (200):
 * {
 *   "access_token": "string",
 *   "expires_in": number (timestamp),
 *   "token_type": "Bearer",
 *   "refresh_token": "string (optional, if Google returns new one)"
 * }
 *
 * Error Response (401):
 * {
 *   "error": "Failed to refresh token",
 *   "message": "Please re-authenticate",
 *   "code": "REFRESH_FAILED"
 * }
 *
 * Security:
 * - Stateless design (no token storage)
 * - Tokens never logged
 * - CORS enabled for dynamic sandbox URLs
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const { refresh_token } = body;

    // Validate refresh_token is present
    if (!refresh_token || typeof refresh_token !== 'string') {
      return NextResponse.json(
        {
          error: 'Missing refresh_token',
          message: 'refresh_token is required in request body',
          code: 'MISSING_REFRESH_TOKEN',
        },
        {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
          },
        }
      );
    }

    // Refresh token via Google OAuth API (stateless proxy)
    const tokens = await refreshSandboxToken(refresh_token);

    console.log('[OAuth Bridge] Token refresh successful');

    // Return new tokens
    return NextResponse.json(
      {
        access_token: tokens.access_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type || 'Bearer',
        ...(tokens.refresh_token && { refresh_token: tokens.refresh_token }),
      },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
      }
    );
  } catch (error: any) {
    console.error('[OAuth Bridge] Token refresh failed:', error.message);

    // Return 401 Unauthorized for refresh failures
    return NextResponse.json(
      {
        error: 'Failed to refresh token',
        message: 'Please re-authenticate',
        code: 'REFRESH_FAILED',
      },
      {
        status: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
      }
    );
  }
}

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
}
