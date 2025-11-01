import { NextResponse, type NextRequest } from 'next/server';
import { getUserEntitlements, hasRouteAccess } from '@/lib/stripe/entitlements';
import { createServerClient } from '@supabase/ssr';

/**
 * Middleware to check user entitlements and restrict access based on plan
 */
export async function checkEntitlements(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip entitlement checks for public routes
  const publicRoutes = [
    '/auth',
    '/login',
    '/signup',
    '/api/widget',
    '/api/visitor',
    '/api/upload-image',
    '/api/debug',
    '/api/stripe', // Allow Stripe webhooks and API routes
    '/widget.js',
    '/test-widget.html',
    '/_next',
    '/favicon.ico',
  ];

  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return null; // Allow access
  }

  // Only check entitlements for dashboard routes
  if (!pathname.startsWith('/dashboard')) {
    return null; // Allow access to non-dashboard routes
  }

  // Allow access to billing page always (needed for upgrades)
  if (pathname === '/dashboard/billing' || pathname.startsWith('/dashboard/billing/')) {
    return null;
  }

  // Create Supabase client to get user
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // User not authenticated, let auth middleware handle it
    return null;
  }

  // Get user entitlements
  try {
    console.log('[Middleware] Checking entitlements for pathname:', pathname);
    const entitlements = await getUserEntitlements(user.id);
    
    console.log('[Middleware] Entitlements result:', {
      plan: entitlements.plan,
      isPro: entitlements.isPro,
      isFree: entitlements.isFree,
      pathname,
    });

    // Check if user has access to this route
    const hasAccess = hasRouteAccess(pathname, entitlements);
    console.log('[Middleware] Has access:', hasAccess);

    if (!hasAccess) {
      // Redirect free plan users to billing page
      if (entitlements.isFree) {
        console.log('[Middleware] Redirecting free user to billing page');
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard/billing';
        url.searchParams.set('upgrade', 'required');
        return NextResponse.redirect(url);
      }
    }

    // User has access, continue
    console.log('[Middleware] Access granted');
    return null;
  } catch (error) {
    console.error('[Middleware] Error checking entitlements:', error);
    // On error, allow access (fail open) but log the error
    // This prevents breaking the app if there's an issue with entitlements
    return null;
  }
}

