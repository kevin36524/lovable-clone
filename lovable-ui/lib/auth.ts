import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { User } from '@/types/auth';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-for-dev-only-DO-NOT-USE-IN-PRODUCTION'
);
const SESSION_COOKIE_NAME = 'hackable_session';
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

export async function createSessionToken(user: User): Promise<string> {
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_DURATION)
    .sign(JWT_SECRET);

  return token;
}

export async function verifySessionToken(token: string): Promise<User | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name as string,
      picture: payload.picture as string | undefined,
    };
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

export function validateEmailDomain(email: string): boolean {
  const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS;

  if (!allowedDomains) {
    console.warn('ALLOWED_EMAIL_DOMAINS not set, denying access');
    return false;
  }

  const emailDomain = email.split('@')[1]?.toLowerCase().trim();
  if (!emailDomain) {
    return false;
  }

  const domains = allowedDomains
    .split(',')
    .map(d => d.toLowerCase().trim());

  return domains.includes(emailDomain);
}

export async function getSession(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION,
    path: '/',
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
