import { NextRequest, NextResponse } from 'next/server';

/**
 * Health Check Endpoint
 *
 * GET /api/health
 *
 * Returns service health status and metadata.
 * Used for monitoring and verifying the OAuth bridge is operational.
 *
 * Response (200):
 * {
 *   "status": "ok",
 *   "timestamp": "2026-02-10T12:34:56.789Z",
 *   "stateless": true,
 *   "tokenStorage": "none",
 *   "service": "oauth-bridge"
 * }
 */
export async function GET(req: NextRequest) {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      stateless: true,
      tokenStorage: 'none',
      service: 'oauth-bridge',
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  );
}
