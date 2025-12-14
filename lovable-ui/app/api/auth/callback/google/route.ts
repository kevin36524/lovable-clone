import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForTokens, getGoogleUserInfo } from '@/lib/google-oauth';
import { validateEmailDomain, createSessionToken, setSessionCookie } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Get base URL for redirects (Cloud Run compatible)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.url.split('/api')[0];

  // Handle OAuth error from Google
  if (error) {
    console.error('OAuth error from Google:', error);
    return NextResponse.redirect(new URL(`/login?error=oauth_${error}`, baseUrl));
  }

  // Get stored state and redirect URL
  const cookieStore = await cookies();
  const storedState = cookieStore.get('oauth_state')?.value;
  const redirect = cookieStore.get('oauth_redirect')?.value || '/generate';

  // Verify state parameter (CSRF protection)
  if (!state || !storedState || state !== storedState) {
    console.error('State mismatch - possible CSRF attack');
    return NextResponse.redirect(new URL('/login?error=invalid_state', baseUrl));
  }

  // Verify authorization code is present
  if (!code) {
    console.error('Authorization code missing');
    return NextResponse.redirect(new URL('/login?error=missing_code', baseUrl));
  }

  try {
    // Exchange authorization code for access token
    const tokens = await exchangeCodeForTokens(code);

    // Fetch user info from Google
    const googleUser = await getGoogleUserInfo(tokens.access_token);

    // Validate email domain
    if (!validateEmailDomain(googleUser.email)) {
      console.warn(`Unauthorized domain for email: ${googleUser.email}`);
      return NextResponse.redirect(new URL('/login?error=unauthorized_domain', baseUrl));
    }

    // Create user object
    const user = {
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
    };

    // Create JWT session token
    const sessionToken = await createSessionToken(user);

    // Set session cookie
    await setSessionCookie(sessionToken);

    // Clear OAuth temporary cookies
    cookieStore.delete('oauth_state');
    cookieStore.delete('oauth_redirect');

    // Redirect to destination using public base URL
    return NextResponse.redirect(new URL(redirect, baseUrl));
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=oauth_failed', baseUrl));
  }
}
