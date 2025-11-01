import { updateSession } from "@/lib/supabase/middleware";
import { checkEntitlements } from "@/lib/middleware/entitlements";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // First, update Supabase session
  const sessionResponse = await updateSession(request);
  
  // If session update returns a redirect, use it
  if (sessionResponse && sessionResponse instanceof NextResponse) {
    if (sessionResponse.status === 307 || sessionResponse.status === 308) {
      return sessionResponse;
    }
  }

  // Then, check entitlements
  const entitlementsResponse = await checkEntitlements(request);
  
  // If entitlements check returns a redirect, use it
  if (entitlementsResponse && entitlementsResponse instanceof NextResponse) {
    return entitlementsResponse;
  }

  // Otherwise, return the session response or a pass-through
  return sessionResponse || NextResponse.next();
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
