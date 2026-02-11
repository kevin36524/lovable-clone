import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

// Page routes that require authentication
const protectedRoutes = ['/generate'];

// API routes that are public (don't require auth)
const publicApiRoutes = ['/api/auth', '/api/token', '/api/health'];

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window

// In-memory rate limit store
// Note: This is per-instance. For production multi-instance deployments,
// consider using Redis or a dedicated rate limiting service.
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Simple rate limiter for OAuth bridge endpoints
 * Limits requests to 100 per 15 minutes per IP address
 */
function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  // Clean up expired entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [key, value] of Array.from(rateLimitStore.entries())) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!record || record.resetTime < now) {
    // Create new record or reset expired one
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Increment count
  record.count += 1;
  rateLimitStore.set(ip, record);
  return { allowed: true };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for Next.js internals, static files, and home page
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/login') ||
    pathname === '/' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Rate limiting for OAuth bridge endpoints
  const isOAuthBridgeEndpoint =
    pathname.startsWith('/api/auth/sandbox') ||
    pathname.startsWith('/api/token');

  if (isOAuthBridgeEndpoint) {
    // Get IP address for rate limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const rateLimit = checkRateLimit(ip);

    if (!rateLimit.allowed) {
      console.warn(`[OAuth Bridge] Rate limit exceeded for IP: ${ip}`);

      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimit.retryAfter?.toString() || '900',
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.retryAfter
              ? (Date.now() / 1000 + rateLimit.retryAfter).toString()
              : '',
          },
        }
      );
    }
  }

  // Check if this is an API route
  const isApiRoute = pathname.startsWith('/api');
  const isPublicApi = publicApiRoutes.some(route => pathname.startsWith(route));

  // Protect API routes (except public ones like /api/auth/*)
  if (isApiRoute && !isPublicApi) {
    const user = await getSession();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    // User is authenticated, allow API request
    return NextResponse.next();
  }

  // Check if page route is protected
  const isProtected = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtected) {
    const user = await getSession();

    if (!user) {
      // Redirect to login with return URL
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
