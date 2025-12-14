import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  await clearSessionCookie();

  // Get base URL for redirects (Cloud Run compatible)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.url.split('/api')[0];

  return NextResponse.redirect(new URL('/', baseUrl));
}
