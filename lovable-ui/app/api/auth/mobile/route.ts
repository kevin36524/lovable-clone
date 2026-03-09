import { NextRequest, NextResponse } from 'next/server';
import { validateEmailDomain, createSessionToken } from '@/lib/auth';

/**
 * Mobile auth endpoint — accepts a Google ID token, verifies it with Google,
 * and returns a hackable_session JWT that the mobile app can use as a cookie.
 *
 * POST /api/auth/mobile
 * Authorization: Bearer <Google ID token>
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!idToken) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  // Verify the Google ID token
  const tokenInfoRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
  );

  if (!tokenInfoRes.ok) {
    console.error('[mobile auth] Google tokeninfo rejected:', tokenInfoRes.status);
    return NextResponse.json({ error: 'Invalid Google ID token' }, { status: 401 });
  }

  const tokenInfo = await tokenInfoRes.json();

  // Validate audience matches our client ID
  const expectedAudience = process.env.GOOGLE_CLIENT_ID;
  if (expectedAudience && tokenInfo.aud !== expectedAudience) {
    console.error('[mobile auth] Token audience mismatch:', tokenInfo.aud);
    return NextResponse.json({ error: 'Token audience mismatch' }, { status: 401 });
  }

  const email: string = tokenInfo.email;
  if (!email) {
    return NextResponse.json({ error: 'No email in token' }, { status: 401 });
  }

  if (!validateEmailDomain(email)) {
    console.warn(`[mobile auth] Unauthorized domain: ${email}`);
    return NextResponse.json({ error: 'Unauthorized email domain' }, { status: 403 });
  }

  const user = {
    id: tokenInfo.sub,
    email,
    name: tokenInfo.name ?? email.split('@')[0],
    picture: tokenInfo.picture,
  };

  const sessionToken = await createSessionToken(user);

  return NextResponse.json({ session: sessionToken });
}
