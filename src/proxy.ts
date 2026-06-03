import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const AUTH_DISABLED = process.env.AUTH_DISABLED === "true";

/** Build a redirect response while forwarding session cookies. */
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
    const { supabaseResponse, user } = await updateSession(request);
    const pathname = request.nextUrl.pathname;

    if (AUTH_DISABLED) {
        return supabaseResponse;
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        return supabaseResponse;
    }

    if (!user && pathname.startsWith("/dashboard")) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("next", pathname);
        return redirectWithCookies(request, supabaseResponse, url.toString());
    }

    if (user && pathname === "/login") {
        return redirectWithCookies(request, supabaseResponse, "/dashboard");
    }

    if (pathname === "/") {
        return redirectWithCookies(
            request,
            supabaseResponse,
            user ? "/dashboard" : "/login"
        );
    }

    return supabaseResponse;
}
