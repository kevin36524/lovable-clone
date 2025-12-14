import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/google-oauth';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    // Generate random state for CSRF protection
    const state = crypto.randomUUID();
    const redirect = req.nextUrl.searchParams.get('redirect') || '/generate';

    // Store state and redirect URL in cookies
    const cookieStore = await cookies();
    cookieStore.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 5, // 5 minutes
      path: '/',
    });

    cookieStore.set('oauth_redirect', redirect, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 5, // 5 minutes
      path: '/',
    });

    // Redirect to Google OAuth
    const authUrl = getGoogleAuthUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating Google OAuth:', error);

    // Get base URL for redirects (Cloud Run compatible)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.url.split('/api')[0];

    return NextResponse.redirect(new URL('/login?error=oauth_init_failed', baseUrl));
  }
}
