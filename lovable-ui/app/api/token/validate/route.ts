import { NextRequest, NextResponse } from 'next/server';
import { validateSandboxToken } from '@/lib/sandbox-oauth';

/**
 * Token Validation Endpoint
 *
 * POST /api/token/validate
 * Body: { "access_token": "string" }
 *
 * Validates Google OAuth access token by fetching user info.
 * Stateless proxy - tokens are NEVER stored on the server.
 *
 * Request Body:
 * - access_token: Google access token (required)
 *
 * Success Response (200):
 * {
 *   "valid": true,
 *   "email": "user@example.com",
 *   "name": "User Name",
 *   "picture": "https://..."
 * }
 *
 * Invalid Token Response (200):
 * {
 *   "valid": false
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
    const { access_token } = body;

    // Validate access_token is present
    if (!access_token || typeof access_token !== 'string') {
      return NextResponse.json(
        {
          error: 'Missing access_token',
          message: 'access_token is required in request body',
          code: 'MISSING_ACCESS_TOKEN',
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

    // Validate token by fetching user info from Google
    try {
      const user = await validateSandboxToken(access_token);

      console.log('[OAuth Bridge] Token validation successful');

      // Return validation result with user info
      return NextResponse.json(
        {
          valid: true,
          email: user.email,
          name: user.name,
          picture: user.picture,
          verified_email: user.verified_email,
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
      // Token is invalid or expired
      console.log('[OAuth Bridge] Token validation failed: Invalid or expired token');

      return NextResponse.json(
        {
          valid: false,
        },
        {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
          },
        }
      );
    }
  } catch (error: any) {
    console.error('[OAuth Bridge] Token validation error:', error.message);

    // Return invalid for any parsing or validation errors
    return NextResponse.json(
      {
        valid: false,
      },
      {
        status: 200,
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
