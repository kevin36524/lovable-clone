import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

// Page routes that require authentication
const protectedRoutes = ['/generate'];

// API routes that are public (don't require auth)
const publicApiRoutes = ['/api/auth'];

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
