import { type NextRequest, NextResponse } from "next/server";
import { hasSessionCookie, isPublicApiRoute } from "@/lib/supabase/middleware";

const AUTH_ROUTES = ['/auth', '/login', '/signup'];
const PROTECTED_PREFIXES = ['/dashboard', '/admin'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/') || isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isAuthRoute = AUTH_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const hasSession = hasSessionCookie(request);

  if (!hasSession && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('redirect_to', pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
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
     * - api/widget, api/debug, api/upload-image (API routes)
     * - setup-saas, fix-widget-rls, setup-service-key (setup pages)
     * - widget.js and test-widget.html (chat widget files)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * - audio - .mp3, .wav, .ogg
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/widget|api/debug|api/upload-image|api/visitor|setup-saas|fix-widget-rls|setup-service-key|widget.js|test-widget.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav|ogg)$).*)",
  ],
};
