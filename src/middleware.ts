import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { canAccessRoute, type UserRole } from "@/lib/rbac";

const AUTH_DISABLED = process.env.AUTH_DISABLED === "true";

function redirectWithCookies(
  request: NextRequest,
  sessionResponse: NextResponse,
  targetPath: string
) {
  const redirectResponse = NextResponse.redirect(new URL(targetPath, request.url));
  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value);
  });
  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  // If auth is disabled, skip all checks
  if (AUTH_DISABLED) {
    return supabaseResponse;
  }

  // If Supabase isn't configured, skip
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse;
  }

  // Unauthenticated user trying to access dashboard → redirect to login
  if (!user && pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return redirectWithCookies(request, supabaseResponse, url.toString());
  }

  // Authenticated user on login page → redirect to dashboard
  if (user && pathname === "/login") {
    return redirectWithCookies(request, supabaseResponse, "/dashboard");
  }

  // Root route "/" redirects to login (or dashboard if already authenticated)
  if (pathname === "/") {
    return redirectWithCookies(request, supabaseResponse, user ? "/dashboard" : "/login");
  }

  // Role-based route guard for dashboard sub-routes
  if (user && pathname.startsWith("/dashboard") && pathname !== "/dashboard") {
    let role = (user.app_metadata?.role || user.user_metadata?.role) as UserRole | undefined;

    if (!role) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      role = profile?.role as UserRole | undefined;
    }

    if (!role || !canAccessRoute(role, pathname)) {
      return redirectWithCookies(request, supabaseResponse, "/dashboard?access=denied");
    }
  }

  // Prevent caching of authenticated pages & add security headers
  supabaseResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  supabaseResponse.headers.set("Pragma", "no-cache");
  supabaseResponse.headers.set("Expires", "0");
  supabaseResponse.headers.set("X-Frame-Options", "DENY");
  supabaseResponse.headers.set("X-Content-Type-Options", "nosniff");
  supabaseResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt, sitemap.xml
     * - api (API routes — they handle their own auth)
     * - static files with extensions (svg, png, jpg, jpeg, gif, webp, ico, css, js, woff, woff2, map, json, txt)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|map|json|txt)$).*)",
  ],
};
