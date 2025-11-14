import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAMES = ['sb-access-token', 'sb-refresh-token'];
const SESSION_COOKIE_PREFIXES = [
  'sb-', // e.g. sb-projectref-auth-token, sb-projectref-auth-token.0
  'supabase.auth.token',
  'supabase-auth-token',
];
const PUBLIC_API_PREFIXES = ['/api/widget', '/api/visitor', '/api/upload-image', '/api/debug'];

export function hasSessionCookie(request: NextRequest) {
  const cookies = request.cookies.getAll();

  return cookies.some(({ name }) => {
    if (SESSION_COOKIE_NAMES.includes(name)) {
      return true;
    }

    return SESSION_COOKIE_PREFIXES.some((prefix) =>
      name.startsWith(prefix)
    );
  });
}

export function isPublicApiRoute(pathname: string) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

