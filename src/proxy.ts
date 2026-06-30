import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const AUTH_DISABLED = process.env.AUTH_DISABLED === "true";

/**
 * Route-to-role access map.
 * Sorted by specificity (longest paths first checked).
 * super_admin and admin always have full access (handled in code).
 */
const ROUTE_ROLES: { path: string; roles: string[] }[] = [
  { path: "/dashboard/users", roles: ["super_admin"] },
  { path: "/dashboard/settings", roles: ["super_admin", "admin"] },
  { path: "/dashboard/finance", roles: ["super_admin", "admin", "accountant"] },
  { path: "/dashboard/marks", roles: ["super_admin", "admin", "exam_controller", "class_teacher"] },
  { path: "/dashboard/exams", roles: ["super_admin", "admin", "exam_controller"] },
  { path: "/dashboard/results", roles: ["super_admin", "admin", "exam_controller"] },
  { path: "/dashboard/students", roles: ["super_admin", "admin", "class_teacher"] },
  { path: "/dashboard/classes", roles: ["super_admin", "admin", "exam_controller"] },
  { path: "/dashboard/subjects", roles: ["super_admin", "admin", "exam_controller"] },
  { path: "/dashboard/administration/exam-schedule", roles: ["super_admin", "admin", "exam_controller"] },
  { path: "/dashboard/administration/teachers-rooms", roles: ["super_admin", "admin"] },
  { path: "/dashboard/administration/routine", roles: ["super_admin", "admin"] },
  { path: "/dashboard/administration/notice", roles: ["super_admin", "admin"] },
  { path: "/dashboard/administration/teacher-shift", roles: ["super_admin", "admin"] },
  { path: "/dashboard/attendance", roles: ["super_admin", "admin", "class_teacher"] },
  { path: "/dashboard/promotion", roles: ["super_admin", "admin"] },
  { path: "/dashboard/archive", roles: ["super_admin", "admin"] },
];

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

export async function proxy(request: NextRequest) {
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

  // Root → redirect
  if (pathname === "/") {
    return redirectWithCookies(request, supabaseResponse, user ? "/dashboard" : "/login");
  }

  // Role-based route guard for dashboard routes
  if (user && pathname.startsWith("/dashboard") && pathname !== "/dashboard") {
    // Reuse the supabase client from updateSession (no duplicate creation)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role || "admin";

    // super_admin and admin bypass all route checks
    if (role !== "super_admin" && role !== "admin") {
      // Find the most specific matching route
      const sorted = [...ROUTE_ROLES].sort((a, b) => b.path.length - a.path.length);

      for (const entry of sorted) {
        if (pathname === entry.path || pathname.startsWith(entry.path + "/")) {
          if (!entry.roles.includes(role)) {
            // Redirect to dashboard with an access denied indicator
            return redirectWithCookies(request, supabaseResponse, "/dashboard?access=denied");
          }
          break;
        }
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes — they handle their own auth)
     */
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
